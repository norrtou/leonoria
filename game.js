// ─── Device detection ────────────────────────────────────────────────────────
const Device = {
    mobile: false,

    detect() {
        this.mobile = window.matchMedia('(pointer: coarse)').matches;
    },

    onChange(cb) {
        window.matchMedia('(pointer: coarse)').addEventListener('change', () => {
            this.detect();
            cb();
        });
    }
};


// ─── Canvas (for gameplay screens) ───────────────────────────────────────────
class GameCanvas {
    constructor(id) {
        this.el  = document.getElementById(id);
        this.ctx = this.el.getContext('2d');
        this.width  = 0;
        this.height = 0;
        this.resize();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const w   = document.documentElement.clientWidth;
        const h   = document.documentElement.clientHeight;

        this.el.width  = Math.round(w * dpr);
        this.el.height = Math.round(h * dpr);
        this.el.style.width  = w + 'px';
        this.el.style.height = h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.width  = w;
        this.height = h;
    }

    show() { this.el.style.display = 'block'; }
    hide() { this.el.style.display = 'none'; }
}


// ─── Input ────────────────────────────────────────────────────────────────────
class InputManager {
    constructor(canvasEl) {
        this.keys    = {};
        this.mouse   = { x: 0, y: 0, down: false };
        this.touches = [];

        window.addEventListener('keydown', e => { this.keys[e.code] = true;  });
        window.addEventListener('keyup',   e => { this.keys[e.code] = false; });

        canvasEl.addEventListener('mousemove', e => {
            const r = canvasEl.getBoundingClientRect();
            this.mouse.x = e.clientX - r.left;
            this.mouse.y = e.clientY - r.top;
        });
        canvasEl.addEventListener('mousedown', () => { this.mouse.down = true;  });
        canvasEl.addEventListener('mouseup',   () => { this.mouse.down = false; });

        const opts = { passive: false };
        canvasEl.addEventListener('touchstart',  e => this._onTouch(e, canvasEl), opts);
        canvasEl.addEventListener('touchmove',   e => this._onTouch(e, canvasEl), opts);
        canvasEl.addEventListener('touchend',    e => this._onTouch(e, canvasEl), opts);
        canvasEl.addEventListener('touchcancel', e => this._onTouch(e, canvasEl), opts);
    }

    _onTouch(e, canvasEl) {
        e.preventDefault();
        const r = canvasEl.getBoundingClientRect();
        this.touches = Array.from(e.touches).map(t => ({
            id: t.identifier,
            x:  t.clientX - r.left,
            y:  t.clientY - r.top
        }));
    }

    isKeyDown(code) { return !!this.keys[code]; }
}


// ─── Zoom ─────────────────────────────────────────────────────────────────────
class ZoomController {
    constructor(viewport, container) {
        this.viewport  = viewport;   // fixed clip element — receives pointer events
        this.container = container;  // element that gets the CSS transform
        this.scale = 1;
        this.x     = 0;
        this.y     = 0;
        // Defaults (small map). Call configure(mapScale) after each map generation.
        this._min  = 1;
        this._max  = 3;
        this._step = 0.4;
        this._apply();
        this._bindEvents();
    }

    // Set zoom limits for the current map size.
    // Max zoom-in is identical for both maps (same CSS scale ceiling).
    // Large map (mapScale=2) uses a smaller minimum so you can zoom out far
    // enough to see the whole dense map; step is adjusted to cover that range
    // in the same number of button presses as the small map.
    configure(mapScale) {
        const large    = (mapScale ?? 1) >= 2;
        this._min  = large ? 0.5 : 1;   // large map can zoom further out
        this._max  = 3;                  // same ceiling for both
        this._step = large ? 0.5 : 0.4; // covers 0.5→3 in ~5 presses, same as 1→3
        // Re-clamp in case previous scale is now out of range
        this.scale = Math.max(this._min, Math.min(this._max, this.scale));
        this._clamp();
        this._apply();
    }

    get W() { return this.viewport.offsetWidth;  }
    get H() { return this.viewport.offsetHeight; }

    // Zoom to newScale keeping screen point (cx, cy) stationary
    zoomTo(newScale, cx, cy) {
        newScale = Math.max(this._min, Math.min(this._max, newScale));
        const ratio = newScale / this.scale;
        this.x = cx - ratio * (cx - this.x);
        this.y = cy - ratio * (cy - this.y);
        this.scale = newScale;
        this._clamp();
        this._apply();
        this._updateCursor();
    }

    stepIn()  { this.zoomTo(this.scale + this._step, this.W / 2, this.H / 2); }
    stepOut() { this.zoomTo(this.scale - this._step, this.W / 2, this.H / 2); }

    reset() {
        this.scale = 1; this.x = 0; this.y = 0;
        this._apply();
        this._updateCursor();
    }

    _clamp() {
        const { W, H, scale: s } = this;
        if (s < 1) {
            // Zoomed out: map is smaller than viewport — center it
            this.x = W * (1 - s) / 2;
            this.y = H * (1 - s) / 2;
        } else {
            this.x = Math.max(W * (1 - s), Math.min(0, this.x));
            this.y = Math.max(H * (1 - s), Math.min(0, this.y));
        }
    }

    _apply() {
        this.container.style.transform =
            `translate(${this.x.toFixed(2)}px,${this.y.toFixed(2)}px) scale(${this.scale.toFixed(4)})`;
        this._setInteracting();
    }

    _setInteracting() {
        this.viewport.classList.add('interacting');
        clearTimeout(this._interactTimer);
        this._interactTimer = setTimeout(() => {
            this.viewport.classList.remove('interacting');
        }, 200);
    }

    _updateCursor() {
        this.viewport.style.cursor = this.scale > 1 ? 'grab' : '';
    }

    _bindEvents() {
        const vp = this.viewport;

        // ── Mouse wheel zoom ──────────────────────────────────────────────────
        vp.addEventListener('wheel', e => {
            e.preventDefault();
            const r  = vp.getBoundingClientRect();
            const cx = e.clientX - r.left;
            const cy = e.clientY - r.top;
            const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
            this.zoomTo(this.scale * factor, cx, cy);
        }, { passive: false });

        // ── Mouse drag pan ────────────────────────────────────────────────────
        let drag = null;
        vp.addEventListener('mousedown', e => {
            if (this.scale <= 1) return;
            drag = { ox: e.clientX - this.x, oy: e.clientY - this.y };
            vp.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', e => {
            if (!drag) return;
            this.x = e.clientX - drag.ox;
            this.y = e.clientY - drag.oy;
            this._clamp();
            this._apply();
        });
        window.addEventListener('mouseup', () => {
            if (!drag) return;
            drag = null;
            this._updateCursor();
        });

        // ── Touch pan + pinch ─────────────────────────────────────────────────
        let lastTouches = [];
        const getTouches = e => Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));

        vp.addEventListener('touchstart', e => {
            lastTouches = getTouches(e);
        }, { passive: true });

        vp.addEventListener('touchmove', e => {
            e.preventDefault();
            const cur = getTouches(e);
            if (cur.length === 1 && lastTouches.length >= 1) {
                // Single-finger pan
                this.x += cur[0].x - lastTouches[0].x;
                this.y += cur[0].y - lastTouches[0].y;
                this._clamp();
                this._apply();
            } else if (cur.length === 2 && lastTouches.length === 2) {
                // Two-finger pinch zoom
                const d0 = Math.hypot(lastTouches[1].x - lastTouches[0].x, lastTouches[1].y - lastTouches[0].y);
                const d1 = Math.hypot(cur[1].x - cur[0].x, cur[1].y - cur[0].y);
                if (d0 > 0) {
                    const cx = (cur[0].x + cur[1].x) / 2;
                    const cy = (cur[0].y + cur[1].y) / 2;
                    this.zoomTo(this.scale * d1 / d0, cx, cy);
                }
            }
            lastTouches = cur;
        }, { passive: false });

        vp.addEventListener('touchend', e => {
            lastTouches = getTouches(e);
        }, { passive: true });
    }
}


// ─── HeroParty ────────────────────────────────────────────────────────────────
// Manages the player token on the hex grid.  Seed-derived icon and colour.
// Click-to-move: A* path → highlight → snap token to destination → show cost.

class HeroParty {
    // Six colour schemes: [rim/dark, fill/light]
    static PALETTES = [
        ['#922b21', '#e74c3c'],   // Crimson   — warrior
        ['#6c3483', '#9b59b6'],   // Violet    — wizard
        ['#1a5276', '#2e86c1'],   // Sapphire  — ranger
        ['#1d6a3a', '#27ae60'],   // Emerald   — druid
        ['#7d6608', '#f1c40f'],   // Gold      — paladin
        ['#212f3c', '#566573'],   // Slate     — rogue
    ];
    // Icon types keyed by name
    static ICONS = ['sword', 'staff', 'crossed', 'bow', 'wand'];

    constructor(hexGrid, svgEl, mapSeed, fantasyMap = null, opts = {}) {
        this.hexGrid  = hexGrid;
        this.svgEl    = svgEl;
        this.seed     = mapSeed >>> 0;
        this._map     = fantasyMap;   // FantasyMap instance for elevation/texture data
        this.q        = 0;
        this.r        = 0;
        this._token   = null;
        this._info    = document.getElementById('hero-info');
        this.onMove   = opts.onMove ?? null;   // callback({q, r, cell, cost}) after each move

        const [dark, light] = HeroParty.PALETTES[(this.seed >> 3) % HeroParty.PALETTES.length];
        const icon = HeroParty.ICONS[this.seed % HeroParty.ICONS.length];
        this._dark  = dark;
        this._light = light;
        this._icon  = icon;

        const start = this._restoreStart(opts) ?? this._findStart();
        if (start) { this.q = start.q; this.r = start.r; }

        this._buildToken();
        this._placeToken();

        // Track mousedown position to distinguish drag from click
        let _downX = 0, _downY = 0;
        svgEl.addEventListener('mousedown', e => { _downX = e.clientX; _downY = e.clientY; });
        svgEl.addEventListener('click', e => {
            if (Math.hypot(e.clientX - _downX, e.clientY - _downY) > 6) return; // was a drag
            const pt  = svgEl.createSVGPoint();
            pt.x = e.clientX; pt.y = e.clientY;
            const sp  = pt.matrixTransform(svgEl.getScreenCTM().inverse());
            const { q, r } = hexGrid.pixelToHex(sp.x, sp.y);
            this._moveTo(q, r);
        });
    }

    // ── Restore a saved position (game sessions) ─────────────────────────────
    // Only used when the cell still exists and is passable — otherwise the
    // normal start search runs instead.
    _restoreStart(opts) {
        if (!Number.isInteger(opts.startQ) || !Number.isInteger(opts.startR)) return null;
        const cell = this.hexGrid.getCell(opts.startQ, opts.startR);
        if (!cell || cell.move_cost === null || cell.is_passable === false) return null;
        return { q: opts.startQ, r: opts.startR };
    }

    // ── Find best starting cell ──────────────────────────────────────────────
    _findStart() {
        const cx = Math.floor(this.hexGrid.cols / 2);
        const cr = Math.floor(this.hexGrid.rows / 2);

        // Prefer a Settlement closest to map centre
        let best = null, bestD = Infinity;
        for (const cell of this.hexGrid.cells.values()) {
            if (cell.terrain_type !== 'Settlement') continue;
            const d = Math.abs(cell.q - cx) + Math.abs(cell.r - cr);
            if (d < bestD) { bestD = d; best = cell; }
        }
        if (best) return best;

        // Fallback: scan every cell, find the nearest passable one to centre.
        // Linear scan is guaranteed to work on any map type (archipelago, inland, etc.)
        // where a spiral ring search could miss isolated land masses.
        bestD = Infinity;
        for (const cell of this.hexGrid.cells.values()) {
            if (cell.move_cost === null || cell.is_passable === false) continue;
            const d = Math.abs(cell.q - cx) + Math.abs(cell.r - cr);
            if (d < bestD) { bestD = d; best = cell; }
        }
        return best;
    }

