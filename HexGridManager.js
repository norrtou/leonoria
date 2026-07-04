// HexGridManager.js — Leonoria interactive hex-grid engine
//
// Pointy-topped hex grid with axial coordinates (q, r).
//
// hex_size = viewBox_width / cols   ← the spec formula, one division, no loops
//
// hexToPixel(q, r):
//   x = hex_size * (q + r / 2)
//   y = hex_size * (√3 / 2) * r
//
// pixelToHex(x, y):
//   r_frac = y / (hex_size * √3/2)
//   q_frac = x / hex_size  −  r_frac / 2
//   → cube-round(q_frac, r_frac)
//
// All cells indexed as Map<"q_r", cell> for O(1) lookup — no search loops.

'use strict';

class HexGridManager {

    // ── Construction ───────────────────────────────────────────────────────────

    /**
     * @param {object}     mapData  JSON produced by FantasyMap._buildExportData()
     * @param {SVGElement} [svgEl]  The rendered map SVG to overlay (optional)
     */
    constructor(mapData, svgEl = null) {
        const meta = mapData.map_metadata;

        // ── Identity ───────────────────────────────────────────────────────────
        this.mapId   = meta.map_id;
        this.mapType = meta.map_type;   // 'WORLD' | 'DUNGEON'
        this.biome   = meta.biome ?? null;
        this.seed    = meta.seed   ?? null;

        // ── Grid dimensions ────────────────────────────────────────────────────
        // Support both the exported format (cols/rows) and the template format
        // (width_cells/height_cells) so HexGridManager works with any JSON source.
        const gd  = meta.grid_dimensions;
        this.cols = gd.cols ?? gd.width_cells;
        this.rows = gd.rows ?? gd.height_cells;

        // ── Pixel dimensions — DYNAMIC, no hardcoded values ────────────────────
        const vb = meta.svg_config.viewBox.split(' ').map(Number);
        this.vbX = vb[0]; this.vbY = vb[1];
        this.vbW = vb[2]; this.vbH = vb[3];

        // hex_size = viewBox_width / cols  (one division, no loops)
        // Odd-r offset pointy-topped hex grid:
        //   hexW  = column spacing  (= vbW / cols)
        //   hexR  = circumradius    (= hexW / sqrt(3))
        //   rowH  = row spacing     (= 1.5 * hexR)
        this.hexSize = this.vbW / this.cols;            // column width = hexW
        this.hexR    = this.hexSize / Math.sqrt(3);     // circumradius
        this.rowH    = 1.5 * this.hexR;                 // vertical row spacing
        // Legacy alias (was vbH/rows before hex refactor)
        this.cellH   = this.rowH;

        // ── Hex scale ──────────────────────────────────────────────────────────
        const ds = meta.hex_scale;
        this.hexSizeUnits = ds.hex_size;  // 6 miles (WORLD) or 5 feet (DUNGEON)
        this.hexUnit      = ds.unit;      // 'miles' | 'feet'

        // ── Cell index — O(1) lookup by "q_r" key ──────────────────────────────
        // Normalises both the flat export format and the nested template format.
        this.cells = new Map();
        for (const raw of mapData.cells) {
            const cell = this._normalise(raw);
            this.cells.set(`${cell.q}_${cell.r}`, cell);
        }

        // ── SVG overlay ────────────────────────────────────────────────────────
        this._svg     = svgEl;
        this._overlay = null;
        this._clickHandlers = [];
        if (svgEl) this._initOverlay(svgEl);
    }

    // ── Static factories ───────────────────────────────────────────────────────

    /**
     * Use in-memory data from the last FantasyMap export (zero latency).
     * Falls back to load() if no export has happened this session.
     *
     * @param {SVGElement} [svgEl]
     * @param {string}     [fallbackPath]  URL to fetch if MapSaveStore has no data
     */
    static async fromLastSave(svgEl = null, fallbackPath = null) {
        const saved = (typeof MapSaveStore !== 'undefined') && MapSaveStore.lastSaved;
        if (saved) return new HexGridManager(saved.jsonData, svgEl);
        if (fallbackPath) return HexGridManager.load(fallbackPath, svgEl);
        throw new Error('[HexGridManager] No in-memory map data and no fallback path given.');
    }

