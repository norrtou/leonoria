// dungeon.js — Leonoria procedural dungeon generator
(function () {
'use strict';

const COLS = 60;
const ROWS = 50;
const W    = 1200;
const H    = 900;
const MOVE_BUDGET = 6;

const hexSize = W / COLS;               // 20 px
const hexR    = hexSize / Math.sqrt(3); // ≈ 11.55 px
const rowH    = 1.5 * hexR;             // ≈ 17.32 px

// Forgotten Kingdom colour palette
const PAL = {
    rock:    '#0e0818',
    hachure: 'rgba(42, 26, 62, 0.60)',
    floor:   '#261638',
    chamber: '#2e1c44',
    entry:   '#3a2452',
    boss:    '#18102c',
    outline: 'rgba(6, 3, 14, 0.90)',
};

const T = {
    WALL    : 'Wall',
    FLOOR   : 'Floor',
    CHAMBER : 'Chamber',
    BOSS    : 'BossFloor',
    ENTRY   : 'Entrance',
};

function typeLabel(t) {
    return { Wall: 'Wall', Floor: 'Corridor', Chamber: 'Chamber', BossFloor: 'Boss Chamber', Entrance: 'Entrance' }[t] ?? t;
}

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

function hexToPixel(q, r) {
    return {
        x: hexSize * (q + 0.5 + 0.5 * (r & 1)),
        y: hexR + r * rowH,
    };
}

function nbrs(q, r) {
    const d = r & 1;
    return [
        [q + 1, r],  [q - 1, r],
        [q + d,     r - 1], [q + d - 1, r - 1],
        [q + d,     r + 1], [q + d - 1, r + 1],
    ];
}

// ── Dungeon Generator (room-based, pixel space) ────────────────────────────
// type: 'small' — linear progression, 4-7 rooms
// type: 'large' — BSP zone grid, 8-15 rooms, branching corridors and loops

class DungeonGen {
    constructor(seed, type = 'small') {
        this.seed           = seed;
        this.type           = type;
        this.rng            = mkRng(seed);
        this.rooms          = [];
        this.corridors      = [];
        this.grid           = new Map();
        this.entrancePos    = null;
        this.bossPos        = null;
        this.chamberCenters = [];
    }

    generate() {
        return this.type === 'large' ? this._generateLarge() : this._generateSmall();
    }

    // ── Small dungeon: linear left-to-right progression ──────────────────────
    _generateSmall() {
        const rng = this.rng;
        const CW  = 55;

        const ew = 155 + Math.floor(rng() * 85);
        const eh = 120 + Math.floor(rng() * 70);
        const entry = {
            x: 45,
            y: Math.max(35, Math.min(H - eh - 35, Math.round(H / 2 - eh / 2 + (rng() - 0.5) * 90))),
            w: ew, h: eh, type: T.ENTRY,
        };
        this.rooms.push(entry);

        let prev = entry;
        const nRooms = 4 + Math.floor(rng() * 4);
        for (let i = 0; i < nRooms; i++) {
            const gap = 70 + Math.floor(rng() * 120);
            const rw  = 130 + Math.floor(rng() * 155);
            const rh  = 105 + Math.floor(rng() * 120);
            const rx  = prev.x + prev.w + gap;
            if (rx + rw > W - 155) break;
            const ry = Math.max(35, Math.min(H - rh - 35, Math.round(H / 2 - rh / 2 + (rng() - 0.5) * H * 0.35)));
            const room = { x: rx, y: ry, w: rw, h: rh, type: T.CHAMBER };
            this.rooms.push(room);
            this.chamberCenters.push({ x: rx + rw / 2, y: ry + rh / 2 });
            this._connectLinear(prev, room, CW);
            prev = room;
        }

        const bw = 200 + Math.floor(rng() * 95);
        const bh = 165 + Math.floor(rng() * 85);
        const bx = Math.min(W - bw - 35, prev.x + prev.w + 60 + Math.floor(rng() * 70));
        const by = Math.max(35, Math.min(H - bh - 35, Math.round(H / 2 - bh / 2 + (rng() - 0.5) * 70)));
        const boss = { x: bx, y: by, w: bw, h: bh, type: T.BOSS };
        this.rooms.push(boss);
        this._connectLinear(prev, boss, CW);

        this._buildGrid();
        this.entrancePos = this._nearestFloorHex(entry.x + entry.w / 2, entry.y + entry.h / 2);
        this.bossPos     = this._nearestFloorHex(boss.x  + boss.w / 2,  boss.y  + boss.h / 2);
        return this;
    }

    // ── Large dungeon: BSP zone grid, branching corridors, loops ─────────────
    _generateLarge() {
        const rng   = this.rng;
        const ZCOLS = 5, ZROWS = 3;
        const ZW    = W / ZCOLS;  // 240px per zone
        const ZH    = H / ZROWS;  // 300px per zone
        const CW    = 38;
        const M     = 22;

        const midRow = Math.floor(ZROWS / 2);
        const zRooms = Array.from({ length: ZROWS }, () => new Array(ZCOLS).fill(null));

        for (let zr = 0; zr < ZROWS; zr++) {
            for (let zc = 0; zc < ZCOLS; zc++) {
                const isEntry = (zc === 0         && zr === midRow);
                const isBoss  = (zc === ZCOLS - 1 && zr === midRow);
                if (!isEntry && !isBoss && rng() > 0.80) continue;

                const type = isEntry ? T.ENTRY : isBoss ? T.BOSS : T.CHAMBER;
                const big  = isEntry || isBoss;
                const rw   = (big ? 120 : 70) + Math.floor(rng() * (big ? 80 : 90));
                const rh   = (big ? 100 : 55) + Math.floor(rng() * (big ? 65 : 70));
                const maxX = Math.max(0, ZW - rw - 2 * M);
                const maxY = Math.max(0, ZH - rh - 2 * M);
                const rx   = Math.round(zc * ZW + M + rng() * maxX);
                const ry   = Math.round(zr * ZH + M + rng() * maxY);

                const room = { x: rx, y: ry, w: rw, h: rh, type };
                zRooms[zr][zc] = room;
                this.rooms.push(room);
                if (type === T.CHAMBER) this.chamberCenters.push({ x: rx + rw / 2, y: ry + rh / 2 });
            }
        }

        // Guarantee column-to-column connectivity: connect closest room pair across each column boundary
        for (let zc = 0; zc < ZCOLS - 1; zc++) {
            const col1 = zRooms.map(row => row[zc]).filter(Boolean);
            const col2 = zRooms.map(row => row[zc + 1]).filter(Boolean);
            if (!col1.length || !col2.length) continue;
            let best = null, bestD = Infinity;
            for (const r1 of col1)
                for (const r2 of col2) {
                    const d = Math.abs((r1.y + r1.h / 2) - (r2.y + r2.h / 2));
                    if (d < bestD) { bestD = d; best = [r1, r2]; }
                }
            if (best) this._connectAny(best[0], best[1], CW);
        }

        // Additional horizontal connections within same row (~55% chance)
        for (let zr = 0; zr < ZROWS; zr++)
            for (let zc = 0; zc < ZCOLS - 1; zc++) {
                const r1 = zRooms[zr][zc], r2 = zRooms[zr][zc + 1];
                if (r1 && r2 && rng() < 0.55) this._connectAny(r1, r2, CW);
            }

        // Vertical connections (~50% chance)
        for (let zr = 0; zr < ZROWS - 1; zr++)
            for (let zc = 0; zc < ZCOLS; zc++) {
                const r1 = zRooms[zr][zc], r2 = zRooms[zr + 1][zc];
                if (r1 && r2 && rng() < 0.50) this._connectAny(r1, r2, CW);
            }

        // Extra random connections — maze-like loops
        const chambers = this.rooms.filter(r => r.type === T.CHAMBER);
        const nExtra   = 3 + Math.floor(rng() * 5);
        for (let i = 0; i < nExtra && chambers.length >= 2; i++) {
            const r1 = chambers[Math.floor(rng() * chambers.length)];
            const r2 = chambers[Math.floor(rng() * chambers.length)];
            if (r1 !== r2) this._connectAny(r1, r2, CW);
        }

        this._buildGrid();
        const entryRoom = zRooms[midRow][0]          ?? this.rooms[0];
        const bossRoom  = zRooms[midRow][ZCOLS - 1]  ?? this.rooms[this.rooms.length - 1];
        this.entrancePos = this._nearestFloorHex(entryRoom.x + entryRoom.w / 2, entryRoom.y + entryRoom.h / 2);
        this.bossPos     = this._nearestFloorHex(bossRoom.x  + bossRoom.w / 2,  bossRoom.y  + bossRoom.h / 2);
        return this;
    }

    // L-shaped corridor for linear (small) layout — right edge of r1 to left edge of r2
    _connectLinear(r1, r2, cw) {
        const half = Math.round(cw / 2);
        const x1   = r1.x + r1.w;
        const x2   = r2.x;
        const y1c  = Math.round(r1.y + r1.h / 2);
        const y2c  = Math.round(r2.y + r2.h / 2);
        this.corridors.push({ x: x1 - half, y: y1c - half, w: x2 - x1 + cw, h: cw });
        if (Math.abs(y2c - y1c) > cw) {
            const vy = Math.min(y1c, y2c) - half;
            this.corridors.push({ x: x2 - half, y: vy, w: cw, h: Math.abs(y2c - y1c) + cw });
        }
    }

    // L-shaped corridor between any two rooms (center-to-center, random orientation)
    _connectAny(r1, r2, cw) {
        const half = Math.round(cw / 2);
        const cx1  = Math.round(r1.x + r1.w / 2);
        const cy1  = Math.round(r1.y + r1.h / 2);
        const cx2  = Math.round(r2.x + r2.w / 2);
        const cy2  = Math.round(r2.y + r2.h / 2);
        const dx   = Math.abs(cx2 - cx1), dy = Math.abs(cy2 - cy1);
        const hx   = Math.min(cx1, cx2) - half;
        const vy   = Math.min(cy1, cy2) - half;
        if (this.rng() < 0.5 || dy < cw) {
            // H then V
            this.corridors.push({ x: hx, y: cy1 - half, w: dx + cw, h: cw });
            if (dy > cw) this.corridors.push({ x: cx2 - half, y: vy, w: cw, h: dy + cw });
        } else {
            // V then H
            this.corridors.push({ x: cx1 - half, y: vy, w: cw, h: dy + cw });
            this.corridors.push({ x: hx, y: cy2 - half, w: dx + cw, h: cw });
        }
    }

    // Which terrain type covers pixel (px, py)?
    _pixelType(px, py) {
        for (const r of this.rooms)
            if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return r.type;
        for (const c of this.corridors)
            if (px >= c.x && px < c.x + c.w && py >= c.y && py < c.y + c.h) return T.FLOOR;
        return T.WALL;
    }

    _buildGrid() {
        for (let r = 0; r < ROWS; r++)
            for (let q = 0; q < COLS; q++) {
                const { x, y } = hexToPixel(q, r);
                this.grid.set(`${q}_${r}`, this._pixelType(x, y));
            }
    }

    _nearestFloorHex(px, py) {
        let best = null, bestD = Infinity;
        for (const [k, type] of this.grid) {
            if (type === T.WALL) continue;
            const [q, r] = k.split('_').map(Number);
            const { x, y } = hexToPixel(q, r);
            const d = (x - px) ** 2 + (y - py) ** 2;
            if (d < bestD) { bestD = d; best = { q, r }; }
        }
        return best ?? { q: 1, r: Math.floor(ROWS / 2) };
    }
}

// ── Cave Renderer (Forgotten Kingdom style) ────────────────────────────────

class CaveRenderer {
    constructor(gen) {
        this.gen = gen;
        this.rng = mkRng(gen.seed ^ 0xCAFE1234);
    }

    render(canvas) {
        canvas.width  = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        this._rock(ctx);
        this._hachure(ctx);
        this._floors(ctx);
        this._roomVariation(ctx);
        this._floorTexture(ctx);
        this._edgeShadow(ctx);
        this._fungi(ctx);

        this._atmosphericLight(ctx);
        this._entryDaylight(ctx);
        this._bossRune(ctx);
        this._outlines(ctx);
        this._vignette(ctx);
    }

    // Solid rock background
    _rock(ctx) {
        ctx.fillStyle = PAL.rock;
        ctx.fillRect(0, 0, W, H);
    }

    // Globally-aligned diagonal lines across the whole canvas.
    // The floor fills drawn next cover these on floor areas — they show only on rock.
    _hachure(ctx) {
        const spacing = 3.5;
        ctx.beginPath();
        for (let t = -H; t <= W; t += spacing) {
            ctx.moveTo(t,     0);
            ctx.lineTo(t + H, H);
        }
        ctx.strokeStyle = PAL.hachure;
        ctx.lineWidth   = 0.8;
        ctx.stroke();
    }

    // Fill rooms and corridors with their floor colour (covers hachure)
    _floors(ctx) {
        ctx.fillStyle = PAL.floor;
        for (const c of this.gen.corridors)
            ctx.fillRect(c.x, c.y, c.w, c.h);

        for (const r of this.gen.rooms) {
            ctx.fillStyle = r.type === T.ENTRY  ? PAL.entry
                          : r.type === T.BOSS   ? PAL.boss
                          : PAL.chamber;
            ctx.fillRect(r.x, r.y, r.w, r.h);
        }
    }

    // Per-room radial tint — fades to transparent at the edges so room-corridor junctions are seamless
    _roomVariation(ctx) {
        const rng = mkRng(this.gen.seed ^ 0xA3C5F71E);
        for (const r of this.gen.rooms) {
            const v = rng();
            if (v > 0.35 && v < 0.65) continue;
            const cx  = r.x + r.w / 2;
            const cy  = r.y + r.h / 2;
            const rad = Math.max(r.w, r.h) * 0.65;
            const col = v <= 0.35 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.20)';
            const g   = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
            g.addColorStop(0, col);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(r.x, r.y, r.w, r.h);
        }
    }

    // Dispatches a stone pattern per room/corridor and draws mortar + cracks in two batches.
    // Stone sizes: 10%–100% of hexSize (2–20 px) for irregular/cobble; larger for 'large' rooms.
    _floorTexture(ctx) {
        const rng         = mkRng(this.gen.seed ^ 0xF100C5AE);
        const MIN_S       = Math.max(2, hexSize * 0.10);
        const MAX_S       = hexSize;
        const MORT        = 1;
        const corridorSet = new Set(this.gen.corridors);
        const areas       = [...this.gen.rooms, ...this.gen.corridors];
        const segs = [], cracks = [];

        for (const a of areas) {
            if (corridorSet.has(a)) {
                this._irregularStones(a, MIN_S, MAX_S, MORT, segs, cracks, rng);
                continue;
            }
            const r = rng();
            if (r < 0.30) {
                this._irregularStones(a, MIN_S, MAX_S, MORT, segs, cracks, rng);
            } else if (r < 0.52) {
                const cw = 10 + Math.floor(rng() * 9);
                const ch = 8  + Math.floor(rng() * 7);
                this._gridStones(a, cw, ch, MORT, segs, cracks, rng);
            } else if (r < 0.72) {
                const bw = 14 + Math.floor(rng() * 10);
                const bh = 7  + Math.floor(rng() * 5);
                this._brickStones(a, bw, bh, MORT, segs, cracks, rng);
            } else if (r < 0.87) {
                this._irregularStones(a, hexSize * 1.4, hexSize * 2.8, MORT, segs, cracks, rng);
            } else {
                this._irregularStones(a, MIN_S, Math.max(4, hexSize * 0.35), MORT, segs, cracks, rng);
            }
        }

        // Mortar joints — opacity reduced 30% from previous 0.25
        ctx.beginPath();
        for (const [x1, y1, x2, y2] of segs) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.175)';
        ctx.lineWidth   = 0.7;
        ctx.stroke();

        // Cracks — opacity reduced 30% from previous 0.18
        if (cracks.length) {
            ctx.beginPath();
            for (const [x1, y1, x2, y2] of cracks) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.126)';
            ctx.lineWidth   = 0.45;
            ctx.stroke();
        }
    }

    // Truly irregular stones: variable row heights, per-row variable column widths
    _irregularStones(a, minS, maxS, mort, segs, cracks, rng) {
        const rowBPs = [a.y];
        let cy = a.y;
        while (cy < a.y + a.h - minS) {
            cy += minS + rng() * (maxS - minS);
            rowBPs.push(Math.min(Math.round(cy), a.y + a.h));
        }
        if (rowBPs[rowBPs.length - 1] < a.y + a.h) rowBPs.push(a.y + a.h);

        for (let iy = 0; iy < rowBPs.length - 1; iy++) {
            const ry = rowBPs[iy], rh = rowBPs[iy + 1] - ry;
            const colBPs = [a.x];
            let cx = a.x;
            while (cx < a.x + a.w - minS) {
                cx += minS + rng() * (maxS - minS);
                colBPs.push(Math.min(Math.round(cx), a.x + a.w));
            }
            if (colBPs[colBPs.length - 1] < a.x + a.w) colBPs.push(a.x + a.w);

            if (iy < rowBPs.length - 2)
                segs.push([a.x, rowBPs[iy + 1], a.x + a.w, rowBPs[iy + 1]]);
            for (let ix = 1; ix < colBPs.length - 1; ix++)
                segs.push([colBPs[ix], ry, colBPs[ix], ry + rh]);
            for (let ix = 0; ix < colBPs.length - 1; ix++) {
                const sx = colBPs[ix] + mort, sw = colBPs[ix + 1] - colBPs[ix] - mort * 2;
                const sy = ry + mort, sh = rh - mort * 2;
                if (sw > 4 && sh > 4 && rng() < 0.10)
                    cracks.push([sx + sw * (0.20 + rng() * 0.25), sy + sh * 0.15,
                                 sx + sw * (0.55 + rng() * 0.30), sy + sh * 0.85]);
            }
        }
    }

    // Regular grid: uniform cell size chosen per room
    _gridStones(a, cw, ch, mort, segs, cracks, rng) {
        for (let y = a.y + ch; y < a.y + a.h; y += ch)
            segs.push([a.x, Math.round(y), a.x + a.w, Math.round(y)]);
        for (let x = a.x + cw; x < a.x + a.w; x += cw)
            segs.push([Math.round(x), a.y, Math.round(x), a.y + a.h]);
        const nx = Math.floor(a.w / cw), ny = Math.floor(a.h / ch);
        for (let iy = 0; iy < ny; iy++)
            for (let ix = 0; ix < nx; ix++)
                if (rng() < 0.07) {
                    const sx = a.x + ix * cw + mort, sy = a.y + iy * ch + mort;
                    cracks.push([sx + (cw - mort*2) * (0.2 + rng() * 0.25), sy + (ch - mort*2) * 0.15,
                                 sx + (cw - mort*2) * (0.55 + rng() * 0.3), sy + (ch - mort*2) * 0.85]);
                }
    }

    // Brick bond: alternating row offset, uniform brick dimensions chosen per room
    _brickStones(a, bw, bh, mort, segs, cracks, rng) {
        const nRows = Math.ceil(a.h / bh);
        for (let iy = 0; iy < nRows; iy++) {
            const ry = a.y + iy * bh;
            if (ry >= a.y + a.h) break;
            if (iy > 0) segs.push([a.x, ry, a.x + a.w, ry]);
            const off = (iy & 1) ? bw * 0.5 : 0;
            for (let x = a.x + off; x < a.x + a.w; x += bw) {
                const lx = Math.round(x);
                if (lx > a.x && lx < a.x + a.w)
                    segs.push([lx, ry, lx, Math.min(ry + bh, a.y + a.h)]);
            }
            const nBricks = Math.ceil(a.w / bw);
            for (let ix = 0; ix < nBricks; ix++) {
                const bx = a.x + ix * bw + off;
                if (bx >= a.x + a.w) break;
                if (rng() < 0.06) {
                    const sx = bx + mort, sy = ry + mort;
                    const sw = Math.min(bw - mort * 2, a.x + a.w - sx);
                    const sh = bh - mort * 2;
                    if (sw > 2 && sh > 2)
                        cracks.push([sx + sw * (0.2 + rng() * 0.25), sy + sh * 0.15,
                                     sx + sw * (0.55 + rng() * 0.3), sy + sh * 0.85]);
                }
            }
        }
    }

    // Outer boundary line only where a floor area faces solid rock.
    // Each edge is scanned in STEP-pixel increments; segments that face floor are silently skipped.
    // All segments accumulate into one beginPath, drawn with a single stroke().
    _outlines(ctx) {
        const gen  = this.gen;
        const STEP = 3;

        const scanH = (ey, x1, x2, cy) => {
            let seg = null;
            for (let x = x1; x <= x2; x += STEP) {
                const wall = gen._pixelType(x, cy) === T.WALL;
                if (wall && seg === null)  seg = x;
                if (!wall && seg !== null) { ctx.moveTo(seg, ey); ctx.lineTo(x, ey); seg = null; }
            }
            if (seg !== null) { ctx.moveTo(seg, ey); ctx.lineTo(x2, ey); }
        };

        const scanV = (ex, y1, y2, cx) => {
            let seg = null;
            for (let y = y1; y <= y2; y += STEP) {
                const wall = gen._pixelType(cx, y) === T.WALL;
                if (wall && seg === null)  seg = y;
                if (!wall && seg !== null) { ctx.moveTo(ex, seg); ctx.lineTo(ex, y); seg = null; }
            }
            if (seg !== null) { ctx.moveTo(ex, seg); ctx.lineTo(ex, y2); }
        };

        ctx.beginPath();
        for (const a of [...gen.rooms, ...gen.corridors]) {
            scanH(a.y,       a.x, a.x + a.w, a.y - 2);
            scanH(a.y + a.h, a.x, a.x + a.w, a.y + a.h + 2);
            scanV(a.x,       a.y, a.y + a.h, a.x - 2);
            scanV(a.x + a.w, a.y, a.y + a.h, a.x + a.w + 2);
        }
        ctx.strokeStyle = PAL.outline;
        ctx.lineWidth   = 1.8;
        ctx.lineCap     = 'butt';
        ctx.stroke();
    }

    // Inner shadow along room edges that face solid wall — skips edges where corridors or other rooms connect
    _edgeShadow(ctx) {
        const sw  = 8;
        const D   = 6;
        const gen = this.gen;

        for (const r of gen.rooms) {
            const mx = r.x + r.w / 2, my = r.y + r.h / 2;
            const qx1 = r.x + r.w * 0.25, qx3 = r.x + r.w * 0.75;
            const qy1 = r.y + r.h * 0.25, qy3 = r.y + r.h * 0.75;

            const sides = [
                { x: r.x, y: r.y,            w: r.w, h: sw,  dx: 0,  dy: 1,
                  chk: [[qx1,r.y-D],[mx,r.y-D],[qx3,r.y-D]] },
                { x: r.x, y: r.y+r.h-sw,     w: r.w, h: sw,  dx: 0,  dy: -1,
                  chk: [[qx1,r.y+r.h+D],[mx,r.y+r.h+D],[qx3,r.y+r.h+D]] },
                { x: r.x,          y: r.y,    w: sw,  h: r.h, dx: 1,  dy: 0,
                  chk: [[r.x-D,qy1],[r.x-D,my],[r.x-D,qy3]] },
                { x: r.x+r.w-sw,   y: r.y,    w: sw,  h: r.h, dx: -1, dy: 0,
                  chk: [[r.x+r.w+D,qy1],[r.x+r.w+D,my],[r.x+r.w+D,qy3]] },
            ];

            for (const { x, y, w, h, dx, dy, chk } of sides) {
                // Only draw shadow where every sampled exterior point is wall
                if (!chk.every(([px, py]) => gen._pixelType(px, py) === T.WALL)) continue;
                const gx1 = dx > 0 ? x : dx < 0 ? x + w : x;
                const gy1 = dy > 0 ? y : dy < 0 ? y + h : y;
                const gx2 = dx > 0 ? x + w : dx < 0 ? x : x;
                const gy2 = dy > 0 ? y + h : dy < 0 ? y : y;
                const g   = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
                g.addColorStop(0, 'rgba(0,0,0,0.40)');
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.fillRect(x, y, w, h);
            }
        }
    }

    // Scattered small fungi in chambers — Forgotten Kingdom biome flavour
    _fungi(ctx) {
        const rng = this.rng;
        for (const room of this.gen.rooms) {
            if (room.type === T.ENTRY) continue;
            const count = 2 + Math.floor((room.w * room.h) / 900 * (room.type === T.BOSS ? 1.4 : 1));
            for (let i = 0; i < count; i++) {
                const fx = room.x + 10 + rng() * (room.w - 20);
                const fy = room.y + 10 + rng() * (room.h - 20);
                const s  = 4 + rng() * 6;
                this._drawFungus(ctx, fx, fy, s);
            }
        }
    }

    _drawFungus(ctx, x, y, s) {
        // Stalk
        ctx.beginPath();
        ctx.moveTo(x - s * 0.09, y + s * 0.42);
        ctx.lineTo(x + s * 0.09, y + s * 0.42);
        ctx.lineTo(x + s * 0.055, y - s * 0.05);
        ctx.lineTo(x - s * 0.055, y - s * 0.05);
        ctx.closePath();
        ctx.fillStyle = '#4e4858';
        ctx.fill();
        // Cap
        ctx.beginPath();
        ctx.ellipse(x, y - s * 0.12, s * 0.48, s * 0.22, 0, 0, Math.PI * 2);
        ctx.fillStyle   = '#3c3848';
        ctx.strokeStyle = '#1c1a24';
        ctx.lineWidth   = 0.5;
        ctx.fill();
        ctx.stroke();
        // Bioluminescent highlight
        ctx.beginPath();
        ctx.ellipse(x - s * 0.1, y - s * 0.25, s * 0.16, s * 0.08, -0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#5a5468';
        ctx.fill();
    }

    // Subtle radial glow at chamber and boss room centres
    _atmosphericLight(ctx) {
        for (const { x, y } of this.gen.chamberCenters) {
            const g = ctx.createRadialGradient(x, y, 0, x, y, 60);
            g.addColorStop(0, 'rgba(90, 60, 140, 0.14)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - 65, y - 65, 130, 130);
        }
        if (this.gen.bossPos) {
            const boss = this.gen.rooms.at(-1);
            const bx   = boss.x + boss.w / 2;
            const by   = boss.y + boss.h / 2;
            const g    = ctx.createRadialGradient(bx, by, 0, bx, by, 80);
            g.addColorStop(0, 'rgba(110, 20, 100, 0.20)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(bx - 90, by - 90, 180, 180);
        }
    }

    // ── Entry daylight — light streaming in from outside through the entrance ──
    _entryDaylight(ctx) {
        const room = this.gen.rooms.find(r => r.type === T.ENTRY);
        if (!room) return;
        const rng = mkRng(this.gen.seed ^ 0xDA711900);

        // The entrance opening is on the left wall, centred vertically
        const ox = room.x;         // x of the opening
        const oy = room.y + room.h / 2;  // y centre of the opening
        const openH = room.h * 0.55;     // height of the opening

        ctx.save();
        // Clip all light effects to the room
        ctx.beginPath();
        ctx.rect(room.x, room.y, room.w, room.h);
        ctx.clip();

        // 1. Base light flood — warm horizontal gradient from opening inward
        const base = ctx.createLinearGradient(ox, 0, ox + room.w, 0);
        base.addColorStop(0,    'rgba(255, 248, 215, 0.82)');
        base.addColorStop(0.20, 'rgba(248, 235, 185, 0.48)');
        base.addColorStop(0.55, 'rgba(230, 210, 155, 0.18)');
        base.addColorStop(1,    'rgba(0,   0,   0,   0)');
        ctx.fillStyle = base;
        ctx.fillRect(room.x, room.y, room.w, room.h);

        // 2. Bright bloom right at the opening
        const bloom = ctx.createRadialGradient(ox, oy, 0, ox, oy, openH * 0.9);
        bloom.addColorStop(0,    'rgba(255, 255, 240, 0.88)');
        bloom.addColorStop(0.25, 'rgba(255, 248, 210, 0.50)');
        bloom.addColorStop(0.65, 'rgba(240, 225, 175, 0.18)');
        bloom.addColorStop(1,    'rgba(0,   0,   0,   0)');
        ctx.fillStyle = bloom;
        ctx.fillRect(room.x, room.y, room.w * 0.75, room.h);

        // 3. Light shafts — wedges fanning inward from the opening
        const nShafts = 5 + Math.floor(rng() * 5);
        for (let i = 0; i < nShafts; i++) {
            // Shafts fan across the full opening height, each slightly randomised
            const angle    = (rng() - 0.5) * Math.PI * 0.65;
            const halfSpan = (0.022 + rng() * 0.055);
            const len      = room.w * (0.55 + rng() * 0.55);
            const alpha    = 0.045 + rng() * 0.065;

            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(
                ox + Math.cos(angle - halfSpan) * len,
                oy + Math.sin(angle - halfSpan) * len
            );
            ctx.lineTo(
                ox + Math.cos(angle + halfSpan) * len,
                oy + Math.sin(angle + halfSpan) * len
            );
            ctx.closePath();
            ctx.fillStyle = `rgba(255, 248, 210, ${alpha.toFixed(3)})`;
            ctx.fill();
        }

        // 4. Shadow — top and bottom corners receive less light
        const topShadow = ctx.createLinearGradient(0, room.y, 0, room.y + room.h * 0.38);
        topShadow.addColorStop(0, 'rgba(0,0,0,0.42)');
        topShadow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = topShadow;
        ctx.fillRect(room.x, room.y, room.w, room.h * 0.38);

        const botShadow = ctx.createLinearGradient(0, room.y + room.h * 0.62, 0, room.y + room.h);
        botShadow.addColorStop(0, 'rgba(0,0,0,0)');
        botShadow.addColorStop(1, 'rgba(0,0,0,0.42)');
        ctx.fillStyle = botShadow;
        ctx.fillRect(room.x, room.y + room.h * 0.62, room.w, room.h * 0.38);

        // 5. Far wall shadow — back of the room stays dark
        const farShadow = ctx.createLinearGradient(ox + room.w * 0.5, 0, ox + room.w, 0);
        farShadow.addColorStop(0, 'rgba(0,0,0,0)');
        farShadow.addColorStop(1, 'rgba(0,0,0,0.38)');
        ctx.fillStyle = farShadow;
        ctx.fillRect(room.x, room.y, room.w, room.h);

        ctx.restore();
    }

    // ── Boss rune ──────────────────────────────────────────────────────────────
    _bossRune(ctx) {
        const room = this.gen.rooms.find(r => r.type === T.BOSS);
        if (!room) return;

        const cx  = room.x + room.w / 2;
        const cy  = room.y + room.h / 2;
        const rad = Math.min(room.w, room.h) * 0.30;

        // Dark aura
        const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * 2.2);
        aura.addColorStop(0,   'rgba(120, 10, 100, 0.38)');
        aura.addColorStop(0.45,'rgba(70,  5,  65,  0.18)');
        aura.addColorStop(1,   'rgba(0,   0,  0,   0)');
        ctx.fillStyle = aura;
        ctx.fillRect(room.x, room.y, room.w, room.h);

        ctx.save();
        ctx.translate(cx, cy);

        // Outer ring
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(160, 30, 140, 0.60)';
        ctx.lineWidth   = 1.8;
        ctx.stroke();

        // Inner ring
        ctx.beginPath();
        ctx.arc(0, 0, rad * 0.60, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(180, 40, 155, 0.45)';
        ctx.lineWidth   = 1.0;
        ctx.stroke();

        // 6-pointed star lines (hexagram)
        ctx.strokeStyle = 'rgba(165, 35, 145, 0.50)';
        ctx.lineWidth   = 1.0;
        for (let i = 0; i < 6; i++) {
            const a  = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const a2 = a + Math.PI;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a)  * rad * 0.62, Math.sin(a)  * rad * 0.62);
            ctx.lineTo(Math.cos(a2) * rad * 0.62, Math.sin(a2) * rad * 0.62);
            ctx.stroke();
        }

        // Tick marks on outer ring
        ctx.strokeStyle = 'rgba(180, 50, 155, 0.55)';
        ctx.lineWidth   = 1.2;
        for (let i = 0; i < 12; i++) {
            const a  = (i / 12) * Math.PI * 2;
            const r1 = rad * 0.88, r2 = rad;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
            ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
            ctx.stroke();
        }

        // Centre dot glow
        const cdot = ctx.createRadialGradient(0, 0, 0, 0, 0, rad * 0.18);
        cdot.addColorStop(0, 'rgba(220, 80, 200, 0.80)');
        cdot.addColorStop(1, 'rgba(0,   0,  0,  0)');
        ctx.fillStyle = cdot;
        ctx.beginPath();
        ctx.arc(0, 0, rad * 0.18, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    _vignette(ctx) {
        const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.12, W / 2, H / 2, H * 0.80);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.60)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }
}