    // ── Build SVG token group ────────────────────────────────────────────────
    _buildToken() {
        const NS = 'http://www.w3.org/2000/svg';
        const hs = this.hexGrid.hexSize;
        const R  = Math.max(4, hs * 0.46);   // token radius, scales with hex size
        const sw = Math.max(0.7, R * 0.10);  // stroke width

        const mk = (tag, attrs) => {
            const el = document.createElementNS(NS, tag);
            for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
            return el;
        };

        const g = document.createElementNS(NS, 'g');
        g.id = 'hero-party';
        g.setAttribute('pointer-events', 'none');

        // Ground shadow
        g.appendChild(mk('ellipse', { rx: R*0.8, ry: R*0.28, cy: R*0.92,
            fill: 'rgba(0,0,0,0.32)' }));
        // Token body
        g.appendChild(mk('circle', { r: R, fill: this._light,
            stroke: '#fff', 'stroke-width': sw }));
        // Inner ring
        g.appendChild(mk('circle', { r: R*0.73, fill: 'none',
            stroke: this._dark, 'stroke-width': sw*0.6, opacity: 0.65 }));

        // Weapon icon — drawn in white at scale `s`
        const s  = R * 0.42;
        const wl = Math.max(0.6, sw * 0.9);
        const ln = (x1,y1,x2,y2) => mk('line',
            { x1, y1, x2, y2, stroke:'#fff', 'stroke-width':wl, 'stroke-linecap':'round' });

        if (this._icon === 'sword') {
            g.appendChild(ln(0, -s, 0, s*0.55));
            g.appendChild(ln(-s*0.5, s*0.1, s*0.5, s*0.1));
            g.appendChild(mk('circle', { r: wl, cy: s*0.55, fill: '#fff' }));

        } else if (this._icon === 'staff') {
            g.appendChild(ln(0, s*0.65, 0, -s*0.6));
            g.appendChild(mk('circle', { r: s*0.28, cy: -s*0.6,
                fill: this._dark, stroke: '#fff', 'stroke-width': wl*0.7 }));

        } else if (this._icon === 'crossed') {
            g.appendChild(ln(-s*0.55, -s*0.85, s*0.55,  s*0.65));
            g.appendChild(ln( s*0.55, -s*0.85,-s*0.55,  s*0.65));
            g.appendChild(ln(-s*0.3, -s*0.1,  s*0.3, -s*0.1));
            g.appendChild(ln( s*0.3, -s*0.1, -s*0.3, -s*0.1));

        } else if (this._icon === 'bow') {
            const arc = mk('path', { fill:'none', stroke:'#fff',
                'stroke-width': wl, 'stroke-linecap':'round',
                d: `M${-s*0.45} ${-s} Q${-s*1.05} 0 ${-s*0.45} ${s}` });
            g.appendChild(arc);
            const str = mk('path', { fill:'none', stroke:'#fff',
                'stroke-width': wl*0.55, opacity:'0.75',
                d: `M${-s*0.45} ${-s} L${s*0.45} 0 L${-s*0.45} ${s}` });
            g.appendChild(str);

        } else {  // wand
            g.appendChild(ln(0, s*0.6, 0, -s*0.4));
            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * Math.PI * 2;
                g.appendChild(ln(
                    (s*0.14*Math.cos(a)).toFixed(2), (-s*0.4 + s*0.14*Math.sin(a)).toFixed(2),
                    (s*0.38*Math.cos(a)).toFixed(2), (-s*0.4 + s*0.38*Math.sin(a)).toFixed(2)));
            }
        }

        this._token = g;
        this._R = R;
        this.svgEl.appendChild(g);
    }

    _placeToken() {
        if (!this._token) return;
        const { x, y } = this.hexGrid.hexToPixel(this.q, this.r);
        this._token.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
    }

    // ── Click-to-move ────────────────────────────────────────────────────────
    _moveTo(targetQ, targetR) {
        const cell = this.hexGrid.getCell(targetQ, targetR);
        if (!cell || cell.move_cost === null || cell.is_passable === false) {
            this._showInfo({ terrain_type: '⛔ Impassable' }, null);
            return;
        }
        // Clicking current cell: show info without moving
        if (targetQ === this.q && targetR === this.r) {
            this._showInfo(cell, null);
            return;
        }

        const path = this.hexGrid.findPath(this.q, this.r, targetQ, targetR);
        if (!path) {
            this._showInfo({ terrain_type: '⛔ No path' }, null);
            return;
        }

        this.hexGrid.clearOverlay();
        this.hexGrid.highlightPath(path);

        this.q = targetQ;
        this.r = targetR;
        this._placeToken();

        const cost = this.hexGrid.calcPathCost(path);
        this._showInfo(cell, cost);
        if (this.onMove) this.onMove({ q: this.q, r: this.r, cell, cost });

        clearTimeout(this._clearTimer);
        this._clearTimer = setTimeout(() => this.hexGrid.clearOverlay(), 2200);
    }

    _showInfo(cell, cost) {
        if (!this._info) return;
        const terrain = cell.terrain_type ?? '—';
        const feats   = cell.features ?? [];
        const sname   = cell.settlement_name ?? null;

        let html = `<span class="hi-pos">${this.q},${this.r}</span>`
                 + `<span class="hi-terrain">${terrain}</span>`;

        if (sname) {
            html += `<span class="hi-feature">${sname}</span>`;
        }
        if (feats.length > 0) {
            html += `<span class="hi-feature">${feats.join(' · ')}</span>`;
        }

        // — Elevation & texture data from FantasyMap —
        if (this._map && this._map.hm) {
            const hm  = this._map.hm;
            const SL  = this._map.SL;
            const q   = this.q, r = this.r;
            const h   = hm.get(q, r);
            const hn  = h - SL;

            html += `<span class="hi-elev">Elevation: ${hn >= 0 ? '+' : ''}${hn.toFixed(3)} (raw ${h.toFixed(3)}, SL ${SL.toFixed(3)})</span>`;
            html += `<span class="hi-biome">Biome: ${this._map.biomeId ?? '—'}</span>`;

            const flags = [];
            if (!hm.isLand(q, r))       flags.push('Sea');
            else if (hm.isHighPeak(q, r)) flags.push('High Peak');
            else if (hm.isMountain(q, r)) flags.push('Mountain terrain');
            if (hm.isCoast(q, r))         flags.push('Coast');

            // Swamp check
            if (this._map.swampCells?.has(r * hm.cols + q)) flags.push('Swamp terrain');

            // Forest check
            const forestCells = this._map.forests;
            if (forestCells) {
                const inForest = forestCells.some(f => {
                    const dr = r - f.r, dc = q - f.c;
                    return dc*dc + dr*dr <= f.radius * f.radius;
                });
                if (inForest) flags.push('Forest');
            }

            if (flags.length > 0) {
                html += `<span class="hi-flags">${flags.join(' · ')}</span>`;
            }

            if (cell.move_cost !== undefined && cell.move_cost !== null) {
                html += `<span class="hi-move">Move cost: ×${cell.move_cost}</span>`;
            } else if (cell.is_passable === false) {
                html += `<span class="hi-move">Impassable</span>`;
            }
        }

        if (cost) {
            if (cost.unit === 'miles') {
                html += `<span class="hi-cost">${cost.miles} mi &middot; ${cost.hours}h travel`
                      + (cost.days > 0 ? ` (${cost.days}d)` : '') + `</span>`;
            } else {
                html += `<span class="hi-cost">${cost.feet} ft &middot; ${cost.rounds} rounds</span>`;
            }
        }
        this._info.innerHTML = html;
        this._info.classList.add('visible');
    }
}


// ─── Screens ──────────────────────────────────────────────────────────────────

class MapScreen {
    constructor(container) {
        this.container      = container;
        this.map            = null;
        this.hero           = null;
        this.currentParams  = { scale: 1 };
    }

    show(seed, params = {}, heroOpts = {}) {
        this.container.style.display = 'block';
        this._build(seed, params, heroOpts);
    }

    hide() {
        this.container.style.display = 'none';
    }

    _build(seed, params = {}, heroOpts = {}) {
        this.currentParams = params;
        this.map = new FantasyMap(this.container, seed, params);
        this.map.generate();
        this.currentSeed = this.map.seed;

        // Reset kingdoms toggle button — new map always starts with overlay hidden
        document.getElementById('kingdoms-toggle')?.classList.remove('btn-active');

        // Init grid and hero using the data auto-populated by generate()
        const svgEl     = this.container.querySelector('svg');
        const hexGrid   = new HexGridManager(MapSaveStore.lastSaved.jsonData, svgEl);
        this.hero       = new HeroParty(hexGrid, svgEl, this.map.seed, this.map, heroOpts);
    }

    regenerate(params = this.currentParams) {
        this._build(null, params);
    }

    resize() {
        this._build(this.currentSeed, this.currentParams);
    }
}


// ─── Game ─────────────────────────────────────────────────────────────────────
class Game {
    constructor() {
        Device.detect();

        this.canvas    = new GameCanvas('gameCanvas');
        this.input     = new InputManager(this.canvas.el);
        this.mapScreen = new MapScreen(document.getElementById('map-container'));

        this.zoom = new ZoomController(
            document.getElementById('map-viewport'),
            document.getElementById('map-container')
        );

        const kingdomsBtn = document.getElementById('kingdoms-toggle');
        if (kingdomsBtn) {
            kingdomsBtn.addEventListener('click', () => {
                const map = this.mapScreen?.map;
                if (!map) return;
                const visible = map.toggleKingdoms();
                kingdomsBtn.classList.toggle('btn-active', !!visible);
            });
        }

        document.getElementById('export-map-btn').addEventListener('click', async () => {
            const btn = document.getElementById('export-map-btn');
            btn.disabled = true;
            btn.textContent = '⏳ Saving…';
            try {
                await this.mapScreen.map?.saveMapData();
                btn.textContent = '✓ Saved';
            } catch (e) {
                btn.textContent = '⬇ Export';
                console.error('[Leonoria] export failed:', e);
            } finally {
                setTimeout(() => {
                    btn.disabled = false;
                    btn.textContent = '⬇ Export';
                }, 2000);
            }
        });

        Device.onChange(() => {
            if (this.currentScreen === 'map') this.mapScreen.resize();
        });

        window.addEventListener('resize', () => {
            this.canvas.resize();
            if (this.currentScreen === 'map') this.mapScreen.resize();
        });

        // ── Settings panel ────────────────────────────────────────────────────
        this._initPanel();

        // ── Legend panel ──────────────────────────────────────────────────────
        this._initLegend();

        // Start on the map screen
        this.showMap();

        this._lastTime = null;
        requestAnimationFrame(ts => this._loop(ts));
    }

