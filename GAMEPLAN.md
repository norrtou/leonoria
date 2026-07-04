# Leonoria — Game Integration Plan (GAMEPLAN)

> **Purpose of this document:** The master plan for weaving Leonoria's separate parts
> (character creator, world map generator, battle map, dungeon generator) into one
> playable game. This file is the source of truth for the integration work — if a
> session ends mid-phase, resume from here. Keep the *Status* column updated.
>
> **Platform:** Desktop only. All game UI is optimized for a desktop screen with
> mouse + keyboard. Only the info pages (index.html, about.html, webdata/*) need to
> stay mobile-friendly.

---

## Current Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Game spine: GameState + scene flow | **BUILT — needs in-browser verification** |
| 2 | Encounter bridge: overworld → battle → results | **BUILT (v1)** — biome battlefield palettes done (BIOME_PALETTES in battle-map.js recolors ground/shrubs/flowers/rocks per biome; tree foliage stays green — known compromise). Loot drops done (loot.js). Monster archetypes done (MONSTER_ARCHETYPES in battle-map.js: beast_fast/beast_heavy/serpent/undead/humanoid melee+ranged with own stats & attacks, keyword-classified from bestiary names; boss-flagged elites; gentle party-level scaling). Flee option done (🏃 button in the combat panel, hero turns only: 60% escape → battle ends `{fled:true}`, no rewards/penalty; failure wastes the turn). Per-monster sprite art done (drawWolf/drawBrute/drawSerpent/drawUndead in battle-map.js, same flat-shaded style as the goblins; humanoids keep goblin/goblin_archer; wired into all three sprite switches: battlefield, initiative bar, char sheet). Remaining: boss elites reuse base sprites (no size/elite variant yet) |
| 3 | Settlements as hubs: shop, inn, rest, rumors | **BUILT (v1)** — inn rest, provisions, temple healing, persistent wounds, food per travel day, rumors→quests, trader (sell loot; buy armor/oils/charms upgrades that raise HP/damage/dodge in battle via gearBonus). Kingdom reputation done (quests raise standing with the origin's kingdom → up to 20% service discounts, shown in the panel header). Economy price modulation done (economy.json rewritten in Leonoria terms — WotC refs removed — with `kingdom_economies` price profiles per kingdom: inn/goods/temple multipliers + loot sell_rate + market note, read by settlement.js on top of the reputation discount; non-kingdom settlements stay neutral 1.0). Known quirk: settlement names can repeat across kingdoms, so name-keyed kingdom lookup (`Quests.kingdomOf`) can hit the wrong twin. Per-member weapon equipping done (equipment.js panel via ⚔ Arms HUD button; loot weapons carry dmg range from material×quality multipliers + dominant damage type from damage_distribution; equipped weapon replaces the member's physical attack in battle, casters gain it as an extra option; traders keep equipped weapons on sell; category icons from game-icons.net CC-BY in assets/images/weaponicons/, see CREDITS.md). Remaining: exotic material sell prices run high (phase 6 balance), material rarity not weighted in loot rolls |
| 4 | Procedural quests + quest log | **BUILT (v1)** — quests.js grammar (hunt/clear/delivery) targeting real map landmarks/settlements, inn rumors offer quests, quest log HUD with direction/distance, event ticker. WotC files moved to context/wotc_reference/. Delve quests done (ruins offer "Descend into…" fights in battle-map dungeon mode). Dungeon exploration done & verified in-browser (dungeon-scene.js: delve quests descend into a deterministic dungeon — seed = world seed ⊕ target hex, verified identical on re-entry; hex movement with wall/too-far guards, wandering-monster ambushes, boss chamber holds the quest fight; flee returns to the dungeon, defeat throws the party out with gold halved). Melee-AI pillar deadlock FIXED (aiMeleeMoveTowards now advances along a BFS distance field that routes around obstacles/units; raw-distance greedy kept as fallback when no path exists; verified in-browser — melee-only boss fights now resolve). Known issue: movement-range highlight in the dungeon is nearly invisible (fill alpha 0.02). Campaign-flavor text done & verified in-browser (quests.js loadCampaigns: campaign seeds from leonoria_campaigns.json matched by primary_biome to the world biome; inn quest offers get a flavor sentence in the campaign's voice — factions/loot woven into hunt/clear/delivery/delve descs; main quest stores `campaign: {title, hook}` — the starting_hook shows as a long event-ticker banner at new game, the campaign title as an italic line under the main quest in the log; biomes without a campaign seed keep the plain text). **Phase complete** |
| 5 | Audio director, fog of war, day/night | **BUILT (v1)** — audio-director.js (music/ambience channels, crossfade, autoplay unlock; title theme wired) + CREDITS.md; fog of war (canvas → single SVG image, path cells revealed, soft edges); day/night CSS tint on the overworld. Travel events done (non-combat road happenings: foraging, caches, shrines, weather, flavor). Music/ambience assets done & verified in-browser: 11 Kevin MacLeod tracks (CC-BY, assets/sounds/music/, re-encoded VBR) + 3 OGA ambience loops (assets/sounds/ambience/, ogg for gapless looping), all in CREDITS.md. Per-biome/scene tracks wired: `AudioDirector.playScene(scene, biomeId)` dispatched from `Scenes.show` (title/party/world→theme, overworld→BIOME_MUSIC/BIOME_AMBIENCE per 10 biomes, battle→Five Armies, dungeon→Ossuary+cave drips) and from the settlement open/close call sites (tavern music). Menu gets a 🔊 Sound toggle (AudioDirector.setMuted; battle-map playSound honors it via `window.AudioDirector?.muted`). **Phase complete** |
| 6 | Main quest arc, final boss, balance | **BUILT (v1)** — seeded legendary boss (legendarybestiary.json) lairs at the farthest landmark, gated by 3 shard trials at landmarks across the map; victory overlay with journey summary. Remaining: dungeon-based lairs, loot items, XP/economy balance pass |

---

## Guiding Principles

1. **Don't rewrite what works.** map.js, battle-map.js, character-creator.js and
   dungeon.js stay as they are. Integration happens through small exposed APIs and
   a shared state module — not refactors.
2. **The dev harness pages stay.** map.html, characters.html, battlemap.html and
   dungeon.html remain standalone test benches. The *game* lives in **game.html**.
3. **One save, one owner.** All session state lives in `GameState` (game-state.js)
   and persists under the single localStorage key `leonoria_save`. The existing keys
   `leonoria_characters` / `leonoria_parties` remain the character creator's roster
   storage (a library, not a session).
4. **Deterministic worlds.** The world is never stored — only `{seed, params}`.
   Regenerating with the same seed + params reproduces the identical map, so a save
   file stays tiny.
5. **Data drives everything.** Encounters come from `data/monsters/biomebestiary.json`
   (keyed by biome_id), quests from `data/campaigns/leonoria_campaigns.json` +
   the generated map's own landmarks/settlements, loot from the weapon
   material/quality/curse system, prices from `data/cultures/economy.json`.
6. **Locked systems stay locked.** The spell leveling system is used as-is (as a
   level gate), never modified.

---

## Target Architecture

```
index.html  (info hub, mobile-ok)
   └── game.html  (THE GAME — desktop only)
         ├── game-state.js   GameState: session state + save/load  (no DOM)
         ├── game-main.js    SceneManager + screens (title/party/worldgen/overworld/HUD)
         ├── game.css        Game shell styles (desktop-first)
         └── reuses:  map.js (FantasyMap), HexGridManager.js,
                      game.js (MapScreen, HeroParty, ZoomController, presets),
                      mountain-styles.js, legend-config.js, seeds.js

Later phases plug in:
         ├── encounter.js    (Phase 2) hex → encounter roll → BattleContext
         ├── battle-map.js   (Phase 2) exposed as LeonoriaBattle.start(ctx) → result
         ├── settlement.js   (Phase 3) hub UI: shop/inn/rest/rumors
         ├── quests.js       (Phase 4) quest grammar + log
         ├── audio-director.js (Phase 5) music/ambience/SFX channels
         └── dungeon.js      (Phase 4/6) dungeon quests + boss lairs
```

### Scene flow

```
TITLE ──► PARTY SELECT ──► WORLD SETUP ──► OVERWORLD ◄──► BATTLE (phase 2)
  ▲  (Continue skips straight to OVERWORLD)      ◄──► SETTLEMENT (phase 3)
  └── Save & quit returns here                   ◄──► DUNGEON (phase 4)
```

### GameState schema (v1)

```js
{
  version: 1,
  createdAt, updatedAt,          // ISO timestamps
  party: {
    name, members: [charObj…],   // snapshot copied from leonoria_parties at New Game
    gold, food,                  // party-level resources
    xp, level,                   // party-level progression (per-member later if needed)
    inventory: []                // loot items (phase 2+)
  },
  world: {
    seed, params,                // everything needed to regenerate the map
    position: { q, r },          // hero party hex
    day, hour,                   // in-game clock (travel advances it)
    milesTraveled,
    explored: [ "q,r", … ]       // visited hexes (fog of war in phase 5)
  },
  quests:     { active: [], completed: [], main: null },   // phase 4
  reputation: {},                                          // per kingdom, phase 3+
  flags:      {}                                           // arbitrary story flags
}
```

**Character object shape** (from character-creator.js `buildCharObj()`):
`{ id, name, race, subrace, gender, cls, subclass, level, age, morality,
   personality, aptitudes, birthSign, skills[], background, equipment, portrait }`

---

## Phase 1 — Game Spine  *(current)*

**Goal:** Create party → generate world → walk around → save → continue. A real
game session that survives a browser restart.

Deliverables:
- [x] `game-state.js` — GameState module: schema above, `newGame()`, `save()`,
      `load()`, `hasSave()`, `clear()`, autosave on movement. No DOM access.
- [x] `game.html` — the game shell. Screens as full-viewport divs:
      `#screen-title`, `#screen-party`, `#screen-world`, `#screen-overworld`.
      Loads the same map DOM structure (`#map-viewport > #map-container`,
      `#hero-info`) that MapScreen/HeroParty expect.
- [x] `game-main.js` — SceneManager + the four screens:
      - **Title:** New Journey / Continue (enabled when `hasSave()`), link to
        character creator, version footer.
      - **Party select:** cards for each party in `leonoria_parties` (portraits,
        members). Empty state links to characters.html.
      - **World setup:** map type + biome + optional seed. Slider values come from
        `Game.MAP_TYPE_PRESETS[type].sliders` (no 8-slider wall — the full control
        surface stays in map.html for tinkering).
      - **Overworld:** FantasyMap + HexGridManager + HeroParty + ZoomController.
        HUD: party strip (portraits/names), day + time of day, current terrain,
        Menu (save & quit to title).
- [x] `game.css` — desktop-first styling for the shell (reuses style.css tokens).
- [x] `game.js` minimal edits (keep map.html fully working):
      - Guard the auto-bootstrap so `new Game()` only runs on map.html
        (skip when `document.body.dataset.page === 'game'`).
      - Expose the JSON data loader as `window.LeonoriaData.loadAll()` so
        game-main.js can reuse it.
      - `HeroParty`: accept `{ startQ, startR, onMove }` options — restore saved
        position; report `{q, r, cell, cost}` after each move so GameState can
        advance the clock (3 mph, 8h travel day — matches HexGridManager.calcPathCost)
        and autosave.
- [x] index.html: activate the golden "begin your journey" button → game.html.

**Verify:** new game → pick party → generate world → move around (clock advances)
→ save & quit → Continue → same world (seed), same position, same clock.

---

## Phase 2 — Encounter Bridge

**Goal:** Walking the world is dangerous. Battles happen in the biome you stand in,
with your actual party, and the outcome matters.

- `encounter.js`: after each completed move, roll encounter risk per entered hex:
  `risk = f(biome danger, on-road?, near settlement?, time of day)`. Roads and
  settlement-adjacent hexes are much safer. On trigger, build an **enemy roster**
  from `biomebestiary.json` for the map's biome_id (common/uncommon tiers scaled
  to party level; rare_bosses reserved for quests).
- `battle-map.js`: expose a small API from the IIFE —
  `window.LeonoriaBattle = { start(context, onDone) }` where
  `context = { biome, seed, timeOfDay, enemyRoster, party, isDungeon, questId }`
  and `onDone(result)` gets `{ victory, xp, loot, casualties, fled }`.
  Internally: biome → terrain palette + obstacle set (outdoor variants: grass,
  snow, swamp, badlands…); enemyRoster → ENEMY_DEFS; party → hero defs (the
  partyToHeroDefs path already exists).
- Battle runs in game.html (embed battlemap canvases in a `#screen-battle`), so
  no page navigation and no state loss.
- Results: XP into GameState (level-ups gate spells via the locked spell-level
  system), basic loot rolls, death handling (defeat = wake at last settlement,
  lose gold — no permadeath for now).
- HUD gets a combat-log / event-ticker line ("A pack of dire wolves attacks!").

**Verify:** travel in wilderness triggers a battle in the right biome with the
saved party; winning grants XP that persists in the save.

---

## Phase 3 — Settlements as Hubs

**Goal:** A reason to travel *to* places, and an economy sink/source.

- Entering a settlement hex opens `#screen-settlement` (art: reuse the
  town-popup images + settlement type). Services scale with type
  (village < town < city): 
  - **Inn:** rest to heal, advances clock to morning, costs gold; rumor list
    (phase 4 hook — placeholder flavor lines until then).
  - **Trader:** buy/sell. Stock from weapons/armor JSONs filtered by settlement
    size; prices from economy.json, modulated by kingdom + reputation later.
  - **Temple:** healing/curse removal (weapon_curses.json tie-in).
- Party resources: food consumed per travel day; buy food at settlements;
  starvation = HP penalty (soft pressure, not death spiral).
- GameState.reputation scaffolding (per kingdom, from map's kingdoms export).

**Verify:** earn gold from battles → buy a better weapon → visibly better combat.

---

## Phase 4 — Procedural Quests

**Goal:** Meaning. Quests generated from the *actual* map, so text names real
places ("Clear the ruin of Thornvale, north of Elderford").

- **Sanitize first:** `data/campaigns/campaignmanifest.json`, `campaigngoals.json`,
  `campaignmasterschema.json` contain WotC IP (Phandelver, Strahd, Barovia,
  Tiamat, Mind Flayers, Svirfneblin). Rewrite in Leonoria terms or move out of
  the game data tree. `leonoria_campaigns.json` is the clean template source.
- `quests.js` — quest grammar with three independent axes:
  1. **Skeleton** from leonoria_campaigns.json (hooks, factions, boss encounters).
  2. **Place** from the generated map JSON (landmark/settlement/biome by name).
  3. **Opposition** from biome bestiary, scaled to party level.
- Quest types v1: clear-landmark, escort-on-road, hunt rare boss, delivery
  between settlements, missing-person (→ dungeon), faction task.
- Rumors at inns are the discovery mechanism; quest board for simple contracts.
- Quest log UI in the HUD; rewards: gold, XP, reputation, unique loot rolls.
- **Dungeon connection:** dungeon-type quests generate a dungeon.js layout, party
  explores it hex-by-hex (dungeon movement already spec'd: 5 ft/hex), encounters
  use battle-map's dungeon mode.

**Verify:** hear a rumor → track quest on map → complete at the named landmark →
reward + log entry.

---

## Phase 5 — Atmosphere: Audio, Fog of War, Day/Night

- `audio-director.js` on WebAudio (battle-map.js already decodes/plays buffers —
  lift that pattern): three channels (music / ambience / SFX) with crossfade on
  scene and biome changes. Volume controls in the menu.
- **Free sources** (keep a CREDITS.md from the first file added):
  - Kevin MacLeod / incompetech.com — fantasy & medieval music, CC-BY.
  - OpenGameArt.org — CC0 ambient loops and music.
  - Freesound.org — ambiences (wind, forest, tavern, cave), filter CC0.
  - Kenney.nl — CC0 UI/RPG sound packs.
  - Pixabay Audio — free license, no attribution.
  - Convert to ogg/mp3, modest bitrate; loop points for ambience.
- Fog of war: unexplored hexes covered by a parchment-toned overlay, lifted from
  `world.explored`; "reveal radius" around the party as it moves.
- Day/night on the overworld: tint/lighting shift, higher encounter risk at
  night, battles started at night use battle-map's existing night mode.
- Random non-combat events on travel (merchant, weather, crossroads dilemma
  using the morality system) — the anti-monotony table.

---

## Phase 6 — Endgame & Balance

- At world generation, pick (seeded) a far, dangerous landmark as the **boss
  lair**; boss from legendarybestiary.json.
- 3–4 **shard quests** spread across kingdoms gate the lair (each ends in a
  generated dungeon with a rare boss). Completing them unlocks the final quest.
- Victory screen + journey summary (days traveled, battles, quests).
- Balance pass: XP curve, encounter scaling, economy prices, loot rarity.
- Polish pass: title music, transitions, save slots (if wanted).

---

## Technical Notes & Risks

- **battle-map.js is an 8,800-line IIFE.** Expose the API early (Phase 2), don't
  refactor. Same for dungeon.js.
- **Determinism:** save stores `{seed, params}` — any change to map generation
  code can invalidate old saves. Bump `GameState.version` when that happens and
  regenerate gracefully (keep position if the hex is still passable, else nearest
  passable).
- **Rendering rules in CLAUDE.md apply everywhere** (canvas batching, no per-item
  SVG elements in loops).
- **localStorage limits:** the save is small by design (no map data). Character
  portraits are stored as paths, not data URIs.
- **File protocol:** game.html must be served over http (fetch of JSON data) —
  same constraint the existing pages already have. Use `python3 -m http.server`.