    /**
     * Load a JSON file from a URL and construct the manager.
     *
     * @param {string}     jsonPath  e.g. 'data/maps/leonoria_deadbeef.json'
     * @param {SVGElement} [svgEl]
     */
    static async load(jsonPath, svgEl = null) {
        const res = await fetch(jsonPath);
        if (!res.ok) throw new Error(`[HexGridManager] Failed to load ${jsonPath}: ${res.status}`);
        const data = await res.json();
        return new HexGridManager(data, svgEl);
    }

    // ── Coordinate conversion ──────────────────────────────────────────────────
    //
    // Odd-r offset pointy-topped hex grid.
    //
    //   hexToPixel(q, r):
    //     x = hexSize * (q + 0.5 + 0.5 * (r & 1))
    //     y = hexR + r * rowH
    //
    //   pixelToHex(x, y):
    //     r_approx = round((y - hexR) / rowH)
    //     offset   = 0.5 * (r & 1)
    //     q_approx = round(x / hexSize - 0.5 - offset)

    /**
     * Pixel position (SVG units) → cell coordinates (q, r).
     * O(1) — arithmetic only, no iteration.
     */
    pixelToHex(x, y) {
        const r = Math.round((y - this.hexR) / this.rowH);
        const rC = Math.max(0, Math.min(this.rows - 1, r));
        const offset = 0.5 * (rC & 1);
        const q = Math.round(x / this.hexSize - 0.5 - offset);
        return {
            q: Math.max(0, Math.min(this.cols - 1, q)),
            r: rC,
        };
    }

    /**
     * Cell coordinates → pixel centre (SVG units).
     */
    hexToPixel(q, r) {
        return {
            x: this.hexSize * (q + 0.5 + 0.5 * (r & 1)),
            y: this.hexR + r * this.rowH,
        };
    }

    // ── Cell access ────────────────────────────────────────────────────────────

    /**
     * O(1) cell lookup.
     *
     * @param  {number} q
     * @param  {number} r
     * @returns {object|null}
     */
    getCell(q, r) {
        return this.cells.get(`${q}_${r}`) ?? null;
    }

    /**
     * The 6 axial hex neighbours of (q, r) — pointy-topped layout.
     * Only returns cells that exist in the index.
     *
     *       NW  NE
     *     W  (q,r)  E
     *       SW  SE
     *
     * Axial directions:  [+1, 0]  E   [-1, 0]  W
     *                    [0, +1]  SE  [ 0, -1]  NW
     *                   [+1, -1]  NE  [-1, +1]  SW
     */
    static SQRT3   = Math.sqrt(3);
    static SQRT3_2 = Math.sqrt(3) / 2;   // √3/2 ≈ 0.866

    // Odd-r offset neighbours of (q, r) — pointy-topped hex grid.
    // Odd rows are shifted right by half a hex width.
    //   d = r & 1   → 0 for even rows, 1 for odd rows
    //   E / W stay fixed; NE/NW/SE/SW shift with row parity.
    static _oddRNeighbors(q, r) {
        const d = r & 1;
        return [
            [q+1, r],       // E
            [q-1, r],       // W
            [q+d,   r-1],   // NE (even: same col; odd: col+1)
            [q+d-1, r-1],   // NW
            [q+d,   r+1],   // SE
            [q+d-1, r+1],   // SW
        ];
    }

    getNeighbors(q, r) {
        const result = [];
        for (const [nq, nr] of HexGridManager._oddRNeighbors(q, r)) {
            const cell = this.getCell(nq, nr);
            if (cell) result.push(cell);
        }
        return result;
    }

    // ── A* Pathfinding ─────────────────────────────────────────────────────────