    // Map-type presets — define the generation character of each landscape.
    // continent (0–1): 0 = scattered peaks, 1 = strong central landmass.
    // ruggedness (0–1): 0 = gentle rolling, 1 = jagged alpine peaks.
    // sliders: sensible defaults applied when the type is selected.
    static get MAP_TYPE_PRESETS() { return {
        standard: {
            continent: 0.65, ruggedness: 0.55,
            edgeSink: 0, edgeSinkStart: 0, islandSeeds: 0,
            desc: 'A balanced world of varied terrain, mixed land and sea.',
            sliders: { land:50, mountains:50, forests:50, rivers:50, settlements:50, ruins:33, landmarks:4 }
        },
        large_island: {
            // bigIsland=true activates varied shape generation: dome, elongated,
            // main+satellites, or atoll/horseshoe — chosen per seed.
            // Higher ruggedness lets noise carve bays, fjords, and peninsulas into
            // whichever shape is picked. 25% of seeds allow land to reach the map edge.
            continent: 0.65, ruggedness: 0.72,
            edgeSink: 1.8, edgeSinkStart: 0.60, islandSeeds: 0, bigIsland: true,
            desc: 'A large island — shape varies: oval, elongated, satellite chain, or atoll.',
            sliders: { land:28, mountains:58, forests:55, rivers:35, settlements:40, ruins:35, landmarks:4 }
        },
        archipelago: {
            // No continent bias — pure noise peaks become islands.
            // 7 deterministic island seeds guarantee distinct landmasses.
            // Gradual edge sink (starts from 0) ensures all islands float in open ocean.
            continent: 0.0, ruggedness: 0.42,
            edgeSink: 1.1, edgeSinkStart: 0, islandSeeds: 7,
            desc: 'A scattered chain of islands across a wide ocean — 3 medium, 4 small.',
            sliders: { land:15, mountains:35, forests:45, rivers:12, settlements:22, ruins:28, landmarks:3 }
        },
        inland: {
            // Low ruggedness → smooth broad-ridge terrain (natural mountain chains).
            // seaLevel fixed near 0 so nearly all terrain is land; rivers end in lakes.
            continent: 0.48, ruggedness: 0.28,
            edgeSink: 0, edgeSinkStart: 0, islandSeeds: 0,
            desc: 'A landlocked continent — rivers drain into lakes, no ocean coast.',
            sliders: { land:90, mountains:32, forests:55, rivers:65, settlements:50, ruins:35, landmarks:5 }
        },
    }; }

    static get BIOME_CULTURES() { return {
        the_midlands: {
            dominant: 'midlander',
            // MAJOR: Midlander
            // MINOR: Wildmen Ravager (forested), Wildmen Forester (rare, forested),
            //        Swampbrood (swamp terrain), Stone Folk (very rare, mountains),
            //        Secluded Archons (extremely rare)
            cultures: [
                { value: 'midlander',        label: 'Midlander',                          role: 'major' },
                { value: 'wildmen_ravagers',  label: 'Wildmen Ravagers (forested)',         role: 'minor' },
                { value: 'wildmen_foresters', label: 'Wildmen Foresters (rare, forested)',  role: 'minor' },
                { value: 'swampbrood',        label: 'Swampbrood (swamp terrain)',          role: 'minor' },
                { value: 'stone_folk',        label: 'Stone Folk (very rare, mountains)',   role: 'minor' },
                { value: 'archons_secluded', label: 'Secluded Archons (extremely rare)',  role: 'minor' },
            ],
        },
        the_dark_forests: {
            dominant: 'northerner',
            // Rank 1: Northerner (dominant), 2: Wildmen Foresters, 3: Stone Folk,
            // 4: Wildmen Ravagers, 5: Swampbrood, 6: Ice Archons (rarest)
            cultures: [
                { value: 'northerner',        label: 'Northerner'                        },
                { value: 'wildmen_foresters', label: 'Wildmen Foresters'                 },
                { value: 'stone_folk',        label: 'Stone Folk (mountains)'            },
                { value: 'wildmen_ravagers',  label: 'Wildmen Ravagers'                  },
                { value: 'swampbrood',        label: 'Swampbrood (swamp terrain)'        },
                { value: 'ice_archons',      label: 'Ice Archons (rarest)'             },
            ],
        },
        the_sanctuary_lands: {
            dominant: 'archons_secluded',
            // MAJOR: Secluded Archons
            // MINOR: Oakspeople (forested), Wildmen Forester (rare, forested),
            //        Wildmen Ravager, Swampbrood (swamp terrain)
            cultures: [
                { value: 'archons_secluded', label: 'Secluded Archons',                  role: 'major' },
                { value: 'oakpeople',         label: 'Oakpeople (forested areas)',          role: 'minor' },
                { value: 'wildmen_foresters', label: 'Wildmen Foresters (rare, forested)',  role: 'minor' },
                { value: 'wildmen_ravagers',  label: 'Wildmen Ravagers',                   role: 'minor' },
                { value: 'swampbrood',        label: 'Swampbrood (swamp terrain)',          role: 'minor' },
            ],
        },
        the_forgotten_kingdom: {
            dominant: 'archons_dark_ones',
            // MAJOR: Dark Ones — absolute, no other culture permitted
            cultures: [
                { value: 'archons_dark_ones', label: 'Dark Ones', role: 'major' },
            ],
        },
        the_eternal_winds: {
            dominant: 'ice_archons',
            // MAJOR: Ice Archons
            // MINOR: Wildmen Ravager (rare)
            cultures: [
                { value: 'ice_archons',     label: 'Ice Archons',              role: 'major' },
                { value: 'wildmen_ravagers', label: 'Wildmen Ravagers (rare)',    role: 'minor' },
            ],
        },
        the_gleam_havens: {
            dominant: 'archons_greys',
            // MAJOR: Grey Archons (coastal/riverside)
            // MINOR: Wildmen Foresters (forested areas), Wildmen Ravager (forested)
            cultures: [
                { value: 'archons_greys',    label: 'Grey Archons',                       role: 'major' },
                { value: 'wildmen_foresters', label: 'Wildmen Foresters (forested areas)',   role: 'minor' },
                { value: 'wildmen_ravagers',  label: 'Wildmen Ravagers (forested areas)',    role: 'minor' },
            ],
        },
        the_boglands: {
            dominant: 'swampbrood',
            // MAJOR: Swampbrood (all terrain — no swamp restriction in boglands)
            // MINOR: Wildmen Ravager
            cultures: [
                { value: 'swampbrood',       label: 'Swampbrood',        role: 'major' },
                { value: 'wildmen_ravagers', label: 'Wildmen Ravagers',  role: 'minor' },
            ],
        },
        the_badlands: {
            dominant: 'ashen_halfbreeds',
            // MAJOR: Ashen Halfbreeds
            // MINOR: Step Folk (rare), Wildmen Ravager
            cultures: [
                { value: 'ashen_halfbreeds', label: 'Ashen Halfbreeds',   role: 'major' },
                { value: 'step_folk',        label: 'Step Folk (rare)',    role: 'minor' },
                { value: 'wildmen_ravagers', label: 'Wildmen Ravagers',   role: 'minor' },
            ],
        },
        the_outer_steppes: {
            dominant: 'step_folk',
            // MAJOR: Step Folk
            // MINOR: Ashen Halfbreeds, Wildmen Ravager
            cultures: [
                { value: 'step_folk',        label: 'Step Folk',          role: 'major' },
                { value: 'ashen_halfbreeds', label: 'Ashen Halfbreeds',   role: 'minor' },
                { value: 'wildmen_ravagers', label: 'Wildmen Ravagers',   role: 'minor' },
            ],
        },
        the_blinding_lands: {
            dominant: 'step_folk',
            // MAJOR: Step Folk
            // MINOR: Ashen Halfbreeds, Wildmen Ravager
            cultures: [
                { value: 'step_folk',        label: 'Step Folk',          role: 'major' },
                { value: 'ashen_halfbreeds', label: 'Ashen Halfbreeds',   role: 'minor' },
                { value: 'wildmen_ravagers', label: 'Wildmen Ravagers',   role: 'minor' },
            ],
        },
    }; }

    _initPanel() {
        const panel  = document.getElementById('settings-panel');
        const openBtn = document.getElementById('settings-open');
        const closeBtn = document.getElementById('settings-close');

        const open  = () => panel.classList.add('panel-open');
        const close = () => panel.classList.remove('panel-open');

        openBtn.addEventListener('click', () => panel.classList.contains('panel-open') ? close() : open());
        closeBtn.addEventListener('click', close);

        // Landmark count label (hoisted — needed by map-type preset handler below)
        const landmarkEl = document.getElementById('param-landmarks');
        const updateLandmarkLabel = () => {
            const n = +landmarkEl.value;
            document.getElementById('lbl-landmarks').textContent =
                n === 0 ? 'None' : n === 1 ? '1' : `${n}`;
        };
        landmarkEl.addEventListener('input', updateLandmarkLabel);
        updateLandmarkLabel();

        // Map type — show description and apply slider presets
        const mapTypeDescriptions = {
            standard:    'A balanced world of varied terrain, mixed land and sea.',
            large_island:'A single large island rising from deep ocean, mountainous at its heart.',
            archipelago: 'A scattered chain of 3–10 islands across a wide ocean.',
            inland:      'A landlocked continent — rivers drain into lakes, no ocean coast.',
        };
        const mapTypeEl = document.getElementById('param-map-type');
        const updateMapType = () => {
            const key = mapTypeEl.value;
            document.getElementById('lbl-map-type-desc').textContent = mapTypeDescriptions[key] || '';
            const preset = Game.MAP_TYPE_PRESETS[key];
            if (!preset) return;
            const s = preset.sliders;
            document.getElementById('param-land').value        = s.land;
            document.getElementById('param-mountains').value   = s.mountains;
            document.getElementById('param-forests').value     = s.forests;
            document.getElementById('param-rivers').value      = s.rivers;
            document.getElementById('param-settlements').value = s.settlements;
            document.getElementById('param-ruins').value       = s.ruins;
            document.getElementById('param-landmarks').value   = s.landmarks;
            // Refresh all slider labels after bulk update
            ['param-land','param-mountains','param-forests','param-rivers',
             'param-settlements','param-ruins'].forEach(id => {
                document.getElementById(id).dispatchEvent(new Event('input'));
            });
            updateLandmarkLabel();
        };
        mapTypeEl.addEventListener('change', updateMapType);
        updateMapType(); // init description

        // Size toggle
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Live slider labels
        const sliderLabel = (id, val, labels) => {
            const idx = Math.round(val / (100 / (labels.length - 1)));
            document.getElementById(id).textContent = labels[Math.min(idx, labels.length - 1)];
        };
        const bind = (sliderId, labelId, labels) => {
            const el = document.getElementById(sliderId);
            el.addEventListener('input', () => sliderLabel(labelId, +el.value, labels));
            sliderLabel(labelId, +el.value, labels); // init
        };
        bind('param-land',        'lbl-land',        ['Mostly ocean','Scarce land','Balanced','Vast land','Continent']);
        bind('param-mountains',   'lbl-mountains',   ['None','Low','Medium','High','Alpine']);
        bind('param-forests',     'lbl-forests',     ['None','Sparse','Light','Medium','Dense','Lush']);
        bind('param-rivers',      'lbl-rivers',      ['None','Few','Some','Many','Abundant']);
        bind('param-settlements', 'lbl-settlements', ['None','Sparse','Few','Medium','Many','Dense']);
        bind('param-ruins',       'lbl-ruins',       ['None','Rare','Few','Some','Many']);


        // Biome description hint — lists all cultures with dominance level
        const biomeDescriptions = {
            the_midlands:
                'Fertile heartland — rolling plains and farmland. ' +
                'MAJOR: Midlander. ' +
                'MINOR: Wildmen Ravagers (forested areas), Wildmen Foresters (rare, forested), Swampbrood (swamp terrain), Stone Folk (very rare, mountains), Secluded Archons (extremely rare).',
            the_dark_forests:
                'Dense dark wilderness — brutal winters, few settlements, undead present. ' +
                'MAJOR: Northerner, Wildmen Foresters, Stone Folk (mountains). ' +
                'MINOR: Wildmen Ravagers, Ice Archons (rare), Swampbrood (swamp terrain).',
            the_sanctuary_lands:
                'Lush ancient forests — magical, snow-capped peaks, highly isolated. ' +
                'MAJOR: Secluded Archons. ' +
                'MINOR: Oakspeople (forested areas), Wildmen Foresters (rare, forested), Wildmen Ravagers, Swampbrood (swamp terrain).',
            the_eternal_winds:
                'Arctic tundra — brutal cold, endless winds, near-uninhabitable. ' +
                'MAJOR: Ice Archons. ' +
                'MINOR: Wildmen Ravagers (rare).',
            the_badlands:
                'Scorched cataclysm zone — ancient ruins, trade routes, undead everywhere. ' +
                'MAJOR: Ashen Halfbreeds. ' +
                'MINOR: Step Folk (rare), Wildmen Ravagers.',
            the_outer_steppes:
                'Dry buffer plains — wandering groups, fortified waypoints, dust storms. ' +
                'MAJOR: Step Folk. ' +
                'MINOR: Ashen Halfbreeds, Wildmen Ravagers.',
            the_blinding_lands:
                'Windswept steppe — haunted ruins, pre-Death era remnants, extreme sun. ' +
                'MAJOR: Step Folk. ' +
                'MINOR: Ashen Halfbreeds, Wildmen Ravagers.',
            the_gleam_havens:
                'Warm southern coast — Mediterranean climate, coastal cities, calm seas. ' +
                'MAJOR: Grey Archons (coastal and riverside). ' +
                'MINOR: Wildmen Foresters (forested areas), Wildmen Ravagers (forested areas).',
            the_boglands:
                'Murky swamplands — rivers everywhere, dense fog, treacherous ground. ' +
                'MAJOR: Swampbrood (unrestricted terrain). ' +
                'MINOR: Wildmen Ravagers.',
            the_forgotten_kingdom:
                'Subterranean cave world — absolute darkness, shadow magic, no surface light. ' +
                'MAJOR: Dark Ones (only culture permitted here — absolute rule).',
        };

        const biomeEl = document.getElementById('param-biome');

        // Biomes that are always inland — lock the map type selector to Inland only.
        const INLAND_ONLY_BIOMES = new Set(['the_badlands']);

        const updateBiomeDesc = () => {
            document.getElementById('lbl-biome-desc').textContent =
                biomeDescriptions[biomeEl.value] || '';

            // Lock / unlock map type selector based on biome
            const isInlandOnly = INLAND_ONLY_BIOMES.has(biomeEl.value);
            Array.from(mapTypeEl.options).forEach(opt => {
                opt.disabled = isInlandOnly && opt.value !== 'inland';
            });
            if (isInlandOnly && mapTypeEl.value !== 'inland') {
                mapTypeEl.value = 'inland';
                updateMapType();
            }
        };

        biomeEl.addEventListener('change', updateBiomeDesc);
        updateBiomeDesc();

        // Generate random — ignores seed field, picks a new random seed
        document.getElementById('generate-random-btn').addEventListener('click', () => {
            this.zoom.reset();
            const params = this._readParams();
            this.zoom.configure(params.scale);
            this.mapScreen.regenerate(params);
            document.getElementById('param-seed').value = this.mapScreen.currentSeed;
            this._updateLegend();
        });

        // Generate seed — uses seed field value (or random if blank)
        document.getElementById('generate-seed-btn').addEventListener('click', () => {
            this.zoom.reset();
            const params  = this._readParams();
            this.zoom.configure(params.scale);
            const seedEl  = document.getElementById('param-seed');
            const seed    = seedEl.value.trim() ? parseInt(seedEl.value, 10) : null;
            if (seed !== null) {
                this.mapScreen._build(seed, params);
            } else {
                this.mapScreen.regenerate(params);
            }
            seedEl.value = this.mapScreen.currentSeed;
            this._updateLegend();
        });

        this._initSavedSeeds();
    }

