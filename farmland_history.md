---
name: Farmland rendering history
description: Full log of what was tried, what failed, what partially worked, and what still needs fixing for the farmland feature in map.js
type: project
---

# Farmland Rendering — Development Log (2026-03-24)

## Goal
Organic patches of hedged fields near settlements, with earthy yellows/browns/greens and semi-transparency so the land beneath shows through. Like farmland in computer-game maps. Active on plains, temperate_forest, coastal biomes.

---

## What existed before this session

A `_drawFarmland(settles, rivers)` function in `map.js` that:
- Built a `farmCells` Set from cells near settlements/rivers
- **Had a tight elevation filter: `0.06 <= fh < 0.16` above sea level**
- Drew small irregular polygons (5–8 sides, radius 7–14px) on a 30px grid
- Embedded result as `<image href=canvas.toDataURL()>` into SVG group `gFarmland`
- Was wrapped in a `try/catch` that silently swallowed all errors

**Result: completely invisible.** The elevation filter `fh >= 0.16` was discarding all eligible cells, leaving `farmCells` empty and nothing drawn.

---

## Root cause of invisibility

The elevation range `0.06 ≤ fh < 0.16` (i.e., height 0.48–0.58 with SL=0.42) was too narrow. The plains biome places settlements on any non-mountain land (elevation 0–0.28 above SL). Most land is above `fh=0.16`, so `farmCells.size` was always 0, the early-return fired, and nothing was drawn.

**Fix**: Removed the elevation sub-range entirely. `markCell` now only checks `hm.isLand() && !hm.isMountain()`.

---

## What was tried in this session (in order)

### Attempt 1 — Bigger polygons, two-pass render, pixel-grid iteration
- GRID 30→52, polygon radius 7–14→18–31px, 4–6 sides
- Introduced `buildFieldPath()` helper, two-pass (fills then hedgerow strokes)
- **Still invisible** — later discovered the elevation filter was the actual cause (not fixed yet at this stage)

### Attempt 2 — Fixed elevation filter, still using pixel-grid approach
- Removed narrow elevation band
- **Still invisible** — the pixel-grid → heightmap-cell mapping via `inFarm(px, py)` appeared to work logically but produced no output. Never confirmed why (try/catch hid the error)

### Attempt 3 — Complete rewrite: iterate farmCells directly
- Abandoned pixel-grid approach entirely
- Iterate over `farmCells` set directly (gc/gr known, no re-mapping)
- Draw ellipses/polygons centered on each cell
- Added hedgerow pass: drew lines along cell edges bordering non-farmland cells
- **NOW VISIBLE** but had two major problems:
  1. `baseR = Math.max(cw, ch) * (0.7–1.1)` made each polygon ~1× cell size, which at 75% density made the whole map one big farmland blob
  2. The cell-edge hedgerow pass drew visible rectangular grid outlines across the map (ugly boxes)

### Attempt 4 — Fix density and size
- Reduced `SETTLE_R` from 10→4 (plains), 7→3 (others); `RIVER_R` 4→1
- Polygon `baseR` changed to `cw * (0.38–0.54)` (half-filled cell)
- Removed cell-edge hedgerow pass; stroke the polygon directly instead
- **Better** — fields visible, no ugly boxes, but still too large and too spread out

### Attempt 5 — Half size again, forest exclusion
- `baseR` halved to `cw * (0.19–0.27)`
- Added `forestCovered` set built from `forests` clusters; `markCell` skips forested cells
- `forests` array now passed into `_drawFarmland(settles, rivers, forests)`
- **Current state** — user said "doesn't look great, but let's leave it"

---

## Current state of the code (end of session)

### Function signature
```javascript
_drawFarmland(settles = [], rivers = [], forests = [])
```
Called as:
```javascript
try { this._drawFarmland(settles, rivers, forests); } catch(e) { console.warn('[Leonoria] farmland skipped:', e); }
```

### Key parameters
- `SETTLE_R`: 4 (plains), 3 (temperate_forest / coastal)
- `RIVER_R`: 1 (all biomes)
- `baseR`: `cw * (0.19 + (h & 31) / 31.0 * 0.08)` ≈ 19–27% of cell width
- Skip rate: `h % 3 !== 0` → keeps ~33% of eligible cells
- Sides: 4–6 polygon

### Rendering approach
- Iterate `farmCells` directly; draw polygon per cell
- Stroke polygon directly at `globalAlpha=0.60` for hedge effect
- No cell-edge hedgerow lines (they caused rectangular grid artifacts)
- Canvas embedded as `<image href=canvas.toDataURL()>` in `gFarmland` SVG group

---

## What still needs improvement (next time)

1. **Polygon size** — still arguably too large or fields too isolated. The `baseR` at 19–27% of cell width creates small blobs. Ideally fields should feel like adjacent parcels sharing a hedgerow line, not scattered dots.

2. **Hedgerow look** — The current approach (stroke each polygon individually) doesn't produce a true hedgerow appearance. A better approach: draw a dark line BETWEEN adjacent farmland cells with different colors, or use a proper polygon-per-cluster approach.

3. **Field clustering** — The user wants fields "plotted more together, closer to settlements." Consider a density gradient: cells closer to settlement centers are more likely to be drawn (use distance weighting instead of flat skip rate).

4. **Organic patch shape** — The ideal is large irregular patches (like Voronoi regions), each a single crop color, with hedge lines at the borders. This would require either: (a) flood-filling connected farmCells groups and drawing one polygon per group, or (b) assigning colors based on proximity to seed points (Voronoi-like).

5. **Overall density** — User confirmed it's "not great." May need tuning in a future session with fresh eyes.

---

## Technical notes for next attempt

- `cw = W / COLS` where COLS = 72 (small map) or 144 (large). On a 1170px wide small map: cw ≈ 16px
- `ch = H / ROWS` where ROWS = 54 or 108. On an 800px tall small map: ch ≈ 15px
- `hm.isLand(c, r)` = height > seaLevel (0.42 default)
- `hm.isMountain(c, r)` = height > seaLevel + mountainOffset (0.42 + 0.28 = 0.70 default)
- The `try/catch` on farmland HIDES ALL ERRORS. Always check browser console for `[Leonoria] farmland skipped:` warnings first
- Settlement objects have `.c`, `.r` (heightmap cell), `.x`, `.y` (pixel), `.type`, `.name`
- River path objects are `{ c, r }` heightmap cells
- Forest cluster objects are `{ c, r, count, radius }` — radius is in heightmap cell units