// ── Party marker ───────────────────────────────────────────────────────────

function placePartyMarker(svgEl, q, r) {
    const NS  = 'http://www.w3.org/2000/svg';
    const old = svgEl.querySelector('#party-marker');
    if (old) old.remove();

    const { x, y } = hexToPixel(q, r);
    const g = document.createElementNS(NS, 'g');
    g.id = 'party-marker';

    const shadow = document.createElementNS(NS, 'circle');
    shadow.setAttribute('cx', x + 1.2); shadow.setAttribute('cy', y + 1.8);
    shadow.setAttribute('r', String(hexR * 0.50));
    shadow.setAttribute('fill', 'rgba(0,0,0,0.55)');
    shadow.setAttribute('pointer-events', 'none');

    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', x); circle.setAttribute('cy', y);
    circle.setAttribute('r', String(hexR * 0.50));
    circle.setAttribute('fill',         'rgba(48, 90, 195, 0.92)');
    circle.setAttribute('stroke',       'rgba(175, 205, 255, 0.95)');
    circle.setAttribute('stroke-width', '1.4');

    const icon = document.createElementNS(NS, 'text');
    icon.setAttribute('x', x); icon.setAttribute('y', String(y + hexR * 0.25));
    icon.setAttribute('text-anchor', 'middle');
    icon.setAttribute('font-size',   String(hexR * 0.65));
    icon.setAttribute('fill', 'rgba(220, 235, 255, 0.96)');
    icon.setAttribute('pointer-events', 'none');
    icon.textContent = '⚔';

    g.appendChild(shadow); g.appendChild(circle); g.appendChild(icon);
    svgEl.appendChild(g);
}