    // ── Saved seeds (localStorage) ────────────────────────────────────────────
    _initSavedSeeds() {
        document.getElementById('save-seed-btn').addEventListener('click', () => {
            const seedEl = document.getElementById('param-seed');
            const nameEl = document.getElementById('param-seed-name');
            const seed   = seedEl.value.trim() ? parseInt(seedEl.value, 10) : this.mapScreen.currentSeed;
            const name   = nameEl.value.trim();
            if (!name) { nameEl.focus(); return; }
            if (!seed)  return;
            SavedSeeds.add(name, seed);
            nameEl.value = '';
            this._renderSavedSeeds();
        });

        document.getElementById('saved-seeds-select').addEventListener('change', () => {
            const select = document.getElementById('saved-seeds-select');
            const entry  = SavedSeeds.load()[+select.value];
            if (!entry) return;
            document.getElementById('param-seed').value      = entry.seed;
            document.getElementById('param-seed-name').value = entry.name;
        });

        document.getElementById('saved-seed-del-btn').addEventListener('click', () => {
            const select = document.getElementById('saved-seeds-select');
            const idx    = +select.value;
            if (isNaN(idx) || !SavedSeeds.load()[idx]) return;
            SavedSeeds.remove(idx);
            this._renderSavedSeeds();
        });

        this._renderSavedSeeds();
    }

    _renderSavedSeeds() {
        const saved   = SavedSeeds.load();
        const section = document.getElementById('saved-seeds-section');
        const select  = document.getElementById('saved-seeds-select');
        section.style.display = saved.length ? '' : 'none';
        select.innerHTML = saved.map((entry, i) =>
            `<option value="${i}">${entry.name} — ${SavedSeeds.formatDate(entry.savedAt)}</option>`
        ).join('');
    }

    _initLegend() {
        const panel   = document.getElementById('legend-panel');
        const openBtn = document.getElementById('legend-open');
        const closeBtn = document.getElementById('legend-close');
        const open  = () => panel.classList.add('legend-open');
        const close = () => panel.classList.remove('legend-open');
        openBtn.addEventListener('click',  () => panel.classList.contains('legend-open') ? close() : open());
        closeBtn.addEventListener('click', close);
    }