    /**
     * Find the lowest-cost path between two cells using A* with Leonoria move costs.
     * Each step's cost is multiplied by the destination cell's move_cost:
     *   - 1.0 = Normal terrain   (plains, coast, settlement …)
     *   - 2.0 = Difficult Terrain (forest, hills, mountain, swamp …)
     *   - null = Impassable       (sea)
     *
     * @param  {number} q0  Start column
     * @param  {number} r0  Start row
     * @param  {number} q1  Goal  column
     * @param  {number} r1  Goal  row
     * @returns {object[]|null}  Ordered cell array (start → goal), or null if unreachable
     */
    findPath(q0, r0, q1, r1) {
        const goalKey  = `${q1}_${r1}`;
        const startKey = `${q0}_${r0}`;

        const startCell = this.getCell(q0, r0);
        const goalCell  = this.getCell(q1, r1);
        if (!startCell || !goalCell)                  return null;
        if (goalCell.move_cost === null)               return null;   // destination is sea
        if (goalCell.is_passable === false)            return null;   // impassable (high peak …)

        // Hex cube-distance heuristic (admissible: move_cost ≥ 1 on all passable cells).
        // Convert odd-r offset → axial cube: ax = q − floor(r/2), then cube distance.
        const ax1 = q1 - Math.floor(r1 / 2);
        const heur = (q, r) => {
            const dax = (q - Math.floor(r / 2)) - ax1;
            const daz = r - r1;
            return Math.max(Math.abs(dax), Math.abs(daz), Math.abs(dax + daz));
        };

        // Open set ordered by f = g + h  (linear scan — fine for 72×54 grid)
        const open     = [{ q: q0, r: r0, g: 0, f: heur(q0, r0) }];
        const gScore   = new Map([[startKey, 0]]);
        const cameFrom = new Map();   // key → [q, r] of predecessor
        const closed   = new Set();

        while (open.length) {
            // Pop node with lowest f
            let bi = 0;
            for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
            const cur = open.splice(bi, 1)[0];
            const ck  = `${cur.q}_${cur.r}`;

            if (closed.has(ck)) continue;
            closed.add(ck);

            if (ck === goalKey) return this._reconstructPath(cameFrom, q0, r0, q1, r1);

            for (const [nq, nr] of HexGridManager._oddRNeighbors(cur.q, cur.r)) {
                const nk = `${nq}_${nr}`;
                if (closed.has(nk)) continue;

                const nCell = this.getCell(nq, nr);
                if (!nCell)                   continue;
                if (nCell.move_cost === null)  continue;   // sea
                if (nCell.is_passable === false && nk !== goalKey) continue;

                // Cost = base move_cost of the destination cell
                const ng = gScore.get(ck) + nCell.move_cost;
                if (!gScore.has(nk) || ng < gScore.get(nk)) {
                    gScore.set(nk, ng);
                    cameFrom.set(nk, [cur.q, cur.r]);
                    open.push({ q: nq, r: nr, g: ng, f: ng + heur(nq, nr) });
                }
            }
        }
        return null;   // no path
    }

    _reconstructPath(cameFrom, q0, r0, q1, r1) {
        const path = [this.getCell(q1, r1)];
        let k = `${q1}_${r1}`;
        while (cameFrom.has(k)) {
            const [q, r] = cameFrom.get(k);
            if (q === q0 && r === r0) break;
            path.unshift(this.getCell(q, r));
            k = `${q}_${r}`;
        }
        path.unshift(this.getCell(q0, r0));
        return path;
    }

    // ── Movement range (flood fill) ────────────────────────────────────────────

