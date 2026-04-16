# Leonoria — Claude Code Guide

Leonoria is a browser-based fantasy RPG with two main components: a **procedural map generator** (`map.html` / `map.js`) and a **character creator** (`characters.html` / `character-creator.js`). A battle map (`battlemap.html`) is also in development.

---

## Folder Structure

```
assets/images/          # All image files (sprites, symbols, etc.)
assets/sounds/          # All audio files
data/                   # All JSON game data
  combat/               # Attacks, spells, AI tactics
  cultures/             # Kingdoms, factions
  heroes/               # Classes, races, skills, aptitudes, abilities, backgrounds, personalities
  items/                # Weapons (melee 1H/2H, ranged, magic), materials, quality, curses, effects
  mechanics/            # Core rules
*.js                    # Source files at root (game.js, map.js, legend-config.js, etc.)
index.html, style.css   # At root
```

**Never** place new images/sounds outside `assets/`, or JSON data outside `data/`.

---

## Map Generator Architecture

```
FantasyMap.generate()  →  FantasyMap.saveMapData()
                               ↓
                    data/maps/leonoria_SEED.{svg,json}
                    + MapSaveStore.lastSaved (in-memory)
                               ↓
                    HexGridManager(mapData, svgEl)
                               ↓
                    Interactive hex grid overlaid on SVG
```

- **MapSaveStore** (`window.MapSaveStore`): holds `lastSaved = { baseName, jsonData }` after every export; uses File System Access API with IndexedDB persistence.
- **HexGridManager**: rectangular pixel math for SVG alignment, hex connectivity (6 directions) for gameplay. `cellW/cellH` are dynamic — no hardcoded pixels.
  - Key methods: `pixelToHex`, `hexToPixel`, `getCell`, `findPath`, `getMovementRange`, `calcPathCost`, `highlightCells`, `onClick`
  - Factories: `HexGridManager.fromLastSave(svgEl)` (preferred) or `HexGridManager.load(path, svgEl)`

**DnD movement scale:** WORLD = 6 miles/hex, DUNGEON = 5 ft/hex. `move_cost 1.0` = normal, `2.0` = Difficult Terrain.

---

## Rendering Performance Rules (MANDATORY)

- **Never** create individual SVG elements in a loop for repetitive features (trees, grass, terrain marks, farmland, etc.)
- Always use an offscreen `<canvas>` → `canvas.toDataURL('image/png')` → embed as `<image>` in the SVG layer.
- **Never** call `ctx.stroke()` or `ctx.fill()` inside a tight loop. Use one `beginPath()` before the loop, accumulate all path calls, then one `stroke()` after.
- Only split `beginPath/stroke` batches when `strokeStyle` or `lineWidth` changes.
- This applies to ALL maps, ALL biomes, ALL features.

---

## Map Rendering — Work in Progress

### Farmland
> See memory: `farmland_history.md` for full development log.

BFS cluster approach — each settlement spawns adjacent blobs. Opaque earthy fills (boolean NOT overlay), active on plains/temperate_forest/coastal biomes. Targets: plains city=70, town=45, village=22; others city=32, town=20, village=10.

### Mountain Styles
> See memory: `mountain_styles.md` for full tier data, profile coordinates, and helper functions.

`mountain-styles.js` defines `MOUNTAIN_TIER_STYLES` (tiers 1–6): foothills → alpine_range. Each tier has 4 profile variants with normalized ridge silhouette pts, stipple density, hachure stroke count, and snow fraction. Helper functions: `mapHeightToTier`, `clusterTier`, `pickProfile`. **`_drawPeakCanvas` in `map.js` has not yet been updated to use this data** — that is the next step.

### Coastlines
> See memory: `coastline_state.md` for full fix history and known issues.

Land fill uses bilinear smooth scaling (putImageData → canvas scale-up). Marching-squares contour path exists as `_buildContourPath(SL)` in `map.js` but is currently unused — the coast stroke was removed because it looked bad. Known work-in-progress; do not re-add coast hatch marks. When returning to coast work, start from `_drawCoastline()` and `_buildContourPath`.

---

## Map Generation Rules

### The Badlands
- Strictly inland — no ocean generation.
- Small lakes are allowed but sparse (arid environment).
- The map type selector must be locked to Badlands only when this type is active.

### Settlements vs. Ruins
- **Ruins are archaeological sites, NOT settlements.** They are a completely separate category.
- Queries for "small settlements" = villages, fishing_villages, camps — never ruins.
- Ruins must be excluded from settlement-specific UI (e.g., hover-to-show names).

### Strongholds
- Every map must generate **at least one** stronghold landmark.
- Use `Math.max(1, calculatedCount)` for both dominant and secondary culture stronghold placement.

---

## Character Creator

### Spell Leveling System — LOCKED

**Do not modify without explicit user permission.**

Each spell school in `data/combat/attacks_and_spells.json` has its own level distribution:
- Weakest spell = level 1, strongest = level 24 (80% of max level 30).
- Spells in between are distributed proportionally by cost ratio within the school.
- `calculateAbilityLevel()` is only a fallback for abilities without a `level` field.

This system was hard-won. Modifying it without permission wastes enormous effort.

### Weapon System
8 data files in `data/items/`:
- `weapons_melee_1h.json` (52 weapons), `weapons_melee_2h.json` (49 weapons)
- `weapons_ranged.json` (bows/arrows), `weapons_magic.json`
- `weapon_materials.json`, `weapon_quality_system.json`, `weapon_curses.json`, `weapon_secondary_effects.json`

### Races
13 sub-races, each with an `own_name` field (their self-given name in their own language). Shown in the character creator dropdown and flavor text.

### Backgrounds
195 backgrounds total — 5 per class, across 39 classes. Stored in `data/heroes/backgrounds.json` as a flat array under `profession_backgrounds`, each with a `for_classes: [array]` field. The `buildBackgroundSelect()` function in `character-creator.js` filters by `S.cls`.

---

## General Rules for Claude

- **Ask before making large or structural changes to game mechanics** — spell progression, damage formulas, level scaling, class design, etc. If a system is described as "already done," don't touch it without confirmation.
- Large changes (affecting more than one JSON file, or restructuring > 100 lines) require asking first.
- When in doubt: ask rather than assume.

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