    _updateLegend() {
        const body = document.getElementById('legend-body');
        if (!body) return;
        const map = this.mapScreen?.map;
        if (!map) { body.innerHTML = '<p class="legend-empty">Generate a map to see the legend.</p>'; return; }

        const bd  = map.biomeData;                  // full JSON biome object (may be null)
        const pal = map.biomePalette;
        const culture = map.culture ?? 'human';

        const rgb = arr => `rgb(${arr[0]},${arr[1]},${arr[2]})`;

        // Terrain texture keys → legend entry (matches _activeTextures in map.js)
        const textureInfo = {
            farmland:         { label: 'Farmland',         desc: 'Cultivated field patches with hedgerow borders' },
            plains_grass:     { label: 'Grass & Straw',    desc: 'Dense multi-hue grass straw texture' },
            grassland:        { label: 'Grassland',        desc: 'Open grass marks' },
            heather:          { label: 'Heather',          desc: 'Moorland stipple' },
            reeds:            { label: 'Reeds & Sedge',    desc: 'Wetland reed straws' },
            swamp:            { label: 'Marsh / Swamp',    desc: 'Dense swamp reed texture' },
            wetland:          { label: 'Wetlands',         desc: 'Bog and marsh pockets' },
            scrub:            { label: 'Desert Scrub',     desc: 'Sparse arid vegetation' },
            boreal_conifers:  { label: 'Conifer Forest',   desc: 'Boreal woodland' },
            broadleaf_trees:  { label: 'Broadleaf Forest', desc: 'Deciduous woodland' },
            mountain_stipple: { label: 'Mountain Terrain', desc: 'Stippled rocky ground and peaks' },
            hills:            { label: 'Hills',             desc: 'Rounded hill silhouettes' },
        };

        // Unique settlement types and landmark categories actually present on this map
        const presentSettlementTypes = [...new Set((map.settlements ?? []).map(s => s.type))];
        const presentLandmarkTypes   = [...new Set((map.landmarks ?? []).filter(l => l.type).map(l => l.type))];
        const presentLandmarkCats    = [...new Set((map.landmarks   ?? []).map(l => l.category ?? 'nature'))];

        let h = '';

        // ── Biome ──────────────────────────────────────────────────────────────
        h += `<div class="legend-section">Biome</div>`;
        h += `<div class="legend-biome-name">${bd?.name ?? map.biomeId}</div>`;
        if (bd?.description) h += `<div class="legend-biome-desc">${bd.description}</div>`;
        if (bd?.climate) {
            h += `<div class="legend-climate"><span>Precipitation:</span> ${bd.climate.precipitation} (${bd.climate.precipitationMm})</div>`;
            h += `<div class="legend-climate"><span>Temperature:</span> ${bd.climate.temperature} — ${bd.climate.temperatureRange}</div>`;
            if (bd.climate.notes) h += `<div class="legend-biome-desc" style="margin-top:3px">${bd.climate.notes}</div>`;
        }

        // ── Elevation ──────────────────────────────────────────────────────────
        h += `<div class="legend-section">Elevation</div>`;
        h += `<div class="legend-swatches">`;
        h += `<div class="legend-swatch"><span class="swatch-block" style="background:${pal.seaColor}"></span>Ocean / Lake</div>`;
        h += `<div class="legend-swatch"><span class="swatch-block" style="background:${rgb(pal.landLow)}"></span>Lowland</div>`;
        h += `<div class="legend-swatch"><span class="swatch-block" style="background:${rgb(pal.landMid)}"></span>Midland</div>`;
        h += `<div class="legend-swatch"><span class="swatch-block" style="background:${rgb(pal.landHigh)}"></span>Highland</div>`;
        if (pal.landMountain) h += `<div class="legend-swatch"><span class="swatch-block" style="background:${rgb(pal.landMountain)}"></span>Mountain</div>`;
        h += `</div>`;

        // ── Surface textures — only what's visually rendered on this map ───────
        const textures = [...(map.terrainTextures ?? [])];
        if (map.hasHills && !textures.includes('hills')) textures.push('hills');
        if (textures.length) {
            h += `<div class="legend-section">Terrain Textures</div>`;
            textures.forEach(key => {
                const t = textureInfo[key];
                if (!t) return;
                const iconSvgs = {
                    farmland: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -7 18 14" width="18" height="18">
                        <ellipse cx="-5"  cy="-3"  rx="3.4" ry="2.7" fill="rgba(203,179,87,0.70)" stroke="#2a3c10" stroke-width="0.5"/>
                        <ellipse cx="-0.5" cy="-4" rx="3.0" ry="2.5" fill="rgba(105,143,66,0.70)" stroke="#2a3c10" stroke-width="0.5"/>
                        <ellipse cx="4"   cy="-2"  rx="3.2" ry="2.6" fill="rgba(139,107,59,0.70)" stroke="#2a3c10" stroke-width="0.5"/>
                        <ellipse cx="-4"  cy="2.5" rx="3.0" ry="2.4" fill="rgba(184,160,72,0.70)" stroke="#2a3c10" stroke-width="0.5"/>
                        <ellipse cx="1"   cy="3"   rx="3.4" ry="2.6" fill="rgba(125,160,79,0.70)" stroke="#2a3c10" stroke-width="0.5"/>
                        <ellipse cx="5.5" cy="1.5" rx="2.8" ry="2.3" fill="rgba(165,136,63,0.70)" stroke="#2a3c10" stroke-width="0.5"/>
                    </svg>`,
                    plains_grass: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -7 18 14" width="18" height="18">
                        <g stroke-linecap="round">
                            ${[[-7,-5,-6,-2],[-4,-6,-3,-2],[-1,-5,0,-1],[3,-6,4,-2],[6,-5,7,-2],
                               [-6,-2,-7,1],[-3,-2,-2,2],[0,-1,1,3],[4,-2,5,2],[7,-2,6,1],
                               [-8,1,-7,4],[-5,2,-4,5],[-2,3,-1,6],[2,2,3,5],[5,1,6,4]].map(
                                ([x1,y1,x2,y2],i) => {
                                    const colors=['#2e4a18','#3d5e24','#4a5020','#566030','#7a6a38'];
                                    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors[i%5]}" stroke-width="0.8" opacity="0.75"/>`;
                                }).join('')}
                        </g>
                    </svg>`,
                    heather: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -7 18 14" width="18" height="18">
                        ${[[-6,-4],[-2,-5],[2,-4],[6,-5],[-7,-1],[-3,0],[1,-1],[5,-2],[-5,3],[-1,2],[3,3],[7,2],[-7,5],[-3,5],[2,5],[6,4]].map(
                            ([x,y]) => `<circle cx="${x}" cy="${y}" r="1.0" fill="#8a608a" opacity="0.65"/>`
                        ).join('')}
                    </svg>`,
                    grassland: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -7 18 14" width="18" height="18">
                        <g stroke="#4a6030" stroke-width="0.8" stroke-linecap="round" opacity="0.8">
                            ${[[-7,-4,-6,-1],[-4,-5,-3,-2],[-1,-4,0,-1],[3,-5,4,-2],[6,-4,7,-1],
                               [-6,0,-7,3],[-3,-1,-2,2],[1,0,0,3],[4,-1,5,2],[7,0,6,3]].map(
                                ([x1,y1,x2,y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`
                            ).join('')}
                        </g>
                    </svg>`,
                    reeds: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -7 18 14" width="18" height="18">
                        <g stroke-linecap="round">
                            ${[[-7,-5,-6,-1],[-5,-6,-4,-2],[-2,-5,-1,-1],[1,-6,2,-2],[4,-5,5,-1],[7,-6,6,-2],
                               [-8,-1,-7,3],[-5,-2,-4,2],[-1,-1,0,3],[2,-2,3,2],[6,-1,7,3]].map(
                                ([x1,y1,x2,y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3a5858" stroke-width="0.8" opacity="0.72"/>`
                            ).join('')}
                        </g>
                    </svg>`,
                    swamp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -7 18 14" width="18" height="18">
                        <g stroke-linecap="round">
                            ${[[-7,-5,-8,-1],[-5,-6,-4,-1],[-2,-5,-3,-1],[0,-6,-1,-2],[2,-5,1,-1],[4,-6,5,-2],[7,-5,6,-1],
                               [-6,-1,-7,3],[-3,-2,-4,2],[0,-2,-1,3],[3,-1,2,3],[6,-2,5,3]].map(
                                ([x1,y1,x2,y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3a5848" stroke-width="0.9" opacity="0.72"/>`
                            ).join('')}
                        </g>
                    </svg>`,
                    wetland: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -7 18 14" width="18" height="18">
                        <g stroke="#3a5858" stroke-linecap="round" opacity="0.7">
                            ${[[-7,-4,-6,-1],[-3,-5,-2,-2],[1,-4,2,-1],[5,-5,6,-2]].map(
                                ([x1,y1,x2,y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="0.8"/>`
                            ).join('')}
                            ${[[-6,-1],[-2,-2],[2,-1],[6,-2],[-7,2],[-3,1],[1,2],[5,1]].map(
                                ([x,y]) => `<circle cx="${x}" cy="${y}" r="0.9" fill="#4a6878"/>`
                            ).join('')}
                        </g>
                    </svg>`,
                    scrub: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -7 18 14" width="18" height="18">
                        <g stroke="#8a7040" stroke-linecap="round" opacity="0.78">
                            ${[[-6,-3],[-1,-4],[4,-3],[7,-1],[-4,1],[1,2],[5,3],[-7,3],[-2,4]].map(
                                ([cx,cy]) => `<line x1="${cx-2}" y1="${cy+2}" x2="${cx}" y2="${cy-2}"/><line x1="${cx}" y1="${cy-2}" x2="${cx+2}" y2="${cy+2}"/>`
                            ).join('')}
                        </g>
                    </svg>`,
                    boreal_conifers: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -8 18 14" width="18" height="18">
                        <g stroke="#3a4030" stroke-width="0.7" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.85">
                            <polyline points="-6.2,-2 -4.5,-6 -2.8,-2"/>
                            <polyline points="-7,-0.5 -4.5,-3.5 -2,-0.5"/>
                            <line x1="-4.5" y1="-0.2" x2="-4.5" y2="1.5"/>
                            <polyline points="1.8,-2 3.5,-6 5.2,-2"/>
                            <polyline points="1,-0.5 3.5,-3.5 6,-0.5"/>
                            <line x1="3.5" y1="-0.2" x2="3.5" y2="1.5"/>
                            <polyline points="-1.5,2.5 -0.5,0 0.5,2.5"/>
                        </g>
                    </svg>`,
                    broadleaf_trees: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -8 18 14" width="18" height="18">
                        <g stroke="#3a4828" stroke-width="0.65" fill="none" opacity="0.85" stroke-linecap="round">
                            <ellipse cx="-4.5" cy="-4.5" rx="2.2" ry="2.8"/>
                            <line x1="-4.5" y1="-1.7" x2="-4.5" y2="1"/>
                            <ellipse cx="2" cy="-5" rx="2.6" ry="3.2"/>
                            <line x1="2" y1="-1.8" x2="2" y2="1.5"/>
                            <ellipse cx="6.5" cy="-4" rx="1.8" ry="2.4"/>
                            <line x1="6.5" y1="-1.6" x2="6.5" y2="0.8"/>
                            <polyline points="-7.5,1.5 -6.5,-0.5 -5.5,1.5"/>
                            <polyline points="4,1.5 5,-0.5 6,1.5"/>
                        </g>
                    </svg>`,
                    mountain_stipple: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -8 18 16" width="18" height="18">
                        <path d="M -8 2 L -3 -7 L -1 2 Z" fill="#eee8e0" stroke="#242020" stroke-width="0.7"/>
                        <path d="M -1 2 L -3 -7 L 5 2 Z" fill="#b6b0a8" stroke="#242020" stroke-width="0.7"/>
                        ${[[-6,4],[-3,5],[0,4],[3,5],[6,4],[7,6],[-7,6],[-1,6]].map(
                            ([x,y]) => `<circle cx="${x}" cy="${y}" r="0.6" fill="#504030" opacity="0.65"/>`
                        ).join('')}
                    </svg>`,
                    hills: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -8 20 10" width="18" height="18">
                        <path d="M -9 1 Q -5 -7 -1 -7 Q 3 -7 7 1" fill="none" stroke="#7a7060" stroke-width="1" opacity="0.6"/>
                        <path d="M -4 1 Q -1 -4 2 -4 Q 5 -4 9 1" fill="none" stroke="#7a7060" stroke-width="0.8" opacity="0.45"/>
                    </svg>`,
                };
                h += `<div class="legend-row">`;
                const iconSvg = iconSvgs[key];
                if (iconSvg) {
                    h += `<span class="legend-icon-svg" style="flex-shrink:0;margin-right:5px">${iconSvg}</span>`;
                } else {
                    h += `<span class="swatch-block" style="flex-shrink:0;margin-right:5px;background:#aaa"></span>`;
                }
                h += `<span>${t.label} <em style="color:#888;font-size:9px">— ${t.desc}</em></span>`;
                h += `</div>`;
            });
        }

        // ── Settlements — only types present on this map ───────────────────────
        const SETTLEMENT_ORDER = ['capital', 'city', 'fortress', 'port_city', 'market_town', 'town', 'fishing_village', 'village', 'port'];
        const presentSettlements = SETTLEMENT_ORDER.filter(t => presentSettlementTypes.includes(t));
        if (presentSettlements.length) {
            h += `<div class="legend-section">Settlements</div>`;
            presentSettlements.forEach(type => {
                const cfg = LEGEND_SETTLEMENTS[type];
                if (!cfg) return;
                h += `<div class="legend-row">
                    <span class="legend-icon-svg">${cfg.icon}</span>
                    <span><strong>${cfg.label}</strong> — <em style="color:#666;font-size:10px">${cfg.desc}</em></span>
                </div>`;
            });
        }

        // ── Landmarks — placed types (ruin, stronghold) and generated categories ────
        // NOTE: Landmarks are NEVER settlements. They are archaeological sites and points of interest.
        const allLandmarksToShow = new Set([...presentLandmarkTypes, ...presentLandmarkCats]);
        if (allLandmarksToShow.size) {
            h += `<div class="legend-section">Landmarks</div>`;
            // Show landmark types first (ruin, stronghold)
            presentLandmarkTypes.forEach(type => {
                const cfg = LEGEND_LANDMARKS[type];
                if (!cfg) return;
                h += `<div class="legend-row">
                    <span class="legend-icon-svg">${cfg.icon}</span>
                    <span><strong>${cfg.label}</strong> — <em style="color:#666;font-size:10px">${cfg.desc}</em></span>
                </div>`;
            });
            // Then show landmark categories (dungeon, shrine, military, etc.)
            Array.from(allLandmarksToShow).forEach(cat => {
                if (presentLandmarkTypes.includes(cat)) return;  // Skip if already shown as a type
                const cfg = LEGEND_LANDMARKS[cat];
                if (!cfg) return;
                h += `<div class="legend-row">
                    <span class="legend-icon-svg">${cfg.icon}</span>
                    <span><strong>${cfg.label}</strong> — <em style="color:${cfg.color};font-size:10px">${cfg.desc}</em></span>
                </div>`;
            });
        }

        // ── Natural features — only shown when present on this map ────────────
        const naturalRows = [];
        if (map.hasRivers)  naturalRows.push(`<div class="legend-row"><span class="legend-icon-svg"><svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -6 20 12" width="18" height="18"><path d="M -9 -2 Q -4 -2 0 1 Q 4 4 9 4" fill="none" stroke="#9ab8c8" stroke-width="4" opacity="0.45" stroke-linecap="round"/><path d="M -9 -2 Q -4 -2 0 1 Q 4 4 9 4" fill="none" stroke="#4a7088" stroke-width="1.3" stroke-linecap="round"/></svg></span>Rivers</div>`);
        if (map.hasLakes)   naturalRows.push(`<div class="legend-row"><span class="swatch-block" style="background:#b8d4e4;flex-shrink:0;margin-right:5px"></span>Lakes</div>`);
        if (naturalRows.length) {
            h += `<div class="legend-section">Natural Features</div>`;
            h += naturalRows.join('');
        }

        // ── Roads — only types that exist on this map ──────────────────────────
        const rt = map.roadTypes ?? [];
        if (rt.length) {
            h += `<div class="legend-section">Roads</div>`;
            if (rt.includes('major')) h += `<div class="legend-row"><span class="legend-road-major"></span> Major Road</div>`;
            if (rt.includes('road'))  h += `<div class="legend-row"><span class="legend-road-road"></span> Road</div>`;
            if (rt.includes('trail')) h += `<div class="legend-row"><span class="legend-road-trail"></span> Trail</div>`;
        }