    /**
     * Return all cells reachable within a given move budget.
     * Useful for highlighting which hexes a player can reach this turn.
     *
     * @param  {number} q
     * @param  {number} r
     * @param  {number} moveBudget  Movement budget in "move cost units"
     *                              e.g. a character with 30 ft speed passes 6 normal
     *                              hexes (30 / 5 = 6) or 3 difficult hexes (30 / 10 = 3).
     * @returns {Map<string, number>}  "q_r" → accumulated cost for every reachable cell
     */
    getMovementRange(q, r, moveBudget) {
        const reachable = new Map([[`${q}_${r}`, 0]]);
        const queue     = [{ q, r, cost: 0 }];

        while (queue.length) {
            const cur = queue.shift();
            for (const [nq, nr] of HexGridManager._oddRNeighbors(cur.q, cur.r)) {
                const nk = `${nq}_${nr}`;
                const nCell = this.getCell(nq, nr);
                if (!nCell || nCell.move_cost === null || nCell.is_passable === false) continue;

                const newCost = cur.cost + nCell.move_cost;
                if (newCost <= moveBudget && (!reachable.has(nk) || newCost < reachable.get(nk))) {
                    reachable.set(nk, newCost);
                    queue.push({ q: nq, r: nr, cost: newCost });
                }
            }
        }
        return reachable;
    }

    // ── Hex scale calculations ─────────────────────────────────────────────────

    /**
     * Calculate the travel cost of a path in Leonoria movement units.
     *
     * WORLD  (1 hex = 6 miles):
     *   - Normal Pace  3 mph  →  time = total_miles / 3
     *   - Adventuring day = 8 hours travel
     *
     * DUNGEON (1 hex = 5 feet):
     *   - Standard speed  30 ft/round
     *   - Difficult terrain costs double feet
     *
     * @param  {object[]} path   Array of cell objects (from findPath)
     * @returns {object|null}
     */
    calcPathCost(path) {
        if (!path || path.length < 2) return null;

        // Sum of all move_costs along the path (excluding the start cell)
        const costSum = path.slice(1).reduce((sum, c) => sum + (c.move_cost ?? 1), 0);

        // Everything except DUNGEON is a world map (map.js exports map_type as
        // the shape preset — 'standard', 'inland', … — never literally 'WORLD')
        if (this.mapType !== 'DUNGEON') {
            const miles = +(costSum * this.hexSizeUnits).toFixed(2);
            const hours = +(miles / 3).toFixed(2);         // Normal Pace: 3 mph
            const days  = +(hours / 8).toFixed(2);          // 8-hour travel day
            return { hexes: path.length - 1, costUnits: costSum, miles, hours, days, unit: 'miles' };
        }

        // DUNGEON
        const feet   = +(costSum * this.hexSizeUnits).toFixed(1);
        const rounds = +(feet / 30).toFixed(2);             // 30 ft/round standard speed
        return { hexes: path.length - 1, costUnits: costSum, feet, rounds, unit: 'feet' };
    }

    // ── SVG overlay ────────────────────────────────────────────────────────────

    _initOverlay(svgEl) {
        const NS      = 'http://www.w3.org/2000/svg';
        this._overlay = document.createElementNS(NS, 'g');
        this._overlay.setAttribute('id', 'hex-overlay');
        this._overlay.setAttribute('pointer-events', 'none');
        svgEl.appendChild(this._overlay);

        // Click → pixelToHex (accounts for CSS zoom / pan transforms)
        svgEl.addEventListener('click', e => {
            if (!this._clickHandlers.length) return;
            const pt  = svgEl.createSVGPoint();
            pt.x      = e.clientX;
            pt.y      = e.clientY;
            const svgP = pt.matrixTransform(svgEl.getScreenCTM().inverse());
            const { q, r } = this.pixelToHex(svgP.x, svgP.y);
            const cell = this.getCell(q, r);
            if (!cell) return;
            for (const cb of this._clickHandlers) cb({ q, r, cell, pixel: svgP, event: e });
        });
    }

    /**
     * Register a click callback.  Receives { q, r, cell, pixel, event }.
     */
    onClick(cb) {
        this._clickHandlers.push(cb);
        return this;   // chainable
    }

