// map.js — Leonoria procedural fantasy map — HeightMap core with layered value noise
(function () {
'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// PARAMETERS — tweak to change map character
// ═══════════════════════════════════════════════════════════════════════════════
const SEA_LEVEL  = 0.42;   // 0–1  raise = more ocean, lower = more land
const CONTINENT  = 0.65;   // 0 = scattered archipelago → 1 = large continent
const RUGGEDNESS = 0.55;   // 0 = gentle rolling hills  → 1 = jagged peaks

// ── Biome rendering presets ───────────────────────────────────────────────────
// Each preset is used when no JSON biome data is available (fallback),
// and to supply the sea colour which is not in the JSON.
// landLow/Mid/High are [R,G,B] arrays for the three elevation bands.
const BIOME_PRESETS = {
    //                                                                                    wetland
    //                           landLow              landMid              landHigh             landMountain                seaColor       snowPeaks  Density
    the_midlands:        { landLow:[96, 154, 42],  landMid:[138,186, 78], landHigh:[168,206,112], landMountain:[180,190,155], seaColor:'#aaccdd', snowPeaks:false, wetlandDensity:0.04 },
    the_sanctuary_lands: { landLow:[50, 108, 45],  landMid:[ 85,148, 80], landHigh:[128,185,110], landMountain:[205,218,198], seaColor:'#88bbcc', snowPeaks:true,  wetlandDensity:0.03 },
    the_dark_forests:    { landLow:[50,  68, 52],  landMid:[ 75, 96, 72], landHigh:[110,126,108], landMountain:[152,160,148], seaColor:'#7799bb', snowPeaks:true,  wetlandDensity:0.12 },
    the_eternal_winds:   { landLow:[175,208,228],  landMid:[210,228,242], landHigh:[232,240,248], landMountain:[245,248,252], seaColor:'#4477aa', snowPeaks:true,  wetlandDensity:0.25 },
    the_badlands:        { landLow:[162, 98, 45],  landMid:[190,130, 68], landHigh:[214,165,100], landMountain:[178,148,118], seaColor:'#997755', snowPeaks:false, wetlandDensity:0.00 },
    the_outer_steppes:   { landLow:[145,155, 85],  landMid:[172,178,112], landHigh:[198,200,142], landMountain:[185,182,162], seaColor:'#aabbcc', snowPeaks:false, wetlandDensity:0.01 },
    the_blinding_lands:  { landLow:[175,168, 95],  landMid:[200,192,118], landHigh:[218,208,145], landMountain:[192,182,162], seaColor:'#aabbcc', snowPeaks:false, wetlandDensity:0.00 },
    the_gleam_havens:    { landLow:[140,162, 65],  landMid:[172,188,100], landHigh:[202,202,130], landMountain:[195,188,168], seaColor:'#55aacc', snowPeaks:false, wetlandDensity:0.04 },
    the_boglands:        { landLow:[ 48, 88, 48],  landMid:[ 75,118, 72], landHigh:[108,150, 98], landMountain:[148,155,132], seaColor:'#558866', snowPeaks:false, wetlandDensity:0.38 },
    the_forgotten_kingdom:{ landLow:[38, 22, 58],  landMid:[ 62, 48, 88], landHigh:[ 92, 78,118], landMountain:[ 28, 18, 44], seaColor:'#1a0a2a', snowPeaks:false, wetlandDensity:0.08 },
};

// ── JSON data store (populated via FantasyMap.setData before generation) ─────
let _mapData = null;

// ── Seeded PRNG (Mulberry32) ──────────────────────────────────────────────────
function mkRng(seed) {
    let s = seed >>> 0;
    return () => {
        s += 0x6D2B79F5;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ── SVG helpers ───────────────────────────────────────────────────────────────
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
}

// Catmull-Rom → SVG cubic bezier path (open)
function catmullPath(pts) {
    if (pts.length < 2) return '';
    const f = n => n.toFixed(1);
    let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${f(cp1x)} ${f(cp1y)} ${f(cp2x)} ${f(cp2y)} ${f(p2.x)} ${f(p2.y)}`;
    }
    return d;
}

// Catmull-Rom → SVG cubic bezier path (closed polygon — wraps around smoothly)
function closedCatmullPath(pts) {
    if (pts.length < 3) return '';
    const f = n => n.toFixed(1);
    const n = pts.length;
    let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
    for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        const p3 = pts[(i + 2) % n];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${f(cp1x)} ${f(cp1y)} ${f(cp2x)} ${f(cp2y)} ${f(p2.x)} ${f(p2.y)}`;
    }
    d += ' Z';
    return d;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEIGHT MAP — layered value noise with hash-based random, no lookup tables
// ═══════════════════════════════════════════════════════════════════════════════
class HeightMap {
    constructor(cols, rows, seed, seaLevel = 0.42, mountainOffset = 0.28, continent = CONTINENT, ruggedness = RUGGEDNESS, edgeSink = 0, edgeSinkStart = 0.0, islandSeeds = 0, bigIsland = false) {
        this.cols           = cols;
        this.rows           = rows;
        this.seaLevel       = seaLevel;
        this.mountainOffset = mountainOffset;
        this.continent      = continent;
        this.ruggedness     = ruggedness;
        this.edgeSink       = edgeSink;
        this.edgeSinkStart  = edgeSinkStart;
        this.islandSeeds    = islandSeeds;
        this.bigIsland      = bigIsland;
        this._seed = seed >>> 0;
        this._build();
    }

    // Hash-based random value at integer grid coord (no pre-generated tables)
    _hash(ix, iy, octave) {
        let h = (this._seed * 2654435761) ^ (ix * 374761393) ^ (iy * 668265263) ^ (octave * 1000003);
        h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
        h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }

    // Bilinear interpolation with smoothstep
    _sample(ox, oy, oct) {
        const ix = Math.floor(ox), iy = Math.floor(oy);
        const fx = ox - ix, fy = oy - iy;
        const ux = fx * fx * (3 - 2 * fx);
        const uy = fy * fy * (3 - 2 * fy);
        const v00 = this._hash(ix,   iy,   oct);
        const v10 = this._hash(ix+1, iy,   oct);
        const v01 = this._hash(ix,   iy+1, oct);
        const v11 = this._hash(ix+1, iy+1, oct);
        return v00*(1-ux)*(1-uy) + v10*ux*(1-uy) + v01*(1-ux)*uy + v11*ux*uy;
    }

    _build() {
        const { cols, rows } = this;
        // ruggedness drives octave count (4–8) and persistence (0.38–0.66)
        const octaves     = 4 + Math.round(this.ruggedness * 4);
        const persistence = 0.38 + this.ruggedness * 0.28;
        const baseFreq    = 3.5;   // noise cycles across the map at octave 0

        const raw = new Float32Array(cols * rows);

        // Accumulate fBm octaves
        for (let o = 0; o < octaves; o++) {
            const freq = baseFreq * Math.pow(2, o);
            const amp  = Math.pow(persistence, o);
            for (let r = 0; r < rows; r++) {
                const ny = r / (rows - 1) * freq;
                for (let c = 0; c < cols; c++) {
                    raw[r * cols + c] += this._sample(c / (cols - 1) * freq, ny, o) * amp;
                }
            }
        }

        // ── Elevation bias ────────────────────────────────────────────────────────
        // bigIsland, islandSeeds, and continent are mutually exclusive.
        // The edge sink is applied after all biases; bigIsland may override its strength.
        let appliedEdgeSink      = this.edgeSink;
        let appliedEdgeSinkStart = this.edgeSinkStart;

        if (this.bigIsland) {
            // Deterministic hash — different namespace from octave hash
            const hf = n => {
                let h = (this._seed * 1234567891) ^ (n * 374761393);
                h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
                h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
                return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
            };
            const aspect = cols / rows; // ~1.33

            // Reusable helpers
            const addDome = (ax, ay, rad, str) => {
                for (let r = 0; r < rows; r++)
                    for (let c = 0; c < cols; c++) {
                        const f = Math.max(0, 1 - Math.hypot((c/(cols-1) - ax)*aspect, r/(rows-1) - ay) / rad);
                        raw[r*cols+c] += f*f*str;
                    }
            };
            const addRing = (ax, ay, ringR, ringW, str) => {
                for (let r = 0; r < rows; r++)
                    for (let c = 0; c < cols; c++) {
                        const dist = Math.hypot((c/(cols-1) - ax)*aspect, r/(rows-1) - ay);
                        const f = Math.max(0, 1 - Math.abs(dist - ringR) / ringW);
                        raw[r*cols+c] += f*f*str;
                    }
            };

            // Edge exposure: 25 % of seeds the island sprawls to/beyond the map border.
            // 35 % get a gentle sink — land gets very close but a thin ocean ring remains.
            // 40 % get the full preset edge sink — clear ocean surrounds the island.
            const edgeRoll = hf(997);
            if      (edgeRoll < 0.25) { appliedEdgeSink = 0.0; }
            else if (edgeRoll < 0.60) { appliedEdgeSink = 0.75; appliedEdgeSinkStart = 0.72; }
            // else: keep preset values

            // Island centre — slightly off-centre for organic feel
            const cx = 0.42 + hf(994)*0.16;
            const cy = 0.42 + hf(993)*0.16;

            // Shape variant (0-3) driven by the seed
            const sv = Math.floor(hf(992)*4);

            if (sv === 0) {
                // ── Irregular dome ─────────────────────────────────────────────
                // Moderate strength: noise carves bays, peninsulas, inlets.
                addDome(cx, cy, 0.36 + hf(991)*0.10, 0.46 + hf(990)*0.12);

            } else if (sv === 1) {
                // ── Elongated / figure-eight ───────────────────────────────────
                // Two offset lobes create kidney, peanut, or figure-8 shapes.
                const angle  = hf(989)*Math.PI;
                const offset = 0.11 + hf(988)*0.08;
                const lRad1  = 0.27 + hf(987)*0.07;
                const lRad2  = 0.24 + hf(986)*0.07;
                addDome(cx + Math.cos(angle)*offset/aspect, cy + Math.sin(angle)*offset, lRad1, 0.65);
                addDome(cx - Math.cos(angle)*offset/aspect, cy - Math.sin(angle)*offset, lRad2, 0.65);

            } else if (sv === 2) {
                // ── Main island + 2-4 satellites ──────────────────────────────
                addDome(cx, cy, 0.28 + hf(985)*0.06, 0.80);
                const nSat = 2 + Math.floor(hf(984)*3);
                for (let i = 0; i < nSat; i++) {
                    const ang  = hf(970+i)*Math.PI*2;
                    const dist = 0.22 + hf(960+i)*0.18;
                    addDome(cx + Math.cos(ang)*dist/aspect, cy + Math.sin(ang)*dist,
                            0.07 + hf(950+i)*0.10, 0.52 + hf(940+i)*0.24);
                }

            } else {
                // ── Atoll / horseshoe ──────────────────────────────────────────
                const ringR = 0.17 + hf(983)*0.11;
                const ringW = 0.07 + hf(982)*0.04;
                addRing(cx, cy, ringR, ringW, 0.98);
                // 50 % chance of a horseshoe break (one arc sunk)
                if (hf(981) < 0.5) {
                    const bAngle = hf(980)*Math.PI*2;
                    const bx = cx + Math.cos(bAngle)*ringR/aspect;
                    const by = cy + Math.sin(bAngle)*ringR;
                    for (let r = 0; r < rows; r++)
                        for (let c = 0; c < cols; c++) {
                            const f = Math.max(0, 1 - Math.hypot((c/(cols-1)-bx)*aspect, r/(rows-1)-by) / (ringW*2.0));
                            raw[r*cols+c] -= f*f*0.85;
                        }
                }
                // Tiny central islet / lagoon fringe
                addDome(cx, cy, 0.06 + hf(979)*0.04, 0.35);
            }

            // Extra tiny islands (all variants) — scatter 1-3 small landmasses
            const nTiny = 1 + Math.floor(hf(930)*3);
            for (let i = 0; i < nTiny; i++) {
                addDome(0.10 + hf(920+i)*0.80, 0.10 + hf(910+i*3)*0.80,
                        0.035 + hf(900+i)*0.045, 0.40);
            }

        } else if (this.islandSeeds > 0) {
            // ── Archipelago: deterministic island seeds ────────────────────────
            const hf = n => {
                let h = (this._seed * 2654435761) ^ (n * 374761393);
                h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
                h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
                return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
            };
            const margin  = 0.26;
            const aspect  = cols / rows;
            const minSep  = 0.22;
            const centres = [];
            for (let i = 0; i < this.islandSeeds; i++) {
                const medium = i < 3;
                let x, y, tries = 0;
                do {
                    x = margin + hf(i*11 + tries*7 + 1) * (1 - 2*margin);
                    y = margin + hf(i*11 + tries*7 + 2) * (1 - 2*margin);
                    tries++;
                } while (tries < 25 && centres.some(p => Math.hypot((x-p.x)*aspect, y-p.y) < minSep));
                centres.push({
                    x, y,
                    radius:   medium ? 0.18 + hf(i*11+3)*0.08 : 0.09 + hf(i*11+3)*0.05,
                    strength: medium ? 1.1 : 0.75,
                });
            }
            for (let r = 0; r < rows; r++)
                for (let c = 0; c < cols; c++) {
                    const nx = c/(cols-1), ny = r/(rows-1);
                    let boost = 0;
                    for (const p of centres) {
                        const f = Math.max(0, 1 - Math.hypot((nx-p.x)*aspect, ny-p.y) / p.radius);
                        boost = Math.max(boost, f*f*p.strength);
                    }
                    raw[r*cols+c] += boost;
                }

        } else {
            // ── Standard continent bias: radial dome toward centre ─────────────
            for (let r = 0; r < rows; r++)
                for (let c = 0; c < cols; c++) {
                    const dx = (c/(cols-1))*2 - 1;
                    const dy = (r/(rows-1))*2 - 1;
                    const d  = Math.min(1, Math.hypot(dx, dy));
                    raw[r*cols+c] += (1 - d*d) * this.continent * 0.45;
                }
        }

        // ── Edge sink (uses effective values — bigIsland may have overridden them) ──
        if (appliedEdgeSink > 0) {
            const startD = Math.min(0.99, appliedEdgeSinkStart);
            const range  = 1.0 - startD;
            for (let r = 0; r < rows; r++)
                for (let c = 0; c < cols; c++) {
                    const dx = (c/(cols-1))*2 - 1;
                    const dy = (r/(rows-1))*2 - 1;
                    const d  = Math.min(1, Math.hypot(dx, dy));
                    const ef = Math.max(0, d - startD) / range;
                    raw[r*cols+c] -= ef*ef*appliedEdgeSink;
                }
        }

        // Normalize to [0, 1]
        let lo = Infinity, hi = -Infinity;
        for (const v of raw) { if (v < lo) lo = v; if (v > hi) hi = v; }
        const span = hi - lo || 1;
        for (let i = 0; i < raw.length; i++) raw[i] = (raw[i] - lo) / span;

        this.data = raw;
    }

    get(c, r) {
        if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return 0;
        return this.data[r * this.cols + c];
    }

    isLand(c, r)      { return this.get(c, r) > this.seaLevel; }
    isMountain(c, r)  { return this.get(c, r) > this.seaLevel + this.mountainOffset; }
    isHighPeak(c, r)  { return this.get(c, r) > this.seaLevel + this.mountainOffset + 0.16; }

    // Six hex neighbours for odd-r offset pointy-topped grid
    _hexNeighbors(c, r) {
        const d = r & 1; // 1 on odd rows
        return [
            [c+1,   r  ], [c-1,   r  ],   // E, W
            [c+d,   r-1], [c+d-1, r-1],   // NE, NW
            [c+d,   r+1], [c+d-1, r+1],   // SE, SW
        ];
    }

    isCoast(c, r) {
        if (!this.isLand(c, r)) return false;
        return this._hexNeighbors(c, r).some(([nc, nr]) => !this.isLand(nc, nr));
    }

    // Steepest-descent flow direction for river tracing (6-dir hex)
    flowDir(c, r) {
        let minH = this.get(c, r);
        let best = null;
        for (const [nc, nr] of this._hexNeighbors(c, r)) {
            if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) return [nc - c, nr - r];
            const h = this.get(nc, nr);
            if (h < minH) { minH = h; best = [nc - c, nr - r]; }
        }
        return best || [0, 1];
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAP SAVE STORE — persists the chosen export folder handle in IndexedDB so the
// user only needs to pick it once.  Also tracks the last exported map.
// ═══════════════════════════════════════════════════════════════════════════════
const MapSaveStore = (() => {
    const DB_NAME  = 'LeonoriaMapSave';
    const ST_NAME  = 'handles';
    const DIR_KEY  = 'exportDir';

    function _open() {
        return new Promise((res, rej) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = e => e.target.result.createObjectStore(ST_NAME);
            req.onsuccess = e => res(e.target.result);
            req.onerror   = e => rej(e.target.error);
        });
    }

    async function storeHandle(handle) {
        const db = await _open();
        return new Promise((res, rej) => {
            const tx = db.transaction(ST_NAME, 'readwrite');
            tx.objectStore(ST_NAME).put(handle, DIR_KEY);
            tx.oncomplete = res;
            tx.onerror    = e => rej(e.target.error);
        });
    }

    async function loadHandle() {
        try {
            const db = await _open();
            return new Promise((res, rej) => {
                const tx  = db.transaction(ST_NAME, 'readonly');
                const req = tx.objectStore(ST_NAME).get(DIR_KEY);
                req.onsuccess = e => res(e.target.result ?? null);
                req.onerror   = e => rej(e.target.error);
            });
        } catch { return null; }
    }

    async function clearHandle() {
        const db = await _open();
        return new Promise((res, rej) => {
            const tx = db.transaction(ST_NAME, 'readwrite');
            tx.objectStore(ST_NAME).delete(DIR_KEY);
            tx.oncomplete = res;
            tx.onerror    = e => rej(e.target.error);
        });
    }

    return { storeHandle, loadHandle, clearHandle, lastSaved: null };
})();

// Write a string to a file inside a FileSystemDirectoryHandle.
async function _writeFile(dirHandle, name, content) {
    const fh     = await dirHandle.getFileHandle(name, { create: true });
    const writer = await fh.createWritable();
    await writer.write(content);
    await writer.close();
}

// Fallback: trigger a browser download.
function _download(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FANTASY MAP
// ═══════════════════════════════════════════════════════════════════════════════
class FantasyMap {
    constructor(container, seed, params = {}) {
        this.container = container;
        this.seed = seed != null ? seed : (Math.random() * 0xFFFFFFFF | 0);
        this.scale  = params.scale  ?? 1;
        this.params = params;
        this._rng   = mkRng(this.seed);
    }

    r(a, b)   { return a + this._rng() * (b - a); }
    ri(a, b)  { return Math.floor(this.r(a, b + 0.999)); }
    pick(arr) { return arr[this.ri(0, arr.length - 1)]; }
    jit(v, a) { return v + this.r(-a, a); }

    // Build a shuffled name pool from one or more _mapData paths, fall back if unavailable
    _pool(paths, fallback) {
        const arr = [];
        const nameSource = Object.create(null);
        if (_mapData) {
            for (const p of paths) {
                let node = _mapData;
                for (const k of p.split('.')) node = node?.[k];
                if (Array.isArray(node)) {
                    for (const n of node) {
                        arr.push(n);
                        try { nameSource[String(n)] = String(p); } catch (e) {}
                    }
                }
            }
        }
        const src = arr.length >= 4 ? arr : fallback;
        const out = [...src];
        // If using fallback, mark sources as fallback for traceability
        if (arr.length < 4) {
            for (const n of out) try { nameSource[String(n)] = 'fallback'; } catch (e) {}
        }
        for (let i = out.length - 1; i > 0; i--) {
            const j = this.ri(0, i);
            [out[i], out[j]] = [out[j], out[i]];
        }
        // Attach metadata: overall first-path source (best-effort) and a
        // per-name source map so consumers can determine which pool a
        // particular name originated from (important for mixed pools).
        try { out._poolSource = paths && paths.length ? String(paths[0]) : null; } catch (e) { out._poolSource = null; }
        try { out._nameSourceMap = nameSource; } catch (e) { out._nameSourceMap = {}; }
        return out;
    }

    generate() {
        // Reset rng so same seed always produces identical map
        this._rng = mkRng(this.seed);
        this._riverLabelData = [];

        const { container } = this;
        container.innerHTML = '';

        // Integer dimensions ensure canvas pixels map 1:1 to SVG units.
        // Non-integer clientWidth (HiDPI / fractional zoom) would cause the browser
        // to scale each canvas image, shifting the land fill relative to the coastline.
        const W = Math.round(container.clientWidth  || window.innerWidth);
        const H = Math.round(container.clientHeight || window.innerHeight);

        const sc    = this.scale;
        const COLS  = 72 * sc;
        const sqrt3 = Math.sqrt(3);
        const hexW  = W / COLS;          // column width (hex flat-to-flat width / sqrt(3)*2)
        const hexR  = hexW / sqrt3;      // circumradius (vertex to center)
        const rowH  = 1.5 * hexR;        // vertical row spacing (center to center)
        const ROWS  = Math.ceil((H - hexR) / rowH) + 2;
        const cw = hexW, ch = rowH;      // legacy aliases used by some draw helpers

        // Hex center in SVG units — odd-r offset, pointy-topped
        const hexCenter = (q, r) => ({
            x: hexW * (q + 0.5 + 0.5 * (r & 1)),
            y: hexR + r * rowH,
        });
        // SVG polygon points string for a hex cell
        const hexPoly = (q, r) => {
            const {x, y} = hexCenter(q, r);
            const pts = [];
            for (let i = 0; i < 6; i++) {
                const a = Math.PI / 6 + i * Math.PI / 3;
                pts.push(`${(x + hexR * Math.cos(a)).toFixed(1)},${(y + hexR * Math.sin(a)).toFixed(1)}`);
            }
            return pts.join(' ');
        };
        // Store on instance for use in all draw methods
        this.hexCenter = hexCenter;
        this.hexPoly   = hexPoly;
        this.hexR      = hexR;
        this.hexW      = hexW;
        this.rowH      = rowH;

        // Resolve generation parameters — all have sensible defaults
        const P = this.params;
        const seaLevel       = P.seaLevel       ?? SEA_LEVEL;
        const mountainOffset = P.mountainOffset ?? 0.28;
        const continent      = P.continent      ?? CONTINENT;
        const ruggedness     = P.ruggedness     ?? RUGGEDNESS;
        const edgeSink       = P.edgeSink       ?? 0;
        const edgeSinkStart  = P.edgeSinkStart  ?? 0.0;
        const islandSeeds    = P.islandSeeds    ?? 0;
        const bigIsland      = P.bigIsland      ?? false;
        this.SL = seaLevel; // shorthand used by draw methods

        // Biome preset — JSON data takes precedence, JS fallback otherwise
        const biomeId = P.biome ?? 'the_midlands';
        let biomePalette = BIOME_PRESETS[biomeId] ?? BIOME_PRESETS.the_midlands;
        if (_mapData?.biomes) {
            const jb = _mapData.biomes.find(b => b.id === biomeId);
            if (jb?.visual) {
                // Spread JSON visual on top of JS preset — preserves landMountain,
                // wetlandDensity, and any other preset fields not in the JSON.
                biomePalette = { ...biomePalette, ...jb.visual };
            }
        }
        this.biomePalette = biomePalette;
        this.biomeId      = biomeId;
        this.culture      = P.culture ?? 'midlander';

        // Store full biome data object for the legend and other consumers
        this.biomeData = _mapData?.biomes?.find(b => b.id === biomeId) ?? null;

        // Wetland density: JSON takes precedence, fallback to preset
        this.wetlandDensity = this.biomeData?.wetlandDensity
            ?? biomePalette.wetlandDensity
            ?? 0;

        // Active terrain textures — used by the legend and by _drawTerrainMarks
        this.terrainTextures = this._activeTextures(biomeId, this.wetlandDensity);

        // HeightMap uses a scrambled seed so it's independent of the feature rng
        const hm = new HeightMap(COLS, ROWS, this.seed ^ 0xABCDEF12, seaLevel, mountainOffset, continent, ruggedness, edgeSink, edgeSinkStart, islandSeeds, bigIsland);

        // Midlands: reduce mountainous terrain by exactly 40%.
        // Sort all cells above the mountain threshold by elevation (lowest first),
        // then push the bottom 40% just below the threshold → they become high
        // farmland instead.  Only the steepest peaks remain mountainous.
        if (biomeId === 'the_midlands') {
            const data = hm.data;
            const mtnThresh = seaLevel + mountainOffset;
            const mtnIdx = [];
            for (let i = 0; i < data.length; i++)
                if (data[i] > mtnThresh) mtnIdx.push(i);
            mtnIdx.sort((a, b) => data[a] - data[b]);
            const reduce = Math.floor(mtnIdx.length * 0.40);
            for (let i = 0; i < reduce; i++)
                data[mtnIdx[i]] = mtnThresh - 0.01;
        }

        // Outer Steppes: cap mountainous terrain at 10% of total land area.
        // Count land and mountain cells; push the lowest-elevation mountain cells
        // below the threshold until mountains are at most 10% of land.
        if (biomeId === 'the_outer_steppes') {
            const data = hm.data;
            const mtnThresh = seaLevel + mountainOffset;
            let landCount = 0;
            const mtnIdx = [];
            for (let i = 0; i < data.length; i++) {
                if (data[i] > seaLevel) landCount++;
                if (data[i] > mtnThresh) mtnIdx.push(i);
            }
            mtnIdx.sort((a, b) => data[a] - data[b]);
            const maxMtn = Math.floor(landCount * 0.10);
            const reduce = Math.max(0, mtnIdx.length - maxMtn);
            for (let i = 0; i < reduce; i++)
                data[mtnIdx[i]] = mtnThresh - 0.01;
        }

        // Boglands biome: compress inland terrain to keep most land flat and low,
        // but preserve the near-coast gradient band so marching squares can
        // produce smooth organic coastlines (not boxy grid-snapped edges).
        if (biomeId === 'the_boglands') {
            const data = hm.data;
            const COAST_BAND = 0.10; // lf below this is kept as-is for smooth coasts
            for (let i = 0; i < data.length; i++) {
                if (data[i] > seaLevel) {
                    const lf = (data[i] - seaLevel) / (1 - seaLevel);
                    let compressed;
                    if (lf <= COAST_BAND) {
                        compressed = lf; // preserve coastal gradient
                    } else {
                        const inland = (lf - COAST_BAND) / (1 - COAST_BAND);
                        compressed = COAST_BAND + Math.pow(inland, 3) * (1 - COAST_BAND);
                    }
                    data[i] = seaLevel + compressed * (1 - seaLevel);
                }
            }
        }

        const svg = el('svg', {
            width: W, height: H, viewBox: `0 0 ${W} ${H}`,
            style: 'display:block'
        }, container);

        this._buildDefs(svg);

        // Layer order: bottom → top
        const gSea     = el('g', {}, svg);
        const gLand    = el('g', {}, svg);
        const gTexture = el('g', {}, svg);           // terrain mark overlays, above land fill
        const gCoast   = el('g', {}, svg);
        const gHills   = el('g', {}, svg);           // above coast, below lakes
        const gLakes   = el('g', {}, svg);
        const gForests      = el('g', {}, svg);
        const gFarmland     = el('g', {}, svg);       // above forests so fields show over tree cover
        const gRivers  = el('g', {}, svg);            // above forests/farmland so rivers are always legible
        const gKingdoms = el('g', { id: 'kingdoms-overlay', style: 'display:none' }, svg); // kingdoms color overlay — toggled on/off
        const gMountBase    = el('g', {}, svg);       // mountain stipple texture — immediately behind mountain icons
        const gMounts  = el('g', {}, svg);                       // canvas-rendered — no SVG filter needed
        const gRoads   = el('g', { filter: 'url(#sk)' }, svg);
        const gBridges = el('g', {}, svg);
        const gIcons   = el('g', {}, svg);
        const gLabels  = el('g', {}, svg);
        const gDeco    = el('g', {}, svg);

        const gLandmarks = el('g', {}, svg);

        Object.assign(this, {
            W, H, cw, ch, hm, COLS, ROWS,
            gSea, gLand, gTexture, gCoast, gHills, gRivers, gLakes, gForests, gFarmland,
            gMountBase, gMounts, gRoads, gBridges, gIcons, gLabels, gDeco, gLandmarks, gKingdoms,
        });

        // Biome feature multipliers — read from JSON biome data if available
        let biomeMult = { forest:1, river:1, settlement:1, ruin:1, mountain:1 };
        const _jBiome = _mapData?.biomes?.find(b => b.id === biomeId);
        if (_jBiome?.featureMult) biomeMult = { ...biomeMult, ..._jBiome.featureMult };
        // Special case: inland maps on Dark Forests get Sanctuary-level forest coverage
        if (this.params.mapType === 'inland' && biomeId === 'the_dark_forests') {
            biomeMult.forest = 6.0; // Match Sanctuary forest coverage
        }
        this.biomeMult = biomeMult;

        // Tree style — driven by biome JSON; fallback hardcoded map
        const _BIOME_TREE_STYLES = {
            the_midlands:         'broadleaf',
            the_sanctuary_lands:  'broadleaf',
            the_dark_forests:     'conifer',
            the_eternal_winds:    'conifer',
            the_badlands:         'palm',
            the_outer_steppes:    'conifer',
            the_blinding_lands:   'palm',
            the_gleam_havens:     'palm',
            the_boglands:         'swamp',
            the_forgotten_kingdom:'fungal',
        };
        this.treeStyle = _jBiome?.treeStyle ?? _BIOME_TREE_STYLES[biomeId] ?? 'broadleaf';

        // ── Generate data ────────────────────────────────────────────────────
        const { rivers, lakes } = this._genRivers();
        // Expose lakes early so _genSettlements and _terrainPath can exclude them
        this.lakes = lakes;
        // River cell exclusion set (radius 1) — prevents trees and mountain symbols
        // from rendering on top of river paths.
        {
            const riverCells = new Set();
            const cols = hm.cols;
            for (const { path } of rivers) {
                for (const { c: rc, r: rr } of path) {
                    for (let dr = -1; dr <= 1; dr++)
                        for (let dc = -1; dc <= 1; dc++)
                            riverCells.add((rr + dr) * cols + (rc + dc));
                }
            }
            this.riverCells = riverCells;
        }
        // Lake cell exclusion set — radius 4 around each lake center.
        // Used to prevent trees from being drawn over lake water areas.
        {
            const lakeCells = new Set();
            const cols = hm.cols, rows = hm.rows;
            const R = 4, R2 = R * R;
            for (const { c: lc, r: lr } of lakes) {
                for (let dr = -R; dr <= R; dr++)
                    for (let dc = -R; dc <= R; dc++)
                        if (dc * dc + dr * dr <= R2) {
                            const nc = lc + dc, nr = lr + dr;
                            if (nc >= 0 && nc < cols && nr >= 0 && nr < rows)
                                lakeCells.add(nr * cols + nc);
                        }
            }
            this.lakeCells = lakeCells;
        }
        // Swamp patches for lush/forested biomes — low land near water features
        this.swampCells = (['the_midlands', 'the_dark_forests', 'the_sanctuary_lands'].includes(biomeId))
            ? this._genSwampCells(rivers, lakes) : new Set();
        const forests   = this._genForests(rivers);
        const peaks          = this._genPeaks();
        const mountainChains = this._genMountainChains();
        this.mountainChains  = mountainChains;
        const forestAreas    = this._genForestAreas(forests);
        this.forestAreas     = forestAreas;
        const hills     = this._genHills();
        // Must be assigned before _genSettlements so inForest() works correctly
        // for terrain-restricted secondary culture placement.
        this.forests    = forests;
        const settles   = this._genSettlements(rivers);
        // Separate landmarks from actual settlements (landmarks are never settlements)
        const actualSettlements = settles.filter(s => s.type !== 'ruin' && s.type !== 'stronghold');
        const placedLandmarks = settles.filter(s => s.type === 'ruin' || s.type === 'stronghold')
            .map(lm => ({
                ...lm,
                category: lm.type === 'ruin' ? 'dungeon' : 'military'
                // NOTE: 'type' field preserved for legend generation
            }));

        this._assignKingdoms(actualSettlements);
        const roads     = this._genRoads(actualSettlements);
        this._buildMajorRoadCells(roads);
        const bridges   = []; // this._findBridges(roads, rivers);
        const landmarks = [...placedLandmarks, ...this._genLandmarks(actualSettlements)];
        // Expose for legend, saveMapData, and other external consumers
        this.settlements = actualSettlements;
        this.landmarks   = landmarks;
        this.rivers      = rivers;
        this.hasRivers   = rivers.length > 0;
        this.lakes       = lakes;
        this.hasLakes    = lakes.length > 0;
        this.hasForests  = forests.length > 0;
        this.hasPeaks    = peaks.length > 0;
        this.hasHills    = hills.length > 0;
        this.roadTypes   = [...new Set(roads.map(r => r.type))];

        // ── Draw ─────────────────────────────────────────────────────────────
        this._drawSea();
        this._drawLand();
        try { this._drawTerrainMarks(); } catch(e) { console.warn('[Leonoria] terrain marks skipped:', e); }
        // this._drawCoastline(); // coastline stroke removed per user request
        this._drawHills(hills);
        this._drawLakes(lakes);
        this._drawForestShade(forests);
        if (this.params.showTreeSymbols !== false) {
            this._drawForests(forests);
            if (this.treeStyle === 'conifer' || this.biomeId === 'the_midlands') this._drawBorealMarks(forests);
            if (this.treeStyle === 'broadleaf' || this.biomeId === 'the_midlands') this._drawBroadleafMarks(forests);
        }
        try { this._drawFarmland(settles, rivers); } catch(e) { console.error('[Leonoria] farmland error:', e); }
        this._drawRivers(rivers);
        this._drawMountainStipple();
        this._drawPeaks(peaks);
        this._drawRoads(roads);
        // this._drawBridges(bridges);
        // ── Label phase: single shared registry, highest priority first ────────
        // Each function checks the registry before drawing; later calls yield to
        // earlier ones when bounding boxes overlap.
        this._labelRegistry = [];
        this._drawKingdomsOverlay(settles);   // drawn into hidden gKingdoms group; toggled via button
        this._drawSettlements(settles);       // priority 1 — specific named places
        this._drawLandmarks(landmarks);       // priority 2 — points of interest
        this._drawMountainChainLabels(mountainChains); // priority 3
        this._drawForestAreaLabels(forestAreas);       // priority 4
        this._drawRiverLabels(rivers);        // priority 5 — river name along path
        this._drawLakeLabels(lakes);          // priority 6 — tries shifted positions
        this._drawBorder();
        this._drawCompass();
        this._drawTitle();

        // Auto-populate so HexGridManager works without a manual export
        MapSaveStore.lastSaved = {
            baseName: `leonoria_${this.seed.toString(16).padStart(8, '0')}`,
            jsonData: this._buildExportData(),
        };

        return svg;
    }

    // ── Defs — hand-drawn sketch filter ──────────────────────────────────────
    _buildDefs(svg) {
        const defs = el('defs', {}, svg);
        const f = el('filter', {
            id: 'sk', x: '-4%', y: '-4%', width: '108%', height: '108%'
        }, defs);
        el('feTurbulence', {
            type: 'fractalNoise', baseFrequency: '0.03 0.025',
            numOctaves: '3', seed: (this.seed % 97) + 1, result: 'n'
        }, f);
        el('feDisplacementMap', {
            in: 'SourceGraphic', in2: 'n',
            scale: '2.4', xChannelSelector: 'R', yChannelSelector: 'G'
        }, f);

        // Nameplate drop-shadow filter (crisp, no displacement)
        const ns = el('filter', {
            id: 'nps', x: '-8%', y: '-20%', width: '116%', height: '140%'
        }, defs);
        el('feDropShadow', {
            dx: '1', dy: '1.5', stdDeviation: '1.2', 'flood-color': '#2a1a08', 'flood-opacity': '0.35'
        }, ns);

        // Settlement icon rim gradient — dark green fading to transparent
        const rimGrad = el('radialGradient', {
            id: 'settlementRim', cx: '50%', cy: '50%', r: '50%'
        }, defs);
        el('stop', { offset: '0%', 'stop-color': '#1a4d1a', 'stop-opacity': '0' }, rimGrad);
        el('stop', { offset: '70%', 'stop-color': '#1a4d1a', 'stop-opacity': '0.6' }, rimGrad);
        el('stop', { offset: '100%', 'stop-color': '#1a4d1a', 'stop-opacity': '0' }, rimGrad);
    }

    // ── Sea background ────────────────────────────────────────────────────────
    _drawSea() {
        const { W, H, gSea } = this;
        const seaColor = this.biomePalette.seaColor ?? '#d0dce8';
        // Ocean base fill
        el('rect', { width: W, height: H, fill: seaColor }, gSea);

        // Decorative wave lines scattered in sea cells
        const { hm } = this;
        let d = '';
        for (let r = 1; r < hm.rows - 1; r += 3) {
            for (let c = 1; c < hm.cols - 1; c += 2) {
                if (hm.isLand(c, r)) continue;
                // Only cells that are at least 2 cells from land
                const nearLand = [
                    [2,0],[-2,0],[0,2],[0,-2],[2,2],[-2,2],[2,-2],[-2,-2]
                ].some(([dc, dr]) => hm.isLand(c+dc, r+dr));
                if (nearLand) continue;

                const {x: _wx, y: _wy} = this.hexCenter(c, r);
                const x = _wx + this.r(-0.4, 0.4) * this.hexW;
                const y = _wy + this.r(-0.3, 0.3) * this.rowH;
                const len = this.r(this.hexW * 0.5, this.hexW * 1.2);
                d += `M ${x.toFixed(1)} ${y.toFixed(1)} `;
                d += `q ${(len*0.25).toFixed(1)} ${this.r(-2,2).toFixed(1)} ${len.toFixed(1)} 0 `;
            }
        }
        if (d) el('path', {
            d, fill: 'none', stroke: '#a0b8c8',
            'stroke-width': '0.5', opacity: '0.6', filter: 'url(#sk)'
        }, gSea);
    }

    // ── Land fill — full-resolution per-pixel canvas ─────────────────────────
    // Every screen pixel is coloured by bilinear-sampling the heightmap.
    // Sea pixels are fully transparent so the gSea layer shows through.
    _drawLand() {
        const { gLand, hm, W, H } = this;
        const SL  = this.SL;
        const HMC = hm.cols, HMR = hm.rows;

        const pal  = this.biomePalette;
        const loR = pal.landLow[0],  loG = pal.landLow[1],  loB = pal.landLow[2];
        const miR = pal.landMid[0],  miG = pal.landMid[1],  miB = pal.landMid[2];
        const hiR = pal.landHigh[0], hiG = pal.landHigh[1], hiB = pal.landHigh[2];
        const mtPal = pal.landMountain ?? [
            Math.round(hiR * 0.78 + 162 * 0.22),
            Math.round(hiG * 0.78 + 158 * 0.22),
            Math.round(hiB * 0.78 + 152 * 0.22),
        ];
        const mtR = mtPal[0], mtG = mtPal[1], mtB = mtPal[2];

        // Land colour bands scale with mountainOffset so the grey rocky area matches
        // the actual isMountain() threshold.  With MO=0.28 (default) this is
        // identical to the old hardcoded values; with MO=0.38 the mountain colour
        // starts later, reflecting the smaller mountainous terrain area.
        const MO   = hm.mountainOffset;
        const BAND = MO / 2; // each non-mountain band is half the mountain offset
        const elevRGB = h => {
            const hn = h - SL;
            let R, G, B;
            if (hn >= MO + BAND) {
                R = mtR; G = mtG; B = mtB;
            } else if (hn >= MO) {
                const t = (hn - MO) / BAND;
                R = hiR + (mtR - hiR) * t; G = hiG + (mtG - hiG) * t; B = hiB + (mtB - hiB) * t;
            } else if (hn >= BAND) {
                const t = (hn - BAND) / BAND;
                R = miR + (hiR - miR) * t; G = miG + (hiG - miG) * t; B = miB + (hiB - miB) * t;
            } else {
                const t = hn / BAND;
                R = loR + (miR - loR) * t; G = loG + (miG - loG) * t; B = loB + (miB - loB) * t;
            }
            return [R|0, G|0, B|0];
        };

        // ── Full-resolution render — hex-space bilinear sampling ─────────────
        // Each screen pixel is mapped to fractional hex-grid coordinates using
        // the same odd-r formula as hexCenter(), so the land/sea boundary aligns
        // exactly with the hex cells that roads, rivers and icons also use.
        const hexW_ld = W / HMC;
        const hexR_ld = hexW_ld / Math.sqrt(3);
        const rowH_ld = 1.5 * hexR_ld;

        const canvas = document.createElement('canvas');
        canvas.width  = W;
        canvas.height = H;
        const ctx  = canvas.getContext('2d');
        const idat = ctx.createImageData(W, H);
        const buf  = idat.data;

        for (let py = 0; py < H; py++) {
            // Fractional hex row for this screen row
            const r_frac = (py - hexR_ld) / rowH_ld;
            const r0 = Math.max(0, Math.min(HMR - 2, Math.floor(r_frac)));
            const r1 = r0 + 1;
            const ty = Math.max(0, Math.min(1, r_frac - r0));

            for (let px = 0; px < W; px++) {
                const i = (py * W + px) * 4;

                // Fractional column per-row — each row has its own x-offset (odd-r)
                const c_frac0 = px / hexW_ld - 0.5 - 0.5 * (r0 & 1);
                const c_frac1 = px / hexW_ld - 0.5 - 0.5 * (r1 & 1);

                const c0a = Math.max(0, Math.min(HMC - 2, Math.floor(c_frac0)));
                const c0b = c0a + 1;
                const tx0 = Math.max(0, Math.min(1, c_frac0 - c0a));

                const c1a = Math.max(0, Math.min(HMC - 2, Math.floor(c_frac1)));
                const c1b = c1a + 1;
                const tx1 = Math.max(0, Math.min(1, c_frac1 - c1a));

                const h_r0 = hm.get(c0a, r0) * (1 - tx0) + hm.get(c0b, r0) * tx0;
                const h_r1 = hm.get(c1a, r1) * (1 - tx1) + hm.get(c1b, r1) * tx1;
                const h    = h_r0 * (1 - ty) + h_r1 * ty;

                // Transparent if below sea level AND at least one contributing
                // hex corner is actually sea — prevents blue holes in low inland valleys.
                if (h <= SL) {
                    const anySeaCorner = !hm.isLand(c0a, r0) || !hm.isLand(c0b, r0)
                                      || !hm.isLand(c1a, r1) || !hm.isLand(c1b, r1);
                    if (anySeaCorner) {
                        buf[i] = buf[i+1] = buf[i+2] = buf[i+3] = 0;
                        continue;
                    }
                }

                const [R, G, B] = elevRGB(Math.max(h, SL + 0.001));
                buf[i] = R; buf[i+1] = G; buf[i+2] = B; buf[i+3] = 255;
            }
        }

        ctx.putImageData(idat, 0, 0);
        el('image', { href: canvas.toDataURL('image/png'), x: 0, y: 0, width: W, height: H }, gLand);
    }

    // ── Terrain mark overlay — grass straws, reeds, scrub dots ───────────────
    // Drawn on gTexture (above gLand, below gCoast) as a single canvas image.
    // Only active for biomes that have these mark types; others return early.
    _drawTerrainMarks() {
        const { gTexture, hm, W, H } = this;
        const SL = this.SL;
        const biomeId = this.biomeId;

        // Grass straws on outer steppes/sanctuary lands — gleam havens uses dune ripple.
        // Midlands gets its own dense multi-colour straw texture (doPlainGrass).
        const doGrass           = biomeId === 'the_outer_steppes' || biomeId === 'the_sanctuary_lands';
        const doPlainGrass      = biomeId === 'the_midlands' || biomeId === 'the_dark_forests';
        const doReeds           = this.wetlandDensity > 0.08;
        const doScrub           = biomeId === 'the_badlands' || biomeId === 'the_blinding_lands';
        const doSwamp           = biomeId === 'the_boglands' || (this.swampCells?.size > 0);
        const doWetlandGrass    = !doSwamp && this.wetlandDensity > 0.05;
        const doForestGrass     = (this.treeStyle === 'conifer' || this.treeStyle === 'broadleaf' || biomeId === 'the_midlands') && (this.forests ?? []).length > 0;
        if (!doGrass && !doReeds && !doScrub && !doSwamp && !doWetlandGrass && !doForestGrass && !doPlainGrass) return;

        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(W);
        canvas.height = Math.round(H);
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        // ── Grass straws — tiny leaning vertical strokes on low land ──────────
        if (doGrass) {
            ctx.strokeStyle = '#706050';
            ctx.lineWidth   = 0.6;
            ctx.globalAlpha = 0.15;

            ctx.beginPath();
            for (let py = 5; py < canvas.height; py += 9) {
                for (let px = 5; px < canvas.width; px += 11) {
                    const c = Math.min(hm.cols-1, Math.max(0, Math.floor(px / this.hexW)));
                    const r = Math.min(hm.rows-1, Math.max(0, Math.floor((py - this.hexR) / this.rowH)));
                    if (!hm.isLand(c, r) || hm.isMountain(c, r)) continue;
                    const h = hm.get(c, r);
                    if (h > SL + 0.14 || h <= SL) continue;

                    let pn = ((px * 1013) ^ (py * 2017)) >>> 0;
                    pn = Math.imul(pn ^ (pn >>> 16), 0x45d9f3b) >>> 0;
                    const jx   = (pn & 7) - 3.5;
                    const jy   = ((pn >> 4) & 7) - 3.5;
                    const lean = (((pn >> 8) & 15) - 7.5) * 0.12;
                    const ht   = 3 + ((pn >> 12) & 2);

                    ctx.moveTo(px + jx,        py + jy + ht * 0.4);
                    ctx.lineTo(px + jx + lean, py + jy - ht * 0.6);
                }
            }
            ctx.stroke();
        }

        // ── Reed crosses — small + marks in wetland-adjacent very-low land ────
        if (doReeds) {
            ctx.strokeStyle = '#4a6040';
            ctx.lineWidth   = 0.55;
            ctx.globalAlpha = 0.18;

            ctx.beginPath();
            for (let py = 4; py < canvas.height; py += 8) {
                for (let px = 4; px < canvas.width; px += 9) {
                    const c = Math.min(hm.cols-1, Math.max(0, Math.floor(px / this.hexW)));
                    const r = Math.min(hm.rows-1, Math.max(0, Math.floor((py - this.hexR) / this.rowH)));
                    if (!hm.isLand(c, r)) continue;
                    const h = hm.get(c, r);
                    if (h > SL + 0.07 || h <= SL) continue;

                    let pn = ((px * 997) ^ (py * 2003)) >>> 0;
                    pn = Math.imul(pn ^ (pn >>> 16), 0x45d9f3b) >>> 0;
                    if ((pn & 3) !== 0) continue;

                    const jx = ((pn >> 4) & 7) - 3.5;
                    const jy = ((pn >> 8) & 7) - 3.5;
                    const s  = 2.5;
                    ctx.moveTo(px + jx - s, py + jy); ctx.lineTo(px + jx + s, py + jy);
                    ctx.moveTo(px + jx, py + jy - s); ctx.lineTo(px + jx, py + jy + s);
                }
            }
            ctx.stroke();
        }

        // ── Swamp marks — dense reed straws, randomly leaning, cartographic marsh ──
        // Each position spawns 1–4 individual reed straws with strong random lean,
        // variable height, and irregular spacing to feel hand-drawn and organic.
        if (doSwamp) {
            ctx.lineCap = 'round';

            // Helper: pixel → hex cell (odd-r pointy-top, matches hexCenter formula)
            const pxHex = (px, py) => {
                const r = Math.min(hm.rows-1, Math.max(0, Math.round((py - this.hexR) / this.rowH)));
                const c = Math.min(hm.cols-1, Math.max(0, Math.round(px / this.hexW - 0.5 - 0.5 * (r & 1))));
                return { c, r };
            };
            const onLand = (px, py) => {
                const { c, r } = pxHex(px, py);
                const h = hm.get(c, r);
                return hm.isLand(c, r) && !hm.isMountain(c, r) && h <= SL + 0.14 && h > SL;
            };
            const inSwampCell = (px, py) => {
                const { c, r } = pxHex(px, py);
                return this.swampCells?.has(r * hm.cols + c) ?? false;
            };
            const isSwampBiome = biomeId === 'the_boglands';

            // Two colour passes — dark near-black tones with high alpha for contrast
            const REED_PASSES = [
                { style: '#18261c', lw: 0.90, alpha: 0.80 },
                { style: '#1e2a14', lw: 0.70, alpha: 0.65 },
            ];

            for (const pass of REED_PASSES) {
                ctx.strokeStyle = pass.style;
                ctx.lineWidth   = pass.lw;
                ctx.globalAlpha = pass.alpha;
                ctx.beginPath();

                for (let py = 5; py < canvas.height; py += 8) {
                    for (let px = 5; px < canvas.width; px += 7) {
                        let pn = ((px * 977) ^ (py * 1979)) >>> 0;
                        pn = (Math.imul(pn ^ (pn >>> 16), 0x45d9f3b)) >>> 0;
                        if ((pn & 7) === 7) continue; // ~88% density

                        // Alternate between passes using position hash so colours intersperse
                        const passSlot = (pn >> 20) & 1;
                        if (passSlot !== REED_PASSES.indexOf(pass)) continue;

                        const bx = px + ((pn >> 4)  & 7) - 3.5;
                        const by = py + ((pn >> 8)  & 7) - 3.5;

                        const valid = isSwampBiome ? onLand(bx, by) : inSwampCell(bx, by);
                        if (!valid) continue;

                        // 1–4 reed straws per position, each independently randomised
                        const nReeds = 1 + ((pn >> 12) & 3);
                        for (let si = 0; si < nReeds; si++) {
                            const bits  = (pn >>> (si * 8 + 14)) >>> 0;
                            // Strong random lean: ±0.55 radians
                            const lean  = ((bits & 31) - 15.5) * 0.036;
                            // Spread reeds horizontally within a small cluster
                            const offx  = ((bits >> 5) & 7) - 3.5;
                            // Varied height 5–10 px
                            const len   = 5.0 + ((bits >> 8) & 7) * 0.72;
                            ctx.moveTo(bx + offx * 0.3,                        by);
                            ctx.lineTo(bx + offx + Math.sin(lean) * len, by - Math.cos(lean) * len);
                        }
                    }
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        // ── Wetland grass tufts — tiny sedge/reed clumps in non-swamp wet zones ──
        if (doWetlandGrass) {
            ctx.globalAlpha = 0.20;

            for (let py = 6; py < canvas.height; py += 15) {
                for (let px = 6; px < canvas.width; px += 16) {
                    const c = Math.min(hm.cols-1, Math.max(0, Math.floor(px / this.hexW)));
                    const r = Math.min(hm.rows-1, Math.max(0, Math.floor((py - this.hexR) / this.rowH)));
                    if (!hm.isLand(c, r)) continue;
                    const h = hm.get(c, r);
                    if (h > SL + 0.08 || h <= SL) continue;

                    let pn = ((px * 887) ^ (py * 1789)) >>> 0;
                    pn = Math.imul(pn ^ (pn >>> 16), 0x45d9f3b) >>> 0;
                    if ((pn & 255) > 50) continue; // ~20% density

                    const jx = ((pn >> 4) & 5) - 2.5;
                    const jy = ((pn >> 8) & 5) - 2.5;
                    const bx = px + jx, by = py + jy;

                    for (let si = 0; si < 3; si++) {
                        const offx = (si - 1) * 1.4;
                        const lean = offx * 0.30;
                        const ht   = 3.0 + (((pn >> (si * 3 + 16)) & 3) * 0.4);
                        ctx.strokeStyle = (si & 1) ? '#3a5a2a' : '#4a6838';
                        ctx.lineWidth   = 0.45;
                        ctx.beginPath();
                        ctx.moveTo(bx + offx, by);
                        ctx.lineTo(bx + offx + lean, by - ht);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.ellipse(bx + offx + lean, by - ht - 0.8, 0.5, 1.0, 0.15, 0, Math.PI * 2);
                        ctx.fillStyle = '#4a5c28';
                        ctx.fill();
                    }
                }
            }
            ctx.globalAlpha = 1;
        }

        // ── Forest floor grass — subtle straws beneath tree marks in forested cells ──
        if (doForestGrass) {
            // Build forest cell set once
            const fgSet = new Set();
            for (const { c: fc, r: fr, radius } of (this.forests ?? [])) {
                const R = Math.ceil(radius), R2 = radius * radius;
                for (let dr = -R; dr <= R; dr++)
                    for (let dc = -R; dc <= R; dc++)
                        if (dc*dc + dr*dr <= R2)
                            fgSet.add((fr+dr) * hm.cols + (fc+dc));
            }

            ctx.strokeStyle = this.treeStyle === 'conifer' ? '#504838' : '#485830';
            ctx.lineWidth   = 0.5;
            ctx.globalAlpha = 0.23; // was 0.13, +10% less transparent

            ctx.beginPath();
            for (let py = 3; py < canvas.height; py += 4) {
                for (let px = 3; px < canvas.width; px += 4) {
                    const c = Math.min(hm.cols-1, Math.max(0, Math.floor(px / this.hexW)));
                    const r = Math.min(hm.rows-1, Math.max(0, Math.floor((py - this.hexR) / this.rowH)));
                    if (!hm.isLand(c, r) || hm.isMountain(c, r) || hm.isCoast(c, r)) continue;
                    if (!fgSet.has(r * hm.cols + c)) continue;

                    let pn = ((px * 1013) ^ (py * 2017)) >>> 0;
                    pn = Math.imul(pn ^ (pn >>> 16), 0x45d9f3b) >>> 0;
                    if ((pn & 7) === 7) continue;

                    const jx   = ((pn >> 4) & 3) - 1.5;
                    const jy   = ((pn >> 8) & 3) - 1.5;
                    const lean = (((pn >> 12) & 15) - 7.5) * 0.10;
                    const ht   = (2.5 + ((pn >> 16) & 2)) * 0.9;

                    ctx.moveTo(px + jx,        py + jy + ht * 0.4);
                    ctx.lineTo(px + jx + lean, py + jy - ht * 0.6);
                }
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // ── Mountain stipple — tiny scattered dots on mountain terrain ──────────
        // Mountain stipple moved to _drawMountainStipple() → gMountBase layer

        // ── Scrub dots — small circles on desert/badland mid-elevation land ───
        if (doScrub) {
            ctx.strokeStyle = '#907050';
            ctx.lineWidth   = 0.5;
            ctx.globalAlpha = 0.13;

            ctx.beginPath();
            for (let py = 6; py < canvas.height; py += 13) {
                for (let px = 6; px < canvas.width; px += 14) {
                    const c = Math.min(hm.cols-1, Math.max(0, Math.floor(px / this.hexW)));
                    const r = Math.min(hm.rows-1, Math.max(0, Math.floor((py - this.hexR) / this.rowH)));
                    if (!hm.isLand(c, r) || hm.isMountain(c, r)) continue;

                    let pn = ((px * 991) ^ (py * 1997)) >>> 0;
                    pn = Math.imul(pn ^ (pn >>> 16), 0x45d9f3b) >>> 0;
                    if ((pn & 7) > 2) continue;

                    const jx = ((pn >> 4) & 7) - 3.5;
                    const jy = ((pn >> 8) & 7) - 3.5;
                    const r2 = 1.2 + (((pn >> 12) & 3) * 0.4);
                    ctx.arc(px + jx, py + jy, r2, 0, Math.PI * 2);
                }
            }
            ctx.stroke();
        }

        // ── Plains grass/straw texture — dense multi-colour straws on open land ──
        // Forests and farmland canvases are drawn on top of gTexture so they
        // naturally cover these straws — no explicit exclusion needed.
        if (doPlainGrass) {
            // Five colour groups, each batched into one beginPath/stroke call.
            // Weights: dark green ~40 %, mid green ~25 %, olive ~20 %, wheat ~10 %, yellow-green ~5 %.
            const STRAW_GROUPS = [
                { style: '#2e4a18', lw: 0.55, alpha: 0.72, mod: 10, pass: v => v < 4 },  // dark green  ~40%
                { style: '#3d5e24', lw: 0.50, alpha: 0.65, mod: 10, pass: v => v === 4 || v === 5 }, // mid green ~20%
                { style: '#4a5020', lw: 0.50, alpha: 0.60, mod: 10, pass: v => v === 6 || v === 7 }, // dark olive ~20%
                { style: '#7a6a38', lw: 0.45, alpha: 0.55, mod: 10, pass: v => v === 8  },           // wheat     ~10%
                { style: '#566030', lw: 0.45, alpha: 0.58, mod: 10, pass: v => v === 9  },           // yellow-green ~10%
            ];
            const stepX = 5, stepY = 6;

            for (const grp of STRAW_GROUPS) {
                ctx.strokeStyle = grp.style;
                ctx.lineWidth   = grp.lw;
                ctx.globalAlpha = grp.alpha;
                ctx.beginPath();
                for (let py = 3; py < canvas.height; py += stepY) {
                    for (let px = 3; px < canvas.width; px += stepX) {
                        const c = Math.min(hm.cols-1, Math.max(0, Math.floor(px / this.hexW)));
                        const r = Math.min(hm.rows-1, Math.max(0, Math.floor((py - this.hexR) / this.rowH)));
                        if (!hm.isLand(c, r) || hm.isMountain(c, r) || hm.isCoast(c, r)) continue;
                        if (this.riverCells?.has(r * hm.cols + c)) continue;
                        if (this.majorRoadCells?.has(r * hm.cols + c)) continue;

                        let pn = ((px * 1013) ^ (py * 2017)) >>> 0;
                        pn = (Math.imul(pn ^ (pn >>> 16), 0x45d9f3b)) >>> 0;
                        if (!grp.pass((pn >>> 0) % grp.mod)) continue;

                        const jx   = ((pn >> 4)  & 7) - 3.5;
                        const jy   = ((pn >> 8)  & 7) - 3.5;
                        const lean = (((pn >> 12) & 15) - 7.5) * 0.15;
                        const ht   = 2.5 + ((pn >> 16) & 3) * 0.5;

                        ctx.moveTo(px + jx,        py + jy + ht * 0.4);
                        ctx.lineTo(px + jx + lean, py + jy - ht * 0.6);
                    }
                }
                ctx.stroke();
            }
        }

        ctx.globalAlpha = 1;
        el('image', { href: canvas.toDataURL('image/png'), x: 0, y: 0, width: W, height: H }, gTexture);
    }

    // ── Mountain stipple — own canvas in gMountBase, immediately behind gMounts ─
    _drawMountainStipple() {
        const { gMountBase, hm, W, H } = this;
        const hexW = this.hexW, hexR = this.hexR, rowH = this.rowH;
        // Biome mountain terrain coverage — cells are randomly skipped so the
        // visible mountainous terrain area scales with mountainMult (< 1 = less area)
        const mountainMult = this.biomeMult?.mountain ?? 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(W); canvas.height = Math.round(H);
        const ctx = canvas.getContext('2d');

        // ── Background scatter dots ────────────────────────────────────────────
        ctx.fillStyle   = '#504030';
        ctx.globalAlpha = 0.22;
        // Step size scales inversely with mountainMult so denser biomes get more dots
        const dotStepY = Math.max(3, Math.round(5 / Math.max(1, mountainMult)));
        const dotStepX = Math.max(3, Math.round(6 / Math.max(1, mountainMult)));
        for (let py = 4; py < canvas.height; py += dotStepY) {
            for (let px = 4; px < canvas.width; px += dotStepX) {
                const c = Math.min(hm.cols-1, Math.max(0, Math.floor(px / hexW)));
                const r = Math.min(hm.rows-1, Math.max(0, Math.floor((py - hexR) / rowH)));
                if (!hm.isMountain(c, r)) continue;
                if (this.riverCells?.has(r * hm.cols + c)) continue;
                if (this.majorRoadCells?.has(r * hm.cols + c)) continue;
                let pn = ((px * 1031) ^ (py * 2053)) >>> 0;
                pn = Math.imul(pn ^ (pn >>> 16), 0x45d9f3b) >>> 0;
                if ((pn & 3) === 3) continue;
                if (mountainMult < 1 && (pn >>> 8) / 0xFFFFFF > mountainMult) continue;
                const jx = ((pn >> 4) & 7) - 3.5, jy = ((pn >> 8) & 7) - 3.5;
                ctx.beginPath();
                ctx.arc(px + jx, py + jy, 0.4 + (((pn >> 12) & 3) * 0.15), 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // ── Hill profile symbols — stipple-drawn per mountain hex ──────────────
        // Collect all hill specs first, sort north→south, then draw with a
        // destination-out erase before each hill so southern hills fully block
        // (NOT out) the pixels of any northern hill behind them.
        const GREY_COLS = ['#909090','#888880','#a0a098','#787870','#707068','#989890'];
        const SAND_COL  = '#c0a870';

        const hillSpecs = [];
        for (let gr = 0; gr < hm.rows; gr++) {
            for (let gc = 0; gc < hm.cols; gc++) {
                if (!hm.isMountain(gc, gr)) continue;
                if (this.riverCells?.has(gr * hm.cols + gc)) continue;
                if (this.majorRoadCells?.has(gr * hm.cols + gc)) continue;

                let hn = ((gc * 1013) ^ (gr * 2017)) >>> 0;
                hn = Math.imul(hn ^ (hn >>> 16), 0x45d9f3b) >>> 0;

                if (mountainMult < 1 && (hn / 0xFFFFFFFF) > mountainMult) continue;

                const { x: hx, y: hy } = this.hexCenter(gc, gr);
                const numHills = Math.max(1, Math.round((1 + (hn & 1)) * Math.max(1, mountainMult)));

                for (let hi = 0; hi < numHills; hi++) {
                    hn = Math.imul(hn ^ (hn >>> 13), 0x45d9f3b) >>> 0;

                    const color  = (hn % 7 === 0) ? SAND_COL : GREY_COLS[(hn >> 4) % GREY_COLS.length];
                    const ox     = hx + ((((hn >> 8)  & 15) / 15.0) - 0.5) * hexW * 0.75;
                    const oy     = hy + ((((hn >> 12) &  7) /  7.0) - 0.5) * rowH  * 0.55;
                    const hillW  = hexW * (1.0  + (((hn >> 16) & 7) / 7.0) * 1.05);
                    const hillH  = hexW * (0.55 + (((hn >> 20) & 7) / 7.0) * 0.56);
                    const rawPk  = (hn >>> 24) % 10;
                    const numPeaks = rawPk < 6 ? 1 + rawPk % 4 : 4 + rawPk % 7;
                    const peakTypes = [];
                    let pt = hn;
                    for (let p = 0; p < numPeaks; p++) {
                        pt = Math.imul(pt ^ (pt >>> 13), 0x45d9f3b) >>> 0;
                        peakTypes.push(pt % 3);
                    }
                    hillSpecs.push({ ox, oy, hillW, hillH, numPeaks, peakTypes, color });
                }
            }
        }

        // Sort north-first so southern hills are drawn last and their
        // destination-out erase correctly removes northern hills behind them.
        hillSpecs.sort((a, b) => a.oy - b.oy);

        for (const { ox, oy, hillW, hillH, numPeaks, peakTypes, color } of hillSpecs) {
            const left = ox - hillW / 2;

            // Profile function: t in [0,1] → normalised height [0,1]
            const profile = t => {
                let h = 0;
                for (let p = 0; p < numPeaks; p++) {
                    const pc = (p + 0.5) / numPeaks;
                    const pw = 0.65 / numPeaks;
                    const d  = Math.abs(t - pc) / pw;
                    if (d >= 1) continue;
                    const u = 1 - d;
                    if      (peakTypes[p] === 0) h = Math.max(h, u);
                    else if (peakTypes[p] === 1) h = Math.max(h, u * u * (3-2*u));
                    else                         h = Math.max(h, u * u);
                }
                return h;
            };

            // Erase the silhouette area — removes any northern hill behind this one
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.moveTo(left, oy);
            for (let xi = 0; xi <= hillW; xi += 2)
                ctx.lineTo(left + xi, oy - profile(xi / hillW) * hillH);
            ctx.lineTo(left + hillW, oy);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Stipple along profile outline + 2 shadow rows inside
            ctx.fillStyle   = color;
            ctx.globalAlpha = 0.50;
            for (let xi = 0; xi <= hillW; xi += 1.1) {
                const dotX = left + xi;
                const t    = xi / hillW;
                const ph   = profile(t) * hillH;
                if (ph < 0.5) continue;

                let dp = ((Math.round(dotX * 5) * 991) ^ (Math.round(oy * 5) * 1997)) >>> 0;
                dp = Math.imul(dp ^ (dp >>> 16), 0x45d9f3b) >>> 0;

                // Outline dots — check outline position is on a mountain cell
                const outY = oy - ph;
                const oc  = Math.min(hm.cols-1, Math.max(0, Math.floor(dotX / hexW)));
                const or_ = Math.min(hm.rows-1, Math.max(0, Math.floor((outY - hexR) / rowH)));
                const onMountain = hm.isMountain(oc, or_);
                const baseR = Math.min(hm.rows-1, Math.max(0, Math.floor((oy - hexR) / rowH)));
                const baseC = Math.min(hm.cols-1, Math.max(0, Math.floor(dotX / hexW)));
                if (!onMountain && !hm.isMountain(baseC, baseR)) continue;

                if ((dp & 7) > 1) {
                    ctx.beginPath();
                    ctx.arc(dotX + ((dp >> 8 & 3) - 1.5) * 0.3,
                            outY  + ((dp >> 12 & 3) - 1.5) * 0.3,
                            0.9, 0, Math.PI * 2);
                    ctx.fill();
                }

                if ((dp & 15) < 7) {
                    ctx.globalAlpha = 0.30;
                    ctx.beginPath();
                    ctx.arc(dotX, oy - ph * 0.70, 0.7, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 0.50;
                }

                if ((dp & 31) < 9) {
                    ctx.globalAlpha = 0.18;
                    ctx.beginPath();
                    ctx.arc(dotX, oy - ph * 0.45, 0.55, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 0.50;
                }
            }
        }

        // ── Small conifers scattered on mountain cells ─────────────────────────
        // Only on biomes where conifers naturally grow near treeline
        const CONIFER_BIOMES = new Set(['the_dark_forests','the_sanctuary_lands','the_eternal_winds','the_outer_steppes']);
        if (!CONIFER_BIOMES.has(this.biomeId)) { ctx.globalAlpha = 1; el('image', { href: canvas.toDataURL('image/png'), x: 0, y: 0, width: W, height: H }, gMountBase); return; }
        ctx.globalAlpha = 0.72;
        for (let gr = 0; gr < hm.rows; gr++) {
            for (let gc = 0; gc < hm.cols; gc++) {
                if (!hm.isMountain(gc, gr)) continue;

                const { x: hx, y: hy } = this.hexCenter(gc, gr);

                let cn = ((gc * 3001) ^ (gr * 4007)) >>> 0;
                cn = Math.imul(cn ^ (cn >>> 16), 0x45d9f3b) >>> 0;

                // 0–2 conifers per hex, sparse
                const count = (cn & 7) < 3 ? 0 : (cn & 7) < 6 ? 1 : 2;
                for (let ci = 0; ci < count; ci++) {
                    cn = Math.imul(cn ^ (cn >>> 13), 0x45d9f3b) >>> 0;

                    const tx = hx + ((((cn >> 4)  & 15) / 15.0) - 0.5) * hexW * 0.85;
                    const ty = hy + ((((cn >> 8)  &  7) /  7.0) - 0.5) * rowH  * 0.75;

                    // Verify placement is still on a mountain cell
                    const tc = Math.min(hm.cols-1, Math.max(0, Math.floor(tx / hexW)));
                    const tr = Math.min(hm.rows-1, Math.max(0, Math.floor((ty - hexR) / rowH)));
                    if (!hm.isMountain(tc, tr)) continue;

                    const s    = hexW * (0.28 + (((cn >> 16) & 7) / 7.0) * 0.22); // small
                    const snow = ((cn >> 24) & 7) < 2; // ~25% get snow caps
                    this._drawConiferTree(ctx, tx, ty, s, snow);
                }
            }
        }

        ctx.globalAlpha = 1;
        el('image', { href: canvas.toDataURL('image/png'), x: 0, y: 0, width: W, height: H }, gMountBase);
    }

    // ── Active terrain textures list — used by the legend ────────────────────
    _activeTextures(biomeId, wetlandDensity) {
        // Mirrors the exact conditions in _drawTerrainMarks so the legend only
        // lists texture types that are actually rendered on this map.
        const list = [];
        if (biomeId === 'the_midlands' || biomeId === 'the_gleam_havens') list.push('farmland');
        if (biomeId === 'the_midlands' || biomeId === 'the_dark_forests') list.push('plains_grass');
        if (biomeId === 'the_outer_steppes')                list.push('heather');
        if (biomeId === 'the_sanctuary_lands')              list.push('grassland');
        if (wetlandDensity > 0.08)                          list.push('reeds');
        if (biomeId === 'the_boglands')                     list.push('swamp');
        if (biomeId !== 'the_boglands' && wetlandDensity > 0.05) list.push('wetland');
        if (this.treeStyle === 'conifer' || biomeId === 'the_midlands') list.push('boreal_conifers');
        if (this.treeStyle === 'broadleaf' || biomeId === 'the_midlands') list.push('broadleaf_trees');
        if (biomeId === 'the_badlands' || biomeId === 'the_blinding_lands') list.push('scrub');
        list.push('mountain_stipple'); // present on every map that has mountains
        return list;
    }

    // ── Marching-squares contour builder ─────────────────────────────────────
    // Returns an SVG path string tracing the iso-contour at the given threshold.
    // Closed island chains use closedCatmullPath; open mainland chains use catmullPath.
    // Coordinate system: rectangular cells of size (W/COLS × H/ROWS).
    _buildContourPath(threshold) {
        const { hm } = this;
        const W = this.W, H = this.H;
        const cw = W / this.COLS;
        const ch = H / this.ROWS;

        const SEGS = [
            [],[[2,3]],[[1,2]],[[1,3]],[[0,1]],[[0,3],[1,2]],[[0,2]],[[0,3]],
            [[0,3]],[[0,2]],[[0,1],[2,3]],[[0,1]],[[1,3]],[[1,2]],[[2,3]],[]
        ];

        // Interpolated edge point: edge 0=top, 1=right, 2=bottom, 3=left
        const ep = (c, r, e) => {
            const h00=hm.get(c,r), h10=hm.get(c+1,r), h11=hm.get(c+1,r+1), h01=hm.get(c,r+1);
            const t=(a,b)=>{ const d=b-a; return d===0?0.5:(threshold-a)/d; };
            if(e===0) return [(c+t(h00,h10))*cw, r*ch];
            if(e===1) return [(c+1)*cw, (r+t(h10,h11))*ch];
            if(e===2) return [(c+1-t(h11,h01))*cw, (r+1)*ch];
            return    [c*cw, (r+1-t(h01,h00))*ch];
        };

        const above  = (c,r) => hm.get(c,r) > threshold;
        const K = ([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`;

        const segs   = [];
        const adjMap = new Map();
        const adjAdd = (key, si) => {
            if (!adjMap.has(key)) adjMap.set(key, []);
            adjMap.get(key).push(si);
        };

        for (let r = 0; r < hm.rows-1; r++) {
            for (let c = 0; c < hm.cols-1; c++) {
                const idx = (above(c,r)?8:0)|(above(c+1,r)?4:0)
                           |(above(c+1,r+1)?2:0)|(above(c,r+1)?1:0);
                for (const [e0,e1] of SEGS[idx]) {
                    const p0=ep(c,r,e0), p1=ep(c,r,e1);
                    const si = segs.length;
                    segs.push({ p0, p1 });
                    adjAdd(K(p0), si);
                    adjAdd(K(p1), si);
                }
            }
        }

        const used = new Set();
        let d = '';

        for (let start = 0; start < segs.length; start++) {
            if (used.has(start)) continue;
            used.add(start);
            const firstKey = K(segs[start].p0);
            const pts = [segs[start].p0];
            let currPt = segs[start].p1;
            let safety = 0;

            while (safety++ < 20000) {
                const currKey = K(currPt);
                if (currKey === firstKey) break;
                pts.push(currPt);
                const nextSi = (adjMap.get(currKey) || []).find(i => !used.has(i));
                if (nextSi === undefined) break;
                used.add(nextSi);
                const ns = segs[nextSi];
                currPt = K(ns.p0) === currKey ? ns.p1 : ns.p0;
            }

            if (pts.length >= 3) {
                const pObjs = pts.map(p => ({ x: p[0], y: p[1] }));
                const isClosed = (K(currPt) === firstKey);
                if (isClosed) {
                    d += closedCatmullPath(pObjs) + ' ';
                } else {
                    // Open chain (mainland meets map edge): draw smooth coast only,
                    // no forced closure — avoids straight lines along the map boundary.
                    d += catmullPath(pObjs) + ' ';
                }
            }
        }
        return d;
    }

    _drawCoastline() {
        // Thin cartographic stroke along the smooth marching-squares coast line.
        const landContour = this._buildContourPath(this.SL);
        if (!landContour) return;
        el('path', {
            d: landContour,
            fill: 'none',
            stroke: 'rgba(60,80,100,0.30)',
            'stroke-width': '1.0',
            'stroke-linejoin': 'round',
        }, this.gCoast);
    }

    // ── (coastline hatch removed — marching-squares outline is sufficient) ───

    // ── Rivers ────────────────────────────────────────────────────────────────
    _genSwampCells(rivers, lakes) {
        const { hm } = this;
        const SL = this.SL;
        const WET_R = 3; // hex radius around water features that qualifies as wet

        // Build wet-proximity set from river paths, lake centres and river mouths
        const wetSet = new Set();
        const markWet = (cc, cr, radius) => {
            for (let dr = -radius; dr <= radius; dr++)
                for (let dc = -radius; dc <= radius; dc++) {
                    if (dc*dc + dr*dr > radius*radius) continue;
                    const nc = cc+dc, nr = cr+dr;
                    if (nc >= 0 && nc < hm.cols && nr >= 0 && nr < hm.rows)
                        wetSet.add(nr * hm.cols + nc);
                }
        };
        for (const { path, seaCell } of rivers) {
            for (const { c, r } of path) markWet(c, r, WET_R);
            if (seaCell) markWet(seaCell.c, seaCell.r, WET_R + 2); // river mouths spread more
        }
        const LAKE_BIOMES = new Set(['the_midlands', 'the_dark_forests', 'the_sanctuary_lands']);
        const lakeWetR = LAKE_BIOMES.has(this.biomeId) ? Math.round((WET_R + 2) * 1.25) : WET_R + 2;
        for (const { c, r } of lakes) markWet(c, r, lakeWetR);

        // Collect low-elevation land cells
        // the_midlands: take ALL open low land (not just wet-adjacent) for 15% coverage
        const isTempForest = this.biomeId === 'the_midlands';
        const elevCeil = isTempForest ? SL + 0.22 : SL + 0.14;
        const candidates = [];
        let totalLand = 0;
        for (let r = 0; r < hm.rows; r++) {
            for (let c = 0; c < hm.cols; c++) {
                if (!hm.isLand(c, r)) continue;
                totalLand++;
                if (hm.isMountain(c, r) || hm.isCoast(c, r)) continue;
                const h = hm.get(c, r);
                if (h > elevCeil || h <= SL) continue;
                // the_midlands: no wet-adjacency requirement — fill low land freely
                if (!isTempForest && !wetSet.has(r * hm.cols + c)) continue;
                candidates.push({ c, r, h });
            }
        }

        // Take the lowest-elevation candidates up to target fraction of total land
        const swampFrac = isTempForest ? 0.15 : 0.05;
        const target = Math.round(totalLand * swampFrac);
        candidates.sort((a, b) => a.h - b.h);
        const swampSet = new Set();
        for (let i = 0; i < Math.min(target, candidates.length); i++)
            swampSet.add(candidates[i].r * hm.cols + candidates[i].c);
        return swampSet;
    }

    _genRivers() {
        const { hm } = this;
        const { cols, rows } = hm;

        // Candidate sources: mountain-edge cells (mountain adjacent to non-mountain land).
        // For boglands the cubic height compression leaves almost no mountains, so fall back
        // to any land cell above a low elevation threshold as a river source.
        const isSwamp = this.biomeId === 'the_boglands';
        const candidates = [];
        for (let r = 2; r < rows - 2; r++) {
            for (let c = 2; c < cols - 2; c++) {
                if (isSwamp) {
                    if (!hm.isLand(c, r)) continue;
                    const lf = hm.get(c, r) - hm.seaLevel;
                    if (lf > 0.03) candidates.push([c, r, hm.get(c, r)]);
                } else {
                    if (!hm.isMountain(c, r)) continue;
                    const isEdge = [[1,0],[-1,0],[0,1],[0,-1]].some(
                        ([dc, dr]) => hm.isLand(c+dc, r+dr) && !hm.isMountain(c+dc, r+dr)
                    );
                    if (isEdge) candidates.push([c, r, hm.get(c, r)]);
                }
            }
        }

        // Sort highest first; spread out sources (min 8 cells apart, 4 for swamp)
        candidates.sort((a, b) => b[2] - a[2]);
        const minSpacing = isSwamp ? 4 : 8;

        const waterPoolsByCulture = {
            midlander:          ['waterways.human'],
            northerner:         ['waterways.human'],
            step_folk:          ['waterways.human', 'waterways.elven'],
            ancients_secluded:  ['waterways.elven'],
            ancients_greys:     ['waterways.elven'],
            ancients_dark_ones: ['waterways.dark_haunted'],
            ice_ancients:       ['waterways.human'],
            wildmen_foresters:  ['waterways.dark_haunted', 'waterways.human'],
            wildmen_ravagers:   ['waterways.dark_haunted'],
            oakpeople:          ['waterways.human'],
            stone_folk:         ['waterways.dwarven'],
            swampbrood:         ['waterways.dark_haunted'],
            ashen_halfbreeds:   ['waterways.dark_haunted', 'waterways.human'],
        };
        const wCulture = this.culture ?? 'midlander';
        const wPools = waterPoolsByCulture[wCulture] ?? waterPoolsByCulture.midlander;
        const NAMES = this._pool(
            [...wPools, 'waterways.human'],
            ['River Mourne', 'The Silver Thread', 'Ashwater', 'Coldwater',
             'The Greybeck', 'River Veld', 'Stonebeck', 'The Winding Grey']
        );
        const rivers = [];
        const usedSrcs = [];
        const rs = (this.params.riverScale ?? 1.0) * (this.biomeMult?.river ?? 1);
        const numRivers = Math.max(0, Math.round(this.ri(3 * this.scale, 6 * this.scale) * rs));

        for (const [sc, sr] of candidates) {
            if (rivers.length >= numRivers) break;
            if (usedSrcs.some(([uc, ur]) => Math.hypot(uc-sc, ur-sr) < minSpacing)) continue;
            usedSrcs.push([sc, sr]);

            // Steepest-descent trace
            let c = sc, r = sr;
            const path = [{ c, r }];
            const visited = new Set([`${c},${r}`]);

            // Hex neighbours for odd-r pointy-top layout
            const nbrs = (gc, gr) => {
                const odd = gr & 1;
                return [
                    [gc+1, gr], [gc-1, gr],
                    [gc+(odd?1:0),  gr-1], [gc+(odd?0:-1), gr-1],
                    [gc+(odd?1:0),  gr+1], [gc+(odd?0:-1), gr+1],
                ];
            };

            let reachedSea = false;
            let seaCell = null;
            for (let step = 0; step < 500; step++) {
                const curH = hm.get(c, r);
                // Collect all valid downhill neighbours
                const opts = [];
                let hitEdge = false;
                for (const [nc, nr] of nbrs(c, r)) {
                    if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) { hitEdge = true; continue; }
                    if (!hm.isLand(nc, nr)) { reachedSea = true; seaCell = { c: nc, r: nr }; break; }
                    if (visited.has(`${nc},${nr}`)) continue;
                    if (hm.get(nc, nr) <= curH) opts.push([nc, nr, hm.get(nc, nr)]);
                }
                if (reachedSea || hitEdge) break;
                if (opts.length === 0) break;

                // Among options within 0.008 of the lowest, pick randomly for natural meanders.
                // Weight steeper drops more heavily so rivers still prefer downhill paths.
                opts.sort((a, b) => a[2] - b[2]);
                const floor = opts[0][2];
                const tol   = Math.max(0.004, (curH - hm.seaLevel) * 0.015);
                const good  = opts.filter(o => o[2] <= floor + tol);
                const [nc, nr] = good[Math.floor(this._rng() * good.length)];

                const key = `${nc},${nr}`;
                visited.add(key);
                path.push({ c: nc, r: nr });
                c = nc; r = nr;
            }

            if (path.length >= (isSwamp ? 4 : 10)) {
                const last = path[path.length - 1];
                const lake = (!reachedSea && hm.isLand(last.c, last.r))
                    ? { c: last.c, r: last.r } : null;
                rivers.push({ path, name: NAMES[rivers.length % NAMES.length], lake, seaCell });
            }
        }

        // Collect unique inland lake sites (deduplicate within 4 cells) and assign names
        const lakeNamePool = this._pool(['lakes'], [
            'Clearwater', 'Silvermere', 'Blackwater', 'Deepmere', 'Stonewater',
            'Frostmere', 'Shadowpool', 'Velmyr', 'Mourndeep', 'Glasswater',
            'Greymere', 'Ironwater', 'Coldwell', 'Duskwater', 'Ashwater',
        ]);
        const lakes = [];
        // River-endpoint lakes (dedup radius reduced to 3 — tighter, more distinct lakes)
        for (const { lake } of rivers) {
            if (!lake) continue;
            if (lakes.some(l => Math.hypot(l.c - lake.c, l.r - lake.r) < 3)) continue;
            lake.name = lakeNamePool[lakes.length % lakeNamePool.length];
            lakes.push(lake);
        }

        // Standalone basin lakes — scan for flat low inland depressions not near
        // any existing lake, river cell, or coast.  Adds 4–8 extra lakes per map
        // (1–2 for arid biomes like the_badlands).
        const targetExtra = this.biomeId === 'the_badlands' ? this.ri(1, 2) : this.ri(4, 8);
        const stepR = Math.max(3, Math.floor(hm.rows / 14));
        const stepC = Math.max(3, Math.floor(hm.cols / 14));
        const basinCandidates = [];
        for (let r = stepR; r < hm.rows - stepR; r += stepR) {
            for (let c = stepC; c < hm.cols - stepC; c += stepC) {
                const h = hm.get(c, r);
                if (!hm.isLand(c, r) || hm.isMountain(c, r) || hm.isCoast(c, r)) continue;
                if (h - this.SL > 0.12) continue; // only low flat land
                if (this.riverCells?.has(r * hm.cols + c)) continue;
                basinCandidates.push([c, r]);
            }
        }
        // Shuffle deterministically via seeded rng
        for (let i = basinCandidates.length - 1; i > 0; i--) {
            const j = this.ri(0, i);
            [basinCandidates[i], basinCandidates[j]] = [basinCandidates[j], basinCandidates[i]];
        }
        for (const [c, r] of basinCandidates) {
            if (lakes.length - (rivers.filter(rv => rv.lake).length) >= targetExtra) break;
            if (lakes.some(l => Math.hypot(l.c - c, l.r - r) < 6)) continue;
            const lake = { c, r, name: lakeNamePool[lakes.length % lakeNamePool.length] };
            lakes.push(lake);
        }

        return { rivers, lakes };
    }

    _drawRivers(rivers) {
        const { hm, gRivers, gLabels } = this;
        const SL = this.SL;
        const f  = n => n.toFixed(1);

        // ── River colours derived from biome water colour ─────────────────────
        // Main body: exact seaColor so rivers are visually identical to ocean/lakes.
        // Shadow pass: slightly darker for depth, drawn wider underneath.
        const seaColor  = this.biomePalette.seaColor ?? '#c8d8e8';
        const riverMain = seaColor;

        rivers.forEach(({ path, name, lake, seaCell }) => {
            if (path.length < 2) return;

            // ── Build meandering control points ──────────────────────────────────
            const stride = Math.max(1, Math.ceil(path.length / 36));
            const sampled = [];
            for (let i = 0; i < path.length; i += stride) sampled.push(path[i]);
            if (sampled[sampled.length - 1] !== path[path.length - 1])
                sampled.push(path[path.length - 1]);

            const pts = sampled.map(({ c, r }, idx) => {
                const { x: bx, y: by } = this.hexCenter(c, r);
                if (idx === 0 || idx === sampled.length - 1) return { x: bx, y: by };

                const elev     = Math.max(0, hm.get(c, r) - SL);
                const flatness = Math.max(0, 1 - elev / 0.18);
                const jitMag   = flatness * this.hexW * 1.1;

                const next = sampled[Math.min(idx + 1, sampled.length - 1)];
                const { x: nx, y: ny } = this.hexCenter(next.c, next.r);
                const flen = Math.hypot(nx - bx, ny - by) || 1;
                const px   = -(ny - by) / flen;
                const py   =  (nx - bx) / flen;

                const jit = this.r(-jitMag, jitMag);
                return { x: bx + px * jit, y: by + py * jit };
            });

            // ── Terminus handling ─────────────────────────────────────────────────
            if (seaCell) {
                // Ocean mouth: interpolate to the visual coastline (where height == SL)
                // rather than the midpoint, so the river tip meets the shoreline precisely.
                const last = pts[pts.length - 1];
                const { x: sx, y: sy } = this.hexCenter(seaCell.c, seaCell.r);
                const lastCell = sampled[sampled.length - 1];
                const h1 = hm.get(lastCell.c, lastCell.r);
                const h2 = hm.get(seaCell.c, seaCell.r);
                const dh = h2 - h1;
                const t  = dh !== 0 ? Math.max(0.05, Math.min(0.98, (SL - h1) / dh)) : 0.5;
                pts.push({ x: last.x + t * (sx - last.x), y: last.y + t * (sy - last.y) });
            } else if (lake) {
                // Lake mouth: the last path point is the lake centre cell.
                // Pull the endpoint back to the approximate lake visual edge
                // (~2.3 hex-widths from centre) so the river ends at the shore,
                // not invisibly inside the lake body.
                const lakeCenter = pts[pts.length - 1];
                const prev = pts[Math.max(0, pts.length - 2)];
                const dx = lakeCenter.x - prev.x;
                const dy = lakeCenter.y - prev.y;
                const len = Math.hypot(dx, dy) || 1;
                const edgeDist = this.hexW * 2.3;
                pts[pts.length - 1] = {
                    x: lakeCenter.x - (dx / len) * edgeDist,
                    y: lakeCenter.y - (dy / len) * edgeDist,
                };
            }

            if (pts.length < 2) return;
            const n = pts.length;

            // ── Tapered drawing ───────────────────────────────────────────────────
            // Width: 10% of max at headwater (thin creek) → 200% of old max at mouth
            // (twice the previous river width), graduating continuously along the path.
            const W_SRC   = 0.28;   // headwater creek — 10% of old W_MOUTH (2.8)
            const W_MOUTH = 5.6;    // river mouth     — 200% of old W_MOUTH

            // Main river pass
            for (let i = 0; i < n - 1; i++) {
                const t   = n > 2 ? i / (n - 2) : 1;
                const w   = W_SRC + (W_MOUTH - W_SRC) * t;
                const p0  = pts[Math.max(0, i - 1)];
                const p1  = pts[i];
                const p2  = pts[i + 1];
                const p3  = pts[Math.min(n - 1, i + 2)];
                const cp1x = p1.x + (p2.x - p0.x) / 6;
                const cp1y = p1.y + (p2.y - p0.y) / 6;
                const cp2x = p2.x - (p3.x - p1.x) / 6;
                const cp2y = p2.y - (p3.y - p1.y) / 6;
                const seg  = `M ${f(p1.x)} ${f(p1.y)} C ${f(cp1x)} ${f(cp1y)} ${f(cp2x)} ${f(cp2y)} ${f(p2.x)} ${f(p2.y)}`;
                el('path', { d: seg, fill: 'none', stroke: riverMain,
                    'stroke-width': w.toFixed(2),
                    'stroke-linecap': 'round' }, gRivers);
            }

            // ── Canyon marks (mountain crossings) ────────────────────────────────
            let canyonD = '';
            const cStep = Math.max(1, Math.floor(path.length / 28));
            for (let i = 1; i < path.length - 1; i += cStep) {
                if (!hm.isMountain(path[i].c, path[i].r)) continue;
                const prev = path[Math.max(0, i - 1)];
                const next = path[Math.min(path.length - 1, i + 1)];
                const { x: pcx, y: pcy } = this.hexCenter(prev.c, prev.r);
                const { x: ncx, y: ncy } = this.hexCenter(next.c, next.r);
                const dx = ncx - pcx, dy = ncy - pcy;
                const len = Math.hypot(dx, dy) || 1;
                const px  = (-dy / len) * this.hexW * 0.85;
                const py  = ( dx / len) * this.rowH * 0.85;
                const { x: mx, y: my } = this.hexCenter(path[i].c, path[i].r);
                canyonD += `M ${f(mx+px*0.25)} ${f(my+py*0.25)} L ${f(mx+px)} ${f(my+py)} `;
                canyonD += `M ${f(mx-px*0.25)} ${f(my-py*0.25)} L ${f(mx-px)} ${f(my-py)} `;
            }
            if (canyonD) el('path', { d: canyonD, fill: 'none', stroke: '#6a6050',
                'stroke-width': '0.75', opacity: '0.55' }, gRivers);

            // ── Store label data for the deferred label phase ─────────────────
            if (name) {
                const midIdx = Math.floor(pts.length / 2);
                const mid    = pts[midIdx];
                const prevPt = pts[Math.max(0, midIdx - 1)];
                const angle  = Math.atan2(mid.y - prevPt.y, mid.x - prevPt.x) * 180 / Math.PI;
                const a      = (angle > 90 || angle < -90) ? angle + 180 : angle;
                (this._riverLabelData ??= []).push({ x: mid.x, y: mid.y - 5, pivotY: mid.y, a, name });
            }
        });
    }

    // ── River labels — drawn in the shared label phase so they respect the registry ──
    _drawRiverLabels(rivers) {
        if (!this._riverLabelData || this._riverLabelData.length === 0) return;
        const { gLabels } = this;
        const f = n => n.toFixed(1);
        for (const { x, y, pivotY, a, name } of this._riverLabelData) {
            const rBBox = this._labelBBox(x, y, name, 8, 0.5);
            if (this._labelOverlaps(rBBox, 4)) continue;
            (this._labelRegistry ??= []).push(rBBox);
            el('text', {
                x, y,
                'text-anchor': 'middle', 'font-family': "'IM Fell English',Georgia,serif",
                'font-size': '8', 'font-style': 'italic', fill: '#3a6080',
                transform: `rotate(${f(a)} ${f(x)} ${f(pivotY)})`
            }, gLabels).textContent = name;
        }
    }

    // ── Inland lakes (river termini that didn't reach the sea) ────────────────
    _drawLakes(lakes) {
        const { gLakes } = this;
        const seaColor = this.biomePalette.seaColor ?? '#b8d4e4';
        lakes.forEach(lake => {
            const { c, r } = lake;
            const { x: cx, y: cy } = this.hexCenter(c, r);
            // Lake size: 2–4 hex cells across, organically scaled
            const rx = this.r(this.hexW * 2.0, this.hexW * 3.8);
            const ry = this.r(this.rowH * 1.4, this.rowH * 2.8);
            lake.rx = rx; // store for label sizing
            // Build 12 angular control points with strong per-point jitter → organic blob
            const N = 12;
            const pts = [];
            for (let i = 0; i < N; i++) {
                const a   = (i / N) * Math.PI * 2;
                const jx  = this.r(0.60, 1.40);
                const jy  = this.r(0.60, 1.40);
                pts.push({ x: cx + Math.cos(a) * rx * jx,
                            y: cy + Math.sin(a) * ry * jy });
            }
            const d = closedCatmullPath(pts);
            // Fill with biome sea color — fully opaque to match ocean
            el('path', { d, fill: seaColor, stroke: 'none' }, gLakes);
        });
    }

    // ── Label collision helpers ────────────────────────────────────────────────
    // All map labels (regions, lakes, rivers) register their axis-aligned bbox
    // here so later labels can detect and avoid overlaps.

    _labelBBox(cx, cy, text, fontSize, letterSpacing) {
        const w = text.length * (fontSize * 0.62 + letterSpacing) + letterSpacing;
        const h = fontSize * 1.6;
        return { cx, cy, x: cx - w / 2, y: cy - h / 2, w, h };
    }

    _labelOverlaps(bbox, pad = 6) {
        return (this._labelRegistry ?? []).some(r =>
            bbox.x - pad < r.x + r.w &&
            bbox.x + bbox.w + pad > r.x &&
            bbox.y - pad < r.y + r.h &&
            bbox.y + bbox.h + pad > r.y
        );
    }

    // Title-case: capitalise the first letter of every whitespace-separated word.
    // Apostrophe-interior letters (King's) are left lower-case.
    _tc(s) {
        return String(s).toLowerCase().replace(/(^|\s)(\w)/g, (_, sp, c) => sp + c.toUpperCase());
    }

    // Returns a function (px, py) => bool that is true when a pixel position
    // is clear of mountain and forest hex cells (safe for label placement).
    _getTerrainClearFn() {
        const { hm, hexW, hexR, rowH } = this;
        const cols = hm.cols, rows = hm.rows;
        // Build forest cell set
        const forestSet = new Set();
        for (const { c: fc, r: fr, radius } of (this.forests ?? [])) {
            const rad = Math.ceil(radius);
            for (let dr = -rad; dr <= rad; dr++)
                for (let dc = -rad; dc <= rad; dc++)
                    if (dc * dc + dr * dr <= radius * radius) {
                        const nc = fc + dc, nr = fr + dr;
                        if (nc >= 0 && nc < cols && nr >= 0 && nr < rows)
                            forestSet.add(nr * cols + nc);
                    }
        }
        return (px, py) => {
            const r = Math.min(rows - 1, Math.max(0, Math.round((py - hexR) / rowH)));
            const c = Math.min(cols - 1, Math.max(0, Math.round((px / hexW) - 0.5 - 0.5 * (r & 1))));
            if (hm.isMountain(c, r)) return false;
            if (forestSet.has(r * cols + c)) return false;
            return true;
        };
    }

    // Try a series of candidate offsets and return the first non-overlapping one.
    // Pass terrainClear=(px,py)=>bool to prefer positions away from terrain symbols.
    // Falls back to the original position if nothing fits.
    _findLabelPos(cx, cy, text, fontSize, letterSpacing, maxShift, terrainClear = null) {
        const b0 = this._labelBBox(cx, cy, text, fontSize, letterSpacing);
        const { w, h } = b0;
        const step = h + 6;
        const candidates = [
            [0, 0],
            [0, -(step)], [0, step],
            [-(w * 0.55 + 6), 0], [w * 0.55 + 6, 0],
            [0, -(step * 1.8)], [0, step * 1.8],
            [-(w * 0.55 + 6), -(step)], [w * 0.55 + 6, -(step)],
            [-(w * 0.55 + 6), step],  [w * 0.55 + 6, step],
        ];
        const inShift = ([dx, dy]) => maxShift <= 0 || Math.hypot(dx, dy) <= maxShift;
        // Pass 1: prefer terrain-clear positions
        if (terrainClear) {
            for (const [dx, dy] of candidates) {
                if (!inShift([dx, dy])) continue;
                const nx = cx + dx, ny = cy + dy;
                if (!terrainClear(nx, ny)) continue;
                const b = this._labelBBox(nx, ny, text, fontSize, letterSpacing);
                if (!this._labelOverlaps(b)) {
                    (this._labelRegistry ??= []).push(b);
                    return { x: nx, y: ny };
                }
            }
        }
        // Pass 2: any non-overlapping position
        for (const [dx, dy] of candidates) {
            if (!inShift([dx, dy])) continue;
            const b = this._labelBBox(cx + dx, cy + dy, text, fontSize, letterSpacing);
            if (!this._labelOverlaps(b)) {
                (this._labelRegistry ??= []).push(b);
                return { x: cx + dx, y: cy + dy };
            }
        }
        // Nothing fits — skip this label entirely
        return null;
    }

    _drawLakeLabels(lakes) {
        if (!lakes.length) return;
        const { gLabels } = this;
        const terrainClear = this._getTerrainClearFn();

        const PREFIXES = ['The', 'Lake', 'Deep', 'Great', 'Shallow'];
        const SUFFIXES = ['Lake', 'Darkwater'];

        lakes.forEach(({ c, r, name, rx }) => {
            if (!name || !rx) return;
            const baseName = this._tc(String(name));
            if (!baseName) return;

            // All bit ops use >>> (unsigned) to avoid negative modulo
            let pn = ((c * 1013) ^ (r * 2017)) >>> 0;
            pn = (Math.imul(pn ^ (pn >>> 16), 0x45d9f3b)) >>> 0;

            // 20 % chance of adding a prefix or suffix
            let label = baseName;
            if ((pn & 0xFF) < 51) {                          // ~20 %
                if ((pn >>> 8) & 1) {                        // prefix or suffix
                    label = PREFIXES[(pn >>> 9) % PREFIXES.length] + ' ' + baseName;
                } else {
                    label = baseName + ' ' + SUFFIXES[(pn >>> 9) % SUFFIXES.length];
                }
            }

            const { x: lx, y: ly } = this.hexCenter(c, r);

            // Font size scales so text fits within 80 % of lake diameter
            const maxWidth = rx * 1.6;
            const LS = 1.5;
            const fontSize = Math.min(11, Math.max(4.5,
                maxWidth / (label.length * (0.62 + LS / 10))
            ));

            // Slight angle variation matching region names
            const angle = ((pn >>> 16) & 15) * 0.5 - 3.5;

            // Find a non-overlapping position; skip if none exists
            const pos = this._findLabelPos(lx, ly, label, fontSize, LS, rx * 1.2, terrainClear);
            if (!pos) return;
            const { x, y } = pos;

            el('text', {
                x: x.toFixed(1), y: y.toFixed(1),
                'text-anchor': 'middle', 'dominant-baseline': 'central',
                'font-family': "'IM Fell English',Georgia,serif",
                'font-size': fontSize.toFixed(1),
                'font-style': 'italic',
                'letter-spacing': String(LS),
                fill: '#9a9080',
                transform: `rotate(${angle.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`,
            }, gLabels).textContent = label;
        });
    }

    // ── Forests ───────────────────────────────────────────────────────────────
    _genForests(rivers) {
        const { hm } = this;
        const { cols, rows } = hm;

        // Mark cells within 3 of a river (moisture = more trees)
        const riverSet = new Set();
        rivers.forEach(({ path }) =>
            path.forEach(({ c, r }) => {
                for (let dr = -3; dr <= 3; dr++)
                    for (let dc = -3; dc <= 3; dc++)
                        riverSet.add(`${c+dc},${r+dr}`);
            })
        );

        const fs = (this.params.forestScale ?? 1.0) * (this.biomeMult?.forest ?? 1);
        const SEEDS = Math.round(this.ri(14 * this.scale, 20 * this.scale) * fs);
        const forests = [];
        const usedCells = [];
        const SL = this.SL;

        // Per-biome overrides for elevation range, patch radius, seed spacing, attempt budget
        let heightMax      = this.biomeData?.forestHeightMax  ?? 0.30;
        let radiusMin      = this.biomeData?.forestRadiusMin  ?? 3.5;
        let radiusMax      = this.biomeData?.forestRadiusMax  ?? 6.0;
        let seedSpacing    = this.biomeData?.forestSeedSpacing ?? 3;
        let maxAttempts    = (this.biomeData?.forestAttempts  ?? 600) * this.scale;

        // Special case: inland Dark Forests maps get Sanctuary-scale forest generation
        if (this.params.mapType === 'inland' && this.biomeId === 'the_dark_forests') {
            heightMax = 0.52;
            radiusMin = 5.0;
            radiusMax = 9.0;
            seedSpacing = 1;
            maxAttempts = 2000 * this.scale;
        }

        for (let attempt = 0; attempt < maxAttempts && forests.length < SEEDS; attempt++) {
            const c = this.ri(3, cols - 4), r = this.ri(3, rows - 4);
            const h = hm.get(c, r);
            // Forests: land, not mountain, not coast, mid-elevation
            if (!hm.isLand(c, r) || hm.isMountain(c, r) || hm.isCoast(c, r)) continue;
            if (h < SL + 0.03 || h > SL + heightMax) continue;
            if (usedCells.some(([uc, ur]) => Math.hypot(uc-c, ur-r) < seedSpacing)) continue;

            const moist = riverSet.has(`${c},${r}`) ? 1.6 : 1.0;
            forests.push({
                c, r,
                count:  Math.round(this.ri(65 * this.scale, 110 * this.scale) * moist * fs),
                radius: this.r(radiusMin, radiusMax)
            });
            usedCells.push([c, r]);
        }
        return forests;
    }

    // Forests are rasterised to a single canvas image — this eliminates
    // thousands of individual SVG filter operations (the biggest perf cost).
    _drawForestShade(forests) {
        if (!forests || forests.length === 0) return;
        const { gTexture, hm, W, H } = this;
        const hexW = this.hexW;

        // Pass 1: fill forest cells with solid dark circles on a working canvas
        const src = document.createElement('canvas');
        src.width = Math.round(W); src.height = Math.round(H);
        const sctx = src.getContext('2d');
        sctx.fillStyle = '#0e1008';

        for (const { c: fc, r: fr, radius } of forests) {
            const R = Math.ceil(radius), R2 = radius * radius;
            for (let dr = -R; dr <= R; dr++) {
                for (let dc = -R; dc <= R; dc++) {
                    if (dc*dc + dr*dr > R2) continue;
                    const gc = fc + dc, gr = fr + dr;
                    if (gc < 0 || gc >= hm.cols || gr < 0 || gr >= hm.rows) continue;
                    if (!hm.isLand(gc, gr) || hm.isMountain(gc, gr) || hm.isCoast(gc, gr)) continue;
                    const { x: hx, y: hy } = this.hexCenter(gc, gr);
                    // Circle slightly larger than hex so adjacent cells fully merge
                    sctx.beginPath();
                    sctx.arc(hx, hy, hexW * 0.78, 0, Math.PI * 2);
                    sctx.fill();
                }
            }
        }

        // Pass 2: blur onto a second canvas for organic soft edges
        const blurR = Math.max(2, Math.round(hexW * 0.55));
        const dst = document.createElement('canvas');
        dst.width = Math.round(W); dst.height = Math.round(H);
        const dctx = dst.getContext('2d');
        dctx.filter = `blur(${blurR}px)`;
        dctx.drawImage(src, 0, 0);

        el('image', {
            href: dst.toDataURL('image/png'),
            x: 0, y: 0, width: W, height: H,
            opacity: '0.13',
        }, gTexture);
    }

    _drawForests(forests) {
        const { gForests, W, H, hm } = this;
        const SL       = this.SL;
        const biomeId  = this.biomeId;
        const treeStyle = this.treeStyle;

        // Clearance zones: all settlements get a clear area sized to their icon + label
        const CLEAR_RADIUS = { capital: 55, city: 44, port_city: 44, fortress: 38, market_town: 36, town: 32, fishing_village: 20, village: 18, port: 14 };
        const clearZones = (this.settlements || [])
            .filter(s => s.type in CLEAR_RADIUS)
            .map(s => {
                const r = CLEAR_RADIUS[s.type];
                // Shift center down by ~8px so the circle covers the name text below the icon
                return { x: s.x, y: s.y + 8, r2: r * r };
            });

        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(W);
        canvas.height = Math.round(H);
        const ctx = canvas.getContext('2d');

        // Forgotten Kingdom ground weed — scatter small fungi before big ones so trees overlay
        if (biomeId === 'the_forgotten_kingdom') {
            const weedTotal = Math.round(hm.cols * hm.rows * 2.5);
            for (let i = 0; i < weedTotal; i++) {
                const gc = Math.floor(this._rng() * hm.cols);
                const gr = Math.floor(this._rng() * hm.rows);
                if (!hm.isLand(gc, gr) || hm.isMountain(gc, gr)) continue;
                const {x: _wx0, y: _wy0} = this.hexCenter(gc, gr);
                const wx = _wx0 + (this._rng() - 0.5) * this.hexW;
                const wy = _wy0 + (this._rng() - 0.5) * this.rowH;
                const ws = this.r(2, 5);
                const clusterN = 1 + Math.floor(this._rng() * 3);
                this._drawUnderdarkWeed(ctx, wx, wy, ws, clusterN);
            }
        }

        const _BIOME_TREE_DENSITY = { the_sanctuary_lands: 0.125, the_dark_forests: 0.5, the_outer_steppes: 1.6 };
        let treeDensity = _BIOME_TREE_DENSITY[this.biomeId] ?? 1.0;
        // For inland Dark Forests, match Sanctuary's tree symbol density
        if (this.params.mapType === 'inland' && this.biomeId === 'the_dark_forests') {
            treeDensity = 0.125;
        }
        const treeDensityMult = (this.scale === 1 ? 2.44 : 1.0) * treeDensity;

        // ── Pass 1: collect valid tree positions ──────────────────────────────
        const treeList = [];
        forests.forEach(({ c, r, count, radius }) => {
            const {x: cx, y: cy} = this.hexCenter(c, r);
            const treeCount = Math.round(count * treeDensityMult);
            for (let i = 0; i < treeCount; i++) {
                const a = this._rng() * Math.PI * 2;
                const d = Math.sqrt(this._rng()) * radius * this.hexW;
                const tx = cx + Math.cos(a) * d;
                const ty = cy + Math.sin(a) * d;
                const gc = Math.round((tx / this.hexW) - 0.5), gr = Math.round((ty - this.hexR) / this.rowH);
                const gc2 = Math.max(0, Math.min(this.COLS-1, gc)), gr2 = Math.max(0, Math.min(this.ROWS-1, gr));
                const inClearZone = clearZones.some(z => (tx-z.x)*(tx-z.x) + (ty-z.y)*(ty-z.y) < z.r2);
                if (!inClearZone && hm.isLand(gc2, gr2) && !hm.isMountain(gc2, gr2) && !hm.isCoast(gc2, gr2)
                    && !(this.riverCells?.has(gr2 * hm.cols + gc2))
                    && !(this.majorRoadCells?.has(gr2 * hm.cols + gc2))
                    && !(biomeId !== 'the_boglands' && this.lakeCells?.has(gr2 * hm.cols + gc2))) {
                    let style = treeStyle;
                    if (treeStyle === 'broadleaf' && biomeId === 'the_midlands') {
                        if (hm.get(gc2, gr2) - SL > 0.273) style = 'conifer';
                    }
                    const s = (style === 'palm' || style === 'fungal') ? this.r(16, 30) : this.r(9, 18);
                    treeList.push({ tx, ty, style, s });
                }
            }
        });

        // ── Pass 2: sort north-to-south so southern trees overlap northern ones ─
        treeList.sort((a, b) => a.ty - b.ty);

        // ── Pass 3: draw — boolean NOT erase before each symbol ──────────────
        // Matches mountain painter's algorithm: destination-out clears the
        // current tree's silhouette so no previously drawn tree bleeds through.
        for (const { tx, ty, style, s } of treeList) {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1;
            ctx.beginPath();
            if (style === 'conifer') {
                // Erase triangular column matching the three-tier silhouette
                ctx.moveTo(tx,           ty - s);
                ctx.lineTo(tx - s * 0.5, ty + s * 0.28);
                ctx.lineTo(tx + s * 0.5, ty + s * 0.28);
                ctx.closePath();
            } else {
                // Erase bounding ellipse covering canopy + trunk for all other styles
                ctx.ellipse(tx, ty - s * 0.05, s * 0.48, s * 0.62, 0, 0, Math.PI * 2);
            }
            ctx.fill();
            ctx.restore();

            if      (style === 'conifer') this._drawConiferTree(ctx, tx, ty, s, biomeId === 'the_eternal_winds');
            else if (style === 'palm')    this._drawPalmTree(ctx, tx, ty, s);
            else if (style === 'swamp')   this._drawSwampTree(ctx, tx, ty, s);
            else if (style === 'fungal')  this._drawFungiTree(ctx, tx, ty, s);
            else                          this._drawBroadleafTree(ctx, tx, ty, s);
        }

        el('image', { href: canvas.toDataURL('image/png'), x: 0, y: 0, width: W, height: H }, gForests);
    }

    // ── Boreal cartographic marks — small conifer symbols drawn above tree layer ──
    _drawBorealMarks(forests) {
        const { gTexture: gForestMarks, hm } = this;
        if (!forests || forests.length === 0) return;

        // Build forest cell set
        const forestSet = new Set();
        for (const { c: fc, r: fr, radius } of forests) {
            const R = Math.ceil(radius), R2 = radius * radius;
            for (let dr = -R; dr <= R; dr++)
                for (let dc = -R; dc <= R; dc++)
                    if (dc*dc + dr*dr <= R2)
                        forestSet.add((fr+dr) * hm.cols + (fc+dc));
        }

        // Build all stroke paths into a single SVG path string for performance
        let d = '';
        const f = n => n.toFixed(1);

        for (let gr = 0; gr < hm.rows; gr++) {
            for (let gc = 0; gc < hm.cols; gc++) {
                if (!forestSet.has(gr * hm.cols + gc)) continue;
                if (!hm.isLand(gc, gr) || hm.isMountain(gc, gr) || hm.isCoast(gc, gr)) continue;
                // the_midlands: conifers only grow at higher elevation (matches _drawForests logic)
                if (this.biomeId === 'the_midlands' && hm.get(gc, gr) - this.SL <= 0.273) continue;

                let pn = ((gc * 1013) ^ (gr * 2017)) >>> 0;
                pn = Math.imul(pn ^ (pn >>> 16), 0x45d9f3b) >>> 0;
                if ((pn & 3) === 3) continue; // ~75% of cells

                const { x: hx, y: hy } = this.hexCenter(gc, gr);
                const cx = hx + ((pn >> 4) & 5) - 2.5;
                const cy = hy + ((pn >> 8) & 5) - 2.5;

                const isTiny = (pn >> 12) & 1;
                const h = isTiny ? 3.5 : 5.5;

                if (isTiny) {
                    // Seedling: single V
                    d += `M${f(cx - h*0.4)},${f(cy - h*0.5)}L${f(cx)},${f(cy - h)}L${f(cx + h*0.4)},${f(cy - h*0.5)}`;
                } else {
                    // Full tree: upper tier + lower wider tier + trunk
                    d += `M${f(cx - h*0.22)},${f(cy - h*0.65)}L${f(cx)},${f(cy - h)}L${f(cx + h*0.22)},${f(cy - h*0.65)}`;
                    d += `M${f(cx - h*0.44)},${f(cy - h*0.25)}L${f(cx)},${f(cy - h*0.52)}L${f(cx + h*0.44)},${f(cy - h*0.25)}`;
                    d += `M${f(cx)},${f(cy - h*0.2)}L${f(cx)},${f(cy)}`;
                }
            }
        }

        if (d) {
            el('path', {
                d,
                fill:           'none',
                stroke:         '#3a4030',
                'stroke-width': '0.65',
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round',
                opacity:        '0.30',
            }, gForestMarks);
        }
    }

    // ── Broadleaf cartographic marks — oval canopy + trunk above forest layer ──
    _drawBroadleafMarks(forests) {
        const { gTexture: gForestMarks, hm } = this;
        if (!forests || forests.length === 0) return;

        const forestSet = new Set();
        for (const { c: fc, r: fr, radius } of forests) {
            const R = Math.ceil(radius), R2 = radius * radius;
            for (let dr = -R; dr <= R; dr++)
                for (let dc = -R; dc <= R; dc++)
                    if (dc*dc + dr*dr <= R2)
                        forestSet.add((fr+dr) * hm.cols + (fc+dc));
        }

        // 4 colour buckets: black, dark green, leaf green, orange
        const OVAL_COLORS = ['#1a1a14', '#1e3a18', '#4a7a28', '#b86820'];
        const ds = ['', '', '', ''];
        const f = n => n.toFixed(2);

        for (let gr = 0; gr < hm.rows; gr++) {
            for (let gc = 0; gc < hm.cols; gc++) {
                if (!forestSet.has(gr * hm.cols + gc)) continue;
                if (!hm.isLand(gc, gr) || hm.isMountain(gc, gr) || hm.isCoast(gc, gr)) continue;
                if (this.biomeId === 'the_midlands' && hm.get(gc, gr) - this.SL > 0.273) continue;

                let pn = ((gc * 1013) ^ (gr * 2017)) >>> 0;
                pn = Math.imul(pn ^ (pn >>> 16), 0x45d9f3b) >>> 0;

                const { x: hx, y: hy } = this.hexCenter(gc, gr);

                // Draw 6 ovals per hex, each with an independent seed
                for (let slot = 0; slot < 6; slot++) {
                    let sn = Math.imul((pn + slot * 0x9e3779b9) ^ ((pn >> 13) + slot * 0x6c62272e), 0x45d9f3b) >>> 0;

                    const colorIdx = (sn >> 24) & 3; // pick one of 4 colours
                    let d = ds[colorIdx];

                    const cx = hx + ((sn >> 4) & 7) - 3.5;
                    const cy = hy + ((sn >> 8) & 7) - 3.5;

                    const isTiny = (sn >> 12) & 1;

                    if (isTiny) {
                        // Seedling: two short strokes diverging upward from a base point
                        const tw = 1.8, th = 3.0;
                        d += `M${f(cx)},${f(cy)}L${f(cx - tw)},${f(cy - th)}`;
                        d += `M${f(cx)},${f(cy)}L${f(cx + tw)},${f(cy - th)}`;
                    } else {
                        // Full tree: stippled oval canopy + trunk
                        // 4 size tiers: tiny, small, medium, large
                        const sizeTier = (sn >> 16) & 3;
                        const rx = [1.6, 2.2, 2.8, 3.5][sizeTier];
                        const ry = rx * 1.28;                     // taller than wide
                        const oc = cy - ry - 1.5;                 // oval centre y (above trunk)

                        // Perimeter stipple: angular samples scaled to circumference
                        const N = Math.round(8 + rx * 3.5);
                        for (let i = 0; i < N; i++) {
                            const ang = (i / N) * Math.PI * 2 + (((sn >> (i & 7)) & 7) - 3.5) * 0.18;
                            if (((sn >> (20 + (i & 3))) & 5) === 0) continue; // ~17% skip
                            const px = cx + rx * Math.cos(ang);
                            const py = oc + ry * Math.sin(ang);
                            d += `M${f(px)},${f(py)}l 0.01,0 `;
                        }

                        // Interior stipple: grid density balanced for performance
                        const step = 1.5;
                        for (let dy = -ry; dy <= ry; dy += step) {
                            for (let dx = -rx; dx <= rx; dx += step) {
                                if ((dx/rx)*(dx/rx) + (dy/ry)*(dy/ry) > 0.92) continue;
                                let pp = ((Math.round(cx+dx)*1013) ^ (Math.round(oc+dy)*2017)) >>> 0;
                                pp = Math.imul(pp ^ (pp >>> 16), 0x45d9f3b) >>> 0;
                                if ((pp & 7) < 2) continue; // ~25% skip
                                const jx = ((pp >> 8) & 7) * 0.12 - 0.42;
                                const jy = ((pp >> 12) & 7) * 0.12 - 0.42;
                                d += `M${f(cx+dx+jx)},${f(oc+dy+jy)}l 0.01,0 `;
                            }
                        }

                        // Trunk: from bottom of oval to base
                        d += `M${f(cx)},${f(oc + ry)}L${f(cx)},${f(cy)}`;
                    }

                    ds[colorIdx] = d;
                }
            }
        }

        for (let ci = 0; ci < OVAL_COLORS.length; ci++) {
            if (!ds[ci]) continue;
            el('path', {
                d:                ds[ci],
                fill:             'none',
                stroke:           OVAL_COLORS[ci],
                'stroke-width':   '0.9',
                'stroke-linecap': 'round',
                opacity:          '0.33',
            }, gForestMarks);
        }
    }

    // ── Broadleaf tree — round dome canopy, warm olive-green ─────────────────
    _drawBroadleafTree(ctx, x, y, s) {
        // Derive per-tree variation from position hash
        let h = (Math.round(x * 7) * 1013 ^ Math.round(y * 7) * 2017) >>> 0;
        h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;

        // 3 colour variants: dark green, leaf green, olive green
        const FILLS    = ['#4a6b28', '#7aaa48', '#8a9040'];
        const STROKES  = ['#253015', '#304820', '#3a4018'];
        const HILIGHTS = ['#5a8030', '#96c860', '#a0a850'];
        const ci = h % 3;
        const fillC    = FILLS[ci];
        const strokeC  = STROKES[ci];
        const hilightC = HILIGHTS[ci];

        // Shape variants selected from hash (mutually exclusive buckets)
        const bucket = (h >>> 8) % 10;
        const isCloud = bucket === 0;                        // ~10% cloud
        const isBlob  = !isCloud && ((h >>> 12) % 10) === 0; // ~10% irregular blob
        // remaining ~10% of standard domes get stippling
        const isStippled = !isCloud && !isBlob && ((h >>> 16) % 10) === 0;

        // Trunk
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + s * 0.52);
        ctx.strokeStyle = '#4a3820';
        ctx.lineWidth = 1.0;
        ctx.stroke();

        const cy = y - s * 0.18; // canopy centre y

        if (isCloud) {
            // Cloud canopy: 5 overlapping circles forming a bumpy crown
            const lobes = [
                { dx:  0,          dy:  0,          r: s * 0.30 },
                { dx: -s * 0.24,   dy:  s * 0.08,   r: s * 0.22 },
                { dx:  s * 0.24,   dy:  s * 0.08,   r: s * 0.22 },
                { dx: -s * 0.14,   dy: -s * 0.22,   r: s * 0.20 },
                { dx:  s * 0.14,   dy: -s * 0.22,   r: s * 0.20 },
            ];
            ctx.fillStyle = fillC;
            for (const { dx, dy, r } of lobes) {
                ctx.beginPath(); ctx.arc(x + dx, cy + dy, r, 0, Math.PI * 2); ctx.fill();
            }
            ctx.strokeStyle = strokeC; ctx.lineWidth = 0.55;
            for (const { dx, dy, r } of lobes) {
                ctx.beginPath(); ctx.arc(x + dx, cy + dy, r, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.fillStyle = hilightC;
            ctx.beginPath(); ctx.arc(x + s * 0.08, cy - s * 0.28, s * 0.13, 0, Math.PI * 2); ctx.fill();

        } else if (isBlob) {
            // Irregular blob: 9 radial points with varying radius, joined by quadratic curves
            const N = 9;
            const pts = [];
            let bh = h;
            for (let i = 0; i < N; i++) {
                bh = Math.imul(bh ^ (bh >>> 13), 0x45d9f3b) >>> 0;
                const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
                const rk = s * (0.28 + 0.20 * ((bh & 15) / 15));
                pts.push({ px: x + Math.cos(ang) * rk, py: cy + Math.sin(ang) * rk * 0.88 });
            }
            ctx.beginPath();
            const mid0 = { px: (pts[0].px + pts[N-1].px) / 2, py: (pts[0].py + pts[N-1].py) / 2 };
            ctx.moveTo(mid0.px, mid0.py);
            for (let i = 0; i < N; i++) {
                const next = pts[(i + 1) % N];
                const midx = (pts[i].px + next.px) / 2, midy = (pts[i].py + next.py) / 2;
                ctx.quadraticCurveTo(pts[i].px, pts[i].py, midx, midy);
            }
            ctx.closePath();
            ctx.fillStyle = fillC; ctx.strokeStyle = strokeC; ctx.lineWidth = 0.65;
            ctx.fill(); ctx.stroke();
            // Small highlight
            ctx.fillStyle = hilightC;
            ctx.beginPath(); ctx.arc(x + s * 0.10, cy - s * 0.14, s * 0.16, 0, Math.PI * 2); ctx.fill();

        } else {
            // Standard dome canopy
            ctx.beginPath();
            ctx.arc(x, cy, s * 0.42, 0, Math.PI * 2);
            ctx.fillStyle = fillC; ctx.strokeStyle = strokeC; ctx.lineWidth = 0.65;
            ctx.fill(); ctx.stroke();

            // Highlight blob
            ctx.beginPath();
            ctx.arc(x + s * 0.13, cy - s * 0.12, s * 0.25, 0, Math.PI * 2);
            ctx.fillStyle = hilightC; ctx.fill();

            // ~10% of domes: stipple dots scattered inside the crown
            if (isStippled) {
                let sh = h;
                const dR = s * 0.38;
                ctx.fillStyle = strokeC;
                for (let i = 0; i < 22; i++) {
                    sh = Math.imul(sh ^ (sh >>> 13), 0x45d9f3b) >>> 0;
                    const sa = (sh & 255) / 255 * Math.PI * 2;
                    sh = Math.imul(sh ^ (sh >>> 13), 0x45d9f3b) >>> 0;
                    const sr = Math.sqrt((sh & 255) / 255) * dR;
                    ctx.beginPath();
                    ctx.arc(x + Math.cos(sa) * sr, cy + Math.sin(sa) * sr, s * 0.042, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    // ── Conifer tree — three stacked narrow triangular tiers ─────────────────
    // snow=true adds white accumulated-snow caps on each tier (arctic biome)
    _drawConiferTree(ctx, x, y, s, snow = false) {
        // Trunk stub
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.04);
        ctx.lineTo(x, y + s * 0.24);
        ctx.strokeStyle = '#3a2c18';
        ctx.lineWidth = 0.85;
        ctx.stroke();

        // Three tiers — bottom (widest) to top (narrowest)
        const tiers = [
            { yBase: y + s * 0.10, yTip: y - s * 0.28, hw: s * 0.44, fill: '#868e78', stroke: '#283018' },
            { yBase: y - s * 0.15, yTip: y - s * 0.58, hw: s * 0.30, fill: '#969e88', stroke: '#283018' },
            { yBase: y - s * 0.44, yTip: y - s,         hw: s * 0.16, fill: '#a6ae98', stroke: '#283018' },
        ];
        for (const { yBase, yTip, hw, fill, stroke } of tiers) {
            ctx.beginPath();
            ctx.moveTo(x,      yTip);
            ctx.lineTo(x - hw, yBase);
            ctx.lineTo(x + hw, yBase);
            ctx.closePath();
            ctx.fillStyle   = fill;
            ctx.strokeStyle = stroke;
            ctx.lineWidth   = 0.55;
            ctx.fill();
            ctx.stroke();
        }

        // Snow accumulated on each tier — drawn after foliage so it sits on top
        if (snow) {
            ctx.lineWidth = 0.4;
            for (const { yBase, yTip, hw } of tiers) {
                // Snow covers upper ~52% of each tier, slightly narrower than the bough
                const snowBase = yTip + (yBase - yTip) * 0.52;
                const snowHw   = hw * 0.80;
                ctx.beginPath();
                ctx.moveTo(x,           yTip);
                ctx.lineTo(x - snowHw,  snowBase);
                ctx.lineTo(x + snowHw,  snowBase);
                ctx.closePath();
                ctx.fillStyle   = 'rgba(235, 242, 250, 0.92)';
                ctx.strokeStyle = 'rgba(195, 210, 228, 0.55)';
                ctx.fill();
                ctx.stroke();
            }
        }
    }

    // ── Palm tree — curved trunk + radiating drooping fronds ─────────────────
    _drawPalmTree(ctx, x, y, s) {
        // Slightly leaning curved trunk
        const tipX = x + s * 0.07, tipY = y - s * 0.65;
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.22);
        ctx.quadraticCurveTo(x + s * 0.03, y - s * 0.25, tipX, tipY);
        ctx.strokeStyle = '#8a6830';
        ctx.lineWidth   = 1.1;
        ctx.stroke();

        // Six fronds — fixed angles, natural droop via bezier
        const FRONDS = [
            [-2.7, 0.44], [-2.1, 0.48], [-1.5, 0.46],
            [-0.9, 0.44], [-0.3, 0.40], [ 0.3, 0.36],
        ];
        ctx.lineWidth   = 0.75;
        ctx.strokeStyle = '#96a840';
        for (const [ang, lenFrac] of FRONDS) {
            const len = s * lenFrac;
            const ex  = tipX + Math.cos(ang) * len;
            const ey  = tipY + Math.sin(ang) * len + len * 0.14; // droop
            const bx  = tipX + Math.cos(ang) * len * 0.45;
            const by  = tipY + Math.sin(ang) * len * 0.25;
            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.quadraticCurveTo(bx, by, ex, ey);
            ctx.stroke();
        }

        // Crown node
        ctx.beginPath();
        ctx.arc(tipX, tipY, s * 0.07, 0, Math.PI * 2);
        ctx.fillStyle = '#a8b840';
        ctx.fill();
    }

    // ── Swamp tree — weeping willow: tall trunk, rounded crown, cascading strands ──
    _drawSwampTree(ctx, x, y, s) {
        // Trunk — tall, very slight lean
        const tx = x + s * 0.03, ty = y - s * 0.55;
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.12);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = '#4a3a20';
        ctx.lineWidth   = 1.1;
        ctx.stroke();

        // Crown — rounded ellipse of dense foliage
        const crx = tx, cry = ty + s * 0.10;
        ctx.beginPath();
        ctx.ellipse(crx, cry, s * 0.28, s * 0.20, 0, 0, Math.PI * 2);
        ctx.fillStyle   = '#6a8838';
        ctx.strokeStyle = '#2a3818';
        ctx.lineWidth   = 0.55;
        ctx.fill(); ctx.stroke();

        // Lighter highlight blob — gives crown volume
        ctx.beginPath();
        ctx.ellipse(crx - s * 0.07, cry - s * 0.05, s * 0.15, s * 0.11, -0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#88a848';
        ctx.fill();

        // Weeping strands — cascade from crown edge and droop far below ground level
        // x-offsets as fractions of s (negative = left, positive = right)
        const STRAND_X = [-0.24, -0.16, -0.08, 0.00, 0.08, 0.16, 0.22, 0.27];
        ctx.lineWidth   = 0.45;
        ctx.globalAlpha = 0.85;
        for (let i = 0; i < STRAND_X.length; i++) {
            const ox   = STRAND_X[i];
            const sx0  = crx + ox * s;
            // Start at the bottom rim of the crown ellipse at this x offset
            const xFrac = ox / 0.28;
            const sy0  = cry + Math.sqrt(Math.max(0, 1 - xFrac * xFrac)) * s * 0.20;
            // Each strand droops 0.50–0.65s down; outer strands swing slightly outward
            const sLen  = s * (0.50 + Math.abs(ox) * 0.30);
            const swing = ox * s * 0.16;  // outward arc before drooping straight
            ctx.strokeStyle = (i % 2 === 0) ? '#5a7830' : '#6a8840';
            ctx.beginPath();
            ctx.moveTo(sx0, sy0);
            ctx.quadraticCurveTo(sx0 + swing, sy0 + sLen * 0.42, sx0 + swing * 0.45, sy0 + sLen);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // ── Giant fungi — wide-capped mushroom in underdark purples ──────────────
    _drawFungiTree(ctx, x, y, s) {
        // Stalk — thick, tapered, pale grayish-purple
        const stalkBot = y + s * 0.42;
        const stalkTop = y - s * 0.05;
        ctx.beginPath();
        ctx.moveTo(x - s * 0.09, stalkBot);
        ctx.lineTo(x + s * 0.09, stalkBot);
        ctx.lineTo(x + s * 0.055, stalkTop);
        ctx.lineTo(x - s * 0.055, stalkTop);
        ctx.closePath();
        ctx.fillStyle   = '#7e7888';
        ctx.strokeStyle = '#1e1c28';
        ctx.lineWidth   = 0.55;
        ctx.fill(); ctx.stroke();

        // Gill underside — dark shadow at cap base
        ctx.beginPath();
        ctx.ellipse(x, stalkTop + s * 0.04, s * 0.50, s * 0.08, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#222030';
        ctx.fill();

        // Cap dome — wide, convex, dark stone-grey
        const capCy = stalkTop - s * 0.15;
        ctx.beginPath();
        ctx.ellipse(x, capCy, s * 0.48, s * 0.22, 0, 0, Math.PI * 2);
        ctx.fillStyle   = '#3c3848';
        ctx.strokeStyle = '#1c1a24';
        ctx.lineWidth   = 0.65;
        ctx.fill(); ctx.stroke();

        // Bioluminescent highlight — off-centre, gives the glow effect
        ctx.beginPath();
        ctx.ellipse(x - s * 0.09, capCy - s * 0.08, s * 0.18, s * 0.09, -0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#5e5870';
        ctx.fill();

        // Muted grey spots on cap
        ctx.fillStyle = '#7a7682';
        for (const [dx, dy] of [[s*0.12, -s*0.04], [-s*0.19, -s*0.02], [s*0.26, s*0.05]]) {
            ctx.beginPath();
            ctx.arc(x + dx, capCy + dy, s * 0.04, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ── Underdark weed — small ground-level fungus clusters ──────────────────
    _drawUnderdarkWeed(ctx, x, y, s, count = 2) {
        const OFFSETS = [[0, 0], [s * 0.7, s * 0.2], [-s * 0.6, s * 0.15], [s * 0.2, -s * 0.3]];
        const CAPS    = ['#3a3848', '#42405a', '#2e2c3c'];
        for (let i = 0; i < Math.min(count, OFFSETS.length); i++) {
            const sx = x + OFFSETS[i][0];
            const sy = y + OFFSETS[i][1];
            // Stalk
            ctx.beginPath();
            ctx.moveTo(sx - s * 0.07, sy + s * 0.38);
            ctx.lineTo(sx + s * 0.07, sy + s * 0.38);
            ctx.lineTo(sx + s * 0.045, sy + s * 0.04);
            ctx.lineTo(sx - s * 0.045, sy + s * 0.04);
            ctx.closePath();
            ctx.fillStyle = '#5e5c68';
            ctx.fill();
            // Cap
            ctx.beginPath();
            ctx.ellipse(sx, sy, s * 0.28, s * 0.13, 0, 0, Math.PI * 2);
            ctx.fillStyle = CAPS[i % CAPS.length];
            ctx.fill();
        }
    }

    // ── Farmland — organic field patches above forest layer ───────────────────
    // Rendered to an offscreen canvas and embedded as a single PNG image, avoiding
    // hundreds of individual SVG path elements.
    _drawFarmland(settles = [], _rivers = []) {
        const { gFarmland, hm, W, H } = this;
        const biomeId = this.biomeId;

        if (biomeId !== 'the_midlands' && biomeId !== 'the_gleam_havens') return;
        if (settles.length === 0) return;

        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(W);
        canvas.height = Math.round(H);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Opaque earthy field colors — no transparency so each blob paints solidly
        // over whatever is beneath (boolean NOT behaviour: only the topmost blob shows
        // in any overlap area)
        const COLORS = [
            '#cbb357', '#b8a048', '#a5883f', '#8b6b3b',
            '#725731', '#698f42', '#7d9f4f', '#91a85b',
        ];

        const { hexW, hexR, rowH } = this;
        const SL      = this.SL;
        const isPlains = biomeId === 'the_midlands';

        // Blob radii — range gives visual size variety within a single cluster
        const BLOB_R_MIN = hexW * 0.11;
        const BLOB_R_MAX = hexW * 0.28;

        // How far from the settlement center the cluster may expand
        const CLUSTER_PX = isPlains ? hexW * 81 : hexW * 5.5;

        // pixel → hex cell (odd-r pointy-top)
        const pxToHex = (px, py) => {
            const gr = Math.round((py - hexR) / rowH);
            const gc = Math.round(px / hexW - 0.5 - 0.5 * (gr & 1));
            return { gc, gr };
        };

        // ── Exclusion sets: forests, lakes ────────────────────────────────────
        const badCells = new Set();
        for (const { c: fc, r: fr, radius } of (this.forests ?? [])) {
            const R = Math.ceil(radius), R2 = radius * radius;
            for (let dr = -R; dr <= R; dr++)
                for (let dc = -R; dc <= R; dc++)
                    if (dc * dc + dr * dr <= R2)
                        badCells.add((fr + dr) * hm.cols + (fc + dc));
        }
        const LAKE_R = 3, LAKE_R2 = LAKE_R * LAKE_R;
        for (const { c: lc, r: lr } of (this.lakes ?? [])) {
            for (let dr = -LAKE_R; dr <= LAKE_R; dr++)
                for (let dc = -LAKE_R; dc <= LAKE_R; dc++)
                    if (dc * dc + dr * dr <= LAKE_R2)
                        badCells.add((lr + dr) * hm.cols + (lc + dc));
        }

        // Valid farmland cell: land, not mountain, not coast, not forest/lake,
        // and low elevation (farmland only on flat low-lying terrain)
        const isValid = (gc, gr) => {
            if (gc < 0 || gc >= hm.cols || gr < 0 || gr >= hm.rows) return false;
            if (!hm.isLand(gc, gr) || hm.isMountain(gc, gr) || hm.isCoast(gc, gr)) return false;
            if (badCells.has(gr * hm.cols + gc)) return false;
            return (hm.get(gc, gr) - SL) <= 0.18;
        };

        // Draw one opaque blob onto the canvas and return its placed record.
        // Uses the same Catmull-Rom closed-curve math as closedCatmullPath() but
        // via ctx.bezierCurveTo — no SVG DOM elements created.
        const drawBlob = (cx, cy, colorIdx) => {
            const t = this._rng();
            const blobR = BLOB_R_MIN + t * t * (BLOB_R_MAX - BLOB_R_MIN);
            const N = 6 + (this._rng() > 0.55 ? 1 : 0);
            const pts = [];
            for (let i = 0; i < N; i++) {
                const ang = (i / N) * Math.PI * 2 + this.r(-0.45, 0.45);
                const jit = blobR * (0.60 + this._rng() * 0.50);
                pts.push({ x: cx + Math.cos(ang) * jit, y: cy + Math.sin(ang) * jit });
            }
            const n = pts.length;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 0; i < n; i++) {
                const p0 = pts[(i - 1 + n) % n], p1 = pts[i];
                const p2 = pts[(i + 1) % n],     p3 = pts[(i + 2) % n];
                ctx.bezierCurveTo(
                    p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
                    p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
                    p2.x, p2.y
                );
            }
            ctx.closePath();
            ctx.fillStyle   = COLORS[colorIdx % COLORS.length];
            ctx.strokeStyle = '#3a4c18';
            ctx.lineWidth   = 0.45;
            ctx.fill();
            ctx.stroke();
            return { x: cx, y: cy, r: blobR };
        };

        // ── Per-settlement cluster growth ─────────────────────────────────────
        // Algorithm: BFS-style organic growth.
        // Each new blob is placed touching an existing blob (distance ≈ r_parent + r_new).
        // 95% of blobs placed this way → tight connected cluster.
        // 5% placed as an outlier randomly within CLUSTER_PX → occasional stray field.

        for (const s of settles) {
            if (!isValid(s.c, s.r)) continue;

            const target = isPlains
                ? (s.type === 'city' ? 630 : s.type === 'town' ? 405 : 198)
                : (s.type === 'city' ? 32 : s.type === 'town' ? 20 : 10);

            // Seed: settlement pixel center
            const cluster = [{ x: s.x, y: s.y, r: (BLOB_R_MIN + BLOB_R_MAX) * 0.5 }];
            let colorCursor = Math.floor(this._rng() * COLORS.length);
            let count = 0;

            for (let attempt = 0; attempt < target * 60 && count < target; attempt++) {
                let cx, cy;

                if (this._rng() < 0.05 || cluster.length === 1) {
                    // 5% outlier: random point inside CLUSTER_PX
                    const ang  = this._rng() * Math.PI * 2;
                    const dist = Math.sqrt(this._rng()) * CLUSTER_PX * 0.85;
                    cx = s.x + Math.cos(ang) * dist;
                    cy = s.y + Math.sin(ang) * dist;
                } else {
                    // 95% adjacent: pick a random blob already in cluster as parent,
                    // then place new blob just touching it
                    const pi = Math.floor(this._rng() * Math.min(cluster.length, 12 + count * 2));
                    const parent = cluster[pi];
                    const ang  = this._rng() * Math.PI * 2;
                    // New blob radius (unknown yet — approximate with mid-size)
                    const approxR = BLOB_R_MIN + (BLOB_R_MIN + BLOB_R_MAX) * 0.35;
                    // Place center so blobs just touch (slight overlap allowed)
                    const dist = parent.r + approxR * (0.55 + this._rng() * 0.65);
                    cx = parent.x + Math.cos(ang) * dist;
                    cy = parent.y + Math.sin(ang) * dist;
                }

                // Must be within cluster radius of settlement
                const dx = cx - s.x, dy = cy - s.y;
                if (dx * dx + dy * dy > CLUSTER_PX * CLUSTER_PX) continue;

                const { gc, gr } = pxToHex(cx, cy);
                if (!isValid(gc, gr)) continue;

                const placed = drawBlob(cx, cy, colorCursor);
                cluster.push(placed);
                colorCursor++;
                count++;
            }
        }

        // ── Hedge stipple — outer border of farmland clusters ─────────────────
        // Read back the rendered pixels; any farmland pixel with at least one
        // non-farmland (transparent) neighbour is on the outer edge.  A randomly
        // sampled ~30 % of those pixels get a single-pixel dark-green hedge mark
        // written directly into the imageData — fully opaque, single putImageData.
        // Blobs are also faded to 70 % alpha against the background here; boolean
        // NOT between blobs is preserved because each pixel holds exactly one blob
        // colour drawn at full opacity before this reduction step.
        {
            const idat = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const px   = idat.data;
            const cW   = canvas.width, cH = canvas.height;
            const HR = 42, HG = 58, HB = 18; // #2a3a12 — dark hedge green

            // Reduce all farmland pixels to 70 % opacity against background
            for (let i = 3; i < px.length; i += 4)
                if (px[i] > 10) px[i] = Math.round(px[i] * 0.70);

            const isFarm = (x, y) =>
                x >= 0 && x < cW && y >= 0 && y < cH &&
                px[(y * cW + x) * 4 + 3] > 10;

            // First pass: collect outer-edge pixels so we don't contaminate the scan
            const edge = [];
            for (let y = 1; y < cH - 1; y++) {
                for (let x = 1; x < cW - 1; x++) {
                    if (!isFarm(x, y)) continue;
                    if (isFarm(x+1,y) && isFarm(x-1,y) &&
                        isFarm(x,y+1) && isFarm(x,y-1)) continue;
                    // Deterministic stipple — ~30 % pass
                    let n = ((x * 1031) ^ (y * 2053)) >>> 0;
                    n = (Math.imul(n ^ (n >>> 16), 0x45d9f3b)) >>> 0;
                    if (n > 0x4CCCCCCC) continue;
                    edge.push(x, y);
                }
            }

            // Second pass: paint single-pixel opaque hedge dots
            for (let i = 0; i < edge.length; i += 2) {
                const ex = edge[i], ey = edge[i + 1];
                const idx = (ey * cW + ex) * 4;
                px[idx] = HR; px[idx+1] = HG; px[idx+2] = HB; px[idx+3] = 255;
            }
            ctx.putImageData(idat, 0, 0);
        }

        // Embed the fully-rendered farmland canvas as a single SVG image
        el('image', { href: canvas.toDataURL('image/png'), x: 0, y: 0, width: W, height: H }, gFarmland);
    }

    // ── Hills ─────────────────────────────────────────────────────────────────
    _genHills() {
        const { hm } = this;
        const { cols, rows } = hm;
        const hexW = this.hexW, rowH = this.rowH;
        const SL = this.SL, MO = hm.mountainOffset;

        const biomeHillMult = {
            the_midlands:         0.50,
            the_sanctuary_lands:  0.85,
            the_dark_forests:     0.65,
            the_eternal_winds:    0.45,
            the_badlands:         0.25,
            the_outer_steppes:    0.80,
            the_blinding_lands:   0.75,
            the_gleam_havens:     0.40,
            the_boglands:         0.20,
            the_forgotten_kingdom:0.60,
        }[this.biomeId] ?? 0.60;

        const mountainScale = Math.max(0.4, 1.5 - MO / 0.35);
        const densityMult   = biomeHillMult * mountainScale;

        const hills  = [];
        const placed = [];
        const MIN_D2 = (hexW * 2.2) * (hexW * 2.2);

        const tryPlace = (c, r, hn) => {
            if (c < 0 || c >= cols || r < 0 || r >= rows) return;
            if (!hm.isLand(c, r) || hm.isMountain(c, r)) return;
            const elev = hm.get(c, r) - SL;
            if (elev < 0.04) return;

            const { x: cx, y: cy } = this.hexCenter(c, r);
            if (placed.some(p => (cx - p.x) ** 2 + (cy - p.y) ** 2 < MIN_D2)) return;

            const elevFrac = Math.min(1, elev / MO);
            const humpKey  = (hn >> 16) & 0xFF;
            const numHumps = humpKey < 155 ? 1 : humpKey < 225 ? 2 : 3;

            const jx = (((hn >> 8)  & 0xFF) / 255 - 0.5) * hexW * 0.45;
            const jy = (((hn >> 20) & 0xFF) / 255 - 0.5) * rowH * 0.35;

            // Wide size variation: 0.55× to 2.0× base
            const sizeMult = 0.55 + ((hn & 0xFF) / 255) * 1.45;
            const symW = hexW * (1.1 + elevFrac * 1.0) * sizeMult;
            const symH = rowH * (0.38 + elevFrac * 0.48) * sizeMult;

            hills.push({ x: cx + jx, y: cy + jy, elevFrac, numHumps, seed: hn, symW, symH });
            placed.push({ x: cx, y: cy });
        };

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const h = hm.get(c, r);
                if (!hm.isLand(c, r) || hm.isMountain(c, r)) continue;
                const elev = h - SL;
                if (elev < 0.04) continue;

                let hn = ((c * 1013) ^ (r * 2017)) >>> 0;
                hn = Math.imul(hn ^ (hn >>> 16), 0x45d9f3b) >>> 0;
                hn = Math.imul(hn ^ (hn >>> 13), 0x9e3779b9) >>> 0;

                const elevFrac = Math.min(1, elev / MO);
                const prob = densityMult * (0.06 + elevFrac * 0.13);
                if ((hn & 0xFFFF) / 0xFFFF > prob) continue;

                tryPlace(c, r, hn);

                // Clustering: ~25% chance to spawn 1–2 satellite hills nearby
                if (((hn >> 24) & 0xFF) < 64) {
                    const nSat = 1 + (((hn >> 22) & 1));
                    for (let si = 0; si < nSat; si++) {
                        let sh = Math.imul(hn ^ (si * 0x9e3779b9), 0x45d9f3b) >>> 0;
                        const dc = (((sh) & 0xF) % 5) - 2;
                        const dr = (((sh >> 4) & 0xF) % 5) - 2;
                        sh = Math.imul(sh ^ (sh >>> 16), 0x45d9f3b) >>> 0;
                        tryPlace(c + dc, r + dr, sh);
                    }
                }
            }
        }
        return hills;
    }

    _drawHills(hills) {
        if (!hills.length) return;
        const { gHills, W, H } = this;
        const hexW = this.hexW, rowH = this.rowH;
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(W);
        canvas.height = Math.round(H);
        const ctx = canvas.getContext('2d');

        const pal   = this.biomePalette ?? {};
        const cLow  = pal.landLow  ?? [175, 188, 145];
        const cMid  = pal.landMid  ?? [190, 203, 162];
        const cHigh = pal.landHigh ?? [208, 212, 182];

        const lerpRgb = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
        const clamp   = v => Math.max(0, Math.min(255, v));
        const toHex   = rgb => '#' + rgb.map(v => clamp(v).toString(16).padStart(2, '0')).join('');

        ctx.lineCap = 'round';

        // Sort north-first so southern hills are drawn last and their
        // destination-out erase correctly removes northern hill peaks behind them.
        const sortedHills = hills.slice().sort((a, b) => a.y - b.y);

        sortedHills.forEach(({ x, y, elevFrac, numHumps, seed, symW, symH }) => {
            const t    = Math.min(1, elevFrac * 1.4);
            const base = t < 0.5
                ? lerpRgb(cLow, cMid, t * 2)
                : lerpRgb(cMid, cHigh, (t - 0.5) * 2);

            // Colour variants
            const outlineCol = toHex(base.map(v => Math.round(v * 0.62)));
            const shadeCol   = toHex(base.map(v => Math.round(v * 0.50)));
            const grassCol   = toHex(base.map((v, i) => Math.round(v * (i === 1 ? 0.72 : 0.58))));
            const dotCol     = toHex(base.map(v => Math.round(v * 0.60)));

            let s = seed;
            const next = () => { s = Math.imul(s ^ (s >>> 13), 0x45d9f3b) >>> 0; return s; };
            const rf   = () => (next() & 0xFFFF) / 0xFFFF; // 0..1

            for (let hi = 0; hi < numHumps; hi++) {
                const sn = next();
                const humpOffX   = (hi - (numHumps - 1) / 2) * symW * 0.47;
                const humpW      = symW * (0.58 + ((sn & 0xFF) / 255) * 0.52);
                const centrality = 1 - Math.abs(hi - (numHumps - 1) / 2) / Math.max(1, numHumps - 1);
                const humpH      = symH * (0.52 + centrality * 0.34 + (((sn >> 8) & 0xFF) / 255) * 0.22);
                const asym       = (((sn >> 16) & 0xFF) / 255 - 0.5) * 0.26;
                const x0  = x + humpOffX - humpW * (0.50 + asym);
                const x2  = x + humpOffX + humpW * (0.50 - asym);
                const cpx = x + humpOffX + (((sn >> 20) & 0xFF) / 255 - 0.5) * humpW * 0.20;
                const cpy = y - humpH;

                // ── 0. Boolean NOT — erase any northern hill peeking through ─
                ctx.save();
                ctx.globalCompositeOperation = 'destination-out';
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.moveTo(x0, y);
                ctx.quadraticCurveTo(cpx, cpy, x2, y);
                ctx.lineTo(x0, y);
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                // ── 1. Outline arc ────────────────────────────────────────────
                ctx.globalAlpha = 0.30;
                ctx.strokeStyle = outlineCol;
                ctx.lineWidth   = 0.80;
                ctx.beginPath();
                ctx.moveTo(x0, y);
                ctx.quadraticCurveTo(cpx, cpy, x2, y);
                ctx.stroke();

                // ── 2. Stippled shading — dots inside arc, denser on shadow (right) side
                ctx.fillStyle = shadeCol;
                const SHADE_N = Math.round(8 + humpW / hexW * 6);
                for (let d = 0; d < SHADE_N; d++) {
                    const tp  = rf(); // parametric t along arc
                    // Bezier point on arc
                    const bx  = (1-tp)*(1-tp)*x0 + 2*(1-tp)*tp*cpx + tp*tp*x2;
                    const by  = (1-tp)*(1-tp)*y   + 2*(1-tp)*tp*cpy + tp*tp*y;
                    const depFrac = rf();           // how far below arc (0=arc, 1=base)
                    const dx  = bx + (rf() - 0.5) * humpW * 0.06;
                    const dy  = by + depFrac * (y - by) * 0.85;
                    // Shadow side (right, tp>0.5) gets stronger alpha
                    const shadowBias = Math.max(0, (tp - 0.35) * 1.3);
                    ctx.globalAlpha = 0.30 * (0.25 + shadowBias * 0.55);
                    const r = 0.30 + depFrac * 0.28;
                    ctx.beginPath();
                    ctx.arc(dx, dy, r, 0, Math.PI * 2);
                    ctx.fill();
                }

                // ── 3. Scatter ambient stipple dots around the symbol ─────────
                ctx.fillStyle = dotCol;
                const SCATTER_N = Math.round(5 + humpW / hexW * 3);
                for (let d = 0; d < SCATTER_N; d++) {
                    const sx = x0 + rf() * (x2 - x0);
                    const sy = y - rf() * humpH * 0.9;
                    ctx.globalAlpha = 0.10 + rf() * 0.12;
                    ctx.beginPath();
                    ctx.arc(sx, sy, 0.28 + rf() * 0.28, 0, Math.PI * 2);
                    ctx.fill();
                }

                // ── 4. Grass straws at the base ───────────────────────────────
                ctx.strokeStyle  = grassCol;
                ctx.lineWidth    = 0.55;
                const GRASS_N = Math.round(4 + humpW / hexW * 5);
                for (let g = 0; g < GRASS_N; g++) {
                    const gx    = x0 + rf() * (x2 - x0);
                    const gy    = y + (rf() - 0.5) * rowH * 0.12;
                    const gh    = 1.4 + rf() * 2.2;
                    const lean  = (rf() - 0.5) * 1.0;
                    ctx.globalAlpha = 0.22 + rf() * 0.14;
                    ctx.beginPath();
                    ctx.moveTo(gx, gy);
                    ctx.lineTo(gx + lean, gy - gh);
                    ctx.stroke();
                }
            }
        });

        ctx.globalAlpha = 1;
        el('image', { href: canvas.toDataURL('image/png'), x: 0, y: 0, width: W, height: H }, gHills);
    }

    // ── Mountain peaks ────────────────────────────────────────────────────────
    _genPeaks() {
        const { hm } = this;
        const cw = this.hexW, ch = this.rowH;
        const { cols, rows } = hm;
        const peaks = [];

        // Biomes where snow is never shown
        const NO_SNOW = new Set(['the_badlands', 'the_blinding_lands', 'the_forgotten_kingdom', 'the_gleam_havens']);
        const snowOk  = !NO_SNOW.has(this.biomeId) && (this.biomePalette?.snowPeaks ?? true);

        const isMtn = (c, r) =>
            c >= 1 && c < cols - 1 && r >= 1 && r < rows - 1 && hm.isMountain(c, r);

        // ── Step 1: connected-component clustering (8-connected flood fill) ───
        const visited = new Uint8Array(cols * rows);
        const clusters = [];

        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                if (!isMtn(c, r) || visited[r * cols + c]) continue;
                const cluster = [];
                const stack = [[c, r]];
                visited[r * cols + c] = 1;
                while (stack.length) {
                    const [cc, cr] = stack.pop();
                    cluster.push([cc, cr]);
                    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                        if (!dr && !dc) continue;
                        const nc = cc + dc, nr = cr + dr;
                        if (isMtn(nc, nr) && !visited[nr * cols + nc]) {
                            visited[nr * cols + nc] = 1;
                            stack.push([nc, nr]);
                        }
                    }
                }
                clusters.push(cluster);
            }
        }

        // ── Step 2: per-cluster — PCA axis → spine → flank placement ─────────
        const tierSizeScale = [1, 0.35, 0.50, 0.70, 0.88, 1.05, 1.20];

        // Shared pixel-space exclusion list so clusters don't crowd each other
        const placed = [];   // {px, py, exR}
        const tooClose = (px, py, exR) => {
            for (const p of placed)
                if ((px - p.px) ** 2 + (py - p.py) ** 2 < (exR + p.exR) ** 2) return true;
            return false;
        };

        const mountainMult = this.biomeMult?.mountain ?? 1;

        for (const cluster of clusters) {
            const n = cluster.length;
            if (n === 0) continue;

            // Skip cluster proportional to mountainMult — reduces icon count alongside terrain area
            if (mountainMult < 1) {
                let hn = ((cluster[0][0] * 1013) ^ (cluster[0][1] * 2017)) >>> 0;
                hn = Math.imul(hn ^ (hn >>> 16), 0x45d9f3b) >>> 0;
                if ((hn / 0xFFFFFFFF) > mountainMult) continue;
            }

            const elevs = cluster.map(([c, r]) => hm.get(c, r));
            // ── PCA: elevation-weighted centroid + covariance ─────────────────
            let wS = 0, cxA = 0, cyA = 0;
            for (let i = 0; i < n; i++) {
                const w = Math.max(0, elevs[i] - SEA_LEVEL);
                cxA += w * cluster[i][0]; cyA += w * cluster[i][1]; wS += w;
            }
            if (wS < 1e-9) { cxA = cluster[0][0]; cyA = cluster[0][1]; }
            else { cxA /= wS; cyA /= wS; }

            let Cxx = 0, Cxy = 0, Cyy = 0;
            for (let i = 0; i < n; i++) {
                const w = Math.max(0, elevs[i] - SEA_LEVEL);
                const dx = cluster[i][0] - cxA, dy = cluster[i][1] - cyA;
                Cxx += w * dx * dx; Cxy += w * dx * dy; Cyy += w * dy * dy;
            }
            if (wS > 0) { Cxx /= wS; Cxy /= wS; Cyy /= wS; }

            const tr  = Cxx + Cyy;
            const det = Cxx * Cyy - Cxy * Cxy;
            const lam = tr / 2 + Math.sqrt(Math.max(0, (tr / 2) ** 2 - det));
            const aDen = Math.hypot(lam - Cyy, Cxy);
            // Principal axis unit vector — if degenerate (point cluster) default to x-axis
            const axX = aDen > 1e-9 ? (lam - Cyy) / aDen : 1;
            const axY = aDen > 1e-9 ? Cxy / aDen : 0;

            // Project each cell onto axis; get t range
            const projs = cluster.map(([c, r]) => (c - cxA) * axX + (r - cyA) * axY);
            let tMin = projs[0], tMax = projs[0];
            for (const t of projs) { if (t < tMin) tMin = t; if (t > tMax) tMax = t; }
            const axRange = tMax - tMin || 1;

            // ── Spine peaks: meandering walk along axis ────────────────────────
            // Random-walk perpendicular displacement creates curved, natural chains.
            // Small maps (cols≤80) get a tighter step — fewer cells per cluster
            // means density must be higher to fill the range visually.
            const SPINE_STEP = (cols <= 80 ? 0.20 : 0.26) / Math.max(1, mountainMult);
            const nSpineSteps = Math.max(2, Math.ceil((tMax - tMin) / SPINE_STEP));
            const dispMax = Math.min(2.8, axRange * 0.38);
            let perpDisp = 0;

            const placePeak = (tcx, tcy, tNorm, minor, tierCap) => {
                const bell  = Math.sin(Math.PI * Math.max(0, Math.min(1, tNorm)));
                let bestI = -1, bestScore = -Infinity;
                for (let i = 0; i < n; i++) {
                    const dc = cluster[i][0] - tcx, dr = cluster[i][1] - tcy;
                    const d2 = dc * dc + dr * dr;
                    if (d2 > (SPINE_STEP * 2.6) ** 2) continue;
                    const score = elevs[i] - Math.sqrt(d2) * 0.22;
                    if (score > bestScore) { bestScore = score; bestI = i; }
                }
                if (bestI < 0) return;

                const [c, r] = cluster[bestI];
                const elev   = elevs[bestI];
                const hFrac  = Math.max(0, (elev - (SEA_LEVEL + 0.28)) / 0.5);
                const cRank  = minor ? 0.30 + bell * 0.35 : 0.55 + bell * 0.45;

                let tier = typeof clusterTier === 'function'
                    ? clusterTier(hFrac, cRank)
                    : Math.max(1, Math.min(6, Math.round(1 + hFrac * 5)));
                if (tierCap) tier = Math.min(tier, tierCap);
                const ss  = (tierSizeScale[tier] ?? 1) * (minor ? 0.42 + bell * 0.38 : 0.72 + bell * 0.55);
                const {x: _hpx, y: _hpy} = this.hexCenter(c, r);
                const px  = _hpx + this.r(-0.22, 0.22) * cw;
                const py  = _hpy + this.r(-0.22, 0.22) * ch;
                const seed = Math.imul((c * 1013) ^ (r * 2017), 0x9e3779b9) >>> 0;
                // Seed-based width multiplier: 0.68×–1.42× for visual variety
                const widthMult = 0.68 + ((seed & 127) / 127) * 0.74;
                const pw  = (minor ? 14 + hFrac * 16 : 18 + hFrac * 22) * ss * widthMult;
                const ph  = (minor ? 17 + hFrac * 20 : 22 + hFrac * 28) * ss;
                // Exclusion radius — spread peaks enough so they don't pile up
                const exRFactor = cols <= 80 ? (minor ? 0.28 : 0.22) : (minor ? 0.32 : 0.26);
                const exR = pw * exRFactor;

                if (tooClose(px, py, exR)) return;
                if (this.riverCells?.has(r * hm.cols + c)) return;
                if (this.majorRoadCells?.has(r * hm.cols + c)) return;

                // Snow only on the largest central peaks; excluded in hot/dark biomes
                const isSnow = !minor && snowOk && tier >= 5 && cRank >= 0.60;
                peaks.push({
                    x: px, y: py, h: ph, w: pw, tier,
                    profileIdx: seed, seed,   // _drawPeakCanvas does % profiles.length
                    snow: isSnow,
                    minor,
                });
                placed.push({ px, py, exR });
            };

            for (let si = 0; si <= nSpineSteps; si++) {
                const t = tMin + (si / nSpineSteps) * (tMax - tMin);
                // Mean-reverting random walk (Ornstein-Uhlenbeck style)
                perpDisp = perpDisp * 0.60 + (this._rng() - 0.5) * dispMax * 0.95;
                perpDisp = Math.max(-dispMax, Math.min(dispMax, perpDisp));
                const tcx = cxA + t * axX + perpDisp * (-axY);
                const tcy = cyA + t * axY + perpDisp * axX;
                placePeak(tcx, tcy, si / nSpineSteps, false, null);
            }

            // ── Branch spine: fork off main axis for large clusters ────────────
            if (n >= 18 && axRange >= 4.5) {
                const branchT    = tMin + axRange * (0.35 + this._rng() * 0.30);
                const branchSign = this._rng() < 0.5 ? 1 : -1;
                const bAng       = (30 + this._rng() * 18) * branchSign * Math.PI / 180;
                const cosB = Math.cos(bAng), sinB = Math.sin(bAng);
                const baxX = axX * cosB - axY * sinB;
                const baxY = axX * sinB + axY * cosB;
                const branchLen  = axRange * (0.35 + this._rng() * 0.22);
                const nBSteps    = Math.max(2, Math.ceil(branchLen / (SPINE_STEP * 1.1)));
                const bStartC    = cxA + branchT * axX;
                const bStartR    = cyA + branchT * axY;
                let bPerpDisp = 0;
                for (let si = 1; si <= nBSteps; si++) {
                    const bt   = (si / nBSteps) * branchLen;
                    bPerpDisp  = bPerpDisp * 0.60 + (this._rng() - 0.5) * 0.9;
                    const tcx  = bStartC + bt * baxX + bPerpDisp * (-baxY);
                    const tcy  = bStartR + bt * baxY + bPerpDisp * baxX;
                    if (this._rng() > 0.72) continue; // keep ~72%
                    placePeak(tcx, tcy, si / nBSteps, true, 4);
                }
            }

            // ── Flank peaks: off-axis cells, smaller, sparser ─────────────────
            // Sort by elevation descending so highest flanks are placed first
            const flankOrder = cluster
                .map((cell, i) => {
                    const perp = Math.abs(
                        (cell[0] - cxA) * (-axY) + (cell[1] - cyA) * axX
                    );
                    return { i, perp };
                })
                .filter(d => d.perp > 0.5)  // exclude only very close spine cells
                .sort((a, b) => elevs[b.i] - elevs[a.i]);

            for (const { i } of flankOrder) {
                if (this._rng() > 0.78) continue;   // keep ~78 %

                const [c, r] = cluster[i];
                const elev   = elevs[i];
                const hFrac  = Math.max(0, (elev - (SEA_LEVEL + 0.28)) / 0.5);
                const tNorm  = (projs[i] - tMin) / axRange;
                const bell   = Math.sin(Math.PI * tNorm);

                const tier = Math.max(1, Math.min(4, typeof mapHeightToTier === 'function'
                    ? mapHeightToTier(hFrac)
                    : Math.max(1, Math.round(1 + hFrac * 3))));
                const ss   = (tierSizeScale[tier] ?? 0.5) * (0.32 + bell * 0.38);
                const {x: _fpx, y: _fpy} = this.hexCenter(c, r);
                const px   = _fpx + this.r(-0.30, 0.30) * cw;
                const py   = _fpy + this.r(-0.30, 0.30) * ch;
                const pw   = (14 + hFrac * 16) * ss;
                const ph   = (17 + hFrac * 20) * ss;
                const exR  = pw * 0.30;

                const seed = Math.imul((c * 1013) ^ (r * 2017), 0x9e3779b9) >>> 0;
                peaks.push({
                    x: px, y: py, h: ph, w: pw, tier,
                    profileIdx: seed % 4, seed,
                    snow: false, minor: true,
                });
                placed.push({ px, py, exR });
            }
        }

        return peaks;
    }

    // ── Peaks — all rasterised to a single canvas for performance ────────────
    // (SVG elements with the displacement filter created hundreds of nodes and
    //  triggered an expensive per-node filter pass — canvas avoids both.)
    _drawPeaks(peaks) {
        if (!peaks.length) return;
        const { gMounts, W, H } = this;

        // Back-to-front sort: peaks with smaller y (further "north") drawn first
        // so southern peaks overlap northern ones naturally.
        const sorted = [...peaks].sort((a, b) => a.y - b.y);

        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(W);
        canvas.height = Math.round(H);
        const ctx = canvas.getContext('2d');
        ctx.lineCap  = 'round';
        ctx.lineJoin = 'round';

        for (const pk of sorted) this._drawPeakCanvas(ctx, pk);

        el('image', { href: canvas.toDataURL('image/png'), x: 0, y: 0, width: W, height: H }, gMounts);
    }

    _drawPeakCanvas(ctx, { x, y, h, w, tier, profileIdx, seed, snow }) {
        const styles = typeof MOUNTAIN_TIER_STYLES !== 'undefined' ? MOUNTAIN_TIER_STYLES : null;
        if (!styles || !styles[tier]) return;
        const style   = styles[tier];
        const profile = style.profiles[profileIdx % style.profiles.length];
        const pts     = profile.pts;
        const splitX  = profile.splitX;

        const pxOf = nx => x - w * 0.5 + nx * w;
        const pyOf = ny => y - ny * h;

        let rs = (seed ^ 0xdeadbeef) >>> 0;
        const rn = () => { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return rs / 4294967296; };

        // ── Build jagged silhouette ─────────────────────────────────────────
        const jagPx  = [0, 0, 0.4, 1.0, 2.0, 3.2, 4.8][tier];
        const jagSub = [0, 0, 0,   1,   2,   2,   3  ][tier];
        const silhouette = [[pxOf(pts[0][0]), pyOf(pts[0][1])]];
        for (let i = 1; i < pts.length; i++) {
            const [x0, y0] = pts[i - 1];
            const [x1, y1] = pts[i];
            for (let s = 1; s <= jagSub; s++) {
                const t   = s / (jagSub + 1);
                const inx = x0 + t * (x1 - x0);
                const iny = y0 + t * (y1 - y0);
                const hScale = Math.max(0, (iny - 0.28) / 0.72);
                const jitter = jagPx * hScale * (rn() < 0.7 ? rn() : -rn() * 0.4);
                silhouette.push([pxOf(inx), pyOf(iny) + jitter]);
            }
            silhouette.push([pxOf(x1), pyOf(y1)]);
        }

        let peakIdx = 0;
        for (let i = 1; i < silhouette.length; i++)
            if (silhouette[i][1] < silhouette[peakIdx][1]) peakIdx = i;
        const peakPt     = silhouette[peakIdx];
        const ridgeBaseX = pxOf(splitX);

        // ── 0. Erase silhouette — block any mountain drawn behind this one ────
        // Painter's algorithm draws north→south, so a southern mountain is drawn
        // last. destination-out erases all pixels from northern mountains inside
        // this silhouette. The extra stroke (4 px) also erases the outline-stroke
        // of any northern peak whose path edge lies just outside this silhouette.
        {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.moveTo(silhouette[0][0], silhouette[0][1]);
            for (let i = 1; i < silhouette.length; i++)
                ctx.lineTo(silhouette[i][0], silhouette[i][1]);
            ctx.closePath();
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.lineCap   = 'round';
            ctx.lineJoin  = 'round';
            ctx.stroke();   // erases outline-bleed outside the filled silhouette
            ctx.restore();
        }

        // ── Per-mountain colour variant — 4 grey tones from seed ────────────
        // [litR, litG, litB,  shadR, shadG, shadB]
        const COL = [
            [236, 226, 210,  82, 70, 56],   // warm sandy grey
            [218, 225, 235,  56, 62, 80],   // cool blue-grey (slate)
            [230, 229, 224,  68, 66, 62],   // neutral stone grey
            [218, 228, 212,  55, 68, 52],   // mossy grey-green
        ];
        const cv = (seed >>> 14) & 3;
        const [lR, lG, lB, sR, sG, sB] = COL[cv];

        // ── 1. Lit face — colour-variant gradient, transparent at base ───────
        ctx.beginPath();
        ctx.moveTo(silhouette[0][0], silhouette[0][1]);
        for (let i = 1; i <= peakIdx; i++)
            ctx.lineTo(silhouette[i][0], silhouette[i][1]);
        ctx.lineTo(ridgeBaseX, y);
        ctx.closePath();
        const litGrad = ctx.createLinearGradient(0, peakPt[1], 0, y);
        litGrad.addColorStop(0,    `rgba(${lR}, ${lG}, ${lB}, 0.90)`);
        litGrad.addColorStop(0.45, `rgba(${lR-8}, ${lG-8}, ${lB-8}, 0.58)`);
        litGrad.addColorStop(0.78, `rgba(${lR-14}, ${lG-14}, ${lB-14}, 0.18)`);
        litGrad.addColorStop(1.0,  `rgba(${lR-18}, ${lG-18}, ${lB-18}, 0.0)`);
        ctx.fillStyle = litGrad;
        ctx.fill();

        // ── 2. Shadow face — colour-variant gradient, transparent at base ────
        ctx.beginPath();
        ctx.moveTo(ridgeBaseX, y);
        ctx.lineTo(peakPt[0], peakPt[1]);
        for (let i = peakIdx + 1; i < silhouette.length; i++)
            ctx.lineTo(silhouette[i][0], silhouette[i][1]);
        ctx.closePath();
        const shadowGrad = ctx.createLinearGradient(0, peakPt[1], 0, y);
        shadowGrad.addColorStop(0,    `rgba(${sR}, ${sG}, ${sB}, 0.54)`);
        shadowGrad.addColorStop(0.40, `rgba(${sR-6}, ${sG-6}, ${sB-6}, 0.30)`);
        shadowGrad.addColorStop(0.75, `rgba(${sR-10}, ${sG-10}, ${sB-10}, 0.10)`);
        shadowGrad.addColorStop(1.0,  `rgba(${sR-12}, ${sG-12}, ${sB-12}, 0.0)`);
        ctx.fillStyle = shadowGrad;
        ctx.fill();

        // ── 3. Hachure lines on shadow face (HDA/Wielink style) ─────────────
        // Parallel diagonal strokes clipped to shadow polygon.
        // Dense & thick at peak, sparse & hairline at base.
        {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(ridgeBaseX, y);
            ctx.lineTo(peakPt[0], peakPt[1]);
            for (let i = peakIdx + 1; i < silhouette.length; i++)
                ctx.lineTo(silhouette[i][0], silhouette[i][1]);
            ctx.closePath();
            ctx.clip();

            // Lines go from upper-left → lower-right at 55° from horizontal
            const tanA  = Math.tan(55 * Math.PI / 180); // ≈ 1.428
            const lx0   = x - w;
            const lx1   = x + w;
            const maxLines = [0, 5, 8, 11, 16, 22, 30][tier];

            ctx.strokeStyle = style.outline.color;
            ctx.lineCap     = 'butt';
            let scanY = peakPt[1];
            for (let li = 0; li < maxLines * 3 && scanY < y - 1; li++) {
                const progress = (scanY - peakPt[1]) / Math.max(1, y - peakPt[1]);
                if (progress > 0.94) break;
                const spacing = 1.4 + progress * 7.5;
                const weight  = Math.max(0.18, (1.6 + tier * 0.20) * (1 - progress * 0.87));
                const alpha   = style.stipple.opacity * Math.max(0.04, 0.92 - progress * 0.88);
                ctx.lineWidth   = weight;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.moveTo(lx0, scanY);
                ctx.lineTo(lx1, scanY + tanA * (lx1 - lx0));
                ctx.stroke();
                scanY += spacing;
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // ── 4. Emphasis line — upper lit-face topline, thick→thin downward ──
        // Inspired by Wielink/Tolkien style: heavy ink on the upper lit slope.
        if (tier >= 2) {
            ctx.save();
            ctx.lineCap  = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = style.outline.color;
            for (let i = 1; i <= peakIdx; i++) {
                const segProg = (silhouette[i][1] - peakPt[1]) / Math.max(1, y - peakPt[1]);
                if (segProg > 0.48) break;
                const lw = style.outline.width * (2.0 - segProg * 3.2);
                if (lw < 0.18) break;
                ctx.lineWidth   = lw;
                ctx.globalAlpha = Math.max(0, 0.78 - segProg * 1.4);
                ctx.beginPath();
                ctx.moveTo(silhouette[i - 1][0], silhouette[i - 1][1]);
                ctx.lineTo(silhouette[i][0],     silhouette[i][1]);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // ── 5. Outline — fades out in lower quarter so base bleeds into terrain
        {
            ctx.lineCap  = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = style.outline.color;
            ctx.lineWidth   = style.outline.width;
            const fadeStart = peakPt[1] + (y - peakPt[1]) * 0.70; // fade begins at 70% down
            ctx.beginPath();
            ctx.moveTo(silhouette[0][0], silhouette[0][1]);
            for (let i = 1; i < silhouette.length; i++) {
                const sy = silhouette[i][1];
                if (sy > fadeStart) {
                    // Fade remaining outline segments segment-by-segment
                    const prog = (sy - fadeStart) / Math.max(1, y - fadeStart); // 0→1
                    ctx.globalAlpha = Math.max(0, 0.88 - prog * 0.88);
                }
                ctx.lineTo(silhouette[i][0], silhouette[i][1]);
            }
            ctx.globalAlpha = 0.88;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // ── 6. Snow cap — prominent white, only on peaks where snow===true ───
        if (snow && style.snowFraction > 0) {
            const snowH = h * (style.snowFraction + 0.06); // extra 6% height
            const snowY = peakPt[1] + snowH;
            const snowW = w * 0.26;   // wide enough to be clearly visible
            ctx.beginPath();
            ctx.moveTo(peakPt[0] - snowW * 0.85, snowY);
            ctx.lineTo(peakPt[0], peakPt[1]);
            ctx.lineTo(peakPt[0] + snowW * 0.70, snowY);
            ctx.closePath();
            ctx.fillStyle   = 'rgba(252, 252, 250, 0.96)';
            ctx.strokeStyle = 'rgba(190, 196, 205, 0.55)';
            ctx.lineWidth   = 0.55;
            ctx.globalAlpha = 1;
            ctx.fill();
            ctx.stroke();
        }
    }

    // ── Settlements ───────────────────────────────────────────────────────────
    // Returns the dominant terrain context at (c, r) for icon selection.
    // Priority: river > coast > forest > swamp > mountain > plains
    // this.riverCells already includes cells within radius 1 of each river path cell.
    _terrainContextAt(c, r) {
        const { hm } = this;
        if (this.riverCells?.has(r * hm.cols + c)) return 'river';
        if (hm.isCoast(c, r))                      return 'coast';
        for (const { c: fc, r: fr, radius } of (this.forests ?? []))
            if ((c - fc) ** 2 + (r - fr) ** 2 <= radius * radius) return 'forest';
        if (this.swampCells?.has(r * hm.cols + c)) return 'swamp';
        if (hm.isMountain(c, r))                   return 'mountain';
        return 'plains';
    }

    _genSettlements(rivers) {
        const { hm } = this;
        const { cols, rows } = hm;

        // Mark river proximity (within 3 cells)
        const riverSet = new Set();
        rivers.forEach(({ path }) =>
            path.forEach(({ c, r }) => {
                for (let dr = -3; dr <= 3; dr++)
                    for (let dc = -3; dc <= 3; dc++)
                        riverSet.add(`${c+dc},${r+dr}`);
            })
        );
        const nearRiver = (c, r) => riverSet.has(`${c},${r}`);
        // Exclude coastal cells so settlement icons don't overhang the shoreline.
        // Ports are placed separately using isCoast directly and are unaffected.
        // Build lake exclusion set — prevent settlements spawning inside lake visuals.
        const LAKE_EXCL_R = 3, LAKE_EXCL_R2 = LAKE_EXCL_R * LAKE_EXCL_R;
        const lakeExclSet = new Set();
        for (const { c: lc, r: lr } of (this.lakes ?? [])) {
            for (let dr = -LAKE_EXCL_R; dr <= LAKE_EXCL_R; dr++)
                for (let dc = -LAKE_EXCL_R; dc <= LAKE_EXCL_R; dc++)
                    if (dc * dc + dr * dr <= LAKE_EXCL_R2)
                        lakeExclSet.add(`${lc+dc},${lr+dr}`);
        }
        const flat = (c, r) => hm.isLand(c, r) && !hm.isMountain(c, r) && !hm.isCoast(c, r)
                             && !lakeExclSet.has(`${c},${r}`);

        // ── Shared terrain sets (used by culture placement rules) ─────────────
        const forestSet = new Set();
        for (const { c: fc, r: fr, radius } of (this.forests ?? [])) {
            const fr2 = Math.ceil(radius);
            for (let dr = -fr2; dr <= fr2; dr++)
                for (let dc = -fr2; dc <= fr2; dc++)
                    if (dc * dc + dr * dr <= radius * radius)
                        forestSet.add(`${fc + dc},${fr + dr}`);
        }
        const inForest = (c, r) => forestSet.has(`${c},${r}`);
        const inSwamp  = (c, r) => !!(this.swampCells?.has(`${c},${r}`));
        // Mountain placement base — land + mountain, no coast, no lake exclusion
        const mtn = (c, r) => hm.isLand(c, r) && hm.isMountain(c, r)
                            && !hm.isCoast(c, r) && !lakeExclSet.has(`${c},${r}`);

        const settles = [];
        const tooClose = (x, y, minD) => settles.some(s => Math.hypot(s.x-x, s.y-y) < minD);

        const tryPlace = (type, test, count, minD, names) => {
            const cands = [];
            for (let r = 2; r < rows-2; r++)
                for (let c = 2; c < cols-2; c++)
                    if (test(c, r)) cands.push([c, r]);
            // Fisher-Yates shuffle
            for (let i = cands.length-1; i > 0; i--) {
                const j = this.ri(0, i);
                [cands[i], cands[j]] = [cands[j], cands[i]];
            }
            let placed = 0;
            for (const [c, r] of cands) {
                if (placed >= count) break;
                const {x, y} = this.hexCenter(c, r);
                if (!tooClose(x, y, minD)) {
                    const chosenName = names[placed % names.length];
                    let cultureTag = null;
                    try {
                        // Prefer per-name source mapping when available (handles mixed pools)
                        const nameMap = names && names._nameSourceMap ? names._nameSourceMap : null;
                        let src = nameMap && nameMap[chosenName] ? String(nameMap[chosenName]) : (names && names._poolSource ? String(names._poolSource) : null);
                        // If a name was marked as 'fallback', prefer the pool's declared source
                        if (src === 'fallback' && names && names._poolSource) src = String(names._poolSource);
                        if (src) cultureTag = src.split('.')[0];
                    } catch (e) { cultureTag = null; }
                    settles.push({ type, name: chosenName, x, y, c, r, culture: cultureTag, terrain_context: this._terrainContextAt(c, r) });
                    placed++;
                }
            }
        };

        // ── Culture-aware name pools ──────────────────────────────────────────
        // Dominant culture drives primary pool; neutral pools fill secondary slots.
        const culture = this.culture ?? 'midlander';
        const biomeId = this.biomeId ?? 'the_midlands';

        // ── Biome hard constraints (absolute rules — block generation on conflict) ─
        if (culture === 'ancients_dark_ones' && biomeId !== 'the_forgotten_kingdom') {
            console.warn('[Leonoria] RULE CONFLICT: Dark Ones settlements may only spawn in the_forgotten_kingdom. No settlements placed. Check your culture/biome selection.');
            return [];
        }
        if (culture === 'midlander' && biomeId === 'the_forgotten_kingdom') {
            console.warn('[Leonoria] RULE CONFLICT: Midlander settlements cannot spawn in the_forgotten_kingdom. No settlements placed. Check your culture/biome selection.');
            return [];
        }
        if (culture === 'mixed' && biomeId === 'the_forgotten_kingdom') {
            console.warn('[Leonoria] RULE CONFLICT: Mixed culture cannot spawn in the_forgotten_kingdom (Dark Ones are subterranean there and excluded from Mixed). Use mixed_forgotten_kingdom. No settlements placed.');
            return [];
        }

        // ── Soft biome-culture warnings (inform but do not block — user may override) ─
        const _biomeExpected = {
            northerner:              ['the_dark_forests'],
            ancients_secluded:       ['the_sanctuary_lands', 'the_midlands'],
            ice_ancients:            ['the_eternal_winds', 'the_dark_forests'],
            ancients_greys:          ['the_gleam_havens'],
            ashen_halfbreeds:        ['the_badlands', 'the_outer_steppes', 'the_blinding_lands'],
            step_folk:               ['the_outer_steppes', 'the_blinding_lands', 'the_badlands'],
            stone_folk:              ['the_dark_forests'],
            wildmen_foresters:       ['the_dark_forests', 'the_sanctuary_lands', 'the_midlands', 'the_gleam_havens', 'the_boglands'],
            wildmen_ravagers:        ['the_dark_forests', 'the_sanctuary_lands', 'the_midlands', 'the_gleam_havens', 'the_boglands', 'the_outer_steppes', 'the_blinding_lands', 'the_badlands', 'the_eternal_winds'],
            oakpeople:               ['the_sanctuary_lands'],
            swampbrood:              ['the_midlands', 'the_dark_forests', 'the_sanctuary_lands', 'the_boglands'],
            mixed_forgotten_kingdom: ['the_forgotten_kingdom'],
            mixed_sanctuary:         ['the_sanctuary_lands'],
            mixed_wildlands:         ['the_outer_steppes', 'the_blinding_lands', 'the_badlands'],
        };
        if (_biomeExpected[culture] && !_biomeExpected[culture].includes(biomeId))
            console.warn(`[Leonoria] Note: culture "${culture}" is not typically found in biome "${biomeId}". Generation continues — verify your selection.`);

        // ── Per-culture placeable test (terrain requirements beyond basic flat land) ─
        const isBoglands = biomeId === 'the_boglands';
        let placeable;
        switch (culture) {
            case 'stone_folk':
                placeable = (c, r) => mtn(c, r);
                break;
            case 'wildmen_foresters':
            case 'wildmen_ravagers':
            case 'oakpeople':
                placeable = (c, r) => flat(c, r) && inForest(c, r);
                break;
            case 'swampbrood':
                // Boglands biome: no terrain restriction. All others: must be swamp.
                placeable = isBoglands
                    ? (c, r) => flat(c, r)
                    : (c, r) => flat(c, r) && inSwamp(c, r);
                break;
            case 'ancients_greys':
                // Prefer river-adjacent or near-coast for inland placements (ports handle true coast)
                placeable = (c, r) => flat(c, r) && nearRiver(c, r);
                break;
            case 'step_folk':
                // Open terrain — no forest, swamp, or mountain
                placeable = (c, r) => flat(c, r) && !inForest(c, r) && !inSwamp(c, r);
                break;
            default:
                placeable = (c, r) => flat(c, r);
        }

        // Primary name pools by culture
        const cityPools = {
            midlander:               ['midlander_settlements.plain_names', 'midlander_settlements.cities'],
            northerner:              ['northerner_settlements.plain_names', 'northerner_settlements.halls'],
            step_folk:               ['step_folk_settlements.plain_names', 'step_folk_settlements.cities'],
            ancients_secluded:       ['secluded_settlements.plain_names', 'secluded_settlements.halls_and_cities'],
            ancients_greys:          ['greys_settlements.plain_names', 'greys_settlements.cities'],
            ancients_dark_ones:      ['dark_ones_settlements.plain_names', 'dark_ones_settlements.cities'],
            ice_ancients:            ['ice_ancients_settlements.plain_names'],
            wildmen_foresters:       ['wildmen_settlements.plain_names'],
            wildmen_ravagers:        ['wildmen_settlements.plain_names', 'wildmen_settlements.strongholds'],
            oakpeople:               ['oakpeople_settlements.plain_names'],
            stone_folk:              ['stone_folk_settlements.plain_names', 'stone_folk_settlements.halls'],
            swampbrood:              ['swampbrood_settlements.plain_names'],
            ashen_halfbreeds:        ['ashen_halfbreeds_settlements.plain_names'],
            // Mixed cultures
            mixed:                   ['midlander_settlements.plain_names', 'northerner_settlements.plain_names',
                                      'step_folk_settlements.plain_names', 'greys_settlements.plain_names',
                                      'ice_ancients_settlements.plain_names', 'stone_folk_settlements.halls'],
            mixed_forgotten_kingdom: ['dark_ones_settlements.plain_names', 'dark_ones_settlements.cities',
                                      'stone_folk_settlements.plain_names', 'stone_folk_settlements.halls'],
            mixed_wildlands:         ['ashen_halfbreeds_settlements.plain_names', 'step_folk_settlements.plain_names',
                                      'wildmen_settlements.strongholds', 'wildmen_settlements.plain_names'],
            mixed_sanctuary:         ['secluded_settlements.plain_names', 'secluded_settlements.halls_and_cities'],
        };
        const townPools = {
            midlander:               ['midlander_settlements.plain_names', 'midlander_settlements.towns'],
            northerner:              ['northerner_settlements.plain_names', 'northerner_settlements.towns'],
            step_folk:               ['step_folk_settlements.plain_names', 'step_folk_settlements.towns'],
            ancients_secluded:       ['secluded_settlements.plain_names', 'secluded_settlements.groves_and_sanctuaries'],
            ancients_greys:          ['greys_settlements.plain_names', 'greys_settlements.towns'],
            ancients_dark_ones:      ['dark_ones_settlements.plain_names', 'dark_ones_settlements.towns'],
            ice_ancients:            ['ice_ancients_settlements.plain_names', 'ice_ancients_settlements.villages'],
            wildmen_foresters:       ['wildmen_settlements.plain_names', 'wildmen_settlements.camps_and_warbands'],
            wildmen_ravagers:        ['wildmen_settlements.plain_names', 'wildmen_settlements.raids_and_outposts'],
            oakpeople:               ['oakpeople_settlements.plain_names', 'oakpeople_settlements.villages'],
            stone_folk:              ['stone_folk_settlements.plain_names', 'stone_folk_settlements.towns'],
            swampbrood:              ['swampbrood_settlements.plain_names', 'swampbrood_settlements.villages'],
            ashen_halfbreeds:        ['ashen_halfbreeds_settlements.plain_names', 'ashen_halfbreeds_settlements.villages'],
            // Mixed cultures
            mixed:                   ['midlander_settlements.towns', 'northerner_settlements.towns',
                                      'step_folk_settlements.towns', 'greys_settlements.towns'],
            mixed_forgotten_kingdom: ['dark_ones_settlements.towns', 'stone_folk_settlements.towns',
                                      'dark_ones_settlements.plain_names'],
            mixed_wildlands:         ['ashen_halfbreeds_settlements.plain_names', 'step_folk_settlements.towns',
                                      'wildmen_settlements.raids_and_outposts'],
            mixed_sanctuary:         ['secluded_settlements.plain_names', 'secluded_settlements.groves_and_sanctuaries'],
        };
        const villagePools = {
            midlander:               ['midlander_settlements.villages'],
            northerner:              ['northerner_settlements.villages'],
            step_folk:               ['step_folk_settlements.villages'],
            ancients_secluded:       ['secluded_settlements.villages'],
            ancients_greys:          ['greys_settlements.villages'],
            ancients_dark_ones:      ['dark_ones_settlements.villages'],
            ice_ancients:            ['ice_ancients_settlements.villages'],
            wildmen_foresters:       ['wildmen_settlements.camps_and_warbands'],
            wildmen_ravagers:        ['wildmen_settlements.camps_and_warbands', 'wildmen_settlements.raids_and_outposts'],
            oakpeople:               ['oakpeople_settlements.villages'],
            stone_folk:              ['stone_folk_settlements.villages', 'stone_folk_settlements.mines'],
            swampbrood:              ['swampbrood_settlements.villages'],
            ashen_halfbreeds:        ['ashen_halfbreeds_settlements.villages'],
            // Mixed cultures
            mixed:                   ['midlander_settlements.villages', 'northerner_settlements.villages',
                                      'step_folk_settlements.villages', 'swampbrood_settlements.villages',
                                      'ashen_halfbreeds_settlements.villages'],
            mixed_forgotten_kingdom: ['dark_ones_settlements.villages', 'stone_folk_settlements.villages'],
            mixed_wildlands:         ['ashen_halfbreeds_settlements.villages', 'step_folk_settlements.villages',
                                      'wildmen_settlements.camps_and_warbands'],
            // mixed_sanctuary: secluded villages only here; forest-only Oakspeople/Foresters added separately
            mixed_sanctuary:         ['secluded_settlements.villages', 'secluded_settlements.groves_and_sanctuaries'],
        };
        const portPools = {
            midlander:               ['midlander_settlements.plain_names'],
            northerner:              ['northerner_settlements.plain_names'],
            step_folk:               ['step_folk_settlements.plain_names'],
            ancients_secluded:       ['secluded_settlements.plain_names'],
            ancients_greys:          ['greys_settlements.plain_names'],
            ancients_dark_ones:      ['dark_ones_settlements.plain_names'],
            ice_ancients:            ['ice_ancients_settlements.plain_names'],
            wildmen_foresters:       ['wildmen_settlements.plain_names'],
            wildmen_ravagers:        ['wildmen_settlements.raids_and_outposts', 'wildmen_settlements.plain_names'],
            oakpeople:               ['oakpeople_settlements.plain_names'],
            stone_folk:              ['stone_folk_settlements.plain_names'],
            swampbrood:              ['swampbrood_settlements.plain_names'],
            ashen_halfbreeds:        ['ashen_halfbreeds_settlements.plain_names'],
            // Mixed cultures
            mixed:                   ['midlander_settlements.plain_names', 'northerner_settlements.plain_names',
                                      'step_folk_settlements.plain_names'],
            mixed_forgotten_kingdom: ['dark_ones_settlements.plain_names', 'stone_folk_settlements.plain_names'],
            mixed_wildlands:         ['ashen_halfbreeds_settlements.plain_names', 'step_folk_settlements.plain_names',
                                      'wildmen_settlements.plain_names'],
            mixed_sanctuary:         ['secluded_settlements.plain_names'],
        };

        const cp = cityPools[culture]    ?? cityPools.midlander;
        const tp = townPools[culture]    ?? townPools.midlander;
        const vp = villagePools[culture] ?? villagePools.midlander;
        const pp = portPools[culture]    ?? portPools.midlander;

        const cityNames        = this._pool([...cp], ['Valdris', 'Sorvane', 'Thelindra', 'Kethara']);
        const townNames        = this._pool([...tp], ['Duskford', 'Thornwick', 'Greycross', 'Ashbridge']);
        const portCityNames    = this._pool([...pp], ['Saltmere', 'Greyharbour', 'The Anchorage', 'Wavebreak', 'Tidehaven']);
        const villageNames     = this._pool([...vp], ['Millbrook', 'Ashford', 'Westhollow', 'Dunmere', 'Coldridge']);
        const ruinNames        = this._pool(
            ['ruins.standalone_ruins', 'ruins.descriptive_names'],
            ['The Forgotten Keep', 'Old Thorngate', 'Shadowmere', 'Drakenfeld', 'Ironwatch']);
        const capitalNames     = this._pool([...cp], ['The High Seat', 'Valdris Magna', 'Sorvane', 'Kethara', 'The Crown City', 'Thorngate']);
        const marketTownNames  = this._pool([...tp], ['Crossmarket', 'Fairhaven', 'The Crossing', 'Marketstead', 'Tradewood', 'Bridgeholm']);
        const fishingNames     = this._pool([...vp], ['Saltholm', 'Fishwick', 'Tideway', 'Crabstone', 'Anchoridge', 'Nettleshore']);

        const sc  = this.scale;
        const ss  = (this.params.settlementScale ?? 1.0) * (this.biomeMult?.settlement ?? 1);
        const rs  = (this.params.ruinScale       ?? 0.5) * (this.biomeMult?.ruin       ?? 1);
        const plainsMult = biomeId === 'the_midlands' ? 2 : 1;
        const sn  = v => Math.max(0, Math.round(v * ss * plainsMult));
        const rn  = v => Math.max(0, Math.round(v * rs));

        // ── Water-proximity set for fishing villages ──────────────────────────
        const nearWaterSet = new Set();
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++)
                if (hm.isCoast(c, r))
                    for (let dr = -2; dr <= 2; dr++)
                        for (let dc = -2; dc <= 2; dc++) {
                            const nc = c+dc, nr = r+dr;
                            if (nc >= 0 && nc < cols && nr >= 0 && nr < rows)
                                nearWaterSet.add(`${nc},${nr}`);
                        }
        for (const { c: lc, r: lr } of (this.lakes ?? []))
            for (let dr = -4; dr <= 4; dr++)
                for (let dc = -4; dc <= 4; dc++) {
                    const nc = lc+dc, nr = lr+dr;
                    if (nc >= 0 && nc < cols && nr >= 0 && nr < rows)
                        nearWaterSet.add(`${nc},${nr}`);
                }
        const nearWater = (c, r) => nearWaterSet.has(`${c},${r}`);

        // Ravager/dark races: fortresses replace cities; strongholds replace villages
        const fortressCultures = new Set(['wildmen_ravagers', 'ancients_dark_ones', 'mixed_forgotten_kingdom', 'mixed_wildlands']);
        const cityType    = fortressCultures.has(culture) ? 'fortress' : 'city';
        const villageType = 'village';

        // Mountain races don't require river proximity for their capital/stronghold
        const mountainCulture = culture === 'stone_folk';
        const cityTest = mountainCulture
            ? (c, r) => placeable(c, r)
            : (c, r) => placeable(c, r) && nearRiver(c, r);

        // ── Capital — only one per map, ~55% spawn chance, not for fortress races ──
        const spawnCapital = this._rng() < 0.55 && !fortressCultures.has(culture);
        if (spawnCapital) {
            const centerC = Math.floor(cols / 2), centerR = Math.floor(rows / 2);
            const capRadius = Math.min(cols, rows) * 0.52;
            tryPlace('capital',
                (c, r) => placeable(c, r) && nearRiver(c, r) && Math.hypot(c - centerC, r - centerR) < capRadius,
                1, 280, capitalNames);
        }

        let cityCount = sn(this.ri(1 * sc, 2 * sc));
        // 25% fewer non-capital settlements in midlands
        const midlandsReduction = biomeId === 'the_midlands' ? 0.75 : 1.0;

        tryPlace(cityType,      cityTest,
            cityCount, 170, cityNames);
        // Place port cities before market towns so coastal slots are reserved
        // for true port cities rather than being filled by inland market towns.
        // Helper: distinguish ocean coasts from lake shores.  `lakeExclSet`
        // marks cells occupied by lakes; a coast adjacent only to lake cells
        // should be treated differently (allow fishing villages, not ports).
        const isOceanCoast = (c, r) => {
            if (!hm.isCoast(c, r)) return false;
            const nbrs = (hm._hexNeighbors ? hm._hexNeighbors(c, r) : this._hexNeighbors ? this._hexNeighbors(c, r) : []);
            for (const [nc, nr] of nbrs) {
                if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) return true; // map edge = ocean
                if (hm.isLand(nc, nr)) continue;
                if (!lakeExclSet.has(`${nc},${nr}`)) return true; // adjacent water that's not part of a lake
            }
            return false; // all adjacent water cells (if any) are lake cells
        };

        let portCityCount = Math.round(sn(this.ri(1 * sc, 2 * sc)) * midlandsReduction);
        tryPlace('port_city',   (c, r) => isOceanCoast(c, r),
            portCityCount, 110, portCityNames);
        // New rule: cap the number of standard market towns by map size.
        // Small maps (cols ≤ 80): max 5; Large maps: max 7.
        const baseMaxMarketTowns = (cols <= 80) ? 5 : 7;
        const marketDesired = Math.round(sn(this.ri(1 * sc, 2 * sc)) * midlandsReduction);
        const marketCount = Math.max(0, Math.min(baseMaxMarketTowns, marketDesired));
        tryPlace('market_town', (c, r) => placeable(c, r) && nearRiver(c, r),
            marketCount, 130, marketTownNames);
        let townCount = Math.round(sn(this.ri(3 * sc, 5 * sc)) * (biomeId === 'the_midlands' ? 0.8 : 1.0));
        tryPlace('town',        (c, r) => placeable(c, r),
            townCount, 90, townNames);
        // Fishing villages: only on ocean coasts or on land cells immediately
        // adjacent to lake cells. Ports (ocean ports) remain separate.
        // Increase fishing village attempts so shoreline communities appear more often
        let fishingCount = Math.round(sn(this.ri(2 * sc, 4 * sc)) * midlandsReduction);
        // Helper: test whether a cell is adjacent to a lake cell (using lakeExclSet)
        const isAdjacentToLake = (c, r) => {
            const nbrs = (hm._hexNeighbors ? hm._hexNeighbors(c, r) : this._hexNeighbors ? this._hexNeighbors(c, r) : []);
            for (const [nc, nr] of nbrs) {
                if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
                if (!hm.isLand(nc, nr) && lakeExclSet.has(`${nc},${nr}`)) return true;
            }
            return false;
        };
        // Allow fishing villages only on ocean coast cells or on flat land adjacent to lakes
        tryPlace('fishing_village', (c, r) => isOceanCoast(c, r) || (flat(c, r) && isAdjacentToLake(c, r)),
            fishingCount, 65, fishingNames);

        // Village count: flat 20% reduction across all biomes = multiply by 0.8
        let villageCount = sn(this.ri(12 * sc, 16 * sc));
        villageCount = Math.max(1, Math.round(villageCount * 0.8));
        // Villages must never be inside a lake or adjacent to one.
        tryPlace(villageType,   (c, r) => placeable(c, r) && !lakeExclSet.has(`${c},${r}`) && !isAdjacentToLake(c, r),
            villageCount, 55, villageNames);
        let ruinCount = Math.round(rn(this.ri(2 * sc, 3 * sc)) * midlandsReduction);
        tryPlace('ruin',
            (c, r) => hm.isMountain(c, r) || (flat(c, r) && !nearRiver(c, r)),
            ruinCount, 110, ruinNames);

        // Strongholds — universal warband camps, culture-independent, at least 1 per map
        const strongholdCount = Math.max(1, this.ri(1, 3));
        const strongholdNames = ['Stronghold', 'Warband Camp', 'Palisade', 'Outpost', 'Fortified Camp', 'War Camp', 'Raiders Nest', 'Battle Encampment'];
        tryPlace('stronghold',
            (c, r) => hm.isLand(c, r) && !hm.isCoast(c, r),
            strongholdCount, 120, strongholdNames);


        // ── Secondary races — rank-based proportional distribution ──
        // Multiple races may be present in a biome (e.g. wildmen_foresters + wildmen_ravagers
        // both belong to race 'wildmen'). We group by race, pick ONE representative per race
        // per map, then apply the proportional halving rule to races rather than individual tokens.
        // Rank 1 = dominant (already placed). Rank 2 = 50%, rank 3 = 25%, etc.
        // Minimum 1 settlement per secondary race always guaranteed.
        const CULTURE_TO_RACE = {
            midlander:          'midlander',
            northerner:         'northerner',
            wildmen_foresters:  'wildmen',
            wildmen_ravagers:   'wildmen',
            oakpeople:          'oakpeople',
            stone_folk:         'stone_folk',
            swampbrood:         'swampbrood',
            step_folk:          'step_folk',
            ashen_halfbreeds:   'ashen_halfbreeds',
            ice_ancients:       'ice_ancients',
            ancients_greys:     'ancients_greys',
            ancients_secluded:  'ancients_secluded',
            ancients_dark_ones: 'ancients_dark_ones',
        };
        const dominantRace = CULTURE_TO_RACE[culture] ?? culture;

        // Build ordered race groups from allCultures, skipping dominant race
        const _raceGroupMap = new Map();
        for (const mc of (this.params?.allCultures ?? [])) {
            if (mc.value === culture) continue;
            const race = CULTURE_TO_RACE[mc.value] ?? mc.value;
            if (race === dominantRace) continue;
            if (!_raceGroupMap.has(race)) _raceGroupMap.set(race, []);
            _raceGroupMap.get(race).push(mc);
        }

        // Randomly pick one culture per race for this map
        const allBiomeCultures = [..._raceGroupMap.values()].map(group =>
            group[this.ri(0, group.length - 1)]
        );

        const totalCultures   = allBiomeCultures.length + 1; // +1 for dominant
        const useProportional = totalCultures > 2;

        // HALVING_MULTS: rank 2 = idx 0, rank 3 = idx 1, etc.
        const HALVING_MULTS = [0.50, 0.25, 0.125, 0.0625, 0.03125, 0.015625];

        for (let mcIdx = 0; mcIdx < allBiomeCultures.length; mcIdx++) {
            const mc = allBiomeCultures[mcIdx];
            const mv = mc.value;

            const isRavagerCulture = fortressCultures.has(mv);
            const secVillageType   = 'village';

            let terrainFilter;
            if      (mv === 'wildmen_foresters' || mv === 'wildmen_ravagers' || mv === 'oakpeople') terrainFilter = (c, r) => flat(c, r) && inForest(c, r);
            else if (mv === 'swampbrood')                              terrainFilter = (c, r) => flat(c, r) && inSwamp(c, r);
            else if (mv === 'stone_folk')                              terrainFilter = (c, r) => mtn(c, r);
            else                                                       terrainFilter = (c, r) => placeable(c, r);

            const svp       = villagePools[mv] ?? villagePools.midlander;
            const villNames = this._pool([...svp], ['Millbrook', 'Ashford', 'Westhollow', 'Dunmere', 'Coldridge']);

            if (useProportional) {
                const mult = HALVING_MULTS[Math.min(mcIdx, HALVING_MULTS.length - 1)];

                // Rank 2 only: one chance at a city / stronghold
                if (mcIdx === 0) {
                    const secCityType = isRavagerCulture ? 'fortress' : 'city';
                    const scp     = cityPools[mv] ?? cityPools.midlander;
                    const cityNms = this._pool([...scp], ['Valdris', 'Sorvane', 'Thelindra', 'Kethara']);
                    const cityTest2 = (c, r) => (mv === 'stone_folk' ? mtn(c, r) : terrainFilter(c, r) && nearRiver(c, r));
                    tryPlace(secCityType, cityTest2, sn(this.ri(0, 1 * sc)), 200, cityNms);
                }

                // Towns for ranks 2–4 — proportional to dominant town count
                if (mcIdx <= 2) {
                    const stp      = townPools[mv] ?? townPools.midlander;
                    const twnNames = this._pool([...stp], ['Duskford', 'Thornwick', 'Greycross', 'Ashbridge']);
                    const twnCount = Math.max(0, Math.round(townCount * mult));
                    if (twnCount > 0) tryPlace('town', terrainFilter, twnCount, 100, twnNames);
                }

                // All ranks: villages / camps — proportional to dominant village count, min 1
                const villCount = Math.max(1, Math.round(villageCount * mult));
                tryPlace(secVillageType, terrainFilter, villCount, 60, villNames);

            } else {
                // Two-culture biome: apply same biome reductions as dominant race, minimum 1
                let secVillCount = sn(this.ri(1 * sc, 3 * sc));
                if (biomeId === 'the_midlands') secVillCount = Math.max(1, Math.round(secVillCount * 0.7));
                tryPlace(secVillageType, terrainFilter,
                    secVillCount, 65, villNames);
            }
        }

        // ── Mixed-culture terrain-specific sub-placements ─────────────────────

        // Mixed: additionally seed terrain-restricted sub-cultures on appropriate land
        // Apply same biome reductions to these sub-placements
        if (culture === 'mixed') {
            if (forestSet.size > 0) {
                const fNames = this._pool(
                    ['oakpeople_settlements.villages'],
                    ['Willowshade', 'Mossburrow', 'Underbough']
                );
                let fCount = sn(this.ri(2 * sc, 3 * sc));
                if (biomeId === 'the_midlands') fCount = Math.max(1, Math.round(fCount * 0.7));
                tryPlace('village', (c, r) => flat(c, r) && inForest(c, r),
                    fCount, 70, fNames);
            }
            if ((this.swampCells?.size ?? 0) > 0) {
                const sNames = this._pool(
                    ['swampbrood_settlements.villages'],
                    ['Xochitlan', 'Tzapotla', 'Chalxoco']
                );
                let sCount = sn(this.ri(1 * sc, 2 * sc));
                if (biomeId === 'the_midlands') sCount = Math.max(1, Math.round(sCount * 0.7));
                tryPlace('village', (c, r) => flat(c, r) && inSwamp(c, r),
                    sCount, 80, sNames);
            }
            const mtnNames = this._pool(
                ['stone_folk_settlements.villages'],
                ['Dornkrim', 'Gruldak', 'Bromthak']
            );
            let mCount = sn(this.ri(2 * sc, 3 * sc));
            if (biomeId === 'the_midlands') mCount = Math.max(1, Math.round(mCount * 0.7));
            tryPlace('village', (c, r) => mtn(c, r),
                mCount, 85, mtnNames);
            const ashenNames = this._pool(
                ['ashen_halfbreeds_settlements.villages'],
                ['Zinjara', 'Kouladi', 'Fasira']
            );
            let aCount = sn(this.ri(1 * sc, 2 * sc));
            if (biomeId === 'the_midlands') aCount = Math.max(1, Math.round(aCount * 0.7));
            tryPlace('village', (c, r) => flat(c, r),
                aCount, 75, ashenNames);
        }

        // Mixed Wildlands: Ashen on mountains, Step Folk on open terrain
        if (culture === 'mixed_wildlands') {
            const mtnNames = this._pool(
                ['ashen_halfbreeds_settlements.villages'],
                ['Zinjara', 'Kouladi', 'Fasira']
            );
            tryPlace('village', (c, r) => mtn(c, r),
                sn(this.ri(2 * sc, 4 * sc)), 75, mtnNames);
            const openNames = this._pool(
                ['step_folk_settlements.villages'],
                ['Khuldai', 'Khorzunai', 'Zunbatai']
            );
            tryPlace('village', (c, r) => flat(c, r) && !inForest(c, r) && !inSwamp(c, r),
                sn(this.ri(2 * sc, 4 * sc)), 65, openNames);
        }

        // Mixed Sanctuary: Oakspeople and Foresters only on forested cells
        if (culture === 'mixed_sanctuary') {
            const forestNames = this._pool(
                ['oakpeople_settlements.villages', 'wildmen_settlements.camps_and_warbands'],
                ['Willowshade', 'Mossburrow', 'Underbough', 'Brambleburrow', 'Deepwood']
            );
            tryPlace('village', (c, r) => flat(c, r) && inForest(c, r),
                sn(this.ri(2 * sc, 3 * sc)), 65, forestNames);
        }

        return settles;
    }

    // ── Kingdoms / Nations system ─────────────────────────────────────────────
    // Assigns each midlander settlement to a kingdom and renders a coloured
    // transparent overlay (hidden by default, toggled via the Kingdoms button).

    _assignKingdoms(settles) {
        const kdefs = window._leonoriaKingdoms ?? [];
        if (!kdefs.length || this.biomeId !== 'the_midlands') return;

        const midSettles = settles.filter(s => String(s.culture ?? '').startsWith('midlander'));
        if (!midSettles.length) return;

        const assigned = new Set();
        const kingdomSeeds = new Map(); // kingdom id → [settlement, ...]

        // ── Pass 1: match anchor types with terrain preference first ──
        for (const kd of kdefs) {
            const seeds = [];
            const prefTerrain = kd.terrain_preference ?? null;
            const maxA = kd.max_anchors ?? 1;

            // Collect candidates (type matches + optional terrain match)
            const candidates = midSettles.filter(s =>
                !assigned.has(s) &&
                kd.anchor_types.includes(s.type) &&
                (!prefTerrain || s.terrain_context === prefTerrain)
            );
            // Shuffle deterministically with the map's rng
            candidates.sort((a, b) => ((a.c * 7 + a.r * 13) % 97) - ((b.c * 7 + b.r * 13) % 97));
            for (const s of candidates) {
                if (seeds.length >= maxA) break;
                seeds.push(s);
                assigned.add(s);
                s.kingdom = kd.id;
            }
            if (seeds.length) kingdomSeeds.set(kd.id, seeds);
        }

        // ── Pass 2: anchor without terrain preference for kingdoms that got nothing ──
        for (const kd of kdefs) {
            if (kingdomSeeds.has(kd.id)) continue;
            const seeds = [];
            const maxA = kd.max_anchors ?? 1;
            const candidates = midSettles.filter(s =>
                !assigned.has(s) && kd.anchor_types.includes(s.type)
            );
            candidates.sort((a, b) => ((a.c * 7 + a.r * 13) % 97) - ((b.c * 7 + b.r * 13) % 97));
            for (const s of candidates) {
                if (seeds.length >= maxA) break;
                seeds.push(s);
                assigned.add(s);
                s.kingdom = kd.id;
            }
            if (seeds.length) kingdomSeeds.set(kd.id, seeds);
        }

        // ── Pass 3: assign remaining settlements to nearest kingdom seed ──
        for (const s of midSettles) {
            if (assigned.has(s)) continue;
            let bestKid = null, bestDist = Infinity;
            for (const [kid, seeds] of kingdomSeeds) {
                for (const seed of seeds) {
                    const dx = s.x - seed.x, dy = s.y - seed.y;
                    const d = dx * dx + dy * dy;
                    if (d < bestDist) { bestDist = d; bestKid = kid; }
                }
            }
            s.kingdom = bestKid;
        }

        this.kingdomSeeds = kingdomSeeds;
        this.kingdomDefs  = kdefs;
    }

    // Render kingdoms colour overlay into the hidden gKingdoms SVG group.
    // Uses canvas→PNG (per performance rules) so the hex loop is off the DOM.
    _drawKingdomsOverlay(settles) {
        const kdefs = this.kingdomDefs;
        const kingdomSeeds = this.kingdomSeeds;
        if (!kdefs || !kingdomSeeds || !kingdomSeeds.size) return;

        const { hm, W, H, COLS, ROWS } = this;

        // Build a fast color lookup: kingdom id → rgba fill
        const colorMap = new Map();
        for (const kd of kdefs) {
            const hex = kd.color_hex ?? '#808080';
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            colorMap.set(kd.id, `rgba(${r},${g},${b},0.22)`);
        }

        // For each cell determine its kingdom via nearest seed distance —
        // ocean cells included so borders can cross bodies of water.
        const cellKingdom = (c, r) => {
            const { x: cx, y: cy } = this.hexCenter(c, r);
            let bestKid = null, bestDist = Infinity;
            for (const [kid, seeds] of kingdomSeeds) {
                for (const s of seeds) {
                    const dx = cx - s.x, dy = cy - s.y;
                    const d = dx * dx + dy * dy;
                    if (d < bestDist) { bestDist = d; bestKid = kid; }
                }
            }
            return bestKid;
        };

        // Pre-compute kingdom grid for border detection
        const grid = new Array(COLS * ROWS).fill(null);
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++)
                grid[r * COLS + c] = cellKingdom(c, r);

        // ── Canvas render ────────────────────────────────────────────────────
        const canvas = document.createElement('canvas');
        canvas.width  = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Hex neighbors (pointy-top offset-r)
        const hexNeighbors = (c, r) => {
            const even = (r & 1) === 0;
            return [
                [c+1, r], [c-1, r],
                [c + (even ? 0 : 1), r-1], [c + (even ? -1 : 0), r-1],
                [c + (even ? 0 : 1), r+1], [c + (even ? -1 : 0), r+1],
            ];
        };

        const hexPath = (c, r) => {
            const { x, y } = this.hexCenter(c, r);
            const R = this.hexR;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = Math.PI / 6 + i * Math.PI / 3;
                const px = x + R * Math.cos(a);
                const py = y + R * Math.sin(a);
                i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
        };

        // Draw fill regions
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const kid = grid[r * COLS + c];
                if (!kid) continue;
                ctx.fillStyle = colorMap.get(kid) ?? 'rgba(128,128,128,0.22)';
                hexPath(c, r);
                ctx.fill();
            }
        }

        // ── Organic border lines ──────────────────────────────────────────────
        // ── Organic border curves ─────────────────────────────────────────────
        // Instead of tracing hex edges (which always look hexagonal), we connect
        // border midpoints THROUGH cell interiors — the dual graph.  For each
        // border cell we sort its cross-kingdom midpoints by angle and connect
        // consecutive pairs; no segment ever follows a hex-edge direction.
        // Stable noise + 5× Chaikin produces smooth, blob-like curves.

        const hexR = this.hexR;

        const vKey = (x, y) => `${Math.round(x * 4)},${Math.round(y * 4)}`;

        const vnoise = (x, y) => {
            const xi = Math.round(x * 4), yi = Math.round(y * 4);
            let h = (Math.imul(xi ^ 0xdeadbeef, 0x9e3779b9) ^ Math.imul(yi ^ 0x12345678, 0x85ebca6b)) >>> 0;
            h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) >>> 0;
            const amp = hexR * 0.45;
            return [
                ((h & 0xffff)          / 0xffff - 0.5) * amp,
                (((h >>> 16) & 0xffff) / 0xffff - 0.5) * amp,
            ];
        };

        const vGraph = new Map();
        const addEdge = (ax, ay, bx, by) => {
            const ka = vKey(ax, ay), kb = vKey(bx, by);
            if (ka === kb) return;
            if (!vGraph.has(ka)) { const [nx,ny]=vnoise(ax,ay); vGraph.set(ka, { x: ax+nx, y: ay+ny, adj: new Set() }); }
            if (!vGraph.has(kb)) { const [nx,ny]=vnoise(bx,by); vGraph.set(kb, { x: bx+nx, y: by+ny, adj: new Set() }); }
            vGraph.get(ka).adj.add(kb);
            vGraph.get(kb).adj.add(ka);
        };

        // For each border cell, collect midpoints to all cross-kingdom neighbours,
        // sort by angle around the cell centre, then connect consecutive midpoints.
        // These segments cut diagonally through the cell interior — never along an edge.
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const kid = grid[r * COLS + c];
                if (!kid) continue;
                const { x: cx, y: cy } = this.hexCenter(c, r);

                const mids = [];
                for (const [nc, nr] of hexNeighbors(c, r)) {
                    if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
                    if (grid[nr * COLS + nc] === kid) continue;
                    const { x: nx, y: ny } = this.hexCenter(nc, nr);
                    mids.push({ x: (cx+nx)/2, y: (cy+ny)/2,
                                a: Math.atan2((cy+ny)/2 - cy, (cx+nx)/2 - cx) });
                }
                if (mids.length < 2) continue;
                mids.sort((a, b) => a.a - b.a);
                for (let i = 0; i < mids.length - 1; i++)
                    addEdge(mids[i].x, mids[i].y, mids[i+1].x, mids[i+1].y);
            }
        }

        // Trace continuous chains (endpoints first, then any remaining loops)
        const visited = new Set();
        const chains  = [];
        const traceFrom = startKey => {
            const chain = [];
            let prev = null, cur = startKey;
            while (true) {
                visited.add(cur);
                const nd = vGraph.get(cur);
                chain.push({ x: nd.x, y: nd.y });
                const nxt = [...nd.adj].find(k => k !== prev && !visited.has(k));
                if (!nxt) break;
                prev = cur; cur = nxt;
            }
            if (chain.length >= 2) chains.push(chain);
        };
        for (const [k,n] of vGraph) if (n.adj.size === 1 && !visited.has(k)) traceFrom(k);
        for (const [k]   of vGraph) if (!visited.has(k))                      traceFrom(k);

        // Chaikin corner-cutting × 5 — each pass rounds every corner toward a
        // smooth curve; 5 iterations gives fully blob-like, non-hexagonal shapes.
        const chaikin = (pts, iters) => {
            for (let i = 0; i < iters; i++) {
                const n = [pts[0]];
                for (let j = 0; j < pts.length - 1; j++) {
                    const a = pts[j], b = pts[j+1];
                    n.push({ x: .75*a.x + .25*b.x, y: .75*a.y + .25*b.y });
                    n.push({ x: .25*a.x + .75*b.x, y: .25*a.y + .75*b.y });
                }
                n.push(pts[pts.length-1]);
                pts = n;
            }
            return pts;
        };

        ctx.strokeStyle = 'rgba(28,18,8,0.55)';
        ctx.lineWidth   = 1.8;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        for (const chain of chains) {
            const pts = chaikin(chain, 5);
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        el('image', {
            href: canvas.toDataURL('image/png'),
            x: 0, y: 0, width: W, height: H,
        }, this.gKingdoms);
    }

    // Toggle the kingdoms overlay on/off. Called by the UI button.
    toggleKingdoms() {
        const g = this.gKingdoms;
        if (!g) return;
        const visible = g.style.display !== 'none';
        g.style.display = visible ? 'none' : '';
        return !visible; // true = now visible
    }

    // Renders a PNG icon for Midlands common-folk settlements.
    // Returns true if a PNG was drawn, false if the caller should fall back to SVG.
    _midlandsCommonFolkIcon(g, loc) {
        const { type, terrain_context: tc, x, y, c, r, culture } = loc;
        // Only apply common-folk icons to midlander-culture settlements
        if (!String(culture ?? '').startsWith('midlander')) return false;
        const BASE = 'assets/images/settlementsymbols/';
        let src = null;

        if (type === 'village') {
            if      (tc === 'river')    src = 'commonfolkvillageriver.png';
            else if (tc === 'forest')   src = 'commonfolkvillageforest2.png';
            else if (tc === 'mountain') src = 'commonfolkmountain.png';
            else {
                // Two farmland variants — deterministic from cell position
                src = ((c * 7 + r * 13) % 2) === 0
                    ? 'commonfolkfarmlandvillage.png'
                    : 'commonfolkfarmlandvillage2.png';
            }
        } else if (type === 'fishing_village') {
            if      (tc === 'coast')  src = 'commonfolkseaport.png';
            else if (tc === 'river')  src = 'commonfolkvillageriver.png';
            else                      src = 'commonfolkvillage.png';
        } else if (type === 'town') {
            if      (tc === 'river')    src = 'commonfolktownriver.png';
            else if (tc === 'mountain') src = 'commonfolktownmountain.png';
            else {
                // Deterministic variant 1–2 from cell position so same map always matches
                src = `commonfolktown${((c * 7 + r * 13) % 2) + 1}.png`;
            }
        } else if (type === 'city') {
            src = 'commonfolkcity.png';
        } else if (type === 'market_town') {
            src = 'commonfolkmarkettown.png';
        } else if (type === 'port' || type === 'port_city') {
            src = 'commonfolkseaport.png';
        }

        if (!src) return false;

        // Size and anchor vary by settlement tier (all values scaled ×1.25 from base)
        let w, h, ix, iy;
        if (type === 'village' || type === 'fishing_village') {
            w = 20; h = 20; ix = x - 10; iy = y - 18;
        } else if (type === 'city') {
            w = 35; h = 35; ix = x - 18; iy = y - 30;
        } else if (type === 'market_town' || type === 'port_city') {
            w = 30; h = 30; ix = x - 15; iy = y - 26;
        } else {  // town, port
            w = 25; h = 25; ix = x - 13; iy = y - 23;
        }

        // Add dark green rim around PNG icon BEFORE the image so it's behind
        let rimRadius;
        if (type === 'village' || type === 'fishing_village') rimRadius = 14;
        else if (type === 'city') rimRadius = 21;
        else if (type === 'market_town' || type === 'port_city') rimRadius = 19;
        else rimRadius = 17; // town, port

        const rimCx = ix + w / 2;
        const rimCy = iy + h / 2;
        const rimElement = el('circle', {
            cx: rimCx.toFixed(1), cy: rimCy.toFixed(1), r: rimRadius,
            fill: 'url(#settlementRim)', 'pointer-events': 'none'
        }, g);

        el('image', {
            href: BASE + src,
            x: ix.toFixed(1), y: iy.toFixed(1),
            width: String(w), height: String(h)
        }, g);

        // Scale effect: render at 75%, expand to full size on hover
        g.style.transformBox    = 'fill-box';
        g.style.transformOrigin = 'center center';
        g.style.transform       = 'scale(0.75)';
        g.style.transition      = 'transform 0.18s ease';
        g.addEventListener('mouseenter', () => {
            g.style.transform = 'scale(1.0)';
            rimElement.style.opacity = '0';
        });
        g.addEventListener('mouseleave', () => {
            g.style.transform = 'scale(0.75)';
            rimElement.style.opacity = '1';
        });

        return true;
    }

    _drawSettlements(settles) {
        settles.forEach(loc => {
            const isCapital  = loc.type === 'capital';
            const isSmall    = ['village','fishing_village','camp'].includes(loc.type);
            const isMajor    = ['capital','city','fortress','port_city','market_town','town'].includes(loc.type);
            const fontSize   = isCapital ? 13 : ['city','fortress','port_city'].includes(loc.type) ? 11 : isSmall ? 7.5 : 9;
            const bold       = isCapital || ['city','fortress','port_city'].includes(loc.type);
            const ly         = loc.y + (isCapital ? 22 : ['city','fortress','port_city'].includes(loc.type) ? 16 : ['market_town','town'].includes(loc.type) ? 12 : loc.type === 'fishing_village' ? 10 : isSmall ? 8 : 12);

            // Compute label bounding box first and skip drawing both label and icon
            // if it would overlap — this prevents icons from being added to the DOM
            // when their labels are suppressed.
            if (isMajor) {
                // Capital keeps its parchment box; all others use plain highlight text
                let nameBBox;
                if (isCapital) {
                    const _mc = document.createElement('canvas').getContext('2d');
                    _mc.font = `bold ${fontSize}px 'IM Fell English',Georgia,serif`;
                    const tw = _mc.measureText(loc.name).width;
                    const padX = 8, padY = 3.5;
                    const bw = tw + padX * 2, bh = fontSize + padY * 2;
                    const bx = loc.x - bw / 2, by = ly - fontSize - padY;
                    const midY = by + bh / 2;
                    nameBBox = { cx: loc.x, cy: midY, x: bx, y: by, w: bw, h: bh };
                } else {
                    nameBBox = this._labelBBox(loc.x, ly, loc.name, fontSize, 0);
                }
                if (this._labelOverlaps(nameBBox, 3)) return;
                (this._labelRegistry ??= []).push(nameBBox);

                const g = el('g', {
                    'data-name': loc.name, 'data-type': loc.type,
                    style: 'cursor:pointer'
                }, this.gIcons);
                g.addEventListener('mouseenter', () => { g.style.opacity = '0.65'; });
                g.addEventListener('mouseleave', () => { g.style.opacity = '1'; });
                g.addEventListener('click', () => {
                    const popupTypes  = ['capital','city','port_city','port','market_town','town','fishing_village','village','ruin'];
                    if (popupTypes.includes(loc.type) && typeof window.showTownPopup === 'function') {
                        window.showTownPopup(loc.name, this.biomeId, loc.type, loc.culture || null, loc.kingdom || null);
                    } else {
                        console.log('[Leonoria]', loc.type, ':', loc.name);
                    }
                });

                const _tint = FantasyMap._cultureTints()[this._cultureRank(loc.culture)] ?? null;
                const _usedPng = this.biomeId === 'the_midlands' && this._midlandsCommonFolkIcon(g, loc);
                if (!_usedPng) {
                    if      (loc.type === 'capital')         this._iconCapital(g, loc.x, loc.y, _tint);
                    else if (loc.type === 'city')            this._iconCity(g, loc.x, loc.y, _tint);
                    else if (loc.type === 'fortress')       this._iconFortress(g, loc.x, loc.y, _tint);
                    else if (loc.type === 'port_city')       this._iconPortCity(g, loc.x, loc.y, _tint);
                    else if (loc.type === 'market_town')     this._iconMarketTown(g, loc.x, loc.y, _tint);
                    else if (loc.type === 'town')            this._iconTown(g, loc.x, loc.y, _tint);
                    else if (loc.type === 'fishing_village') this._iconFishingVillage(g, loc.x, loc.y, _tint);
                    else if (loc.type === 'village')         this._iconVillage(g, loc.x, loc.y, _tint);
                    else if (loc.type === 'stronghold')  this._iconStronghold(g, loc.x, loc.y);
                    else if (loc.type === 'port')            this._iconPort(g, loc.x, loc.y); // legacy fallback
                    else                                     this._iconRuin(g, loc.x, loc.y);
                }

                if (isCapital) {
                    const f2 = n => n.toFixed(2);
                    const { x: bx, y: by, w: bw, h: bh, cy: midY } = nameBBox;
                    const ng = el('g', { filter: 'url(#nps)' }, this.gLabels);
                    const ib = 2.2;
                    el('rect', {
                        x: f2(bx+ib), y: f2(by+ib), width: f2(bw-ib*2), height: f2(bh-ib*2), rx: '0.5',
                        fill: '#f4e6c0', stroke: '#6b4820', 'stroke-width': '0.9'
                    }, ng);
                    el('text', {
                        x: f2(loc.x), y: f2(midY),
                        'text-anchor': 'middle', 'dominant-baseline': 'central',
                        'font-family': "'IM Fell English',Georgia,serif",
                        'font-size': String(fontSize), 'font-weight': 'bold',
                        fill: '#1e0e04', 'letter-spacing': '0.5'
                    }, ng).textContent = loc.name;
                } else {
                    el('text', {
                        x: loc.x, y: ly,
                        'text-anchor': 'middle', 'font-family': "'IM Fell English',Georgia,serif",
                        'font-size': String(fontSize),
                        'font-weight': bold ? 'bold' : 'normal',
                        fill: '#111',
                        stroke: 'rgba(255,255,255,0.36)', 'stroke-width': '2.8',
                        'stroke-linejoin': 'round', 'paint-order': 'stroke',
                        filter: 'url(#sk)'
                    }, this.gLabels).textContent = loc.name;
                }
            } else {
                const smallBBox = this._labelBBox(loc.x, ly, loc.name, fontSize, 0);
                if (this._labelOverlaps(smallBBox, 3)) return;
                (this._labelRegistry ??= []).push(smallBBox);

                const g = el('g', {
                    'data-name': loc.name, 'data-type': loc.type,
                    style: 'cursor:pointer'
                }, this.gIcons);

                // Small settlements use opacity on hover
                g.addEventListener('mouseenter', () => { g.style.opacity = '0.65'; });
                g.addEventListener('mouseleave', () => { g.style.opacity = '1'; });

                g.addEventListener('click', () => {
                    const popupTypes  = ['capital','city','port_city','port','market_town','town','fishing_village','village','ruin'];
                    if (popupTypes.includes(loc.type) && typeof window.showTownPopup === 'function') {
                        window.showTownPopup(loc.name, this.biomeId, loc.type, loc.culture || null, loc.kingdom || null);
                    } else {
                        console.log('[Leonoria]', loc.type, ':', loc.name);
                    }
                });

                const _tint = FantasyMap._cultureTints()[this._cultureRank(loc.culture)] ?? null;
                const _usedPng2 = this.biomeId === 'the_midlands' && this._midlandsCommonFolkIcon(g, loc);
                if (!_usedPng2) {
                    if      (loc.type === 'capital')         this._iconCapital(g, loc.x, loc.y, _tint);
                    else if (loc.type === 'city')            this._iconCity(g, loc.x, loc.y, _tint);
                    else if (loc.type === 'fortress')       this._iconFortress(g, loc.x, loc.y, _tint);
                    else if (loc.type === 'port_city')       this._iconPortCity(g, loc.x, loc.y, _tint);
                    else if (loc.type === 'market_town')     this._iconMarketTown(g, loc.x, loc.y, _tint);
                    else if (loc.type === 'town')            this._iconTown(g, loc.x, loc.y, _tint);
                    else if (loc.type === 'fishing_village') this._iconFishingVillage(g, loc.x, loc.y, _tint);
                    else if (loc.type === 'village')         this._iconVillage(g, loc.x, loc.y, _tint);
                    else if (loc.type === 'stronghold')  this._iconStronghold(g, loc.x, loc.y);
                    else if (loc.type === 'port')            this._iconPort(g, loc.x, loc.y); // legacy fallback
                    else                                     this._iconRuin(g, loc.x, loc.y);
                }

                // Hide names for small settlements (villages, fishing_villages) — show on hover
                const hideUntilHover = ['village', 'fishing_village'].includes(loc.type);
                const nameEl = el('text', {
                    x: loc.x, y: ly,
                    'text-anchor': 'middle', 'font-family': "'IM Fell English',Georgia,serif",
                    'font-size': String(fontSize),
                    'font-style': loc.type === 'ruin' ? 'italic' : 'normal',
                    fill: '#111',
                    stroke: 'rgba(255,255,255,0.36)', 'stroke-width': '2.8',
                    'stroke-linejoin': 'round', 'paint-order': 'stroke',
                    filter: 'url(#sk)',
                    opacity: hideUntilHover ? '0' : '1',
                    style: hideUntilHover ? 'transition: opacity 0.15s ease;' : ''
                }, this.gLabels);
                nameEl.textContent = loc.name;

                // Show name on icon hover (only for small settlements)
                if (hideUntilHover) {
                    g.addEventListener('mouseenter', () => { nameEl.setAttribute('opacity', '1'); });
                    g.addEventListener('mouseleave', () => { nameEl.setAttribute('opacity', '0'); });
                }
            }
        });
    }

    // ── Roads & trails ────────────────────────────────────────────────────────
    _genRoads(settles) {
        const ruins  = settles.filter(s => s.type === 'ruin');
        const nodes  = settles.filter(s => s.type !== 'ruin' && s.type !== 'landmark');
        const roads  = [];

        // ── Minimum spanning tree (Kruskal) over all non-ruin settlements ────────
        // MST guarantees every settlement is reachable via exactly one non-redundant
        // route.  Two roads never travel the same corridor, so there are no
        // "double roads" even when settlements are roughly collinear.

        // Settlement tier: controls road type assigned to each MST edge
        const tier = s => (s.type === 'city' || s.type === 'fortress') ? 3
                        : (s.type === 'town' || s.type === 'port') ? 2
                        : 1; // village / camp

        // Union-Find with path compression
        const parent = new Map(nodes.map(n => [n, n]));
        const find = n => {
            const p = parent.get(n);
            if (p !== n) parent.set(n, find(p));
            return parent.get(n);
        };
        const union = (a, b) => parent.set(find(a), find(b));

        // All candidate edges sorted by straight-line distance
        const edges = [];
        for (let i = 0; i < nodes.length; i++)
            for (let j = i + 1; j < nodes.length; j++)
                edges.push({ a: nodes[i], b: nodes[j],
                    d: Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) });
        edges.sort((a, b) => a.d - b.d);

        for (const { a, b } of edges) {
            if (find(a) === find(b)) continue; // already connected — skip
            union(a, b);

            // Assign road type: both high-tier → major; either mid-tier → road; else trail
            const ta = tier(a), tb = tier(b);
            const type = (ta >= 3 && tb >= 3)       ? 'major'
                       : (ta >= 2 || tb >= 2)        ? 'road'
                       :                               'trail';
            roads.push({ a, b, type });
        }

        // ── Promote city-to-city edges already in the MST to major ───────────────
        // (Some city pairs may have been assigned 'road' if a town was closer.)
        roads.forEach(r => {
            if (r.a.type === 'city' && r.b.type === 'city') r.type = 'major';
        });

        // ── Ruins: one trail to nearest connected settlement ──────────────────────
        ruins.forEach(ruin => {
            let best = null, bestD = Infinity;
            for (const s of nodes) {
                const d = Math.hypot(s.x - ruin.x, s.y - ruin.y);
                if (d < bestD && d < 500) { bestD = d; best = s; }
            }
            if (best) roads.push({ a: ruin, b: best, type: 'trail' });
        });

        return roads;
    }

    // A* grid pathfinding — avoids sea and penalises mountains
    // A small seeded per-cell noise term makes paths meander organically
    // rather than taking robotically straight optimal routes.
    _terrainPath(sc, sr, ec, er) {
        const { hm } = this;
        if (sc === ec && sr === er) return [];

        // Per-cell noise: deterministic but varied so each cell has a small
        // random cost bias that nudges paths off perfectly straight lines.
        const cellNoise = (c, r) => {
            let h = (c * 374761393 + r * 668265263) ^ 0xDEADBEEF;
            h = Math.imul(h ^ (h >>> 13), 1274126177);
            return ((h ^ (h >>> 16)) >>> 0) / 0xFFFFFFFF * 0.35;
        };

        // Build lake exclusion set for road pathfinding — roads must not cross lakes.
        const ROAD_LAKE_R = 3, ROAD_LAKE_R2 = ROAD_LAKE_R * ROAD_LAKE_R;
        const roadLakeSet = new Set();
        for (const { c: lc, r: lr } of (this.lakes ?? [])) {
            for (let dr = -ROAD_LAKE_R; dr <= ROAD_LAKE_R; dr++)
                for (let dc = -ROAD_LAKE_R; dc <= ROAD_LAKE_R; dc++)
                    if (dc * dc + dr * dr <= ROAD_LAKE_R2) {
                        const nc = lc + dc, nr = lr + dr;
                        if (nc >= 0 && nc < hm.cols && nr >= 0 && nr < hm.rows)
                            roadLakeSet.add(nc * hm.rows + nr);
                    }
        }

        const moveCost = (c, r) => {
            if (!hm.isLand(c, r)) return Infinity;
            // Lake cells are visually water — roads must go around them.
            if (roadLakeSet.has(c * hm.rows + r)) return Infinity;
            // Coastal cells sit in the bilinear sea-overlap zone — the land fill
            // renders them partly as sea even though isLand is true.  Make them
            // more expensive than any mountain so the A* strongly prefers interior
            // land.  Not Infinity so ports (which are coastal) can still be reached.
            if (hm.isCoast(c, r)) return 25;
            const base = hm.isHighPeak(c, r) ? 18 : hm.isMountain(c, r) ? 9 : 1;
            return base + cellNoise(c, r);
        };
        const heur = (c, r) => Math.hypot(c - ec, r - er);
        const K = (c, r) => c * hm.rows + r;

        // Proper odd-r hex neighbors — 6 directions, no diagonals
        const hexNbrs = (c, r) => {
            const d = r & 1;
            return [[c+1,r],[c-1,r],[c+d,r-1],[c+d-1,r-1],[c+d,r+1],[c+d-1,r+1]];
        };

        const open = [{ c: sc, r: sr, g: 0, f: heur(sc, sr) }];
        const gScore = new Map([[K(sc, sr), 0]]);
        const cameFrom = new Map();
        const closed = new Set();
        let iters = 0;

        while (open.length && iters++ < 15000) {
            // Find entry with lowest f (linear scan — fine for this grid size)
            let bi = 0;
            for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
            const cur = open.splice(bi, 1)[0];
            const ck = K(cur.c, cur.r);
            if (closed.has(ck)) continue;
            closed.add(ck);

            if (cur.c === ec && cur.r === er) {
                const path = [];
                let k = ck;
                while (cameFrom.has(k)) {
                    const [c, r] = cameFrom.get(k);
                    path.unshift({ c, r });
                    k = K(c, r);
                }
                return path;
            }

            for (const [nc, nr] of hexNbrs(cur.c, cur.r)) {
                if (nc < 1 || nc >= hm.cols - 1 || nr < 1 || nr >= hm.rows - 1) continue;
                if (!hm.isLand(nc, nr)) continue; // never route over sea
                const nk = K(nc, nr);
                if (closed.has(nk)) continue;
                const ng = cur.g + moveCost(nc, nr);
                if (!gScore.has(nk) || ng < gScore.get(nk)) {
                    gScore.set(nk, ng);
                    cameFrom.set(nk, [cur.c, cur.r]);
                    open.push({ c: nc, r: nr, g: ng, f: ng + heur(nc, nr) * 1.2 });
                }
            }
        }
        return null; // fallback to bezier
    }

    // Precompute hex-cell paths for major roads and build this.majorRoadCells
    // (radius-1 exclusion zone) so forest/mountain draws can clear space before
    // _drawRoads runs.  Grid paths are stored on the road object (_gridPath) so
    // _drawRoads can reuse them without a second A* pass.
    _buildMajorRoadCells(roads) {
        const { hm } = this;
        const pixToHex = (px, py) => {
            const r = Math.max(0, Math.min(hm.rows - 1, Math.round((py - this.hexR) / this.rowH)));
            const q = Math.max(0, Math.min(hm.cols - 1, Math.round(px / this.hexW - 0.5 - 0.5 * (r & 1))));
            return { c: q, r };
        };
        const excl = new Set();
        const cols = hm.cols;
        for (const road of roads) {
            if (road.type !== 'major') continue;
            const { c: sc, r: sr } = pixToHex(road.a.x, road.a.y);
            const { c: ec, r: er } = pixToHex(road.b.x, road.b.y);
            const gridPath = this._terrainPath(sc, sr, ec, er);
            if (!gridPath || gridPath.length < 2) continue;
            road._gridPath = gridPath;
            for (const { c, r } of gridPath) {
                for (let dr = -1; dr <= 1; dr++)
                    for (let dc = -1; dc <= 1; dc++)
                        excl.add((r + dr) * cols + (c + dc));
            }
        }
        this.majorRoadCells = excl;
    }

    _drawRoads(roads) {
        const { hm } = this;
        this.roadCells = new Map(); // { cellKey → 'trail'|'road'|'major' }

        const pixToHex = (px, py) => {
            const r = Math.max(0, Math.min(hm.rows - 1, Math.round((py - this.hexR) / this.rowH)));
            const q = Math.max(0, Math.min(hm.cols - 1, Math.round(px / this.hexW - 0.5 - 0.5 * (r & 1))));
            return { c: q, r };
        };

        const tierOf = t => t === 'major' ? 3 : t === 'road' ? 2 : 1;

        const buildPath = (a, b, type, road) => {
            const { c: sc, r: sr } = pixToHex(a.x, a.y);
            const { c: ec, r: er } = pixToHex(b.x, b.y);
            const gridPath = road?._gridPath ?? this._terrainPath(sc, sr, ec, er);
            if (!gridPath || gridPath.length < 2) return null; // no land route — skip
            // Store each cell so _buildExportData can annotate the cell grid
            for (const { c, r } of gridPath) {
                const k = r * hm.cols + c;
                const prev = this.roadCells.get(k);
                if (!prev || tierOf(type) > tierOf(prev)) this.roadCells.set(k, type);
            }
            const pts = [{ x: a.x, y: a.y }];
            // Sample every cell for tight spline control; small jitter keeps the
            // road organic.  If jitter would land on a sea cell, clamp to centre
            // so the curve never visually crosses into ocean.
            for (let i = 0; i < gridPath.length; i++) {
                const { c: gc, r: gr } = gridPath[i];
                const { x: cx, y: cy } = this.hexCenter(gc, gr);
                const jx = this.r(-0.14, 0.14) * this.hexW;
                const jy = this.r(-0.14, 0.14) * this.rowH;
                const { c: jc, r: jr } = pixToHex(cx + jx, cy + jy);
                const safe = hm.isLand(jc, jr);
                pts.push({
                    x: cx + (safe ? jx : 0),
                    y: cy + (safe ? jy : 0),
                });
            }
            pts.push({ x: b.x, y: b.y });
            // Use straight-line segments between sampled hex centres to ensure
            // roads do not visually bulge over adjacent water cells. Catmull
            // splines can arc outside the polygon formed by centres and may
            // cross lakes; straight segments keep the path within cells.
            if (pts.length < 2) return null;
            const f = n => n.toFixed(1);
            let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
            for (let i = 1; i < pts.length; i++) d += ` L ${f(pts[i].x)} ${f(pts[i].y)}`;
            return d;
        };

        // Draw in layers: trails → roads → major (so major renders on top)
        const byType = { trail: [], road: [], major: [] };
        roads.forEach(r => (byType[r.type] || byType.road).push(r));

        byType.trail.forEach(({ a, b }) => {
            const d = buildPath(a, b, 'trail'); if (!d) return;
            el('path', {
                d, fill: 'none', stroke: '#887060',
                'stroke-width': '0.75', 'stroke-dasharray': '2 6',
                opacity: '0.45'
            }, this.gRoads);
        });

        byType.road.forEach(({ a, b }) => {
            const d = buildPath(a, b, 'road'); if (!d) return;
            el('path', {
                d, fill: 'none', stroke: '#887060',
                'stroke-width': '1.3', 'stroke-dasharray': '5 3',
                opacity: '0.8'
            }, this.gRoads);
        });

        byType.major.forEach(road => {
            const { a, b } = road;
            const d = buildPath(a, b, 'major', road); if (!d) return;
            // Shadow/casing layer
            el('path', {
                d, fill: 'none', stroke: '#5a4a30',
                'stroke-width': '4.5', opacity: '0.55',
                'stroke-linecap': 'round', 'stroke-linejoin': 'round'
            }, this.gRoads);
            // Road surface
            el('path', {
                d, fill: 'none', stroke: '#c8b06a',
                'stroke-width': '2.2', opacity: '0.9',
                'stroke-linecap': 'round', 'stroke-linejoin': 'round'
            }, this.gRoads);
        });
    }

    // ── Bridges ───────────────────────────────────────────────────────────────
    _findBridges(roads, rivers) {
        const riverCells = new Set();
        rivers.forEach(({ path }) => path.forEach(({ c, r }) => riverCells.add(`${c},${r}`)));

        const bridges = [];
        const seen = new Set();

        roads.filter(road => road.type === 'road' || road.type === 'major').forEach(({ a, b }) => {
            for (let t = 0.15; t <= 0.85; t += 0.12) {
                const mx = a.x + (b.x - a.x) * t;
                const my = a.y + (b.y - a.y) * t;
                const gr = Math.max(0, Math.min(this.hm.rows - 1, Math.round((my - this.hexR) / this.rowH)));
                const gc = Math.max(0, Math.min(this.hm.cols - 1, Math.round(mx / this.hexW - 0.5 - 0.5 * (gr & 1))));
                const hit = [[0,0],[1,0],[-1,0],[0,1],[0,-1]]
                    .some(([dc, dr]) => riverCells.has(`${gc+dc},${gr+dr}`));
                if (hit) {
                    const key = `${Math.round(mx / 18)},${Math.round(my / 18)}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
                        bridges.push({ x: mx, y: my, angle });
                    }
                    break;
                }
            }
        });
        return bridges;
    }

    _drawBridges(bridges) {
        bridges.forEach(({ x, y, angle }) => {
            // Rotate around crossing point so bridge spans perp. to road
            const g = el('g', {
                transform: `rotate(${angle.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`,
                filter: 'url(#sk)'
            }, this.gBridges);

            // Bridge deck (perpendicular to road = along y-axis in rotated space)
            el('rect', { x: x-4, y: y-11, width: 8, height: 22,
                fill: '#ddd8c4', stroke: '#5a5040', 'stroke-width': '0.9' }, g);
            // Plank lines
            for (let dy = -9; dy <= 9; dy += 4.5) {
                el('line', { x1: x-4, y1: y+dy, x2: x+4, y2: y+dy,
                    stroke: '#6a6050', 'stroke-width': '0.5' }, g);
            }
            // Abutment stones
            el('rect', { x: x-6, y: y-13, width: 12, height: 3,
                fill: '#ccc8b4', stroke: '#5a5040', 'stroke-width': '0.8' }, g);
            el('rect', { x: x-6, y: y+10, width: 12, height: 3,
                fill: '#ccc8b4', stroke: '#5a5040', 'stroke-width': '0.8' }, g);
        });
    }

    // ── Race tint helpers ──────────────────────────────────────────────────
    // Returns tint colors indexed by race rank within allCultures.
    // Rank 0 = dominant (null = no tint). Subsequent ranks apply a pale hue blend.
    static _cultureTints() {
        // Rank 0 = dominant: no tint (null).
        // Ranks 1–5 use saturated targets; _blendFill pulls the parchment fill
        // toward these at 0.55 strength so the result is clearly visible but
        // still reads as a pale map symbol.
        //   1 → warm ochre/gold (beige)
        //   2 → mid blue
        //   3 → mid red
        //   4 → mid green
        //   5 → orange
        return [null, '#b08828', '#3868b8', '#b83030', '#388038', '#b86818'];
    }

    // Blend a hex fill toward a tint color by `strength` (0–1).
    static _blendFill(base, tint, strength = 0.55) {
        const h = s => [parseInt(s.slice(1,3),16), parseInt(s.slice(3,5),16), parseInt(s.slice(5,7),16)];
        const [br,bg,bb] = h(base), [tr,tg,tb] = h(tint);
        const r = Math.round(br + (tr-br)*strength);
        const g2= Math.round(bg + (tg-bg)*strength);
        const b = Math.round(bb + (tb-bb)*strength);
        return `rgb(${r},${g2},${b})`;
    }

    // Compute race rank (index in allCultures) for a settlement culture tag.
    _cultureRank(cultureTag) {
        if (!cultureTag) return 0;
        const all = this.params?.allCultures ?? [];
        if (!all.length) return 0;
        const token = String(cultureTag).replace(/_settlements$/i,'').toLowerCase();
        const idx = all.findIndex(c => {
            const cv = String(c.value).toLowerCase();
            return cv === token || cv.includes(token) || token.includes(cv);
        });
        return idx >= 0 ? idx : 0;
    }

    // ── Location icons ────────────────────────────────────────────────────────
    _iconCity(g, x, y, tint) {
        const base = '#e4dece';
        const f = tint ? FantasyMap._blendFill(base, tint) : base;
        const s = '#111', sw = '1.1';
        el('rect', { x:x-13, y:y-19, width:9,  height:12, fill:f, stroke:s, 'stroke-width':sw, filter:'url(#sk)' }, g);
        el('rect', { x:x+4,  y:y-19, width:9,  height:12, fill:f, stroke:s, 'stroke-width':sw, filter:'url(#sk)' }, g);
        el('rect', { x:x-10, y:y-10, width:20, height:13, fill:f, stroke:s, 'stroke-width':sw, filter:'url(#sk)' }, g);
        // Battlements
        for (let i = 0; i < 3; i++) {
            el('rect', { x:x-13+i*3.3, y:y-22, width:2.2, height:4, fill:s }, g);
            el('rect', { x:x+4+i*3.3,  y:y-22, width:2.2, height:4, fill:s }, g);
        }
        // Gate arch
        el('path', {
            d: `M ${x-3} ${y+3} L ${x-3} ${y-2} Q ${x} ${y-7} ${x+3} ${y-2} L ${x+3} ${y+3} Z`,
            fill: '#4a4030', stroke: s, 'stroke-width': '0.5'
        }, g);
    }

    _iconTown(g, x, y, tint) {
        const base = '#eae4d4';
        const f = tint ? FantasyMap._blendFill(base, tint) : base;
        const s = '#222', sw = '1';
        el('rect', { x:x-7, y:y-5, width:14, height:9, fill:f, stroke:s, 'stroke-width':sw, filter:'url(#sk)' }, g);
        el('path', {
            d: `M ${x-9} ${y-5} L ${x} ${y-15} L ${x+9} ${y-5}`,
            fill: f, stroke: s, 'stroke-width': sw, 'stroke-linejoin': 'round', filter: 'url(#sk)'
        }, g);
        el('rect', { x:x-2, y:y-1, width:4, height:5, fill:'#555' }, g);
    }

    _iconPort(g, x, y) {
        const s = '#1a3a5a';
        // Dock planks
        el('rect', { x:x-10, y:y-1, width:20, height:3, fill:'#dce8ec', stroke:s, 'stroke-width':'0.9', filter:'url(#sk)' }, g);
        el('rect', { x:x-7,  y:y+2, width:4,  height:6, fill:'#dce8ec', stroke:s, 'stroke-width':'0.8' }, g);
        el('rect', { x:x+3,  y:y+2, width:4,  height:6, fill:'#dce8ec', stroke:s, 'stroke-width':'0.8' }, g);
        // Anchor symbol
        el('circle', { cx:x, cy:y-14, r:'2.5', fill:'none', stroke:s, 'stroke-width':'1' }, g);
        el('line', { x1:x, y1:y-11, x2:x,  y2:y-2, stroke:s, 'stroke-width':'1.2' }, g);
        el('line', { x1:x-5, y1:y-10, x2:x+5, y2:y-10, stroke:s, 'stroke-width':'1.2' }, g);
        el('line', { x1:x, y1:y-2, x2:x-5, y2:y+1, stroke:s, 'stroke-width':'1.2' }, g);
        el('line', { x1:x, y1:y-2, x2:x+5, y2:y+1, stroke:s, 'stroke-width':'1.2' }, g);
    }

    _iconRuin(g, x, y) {
        const f = '#cec8b4', s = '#555', sw = '0.9';
        el('rect', { x:x-9, y:y-15, width:5, height:15, fill:f, stroke:s, 'stroke-width':sw, filter:'url(#sk)' }, g);
        el('rect', { x:x+4, y:y-9,  width:5, height:9,  fill:f, stroke:s, 'stroke-width':sw, filter:'url(#sk)' }, g);
        el('rect', { x:x-11, y:y-17, width:9, height:3, fill:f, stroke:s, 'stroke-width':'0.7', filter:'url(#sk)' }, g);
        el('rect', { x:x+2,  y:y-11, width:9, height:3, fill:f, stroke:s, 'stroke-width':'0.7', filter:'url(#sk)' }, g);
        // Rubble
        [[-5,2],[1,4],[5,1],[-2,6],[3,7]].forEach(([dx, dy]) =>
            el('rect', {
                x:x+dx-2, y:y+dy-1, width:4, height:3,
                fill:'#bab4a0', stroke:'#666', 'stroke-width':'0.5', filter:'url(#sk)'
            }, g)
        );
    }

    _iconVillage(g, x, y, tint) {
        const base = '#e8e0cc';
        const f = tint ? FantasyMap._blendFill(base, tint) : base;
        const s = '#444', sw = '0.7';
        el('rect', { x:x-3.5, y:y-2, width:7, height:5, fill:f, stroke:s, 'stroke-width':sw, filter:'url(#sk)' }, g);
        el('path', {
            d: `M ${x-5} ${y-2} L ${x} ${y-8} L ${x+5} ${y-2}`,
            fill: f, stroke: s, 'stroke-width': sw, 'stroke-linejoin': 'round', filter: 'url(#sk)'
        }, g);
    }

    _iconFortress(g, x, y, tint) {
        // Heavy orc fortress: wide battlement block, angular silhouette
        const base = '#d8c8a8';
        const f = tint ? FantasyMap._blendFill(base, tint) : base;
        const s = '#1a1410', sw = '1.2';
        el('rect', { x:x-14, y:y-14, width:28, height:16, fill:f, stroke:s, 'stroke-width':sw, filter:'url(#sk)' }, g);
        // Battlements — wide, jagged
        for (let i = 0; i < 5; i++) {
            el('rect', { x:x-14+i*5.6, y:y-20, width:3.8, height:7, fill:s }, g);
        }
        // Gate — pointed arch
        el('path', {
            d: `M ${x-4} ${y+2} L ${x-4} ${y-5} L ${x} ${y-10} L ${x+4} ${y-5} L ${x+4} ${y+2} Z`,
            fill: '#2a1808', stroke: s, 'stroke-width': '0.6'
        }, g);
        // Skull emblem above gate
        el('circle', { cx:x, cy:y-12, r:'2', fill:'none', stroke:'#888', 'stroke-width':'0.6' }, g);
    }

    _iconStronghold(g, x, y) {
        // Stronghold icon with dotted pointy border
        const points = [];
        for (let i = 0; i < 12; i++) {
            const angle = (i * 30) * Math.PI / 180;
            const radius = i % 2 === 0 ? 12 : 8;
            points.push([x + radius * Math.cos(angle), y + radius * Math.sin(angle)]);
        }
        const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ' Z';
        el('path', {
            d: pathD,
            fill: 'none', stroke: '#884430', 'stroke-width': '1.2', 'stroke-dasharray': '2,1.5'
        }, g);
        // Stronghold icon image
        el('image', {
            href: 'assets/images/landmarksymbols/stronghold.png',
            x: (x - 10).toFixed(1), y: (y - 10).toFixed(1),
            width: '20', height: '20'
        }, g);
    }

    _iconFishingVillage(g, x, y, tint) {
        const base = '#e8e0cc';
        const f = tint ? FantasyMap._blendFill(base, tint) : base;
        const s = '#444', sw = '0.7';
        el('rect', { x:x-3.5, y:y-2, width:7, height:5, fill:f, stroke:s, 'stroke-width':sw, filter:'url(#sk)' }, g);
        el('path', { d:`M ${x-5} ${y-2} L ${x} ${y-8} L ${x+5} ${y-2}`, fill:f, stroke:s, 'stroke-width':sw, 'stroke-linejoin':'round', filter:'url(#sk)' }, g);
        // Wave marks below — indicate waterside location
        el('path', { d:`M ${x-6} ${y+5} Q ${x-4} ${y+3} ${x-2} ${y+5} Q ${x} ${y+7} ${x+2} ${y+5} Q ${x+4} ${y+3} ${x+6} ${y+5}`, fill:'none', stroke:'#1a3a5a', 'stroke-width':'0.9', 'stroke-linecap':'round' }, g);
    }

    _iconMarketTown(g, x, y, tint) {
        // Slightly wider than town with a cross on the spire (market towns historically centred on church/market cross)
        const base = '#e8dfc8';
        const f = tint ? FantasyMap._blendFill(base, tint) : base;
        const s = '#222', sw = '1';
        el('rect', { x:x-8, y:y-5, width:16, height:9, fill:f, stroke:s, 'stroke-width':sw, filter:'url(#sk)' }, g);
        el('path', { d:`M ${x-10} ${y-5} L ${x} ${y-16} L ${x+10} ${y-5}`, fill:f, stroke:s, 'stroke-width':sw, 'stroke-linejoin':'round', filter:'url(#sk)' }, g);
        // Door
        el('rect', { x:x-2, y:y-1, width:4, height:5, fill:'#555' }, g);
        // Two side windows
        el('rect', { x:x-6.5, y:y-3, width:2.5, height:2.5, fill:'#888' }, g);
        el('rect', { x:x+4,   y:y-3, width:2.5, height:2.5, fill:'#888' }, g);
        // Market cross on spire
        el('line', { x1:x-2.5, y1:y-13, x2:x+2.5, y2:y-13, stroke:s, 'stroke-width':'1' }, g);
    }

    _iconPortCity(g, x, y, tint) {
        // Left: fortified city walls — Right: ship mast and sail
        const base = '#e0dace';
        const f = tint ? FantasyMap._blendFill(base, tint) : base;
        const s = '#0a0a18', sw = '1.1';
        // Left tower + connecting wall
        el('rect', { x:x-14, y:y-19, width:9,  height:11, fill:f, stroke:s, 'stroke-width':sw, filter:'url(#sk)' }, g);
        el('rect', { x:x-5,  y:y-10, width:10, height:12, fill:f, stroke:s, 'stroke-width':sw, filter:'url(#sk)' }, g);
        // Battlements on left tower
        for (let i = 0; i < 3; i++) el('rect', { x:x-14+i*3.2, y:y-22, width:2.2, height:4, fill:s }, g);
        // Gate arch
        el('path', { d:`M ${x-3} ${y+2} L ${x-3} ${y-2} Q ${x-0.5} ${y-7} ${x+2} ${y-2} L ${x+2} ${y+2} Z`, fill:'#3a3828', stroke:s, 'stroke-width':'0.5' }, g);
        // Ship mast (right side)
        const mc = '#1a3a5a';
        el('line', { x1:x+8, y1:y-18, x2:x+8,  y2:y+2,   stroke:mc, 'stroke-width':'1.2' }, g);
        el('line', { x1:x+6, y1:y-15, x2:x+13, y2:y-15,  stroke:mc, 'stroke-width':'1' }, g);
        el('path', { d:`M ${x+8} ${y-14} L ${x+13} ${y-10} L ${x+8} ${y-6} Z`, fill:'#d8eaf0', stroke:mc, 'stroke-width':'0.6' }, g);
        // Waterline
        el('path', { d:`M ${x+3} ${y+4} Q ${x+7} ${y+2} ${x+11} ${y+4} Q ${x+15} ${y+6} ${x+16} ${y+4}`, fill:'none', stroke:'#4a7a9a', 'stroke-width':'0.9', 'stroke-linecap':'round' }, g);
    }

    _iconCapital(g, x, y, tint) {
        // Three-tower castle with gold crown — largest, most majestic icon
        const base = '#f0e8d0';
        const f = tint ? FantasyMap._blendFill(base, tint) : base;
        const s = '#0a0808', sw = '1.2';
        // Left tower
        el('rect', { x:x-18, y:y-22, width:10, height:14, fill:f, stroke:s, 'stroke-width':sw, filter:'url(#sk)' }, g);
        // Right tower
        el('rect', { x:x+8,  y:y-22, width:10, height:14, fill:f, stroke:s, 'stroke-width':sw, filter:'url(#sk)' }, g);
        // Central keep (tallest)
        el('rect', { x:x-8,  y:y-26, width:16, height:18, fill:f, stroke:s, 'stroke-width':sw, filter:'url(#sk)' }, g);
        // Battlements — left tower
        for (let i = 0; i < 3; i++) el('rect', { x:x-18+i*3.5, y:y-26, width:2.2, height:5, fill:s }, g);
        // Battlements — right tower
        for (let i = 0; i < 3; i++) el('rect', { x:x+8+i*3.5,  y:y-26, width:2.2, height:5, fill:s }, g);
        // Crown — gold, three points, sits on top of central keep
        el('path', {
            d: `M ${x-8} ${y-26} L ${x-8} ${y-28} L ${x-5} ${y-33} L ${x-2.5} ${y-28.5} L ${x} ${y-35} L ${x+2.5} ${y-28.5} L ${x+5} ${y-33} L ${x+8} ${y-28} L ${x+8} ${y-26} Z`,
            fill: '#c8a020', stroke: '#8a6010', 'stroke-width': '0.9', filter: 'url(#sk)'
        }, g);
        // Crown gems (three dots)
        el('circle', { cx:x-5,   cy:y-31, r:'1',   fill:'#e8c840' }, g);
        el('circle', { cx:x,     cy:y-33, r:'1.2', fill:'#e8c840' }, g);
        el('circle', { cx:x+5,   cy:y-31, r:'1',   fill:'#e8c840' }, g);
        // Gate arch
        el('path', {
            d: `M ${x-4} ${y+3} L ${x-4} ${y-3} Q ${x} ${y-9} ${x+4} ${y-3} L ${x+4} ${y+3} Z`,
            fill: '#3a2818', stroke: s, 'stroke-width': '0.5'
        }, g);
    }

    // ── Settlement amenities — placeholder data, full implementation coming later ─
    // NOTE: This is for SETTLEMENTS ONLY. Landmarks (ruin, stronghold, stronghold) are not settlements.
    static _settlementAmenities(type) {
        const DATA = {
            village:          { inns: [{ quality: 'modest' }],    traders: 1,  healers: 0, guards: false, temple: false, port: false, castle: false },
            fishing_village:  { inns: [{ quality: 'modest' }],    traders: 1,  healers: 0, guards: false, temple: false, port: true,  castle: false },
            town:             { inns: [{ quality: 'modest' }, { quality: 'comfortable' }], traders: 2, healers: 0, guards: false, temple: false, port: false, castle: false },
            market_town:      { inns: [{ quality: 'comfortable' }, { quality: 'modest' }], traders: 4, healers: 0, guards: false, temple: false, port: false, castle: false },
            city:             { inns: [{ quality: 'fine' }, { quality: 'comfortable' }, { quality: 'modest' }], traders: 7, healers: 1, guards: true, temple: false, port: false, castle: false, walls: 'stone' },
            port_city:        { inns: [{ quality: 'fine' }, { quality: 'comfortable' }, { quality: 'modest' }], traders: 7, healers: 1, guards: true, temple: false, port: true,  castle: false, walls: 'stone' },
            capital:          { inns: [{ quality: 'grand' }, { quality: 'fine' }, { quality: 'comfortable' }, { quality: 'comfortable' }, { quality: 'modest' }], traders: 10, healers: 2, guards: true, temple: true, port: false, castle: true, walls: 'stone', royalCourt: true },
            fortress:         { inns: [], traders: 1, healers: 0, guards: true, temple: false, port: false, castle: false, walls: 'stone' },
            port:             { inns: [{ quality: 'modest' }],    traders: 2,  healers: 0, guards: false, temple: false, port: true,  castle: false },
        };
        return DATA[type] ?? {};
    }

    // ── Landmarks ─────────────────────────────────────────────────────────────
    _genLandmarks(settles) {
        const { hm } = this;
        const { cols, rows } = hm;
        const count = Math.round((this.params.landmarkCount ?? 0) * (this.scale ?? 1));
        if (count === 0) return [];

        // Get candidate list filtered by current biome
        const biomeId = this.biomeId ?? 'the_midlands';
        let pool = [];
        if (_mapData?.landmarks) {
            pool = _mapData.landmarks.filter(lm =>
                !lm.biomes || lm.biomes.length === 0 || lm.biomes.includes(biomeId)
            );
        }
        if (pool.length === 0 && _mapData?.landmarks) pool = _mapData.landmarks;

        // Shuffle pool using seeded rng
        pool = [...pool];
        for (let i = pool.length - 1; i > 0; i--) {
            const j = this.ri(0, i);
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        const landmarks = [];
        const tooClose = (x, y) =>
            settles.some(s => Math.hypot(s.x - x, s.y - y) < 70) ||
            landmarks.some(l => Math.hypot(l.x - x, l.y - y) < 90);

        // Separate coast-required and normal landmarks
        const coastPool  = pool.filter(lm => lm.requiresCoast);
        const normalPool = pool.filter(lm => !lm.requiresCoast);

        let attempts = 0, ci = 0, ni = 0;
        while (landmarks.length < count && attempts++ < 1600) {
            const c = this.ri(3, cols - 4), r = this.ri(3, rows - 4);
            if (!hm.isLand(c, r)) continue;
            const isCoast = hm.isCoast(c, r);
            // Pick from coast pool if cell is coastal and coast pool non-empty,
            // otherwise pick from normal pool. Never place coast-required on inland,
            // and never place non-coast landmarks on coastal cells (would overhang water).
            let lm;
            if (isCoast && coastPool.length > 0 && this._rng() < 0.4) {
                lm = coastPool[ci % coastPool.length]; ci++;
            } else {
                if (!normalPool.length) continue;
                lm = normalPool[ni % normalPool.length]; ni++;
            }
            if (lm.requiresCoast && !isCoast) continue;
            if (!lm.requiresCoast && isCoast) continue;
            const {x, y} = this.hexCenter(c, r);
            if (tooClose(x, y)) continue;
            landmarks.push({ x, y, c, r, name: lm.name, description: lm.description ?? '', category: lm.category ?? 'nature', terrain_context: this._terrainContextAt(c, r) });
        }
        return landmarks;
    }

    _drawLandmarks(landmarks) {
        if (!landmarks.length) return;
        const { gLandmarks, gLabels } = this;

        landmarks.forEach(lm => {
            const isStronghold = lm.type === 'stronghold';
            const g = el('g', {
                'data-name': lm.name,
                'data-type': 'landmark',
                'data-desc': lm.description,
                style: 'cursor:pointer'
            }, gLandmarks);
            g.addEventListener('mouseenter', () => { g.style.opacity = '0.65'; });
            g.addEventListener('mouseleave', () => { g.style.opacity = '1'; });
            g.addEventListener('click', () => console.log('[Leonoria] landmark:', lm.name, '—', lm.description));

            // Render icon
            if (isStronghold) {
                this._iconStronghold(g, lm.x, lm.y);
            } else {
                this._iconLandmark(g, lm.x, lm.y, lm.category);
            }

            // Label — hidden for strongholds until hover, visible for other landmarks
            const labelColor = {
                dungeon: '#6a4040', shrine: '#4a4070', nature: '#3a5a30',
                magical: '#4a3070', military: '#504020', dark: '#502020',
                coastal: '#204050'
            }[lm.category] ?? '#555';

            const lmBBox = this._labelBBox(lm.x, lm.y + 19, lm.name, 7, 0);
            if (!this._labelOverlaps(lmBBox, 3)) {
                (this._labelRegistry ??= []).push(lmBBox);
                const labelText = el('text', {
                    x: lm.x, y: lm.y + 19,
                    'text-anchor': 'middle', 'font-family': "'IM Fell English',Georgia,serif",
                    'font-size': '7', 'font-style': 'italic',
                    fill: labelColor, filter: 'url(#sk)',
                    style: isStronghold ? 'opacity:0;transition:opacity 0.2s' : ''
                }, gLabels);
                labelText.textContent = lm.name;

                // Show/hide stronghold labels on hover
                if (isStronghold) {
                    g.addEventListener('mouseenter', () => { labelText.style.opacity = '1'; });
                    g.addEventListener('mouseleave', () => { labelText.style.opacity = '0'; });
                }
            }
        });
    }

    _iconLandmark(g, x, y, category) {
        // Each category gets a distinct small icon
        switch (category) {
            case 'dungeon': {
                // Arch/doorway
                el('path', {
                    d: `M ${x-7} ${y+5} L ${x-7} ${y-2} Q ${x} ${y-12} ${x+7} ${y-2} L ${x+7} ${y+5}`,
                    fill: 'none', stroke: '#4a3828', 'stroke-width': '1.4', filter: 'url(#sk)'
                }, g);
                el('line', { x1:x-7, y1:y+5, x2:x+7, y2:y+5, stroke:'#4a3828', 'stroke-width':'1.4' }, g);
                break;
            }
            case 'shrine': {
                // Circle with radiating lines
                el('circle', { cx:x, cy:y-3, r:'5', fill:'none', stroke:'#6a5840', 'stroke-width':'1.1', filter:'url(#sk)' }, g);
                for (let a = 0; a < 8; a++) {
                    const ang = a * Math.PI / 4;
                    el('line', {
                        x1: (x + Math.cos(ang)*5).toFixed(1), y1: (y-3 + Math.sin(ang)*5).toFixed(1),
                        x2: (x + Math.cos(ang)*8).toFixed(1), y2: (y-3 + Math.sin(ang)*8).toFixed(1),
                        stroke: '#6a5840', 'stroke-width': '0.7'
                    }, g);
                }
                break;
            }
            case 'magical': {
                // Five-pointed star
                const R = 7, r2 = 3.2;
                let d = '';
                for (let i = 0; i < 10; i++) {
                    const ang = (i * Math.PI / 5) - Math.PI / 2;
                    const rad = i % 2 === 0 ? R : r2;
                    d += `${i === 0 ? 'M' : 'L'} ${(x+Math.cos(ang)*rad).toFixed(1)} ${(y-3+Math.sin(ang)*rad).toFixed(1)} `;
                }
                el('path', { d: d + 'Z', fill: 'none', stroke: '#5a4080', 'stroke-width': '1.0', filter: 'url(#sk)' }, g);
                break;
            }
            case 'military': {
                // Flag on pole
                el('line', { x1:x, y1:y+6, x2:x, y2:y-10, stroke:'#5a4020', 'stroke-width':'1.2' }, g);
                el('path', { d:`M ${x} ${y-10} L ${x+9} ${y-6} L ${x} ${y-2} Z`,
                    fill:'#c04020', stroke:'#5a2010', 'stroke-width':'0.6', filter:'url(#sk)' }, g);
                break;
            }
            case 'dark': {
                // Skull (circle + two dots + teeth line)
                el('circle', { cx:x, cy:y-5, r:'5.5', fill:'none', stroke:'#483030', 'stroke-width':'1.1', filter:'url(#sk)' }, g);
                el('circle', { cx:x-2, cy:y-6, r:'1.2', fill:'#483030' }, g);
                el('circle', { cx:x+2, cy:y-6, r:'1.2', fill:'#483030' }, g);
                el('path', { d:`M ${x-4} ${y} L ${x-4} ${y+3} M ${x-1.5} ${y} L ${x-1.5} ${y+3} M ${x+1.5} ${y} L ${x+1.5} ${y+3} M ${x+4} ${y} L ${x+4} ${y+3}`,
                    stroke:'#483030', 'stroke-width':'0.9' }, g);
                break;
            }
            case 'coastal': {
                // Anchor
                el('circle', { cx:x, cy:y-9, r:'2.2', fill:'none', stroke:'#2a4860', 'stroke-width':'1' }, g);
                el('line', { x1:x, y1:y-7, x2:x, y2:y+4, stroke:'#2a4860', 'stroke-width':'1.1' }, g);
                el('line', { x1:x-5, y1:y-5, x2:x+5, y2:y-5, stroke:'#2a4860', 'stroke-width':'1.1' }, g);
                el('path', { d:`M ${x-5} ${y+1} Q ${x-7} ${y+4} ${x} ${y+4} Q ${x+7} ${y+4} ${x+5} ${y+1}`,
                    fill:'none', stroke:'#2a4860', 'stroke-width':'1' }, g);
                break;
            }
            default: { // nature
                // Crystal / gem shape
                el('path', {
                    d: `M ${x} ${y-11} L ${x-6} ${y-4} L ${x-4} ${y+5} L ${x+4} ${y+5} L ${x+6} ${y-4} Z`,
                    fill: 'none', stroke: '#3a6040', 'stroke-width': '1.0', filter: 'url(#sk)'
                }, g);
                el('line', { x1:x-6, y1:y-4, x2:x+6, y2:y-4, stroke:'#3a6040', 'stroke-width':'0.6' }, g);
                break;
            }
        }
    }

    // ── Region names ──────────────────────────────────────────────────────────
    _drawRegionNames() {
        const { hm, gLabels } = this;
        const regionPoolsByCulture = {
            midlander:          ['regions.human',         'regions.wilderness'],
            northerner:         ['regions.human',         'regions.wilderness'],
            step_folk:          ['regions.human',         'regions.elven'],
            ancients_secluded:  ['regions.elven',         'regions.wilderness'],
            ancients_greys:     ['regions.elven',         'regions.wilderness'],
            ancients_dark_ones: ['regions.orc_inhabited', 'regions.wilderness'],
            ice_ancients:       ['regions.human',         'regions.mountains_and_hills'],
            wildmen_foresters:  ['regions.orc_inhabited', 'regions.wilderness'],
            wildmen_ravagers:   ['regions.orc_inhabited', 'regions.wilderness'],
            oakpeople:          ['regions.human',         'regions.wilderness'],
            stone_folk:         ['regions.dwarven',       'regions.mountains_and_hills'],
            swampbrood:         ['regions.orc_inhabited', 'regions.wilderness'],
            ashen_halfbreeds:   ['regions.orc_inhabited', 'regions.wilderness'],
        };
        const culture = this.culture ?? 'midlander';
        const rPools = regionPoolsByCulture[culture] ?? regionPoolsByCulture.midlander;
        const NAMES = this._pool(
            [...rPools, 'regions.mountains_and_hills'],
            ['Eldenmoor', 'The Greywood', 'Ashfen', 'Stonespine', 'Silvermarsh', 'Thornwall', 'Iceward']
        ).map(n => this._tc(n));

        // Find large flat land areas for region names
        const candidates = [];
        for (let r = 4; r < hm.rows - 4; r += 4) {
            for (let c = 4; c < hm.cols - 4; c += 4) {
                if (!hm.isLand(c, r) || hm.isMountain(c, r)) continue;
                // Count land cells in 6×6 window
                let landCount = 0;
                for (let dr = -3; dr <= 3; dr++)
                    for (let dc = -3; dc <= 3; dc++)
                        if (hm.isLand(c+dc, r+dr)) landCount++;
                if (landCount > 28) candidates.push([c, r]);
            }
        }
        // Shuffle
        for (let i = candidates.length-1; i > 0; i--) {
            const j = this.ri(0, i);
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        const terrainClear = this._getTerrainClearFn();
        const placed = [];
        const LS_REGION = 3.5;
        for (const [c, r] of candidates) {
            if (placed.length >= 5) break;
            if (placed.some(([pc, pr]) => Math.hypot(pc-c, pr-r) < 10)) continue;
            const {x: px, y: py} = this.hexCenter(c, r);
            if (!terrainClear(px, py)) continue;
            const name = NAMES[placed.length % NAMES.length];
            // Skip this candidate if it overlaps an already-registered label
            const bbox = this._labelBBox(px, py, name, 13, LS_REGION);
            if (this._labelOverlaps(bbox, 8)) continue;
            placed.push([c, r]);
            (this._labelRegistry ??= []).push(bbox);
            const angle = this.r(-8, 8);
            el('text', {
                x: px, y: py,
                'text-anchor': 'middle', 'font-family': "'IM Fell English',Georgia,serif",
                'font-size': '13', 'font-style': 'italic', 'letter-spacing': String(LS_REGION),
                fill: '#9a9080',
                transform: `rotate(${angle.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})`
            }, gLabels).textContent = name;
        }
    }

    // ── Border ────────────────────────────────────────────────────────────────
    _drawBorder() {
        const { W, H, gDeco } = this;
        const o = 14, i = 22;
        el('rect', { x:o, y:o, width:W-o*2, height:H-o*2,
            fill:'none', stroke:'#1a1a14', 'stroke-width':'2', filter:'url(#sk)' }, gDeco);
        el('rect', { x:i, y:i, width:W-i*2, height:H-i*2,
            fill:'none', stroke:'#6a6050', 'stroke-width':'0.7', filter:'url(#sk)' }, gDeco);
        [[o,o],[W-o,o],[o,H-o],[W-o,H-o]].forEach(([cx, cy]) =>
            el('path', {
                d: `M ${cx} ${cy-5} L ${cx+4} ${cy} L ${cx} ${cy+5} L ${cx-4} ${cy} Z`,
                fill: '#1a1a14'
            }, gDeco)
        );
    }

    // ── Compass rose ──────────────────────────────────────────────────────────
    _drawCompass() {
        const { W, gDeco } = this;
        const cx = W - 64, cy = 64, R = 22;
        el('circle', { cx, cy, r:R+6, fill:'#f0eadc', stroke:'#888070', 'stroke-width':'0.8', filter:'url(#sk)' }, gDeco);
        el('circle', { cx, cy, r:3, fill:'#333' }, gDeco);
        el('path', { d:`M ${cx} ${cy-R} L ${cx-6} ${cy} L ${cx+6} ${cy} Z`,
            fill:'#1a1a14', filter:'url(#sk)' }, gDeco);
        el('path', { d:`M ${cx} ${cy+R} L ${cx-6} ${cy} L ${cx+6} ${cy} Z`,
            fill:'#c0b8a8', filter:'url(#sk)' }, gDeco);
        [['N',0,-(R+14)],['S',0,R+17],['E',R+15,4],['W',-(R+15),4]].forEach(([lbl, dx, dy]) =>
            el('text', {
                x:cx+dx, y:cy+dy, 'text-anchor':'middle',
                'font-family':"'IM Fell English',Georgia,serif", 'font-size':'12', 'font-weight':'bold',
                fill:'#2a2820'
            }, gDeco).textContent = lbl
        );
    }

    // ── Data export ───────────────────────────────────────────────────────────
    // Classifies every grid cell and builds the export JSON.
    _buildExportData() {
        const { hm, W, H, COLS, ROWS, biomeId, wetlandDensity } = this;
        const SL = this.SL;

        // Forest coverage
        const forestCells = new Set();
        for (const { c, r, radius } of (this.forests ?? [])) {
            const ir = Math.ceil(radius);
            for (let dr = -ir; dr <= ir; dr++)
                for (let dc = -ir; dc <= ir; dc++)
                    if (dc*dc + dr*dr <= radius*radius) {
                        const nc = c + dc, nr = r + dr;
                        if (nc >= 0 && nc < hm.cols && nr >= 0 && nr < hm.rows)
                            forestCells.add(nr * hm.cols + nc);
                    }
        }

        // Settlement cells + name lookup
        const settleCells = new Set(
            (this.settlements ?? []).map(s => s.r * hm.cols + s.c)
        );
        const settleNames = new Map(
            (this.settlements ?? []).map(s => [s.r * hm.cols + s.c, s.name])
        );

        // River cells: any cell that a river path passes through
        const riverCells = new Set();
        for (const { path } of (this.rivers ?? []))
            for (const { c, r } of path)
                riverCells.add(r * hm.cols + c);

        // Road cells: populated by _drawRoads (which runs before _buildExportData)
        const roadCells = this.roadCells ?? new Map();

        const BIOME_PLAIN = {
            the_midlands:         'Plains',
            the_sanctuary_lands:  'Grassland',
            the_dark_forests:     'Grassland',
            the_eternal_winds:    'Tundra',
            the_badlands:         'Desert',
            the_outer_steppes:    'Moorland',
            the_blinding_lands:   'Badlands',
            the_gleam_havens:     'Savanna',
            the_boglands:         'Marsh',
            the_forgotten_kingdom:'Cavern',
        };

        const classifyCell = (c, r) => {
            const h  = hm.get(c, r);
            const hn = h - SL;

            if (!hm.isLand(c, r))   return { terrain_type: 'Sea',       move_cost: null, is_passable: false };
            if (hm.isHighPeak(c, r)) return { terrain_type: 'High Peak', move_cost: null, is_passable: false };
            if (hm.isMountain(c, r)) return { terrain_type: 'Mountain',  move_cost: 2.0,  is_passable: true  };

            const key = r * hm.cols + c;
            if (forestCells.has(key)) return { terrain_type: 'Forest', move_cost: 2.0, is_passable: true };

            if (wetlandDensity > 0 && hn < 0.06) {
                let pn = ((c * 1013) ^ (r * 2017)) >>> 0;
                pn = Math.imul(pn ^ (pn >>> 16), 0x45d9f3b) >>> 0;
                if ((pn & 255) < Math.round(wetlandDensity * 256))
                    return { terrain_type: 'Wetland', move_cost: 2.0, is_passable: true };
            }

            if (hn > 0.10) return { terrain_type: 'Hills', move_cost: 2.0, is_passable: true };

            if (settleCells.has(key)) return { terrain_type: 'Settlement', move_cost: 1.0, is_passable: true };
            if (hm.isCoast(c, r))     return { terrain_type: 'Coast',      move_cost: 1.0, is_passable: true };

            return { terrain_type: BIOME_PLAIN[biomeId] ?? 'Plains', move_cost: 1.0, is_passable: true };
        };

        const cells = [];
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++) {
                const { terrain_type, move_cost, is_passable } = classifyCell(c, r);
                const cell = { q: c, r, terrain_type, move_cost };
                if (!is_passable) cell.is_passable = false;

                const ck = r * hm.cols + c;
                const feats = [];
                if (roadCells.has(ck)) {
                    const rt = roadCells.get(ck);
                    feats.push(rt === 'major' ? 'Major Road' : rt === 'road' ? 'Road' : 'Trail');
                }
                if (riverCells.has(ck)) feats.push('River');
                if (feats.length > 0) cell.features = feats;
                if (terrain_type === 'Settlement') {
                    const nm = settleNames.get(ck);
                    if (nm) cell.settlement_name = nm;
                }

                cells.push(cell);
            }

        const mapType = this.params.mapType ?? 'WORLD';

        // Mountain chains — summarise each identified chain for the export
        const mountainChainsExport = (this.mountainChains ?? []).map(ch => ({
            name:       ch.name,
            is_rare:    ch.isRare ?? false,
            cell_count: ch.cellCount,
            center:     { q: Math.round(ch.cxCell), r: Math.round(ch.cyCell) },
        }));

        // Forest areas — summarise each named area for the export
        const forestAreasExport = (this.forestAreas ?? []).map(fa => ({
            name:        fa.name,
            seed_count:  fa.seedCount,
            center:      { q: Math.round(fa.cxCell), r: Math.round(fa.cyCell) },
        }));

        // Settlements export — include kingdom assignment if available
        // Exclude ruins and camps which are landmarks, not settlements
        const settlementsExport = (this.settlements ?? [])
            .filter(s => s.type !== 'ruin' && s.type !== 'stronghold')
            .map(s => {
                const e = { name: s.name, type: s.type, q: s.c, r: s.r, culture: s.culture ?? null };
                if (s.kingdom) e.kingdom = s.kingdom;
                if (s.terrain_context) e.terrain_context = s.terrain_context;
                return e;
            });

        // Landmarks export — include ruins and camps from settlements, plus procedural landmarks
        const landmarksExport = [
            ...(this.settlements ?? [])
                .filter(s => s.type === 'ruin' || s.type === 'stronghold')
                .map(s => ({
                    name: s.name,
                    type: s.type,
                    q: s.c,
                    r: s.r,
                    category: s.type === 'ruin' ? 'ruin' : 'stronghold',
                    terrain_context: s.terrain_context ?? null,
                })),
            ...(this.landmarks ?? []).map(lm => ({
                name: lm.name,
                q: lm.c,
                r: lm.r,
                category: lm.category,
                description: lm.description ?? '',
                terrain_context: lm.terrain_context ?? null,
            })),
        ];

        // Kingdoms export — include definitions with assigned settlement counts
        const kingdomsExport = (this.kingdomDefs ?? []).map(kd => ({
            id:    kd.id,
            name:  kd.name,
            color: kd.color_hex,
            settlements: settlementsExport.filter(s => s.kingdom === kd.id).map(s => s.name),
        }));

        return {
            map_metadata: {
                map_id:          `leonoria_${this.seed.toString(16).padStart(8, '0')}`,
                map_type:        mapType,
                biome:           biomeId,
                grid_dimensions: { cols: COLS, rows: ROWS },
                dnd_scale:       { hex_size: mapType === 'DUNGEON' ? 5 : 6,
                                   unit:     mapType === 'DUNGEON' ? 'feet' : 'miles' },
                svg_config:      { viewBox: `0 0 ${W} ${H}` },
                seed:            this.seed,
            },
            mountain_chains: mountainChainsExport,
            forest_areas:    forestAreasExport,
            kingdoms:        kingdomsExport,
            settlements:     settlementsExport,
            landmarks:       landmarksExport,
            cells,
        };
    }

    // Saves both files to the stored local folder (data/maps/).
    // First call prompts the user to pick that folder; the handle is persisted in
    // IndexedDB so every subsequent save is silent.  Falls back to browser
    // download if the File System Access API is unavailable.
    async saveMapData() {
        const jsonData = this._buildExportData();
        const baseName = `leonoria_${this.seed.toString(16).padStart(8, '0')}`;
        const jsonStr  = JSON.stringify(jsonData, null, 2);
        const svgEl    = this.container.querySelector('svg');
        const svgStr   = svgEl ? new XMLSerializer().serializeToString(svgEl) : null;

        if ('showDirectoryPicker' in window) {
            try {
                let dirHandle = await MapSaveStore.loadHandle();

                if (!dirHandle) {
                    dirHandle = await window.showDirectoryPicker({
                        id:      'leonoria-maps',
                        mode:    'readwrite',
                        startIn: 'documents',
                    });
                    await MapSaveStore.storeHandle(dirHandle);
                }

                // Re-request permission if the page was reloaded
                if (await dirHandle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
                    throw new Error('permission denied');
                }

                await _writeFile(dirHandle, baseName + '.json', jsonStr);
                if (svgStr) await _writeFile(dirHandle, baseName + '.svg', svgStr);

                // Record the last saved map so the game engine can load it
                MapSaveStore.lastSaved = { baseName, jsonData };
                console.log(`[Leonoria] Saved to folder: ${baseName}.{json,svg}`);
                return jsonData;

            } catch (err) {
                // User cancelled picker or permission denied — clear stale handle
                if (err.name === 'AbortError') return null;
                console.warn('[Leonoria] Folder save failed, falling back to download:', err);
                await MapSaveStore.clearHandle();
            }
        }

        // Fallback: browser download
        _download(baseName + '.json', jsonStr, 'application/json');
        if (svgStr) _download(baseName + '.svg', svgStr, 'image/svg+xml');
        MapSaveStore.lastSaved = { baseName, jsonData };
        return jsonData;
    }

    // Clears the stored folder so the next export prompts for a new one.
    static clearSaveFolder() { return MapSaveStore.clearHandle(); }

    // ── Map title ─────────────────────────────────────────────────────────────
    // ── Forest area identification and labelling ──────────────────────────────
    // Builds a cell-level mask of all forest cells (each seed rasterised to its
    // circular radius), then flood-fills connected components — the same approach
    // used for mountain chains.  The largest areas (up to MAX_LABELS) are named.
    _genForestAreas(forests) {
        if (!forests || forests.length === 0) return [];

        const MAX_LABELS = 5;
        const MIN_CELLS  = 30; // ignore tiny isolated patches

        const FOREST_NAMES_FALLBACK = [
            "The High Forest", "The Misty Forest", "The Darkpine Wood",
            "The Aelthir Wood", "The Heartwood Forest", "The Moonshroud Forest",
            "The Frostbough Forest", "The Ancient Veil", "The Warden's Wood",
            "The Greenmantle Forest", "The Elder Reaches", "The Rootwoven Forest",
            "The Forest of Whispers", "The Living Wood", "The Forest of Oaks",
            "The Oldgrowth Wood", "The Tangleroots", "The Glimmerwood Forest",
            "The Greencloak Wood", "The Forest of Echoes", "The Flooded Forest",
            "The Thornwood Forest", "The Grimwood Forest", "The Verdant Reaches",
            "The Knotwood Forest", "The Oakheart Forest", "The Dawnleaf Forest",
            "The Witchwood Forest", "The Nightwood Forest", "The Blackwood Forest",
            "The Evermore Wood", "The Canopy Wood", "The Twilight Forest",
            "The Silverwood Forest", "The Deepwood Forest", "The Ironwood Forest",
            "The Shadowwood Forest", "The Whispering Wood", "The Elder Grove",
            "The Inner Forest",
        ];

        const biomeForestKey = `geographical_features.forests_${this.biomeId}`;
        const namePool = this._pool([biomeForestKey, 'geographical_features.forests'], FOREST_NAMES_FALLBACK);

        const { hm } = this;
        const { cols, rows } = hm;

        // ── Rasterise every forest seed into a cell-level boolean mask ────────
        const forestMask = new Uint8Array(cols * rows);
        for (const { c, r, radius } of forests) {
            const ir = Math.ceil(radius);
            for (let dr = -ir; dr <= ir; dr++) {
                for (let dc = -ir; dc <= ir; dc++) {
                    if (dc * dc + dr * dr > radius * radius) continue;
                    const nc = c + dc, nr = r + dr;
                    if (nc >= 0 && nc < cols && nr >= 0 && nr < rows)
                        forestMask[nr * cols + nc] = 1;
                }
            }
        }

        // ── 8-connected flood-fill to find contiguous forest clusters ─────────
        const visited = new Uint8Array(cols * rows);
        const clusters = [];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!forestMask[r * cols + c] || visited[r * cols + c]) continue;
                const cluster = [];
                const stack = [[c, r]];
                visited[r * cols + c] = 1;
                while (stack.length) {
                    const [cc, cr] = stack.pop();
                    cluster.push([cc, cr]);
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            if (!dr && !dc) continue;
                            const nc = cc + dc, nr = cr + dr;
                            if (nc >= 0 && nc < cols && nr >= 0 && nr < rows &&
                                forestMask[nr * cols + nc] && !visited[nr * cols + nc]) {
                                visited[nr * cols + nc] = 1;
                                stack.push([nc, nr]);
                            }
                        }
                    }
                }
                if (cluster.length >= MIN_CELLS) clusters.push(cluster);
            }
        }

        // ── Sort by cell count (largest first), keep top MAX_LABELS ──────────
        clusters.sort((a, b) => b.length - a.length);
        const top = clusters.slice(0, MAX_LABELS);

        // ── Compute centroid + PCA extent for each cluster ────────────────────
        const areas = [];
        for (let i = 0; i < top.length; i++) {
            const cluster = top[i];
            const n = cluster.length;

            // Simple centroid (forest cells have uniform weight)
            let cxA = 0, cyA = 0;
            for (const [c, r] of cluster) { cxA += c; cyA += r; }
            cxA /= n; cyA /= n;

            // PCA to find the longest axis (gives a more natural label orientation)
            let Cxx = 0, Cxy = 0, Cyy = 0;
            for (const [c, r] of cluster) {
                const dx = c - cxA, dy = r - cyA;
                Cxx += dx * dx; Cxy += dx * dy; Cyy += dy * dy;
            }
            Cxx /= n; Cxy /= n; Cyy /= n;

            const tr  = Cxx + Cyy;
            const det = Cxx * Cyy - Cxy * Cxy;
            const lam = tr / 2 + Math.sqrt(Math.max(0, (tr / 2) ** 2 - det));
            const aDen = Math.hypot(lam - Cyy, Cxy);
            const axX = aDen > 1e-9 ? (lam - Cyy) / aDen : 1;
            const axY = aDen > 1e-9 ? Cxy / aDen : 0;

            const projs = cluster.map(([c, r]) => (c - cxA) * axX + (r - cyA) * axY);
            let tMin = projs[0], tMax = projs[0];
            for (const t of projs) { if (t < tMin) tMin = t; if (t > tMax) tMax = t; }
            const axRange = Math.max(tMax - tMin, 1);

            let angleDeg = Math.atan2(axY, axX) * 180 / Math.PI;
            if (angleDeg > 90)  angleDeg -= 180;
            if (angleDeg < -90) angleDeg += 180;

            const { x: cx, y: cy } = this.hexCenter(cxA, cyA);
            const chainPxLen = axRange * this.hexW;
            const name = namePool[i % namePool.length];

            areas.push({ name, cx, cy, cxCell: cxA, cyCell: cyA, angleDeg, chainPxLen, seedCount: n });
        }

        return areas;
    }

    // ── Forest area labels — italic white text along each forest's longest axis ─
    // Font size scales so text visual width ≈ 30 % of forest extent, matching
    // the mountain chain label sizing rule.
    _drawForestAreaLabels(areas) {
        if (!areas || areas.length === 0) return;
        const { gLabels, W, H } = this;

        for (const { name, cx, cy, angleDeg, chainPxLen } of areas) {
            if (cx < 30 || cx > W - 30 || cy < 30 || cy > H - 30) continue;

            const label = this._tc(name);
            const LS = 1.5;
            const fontSize = Math.min(14, Math.max(6,
                (chainPxLen * 0.30) / (label.length * 0.68)
            ));

            const bbox = this._labelBBox(cx, cy, label, fontSize, LS);
            if (this._labelOverlaps(bbox, 4)) continue;
            (this._labelRegistry ??= []).push(bbox);

            el('text', {
                x: cx.toFixed(1),
                y: cy.toFixed(1),
                'text-anchor':       'middle',
                'dominant-baseline': 'central',
                'font-family':       "'IM Fell English',Georgia,serif",
                'font-size':         fontSize.toFixed(1),
                'font-style':        'italic',
                'letter-spacing':    String(LS),
                fill:                '#ffffff',
                opacity:             '0.85',
                transform: `rotate(${angleDeg.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})`,
            }, gLabels).textContent = label;
        }
    }

    // ── Mountain chain identification ─────────────────────────────────────────
    // Clusters mountain cells (8-connected flood fill) and assigns a name from
    // the geographical_features name pool to each significant chain.
    // Returns an array of chain descriptors used by _drawMountainChainLabels.
    _genMountainChains() {
        const { hm } = this;
        const { cols, rows } = hm;

        const PRIMARY_FALLBACK = [
            "The Spine of the World Mountains", "The Sunset Mountains",
            "The Storm Horns Mountains", "The Earthspur Mountains",
            "The Ice Spires Mountains", "The Nether Mountains",
            "The Sword Mountains", "The Graypeak Mountains",
            "The Orsraun Mountains", "The Giant's Run Mountains",
            "The Troll Mountains", "The Star Mounts Mountains",
            "The Smoking Mountains", "The Firesteap Mountains",
            "The Icerim Mountains", "The Galena Mountains",
            "The Riders to the Sky Mountains", "The Cloven Mountains",
            "The Barrier Peaks Mountains", "The Yatil Mountains",
            "The Crystalmist Mountains", "The Hellfurnaces Mountains",
            "The Griff Mountains", "The Rakers Mountains",
            "The Cairn Hills Mountains", "The Lortmil Mountains",
            "The Glorioles Mountains", "The Corusks Mountains",
            "The Hoarfrost Mountains", "The Icehorn Mountains",
            "The Endworld Mountains", "The Byeshk Mountains",
        ];
        const RARE_FALLBACK = [
            "The Ashen Crown Mountains", "Stormbreak Mountains",
            "The Ironspine Mountains", "Frostveil Mountains",
            "Emberfall Mountains", "The Shattered Sky Mountains",
            "Dreadmarch Mountains", "Silverfang Mountains",
            "The Hollowreach Mountains", "Bloodstone Mountains",
            "The Thunderwake Mountains", "Mistwoven Mountains",
            "The Blackrift Mountains", "Sunscar Mountains",
            "The Cragborn Mountains", "Nightspire Mountains",
            "The Windscar Mountains", "Grimward Mountains",
            "The Starfall Mountains", "Ironveil Mountains",
            "The Deepfang Mountains", "Ashdrift Mountains",
            "The Skyrend Mountains", "Coldspire Mountains",
            "The Riftclaw Mountains", "Shadowcrest Mountains",
            "The Goldvein Mountains", "Stormveil Mountains",
            "The Bonepeak Mountains", "Firewatch Mountains",
            "The Frostfang Mountains", "Darkreach Mountains",
            "The Stormspire Mountains", "Redveil Mountains",
            "The Voidmarch Mountains", "Highcrown Mountains",
            "The Shiverpeak Mountains", "Duskrend Mountains",
            "The Ironfang Mountains", "Brightspire Mountains",
            "The Gravewind Mountains", "Cloudbreaker Mountains",
            "The Skyrift Mountains", "Thorncrest Mountains",
            "The Emberpeak Mountains", "Paleveil Mountains",
            "The Dragonspine Mountains", "Everfrost Mountains",
            "The Kingsfall Mountains", "Runebreak Mountains",
        ];

        const primaryPool = this._pool(
            ['geographical_features.mountain_chains.primary'], PRIMARY_FALLBACK
        );
        const rarePool = this._pool(
            ['geographical_features.mountain_chains.rare'], RARE_FALLBACK
        );

        // ── Flood-fill clusters ───────────────────────────────────────────────
        const isMtn = (c, r) =>
            c >= 1 && c < cols - 1 && r >= 1 && r < rows - 1 && hm.isMountain(c, r);

        const visited = new Uint8Array(cols * rows);
        const clusters = [];

        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                if (!isMtn(c, r) || visited[r * cols + c]) continue;
                const cluster = [];
                const stack = [[c, r]];
                visited[r * cols + c] = 1;
                while (stack.length) {
                    const [cc, cr] = stack.pop();
                    cluster.push([cc, cr]);
                    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                        if (!dr && !dc) continue;
                        const nc = cc + dc, nr = cr + dr;
                        if (isMtn(nc, nr) && !visited[nr * cols + nc]) {
                            visited[nr * cols + nc] = 1;
                            stack.push([nc, nr]);
                        }
                    }
                }
                // Only label chains large enough to deserve a name (≥5 cells)
                if (cluster.length >= 5) clusters.push(cluster);
            }
        }

        let primaryIdx = 0, rareIdx = 0;
        const chains = [];

        for (const cluster of clusters) {
            const n = cluster.length;
            const elevs = cluster.map(([c, r]) => hm.get(c, r));

            // ── Elevation-weighted PCA centroid ───────────────────────────────
            let wS = 0, cxA = 0, cyA = 0;
            for (let i = 0; i < n; i++) {
                const w = Math.max(0, elevs[i] - SEA_LEVEL);
                cxA += w * cluster[i][0]; cyA += w * cluster[i][1]; wS += w;
            }
            if (wS < 1e-9) { cxA = cluster[0][0]; cyA = cluster[0][1]; }
            else { cxA /= wS; cyA /= wS; }

            let Cxx = 0, Cxy = 0, Cyy = 0;
            for (let i = 0; i < n; i++) {
                const w = Math.max(0, elevs[i] - SEA_LEVEL);
                const dx = cluster[i][0] - cxA, dy = cluster[i][1] - cyA;
                Cxx += w * dx * dx; Cxy += w * dx * dy; Cyy += w * dy * dy;
            }
            if (wS > 0) { Cxx /= wS; Cxy /= wS; Cyy /= wS; }

            const tr  = Cxx + Cyy;
            const det = Cxx * Cyy - Cxy * Cxy;
            const lam = tr / 2 + Math.sqrt(Math.max(0, (tr / 2) ** 2 - det));
            const aDen = Math.hypot(lam - Cyy, Cxy);
            const axX = aDen > 1e-9 ? (lam - Cyy) / aDen : 1;
            const axY = aDen > 1e-9 ? Cxy / aDen : 0;

            // ── Chain extent along principal axis ─────────────────────────────
            const projs = cluster.map(([c, r]) => (c - cxA) * axX + (r - cyA) * axY);
            let tMin = projs[0], tMax = projs[0];
            for (const t of projs) { if (t < tMin) tMin = t; if (t > tMax) tMax = t; }
            const axRange  = Math.max(tMax - tMin, 1);
            const chainPxLen = axRange * this.hexW;

            // ── Pixel-space centroid ───────────────────────────────────────────
            const { x: cx, y: cy } = this.hexCenter(cxA, cyA);

            // Axis angle for label (keep text readable left-to-right)
            let angleDeg = Math.atan2(axY, axX) * 180 / Math.PI;
            if (angleDeg > 90)  angleDeg -= 180;
            if (angleDeg < -90) angleDeg += 180;

            // ── Name selection: ~15 % rare ────────────────────────────────────
            let pn = ((cluster[0][0] * 3001) ^ (cluster[0][1] * 4007)) >>> 0;
            pn = Math.imul(pn ^ (pn >>> 16), 0x45d9f3b) >>> 0;
            const isRare = rarePool.length > 0 && (pn & 0xFF) < 38; // ~15 %

            let name;
            if (isRare) {
                name = rarePool[rareIdx % rarePool.length];
                rareIdx++;
            } else {
                name = primaryPool[primaryIdx % primaryPool.length];
                primaryIdx++;
            }

            chains.push({ name, isRare, cx, cy, cxCell: cxA, cyCell: cyA, angleDeg, chainPxLen, cellCount: n });
        }

        return chains;
    }

    // ── Mountain chain labels — capitalised text along each chain's PCA axis ──
    // Font size scales so the text visual width ≈ 30 % of the chain pixel length,
    // i.e. larger chains get proportionally larger labels.
    _drawMountainChainLabels(chains) {
        if (!chains || chains.length === 0) return;
        const { gLabels, W, H } = this;

        for (const { name, cx, cy, angleDeg, chainPxLen, cellCount } of chains) {
            if (cellCount < 5) continue;
            // Keep label inside map bounds
            if (cx < 30 || cx > W - 30 || cy < 30 || cy > H - 30) continue;

            const label = this._tc(name);
            const LS = 1.8;
            // Derive font size: text visual width ≈ 30 % of chain pixel length.
            // charWidthFactor 0.68 approximates rendered glyph width for the serif font.
            const fontSize = Math.min(18, Math.max(7,
                (chainPxLen * 0.30) / (label.length * 0.68)
            ));

            const bbox = this._labelBBox(cx, cy, label, fontSize, LS);
            if (this._labelOverlaps(bbox, 4)) continue;
            (this._labelRegistry ??= []).push(bbox);

            el('text', {
                x: cx.toFixed(1),
                y: cy.toFixed(1),
                'text-anchor':      'middle',
                'dominant-baseline': 'central',
                'font-family':      "'IM Fell English',Georgia,serif",
                'font-size':        fontSize.toFixed(1),
                'font-style':       'italic',
                'letter-spacing':   String(LS),
                fill:               '#2e1c08',
                opacity:            '0.72',
                transform: `rotate(${angleDeg.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})`,
            }, gLabels).textContent = label;
        }
    }

    _drawTitle() {
        const { W, H, gDeco } = this;
        el('text', {
            x: W/2, y: H-26,
            'text-anchor': 'middle', 'font-family': "'IM Fell English',Georgia,serif",
            'font-size': '15', 'letter-spacing': '9',
            fill: '#6a6050', filter: 'url(#sk)'
        }, gDeco).textContent = 'L  E  O  N  O  R  I  A';
    }
}

// ── Export ────────────────────────────────────────────────────────────────────
FantasyMap.setData  = d => { _mapData = d; };
FantasyMap.getData  = ()  => _mapData;
window.FantasyMap   = FantasyMap;
window.MapSaveStore = MapSaveStore;
})();