        body.innerHTML = h;
    }

    // Build FantasyMap generation params from a compact spec. Shared by the
    // map.html settings panel (via _readParams) and the game shell
    // (game-main.js), so the seaLevel/mountain formulas live in one place.
    // Omitted sliders fall back to the map type preset's defaults.
    static buildParams({ mapType = 'standard', biome = 'the_midlands',
                         sliders = {}, scale = 1, showTreeSymbols = true } = {}) {
        const typePreset = Game.MAP_TYPE_PRESETS[mapType] ?? Game.MAP_TYPE_PRESETS.standard;
        const s = { ...typePreset.sliders, ...sliders };
        const p = val => val / 100;
        // Culture is derived automatically from the selected biome — no manual selection.
        const biomeCultures = Game.BIOME_CULTURES[biome] ?? {};
        const culture       = biomeCultures.dominant ?? 'midlander';
        // seaLevel formula varies by map type so sliders stay meaningful per type
        const seaLevel = mapType === 'inland'
            ? 0.08                                          // nearly all land; valleys become lakes
            : mapType === 'archipelago'
                ? 0.70 - p(s.land) * 0.18                  // default very high ocean
                : mapType === 'large_island'
                    ? 0.58 - p(s.land) * 0.20              // moderate ocean encircling island
                    : 0.55 - p(s.land) * 0.26;             // standard

        // For inland the land range is huge (seaLevel≈0.08) so the standard formula
        // would make >60 % of land count as mountains. Scale the offset relative to
        // the actual land elevation band so the slider remains intuitive.
        const landRange      = 1.0 - seaLevel;
        const mountainOffset = mapType === 'inland'
            ? landRange * (0.55 + (1 - p(s.mountains)) * 0.38)
            : 0.45 - p(s.mountains) * 0.35;

        return {
            scale,
            mapType,
            continent:       typePreset.continent,
            ruggedness:      typePreset.ruggedness,
            edgeSink:        typePreset.edgeSink       ?? 0,
            edgeSinkStart:   typePreset.edgeSinkStart  ?? 0,
            islandSeeds:     typePreset.islandSeeds    ?? 0,
            bigIsland:       typePreset.bigIsland      ?? false,
            biome,
            culture,
            allCultures:     biomeCultures.cultures ?? [],
            seaLevel,
            mountainOffset,
            forestScale:     p(s.forests)     * 2.5,
            showTreeSymbols,
            riverScale:      p(s.rivers)      * 2.5,
            settlementScale: p(s.settlements) * 2.5,
            ruinScale:       p(s.ruins)       * 2.5,
            landmarkCount:   s.landmarks,
        };
    }

    _readParams() {
        const v    = id => +document.getElementById(id).value;
        const sel  = id => document.getElementById(id).value;
        const size = +document.querySelector('.size-btn.active').dataset.size;
        return Game.buildParams({
            mapType:         sel('param-map-type'),
            biome:           sel('param-biome'),
            scale:           size,
            showTreeSymbols: document.getElementById('param-show-trees').checked,
            sliders: {
                land:        v('param-land'),
                mountains:   v('param-mountains'),
                forests:     v('param-forests'),
                rivers:      v('param-rivers'),
                settlements: v('param-settlements'),
                ruins:       v('param-ruins'),
                landmarks:   v('param-landmarks'),
            },
        });
    }

    showMap() {
        this.currentScreen = 'map';
        this.canvas.hide();
        const _smParams = this._readParams();
        this.zoom.configure(_smParams.scale);
        this.mapScreen.show(null, _smParams);
        document.getElementById('param-seed').value = this.mapScreen.currentSeed;
        this._updateLegend();
    }

    // Future: switch to gameplay canvas
    showGame() {
        this.currentScreen = 'game';
        this.mapScreen.hide();
        this.canvas.show();
    }

    _loop(timestamp) {
        if (this._lastTime === null) this._lastTime = timestamp;
        const dt = Math.min((timestamp - this._lastTime) / 1000, 0.1);
        this._lastTime = timestamp;

        this.update(dt);

        // Canvas draw only runs when a canvas screen is active
        if (this.currentScreen !== 'map') {
            this.draw();
        }

        requestAnimationFrame(ts => this._loop(ts));
    }

    update(dt) {
        // Future gameplay logic
    }

    draw() {
        const { ctx, width, height } = this.canvas;
        ctx.clearRect(0, 0, width, height);
    }
}


// ─── Ruin image picker — keyword matching on name ─────────────────────────────
// Stonehenge is the broad default for ancient, crumbling, stone, city, fallen
// ruins. Only route to the other images on tight, unambiguous keywords.
function _ruinImage(name) {
    const n = name.toLowerCase();
    // Burial / graveyard — very specific death/burial words only
    if (/\bgrave\b|graveyard|bone yard|catacombs|\btomb\b|\bbarrow\b|drowned|sunken/.test(n))
        return 'assets/images/landmarkimages/graveyardriver.jpg';
    // Chapel / shrine — small religious structure
    if (/chapel|shrine/.test(n))
        return 'assets/images/landmarkimages/humanchapel.jpg';
    // Monastery / sanctum — large religious or scholarly hall
    if (/sanctum|monastery|temple|vault/.test(n))
        return 'assets/images/landmarkimages/ruinmonastery.jpg';
    // Tower / military structure
    if (/\btower\b|watchtower|\bspire\b|\bkeep\b|\bfortress\b|citadel|stronghold|bastion|outpost/.test(n))
        return 'assets/images/landmarkimages/humanruintower.jpg';
    // Arcane / cursed — only pure magic/eldritch words
    if (/\barcane\b|eldritch|\bvoid\b/.test(n))
        return 'assets/images/landmarkimages/magicstone.jpg';
    // Everything else: fallen cities, crumbling gates, ancient halls, stone
    // circles, blighted fields, forsaken depths, hollow remnants — stonehenge
    return 'assets/images/landmarkimages/stonehenge.jpg';
}