// ── HexGridManager data ────────────────────────────────────────────────────

function buildHexData(gen) {
    const cells = [];
    for (const [k, type] of gen.grid) {
        const [q, r] = k.split('_').map(Number);
        const floor  = type !== T.WALL;
        cells.push({ q, r, terrain_type: type, move_cost: floor ? 1.0 : null, is_passable: floor });
    }
    return {
        map_metadata: {
            map_id:          `dungeon_${gen.seed.toString(16).padStart(8, '0')}`,
            map_type:        'DUNGEON',
            biome:           'cave',
            grid_dimensions: { cols: COLS, rows: ROWS },
            hex_scale:       { hex_size: 5, unit: 'feet' },
            svg_config:      { viewBox: `0 0 ${W} ${H}` },
            seed:            gen.seed,
        },
        cells,
    };
}

// ── Shared build: render dungeon into an SVG element, return handles ────────
// Used by dungeon.html below and by the game shell (dungeon-scene.js) through
// window.LeonoriaDungeon.

function buildDungeon(seed, type, svgEl) {
    const gen = new DungeonGen(seed, type).generate();

    const canvas = document.createElement('canvas');
    new CaveRenderer(gen).render(canvas);

    while (svgEl.lastChild) svgEl.removeChild(svgEl.lastChild);
    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const NS  = 'http://www.w3.org/2000/svg';
    const img = document.createElementNS(NS, 'image');
    img.setAttribute('href',   canvas.toDataURL('image/png'));
    img.setAttribute('x',      '0');
    img.setAttribute('y',      '0');
    img.setAttribute('width',  String(W));
    img.setAttribute('height', String(H));
    svgEl.appendChild(img);

    const hgm = new HexGridManager(buildHexData(gen), svgEl);
    return { gen, hgm };
}