    /**
     * Highlight a set of cells on the overlay layer.
     *
     * @param {Map<string,*>|Set<string>|string[]} keys   "q_r" identifiers
     * @param {object} [style]  Override { fill, stroke, strokeWidth, opacity }
     */
    highlightCells(keys, style = {}) {
        if (!this._overlay) return;
        const NS   = 'http://www.w3.org/2000/svg';
        const fill = style.fill        ?? 'rgba(100,200,255,0.22)';
        const strk = style.stroke      ?? 'rgba(100,200,255,0.55)';
        const sw   = style.strokeWidth ?? 0.6;
        const op   = style.opacity     ?? 1;

        const hexR = this.hexR;
        const iterable = (keys instanceof Map) ? keys.keys() : keys;
        for (const key of iterable) {
            const [q, r] = key.split('_').map(Number);
            const {x: cx, y: cy} = this.hexToPixel(q, r);
            const pts = [];
            for (let i = 0; i < 6; i++) {
                const a = Math.PI / 6 + i * Math.PI / 3;
                pts.push(`${(cx + hexR * Math.cos(a)).toFixed(1)},${(cy + hexR * Math.sin(a)).toFixed(1)}`);
            }
            const poly = document.createElementNS(NS, 'polygon');
            poly.setAttribute('points',       pts.join(' '));
            poly.setAttribute('fill',         fill);
            poly.setAttribute('stroke',       strk);
            poly.setAttribute('stroke-width', sw);
            poly.setAttribute('opacity',      op);
            poly.dataset.hex = key;
            this._overlay.appendChild(poly);
        }
    }

    /**
     * Highlight an entire path returned by findPath().
     *
     * @param {object[]} path   Cell array from findPath()
     * @param {object}  [style]
     */
    highlightPath(path, style = {}) {
        if (!path) return;
        this.highlightCells(
            new Set(path.map(c => `${c.q}_${c.r}`)),
            { fill: 'rgba(255,215,60,0.28)', stroke: 'rgba(220,180,30,0.75)', strokeWidth: 0.8, ...style }
        );
    }

    /**
     * Remove all overlay shapes (call before drawing a new selection).
     */
    clearOverlay() {
        if (this._overlay) this._overlay.innerHTML = '';
    }

    // ── Utilities ──────────────────────────────────────────────────────────────

    /**
     * Normalise both flat-export format and nested template format into a single
     * consistent shape:
     *   { q, r, terrain_type, move_cost, is_passable }
     */
    _normalise(raw) {
        if (raw.terrain_type !== undefined) {
            // Flat export format from _buildExportData(). Optional fields
            // (settlement_name, features) must survive — the game reads them
            // off getCell() results for settlement entry and the HUD.
            return {
                q:            raw.q,
                r:            raw.r,
                terrain_type: raw.terrain_type,
                move_cost:    raw.move_cost,
                is_passable:  raw.is_passable ?? (raw.move_cost !== null),
                ...(raw.settlement_name !== undefined && { settlement_name: raw.settlement_name }),
                ...(raw.features        !== undefined && { features:        raw.features }),
            };
        }
        // Nested template format (data/map_data.json)
        const t = raw.terrain ?? {};
        return {
            q:            raw.q,
            r:            raw.r,
            terrain_type: t.type        ?? 'Unknown',
            move_cost:    t.move_cost   ?? 1.0,
            is_passable:  t.is_passable ?? true,
        };
    }

    /**
     * Quick summary for debugging — logs grid dimensions and cell count breakdown.
     */
    debug() {
        const counts = {};
        for (const cell of this.cells.values()) {
            counts[cell.terrain_type] = (counts[cell.terrain_type] ?? 0) + 1;
        }
        console.table({
            map_id:   this.mapId,
            map_type: this.mapType,
            biome:    this.biome,
            cols:     this.cols,
            rows:     this.rows,
            hexSize:  this.hexSize.toFixed(2) + 'px',
            hexSize:  `${this.hexSizeUnits} ${this.hexUnit}`,
            total:    this.cells.size,
        });
        console.table(counts);
    }
}

// ── Global export ──────────────────────────────────────────────────────────────
window.HexGridManager = HexGridManager;