// ─── Settlement popup (towns & cities — temperate forest & plains) ────────────
window.showTownPopup = function(settlementName, biomeId, settlementType, settlementCultureId, settlementKingdomId) {
    const popup  = document.getElementById('town-popup');
    const imgEl  = document.getElementById('town-popup-img');
    const nameEl = document.getElementById('town-popup-name');
    const bodyEl = document.getElementById('town-popup-body');
    if (!popup) return;

    const isCapital = settlementType === 'capital';
    const isPortCity = settlementType === 'port_city';
    const isPort = settlementType === 'port' || isPortCity;
    const isFishing = settlementType === 'fishing_village';
    const isMarketTown = settlementType === 'market_town';
    const isTown = settlementType === 'town';
    const isCity   = isCapital || settlementType === 'city' || isPort;
    const terrain  = biomeId === 'the_midlands' ? 'open farmlands' : 'Leonorian lands';

    const isVillage = settlementType === 'village';
    const isRuin    = settlementType === 'ruin';

    if (isRuin) {
        imgEl.src = _ruinImage(settlementName);
        imgEl.alt = 'Ruin';
        imgEl.style.display = '';
        delete imgEl.dataset.placeholder;
    } else if (biomeId === 'the_midlands') {
        // Midlands: use existing imagery
        if (isPortCity) {
            imgEl.src = 'assets/images/landmarkimages/humancapital.jpg';
            imgEl.alt = 'Port City';
        } else if (isPort) {
            imgEl.src = 'assets/images/landmarkimages/humansmalltown2.jpg';
            imgEl.alt = 'Port';
        } else if (isFishing) {
            imgEl.src = 'assets/images/landmarkimages/humansmalltown2.jpg';
            imgEl.alt = 'Fishing Village';
        } else {
            imgEl.src = isCity    ? 'assets/images/landmarkimages/humancapital.jpg'
                      : isVillage ? 'assets/images/landmarkimages/humancountryside.jpg'
                      :              'assets/images/landmarkimages/humansmalltown2.jpg';
            imgEl.alt = isCity ? 'City' : isVillage ? 'Village' : 'Town';
        }
        imgEl.style.display = '';
        delete imgEl.dataset.placeholder;
    } else {
        // Other biomes: no graphics yet. Hide image element and mark as placeholder
        imgEl.removeAttribute('src');
        imgEl.alt = '';
        imgEl.style.display = 'none';
        imgEl.dataset.placeholder = 'biome-graphics-not-implemented';
    }

    const _typeLabels = {
        capital: 'Capital', city: 'City', stronghold: 'Stronghold',
        port_city: 'Port City', market_town: 'Market Town', town: 'Town',
        fishing_village: 'Fishing Village', village: 'Village',
        camp: 'Camp', stronghold: 'Fortified Camp', port: 'Port', ruin: 'Ruin',
    };
    const _typeLabel = _typeLabels[settlementType] ?? '';
    nameEl.textContent = _typeLabel ? `${settlementName} — ${_typeLabel}` : settlementName;

    // Prepare a short, human-friendly culture token for the settlement.
    // The `settlementCultureId` often comes from name-pool sources like
    // "step_folk_settlements"; clean that to produce "step_folk".
    let settlementCultureToken = null;
    try {
        if (settlementCultureId) {
            settlementCultureToken = String(settlementCultureId)
                .replace(/_settlements$/i, '')
                .split('/')?.pop()?.trim();
        }
    } catch (e) { settlementCultureToken = null; }

    // Resolve the settlement's culture token to a full culture object.
    let settlementCultureObj = null;
    try {
        const allCultures = window._leonoriaCultures ?? [];
        if (settlementCultureToken && allCultures.length) {
            const token = settlementCultureToken.toLowerCase();

            // Explicit token→race aliases for pool names that don't match race strings.
            const TOKEN_RACE_ALIASES = {
                wildmen:   'forester',    // wildmen_settlements → Foresters race
                ancient:   'ice archon',  // ancient_settlements → Ice Archons
                secluded:  'secluded',    // archons_secluded covers via id match below
            };
            const raceHint = TOKEN_RACE_ALIASES[token] ?? null;

            const alt      = token.replace(/_/g, ' ').trim();
            const tokenSing = token.replace(/s$/i, '');
            const altSing  = alt.replace(/s$/i, '');

            // Gather all candidates by fuzzy match
            const candidates = allCultures.filter(c =>
                (c.id   && (c.id.toLowerCase() === token || c.id.toLowerCase().includes(token))) ||
                (c.name && (c.name.toLowerCase().includes(token) || c.name.toLowerCase().includes(alt))) ||
                (c.race && (
                    String(c.race).toLowerCase() === token ||
                    String(c.race).toLowerCase().includes(token) ||
                    String(c.race).toLowerCase().includes(alt) ||
                    String(c.race).toLowerCase().includes(tokenSing) ||
                    String(c.race).toLowerCase().includes(altSing) ||
                    (raceHint && String(c.race).toLowerCase().includes(raceHint))
                ))
            );

            if (candidates.length === 1) {
                settlementCultureObj = candidates[0];
            } else if (candidates.length > 1) {
                // Multiple cultures share this race — use a stable hash of the
                // settlement name to pick one deterministically so each named
                // settlement always shows the same culture but the map has variety.
                let hash = 0;
                for (let i = 0; i < settlementName.length; i++)
                    hash = Math.imul(hash ^ settlementName.charCodeAt(i), 0x9e3779b9) >>> 0;
                settlementCultureObj = candidates[hash % candidates.length];
            }
        }
    } catch (e) { settlementCultureObj = null; }

    // Choose culture/settlement data where available.  Default to the
    // Midlander datasets for the midlands biome; otherwise fall back to
    // safe generic placeholders so capitals in other biomes still show a
    // reasonable popup when specific culture data isn't loaded.
    let culture = null;
    let settlements = null;
    if (biomeId === 'the_midlands') {
        culture = window._leonoriaMidlanderCulture;
        settlements = window._leonoriaMidlanderSettlements;
    } else {
        // Attempt other globals if present (future-proofing)
        culture = window._leonoriaMidlanderCulture || null;
        settlements = window._leonoriaMidlanderSettlements || null;
    }

    // Generic fallbacks to avoid undefined errors and provide reasonable
    // content when no specific culture/settlement data exists for a biome.
    if (!settlements) settlements = { cities: [], villages: [], trade_and_industry: [], fortresses_and_keeps: [] };

    // If no explicit culture data is available, try to infer a dominant
    // local culture from the biome's preferredCultures list and the
    // loaded cultures dataset. Fall back to Midlander or a safe generic
    // placeholder if nothing suitable is found.
    if (!culture) {
        const biomes = window._leonoriaBiomes ?? [];
        const allCultures = window._leonoriaCultures ?? [];
        const biomeEntry = biomes.find(b => b.id === biomeId) || null;
        let inferred = null;
        if (biomeEntry && Array.isArray(biomeEntry.preferredCultures) && biomeEntry.preferredCultures.length > 0) {
            // Try to match preferred culture tokens to loaded culture objects using
            // several heuristics (id, race, name, category) to handle differing
            // naming schemes between biomes and culture records.
            for (const pref of biomeEntry.preferredCultures) {
                const token = String(pref).toLowerCase();
                inferred = allCultures.find(c => (c.id && c.id.toLowerCase() === token))
                    || allCultures.find(c => (c.id && c.id.toLowerCase().includes(token)))
                    || allCultures.find(c => (c.race && String(c.race).toLowerCase().includes(token)))
                    || allCultures.find(c => (c.name && String(c.name).toLowerCase().includes(token)))
                    || allCultures.find(c => (c.category && String(c.category).toLowerCase().includes(token)));
                if (inferred) break;
            }
        }
        culture = inferred || window._leonoriaMidlanderCulture || {
            name: 'Local populace', stance: 'Independent', alignment_dominance: 'Varied',
            architecture: 'Local vernacular', traits: ['Practical'], typical_classes: ['Commoner'], regions: []
        };
        // Debug helper: expose last inferred culture for dev inspection
        try { window._lastInferredPopupCulture = { biomeId, inferredId: inferred?.id ?? null, inferredName: inferred?.name ?? null } } catch(e){}
    }

    // Compose a culture summary for the "People" section. Prefer the
    // settlement-specific culture object resolved from name-pool inference;
    // fall back to the biome-inferred culture. Show race, full description + stance.
    let cultureSummary = '';
    let cultureRaceHtml = '';
    try {
        const sourceCulture = settlementCultureObj || culture || null;
        if (sourceCulture) {
            const race = String(sourceCulture.race || '').trim();
            const desc = String(sourceCulture.description || '').trim();
            const stance = String(sourceCulture.stance || '').trim();
            const traits = Array.isArray(sourceCulture.traits) ? sourceCulture.traits.slice(0, 4).join(' · ') : '';
            const parts = [];
            if (desc) parts.push(desc.endsWith('.') ? desc : desc + '.');
            if (stance) parts.push(stance.endsWith('.') ? stance : stance + '.');
            if (traits && !desc) parts.push(traits);
            cultureSummary = parts.join(' ');
            if (race) cultureRaceHtml = `<div class="popup-fact"><strong>Race:</strong> ${race}</div>`;
        }
    } catch (e) { cultureSummary = ''; cultureRaceHtml = ''; }

    let cultureDescriptorHtml = '';
    try {
        // Use the same resolved culture object as the People section so the
        // descriptor and race line always refer to the same culture.
        const sourceCulture = settlementCultureObj || culture || null;
        const displayCultureName = sourceCulture
            ? (String(sourceCulture.name || sourceCulture.race || '').trim() || null)
            : null;

        if (displayCultureName) {
            const kind = isVillage ? 'village' : isFishing ? 'fishing village' : isTown ? 'town' : isMarketTown ? 'market town' : isCity ? 'city' : settlementType;
            const sizeWord = (isVillage || isFishing) ? 'small' : '';
            const size = sizeWord ? `${sizeWord} ` : '';
            const articleBase = (sizeWord ? sizeWord : displayCultureName).toLowerCase();
            const article = (/^[aeiou]/i.test(articleBase)) ? 'An' : 'A';
            cultureDescriptorHtml = `<div class="popup-fact">${article} ${size}${displayCultureName} ${kind}.</div>`;
        }
    } catch (e) { cultureDescriptorHtml = ''; }

    // Resolve kingdom object from the passed kingdom id.
    // Independent of the overlay toggle — kingdom data shows whenever a
    // settlement has been assigned to a kingdom, regardless of map state.
    let kd = null;
    try {
        if (settlementKingdomId) {
            kd = (window._leonoriaKingdoms ?? []).find(k => k.id === settlementKingdomId) ?? null;
        }
    } catch (e) { kd = null; }

    // Stable region pick: same settlement always maps to the same region
    const kdRegion = (() => {
        if (!kd || !Array.isArray(kd.known_regions) || !kd.known_regions.length) return null;
        let h = 0;
        for (let i = 0; i < settlementName.length; i++)
            h = Math.imul(h ^ settlementName.charCodeAt(i), 0x9e3779b9) >>> 0;
        return kd.known_regions[h % kd.known_regions.length];
    })();

    // Build kingdom header block — inserted right at the top of the popup body
    const kingdomHtml = (() => {
        if (!kd) return '';
        const colorSwatch = `<span style="display:inline-block;width:11px;height:11px;border-radius:2px;background:${kd.color_hex ?? '#888'};margin-right:5px;vertical-align:middle;border:1px solid rgba(0,0,0,0.25)"></span>`;
        let h = `<div class="popup-section-label">Nation / Kingdom</div>`;
        h += `<div class="popup-fact">${colorSwatch}<strong>${kd.name}</strong>`;
        if (kdRegion) h += ` &mdash; <em>${kdRegion}</em>`;
        h += `</div>`;
        if (kd.description) h += `<div class="popup-fact">${kd.description}</div>`;
        if (kd.stance)      h += `<div class="popup-fact"><em>${kd.stance}.</em></div>`;
        return h;
    })();

    // People block derived from kingdom rather than old culture data
    const kingdomPeopleHtml = (() => {
        if (!kd) return '';
        const traits = Array.isArray(kd.traits) ? kd.traits.slice(0, 4).join(' · ') : '';
        const classes = Array.isArray(kd.typical_classes) ? kd.typical_classes.join(', ') : '';
        let h = '';
        if (cultureRaceHtml) h += cultureRaceHtml;
        if (traits) h += `<div class="popup-fact">${traits}.</div>`;
        if (classes) h += `<div class="popup-fact"><strong>Common callings:</strong> ${classes}.</div>`;
        return h;
    })();

    // Architecture / governance block from kingdom
    const kingdomArchHtml = kd?.architecture
        ? `<div class="popup-fact"><strong>Architecture:</strong> ${kd.architecture}</div>`
        : '';

    let html = '';
    // Kingdom section is the first thing in the body for Midlands settlements
    if (kingdomHtml) html += kingdomHtml;

    if (isFishing) {
        html += `<div class="popup-section-label">Settlement</div>`;
        html += `<div class="popup-fact">A fishing village — a small coastal settlement sustained by fishing, boatwrights, and fish-processing. Boats, drying racks, and nets dominate daily life on the shore.</div>`;
        html += `<div class="popup-section-label">Economy</div>`;
        html += `<div class="popup-fact">Fishing and small-scale processing form the backbone of the local economy; traders ply salted fish and bait along nearby routes.</div>`;
        if (kingdomPeopleHtml || cultureRaceHtml) {
            html += `<div class="popup-section-label">People</div>`;
            html += kingdomPeopleHtml || (cultureRaceHtml + `<div class="popup-fact">${cultureSummary}</div>`);
        }
    } else if (isCity) {
        const cityList = settlements?.cities ?? [];
        const cityEntry = cityList.length
            ? cityList[Math.floor(Math.random() * cityList.length)]
            : null;

        html += `<div class="popup-section-label">Settlement</div>`;
        if (isPortCity) {
            html += `<div class="popup-fact">${isCapital ? 'The regional capital port' : 'A fortified port city'} — a major harbour and centre of maritime trade on the ${terrain}. Ships berth here; customs, shipwrights, and mercantile houses dominate the waterfront.`;
        } else if (isPort) {
            html += `<div class="popup-fact">A coastal port — a working harbour and hub of sea-borne trade on the ${terrain}. Fishermen, merchants, and mariners keep the docks alive.`;
        } else {
            html += `<div class="popup-fact">${isCapital ? 'The regional capital' : 'City'} — seat of power, law, and high commerce amid the ${terrain}. Home to guilds, garrisons, and a ruling council or lord.`;
        }
        if (cityEntry) html += ` Cities of this stature include such places as <em>${cityEntry}</em>.`;
        html += `</div>`;
        if (kingdomArchHtml) {
            html += `<div class="popup-section-label">Governance &amp; Architecture</div>`;
            html += kingdomArchHtml;
        }
        if (kingdomPeopleHtml || cultureRaceHtml) {
            html += `<div class="popup-section-label">People</div>`;
            html += kingdomPeopleHtml || (cultureRaceHtml + `<div class="popup-fact">${cultureSummary}</div>`);
        }
    } else if (isMarketTown) {
        const tradeList = settlements?.trade_and_industry ?? [];
        const tradeFact = tradeList.length
            ? tradeList[Math.floor(Math.random() * tradeList.length)]
            : null;

        html += `<div class="popup-section-label">Settlement</div>`;
        html += `<div class="popup-fact">A prosperous market town — a centre of trade, law, and governance amid the ${terrain}.`;
        if (tradeFact) html += ` Notable institutions include <em>${tradeFact}</em>.`;
        html += `</div>`;
        if (kingdomArchHtml) {
            html += `<div class="popup-section-label">Governance &amp; Architecture</div>`;
            html += kingdomArchHtml;
        }
        if (kingdomPeopleHtml || cultureRaceHtml) {
            html += `<div class="popup-section-label">People</div>`;
            html += kingdomPeopleHtml || (cultureRaceHtml + `<div class="popup-fact">${cultureSummary}</div>`);
        }
    } else if (isTown) {
        html += `<div class="popup-section-label">Settlement</div>`;
        html += `<div class="popup-fact">A town — a local centre of services, markets, and minor governance serving surrounding villages in the ${terrain}.</div>`;
        if (kingdomArchHtml) {
            html += `<div class="popup-section-label">Governance &amp; Architecture</div>`;
            html += kingdomArchHtml;
        }
        if (kingdomPeopleHtml || cultureRaceHtml) {
            html += `<div class="popup-section-label">People</div>`;
            html += kingdomPeopleHtml || (cultureRaceHtml + `<div class="popup-fact">${cultureSummary}</div>`);
        }
    } else if (isVillage) {
        const villageList = settlements?.villages ?? [];
        const villageEntry = villageList.length
            ? villageList[Math.floor(Math.random() * villageList.length)]
            : null;

        html += `<div class="popup-section-label">Settlement</div>`;
        html += `<div class="popup-fact">A small rural village — a tight-knit community of farmers, hunters, and craftspeople scratching a living from the ${terrain}.`;
        if (villageEntry) html += ` Humble settlements of this kind bear names such as <em>${villageEntry}</em>.`;
        html += `</div>`;
        if (kingdomPeopleHtml || cultureRaceHtml) {
            html += `<div class="popup-section-label">People</div>`;
            html += kingdomPeopleHtml || (cultureRaceHtml + `<div class="popup-fact">${cultureSummary}</div>`);
        }
    } else if (isRuin) {
        const nameL = settlementName.toLowerCase();

        // Determine ruin subtype from name keywords
        let subtypeName, subtypeDesc, dangerDesc;
        if (/drowned|sunken|barrow|grave|bone|catacombs|tomb|depths|blighted|ashen/.test(nameL)) {
            subtypeName  = 'Burial Ruin';
            subtypeDesc  = `A sunken burial place amid the ${terrain} — the dead here seldom rest quietly, and tomb robbers rarely return.`;
            dangerDesc   = 'Skeletons, zombies, wraiths, and worse rise when the living intrude. Cursed burial goods may also animate. Beware magical seals on inner chambers.';
        } else if (/chapel|shrine/.test(nameL)) {
            subtypeName  = 'Ruined Chapel';
            subtypeDesc  = `A fallen place of worship ${terrain === 'open farmlands' ? 'standing alone in the fields' : 'half-swallowed by the forest'} — its deity long silent, its altars cracked and cold.`;
            dangerDesc   = 'Fallen shrines attract shadows, specters, and the undead faithful. A defiled altar may still channel something malevolent.';
        } else if (/temple|sanctum|monastery|vault|hall|halls|empty|silent|forgotten/.test(nameL)) {
            subtypeName  = 'Collapsed Sanctum';
            subtypeDesc  = `A ruined hall of learning or worship — its inner vaults may hold forgotten texts, sacred relics, or something far more dangerous than either.`;
            dangerDesc   = 'Undead clergy and cursed acolytes haunt these halls. Fiends are drawn to desecrated altars, and old mechanical traps may remain primed.';
        } else if (/cursed|dark|shadow|withered|void|eldritch/.test(nameL)) {
            subtypeName  = 'Cursed Remnant';
            subtypeDesc  = `A place where something went deeply wrong — the very soil is stained by whatever catastrophe unmade this site.`;
            dangerDesc   = 'Dark magic and restless spirits linger. Prolonged exposure can cause corruption or madness. The source of the curse is rarely simple to remove.';
        } else if (/tower|spire|watchtower|keep|fortress|citadel|stronghold|bastion|gate|outpost/.test(nameL)) {
            subtypeName  = 'Ruined Fortification';
            subtypeDesc  = `A crumbling ${/tower|spire|watchtower/.test(nameL) ? 'watchtower' : 'fortress'} — once a sentinel against invasion, now claimed by shadow and decay.`;
            dangerDesc   = 'Bandits and mercenaries often occupy old fortifications. Deeper levels may hide trapped survivors, hidden armories, or far worse inhabitants.';
        } else {
            subtypeName  = 'Ancient Ruin';
            subtypeDesc  = `Ruins of uncertain origin amid the ${terrain} — scholars debate what civilization built these stones and what brought them low.`;
            dangerDesc   = 'Wolves, bandits, or worse have made their home among the fallen stones. Ancient traps may still be functional.';
        }

        html += `<div class="popup-section-label">Ruin Type</div>`;
        html += `<div class="popup-fact"><strong>${subtypeName}</strong><br>${subtypeDesc}</div>`;

        // Historical era flavor from eras.json
        const eras = window._leonoriaErasData ?? [];
        const classicalAge = eras.find(e => e.era === 'Classical Age');
        const ancientAge   = eras.find(e => e.era === 'Ancient & Mythic');
        const eraPool = [
            ...(classicalAge?.suberas ?? []),
            ...(ancientAge?.suberas   ?? []),
        ];
        if (eraPool.length) {
            const era = eraPool[Math.floor(Math.random() * eraPool.length)];
            html += `<div class="popup-section-label">History</div>`;
            html += `<div class="popup-fact">These stones may date to the <em>${era.name}</em> (${era.date_range}) — ${era.description}</div>`;
        }

        // Famous ruins from importantlocations.json
        const allLocs    = window._leonoriaLocationsData ?? [];
        const famousRuins = allLocs.filter(l => l.type === 'ruin' || l.type === 'dungeon');
        if (famousRuins.length) {
            const ref = famousRuins[Math.floor(Math.random() * famousRuins.length)];
            html += `<div class="popup-section-label">Known Parallels</div>`;
            html += `<div class="popup-fact">Scholars compare such places to <em>${ref.name}</em> (${ref.world}) — ${ref.notable_for.join(', ')}.</div>`;
        }

        // Ruin name examples from ruins.json
        const ruinData    = window._leonoriaRuinsData ?? {};
        const descNames   = ruinData.descriptive_names ?? [];
        if (descNames.length) {
            const example = descNames[Math.floor(Math.random() * descNames.length)];
            html += `<div class="popup-section-label">Local Lore</div>`;
            html += `<div class="popup-fact">Old maps and tavern tales name similar places: <em>${example}</em>.</div>`;
        }

        html += `<div class="popup-section-label">Danger</div>`;
        html += `<div class="popup-fact">${dangerDesc}</div>`;

    } else {
        const tradeList = settlements?.trade_and_industry ?? [];
        const tradeFact = tradeList.length
            ? tradeList[Math.floor(Math.random() * tradeList.length)]
            : null;

        html += `<div class="popup-section-label">Settlement</div>`;
        html += `<div class="popup-fact">A settlement of the ${terrain}.`;
        if (tradeFact) html += ` Notable institutions include <em>${tradeFact}</em>.`;
        html += `</div>`;
        if (kingdomArchHtml) {
            html += `<div class="popup-section-label">Governance &amp; Architecture</div>`;
            html += kingdomArchHtml;
        }
        if (kingdomPeopleHtml || cultureRaceHtml) {
            html += `<div class="popup-section-label">People</div>`;
            html += kingdomPeopleHtml || (cultureRaceHtml + `<div class="popup-fact">${cultureSummary}</div>`);
        }
    }
    // Amenities summary (all biomes) — use FantasyMap static helper when present
    if (!isRuin) {
        const amenFactory = window.FantasyMap && typeof window.FantasyMap._settlementAmenities === 'function'
            ? window.FantasyMap._settlementAmenities
            : (t => ({}));
        const amen = amenFactory(settlementType) ?? {};

        const displayNames = {
            capital: 'capital', city: 'city', fortress: 'fortress', port_city: 'port city',
            market_town: 'market town', town: 'town', fishing_village: 'fishing village',
            village: 'village', stronghold: 'fortified camp', port: 'port', ruin: 'ruin'
        };
        const disp = displayNames[settlementType] || settlementType;

        const lines = [];
        const inns = amen.inns ?? [];
        if (inns.length === 1) lines.push(`One inn — ${inns[0].quality}`);
        else if (inns.length > 1) lines.push(`${inns.length} inns — ${inns.map(i=>i.quality).join(', ')}`);

        const traders = Number(amen.traders ?? 0);
        if (traders === 1) lines.push('One small trader');
        else if (traders > 1) lines.push(`${traders} traders`);

        const healers = Number(amen.healers ?? 0);
        if (healers === 1) lines.push('One healer');
        else if (healers > 1) lines.push(`${healers} healers`);

        if (amen.guards) lines.push('Garrison / formal guards present');
        if (amen.temple) lines.push('Temple or place of worship');
        if (amen.port) lines.push('Harbour / port facilities');
        if (amen.castle) lines.push('Castle / keep');
        if (amen.royalCourt) lines.push('Royal court or regional administration');

        if (lines.length === 0) lines.push('No notable amenities recorded.');

        html += `<div class="popup-section-label">Amenities in this ${disp}</div>`;
        html += `<ul class="popup-amenities">${lines.map(l => `<li>${l}</li>`).join('')}</ul>`;
    }

    bodyEl.innerHTML = html;
    popup.classList.add('popup-open');
};