window.LeonoriaDungeon = {
    build: buildDungeon,
    placePartyMarker,
    typeLabel,
    MOVE_BUDGET,
    T,
};

// ── Page (dungeon.html dev harness only) ───────────────────────────────────

let _hgm = null;

function generateDungeon(seed, type = 'small') {
    const svgEl = document.getElementById('dungeon-svg');
    const built = buildDungeon(seed, type, svgEl);
    const gen   = built.gen;
    _hgm        = built.hgm;

    const party = { q: gen.entrancePos.q, r: gen.entrancePos.r };

    function showReachable() {
        _hgm.clearOverlay();
        const reachable = _hgm.getMovementRange(party.q, party.r, MOVE_BUDGET);
        _hgm.highlightCells(reachable, {
            fill:        'rgba(50, 100, 220, 0.02)',
            stroke:      'rgba(120, 165, 255, 0.06)',
            strokeWidth: 0.9,
        });
        placePartyMarker(svgEl, party.q, party.r);
        return reachable;
    }

    let reachable = showReachable();
    document.getElementById('cell-info').textContent = 'Click a highlighted hex to move';

    _hgm.onClick(({ q, r, cell }) => {
        const key = `${q}_${r}`;
        if (cell.terrain_type === T.WALL) {
            document.getElementById('cell-info').textContent = 'Wall — cannot move there';
            return;
        }
        if (reachable.has(key)) {
            party.q = q;
            party.r = r;
            reachable = showReachable();
            document.getElementById('cell-info').textContent =
                `Moved to ${typeLabel(cell.terrain_type)} (${q}, ${r})`;
        } else {
            document.getElementById('cell-info').textContent = 'Out of range';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const seedInput  = document.getElementById('seed-input');
    const typeSelect = document.getElementById('type-select');
    const genBtn     = document.getElementById('btn-generate');
    if (!seedInput || !genBtn) return;   // game.html loads this file for the API only

    let seed = Math.floor(Math.random() * 0xFFFFFFFF);
    seedInput.value = seed;
    generateDungeon(seed, typeSelect.value);

    genBtn.addEventListener('click', () => {
        const v = parseInt(seedInput.value, 10);
        seed = (isNaN(v) ? Math.floor(Math.random() * 0xFFFFFFFF) : v) >>> 0;
        seedInput.value = seed;
        generateDungeon(seed, typeSelect.value);
    });

    seedInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') genBtn.click();
    });
});

})();
