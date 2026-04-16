---
name: weapon_system_state
description: State of the weapon data system — what was built, what files exist, what still needs to be done
type: project
---

## What was built (session 2026-04-11)

Full weapon data system created in `data/items/`. All files are Leonoria-native (D&D files deprecated).

### New files created
| File | Contents |
|------|----------|
| `weapon_quality_system.json` | 7 quality classes (Simple/Normal/Fine/Rare/Magical/Unique/Cursed), display name format rules, cost formula, battle stamina formula |
| `weapon_materials.json` | 12 materials: wooden, bone, stone, iron, steel, master_steel, northern_iron, dark_steel, arcanium, ancient_steel, ilithium, voidsteel — each with damage/cost multipliers, racial origins, special passives |
| `weapon_curses.json` | All 20 curses (Bound, Heavy Grip, Dull Edge … Soul Tax) with mechanical effects |
| `weapon_secondary_effects.json` | All secondary effects (Rupturing, Bleeding, Concussion, Staggering, Secondary Strike, Extra Painful, Cascade, Critical Strike, Thorns, Venomous, Poisonous, Organia, Blessed Materium, Impact, Fire, Ice, Darkvoid, Blight) with UI color/icon hints |
| `weapons_melee_1h.json` | 52 1H weapons (W1H_001–052): daggers through improvised torch |
| `weapons_melee_2h.json` | 49 2H weapons (W2H_001–049): greatsword through spiked great chain |
| `weapons_ranged.json` | 5 bow types (WRB_001–005) + 10 arrow types (ARW_001–010) |
| `weapons_magic.json` | 15 magic 1H foci (WM1_001–015) + 13 magic 2H staves (WM2_001–013) |
| `assets/images/items/placeholder.svg` | Dark-background SVG placeholder with sword silhouette and "?" mark |

### Deprecated files (now contain redirect notices only)
- `data/items/basicweapons.json` → superseded by weapons_melee_1h + 2h
- `data/items/exoticweapons.json` → was D&D format, fully replaced
- `data/items/legendaryweapons.json` → still contains D&D artifact data (Sword of Zariel etc.) — **needs replacement** next session

### Schema summary (each weapon entry)
- `id`, `name`, `hands` (1 or 2), `reach_hex` (1 or 2)
- `throwable` (bool), `thrown_range_hex` where relevant
- `damage_distribution` (array of {type, percent})
- `base_dmg_range` [min, max] for Normal Iron quality
- `primary_stat` (Physiology/Vigor/Cognition/Conviction)
- `min_physiology`, `material_group`, `base_cost_copper`
- `special_rule` (unique mechanics), `flavor` (tooltip text)

### Key mechanics encoded
- Battle Stamina formula: 2H = floor((Phys-10)/2) turns, 1H = floor(7 + (Phys-10)×0.3) turns, hits 0 → damage -50%
- Quality multipliers: Simple 0.80-0.95×, Normal 1×, Fine 1.05-1.20×, Rare 1.25-2×, Unique 2×
- Curse global chance: 1% on non-starter weapons
- Starter weapons: only Simple/Normal, Iron/Steel/Wooden only, no secondary effects

## What still needs to be done

1. **Replace `legendaryweapons.json`** — still has D&D artifacts. Needs Leonoria-native unique/legendary weapons.
2. **UI: Inventory Tab** — new tab in characters.html to display weapons with all fields, quality color coding, damage distribution bars, material badges
3. **UI: Tooltips** — hover tooltip component using the display_name_format from quality_system.json
4. **Vendor system** — not yet designed. User will add this later.
5. **Loot/drop integration** — weapons need to connect to battle loot and quest reward systems (not yet implemented)
6. **Placeholder SVG variants** — currently one generic sword SVG. May want category-specific placeholders (axe, bow, staff, etc.)
7. **Armors** — `basicarmors.json`, `exoticarmors.json`, `legendaryarmors.json` still exist and may also be D&D format — check and replace if needed

**Why:** The user wants a new improved character creation tab and in-game inventory that displays all weapon details, with tooltips on hover. Vendors selling weapons will be added later.