function _initTownPopup() {
    const popup    = document.getElementById('town-popup');
    const closeBtn = document.getElementById('town-popup-close');
    if (!popup) return;
    const close = () => popup.classList.remove('popup-open');
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    document.addEventListener('mousedown', e => {
        if (popup.classList.contains('popup-open') && !popup.contains(e.target)) close();
    });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
// The JSON data bootstrap is exposed as LeonoriaData.loadAll() so the game
// shell (game-main.js) can await the same loading step. Idempotent.
let _leonoriaDataPromise = null;
function _loadLeonoriaData() {
    _leonoriaDataPromise ??= (async () => {
    const jsonFiles = [
        'data/map/midlander_settlements.json',          //  0
        'data/map/ancient_settlements.json',            //  1  (root key: secluded_settlements)
        'data/map/northerner_settlements.json',         //  2
        'data/map/wildmen_settlements.json',            //  3
        'data/map/ruins.json',                          //  4
        'data/map/waterways.json',                      //  5
        'data/map/map_regions.json',                    //  6
        'data/map/landmarks.json',                      //  7
        'data/map/biomes.json',                         //  8
        'data/cultures/cultures.json',                  //  9
        'data/map/importantlocations.json',             // 10
        'data/cultures/eras.json',                      // 11
        'data/map/lake_names.json',                     // 12
        'data/map/geographical_features.json',          // 13
        'data/map/greys_settlements.json',              // 14
        'data/map/dark_ones_settlements.json',          // 15
        'data/map/ice_archons_settlements.json',       // 16
        'data/map/oakpeople_settlements.json',          // 17
        'data/map/stone_folk_settlements.json',         // 18
        'data/map/swampbrood_settlements.json',         // 19
        'data/map/ashen_halfbreeds_settlements.json',   // 20
        'data/map/step_folk_settlements.json',          // 21
        'data/cultures/kingdoms.json',                  // 22
    ];
    try {
        const loaded = await Promise.all(jsonFiles.map(p => fetch(p).then(r => r.json())));
        FantasyMap.setData({
            midlander_settlements:      loaded[0].midlander_settlements,
            secluded_settlements:       loaded[1].secluded_settlements,
            northerner_settlements:     loaded[2].northerner_settlements,
            wildmen_settlements:        loaded[3].wildmen_settlements,
            ruins:                      loaded[4].ruins,
            waterways:                  loaded[5].waterways,
            regions:                    loaded[6].regions,
            landmarks:                  loaded[7].landmarks,
            biomes:                     loaded[8].biomes,
            lakes:                      loaded[12]?.lakes ?? [],
            geographical_features:      loaded[13]?.terrain ?? {},
            greys_settlements:          loaded[14].greys_settlements,
            dark_ones_settlements:      loaded[15].dark_ones_settlements,
            ice_archons_settlements:   loaded[16].ice_archons_settlements,
            oakpeople_settlements:      loaded[17].oakpeople_settlements,
            stone_folk_settlements:     loaded[18].stone_folk_settlements,
            swampbrood_settlements:     loaded[19].swampbrood_settlements,
            ashen_halfbreeds_settlements: loaded[20].ashen_halfbreeds_settlements,
            step_folk_settlements:      loaded[21].step_folk_settlements,
        });
        const cultures = loaded[9]?.world_database?.cultures ?? [];
        window._leonoriaCultures = cultures;
        window._leonoriaBiomes = loaded[8]?.biomes ?? [];
        // Prefer a culture entry whose `race` is Midlander as a sensible
        // Midlands fallback. If none found, fall back to the first loaded
        // culture or null.
        window._leonoriaMidlanderCulture     = cultures.find(c => String(c.race).toLowerCase() === 'midlander')
            || cultures.find(c => (c.id && c.id.toLowerCase().includes('midland'))) || cultures[0] || null;
        window._leonoriaMidlanderSettlements = loaded[0].midlander_settlements ?? null;
        window._leonoriaRuinsData        = loaded[4].ruins ?? null;
        window._leonoriaLocationsData    = loaded[10]?.locations ?? [];
        window._leonoriaErasData         = Array.isArray(loaded[11]) ? loaded[11] : [];
        window._leonoriaKingdoms         = loaded[22]?.kingdoms ?? [];
    } catch (e) {
        console.warn('[Leonoria] JSON data unavailable, using built-in defaults', e);
    }
    })();
    return _leonoriaDataPromise;
}
window.LeonoriaData = { loadAll: _loadLeonoriaData };

window.addEventListener('DOMContentLoaded', async () => {
    await _loadLeonoriaData();
    _initTownPopup();
    // game.html (data-page="game") boots via game-main.js — the settings-panel
    // Game shell only runs on map.html.
    if (document.body.dataset.page !== 'game') new Game();
});
