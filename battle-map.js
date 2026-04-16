// ═══════════════════════════════════════════════════════════════════════════════
// Battle Map — Isometric side perspective, Midlands biome
// Hex grid imposed on a flat generated terrain surface.
// ═══════════════════════════════════════════════════════════════════════════════
(function () {
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const COLS = 11;   // short axis — left/right width of the battlefield
const ROWS = 15;   // long  axis — front-to-back depth (heroes ↔ enemies)
let   S    = 28;    // hex world-radius (flat-top); resized dynamically
const K    = 0.72;  // isometric vertical squeeze
let   BATTLE_SEED = Math.floor(Math.random() * 0x7fffffff);

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────────────────────────

const GC  = ['#5a9430','#64a234','#6eab3c','#58902c','#74ac3a','#4c8226'];
const GC2 = ['#78b84e','#82c852','#90d064','#74b040','#94cc54','#68a83c'];

const P = {
    rockDk  : '#4e4e40', rock    : '#74746a', rockMid : '#90908a', rockLit : '#aeaea4',
    shrubDk : '#2a5412', shrub   : '#387020', shrubLit: '#50922c',
    fYellow : '#e8c030', fOrange : '#e86820', fPink   : '#d84072', fWhite  : '#f0eedc',
    gridLine     : 'rgba(10,6,0,0.22)',
    shadowEllipse: 'rgba(0,0,0,0.22)',
    selectFill   : 'rgba(255,215,40,0.28)',
    selectLine   : '#ffd428',
    hoverFill    : 'rgba(255,255,255,0.14)',
    moveFill     : 'rgba(80,200,255,0.20)',
    moveLine     : 'rgba(100,220,255,0.65)',
};

// ─────────────────────────────────────────────────────────────────────────────
// UNIT DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

// Default enemy team — always present
const ENEMY_DEFS = [
    { id:'goblin',         name:'Goblin',         type:'goblin',        team:'enemies', col:5, row:1  },
    { id:'goblin_archer1', name:'Goblin Archer',  type:'goblin_archer', team:'enemies', col:2, row:2  },
    { id:'goblin_archer2', name:'Goblin Archer',  type:'goblin_archer', team:'enemies', col:8, row:2  },
];

// Default placeholder hero team
const DEFAULT_HERO_DEFS = [
    { id:'warrior', name:'Warrior', type:'warrior', spriteType:'warrior', team:'heroes', col:2, row:13 },
    { id:'wizard',  name:'Wizard',  type:'wizard',  spriteType:'wizard',  team:'heroes', col:5, row:14 },
    { id:'rogue',   name:'Rogue',   type:'rogue',   spriteType:'rogue',   team:'heroes', col:8, row:13 },
];

// Active unit definitions — rebuilt each time a team is loaded
let UNIT_DEFS = [...DEFAULT_HERO_DEFS, ...ENEMY_DEFS];

// ─────────────────────────────────────────────────────────────────────────────
// PARTY → BATTLE-UNIT CONVERSION
// ─────────────────────────────────────────────────────────────────────────────

// Maps class id → class group (matches character-creator.js class groups)
const CLASS_GROUP_MAP = {
    ironguard:'Warrior', battlebrave:'Warrior', reaver:'Warrior', vanguard:'Warrior', duelist:'Warrior', warmaster:'Warrior',
    wayfarer:'Ranger',   marksman:'Ranger',     beastwarden:'Ranger', skirmisher:'Ranger',
    shadowblade:'Rogue', assassin:'Rogue',      thief:'Rogue',    saboteur:'Rogue',
    warden:'Cleric',     soulkindler:'Cleric',  dawncaller:'Cleric',  aegisbearer:'Cleric',
    scholar:'Mage',      elementalist:'Mage',   arcanist:'Mage',  runescribe:'Mage',
    pyrecrafter:'Sorcerer', stormcaller:'Sorcerer', geomancer:'Sorcerer', aquorist:'Sorcerer',
    lifewhisperer:'Druid',  beastcaller:'Druid',    verdant_warden:'Druid',
    voidweaver:'Warlock',   bloodsinger:'Warlock',  dreadbinder:'Warlock', dominionist:'Warlock',
    malefactor:'Witch',     blightweaver:'Witch',   bloodwitch:'Witch',
    gravecaller:'Necromancer', soulreaper:'Necromancer', rotforged:'Necromancer',
};

// Hero starting positions by party size (1–6)
const HERO_POSITIONS = [
    null,                                                                                           // 0 — unused
    [{col:5,row:14}],                                                                               // 1
    [{col:3,row:13},{col:7,row:13}],                                                                // 2
    [{col:2,row:13},{col:5,row:14},{col:8,row:13}],                                                 // 3
    [{col:1,row:13},{col:4,row:14},{col:7,row:14},{col:9,row:13}],                                  // 4
    [{col:1,row:13},{col:3,row:13},{col:5,row:14},{col:7,row:13},{col:9,row:13}],                   // 5
    [{col:1,row:13},{col:3,row:14},{col:5,row:13},{col:6,row:14},{col:8,row:13},{col:10,row:14}],   // 6
];

// Physical skill name → melee/ranged attack definition
const SKILL_ATTACK_MAP = {
    'Swordsmanship': { name:'Sword Strike',    type:'melee',  range:1,  damageDice:[2,8],  damageMod:3,  hitBase:98, critMin:92, snd:'sword' },
    'Archery':       { name:'Arrow Shot',      type:'ranged', range:12, damageDice:[2,6],  damageMod:3,  hitBase:98, critMin:94, snd:'bow'   },
    'Axewielding':   { name:'Axe Strike',      type:'melee',  range:1,  damageDice:[2,8],  damageMod:4,  hitBase:98, critMin:90, snd:'sword' },
    'Blunt Force':   { name:'Mace Smash',      type:'melee',  range:1,  damageDice:[2,8],  damageMod:2,  hitBase:98, critMin:93, snd:'sword' },
    'Small Arms':    { name:'Knife Strike',    type:'melee',  range:1,  damageDice:[2,6],  damageMod:2,  hitBase:98, critMin:91, snd:'stab'  },
    'Polearms':      { name:'Spear Jab',       type:'melee',  range:2,  damageDice:[1,10], damageMod:3,  hitBase:98, critMin:93, snd:'sword' },
    'Shield Fighting':{ name:'Shield Bash',   type:'melee',  range:1,  damageDice:[1,8],  damageMod:2,  hitBase:98, critMin:94, snd:'sword' },
    'Crossbow':      { name:'Crossbow Bolt',   type:'ranged', range:10, damageDice:[2,8],  damageMod:2,  hitBase:98, critMin:93, snd:'bow'   },
    'Blowgun & Sling':{ name:'Sling Shot',    type:'ranged', range:8,  damageDice:[1,6],  damageMod:1,  hitBase:98, critMin:95, snd:'bow'   },
    'Stealth':       { name:'Shadow Jab',      type:'melee',  range:1,  damageDice:[2,8],  damageMod:3,  hitBase:98, critMin:88, snd:'stab'  },
    'Thievery':      { name:'Quick Stab',      type:'melee',  range:1,  damageDice:[2,6],  damageMod:2,  hitBase:98, critMin:90, snd:'stab'  },
};

// Materium skill → spell attack definition
const MATERIUM_ATTACK_MAP = {
    'Lightwielding':        { name:'Holy Bolt',    type:'spell', range:12, damageDice:[2,6],  damageMod:3,  hitBase:98, critMin:96, snd:'fire' },
    'Materium Channeling':  { name:'Arcane Bolt',  type:'spell', range:14, damageDice:[2,8],  damageMod:4,  hitBase:98, critMin:96, snd:'fire' },
    'Shadow Weaving':       { name:'Shadow Bolt',  type:'spell', range:13, damageDice:[2,8],  damageMod:3,  hitBase:98, critMin:95, snd:'fire' },
};

// Caster class group → default spell when no materium skills
const CASTER_DEFAULT_SPELL = {
    Cleric:      { name:'Holy Bolt',      type:'spell', range:12, damageDice:[2,6],  damageMod:3,  hitBase:98, critMin:96, snd:'fire' },
    Mage:        { name:'Arcane Bolt',    type:'spell', range:14, damageDice:[2,8],  damageMod:4,  hitBase:98, critMin:96, snd:'fire' },
    Sorcerer:    { name:'Flame Burst',    type:'spell', range:13, damageDice:[3,6],  damageMod:4,  hitBase:98, critMin:96, snd:'fire' },
    Druid:       { name:'Nature Bolt',    type:'spell', range:11, damageDice:[2,6],  damageMod:3,  hitBase:98, critMin:96, snd:'fire' },
    Warlock:     { name:'Void Bolt',      type:'spell', range:13, damageDice:[2,8],  damageMod:3,  hitBase:98, critMin:95, snd:'fire' },
    Witch:       { name:'Hex Bolt',       type:'spell', range:11, damageDice:[2,6],  damageMod:3,  hitBase:98, critMin:95, snd:'fire' },
    Necromancer: { name:'Grave Touch',    type:'spell', range:12, damageDice:[2,8],  damageMod:3,  hitBase:98, critMin:95, snd:'fire' },
};

// Martial class group → default attack when no weapon skills
const MARTIAL_DEFAULT_ATTACK = {
    Warrior: { name:'Sword Strike',   type:'melee',  range:1,  damageDice:[2,10], damageMod:5,  hitBase:98, critMin:90, snd:'sword' },
    Ranger:  { name:'Arrow Shot',     type:'ranged', range:14, damageDice:[2,8],  damageMod:3,  hitBase:98, critMin:95, snd:'bow'   },
    Rogue:   { name:'Steel Knives',   type:'melee',  range:1,  damageDice:[2,9],  damageMod:4,  hitBase:98, critMin:92, snd:'stab'  },
};

// Sprite type from class group
function spriteTypeFromGroup(group) {
    if (group === 'Warrior') return 'warrior';
    if (group === 'Ranger' || group === 'Rogue') return 'rogue';
    return 'wizard';
}

// Derive battle stats from character aptitudes + class
function charToBattleStats(char) {
    const phy = (char.aptitudes?.physiology) || 35;
    const dis = (char.aptitudes?.discipline) || 35;
    const group = CLASS_GROUP_MAP[char.cls] || 'Warrior';

    const maxHp = Math.max(20, Math.round(40 + phy * 0.6));

    let speed = 3;
    if (group === 'Rogue' || group === 'Ranger') speed = 4;
    if (dis >= 60) speed = Math.min(5, speed + 1);

    let dodge = 20;
    if (group === 'Rogue')                                                      dodge = 30;
    else if (group === 'Ranger')                                                dodge = 25;
    else if (['Mage','Sorcerer','Cleric','Druid','Warlock','Witch','Necromancer'].includes(group)) dodge = 15;
    dodge += Math.round((dis - 35) * 0.2);
    dodge = Math.max(5, Math.min(45, dodge));

    return { maxHp, speed, dodge };
}

// Build attack list for a character from their skills
function charToAttacks(char) {
    const skills = char.skills || [];
    const group  = CLASS_GROUP_MAP[char.cls] || 'Warrior';
    const attacks = [];

    // Physical skills → melee/ranged attacks
    const PHYSICAL_SKILLS = Object.keys(SKILL_ATTACK_MAP);
    for (const sk of skills) {
        if (SKILL_ATTACK_MAP[sk]) attacks.push({ ...SKILL_ATTACK_MAP[sk] });
    }

    // Materium skills → spell attacks
    for (const sk of skills) {
        if (MATERIUM_ATTACK_MAP[sk]) attacks.push({ ...MATERIUM_ATTACK_MAP[sk] });
    }

    // No physical skills found for a martial class → use group default
    const isCaster = CASTER_DEFAULT_SPELL[group] !== undefined;
    if (!isCaster && attacks.filter(a => a.type !== 'spell').length === 0) {
        const def = MARTIAL_DEFAULT_ATTACK[group];
        if (def) attacks.unshift({ ...def });
    }

    // No spells found for a caster class → use group default spell
    if (isCaster && attacks.filter(a => a.type === 'spell').length === 0) {
        attacks.push({ ...CASTER_DEFAULT_SPELL[group] });
    }

    // Absolute fallback
    if (attacks.length === 0) {
        attacks.push({ name:'Strike', type:'melee', range:1, damageDice:[1,6], damageMod:1, hitBase:98, critMin:93, snd:'sword' });
    }

    return attacks;
}

// Convert a character creator character + index to a UNIT_DEF object.
// Registers the unit's stats in UNIT_STATS and its attacks in ATTACKS.
function charToUnitDef(char, idx, positions) {
    const group      = CLASS_GROUP_MAP[char.cls] || 'Warrior';
    const spriteType = spriteTypeFromGroup(group);
    const stats      = charToBattleStats(char);
    const attacks    = charToAttacks(char);
    const pos        = positions[idx] || { col: 2 + idx * 3, row: 13 };

    // Register unique type key so existing UNIT_STATS lookups work unchanged
    const typeKey = `cchar_${char.id || idx}`;
    UNIT_STATS[typeKey] = stats;

    // Register attacks in global ATTACKS so the combat panel can key them
    const attackKeys = attacks.map((atk, ai) => {
        const key = `${typeKey}_atk${ai}`;
        ATTACKS[key] = atk;
        return key;
    });

    return {
        id:         typeKey,
        name:       char.name || 'Hero',
        type:       typeKey,
        spriteType: spriteType,
        team:       'heroes',
        col:        pos.col,
        row:        pos.row,
        portrait:   char.portrait || null,
        attackKeys: attackKeys,
        // Store derived stats directly so resetBattle works correctly
        maxHp:      stats.maxHp,
        speed:      stats.speed,
        dodge:      stats.dodge,
        // Full character data for tooltip and character sheet
        _charData:  char,
    };
}

// Convert a saved party to hero unit defs
function partyToHeroDefs(party) {
    const members  = (party.members || []).slice(0, 6);
    const count    = members.length;
    const positions = HERO_POSITIONS[Math.min(count, 6)] || HERO_POSITIONS[3];
    return members.map((char, i) => charToUnitDef(char, i, positions));
}

// Load saved parties from localStorage (written by character-creator.js)
function loadSavedParties() {
    try {
        const raw = localStorage.getItem('leonoria_parties') || localStorage.getItem('leonoria_teams') || '[]';
        return JSON.parse(raw);
    } catch (_) { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRNG & 2-D VALUE NOISE
// ─────────────────────────────────────────────────────────────────────────────

function makeRng(seed) {
    let s = (seed ^ 0xdeadbeef) >>> 0;
    return () => {
        s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
        s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
        return (s >>> 0) / 0x100000000;
    };
}
function h2(x, y, s) {
    let h = (s + x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}
function sm(t)        { return t * t * (3 - 2 * t); }
function lrp(a, b, t) { return a + (b - a) * t;    }
function noise2(x, y, s) {
    const x0 = x | 0, y0 = y | 0;
    const fx = sm(x - x0), fy = sm(y - y0);
    return lrp(
        lrp(h2(x0,y0,s),   h2(x0+1,y0,s),   fx),
        lrp(h2(x0,y0+1,s), h2(x0+1,y0+1,s), fx),
        fy
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TERRAIN
// ─────────────────────────────────────────────────────────────────────────────

const T_GRASS = 0, T_FOREST = 1, T_ROCKS = 2, T_SHRUBS = 3, T_FLOWERS = 4;
let TMAP = [];

// ─────────────────────────────────────────────────────────────────────────────
// IMPASSABLE OBSTACLES — up to 2 clusters of 1-3 hexes per battle
// ─────────────────────────────────────────────────────────────────────────────

// Obstacle types: boulder, log, rubble, bush, tree, fence, ruins
const OBS_TYPES = ['boulder','log','rubble','bush','tree','fence','ruins'];

// Holds this battle's obstacles: [{type, hexes:[{col,row},...], seed}]
let OBSTACLES = [];

// Set of blocked hex keys "col,row" for fast lookup
let BLOCKED = new Set();

function isBlocked(col, row) {
    return BLOCKED.has(`${col},${row}`);
}

function generateObstacles() {
    OBSTACLES = [];
    BLOCKED   = new Set();

    const rng = makeRng(BATTLE_SEED ^ 0xc0ffee);

    // Reserved hexes: hero/enemy start positions
    const reserved = new Set(UNIT_DEFS.map(d => `${d.col},${d.row}`));
    // Also reserve the rows nearest each team (rows 0-2 enemies, rows 13-14 heroes)
    for (let c = 0; c < COLS; c++) {
        for (const r of [0,1,2,13,14]) reserved.add(`${c},${r}`);
    }

    const numObstacles = rng() < 0.5 ? 2 : (rng() < 0.6 ? 2 : 1);  // 1 or 2 obstacles

    // Neighbour offsets for flat-top hex (odd-col offset)
    function neighbours(col, row) {
        const oddCol = col & 1;
        return [
            [col-1, row + (oddCol ? 0 : -1)],
            [col-1, row + (oddCol ? 1 :  0)],
            [col+1, row + (oddCol ? 0 : -1)],
            [col+1, row + (oddCol ? 1 :  0)],
            [col,   row - 1],
            [col,   row + 1],
        ].filter(([c,r]) => c >= 0 && c < COLS && r >= 0 && r < ROWS);
    }

    for (let oi = 0; oi < numObstacles; oi++) {
        const obsType  = OBS_TYPES[(rng() * OBS_TYPES.length) | 0];
        const maxSize  = obsType === 'log' ? 3 : (obsType === 'fence' ? 3 : (rng() < 0.4 ? 1 : (rng() < 0.6 ? 2 : 3)));
        const obsSeed  = (rng() * 0x7fffffff) | 0;

        // Pick a root hex in the middle band (rows 3–11)
        let root = null;
        for (let attempt = 0; attempt < 80; attempt++) {
            const c = 1 + (rng() * (COLS - 2)) | 0;
            const r = 3 + (rng() * 9) | 0;
            const key = `${c},${r}`;
            if (!reserved.has(key) && !BLOCKED.has(key)) { root = [c, r]; break; }
        }
        if (!root) continue;

        // Grow cluster up to maxSize by adding random neighbours
        const hexes = [root];
        BLOCKED.add(`${root[0]},${root[1]}`);
        for (let grow = 1; grow < maxSize; grow++) {
            // Collect candidate neighbours of all current hexes
            const candidates = [];
            for (const [hc, hr] of hexes) {
                for (const [nc, nr] of neighbours(hc, hr)) {
                    const key = `${nc},${nr}`;
                    if (!reserved.has(key) && !BLOCKED.has(key) &&
                        !hexes.some(([ec,er]) => ec===nc && er===nr)) {
                        candidates.push([nc, nr]);
                    }
                }
            }
            if (!candidates.length) break;
            const pick = candidates[(rng() * candidates.length) | 0];
            hexes.push(pick);
            BLOCKED.add(`${pick[0]},${pick[1]}`);
        }

        OBSTACLES.push({ type: obsType, hexes, seed: obsSeed });
    }
}

function generateTerrain() {
    TMAP = [];
    for (let c = 0; c < COLS; c++) {
        TMAP[c] = [];
        for (let r = 0; r < ROWS; r++) {
            const nx = c / (COLS * 0.30), ny = r / (ROWS * 0.24);
            const fn = noise2(nx,       ny,       BATTLE_SEED);
            const rn = noise2(nx * 1.8, ny * 1.8, BATTLE_SEED + 500);
            const dn = noise2(nx * 2.5, ny * 2.5, BATTLE_SEED + 222);

            let type = T_GRASS;
            if (r >= 3 && r <= ROWS - 4) {
                if      (fn > 0.60)               type = T_FOREST;
                else if (rn > 0.72 && fn < 0.52)  type = T_ROCKS;
                else if (fn > 0.48 && fn <= 0.60) type = T_SHRUBS;
                else if (dn > 0.68)               type = T_FLOWERS;
            } else {
                if (dn > 0.76) type = T_FLOWERS;
            }

            const tr = makeRng(BATTLE_SEED ^ (c * 7919 + r * 6271));
            const ci = Math.floor(tr() * GC.length);
            TMAP[c][r] = {
                type,
                gc   : GC [ci],
                gc2  : GC2[ci],
                fseed: (BATTLE_SEED ^ (c * 2053 + r * 1049)) >>> 0,
            };
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ISOMETRIC COORDINATE SYSTEM  (flat-top hex)
//
//   World XY lives on a 2-D plane.  Isometric projection:
//       sx = ISO_OX + (wx - wy) * K
//       sy = ISO_OY + (wx + wy) * K * 0.5
//   Heroes (high row) → FRONT (bottom of screen).
//   Enemies (low row) → BACK  (top of screen).
// ─────────────────────────────────────────────────────────────────────────────

let ISO_OX = 0, ISO_OY = 0;

function worldToHex(col, row) {
    return {
        wx: col * S * 1.5,
        wy: row * S * Math.sqrt(3) + (col & 1) * S * Math.sqrt(3) * 0.5,
    };
}

function isoProject(wx, wy) {
    return { sx: ISO_OX + (wx - wy) * K, sy: ISO_OY + (wx + wy) * K * 0.5 };
}

function hexScreenCenter(col, row) {
    const { wx, wy } = worldToHex(col, row);
    return isoProject(wx, wy);
}

function hexScreenVerts(col, row) {
    const { wx, wy } = worldToHex(col, row);
    const v = [];
    for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;   // flat-top: vertex 0 at 0° (rightward)
        v.push(isoProject(wx + S * Math.cos(a), wy + S * Math.sin(a)));
    }
    return v;
}

// Painter depth: larger = closer to viewer = rendered last
function hexDepth(col, row) {
    const { wx, wy } = worldToHex(col, row);
    return wx + wy;
}

// Compute S dynamically so the hex grid fills the canvas edge-to-edge
function recalcIsoOrigin(W, H) {
    // Grid extents: gridW ≈ K*38.3*S,  gridH ≈ K*19.15*S
    const sW = (W * 0.94) / (K * 38.3);
    const sH = (H * 0.94) / (K * 19.15);
    S = Math.max(20, Math.min(56, Math.floor(Math.min(sW, sH))));

    // Exact bounding box (origin-free pass)
    ISO_OX = 0; ISO_OY = 0;
    let minSX = Infinity, maxSX = -Infinity;
    let minSY = Infinity, maxSY = -Infinity;
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            const { wx, wy } = worldToHex(c, r);
            for (let i = 0; i < 6; i++) {
                const a  = i * Math.PI / 3;
                const vx = wx + S * Math.cos(a), vy = wy + S * Math.sin(a);
                const sx = (vx - vy) * K, sy = (vx + vy) * K * 0.5;
                if (sx < minSX) minSX = sx; if (sx > maxSX) maxSX = sx;
                if (sy < minSY) minSY = sy; if (sy > maxSY) maxSY = sy;
            }
        }
    }
    // Centre horizontally; centre vertically
    ISO_OX = (W - (maxSX - minSX)) / 2 - minSX;
    ISO_OY = (H - (maxSY - minSY)) / 2 - minSY;
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAWING HELPER
// ─────────────────────────────────────────────────────────────────────────────

function screenPolyPath(ctx, verts) {
    ctx.beginPath();
    ctx.moveTo(verts[0].sx, verts[0].sy);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].sx, verts[i].sy);
    ctx.closePath();
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL-CANVAS TERRAIN TEXTURE
// Renders a noise-based midlands surface covering the entire canvas,
// exactly as the world map fills its viewport.  No sky, no floating board.
// ─────────────────────────────────────────────────────────────────────────────

function drawFullTerrain(ctx, W, H) {
    // Render at 1/5 resolution then upscale — noise smoothed by bilinear filter
    const SCALE = 5;
    const pw = Math.ceil(W / SCALE);
    const ph = Math.ceil(H / SCALE);

    const off  = document.createElement('canvas');
    off.width  = pw;
    off.height = ph;
    const oc   = off.getContext('2d');
    const img  = oc.createImageData(pw, ph);
    const d    = img.data;

    // Midlands landLow/Mid/High palette (matches world map biome values)
    // [68,132,42] → [90,158,54] → [108,170,62] → dry [132,158,72]
    for (let py = 0; py < ph; py++) {
        for (let px = 0; px < pw; px++) {
            const nx = px / pw * 9.5;
            const ny = py / ph * 6.5;

            const n1 = noise2(nx,       ny,       BATTLE_SEED);
            const n2 = noise2(nx * 2.3, ny * 2.3, BATTLE_SEED + 501);
            const n3 = noise2(nx * 5.2, ny * 5.2, BATTLE_SEED + 1003);
            const v  = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;

            let r, g, b;
            if (v < 0.30) {
                const t = v / 0.30;
                r = Math.round(68  + t * (90  - 68 ));
                g = Math.round(132 + t * (158 - 132));
                b = Math.round(42  + t * (54  - 42 ));
            } else if (v < 0.58) {
                const t = (v - 0.30) / 0.28;
                r = Math.round(90  + t * (108 - 90 ));
                g = Math.round(158 + t * (170 - 158));
                b = Math.round(54  + t * (62  - 54 ));
            } else if (v < 0.78) {
                const t = (v - 0.58) / 0.20;
                r = Math.round(108 + t * (120 - 108));
                g = Math.round(170 + t * (168 - 170));
                b = Math.round(62  + t * (66  - 62 ));
            } else {
                // Dry / dirt patches
                const t = Math.min(1, (v - 0.78) / 0.22);
                r = Math.round(120 + t * (136 - 120));
                g = Math.round(168 + t * (148 - 168));
                b = Math.round(66  + t * (76  - 66 ));
            }

            const idx = (py * pw + px) * 4;
            d[idx] = r; d[idx+1] = g; d[idx+2] = b; d[idx+3] = 255;
        }
    }

    oc.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, W, H);
}

// ─────────────────────────────────────────────────────────────────────────────
// HEX OVERLAY — biome tint + grid line
// The terrain is already painted full-canvas.  These functions add only a
// very faint terrain-type hint and then the grid line.  No fill, no walls.
// ─────────────────────────────────────────────────────────────────────────────

function drawHexBiomeTint(ctx, c, r) {
    const T = TMAP[c][r];
    let tint = null;
    // No biome tints — terrain type is shown by drawn features only
    if (!tint) return;

    const verts = hexScreenVerts(c, r);
    screenPolyPath(ctx, verts);
    ctx.fillStyle = tint;
    ctx.fill();
}

function drawHexGridLine(ctx, c, r) {
    const verts = hexScreenVerts(c, r);
    screenPolyPath(ctx, verts);
    ctx.strokeStyle = P.gridLine;
    ctx.lineWidth   = 0.8;
    ctx.stroke();
}

// ─────────────────────────────────────────────────────────────────────────────
// TERRAIN FEATURES  (no trees; rocks · shrubs · flowers · grass tufts)
// ─────────────────────────────────────────────────────────────────────────────

function drawRock(ctx, cx, cy, rng) {
    const F = 0.62;
    const gx = cx + (rng() * 8 - 4) * F, gy = cy;

    ctx.beginPath();
    ctx.ellipse(gx+4*F, gy+2*F, 13*F, 5*F, 0, 0, Math.PI*2);
    ctx.fillStyle = P.shadowEllipse; ctx.fill();

    ctx.beginPath();
    ctx.moveTo(gx-11*F,gy); ctx.lineTo(gx-5*F,gy-13*F);
    ctx.lineTo(gx+2*F,gy-18*F); ctx.lineTo(gx+13*F,gy-10*F);
    ctx.lineTo(gx+15*F,gy); ctx.lineTo(gx+4*F,gy+4*F); ctx.closePath();
    ctx.fillStyle = P.rockDk; ctx.fill();

    ctx.beginPath();
    ctx.moveTo(gx-9*F,gy); ctx.lineTo(gx-4*F,gy-12*F);
    ctx.lineTo(gx+2*F,gy-17*F); ctx.lineTo(gx+11*F,gy-9*F);
    ctx.lineTo(gx+12*F,gy); ctx.lineTo(gx+3*F,gy+3*F); ctx.closePath();
    ctx.fillStyle = P.rock; ctx.fill();

    ctx.beginPath();
    ctx.moveTo(gx+2*F,gy-17*F); ctx.lineTo(gx+11*F,gy-9*F);
    ctx.lineTo(gx+12*F,gy); ctx.lineTo(gx+3*F,gy+2*F);
    ctx.lineTo(gx+2*F,gy-2*F); ctx.closePath();
    ctx.fillStyle = P.rockMid; ctx.fill();

    ctx.beginPath();
    ctx.moveTo(gx-3*F,gy-13*F); ctx.lineTo(gx+5*F,gy-16*F);
    ctx.lineTo(gx+2*F,gy-18*F); ctx.lineTo(gx-4*F,gy-15*F); ctx.closePath();
    ctx.fillStyle = P.rockLit; ctx.fill();
}

function drawShrub(ctx, cx, cy, rng) {
    const F = 0.62;
    const gx = cx + (rng()*6-3)*F, gy = cy;

    ctx.beginPath();
    ctx.ellipse(gx+3*F, gy+3*F, 17*F, 6*F, 0, 0, Math.PI*2);
    ctx.fillStyle = P.shadowEllipse; ctx.fill();

    const blobs = [
        {ox:-8*F,oy:-4*F,rx:9*F,ry:7*F},
        {ox: 6*F,oy:-3*F,rx:8*F,ry:6*F},
        {ox:-1*F,oy:-9*F,rx:10*F,ry:8*F},
        {ox: 2*F,oy:-14*F,rx:7*F,ry:6*F},
    ];
    for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        ctx.beginPath();
        ctx.ellipse(gx+b.ox, gy+b.oy, b.rx, b.ry, 0, 0, Math.PI*2);
        ctx.fillStyle = i===0 ? P.shrubDk : (i%2===0 ? P.shrubLit : P.shrub);
        ctx.fill();
    }
}

function drawFlowers(ctx, cx, cy, rng) {
    const cols = [P.fYellow, P.fOrange, P.fPink, P.fWhite, P.fYellow];
    const F = 0.62, count = 3 + (rng() * 4) | 0;
    for (let i = 0; i < count; i++) {
        const fx = cx + (rng()-0.5) * S * K * 0.95;
        const fy = cy + (rng()-0.5) * S * K * 0.42;
        const fc = cols[(rng() * cols.length) | 0];
        for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.ellipse(fx+Math.cos(a)*3*F, fy+Math.sin(a)*2*F, 2*F, 1.4*F, a, 0, Math.PI*2);
            ctx.fillStyle = fc; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(fx, fy, 1.4*F, 0, Math.PI*2);
        ctx.fillStyle = '#ffe060'; ctx.fill();
    }
}

function drawGrassTufts(ctx, cx, cy, rng) {
    const F = 0.62, count = 4 + (rng() * 4) | 0;
    for (let i = 0; i < count; i++) {
        const gx = cx + (rng()-0.5) * S * K * 1.1;
        const gy = cy + (rng()-0.5) * S * K * 0.44;
        const h  = (3 + rng() * 4) * F;
        ctx.strokeStyle = rng() > 0.5 ? 'rgba(40,80,10,0.52)' : 'rgba(100,160,30,0.42)';
        ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx-1+rng()*2, gy-h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(gx+2*F, gy); ctx.lineTo(gx+2*F+rng()*2, gy-h+1); ctx.stroke();
    }
}

// ─── Extra small-feature drawers ──────────────────────────────────────────────

function drawPebbles(ctx, cx, cy, rng) {
    const count = 3 + (rng() * 5) | 0;
    for (let i = 0; i < count; i++) {
        const px = cx + (rng()-0.5)*S*K*1.0, py = cy + (rng()-0.5)*S*K*0.4;
        const r1 = 1.2 + rng()*2.2, r2 = r1*(0.55+rng()*0.35);
        const ang = rng()*Math.PI;
        const lit = rng() > 0.5;
        ctx.fillStyle = lit ? P.rockMid : P.rock;
        ctx.beginPath(); ctx.ellipse(px,py,r1,r2,ang,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.ellipse(px-r1*0.2,py-r2*0.25,r1*0.32,r2*0.25,ang,0,Math.PI*2); ctx.fill();
    }
}

function drawMushrooms(ctx, cx, cy, rng) {
    const count = 2 + (rng() * 3) | 0;
    const capCols = ['#b83820','#c84428','#d86030','#6e3890','#884020'];
    for (let i = 0; i < count; i++) {
        const mx = cx + (rng()-0.5)*S*K*0.9, my = cy + (rng()-0.5)*S*K*0.35;
        const sz = 2.2 + rng()*2.8;
        // Stem
        ctx.fillStyle = 'rgba(240,230,200,0.82)';
        ctx.beginPath(); ctx.ellipse(mx,my,sz*0.32,sz*0.55,0,0,Math.PI*2); ctx.fill();
        // Cap
        ctx.fillStyle = capCols[(rng()*capCols.length)|0];
        ctx.beginPath();
        ctx.ellipse(mx, my-sz*0.5, sz*0.75, sz*0.45, 0, Math.PI, Math.PI*2); ctx.fill();
        // Spots
        if (rng()>0.45) {
            ctx.fillStyle = 'rgba(255,255,255,0.60)';
            for (let d=0;d<2+((rng()*2)|0);d++) {
                const dx=(rng()-0.5)*sz*0.7, dy=(rng()-0.3)*sz*0.4;
                ctx.beginPath(); ctx.arc(mx+dx,my-sz*0.52+dy,sz*0.1+rng()*sz*0.10,0,Math.PI*2); ctx.fill();
            }
        }
    }
}

function drawMudPatch(ctx, cx, cy, rng) {
    const F = 0.62;
    const ox = (rng()-0.5)*S*K*0.5, oy = (rng()-0.5)*S*K*0.2;
    const rx = (8+rng()*10)*F, ry = (4+rng()*5)*F;
    ctx.fillStyle = `rgba(80,52,24,${(0.22+rng()*0.18).toFixed(2)})`;
    ctx.beginPath(); ctx.ellipse(cx+ox,cy+oy,rx,ry,rng()*Math.PI,0,Math.PI*2); ctx.fill();
    // Reflection sheen
    ctx.fillStyle = 'rgba(120,100,60,0.12)';
    ctx.beginPath(); ctx.ellipse(cx+ox-rx*0.18,cy+oy-ry*0.22,rx*0.38,ry*0.30,0,0,Math.PI*2); ctx.fill();
}

function drawReedTufts(ctx, cx, cy, rng) {
    const count = 3 + (rng()*4)|0;
    for (let i = 0; i < count; i++) {
        const bx = cx+(rng()-0.5)*S*K*0.9, by = cy+(rng()-0.5)*S*K*0.36;
        const h = (8+rng()*10), leanX = (rng()-0.5)*5;
        ctx.strokeStyle = `rgba(${100+(rng()*40)|0},${130+(rng()*30)|0},${30+(rng()*20)|0},0.58)`;
        ctx.lineWidth = 0.9+rng()*0.6;
        ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx+leanX,by-h); ctx.stroke();
        // Seed head
        ctx.fillStyle = `rgba(${120+(rng()*40)|0},90,30,0.65)`;
        ctx.beginPath(); ctx.ellipse(bx+leanX,by-h,1.2,3.5,leanX*0.1,0,Math.PI*2); ctx.fill();
    }
}

// ─── Obstacle renderers ───────────────────────────────────────────────────────

function drawObstacleBoulder(ctx, cx, cy, scale, rng) {
    const F = scale * 0.9;
    // Large multi-rock cluster
    const rocks = [
        {ox:-10*F,oy:-4*F,sx:22*F,sy:17*F},{ox:8*F,oy:-8*F,sx:18*F,sy:15*F},
        {ox:-4*F,oy:-14*F,sx:14*F,sy:12*F},{ox:12*F,oy:2*F,sx:12*F,sy:9*F},
    ];
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(cx+6*F,cy+3*F,28*F,10*F,0,0,Math.PI*2); ctx.fill();
    for (const rk of rocks) {
        ctx.fillStyle = P.rockDk;
        ctx.beginPath(); ctx.ellipse(cx+rk.ox+2*F,cy+rk.oy+2*F,rk.sx*0.5,rk.sy*0.38,0.3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = P.rock;
        ctx.beginPath(); ctx.ellipse(cx+rk.ox,cy+rk.oy,rk.sx*0.5,rk.sy*0.38,0.3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = P.rockMid;
        ctx.beginPath(); ctx.ellipse(cx+rk.ox+rk.sx*0.12,cy+rk.oy-rk.sy*0.08,rk.sx*0.24,rk.sy*0.18,0.2,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = P.rockLit;
        ctx.beginPath(); ctx.ellipse(cx+rk.ox-rk.sx*0.08,cy+rk.oy-rk.sy*0.22,rk.sx*0.12,rk.sy*0.10,0,0,Math.PI*2); ctx.fill();
    }
    // Mossy patches
    ctx.fillStyle = 'rgba(40,80,20,0.28)';
    for (let m=0;m<3;m++) {
        ctx.beginPath(); ctx.ellipse(cx+(rng()-0.5)*16*F,cy-6*F+(rng()-0.5)*8*F,3*F+rng()*4*F,2*F+rng()*2*F,rng()*Math.PI,0,Math.PI*2); ctx.fill();
    }
}

function drawObstacleLog(ctx, cx, cy, angle, scale, rng) {
    const L = 38*scale, R = 5.5*scale;
    const ax = Math.cos(angle)*L*0.5, ay = Math.sin(angle)*L*0.5;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.save(); ctx.translate(cx+3*scale,cy+3*scale); ctx.rotate(angle);
    ctx.beginPath(); ctx.ellipse(0,0,L*0.52,R*0.45,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // Bark body
    const bg = ctx.createLinearGradient(cx-ax,cy-ay,cx+ax,cy+ay);
    bg.addColorStop(0,'#3a2210'); bg.addColorStop(0.5,'#5c3c1e'); bg.addColorStop(1,'#2c1a0c');
    ctx.strokeStyle = bg; ctx.lineWidth = R*2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx-ax,cy-ay); ctx.lineTo(cx+ax,cy+ay); ctx.stroke();
    // Bark lines
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 0.8;
    for (let i=0;i<5;i++) {
        const t=(i/4-0.5)*0.8, bx2=cx+Math.cos(angle)*L*t, by2=cy+Math.sin(angle)*L*t;
        ctx.beginPath();
        ctx.moveTo(bx2-Math.sin(angle)*R*0.7,by2+Math.cos(angle)*R*0.7);
        ctx.lineTo(bx2+Math.sin(angle)*R*0.7,by2-Math.cos(angle)*R*0.7);
        ctx.stroke();
    }
    // End rings
    for (const side of [-1,1]) {
        const ex=cx+Math.cos(angle)*L*0.5*side, ey=cy+Math.sin(angle)*L*0.5*side;
        ctx.fillStyle='#4a2e12';
        ctx.beginPath(); ctx.ellipse(ex,ey,R*0.88,R*0.60,angle+Math.PI*0.5,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(200,160,80,0.35)'; ctx.lineWidth=0.7;
        ctx.beginPath(); ctx.ellipse(ex,ey,R*0.55,R*0.38,angle+Math.PI*0.5,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(ex,ey,R*0.28,R*0.19,angle+Math.PI*0.5,0,Math.PI*2); ctx.stroke();
    }
    // Fungal brackets (random)
    if (rng()>0.45) {
        ctx.fillStyle='rgba(180,140,60,0.60)';
        for (let f=0;f<2+((rng()*2)|0);f++) {
            const ft=(rng()-0.5)*0.7, fx=cx+Math.cos(angle)*L*ft, fy=cy+Math.sin(angle)*L*ft;
            ctx.beginPath(); ctx.ellipse(fx,fy-R*0.5,R*0.65,R*0.30,angle,0,Math.PI*2); ctx.fill();
        }
    }
}

function drawObstacleRubble(ctx, cx, cy, scale, rng) {
    const count = 6 + (rng()*5)|0;
    ctx.fillStyle='rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(cx+4*scale,cy+2*scale,28*scale,11*scale,0,0,Math.PI*2); ctx.fill();
    for (let i=0;i<count;i++) {
        const rx=cx+(rng()-0.5)*30*scale, ry=cy+(rng()-0.5)*12*scale;
        const pts=3+((rng()*3)|0), rad=(3+rng()*7)*scale;
        const col=[P.rockDk,P.rock,P.rockMid,'#8a7860','#6a6050'][(rng()*5)|0];
        ctx.fillStyle=col;
        ctx.beginPath();
        for (let p=0;p<pts;p++) {
            const a=(p/pts)*Math.PI*2+rng()*0.8, r=rad*(0.6+rng()*0.5);
            p===0 ? ctx.moveTo(rx+Math.cos(a)*r,ry+Math.sin(a)*r*0.55)
                  : ctx.lineTo(rx+Math.cos(a)*r,ry+Math.sin(a)*r*0.55);
        }
        ctx.closePath(); ctx.fill();
    }
    // Dust / mortar bits
    ctx.fillStyle='rgba(160,140,110,0.22)';
    for (let d=0;d<5;d++) {
        ctx.beginPath();
        ctx.ellipse(cx+(rng()-0.5)*22*scale,cy+(rng()-0.5)*9*scale,(2+rng()*5)*scale,(1+rng()*2)*scale,rng()*Math.PI,0,Math.PI*2);
        ctx.fill();
    }
}

function drawObstacleBush(ctx, cx, cy, scale, rng) {
    // Dense thorny bush — multi-blob with spines
    const blobs=[
        {ox:-10*scale,oy:-2*scale,rx:12*scale,ry:9*scale},
        {ox:8*scale,oy:-4*scale,rx:10*scale,ry:8*scale},
        {ox:-2*scale,oy:-12*scale,rx:11*scale,ry:9*scale},
        {ox:6*scale,oy:-10*scale,rx:8*scale,ry:7*scale},
    ];
    ctx.fillStyle='rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(cx+4*scale,cy+3*scale,20*scale,8*scale,0,0,Math.PI*2); ctx.fill();
    for (const b of blobs) {
        ctx.fillStyle=P.shrubDk;
        ctx.beginPath(); ctx.ellipse(cx+b.ox+2*scale,cy+b.oy+2*scale,b.rx,b.ry,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=P.shrub;
        ctx.beginPath(); ctx.ellipse(cx+b.ox,cy+b.oy,b.rx,b.ry,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=P.shrubLit;
        ctx.beginPath(); ctx.ellipse(cx+b.ox-b.rx*0.2,cy+b.oy-b.ry*0.25,b.rx*0.42,b.ry*0.38,0,0,Math.PI*2); ctx.fill();
    }
    // Thorns
    ctx.strokeStyle='rgba(20,40,8,0.55)'; ctx.lineWidth=0.8;
    for (let t=0;t<8;t++) {
        const tx=cx+(rng()-0.5)*20*scale, ty=cy-2*scale+(rng()-0.5)*14*scale;
        const ta=rng()*Math.PI*2, tl=(3+rng()*5)*scale;
        ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(tx+Math.cos(ta)*tl,ty+Math.sin(ta)*tl); ctx.stroke();
    }
    // Berries
    if (rng()>0.4) {
        ctx.fillStyle='#c03030';
        for (let b=0;b<4+((rng()*4)|0);b++) {
            ctx.beginPath(); ctx.arc(cx+(rng()-0.5)*16*scale,cy-2*scale+(rng()-0.5)*12*scale,1.2*scale,0,Math.PI*2); ctx.fill();
        }
    }
}

function drawObstacleTree(ctx, cx, cy, scale, rng) {
    // A single solid in-grid tree (larger than background trees)
    const treeSeed = (rng()*0x7fffffff)|0;
    const tr = makeRng(treeSeed);
    if (rng()>0.7) drawConiferTree(ctx,cx,cy,scale*1.2,tr);
    else           drawDeciduousTree(ctx,cx,cy,scale*1.1,tr);
}

function drawObstacleFence(ctx, cx, cy, angle, scale, rng) {
    const L = 40*scale;
    const ax = Math.cos(angle), ay = Math.sin(angle);
    const px0 = cx-ax*L*0.5, py0 = cy-ay*L*0.5;

    // Shadow
    ctx.fillStyle='rgba(0,0,0,0.14)';
    ctx.save(); ctx.translate(cx+3*scale,cy+4*scale); ctx.rotate(angle);
    ctx.beginPath(); ctx.rect(-L*0.5,-4*scale,L,6*scale); ctx.fill();
    ctx.restore();

    const posts = 4 + ((rng()*2)|0);
    const postH = (12+rng()*6)*scale;
    const postW = (2.2+rng()*1.2)*scale;
    const woodCol=['#5a3c18','#4e3010','#6a4820'];

    // Rails (2 horizontal beams)
    for (const railT of [0.28, 0.72]) {
        const ry = -postH*railT;
        ctx.strokeStyle=woodCol[(rng()*woodCol.length)|0]; ctx.lineWidth=1.6*scale;
        ctx.beginPath();
        ctx.moveTo(px0-Math.sin(angle)*ry, py0+Math.cos(angle)*ry);
        ctx.lineTo(px0+ax*L-Math.sin(angle)*ry, py0+ay*L+Math.cos(angle)*ry);
        ctx.stroke();
    }
    // Posts
    for (let p=0;p<posts;p++) {
        const t=p/(posts-1);
        const bx=px0+ax*L*t, by=py0+ay*L*t;
        ctx.fillStyle=woodCol[(rng()*woodCol.length)|0];
        ctx.fillRect(bx-postW*0.5, by-postH, postW, postH);
        // Broken posts: some lean or are snapped
        if (rng()>0.6) {
            ctx.fillStyle='rgba(0,0,0,0.18)';
            ctx.save(); ctx.translate(bx,by-postH*0.7); ctx.rotate((rng()-0.5)*0.5);
            ctx.fillRect(-postW*0.5,0,postW,postH*0.4);
            ctx.restore();
        }
        // Post cap highlight
        ctx.fillStyle='rgba(200,160,90,0.32)';
        ctx.fillRect(bx-postW*0.5,by-postH,postW,1.5*scale);
    }
    // Splintered bits on the ground
    ctx.strokeStyle='rgba(80,50,20,0.45)'; ctx.lineWidth=0.9*scale;
    for (let sp=0;sp<3;sp++) {
        const sx=cx+(rng()-0.5)*L*0.9, sy=cy+(rng()-0.5)*6*scale;
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx+(rng()-0.5)*8*scale,sy+(rng()-0.5)*4*scale); ctx.stroke();
    }
}

function drawObstacleRuins(ctx, cx, cy, scale, rng) {
    // Partial stone wall fragment / broken columns
    const stoneCol=['#888070','#7a7268','#6e6860','#9a9080'];
    // Base shadow
    ctx.fillStyle='rgba(0,0,0,0.20)';
    ctx.beginPath(); ctx.ellipse(cx+5*scale,cy+4*scale,28*scale,11*scale,0,0,Math.PI*2); ctx.fill();

    // 2-3 wall sections
    const sections=2+((rng()*2)|0);
    for (let s=0;s<sections;s++) {
        const wx=cx+(rng()-0.5)*22*scale, wy=cy+(rng()-0.5)*8*scale;
        const ww=(8+rng()*12)*scale, wh=(10+rng()*14)*scale;
        const ang=(rng()-0.5)*0.5;
        ctx.save(); ctx.translate(wx,wy); ctx.rotate(ang);
        // Stone courses
        const courses=2+((rng()*2)|0);
        for (let c=0;c<courses;c++) {
            const ch=wh/courses;
            const col=stoneCol[(rng()*stoneCol.length)|0];
            ctx.fillStyle=col;
            ctx.fillRect(-ww*0.5,-(c+1)*ch,ww,ch-0.8*scale);
            // Mortar lines
            ctx.strokeStyle='rgba(100,90,70,0.45)'; ctx.lineWidth=0.7*scale;
            ctx.strokeRect(-ww*0.5,-(c+1)*ch,ww,ch-0.8*scale);
        }
        // Ragged broken top
        ctx.fillStyle=stoneCol[(rng()*stoneCol.length)|0];
        for (let r=0;r<3+((rng()*3)|0);r++) {
            const rx=(rng()-0.5)*ww, ry=-wh-rng()*5*scale;
            ctx.beginPath();
            ctx.moveTo(rx,ry); ctx.lineTo(rx+(rng()-0.5)*4*scale,ry-(2+rng()*4)*scale);
            ctx.lineTo(rx+(3+rng()*5)*scale,ry);
            ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    }
    // Rubble on ground
    ctx.fillStyle=stoneCol[0];
    for (let rb=0;rb<5;rb++) {
        const rx=cx+(rng()-0.5)*28*scale, ry=cy+(rng()-0.5)*10*scale;
        ctx.beginPath(); ctx.ellipse(rx,ry,(2+rng()*4)*scale,(1+rng()*2)*scale,rng()*Math.PI,0,Math.PI*2); ctx.fill();
    }
    // Moss / weeds in cracks
    ctx.fillStyle='rgba(50,90,20,0.35)';
    for (let mo=0;mo<4;mo++) {
        ctx.beginPath(); ctx.ellipse(cx+(rng()-0.5)*20*scale,cy-5*scale+(rng()-0.5)*10*scale,(2+rng()*4)*scale,(1+rng()*2)*scale,rng()*Math.PI,0,Math.PI*2); ctx.fill();
    }
}

// Master obstacle renderer — picks type and draws on hex center
function drawObstacleOnHex(ctx, obs, hexIndex) {
    const [col, row] = obs.hexes[hexIndex];
    const { sx: cx, sy: cy } = hexScreenCenter(col, row);
    const rng = makeRng(obs.seed ^ (hexIndex * 0x9e3779b9));
    const scale = S / 28;

    switch (obs.type) {
        case 'boulder': drawObstacleBoulder(ctx, cx, cy, scale, rng); break;
        case 'rubble':  drawObstacleRubble (ctx, cx, cy, scale, rng); break;
        case 'bush':    drawObstacleBush   (ctx, cx, cy, scale, rng); break;
        case 'tree':    drawObstacleTree   (ctx, cx, cy, scale, rng); break;
        case 'log':     drawObstacleLog    (ctx, cx, cy, 0.4 + rng()*0.8, scale, rng); break;
        case 'fence':   drawObstacleFence  (ctx, cx, cy, 0.2 + rng()*0.6, scale, rng); break;
        case 'ruins':   drawObstacleRuins  (ctx, cx, cy, scale, rng); break;
    }
}

// Layered ground shadow — penumbra → mid → dark core, offset for directional light
function drawTreeShadow(ctx, cx, cy, w, h, scale) {
    const ox = 5 * scale;   // light from upper-left → shadow shifts right
    // Outer penumbra (wide, very faint)
    ctx.fillStyle = 'rgba(10,25,5,0.14)';
    ctx.beginPath();
    ctx.ellipse(cx + ox * 1.4, cy + 2, w * 1.55, h * 1.55, 0, 0, Math.PI * 2);
    ctx.fill();
    // Mid shadow
    ctx.fillStyle = 'rgba(5,15,2,0.28)';
    ctx.beginPath();
    ctx.ellipse(cx + ox, cy + 1, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    // Dark core directly under trunk
    ctx.fillStyle = 'rgba(0,8,0,0.48)';
    ctx.beginPath();
    ctx.ellipse(cx + ox * 0.5, cy, w * 0.50, h * 0.50, 0, 0, Math.PI * 2);
    ctx.fill();
}

// Shared palette — varied forest greens used by both tree types
const GREENS_DARK  = ['#112608','#1a3008','#1e380a','#162208','#203410'];
const GREENS_MID   = ['#2a4e10','#305614','#386018','#2e5212','#3a5a16'];
const GREENS_FULL  = ['#42701e','#4a7820','#527826','#3e6818','#4e7422'];
const GREENS_LIGHT = ['#6a9028','#729830','#7aa034','#80aa38','#689028'];
const GREENS_BRIGHT= ['#8ab83c','#96c040','#a0c844','#88b038','#9ec242'];

function pickGreen(palette, rng) { return palette[(rng() * palette.length) | 0]; }

// Smooth organic blob — jittered points connected by quadratic bezier curves
// (midpoint-smoothing: no straight edges, naturally lumpy silhouette)
function irregularBlob(ctx, cx, cy, rx, ry, pts, rng) {
    const px = [], py = [];
    for (let i = 0; i < pts; i++) {
        const a = (i / pts) * Math.PI * 2;
        const r = 0.55 + rng() * 0.90;
        px[i] = cx + Math.cos(a) * rx * r;
        py[i] = cy + Math.sin(a) * ry * r;
    }
    ctx.beginPath();
    // Start at the midpoint between last and first point
    ctx.moveTo((px[pts-1] + px[0]) * 0.5, (py[pts-1] + py[0]) * 0.5);
    for (let i = 0; i < pts; i++) {
        const nx = (i + 1) % pts;
        // Control point is the jittered vertex; destination is the next midpoint
        ctx.quadraticCurveTo(px[i], py[i], (px[i] + px[nx]) * 0.5, (py[i] + py[nx]) * 0.5);
    }
    ctx.closePath();
    ctx.fill();
}

// ─── Conifer (pine/fir) — tiered with drooping branches ──────────────────────
function drawConiferTree(ctx, cx, cy, scale, rng) {
    const totalH = 56 * scale;
    const trunkH = totalH * 0.25;
    const trunkW = Math.max(1.5, 3.2 * scale);

    // Ground shadow
    drawTreeShadow(ctx, cx, cy, totalH * 0.30, totalH * 0.08, scale);

    // Trunk — gradient, slightly curved sides
    ctx.fillStyle = '#2e2010';
    ctx.beginPath();
    ctx.moveTo(cx - trunkW * 0.75, cy);
    ctx.quadraticCurveTo(cx - trunkW * 0.4, cy - trunkH * 0.5, cx - trunkW * 0.4, cy - trunkH);
    ctx.lineTo(cx + trunkW * 0.4, cy - trunkH);
    ctx.quadraticCurveTo(cx + trunkW * 0.4, cy - trunkH * 0.5, cx + trunkW * 0.75, cy);
    ctx.closePath();
    ctx.fill();
    // Trunk highlight
    ctx.fillStyle = '#483418';
    ctx.beginPath();
    ctx.moveTo(cx - trunkW * 0.1, cy);
    ctx.quadraticCurveTo(cx, cy - trunkH * 0.5, cx - trunkW * 0.05, cy - trunkH);
    ctx.lineTo(cx + trunkW * 0.2, cy - trunkH);
    ctx.quadraticCurveTo(cx + trunkW * 0.15, cy - trunkH * 0.5, cx + trunkW * 0.2, cy);
    ctx.closePath();
    ctx.fill();

    const numTiers = 3 + (rng() * 3 | 0);   // 3–5 tiers

    for (let t = 0; t < numTiers; t++) {
        const p       = t / (numTiers - 1);
        const tierBot = cy - trunkH - t * (totalH - trunkH) * 0.62 / numTiers;
        const tierW   = totalH * 0.52 * (1 - p * 0.52) * (0.85 + rng() * 0.30);
        const tierH   = totalH * 0.54 / numTiers * (0.95 + rng() * 0.30);
        const apex    = cx + (rng() - 0.5) * 2.5 * scale;

        // Dark left/shadow half — curved sides for organic silhouette
        const bulgeL = (rng() - 0.5) * tierW * 0.18;
        const bulgeR = (rng() - 0.5) * tierW * 0.18;
        ctx.fillStyle = pickGreen(GREENS_DARK, rng);
        ctx.beginPath();
        ctx.moveTo(cx - tierW * 0.50, tierBot);
        ctx.quadraticCurveTo(cx - tierW * 0.25 + bulgeL, tierBot - tierH * 0.55, apex, tierBot - tierH);
        ctx.lineTo(cx, tierBot);
        ctx.closePath();
        ctx.fill();

        // Mid right half — curved sides
        ctx.fillStyle = pickGreen(GREENS_MID, rng);
        ctx.beginPath();
        ctx.moveTo(cx, tierBot);
        ctx.quadraticCurveTo(cx + tierW * 0.25 + bulgeR, tierBot - tierH * 0.55, apex, tierBot - tierH);
        ctx.lineTo(cx + tierW * 0.50, tierBot);
        ctx.closePath();
        ctx.fill();

        // Sunlit highlight wedge
        ctx.fillStyle = pickGreen(GREENS_FULL, rng);
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(apex, tierBot - tierH);
        ctx.lineTo(cx + tierW * 0.32, tierBot - tierH * 0.18);
        ctx.lineTo(apex * 0.6 + cx * 0.4, tierBot - tierH * 0.52);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Drooping branch bumps along base
        const bumps = 3 + (rng() * 4 | 0);
        for (let b = 0; b < bumps; b++) {
            const bx = cx - tierW * 0.42 + (b / (bumps - 1)) * tierW * 0.84;
            const by = tierBot + rng() * 3.5 * scale;
            const br = (1.8 + rng() * 2.8) * scale;
            ctx.fillStyle = pickGreen(GREENS_MID, rng);
            ctx.beginPath();
            ctx.arc(bx + (rng() - 0.5) * 5 * scale, by, br, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// ─── Deciduous (broadleaf) — structured trunk, branching, irregular canopy ───
function drawDeciduousTree(ctx, cx, cy, scale, rng) {
    const totalH = 52 * scale;
    const trunkH = totalH * 0.42;
    const trunkW = Math.max(2, 4.5 * scale);
    const crownR = totalH * 0.40;
    const crownCY = cy - trunkH - crownR * 0.32;

    // Ground shadow
    drawTreeShadow(ctx, cx, cy, crownR * 0.88, crownR * 0.30, scale);

    // Root flare
    ctx.fillStyle = '#221408';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 1, trunkW * 1.6, trunkW * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk — tapered with gradient side lighting
    const tg = ctx.createLinearGradient(cx - trunkW, 0, cx + trunkW, 0);
    tg.addColorStop(0,   '#1e1208');
    tg.addColorStop(0.35,'#3a2410');
    tg.addColorStop(0.65,'#4e3418');
    tg.addColorStop(1,   '#2a1a0c');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(cx - trunkW * 0.72, cy - 1);
    ctx.quadraticCurveTo(cx - trunkW * 0.38, cy - trunkH * 0.6, cx - trunkW * 0.36, cy - trunkH);
    ctx.lineTo(cx + trunkW * 0.36, cy - trunkH);
    ctx.quadraticCurveTo(cx + trunkW * 0.38, cy - trunkH * 0.6, cx + trunkW * 0.72, cy - 1);
    ctx.closePath();
    ctx.fill();

    // Bark texture lines
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
        const ly = cy - trunkH * (0.15 + i * 0.22);
        const lw = trunkW * (0.55 - i * 0.08);
        ctx.lineWidth = Math.max(0.4, 0.6 * scale);
        ctx.beginPath();
        ctx.moveTo(cx - lw, ly + rng() * 2 * scale);
        ctx.quadraticCurveTo(cx, ly + scale, cx + lw, ly - rng() * 2 * scale);
        ctx.stroke();
    }

    // Main branches — 3–5, radiating from upper trunk
    const numBranches = 3 + (rng() * 3 | 0);
    for (let b = 0; b < numBranches; b++) {
        const side     = b % 2 === 0 ? 1 : -1;
        const spread   = 0.45 + rng() * 0.70;
        const bAngle   = -Math.PI * 0.5 + side * spread;
        const bLen     = (9 + rng() * 10) * scale;
        const bY       = cy - trunkH * (0.55 + b * 0.10);
        const bW       = Math.max(0.6, (2.2 - b * 0.28) * scale);
        ctx.strokeStyle = b < 2 ? '#2e1e0c' : '#3a2810';
        ctx.lineWidth   = bW;
        ctx.beginPath();
        ctx.moveTo(cx, bY);
        // Slight curve on branch
        ctx.quadraticCurveTo(
            cx + Math.cos(bAngle) * bLen * 0.5 + (rng()-0.5)*4*scale,
            bY + Math.sin(bAngle) * bLen * 0.5,
            cx + Math.cos(bAngle) * bLen,
            bY + Math.sin(bAngle) * bLen * 0.6
        );
        ctx.stroke();

        // Secondary branch off each main branch
        if (scale > 0.5 && rng() > 0.35) {
            const sb    = bAngle + (rng() - 0.5) * 0.9;
            const sbLen = bLen * (0.4 + rng() * 0.3);
            const sbX   = cx + Math.cos(bAngle) * bLen * 0.55;
            const sbY   = bY  + Math.sin(bAngle) * bLen * 0.35;
            ctx.lineWidth = Math.max(0.4, bW * 0.55);
            ctx.beginPath();
            ctx.moveTo(sbX, sbY);
            ctx.lineTo(sbX + Math.cos(sb) * sbLen, sbY + Math.sin(sb) * sbLen * 0.7);
            ctx.stroke();
        }
    }

    // ── Canopy: layered irregular masses ────────────────────────────────────
    const numMasses = 8 + (rng() * 6 | 0);   // 8–13 masses

    // Pick a dominant hue family for this tree — gives each tree its own character
    const hueRoll = rng();
    const baseLayer = hueRoll < 0.25 ? GREENS_DARK :
                      hueRoll < 0.55 ? GREENS_MID  :
                      hueRoll < 0.80 ? GREENS_FULL : GREENS_LIGHT;

    // Shadow underlayer
    for (let m = 0; m < numMasses; m++) {
        const mx  = cx  + (rng() - 0.5) * crownR * 1.55;
        const my  = crownCY + (rng() - 0.5) * crownR * 1.0;
        const mrx = crownR * (0.28 + rng() * 0.44);
        const mry = mrx * (0.60 + rng() * 0.50);
        ctx.fillStyle = 'rgba(8,18,3,0.42)';
        irregularBlob(ctx, mx + mrx * 0.14, my + mry * 0.14, mrx, mry, 7 + (rng()*4|0), rng);
    }

    // Main foliage masses — varied greens
    for (let m = 0; m < numMasses; m++) {
        const mx  = cx  + (rng() - 0.5) * crownR * 1.55;
        const my  = crownCY + (rng() - 0.5) * crownR * 1.0;
        const mrx = crownR * (0.28 + rng() * 0.44);
        const mry = mrx * (0.60 + rng() * 0.50);
        // Mix between base layer and adjacent layers for natural variation
        const colorRoll = rng();
        const palette = colorRoll < 0.50 ? baseLayer :
                        colorRoll < 0.75 ? GREENS_FULL : GREENS_MID;
        ctx.fillStyle = pickGreen(palette, rng);
        irregularBlob(ctx, mx, my, mrx, mry, 8 + (rng()*5|0), rng);
    }

    // Upper highlight masses — brighter, lit by sky
    const numHighlights = 2 + (rng() * 4 | 0);
    for (let h = 0; h < numHighlights; h++) {
        const hx  = cx  + (rng() - 0.3) * crownR * 0.85;
        const hy  = crownCY - crownR * (0.08 + rng() * 0.30);
        const hrx = crownR * (0.16 + rng() * 0.22);
        const hry = hrx * (0.70 + rng() * 0.40);
        ctx.fillStyle = pickGreen(rng() > 0.5 ? GREENS_LIGHT : GREENS_BRIGHT, rng);
        irregularBlob(ctx, hx, hy, hrx, hry, 6 + (rng()*3|0), rng);
    }

    // Small interior darks — depth/shadow gaps
    const numGaps = 1 + (rng() * 3 | 0);
    for (let g = 0; g < numGaps; g++) {
        const gx  = cx  + (rng() - 0.5) * crownR * 0.9;
        const gy  = crownCY + (rng() - 0.3) * crownR * 0.6;
        const gr  = crownR * (0.08 + rng() * 0.12);
        ctx.fillStyle = pickGreen(GREENS_DARK, rng);
        irregularBlob(ctx, gx, gy, gr, gr * (0.6 + rng() * 0.5), 5 + (rng()*3|0), rng);
    }
}

function drawFeatures(ctx, c, r) {
    const T = TMAP[c][r];
    if (T.type === T_FOREST) return;
    // Skip obstacle hexes — the obstacle renderer handles those
    if (isBlocked(c, r)) return;

    const { sx: cx, sy: cy } = hexScreenCenter(c, r);
    const rng = makeRng(T.fseed);

    if (T.type === T_ROCKS) {
        // Rocks hex: mix in pebbles for variety
        const v = rng();
        if (v < 0.65) drawRock(ctx, cx, cy, rng);
        else          drawPebbles(ctx, cx, cy, rng);
    } else if (T.type === T_SHRUBS) {
        const v = rng();
        if      (v < 0.55) drawShrub(ctx, cx, cy, rng);
        else if (v < 0.80) drawReedTufts(ctx, cx, cy, rng);
        else               drawMushrooms(ctx, cx, cy, rng);
    } else if (T.type === T_FLOWERS) {
        drawFlowers(ctx, cx, cy, rng);
        if (rng() > 0.60) drawMushrooms(ctx, cx, cy, rng);
    } else {
        // Grass hex: varied small details
        const v = rng();
        if      (v < 0.40) drawGrassTufts(ctx, cx, cy, rng);
        else if (v < 0.58) drawPebbles   (ctx, cx, cy, rng);
        else if (v < 0.72) drawReedTufts (ctx, cx, cy, rng);
        else if (v < 0.82) drawMudPatch  (ctx, cx, cy, rng);
        else if (v < 0.90) drawMushrooms (ctx, cx, cy, rng);
        else               drawFlowers   (ctx, cx, cy, rng);
    }
}

// Scenic forest backdrop — multi-layer painted forest behind the hex grid
function drawBackgroundForest(ctx, W, H) {
    // Find topmost screen Y of the hex grid (back edge, row 0)
    let hexTopY = Infinity;
    for (let c = 0; c < COLS; c++) {
        const { sy } = hexScreenCenter(c, 0);
        if (sy < hexTopY) hexTopY = sy;
    }
    // Pull back from hex cell centers to just behind the back hex vertices
    hexTopY = Math.max(10, hexTopY - S * K * 1.6);

    const rng = makeRng(BATTLE_SEED + 7331);

    // ── Sky gradient — only behind the hills, not below them ─────────────
    const skyStopY = hexTopY * 0.58;   // = treelineY, bottom of front hill
    const skyGrad = ctx.createLinearGradient(0, 0, 0, skyStopY);
    skyGrad.addColorStop(0,    '#4a7898');
    skyGrad.addColorStop(0.50, '#6e9eb8');
    skyGrad.addColorStop(0.85, '#a8c4b8');
    skyGrad.addColorStop(1,    '#b4cec0');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, skyStopY);

    // ── Hills: fully opaque, back-to-front, no transparency ──────────────
    // yRatio/hRatio define baseY and bandH relative to hexTopY.
    // treelineY = bottom of the front hill = hexTopY * (0.30 + 0.28) = 0.58.
    const silLayers = [
        { yRatio: 0.06, hRatio: 0.32, color: '#506845', freq: 0.0055, spkFreq: 0.032 },
        { yRatio: 0.17, hRatio: 0.30, color: '#3a5428', freq: 0.0090, spkFreq: 0.048 },
        { yRatio: 0.30, hRatio: 0.28, color: '#2c4018', freq: 0.014,  spkFreq: 0.070 },
    ];

    for (const L of silLayers) {
        const baseY = hexTopY * L.yRatio;
        const bandH = hexTopY * L.hRatio;

        ctx.fillStyle = L.color;
        ctx.beginPath();
        ctx.moveTo(0, baseY + bandH);

        for (let x = 0; x <= W; x += 3) {
            const n1   = noise2(x * L.freq,          1.0, BATTLE_SEED + 4100);
            const n2   = noise2(x * L.freq * 2.4,    2.0, BATTLE_SEED + 4200);
            const spk  = noise2(x * L.spkFreq,       3.0, BATTLE_SEED + 4300);
            const topY = baseY + (n1 * 0.50 + n2 * 0.32 + spk * 0.18) * bandH;
            ctx.lineTo(x, topY);
        }
        ctx.lineTo(W, baseY + bandH);
        ctx.closePath();
        ctx.fill();
    }

    // Bottom of front hill — no trees above this line
    const treelineY = hexTopY * (0.30 + 0.28);

    // ── Mid-distance individual trees — below treelineY only ─────────────
    // Band from treelineY down to hexTopY*0.80; top of band = 0.80 - 0.75*0.24 = 0.62 > 0.58 ✓
    const midBotY  = hexTopY * 0.80;
    const midBandH = hexTopY * 0.24;

    const midTrees = [];
    let xm = -50;
    while (xm < W + 50) {
        xm += 10 + rng() * 28;
        const ym   = midBotY - rng() * midBandH * 0.75;
        const sc   = 0.22 + rng() * 0.22;
        const seed = (rng() * 0x7fffffff) | 0;
        const op   = 0.44 + rng() * 0.32;
        midTrees.push({ x: xm, y: ym, scale: sc, seed, op, conifer: rng() < 0.10 });
    }
    // ── Near forest edge — larger trees just behind the hex grid ──────────
    const nearBotY  = hexTopY + S * K * 0.55;
    const nearBandH = hexTopY * 0.44;

    const nearTrees = [];
    let xn = -90;
    while (xn < W + 90) {
        xn += 4 + rng() * 20;
        const yn   = nearBotY - rng() * nearBandH * 0.88;
        const sc   = 0.50 + rng() * 1.30;
        const seed = (rng() * 0x7fffffff) | 0;
        const op   = 0.78 + rng() * 0.22;
        nearTrees.push({ x: xn, y: yn, scale: sc, seed, op, conifer: rng() < 0.10 });
    }

    // ── Side trees — collected but not yet drawn ───────────────────────────
    const sideTrees = collectSideTrees(W, H, rng);

    // ── Unified draw: all trees sorted back-to-front by Y ─────────────────
    const allTrees = [...midTrees, ...nearTrees, ...sideTrees];
    allTrees.sort((a, b) => a.y - b.y);

    for (const t of allTrees) {
        const tr = makeRng(t.seed);
        ctx.globalAlpha = Math.min(1, t.op);
        if (t.conifer) drawConiferTree(ctx, t.x, t.y, t.scale, tr);
        else           drawDeciduousTree(ctx, t.x, t.y, t.scale, tr);
    }
    ctx.globalAlpha = 1.0;
}

// Unified perspective scale: small at top (far), large at bottom (near)
function treeScaleAtY(sy, H) {
    const t = Math.max(0, Math.min(1, sy / H));
    return 0.10 + t * 1.90;
}

// Collects side-tree data without drawing — caller merges into the global draw list.
function collectSideTrees(W, H, rng) {
    const hexCenters = [];
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
            hexCenters.push(hexScreenCenter(c, r));

    const exclusionR = S * K * 2.8;   // generous radius around each hex center

    function insideHexGrid(tx, ty) {
        for (const { sx, sy } of hexCenters)
            if (Math.hypot(tx - sx, ty - sy) < exclusionR) return true;
        return false;
    }

    // Y range: from top of hex grid down to front edge — never sky
    let hexStartY = Infinity;
    for (const { sy } of hexCenters) if (sy < hexStartY) hexStartY = sy;
    hexStartY = Math.max(10, hexStartY - S * K * 1.6);

    let hexBotY = -Infinity;
    for (const { sy } of hexCenters) if (sy > hexBotY) hexBotY = sy;
    hexBotY += S * K * 2.5;

    const hexRangeH = hexBotY - hexStartY;

    const TRIES     = 900;
    const sideTrees = [];

    for (let i = 0; i < TRIES; i++) {
        // Random Y strictly within hex-grid band (no sky)
        const sy = hexStartY + rng() * hexRangeH;
        // t=0 → top/far, t=1 → bottom/near
        const t  = (sy - hexStartY) / hexRangeH;

        // Hard cutoff: no trees in the bottom half — preserves player line of sight
        if (t > 0.50) { rng(); rng(); rng(); rng(); continue; }

        // Density: many trees at the top, thinning toward the bottom
        const density = Math.pow(Math.max(0, 1 - t), 0.55);
        if (rng() > density) continue;

        // Random X across the full canvas width; skip if inside hex grid
        const tx = -80 + rng() * (W + 160);
        if (insideHexGrid(tx, sy)) continue;

        // Scale grows ~5x from back to front (bottom +30% again, top unchanged)
        const sc   = (0.80 + rng() * 1.20) * (1.0 + t * 4.07);
        const seed = (rng() * 0x7fffffff) | 0;
        const op   = 0.65 + t * 0.30;
        // Biome: 90% broadleaf, 10% conifer
        sideTrees.push({ x: tx, y: sy, scale: sc, seed, op, conifer: rng() < 0.10 });
    }

    return sideTrees;
}

// ─── Terrain grass texture ────────────────────────────────────────────────────
function drawTerrainGrass(ctx, W, H) {
    const CHUNK = 38;

    // Compute hex grid zone so we can skip those pixels
    const hexCenters = [];
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
            hexCenters.push(hexScreenCenter(c, r));
    const exclusionR = S * K * 2.6;
    function onHexGrid(tx, ty) {
        for (const { sx, sy } of hexCenters)
            if (Math.hypot(tx - sx, ty - sy) < exclusionR) return true;
        return false;
    }

    // Grass only below the treeline (same reference as the forest drawing)
    const midHex = hexScreenCenter(Math.floor(COLS / 2), Math.floor(ROWS / 2));
    const hexTopY = midHex.sy - ROWS * S * K * 0.5 - S * K * 0.4;
    const grassTopY = hexTopY * 0.64;   // just below hills / treeline

    const endCol = Math.ceil(W / CHUNK);
    const endRow = Math.ceil(H / CHUNK);

    for (let ci = 0; ci <= endCol; ci++) {
        for (let ri = 0; ri <= endRow; ri++) {
            const cy0 = ri * CHUNK;
            if (cy0 + CHUNK < grassTopY) continue;   // above grass zone

            const tMid = ((cy0 + CHUNK * 0.5) - grassTopY) / Math.max(1, H - grassTopY);
            if (tMid > 1) continue;

            // Perspective: fewer / smaller near horizon, more / taller at bottom
            const scaleMult = 0.30 + tMid * 0.85;     // 0.30 → 1.15
            const density   = 3  + Math.round(tMid * 10); // 3 → 13

            const rng = makeRng(ci * 7919 + ri * 13337 + 88001);

            for (let i = 0; i < density; i++) {
                const bx = ci * CHUNK + rng() * CHUNK;
                const by = cy0 + rng() * CHUNK;

                if (by < grassTopY)    continue;
                if (onHexGrid(bx, by)) continue;

                // Blade proportions — three height classes
                const roll = rng();
                let bladeH, bladeW;
                if (roll < 0.52) {
                    // Short fine blades
                    bladeH = (2.5 + rng() * 2.5) * scaleMult;
                    bladeW = (0.7 + rng() * 0.7) * scaleMult;
                } else if (roll < 0.82) {
                    // Medium grass
                    bladeH = (6   + rng() * 5  ) * scaleMult;
                    bladeW = (1.0 + rng() * 1.0) * scaleMult;
                } else {
                    // Tall swaying blades
                    bladeH = (11  + rng() * 8  ) * scaleMult;
                    bladeW = (1.3 + rng() * 1.4) * scaleMult;
                }

                // Colour: dark earthy green at base → lighter at tip
                const gv    = Math.floor(72 + rng() * 68);       // 72–140
                const rv    = Math.floor(8  + rng() * 22);        // slight warm cast
                const bv    = Math.floor(4  + rng() * 14);
                const alpha = 0.30 + rng() * 0.48;

                // Lean direction and amount
                const lean   = (rng() - 0.5) * bladeH * 0.75;
                const tipX   = bx + lean;
                const tipY   = by - bladeH;
                const ctrlX  = bx + lean * 0.55 + (rng() - 0.5) * bladeH * 0.25;
                const ctrlY  = by - bladeH * 0.55;

                ctx.beginPath();
                ctx.moveTo(bx - bladeW * 0.5, by);
                ctx.quadraticCurveTo(ctrlX - bladeW * 0.25, ctrlY, tipX, tipY);
                ctx.quadraticCurveTo(ctrlX + bladeW * 0.25, ctrlY, bx + bladeW * 0.5, by);
                ctx.closePath();
                ctx.fillStyle = `rgba(${rv},${gv},${bv},${alpha.toFixed(2)})`;
                ctx.fill();
            }
        }
    }
}

// Draw terrain features across the entire canvas (including non-hex areas)
function drawBackgroundFeatures(ctx, W, H) {
    const CHUNK_SIZE = 70;  // Feature spacing

    const startCol = Math.floor(-ISO_OX / CHUNK_SIZE) - 1;
    const endCol = Math.ceil((W - ISO_OX) / CHUNK_SIZE) + 1;
    const startRow = Math.floor(-ISO_OY / CHUNK_SIZE) - 1;
    const endRow = Math.ceil((H - ISO_OY) / CHUNK_SIZE) + 1;

    for (let col = startCol; col <= endCol; col++) {
        for (let row = startRow; row <= endRow; row++) {
            const chunkSeed = h2(col, row, BATTLE_SEED + 5000);
            const rng = makeRng((chunkSeed * 0x100000000) | 0);

            // Randomly pick a terrain type (biased toward grass)
            const rand = rng();
            let ttype = T_GRASS;
            if (rand < 0.03) ttype = T_ROCKS;  // Reduced from 0.15 (80% fewer stones)
            else if (rand < 0.18) ttype = T_SHRUBS;
            else if (rand < 0.28) ttype = T_FLOWERS;

            const cx = col * CHUNK_SIZE + ISO_OX;
            const cy = row * CHUNK_SIZE + ISO_OY;

            if (ttype === T_ROCKS)   drawRock      (ctx, cx, cy, rng);
            else if (ttype === T_SHRUBS)  drawShrub     (ctx, cx, cy, rng);
            else if (ttype === T_FLOWERS) drawFlowers   (ctx, cx, cy, rng);
            else                           drawGrassTufts(ctx, cx, cy, rng);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT SPRITES — isometric figures (drawn upright in screen space)
// ─────────────────────────────────────────────────────────────────────────────

function drawShadow(ctx, cx, by) {
    ctx.beginPath();
    ctx.ellipse(cx + 2, by, 20, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fill();
}

function drawWarrior(ctx, cx, by, sel) {
    const C = {
        boot:'#182840',leg:'#2c4870',legLit:'#3a6498',
        body:'#2a5898',bodyLit:'#4a80c8',bodyDk:'#1a3860',
        armor:'#8ab0d8',trim:'#c8a030',
        shield:'#264a8a',shieldLit:'#4878c0',shieldEdge:'#c8a030',
        sword:'#ccd8e8',swordLit:'#ffffff',hilt:'#b8881e',
        skin:'#c8a080',skinDk:'#a87a58',
        helmet:'#1e3e70',helmetLit:'#3a68b0',visor:'#0c1e34',
    };
    drawShadow(ctx, cx, by);

    ctx.fillStyle=C.boot; ctx.fillRect(cx-10,by-6,8,6); ctx.fillRect(cx+2,by-6,8,6);
    ctx.fillStyle=C.leg;  ctx.fillRect(cx-9,by-19,7,14);
    ctx.fillStyle=C.legLit; ctx.fillRect(cx+2,by-19,7,14);
    ctx.fillStyle=C.armor; ctx.fillRect(cx-8,by-16,4,3); ctx.fillRect(cx+3,by-16,4,3);

    ctx.fillStyle=C.bodyDk; ctx.fillRect(cx-12,by-35,9,16);
    ctx.fillStyle=C.body;   ctx.fillRect(cx-3,by-35,5,16);
    ctx.fillStyle=C.bodyLit;ctx.fillRect(cx+2,by-35,6,16);
    ctx.fillStyle=C.armor;  ctx.fillRect(cx-5,by-33,10,9);
    ctx.fillStyle=C.trim;   ctx.fillRect(cx-5,by-34,10,2); ctx.fillRect(cx-5,by-25,10,2);

    ctx.fillStyle=C.body;
    ctx.beginPath(); ctx.ellipse(cx-11,by-36,7,5,-0.3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+10,by-36,7,5,0.3,0,Math.PI*2);  ctx.fill();
    ctx.fillStyle=C.trim; ctx.fillRect(cx-14,by-39,6,2); ctx.fillRect(cx+8,by-39,6,2);

    ctx.fillStyle=C.shield;
    ctx.beginPath(); ctx.moveTo(cx+12,by-37); ctx.lineTo(cx+25,by-30);
    ctx.lineTo(cx+23,by-15); ctx.lineTo(cx+13,by-12); ctx.lineTo(cx+9,by-21); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.shieldLit;
    ctx.beginPath(); ctx.moveTo(cx+13,by-36); ctx.lineTo(cx+23,by-30);
    ctx.lineTo(cx+20,by-18); ctx.lineTo(cx+13,by-18); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=C.shieldEdge; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(cx+12,by-37); ctx.lineTo(cx+25,by-30);
    ctx.lineTo(cx+23,by-15); ctx.lineTo(cx+13,by-12); ctx.lineTo(cx+9,by-21); ctx.closePath(); ctx.stroke();
    ctx.fillStyle=C.trim; ctx.beginPath(); ctx.arc(cx+17,by-26,4,0,Math.PI*2); ctx.fill();

    ctx.fillStyle=C.bodyDk; ctx.fillRect(cx-19,by-37,7,14);
    ctx.fillStyle=C.hilt;   ctx.fillRect(cx-22,by-47,13,4); ctx.fillRect(cx-17,by-50,3,6);
    ctx.fillStyle=C.sword;
    ctx.beginPath(); ctx.moveTo(cx-15,by-47); ctx.lineTo(cx-20,by-76);
    ctx.lineTo(cx-17,by-76); ctx.lineTo(cx-12,by-47); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.swordLit;
    ctx.beginPath(); ctx.moveTo(cx-15,by-48); ctx.lineTo(cx-19,by-74); ctx.lineTo(cx-17,by-74); ctx.closePath(); ctx.fill();

    ctx.fillStyle=C.skin;   ctx.fillRect(cx-4,by-41,7,7);
    ctx.fillStyle=C.skinDk; ctx.fillRect(cx-4,by-41,3,7);

    ctx.fillStyle=C.helmet;
    ctx.beginPath(); ctx.arc(cx,by-50,12,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.helmetLit;
    ctx.beginPath(); ctx.arc(cx+2,by-51,10,Math.PI*0.7,Math.PI*2.3); ctx.fill();
    ctx.fillStyle=C.visor;
    ctx.beginPath(); ctx.rect(cx-7,by-55,14,8); ctx.arc(cx,by-55,7,Math.PI,0); ctx.fill();
    ctx.fillStyle=C.skin;
    ctx.beginPath(); ctx.ellipse(cx,by-49,5,3,0,0,Math.PI); ctx.fill();
    ctx.fillStyle=C.trim;
    ctx.beginPath(); ctx.moveTo(cx-2,by-61); ctx.lineTo(cx+2,by-61);
    ctx.lineTo(cx+1,by-70); ctx.lineTo(cx,by-74); ctx.lineTo(cx-1,by-70); ctx.closePath(); ctx.fill();
}

function drawWizard(ctx, cx, by, sel) {
    const C = {
        boot:'#1a0c2e',robe:'#5a1878',robeLit:'#8a2aaa',robeDk:'#360c4e',
        sash:'#c8a030',skin:'#d0a878',skinDk:'#a87848',
        hat:'#3a0e5a',hatLit:'#6a1e98',hatBrim:'#290a42',
        staff:'#7a4e18',staffLit:'#a06828',
        orb:'#60d8ff',orbIn:'#c0f0ff',runes:'#a060e8',
    };
    drawShadow(ctx, cx, by);

    ctx.fillStyle=C.robeDk;
    ctx.beginPath(); ctx.moveTo(cx-14,by); ctx.lineTo(cx+14,by);
    ctx.lineTo(cx+10,by-38); ctx.lineTo(cx-9,by-38); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.robe;
    ctx.beginPath(); ctx.moveTo(cx-1,by); ctx.lineTo(cx+14,by);
    ctx.lineTo(cx+10,by-38); ctx.lineTo(cx-1,by-38); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.robeLit;
    ctx.beginPath(); ctx.moveTo(cx+4,by); ctx.lineTo(cx+13,by);
    ctx.lineTo(cx+10,by-38); ctx.lineTo(cx+4,by-38); ctx.closePath(); ctx.fill();

    ctx.fillStyle=C.sash; ctx.fillRect(cx-8,by-28,20,3);

    ctx.fillStyle=C.staff;    ctx.fillRect(cx-22,by-78,5,78);
    ctx.fillStyle=C.staffLit; ctx.fillRect(cx-22,by-78,2,78);
    ctx.shadowColor=C.orb; ctx.shadowBlur=14;
    ctx.beginPath(); ctx.arc(cx-20,by-80,8,0,Math.PI*2);
    ctx.fillStyle=C.orb; ctx.fill();
    ctx.shadowBlur=0;
    ctx.beginPath(); ctx.arc(cx-22,by-83,4,0,Math.PI*2);
    ctx.fillStyle=C.orbIn; ctx.fill();

    ctx.fillStyle=C.robeDk; ctx.fillRect(cx-18,by-36,6,14);
    ctx.fillStyle=C.robe;   ctx.fillRect(cx+9,by-36,6,14);
    ctx.fillStyle=C.runes; ctx.globalAlpha=0.55;
    for (let i=0;i<3;i++) ctx.fillRect(cx-3+i*4,by-34+i*6,3,4);
    ctx.globalAlpha=1;

    ctx.fillStyle=C.skin;   ctx.fillRect(cx-3,by-44,7,7);
    ctx.fillStyle=C.skinDk; ctx.fillRect(cx-3,by-44,2,7);
    ctx.fillStyle=C.skinDk; ctx.beginPath(); ctx.arc(cx,by-50,9,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin;   ctx.beginPath(); ctx.arc(cx+1,by-51,8,0,Math.PI*2); ctx.fill();

    ctx.fillStyle='#e8d8b0';
    ctx.beginPath(); ctx.moveTo(cx-4,by-46); ctx.lineTo(cx+5,by-46);
    ctx.lineTo(cx+3,by-40); ctx.lineTo(cx-2,by-40); ctx.closePath(); ctx.fill();

    ctx.fillStyle=C.hatBrim;
    ctx.beginPath(); ctx.ellipse(cx,by-59,13,5,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.hat;
    ctx.beginPath(); ctx.moveTo(cx-10,by-59); ctx.lineTo(cx+12,by-59);
    ctx.lineTo(cx+4,by-86); ctx.lineTo(cx-2,by-90); ctx.lineTo(cx-5,by-86); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.hatLit;
    ctx.beginPath(); ctx.moveTo(cx+2,by-60); ctx.lineTo(cx+12,by-59);
    ctx.lineTo(cx+4,by-86); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.sash;
    ctx.beginPath(); ctx.ellipse(cx+1,by-62,9,3,-0.2,0,Math.PI*2); ctx.fill();
}

function drawRogue(ctx, cx, by, sel) {
    const C = {
        boot:'#1a1008',cloakDk:'#243018',cloak:'#304020',cloakLt:'#445a2a',
        leather:'#5a3e22',leatherLt:'#7a5630',blade:'#d0d8e0',bladeLit:'#ffffff',
        hilt:'#8a6020',skin:'#c09070',skinDk:'#966e4a',
        hood:'#1e2a10',hoodLt:'#3a4e20',eyes:'#c08030',
    };
    by -= 4;
    drawShadow(ctx, cx, by+4);

    ctx.fillStyle=C.cloakDk;
    ctx.beginPath(); ctx.moveTo(cx-16,by); ctx.lineTo(cx+14,by);
    ctx.lineTo(cx+11,by-36); ctx.lineTo(cx-8,by-36); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.cloak;
    ctx.beginPath(); ctx.moveTo(cx,by); ctx.lineTo(cx+14,by);
    ctx.lineTo(cx+11,by-36); ctx.lineTo(cx,by-36); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.cloakLt;
    ctx.beginPath(); ctx.moveTo(cx+5,by); ctx.lineTo(cx+14,by);
    ctx.lineTo(cx+11,by-22); ctx.lineTo(cx+5,by-22); ctx.closePath(); ctx.fill();

    ctx.fillStyle=C.boot; ctx.fillRect(cx-9,by-6,7,6); ctx.fillRect(cx+2,by-6,7,6);
    ctx.fillStyle=C.leather; ctx.fillRect(cx-7,by-28,4,20); ctx.fillRect(cx+4,by-28,4,20);

    ctx.fillStyle=C.hilt; ctx.fillRect(cx-18,by-32,10,3);
    ctx.fillStyle=C.blade;
    ctx.beginPath(); ctx.moveTo(cx-17,by-32); ctx.lineTo(cx-21,by-52);
    ctx.lineTo(cx-18,by-52); ctx.lineTo(cx-14,by-32); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.bladeLit;
    ctx.beginPath(); ctx.moveTo(cx-17,by-33); ctx.lineTo(cx-20,by-50); ctx.lineTo(cx-18.5,by-50); ctx.closePath(); ctx.fill();

    ctx.fillStyle=C.hilt; ctx.fillRect(cx+12,by-26,8,3);
    ctx.fillStyle=C.blade;
    ctx.beginPath(); ctx.moveTo(cx+13,by-26); ctx.lineTo(cx+20,by-40);
    ctx.lineTo(cx+18,by-40); ctx.lineTo(cx+11,by-26); ctx.closePath(); ctx.fill();

    ctx.fillStyle=C.skinDk; ctx.beginPath(); ctx.arc(cx,by-46,9,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin;   ctx.beginPath(); ctx.arc(cx+2,by-47,7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.eyes;
    ctx.beginPath(); ctx.arc(cx-2,by-47,2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+4,by-47,2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#000000';
    ctx.beginPath(); ctx.arc(cx-1.5,by-47,1,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+4.5,by-47,1,0,Math.PI*2); ctx.fill();

    ctx.fillStyle=C.hood;
    ctx.beginPath(); ctx.arc(cx-1,by-49,10,Math.PI*0.9,Math.PI*2.4); ctx.fill();
    ctx.fillStyle=C.hoodLt;
    ctx.beginPath(); ctx.moveTo(cx+4,by-55); ctx.lineTo(cx+9,by-52);
    ctx.lineTo(cx+8,by-45); ctx.lineTo(cx+4,by-45); ctx.closePath(); ctx.fill();
}

function drawGoblin(ctx, cx, by, sel) {
    const C = {
        skin:'#4e7828',skinLit:'#6a9e36',skinDk:'#324e18',
        cloth:'#3c2810',clothLt:'#5a3e1e',weapon:'#5a4018',weaponLit:'#7a5828',
        blade:'#b0b890',eye:'#cc2200',eyeGlow:'rgba(200,30,0,0.50)',
        tooth:'#fffff0',ear:'#3e6020',
    };
    const by2 = by - 4;
    drawShadow(ctx, cx, by);

    ctx.fillStyle=C.cloth;
    ctx.fillRect(cx-9,by2-5,7,5); ctx.fillRect(cx+2,by2-5,7,5);
    ctx.fillRect(cx-8,by2-18,7,14); ctx.fillRect(cx+1,by2-18,7,14);

    ctx.fillStyle=C.skinDk;
    ctx.beginPath(); ctx.moveTo(cx-11,by2-18); ctx.lineTo(cx+11,by2-18);
    ctx.lineTo(cx+13,by2-32); ctx.lineTo(cx-10,by2-32); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.skin;
    ctx.beginPath(); ctx.moveTo(cx-1,by2-18); ctx.lineTo(cx+11,by2-18);
    ctx.lineTo(cx+13,by2-32); ctx.lineTo(cx-1,by2-32); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.skinLit; ctx.fillRect(cx+4,by2-32,6,14);
    ctx.fillStyle=C.clothLt; ctx.fillRect(cx-8,by2-30,18,3);

    ctx.fillStyle=C.skinDk; ctx.fillRect(cx-15,by2-36,5,14);
    ctx.fillStyle=C.weapon;  ctx.fillRect(cx-17,by2-50,7,3);
    ctx.fillStyle=C.blade;
    ctx.beginPath(); ctx.moveTo(cx-17,by2-50); ctx.lineTo(cx-20,by2-68);
    ctx.lineTo(cx-12,by2-62); ctx.lineTo(cx-10,by2-50); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#707850'; ctx.lineWidth=0.8; ctx.stroke();
    ctx.fillStyle=C.skin; ctx.fillRect(cx+12,by2-34,5,14);

    ctx.fillStyle=C.skinDk; ctx.beginPath(); ctx.arc(cx,by2-44,14,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin;   ctx.beginPath(); ctx.arc(cx+2,by2-45,12,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skinLit;ctx.beginPath(); ctx.arc(cx+4,by2-47,7,0,Math.PI*2); ctx.fill();

    ctx.fillStyle=C.ear;
    ctx.beginPath(); ctx.moveTo(cx-12,by2-50); ctx.lineTo(cx-22,by2-58); ctx.lineTo(cx-18,by2-44); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx+12,by2-50); ctx.lineTo(cx+22,by2-58); ctx.lineTo(cx+18,by2-44); ctx.closePath(); ctx.fill();

    ctx.shadowColor=C.eyeGlow; ctx.shadowBlur=8;
    ctx.fillStyle=C.eye;
    ctx.beginPath(); ctx.ellipse(cx-4,by2-47,4,3,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+6,by2-47,4,3,0,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='#ff6040';
    ctx.beginPath(); ctx.ellipse(cx-3,by2-47,2,1.5,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+7,by2-47,2,1.5,0,0,Math.PI*2); ctx.fill();

    ctx.fillStyle=C.skinDk;
    ctx.beginPath(); ctx.ellipse(cx+2,by2-40,5,4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1a0a00';
    ctx.beginPath(); ctx.arc(cx,by2-40,1.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+4,by2-40,1.5,0,Math.PI*2); ctx.fill();

    ctx.fillStyle=C.tooth;
    ctx.fillRect(cx-4,by2-37,3,4); ctx.fillRect(cx+2,by2-37,3,4); ctx.fillRect(cx-1,by2-35,4,6);
}

// Goblin Archer — slimmer, crouched, carries a short bow
function drawGoblinArcher(ctx, cx, by, sel) {
    const C = {
        skin:'#4a7422',skinLit:'#62962e',skinDk:'#2e4a12',
        cloth:'#2c1e0a',clothLt:'#3e2c10',
        bow:'#6a3e14',bowStr:'#c8b890',
        blade:'#a0a880',eye:'#cc2200',eyeGlow:'rgba(200,30,0,0.45)',
        tooth:'#fffff0',ear:'#366018',
        quiver:'#4a2e0e',arrow:'#8a6028',
    };
    // Smaller — 85% scale, hunched
    const sc = 0.85;
    const by2 = by - 2;
    drawShadow(ctx, cx, by);

    // Legs — narrower
    ctx.fillStyle = C.cloth;
    ctx.fillRect(cx - 7, by2 - 4, 5, 4);
    ctx.fillRect(cx + 2, by2 - 4, 5, 4);
    ctx.fillRect(cx - 6, by2 - 14, 5, 11);
    ctx.fillRect(cx + 1, by2 - 14, 5, 11);

    // Torso — hunched
    ctx.fillStyle = C.skinDk;
    ctx.beginPath();
    ctx.moveTo(cx - 8, by2 - 14); ctx.lineTo(cx + 9, by2 - 14);
    ctx.lineTo(cx + 10, by2 - 26); ctx.lineTo(cx - 7, by2 - 26);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.skin;
    ctx.beginPath();
    ctx.moveTo(cx, by2 - 14); ctx.lineTo(cx + 9, by2 - 14);
    ctx.lineTo(cx + 10, by2 - 26); ctx.lineTo(cx, by2 - 26);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.skinLit;
    ctx.fillRect(cx + 3, by2 - 26, 5, 12);
    ctx.fillStyle = C.clothLt;
    ctx.fillRect(cx - 6, by2 - 24, 14, 2);

    // Quiver on back
    ctx.fillStyle = C.quiver;
    ctx.fillRect(cx + 11, by2 - 28, 5, 16);
    ctx.fillStyle = C.arrow;
    for (let i = 0; i < 3; i++) {
        ctx.fillRect(cx + 12 + i, by2 - 32, 1, 5);
    }

    // Short bow — left side
    ctx.strokeStyle = C.bow;
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.arc(cx - 18, by2 - 22, 12, -Math.PI * 0.75, Math.PI * 0.75);
    ctx.stroke();
    // Bowstring
    ctx.strokeStyle = C.bowStr;
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - 18 + Math.cos(-Math.PI * 0.75) * 12, by2 - 22 + Math.sin(-Math.PI * 0.75) * 12);
    ctx.lineTo(cx - 18 + Math.cos( Math.PI * 0.75) * 12, by2 - 22 + Math.sin( Math.PI * 0.75) * 12);
    ctx.stroke();
    // Nocked arrow on bow
    ctx.strokeStyle = C.arrow;
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - 18, by2 - 22);
    ctx.lineTo(cx - 8,  by2 - 26);
    ctx.stroke();

    // Right arm
    ctx.fillStyle = C.skinDk;
    ctx.fillRect(cx + 9, by2 - 28, 4, 12);

    // Head — smaller
    ctx.fillStyle = C.skinDk; ctx.beginPath(); ctx.arc(cx, by2 - 35, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.skin;   ctx.beginPath(); ctx.arc(cx + 1, by2 - 36, 9,  0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.skinLit;ctx.beginPath(); ctx.arc(cx + 3, by2 - 37, 5,  0, Math.PI * 2); ctx.fill();

    // Ears
    ctx.fillStyle = C.ear;
    ctx.beginPath(); ctx.moveTo(cx - 9, by2 - 40); ctx.lineTo(cx - 17, by2 - 47); ctx.lineTo(cx - 13, by2 - 34); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 9, by2 - 40); ctx.lineTo(cx + 17, by2 - 47); ctx.lineTo(cx + 13, by2 - 34); ctx.closePath(); ctx.fill();

    // Eyes
    ctx.shadowColor = C.eyeGlow; ctx.shadowBlur = 6;
    ctx.fillStyle = C.eye;
    ctx.beginPath(); ctx.ellipse(cx - 3, by2 - 37, 3, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 5, by2 - 37, 3, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff5030';
    ctx.beginPath(); ctx.ellipse(cx - 2, by2 - 37, 1.5, 1.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 6, by2 - 37, 1.5, 1.1, 0, 0, Math.PI * 2); ctx.fill();

    // Snout + teeth
    ctx.fillStyle = C.skinDk;
    ctx.beginPath(); ctx.ellipse(cx + 1, by2 - 30, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.tooth;
    ctx.fillRect(cx - 3, by2 - 28, 2, 3);
    ctx.fillRect(cx + 2, by2 - 28, 2, 3);
}

function _drawSelectRing(ctx, cx, by) {
    ctx.shadowColor = P.selectLine; ctx.shadowBlur = 12;
    ctx.strokeStyle = P.selectLine; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(cx+2, by, 24, 10, 0, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0;
}

function drawUnit(ctx, unit) {
    // Slain units vanish from the map entirely
    if (unit.hp === 0) return;

    const { sx: cx, sy: cy } = hexScreenCenter(unit.col, unit.row);
    // Ground level: feet at hex center
    const by  = cy;
    const sel = (STATE.selected === unit.id);

    switch (unit.spriteType || unit.type) {
        case 'warrior':       drawWarrior      (ctx, cx, by, sel); break;
        case 'wizard':        drawWizard       (ctx, cx, by, sel); break;
        case 'rogue':         drawRogue        (ctx, cx, by, sel); break;
        case 'goblin':        drawGoblin       (ctx, cx, by, sel); break;
        case 'goblin_archer': drawGoblinArcher (ctx, cx, by, sel); break;
    }

    // HP bar
    if (unit.maxHp) {
        const pct = Math.max(0, unit.hp / unit.maxHp);
        const bw = 36, bh = 4, bx = cx - 18, bby = by - 107;
        ctx.fillStyle = 'rgba(0,0,0,0.58)';
        ctx.fillRect(bx - 1, bby - 1, bw + 2, bh + 2);
        const barColor = pct > 0.60 ? '#50d050' : pct > 0.30 ? '#d8c820' : '#d83820';
        ctx.fillStyle = barColor;
        ctx.fillRect(bx, bby, Math.max(0, Math.round(bw * pct)), bh);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(bx - 1, bby - 1, bw + 2, bh + 2);
    }

    // Name tag
    ctx.font      = 'bold 9px "IM Fell English", serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.60)';
    ctx.fillText(unit.name, cx + 1, by - 97);
    ctx.fillStyle = '#ede0c4';
    ctx.fillText(unit.name, cx, by - 98);
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

function drawHexHighlight(ctx, c, r, fillStyle, strokeStyle, lw) {
    const verts = hexScreenVerts(c, r);
    screenPolyPath(ctx, verts);
    if (fillStyle)   { ctx.fillStyle   = fillStyle;              ctx.fill();   }
    if (strokeStyle) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = lw||2;  ctx.stroke(); }
}

function drawLOSIndicator(ctx, attacker, targetCol, targetRow) {
    const fromC = hexScreenCenter(attacker.col, attacker.row);
    const toC = hexScreenCenter(targetCol, targetRow);
    const los = checkLOS(attacker, { col: targetCol, row: targetRow });

    const lineColor = los === 'clear' ? 'rgba(100,255,100,0.6)' : 'rgba(255,100,100,0.6)';
    const glowColor = los === 'clear' ? 'rgba(100,255,100,0.3)' : 'rgba(255,100,100,0.3)';

    ctx.save();

    // Glow effect
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(fromC.sx, fromC.sy);
    ctx.lineTo(toC.sx, toC.sy);
    ctx.stroke();

    // Main line
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(fromC.sx, fromC.sy);
    ctx.lineTo(toC.sx, toC.sy);
    ctx.stroke();

    ctx.restore();
}

function redrawOverlay() {
    const cv  = document.getElementById('hex-overlay-canvas');
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);

    const highlightedHexes = new Set();

    for (const [c, r] of STATE.moveRange) {
        drawHexHighlight(ctx, c, r, P.moveFill, P.moveLine, 1.5);
        highlightedHexes.add(`${c},${r}`);
    }

    for (const [c, r] of STATE.attackRange) {
        drawHexHighlight(ctx, c, r, 'rgba(220,80,0,0.26)', 'rgba(255,130,40,0.78)', 1.8);
        highlightedHexes.add(`${c},${r}`);
    }

    if (STATE.hovered) {
        const [c, r] = STATE.hovered;
        drawHexHighlight(ctx, c, r, P.hoverFill, 'rgba(255,255,255,0.50)', 1.5);
        highlightedHexes.add(`${c},${r}`);

        // Draw LOS indicator when the active hero has a ranged or spell attack
        const cur = getCurrentUnit();
        if (cur && cur.team === 'heroes') {
            let showLOS = false;
            if (COMBAT.selectedAttack && ATTACKS[COMBAT.selectedAttack]) {
                const selAtk = ATTACKS[COMBAT.selectedAttack];
                showLOS = selAtk.type === 'ranged' || selAtk.type === 'spell';
            } else {
                showLOS = getUnitAttacks(cur).some(a => a.type === 'ranged' || a.type === 'spell');
            }
            if (showLOS) drawLOSIndicator(ctx, cur, c, r);
        }
    }

    if (STATE.selected) {
        const u = STATE.units.find(u => u.id === STATE.selected);
        if (u) {
            drawHexHighlight(ctx, u.col, u.row, P.selectFill, P.selectLine, 2);
            highlightedHexes.add(`${u.col},${u.row}`);
        }
    }

    // Draw grid lines only on hexes that are actively highlighted
    for (const key of highlightedHexes) {
        const [c, r] = key.split(',').map(Number);
        drawHexGridLine(ctx, c, r);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME STATE
// ─────────────────────────────────────────────────────────────────────────────

const STATE = {
    turn        : 1,
    team        : 'heroes',
    units       : [],
    selected    : null,
    moveRange   : [],
    attackRange : [],   // hexes of enemies currently in attack range
    hovered     : null,
};

function hexDist(c1, r1, c2, r2) {
    const cube = (c, r) => {
        const x = c, z = r - (c - (c & 1)) / 2;
        return { x, y: -x - z, z };
    };
    const a = cube(c1,r1), b = cube(c2,r2);
    return Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y), Math.abs(a.z-b.z));
}

function calcMoveRange(unit, steps) {
    const res = [];
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
            if (hexDist(unit.col, unit.row, c, r) <= steps &&
                !(c===unit.col && r===unit.row) &&
                !isBlocked(c, r) &&
                !STATE.units.some(u => u.col===c && u.row===r))
                res.push([c, r]);
    return res;
}

function selectUnit(id) {
    const u = STATE.units.find(u => u.id === id);
    if (!u) return;
    STATE.selected  = id;
    STATE.moveRange = calcMoveRange(u, 3);
    redrawAll();
}

function moveUnit(c, r) {
    if (!STATE.selected) return;
    const u = STATE.units.find(u => u.id === STATE.selected);
    if (!u) return;
    if (STATE.moveRange.some(([mc,mr]) => mc===c && mr===r)) {
        u.col = c; u.row = r;
        STATE.selected = null; STATE.moveRange = [];
        redrawAll();
    }
}

function deselect() {
    STATE.selected = null; STATE.moveRange = [];
    redrawAll();
}

function nextTurn() {
    if (STATE.team === 'heroes') { STATE.team = 'enemies'; }
    else { STATE.team = 'heroes'; STATE.turn++; }
    document.getElementById('turn-counter').textContent = STATE.turn;
    deselect();
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

function getHexAtPixel(px, py) {
    let best = null, bd = Infinity;
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
            const { sx, sy } = hexScreenCenter(c, r);
            const d = Math.hypot(px - sx, py - sy);
            if (d < bd) { bd = d; best = [c, r]; }
        }
    return bd < S * K * 3 ? best : null;
}

function renderBackground() {
    const cv  = document.getElementById('hex-background-canvas');
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    // 1. Terrain fills the entire canvas — no floating board, no sky
    drawFullTerrain(ctx, W, H);

    // 1.2. Perspective darkening — top unchanged, bottom 25% darker
    const perspGrad = ctx.createLinearGradient(0, 0, 0, H);
    perspGrad.addColorStop(0, 'rgba(0,0,0,0.00)');
    perspGrad.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = perspGrad;
    ctx.fillRect(0, 0, W, H);

    // 1.4. Terrain grass texture — random blade shapes across ground
    drawTerrainGrass(ctx, W, H);

    // 1.5. Background features across entire canvas
    drawBackgroundFeatures(ctx, W, H);

    // 1.75. Forest behind and to the left of hex grid
    drawBackgroundForest(ctx, W, H);

    // Build back-to-front order for overlays
    const order = [];
    for (let c = 0; c < COLS; c++)
        for (let r = 0; r < ROWS; r++)
            order.push([c, r, hexDepth(c, r)]);
    order.sort((a, b) => a[2] - b[2]);

    // 2. Subtle per-hex biome tints (forest darker, rocks brownish)
    for (const [c, r] of order) drawHexBiomeTint(ctx, c, r);

    // 3. Hex grid lines — drawn on demand in redrawOverlay, not baked into background

    // 4. Terrain features (rocks, shrubs, flowers, grass — no trees)
    for (const [c, r] of order) drawFeatures(ctx, c, r);

    // 5. Impassable obstacle clusters (rendered in painter order)
    // Sort obstacle hexes back-to-front so tall objects overlap correctly
    const obsDrawList = [];
    for (const obs of OBSTACLES) {
        for (let i = 0; i < obs.hexes.length; i++) {
            const [col, row] = obs.hexes[i];
            obsDrawList.push({ obs, hexIndex: i, depth: hexDepth(col, row) });
        }
    }
    obsDrawList.sort((a, b) => a.depth - b.depth);
    for (const { obs, hexIndex } of obsDrawList) drawObstacleOnHex(ctx, obs, hexIndex);
}

function renderUnits() {
    const cv  = document.getElementById('unit-canvas');
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);

    const sorted = [...STATE.units].sort((a, b) =>
        hexDepth(a.col, a.row) - hexDepth(b.col, b.row)
    );
    for (const u of sorted) drawUnit(ctx, u);
}

function redrawAll() {
    renderUnits();
    redrawOverlay();
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT PANEL
// ─────────────────────────────────────────────────────────────────────────────

// ─── Portrait drawing helpers ─────────────────────────────────────────────────

// Object-fit:cover into a W×H canvas
function drawPortraitCover(pctx, img, W, H) {
    const sx = img.naturalWidth, sy = img.naturalHeight;
    const scale = Math.max(W / sx, H / sy);
    const dw = sx * scale, dh = sy * scale;
    const ox = (W - dw) / 2, oy = (H - dh) / 2;
    pctx.save();
    pctx.beginPath();
    pctx.rect(0, 0, W, H);
    pctx.clip();
    pctx.drawImage(img, ox, oy, dw, dh);
    pctx.restore();
}

// Capitalize a snake_case or camelCase id: "shadow_blade" → "Shadow Blade"
function prettyId(id) {
    if (!id) return '';
    return id.replace(/[_\-]/g, ' ')
             .replace(/([A-Z])/g, ' $1')
             .trim()
             .replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Unit panel ───────────────────────────────────────────────────────────────

function buildUnitPanel() {
    const panel = document.getElementById('unit-panel');
    panel.innerHTML = '';
    for (const u of STATE.units) {
        const slot  = document.createElement('div');
        slot.className = 'unit-icon-slot';

        const W = 68, H = 102;
        const cv  = document.createElement('canvas');
        cv.width  = W; cv.height = H;
        cv.style.borderRadius = '4px';
        cv.style.border = u.team === 'heroes'
            ? '2px solid rgba(64,184,255,0.55)'
            : '2px solid rgba(255,64,64,0.55)';
        cv.style.boxShadow = '0 2px 6px rgba(0,0,0,0.45)';
        cv.style.cursor    = 'pointer';

        const pctx = cv.getContext('2d');
        const bg   = pctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#1c2e10'); bg.addColorStop(1, '#0e1808');
        pctx.fillStyle = bg; pctx.fillRect(0, 0, W, H);

        if (u.portrait) {
            const img = new Image();
            img.onload = () => {
                pctx.fillStyle = bg; pctx.fillRect(0, 0, W, H);
                drawPortraitCover(pctx, img, W, H);
                // Dark gradient at bottom for name legibility
                const grad = pctx.createLinearGradient(0, H - 28, 0, H);
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(1, 'rgba(0,0,0,0.78)');
                pctx.fillStyle = grad; pctx.fillRect(0, H - 28, W, 28);
            };
            img.src = u.portrait;
        } else {
            switch (u.spriteType || u.type) {
                case 'warrior':       drawWarrior      (pctx, W/2, H - 6, false); break;
                case 'wizard':        drawWizard       (pctx, W/2, H - 6, false); break;
                case 'rogue':         drawRogue        (pctx, W/2, H - 6, false); break;
                case 'goblin':        drawGoblin       (pctx, W/2, H - 6, false); break;
                case 'goblin_archer': drawGoblinArcher (pctx, W/2, H - 6, false); break;
            }
        }

        const label = document.createElement('div');
        label.className   = 'unit-label';
        label.textContent = u.name;

        slot.appendChild(cv);
        slot.appendChild(label);

        // Hover → tooltip
        cv.addEventListener('mouseenter', e => showUnitTooltip(u, e));
        cv.addEventListener('mousemove',  e => repositionTooltip(e));
        cv.addEventListener('mouseleave',  () => hideTooltip());

        // Click → character sheet overlay (heroes only); enemies just select
        cv.addEventListener('click', () => {
            if (u.team === 'heroes') openCharSheet(u);
            else selectUnit(u.id);
        });

        panel.appendChild(slot);
    }
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function showUnitTooltip(u, e) {
    const tip = document.getElementById('tooltip');
    const cd  = u._charData;
    const atkNames = (u.attackKeys || []).map(k => ATTACKS[k]?.name).filter(Boolean);
    const defaultAtks = {
        warrior: ['Sword Strike'], wizard: ['Fireball'],
        rogue: ['Arrow Shot', 'Steel Knives'],
        goblin: ['Claw'], goblin_archer: ['Goblin Arrow', 'Weak Claw'],
    };
    const attacks = atkNames.length ? atkNames : (defaultAtks[u.spriteType || u.type] || []);

    let html = `<div style="font-size:0.88rem;color:#c9a84c;margin-bottom:4px">${u.name}</div>`;

    if (cd) {
        const group = CLASS_GROUP_MAP[cd.cls] || '';
        const cls   = prettyId(cd.cls);
        const race  = prettyId(cd.race);
        if (cls || race) html += `<div style="font-size:0.76rem;color:#aac880;margin-bottom:4px">${cls}${cls && race ? ' · ' : ''}${race}</div>`;
    } else {
        const sp = u.spriteType || u.type;
        html += `<div style="font-size:0.76rem;color:#aac880;margin-bottom:4px">${sp.charAt(0).toUpperCase() + sp.slice(1)} (placeholder)</div>`;
    }

    const s = UNIT_STATS[u.type] || {};
    const maxHp = u.maxHp || s.maxHp || '?';
    const spd   = s.speed   || '?';
    const dg    = u.dodge != null ? u.dodge : (s.dodge ?? '?');
    html += `<div style="font-size:0.74rem;color:rgba(237,224,196,0.72);margin-bottom:4px">` +
            `HP: ${maxHp} &nbsp;·&nbsp; Spd: ${spd} &nbsp;·&nbsp; Dodge: ${dg}%</div>`;

    if (attacks.length) {
        html += `<div style="font-size:0.72rem;color:rgba(237,224,196,0.55);">` +
                attacks.map(a => `⚔ ${a}`).join('<br>') + `</div>`;
    }

    if (u.team === 'heroes') {
        html += `<div style="font-size:0.70rem;color:rgba(201,168,76,0.55);margin-top:5px;font-style:italic">Click for full sheet</div>`;
    }

    tip.innerHTML = html;
    tip.classList.add('visible');
    repositionTooltip(e);
}

function repositionTooltip(e) {
    const tip = document.getElementById('tooltip');
    const margin = 14;
    let x = e.clientX + margin, y = e.clientY + margin;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    if (x + tw > window.innerWidth  - 8) x = e.clientX - tw - margin;
    if (y + th > window.innerHeight - 8) y = e.clientY - th - margin;
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
}

function hideTooltip() {
    document.getElementById('tooltip').classList.remove('visible');
}

// ─── Character sheet overlay ──────────────────────────────────────────────────

function openCharSheet(u) {
    hideTooltip();
    const overlay = document.getElementById('cs-overlay');
    if (!overlay) return;
    const cd = u._charData;

    // Portrait
    const port = document.getElementById('cs-portrait');
    if (port) {
        port.innerHTML = '';
        const W = 120, H = 160;
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        cv.style.borderRadius = '4px';
        cv.style.border = '2px solid rgba(201,168,76,0.5)';
        const pctx = cv.getContext('2d');
        const bg = pctx.createLinearGradient(0,0,0,H);
        bg.addColorStop(0,'#1c2e10'); bg.addColorStop(1,'#0e1808');
        pctx.fillStyle = bg; pctx.fillRect(0,0,W,H);
        if (u.portrait) {
            const img = new Image();
            img.onload = () => { pctx.fillStyle = bg; pctx.fillRect(0,0,W,H); drawPortraitCover(pctx, img, W, H); };
            img.src = u.portrait;
        } else {
            switch (u.spriteType || u.type) {
                case 'warrior': drawWarrior(pctx, W/2, H - 8, false); break;
                case 'wizard':  drawWizard (pctx, W/2, H - 8, false); break;
                case 'rogue':   drawRogue  (pctx, W/2, H - 8, false); break;
            }
        }
        port.appendChild(cv);
    }

    // Name & identity
    const s    = UNIT_STATS[u.type] || {};
    const maxHp  = u.maxHp || s.maxHp || '?';
    const spd    = s.speed  || '?';
    const dg     = u.dodge  != null ? u.dodge : (s.dodge ?? '?');

    document.getElementById('cs-name').textContent = u.name || 'Unknown';

    const identEl = document.getElementById('cs-identity');
    if (cd) {
        const cls   = prettyId(cd.cls);
        const race  = prettyId(cd.race);
        const group = CLASS_GROUP_MAP[cd.cls] || '';
        identEl.textContent = [cls, race].filter(Boolean).join(' · ') + (group ? `  (${group})` : '');
    } else {
        const sp = u.spriteType || u.type;
        identEl.textContent = `${sp.charAt(0).toUpperCase() + sp.slice(1)} — Placeholder`;
    }

    document.getElementById('cs-level').textContent  = 'Level 1';
    document.getElementById('cs-hp').textContent     = maxHp;
    document.getElementById('cs-speed').textContent  = spd;
    document.getElementById('cs-dodge').textContent  = dg + '%';

    // Skills
    const skillsEl = document.getElementById('cs-skills');
    skillsEl.innerHTML = '';
    const skills = cd?.skills || [];
    if (skills.length) {
        skills.forEach(sk => {
            const li = document.createElement('li');
            li.textContent = sk;
            skillsEl.appendChild(li);
        });
    } else {
        const li = document.createElement('li'); li.textContent = 'None';
        skillsEl.appendChild(li);
    }

    // Attacks
    const atksEl = document.getElementById('cs-attacks');
    atksEl.innerHTML = '';
    const atkKeys = u.attackKeys || [];
    const defaultAtks = {
        warrior: ['warrior_melee'], wizard: ['wizard_spell'],
        rogue: ['rogue_bow', 'rogue_knives'],
    };
    const keys = atkKeys.length ? atkKeys : (defaultAtks[u.spriteType || u.type] || []);
    const ATK_TYPE_ICON = { melee:'⚔', ranged:'🏹', spell:'✨' };
    keys.forEach(k => {
        const atk = ATTACKS[k];
        if (!atk) return;
        const li = document.createElement('li');
        const icon = ATK_TYPE_ICON[atk.type] || '⚔';
        const avg = Math.round(atk.damageDice[0] * (atk.damageDice[1] + 1) / 2 + atk.damageMod);
        li.innerHTML = `${icon} <strong>${atk.name}</strong> <span style="color:rgba(237,224,196,0.55);font-size:0.82em">${atk.damageDice[0]}d${atk.damageDice[1]}+${atk.damageMod} · avg ${avg} · range ${atk.range}</span>`;
        atksEl.appendChild(li);
    });

    // Background (if any)
    const bgEl = document.getElementById('cs-background');
    if (bgEl) {
        bgEl.style.display = (cd?.background) ? '' : 'none';
        if (cd?.background) bgEl.textContent = 'Background: ' + prettyId(cd.background);
    }

    overlay.style.display = 'flex';
}

function closeCharSheet() {
    const overlay = document.getElementById('cs-overlay');
    if (overlay) overlay.style.display = 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────────────────────

function setupEvents() {
    const uc = document.getElementById('unit-canvas');

    uc.addEventListener('mousemove', e => {
        const r = uc.getBoundingClientRect();
        STATE.hovered = getHexAtPixel(e.clientX - r.left, e.clientY - r.top);
        redrawOverlay();
    });

    uc.addEventListener('mouseleave', () => {
        STATE.hovered = null; redrawOverlay();
    });

    uc.addEventListener('click', e => {
        const r   = uc.getBoundingClientRect();
        const hex = getHexAtPixel(e.clientX - r.left, e.clientY - r.top);
        if (!hex) return;
        const [c, r2] = hex;
        if (COMBAT.active) {
            handleCombatClick(c, r2);
        } else {
            const unit = STATE.units.find(u => u.col===c && u.row===r2);
            if (unit) {
                if (STATE.selected === unit.id) deselect();
                else selectUnit(unit.id);
            } else if (STATE.selected) {
                moveUnit(c, r2);
            }
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') nextTurn();
        if (e.key === 'Escape') deselect();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

function resizeCanvases() {
    const area = document.querySelector('.battle-canvas-area');
    const W = area.clientWidth, H = area.clientHeight;
    for (const id of ['hex-background-canvas','hex-overlay-canvas','unit-canvas']) {
        const cv = document.getElementById(id);
        cv.width = W; cv.height = H;
    }
    recalcIsoOrigin(W, H);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAM SELECT OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

function buildTeamSelectOverlay() {
    const overlay = document.getElementById('team-select-overlay');
    if (!overlay) return;
    const parties = loadSavedParties();
    const list    = document.getElementById('tso-parties-list');
    const section = document.getElementById('tso-parties-section');

    list.innerHTML = '';

    if (!parties.length) {
        section.style.display = 'none';
    } else {
        section.style.display = '';
        parties.forEach(party => {
            const btn = document.createElement('button');
            btn.className   = 'tso-party-btn';
            const memberNames = (party.members || []).map(m => m.name || '?').join(', ');
            btn.innerHTML = `<span class="tso-party-name">${party.name || 'Unnamed Party'}</span>` +
                            `<span class="tso-party-members">${party.members?.length || 0} members · ${memberNames}</span>`;
            btn.addEventListener('click', () => {
                UNIT_DEFS = [...partyToHeroDefs(party), ...ENEMY_DEFS];
                hideTeamSelectOverlay();
                startBattle();
            });
            list.appendChild(btn);
        });
    }
}

function showTeamSelectOverlay() {
    buildTeamSelectOverlay();
    const overlay = document.getElementById('team-select-overlay');
    if (overlay) overlay.style.display = 'flex';
}

function hideTeamSelectOverlay() {
    const overlay = document.getElementById('team-select-overlay');
    if (overlay) overlay.style.display = 'none';
}

function startBattle() {
    BATTLE_SEED = Math.floor(Math.random() * 0x7fffffff);
    generateTerrain();
    generateObstacles();
    resizeCanvases();
    STATE.units = UNIT_DEFS.map(d => ({ ...d }));
    renderBackground();
    redrawAll();
    startCombat();
}

function init() {
    // Render a silent background first so the canvas is not blank under the overlay
    resizeCanvases();
    BATTLE_SEED = Math.floor(Math.random() * 0x7fffffff);
    generateTerrain();
    generateObstacles();
    renderBackground();
    setupEvents();
    setupCombatButtons();

    window.addEventListener('resize', () => {
        resizeCanvases();
        renderBackground();
        redrawAll();
    });

    // Wire up the default team button
    const defBtn = document.getElementById('btn-default-team');
    if (defBtn) {
        defBtn.addEventListener('click', () => {
            UNIT_DEFS = [...DEFAULT_HERO_DEFS, ...ENEMY_DEFS];
            hideTeamSelectOverlay();
            startBattle();
        });
    }

    // Wire up Change Party button in header
    const changeBtn = document.getElementById('btn-change-party');
    if (changeBtn) {
        changeBtn.addEventListener('click', () => showTeamSelectOverlay());
    }

    // Wire up character sheet close button
    const csClose = document.getElementById('cs-close-btn');
    if (csClose) csClose.addEventListener('click', closeCharSheet);
    // Also close on overlay backdrop click
    const csOverlay = document.getElementById('cs-overlay');
    if (csOverlay) {
        csOverlay.addEventListener('click', e => {
            if (e.target === csOverlay) closeCharSheet();
        });
    }
    // Escape key closes both overlays
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeCharSheet(); hideTeamSelectOverlay(); }
    });

    const parties = loadSavedParties();
    if (parties.length === 0) {
        // No saved parties → skip overlay, go straight to default team
        UNIT_DEFS = [...DEFAULT_HERO_DEFS, ...ENEMY_DEFS];
        startBattle();
    } else {
        showTeamSelectOverlay();
    }
}

if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
else
    init();

// ═══════════════════════════════════════════════════════════════════════════════
// COMBAT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

// ── Unit combat stats ─────────────────────────────────────────────────────────
const UNIT_STATS = {
    warrior       : { maxHp: 70,  speed: 3, dodge: 20 },
    wizard        : { maxHp: 45,  speed: 3, dodge: 15 },
    rogue         : { maxHp: 55,  speed: 4, dodge: 30 },
    goblin        : { maxHp: 140, speed: 2, dodge: 10 },
    goblin_archer : { maxHp: 42,  speed: 3, dodge: 18 },  // 30% of goblin HP
};

// ── Attack definitions ────────────────────────────────────────────────────────
const ATTACKS = {
    // Heroes
    warrior_melee  : { name:'Sword Strike',  type:'melee',  range:1,  damageDice:[2,10], damageMod:5,  hitBase:98, critMin:90, snd:'sword' },
    rogue_bow      : { name:'Arrow Shot',    type:'ranged', range:14, damageDice:[2,8],  damageMod:3,  hitBase:98, critMin:95, snd:'bow'   },
    rogue_knives   : { name:'Steel Knives',  type:'melee',  range:1,  damageDice:[2,9],  damageMod:4,  hitBase:98, critMin:92, snd:'sword' },
    wizard_spell   : { name:'Fireball',      type:'spell',  range:15, damageDice:[3,8],  damageMod:5,  hitBase:98, critMin:97, snd:'fire'  },
    // Monsters
    goblin_melee   : { name:'Claw',          type:'melee',  range:1,  damageDice:[1,12], damageMod:4,  hitBase:95, critMin:90, snd:'claw'  },
    goblin_arc_bow : { name:'Goblin Arrow',  type:'ranged', range:10, damageDice:[1,6],  damageMod:1,  hitBase:92, critMin:93, snd:'bow'   },
    goblin_arc_claw: { name:'Weak Claw',     type:'melee',  range:1,  damageDice:[1,6],  damageMod:1,  hitBase:85, critMin:92, snd:'claw'  },
};

// Returns all attacks a unit can use, ordered primary first.
function getUnitAttacks(unit) {
    // Custom characters carry their own attack key list
    if (unit.attackKeys?.length) return unit.attackKeys.map(k => ATTACKS[k]).filter(Boolean);
    switch (unit.spriteType || unit.type) {
        case 'warrior':       return [ATTACKS.warrior_melee];
        case 'rogue':         return [ATTACKS.rogue_bow, ATTACKS.rogue_knives];
        case 'wizard':        return [ATTACKS.wizard_spell];
        case 'goblin':        return [ATTACKS.goblin_melee];
        case 'goblin_archer': return [ATTACKS.goblin_arc_bow, ATTACKS.goblin_arc_claw];
        default:              return [ATTACKS.goblin_melee];
    }
}

// Pick the best available attack against a specific target distance.
// Ranged/spell attacks are preferred when out of melee range.
// When multiple attacks can reach, pick highest average damage.
function getBestAttack(unit, targetDist) {
    const all = getUnitAttacks(unit);
    const reachable = all.filter(a => targetDist <= a.range);
    if (!reachable.length) return all[0]; // fallback (will fail gracefully)
    return reachable.reduce((best, a) => {
        const avgA    = a.damageDice[0] * (a.damageDice[1] + 1) / 2 + a.damageMod;
        const avgBest = best.damageDice[0] * (best.damageDice[1] + 1) / 2 + best.damageMod;
        return avgA > avgBest ? a : best;
    });
}

// Compatibility shim used throughout existing code.
function getUnitAttack(unit, targetDist) {
    if (targetDist !== undefined) return getBestAttack(unit, targetDist);
    return getUnitAttacks(unit)[0];
}

// ── Combat state ──────────────────────────────────────────────────────────────
const COMBAT = {
    active        : false,
    round         : 1,
    initiative    : [],   // [{id, roll}] sorted descending
    turnIndex     : -1,
    attackMode    : false,
    selectedAttack: null, // key into ATTACKS for the player-chosen action
    animating     : false,
};

// ── Sound file mapping ────────────────────────────────────────────────────────
const SOUND_FILES = {
    'sword':    'assets/sounds/swordswing2.mp3',
    'bow':      'assets/sounds/arrowfire.mp3',
    'claw':     'assets/sounds/claw.wav',
    'stab':     'assets/sounds/stab.wav',
    'hit':      'assets/sounds/hit.wav',
    'miss':     'assets/sounds/miss.wav',
    'arrowhit': 'assets/sounds/arrowhit.mp3',
    'fire':     'assets/sounds/spells/fireballlaunch.mp3',
    'firehit':  'assets/sounds/spells/firespellhit.mp3',
};

const _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const _audioBuffers = {};

(async () => {
    for (const [key, src] of Object.entries(SOUND_FILES)) {
        try {
            const res = await fetch(src);
            const buf = await res.arrayBuffer();
            _audioBuffers[key] = await _audioCtx.decodeAudioData(buf);
        } catch(e) { console.warn('Failed to load sound:', key, e); }
    }
})();

function playSound(type) {
    const buf = _audioBuffers[type];
    if (!buf) return;
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    const src = _audioCtx.createBufferSource();
    src.buffer = buf;
    const gain = _audioCtx.createGain();
    gain.gain.value = 0.75;
    src.connect(gain);
    gain.connect(_audioCtx.destination);
    src.start();
}

// ── Line of sight ─────────────────────────────────────────────────────────────
function checkLOS(atk, tgt) {
    const dist = hexDist(atk.col, atk.row, tgt.col, tgt.row);
    if (dist <= 1) return 'clear';

    // Use fine-grained line-of-sight: sample every 0.1 hex distance
    const steps = Math.max(dist * 10, 20);
    const visited = new Set();

    for (let i = 1; i < steps; i++) {
        const p  = i / steps;
        const x = atk.col + (tgt.col - atk.col) * p;
        const y = atk.row + (tgt.row - atk.row) * p;

        // Check all nearby hexes for the ray position
        for (let dc = -1; dc <= 1; dc++) {
            for (let dr = -1; dr <= 1; dr++) {
                const nc = Math.round(x) + dc;
                const nr = Math.round(y) + dr;
                const key = `${nc},${nr}`;

                if (visited.has(key)) continue;
                visited.add(key);

                if (nc === atk.col && nr === atk.row) continue;
                if (nc === tgt.col && nr === tgt.row) continue;
                if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;

                if (isBlocked(nc, nr)) return 'obstacle';
                if (STATE.units.some(u => u.hp > 0 && u.id !== atk.id && u.id !== tgt.id && u.col === nc && u.row === nr))
                    return 'partial';
            }
        }
    }
    return 'clear';
}

// Zone of control: ranged attacker inside 1-hex radius of an enemy is penalised
function inEnemyZoC(unit) {
    return STATE.units.some(u => u.team !== unit.team && u.hp > 0 &&
        hexDist(unit.col, unit.row, u.col, u.row) <= 1);
}

// ── Dice helpers ──────────────────────────────────────────────────────────────
function rollD(sides) { return 1 + Math.floor(Math.random() * sides); }
function rollD100()   { return rollD(100); }
function rollDamage(dice, mod) {
    let v = mod;
    for (let i = 0; i < dice[0]; i++) v += rollD(dice[1]);
    return Math.max(1, v);
}

// ── Dice roll animation ───────────────────────────────────────────────────────
const _diceAnims = [];

function startDiceAnim(col, row, finalRoll, cb) {
    const color = finalRoll >= 50 ? '#44ee88' : '#ee4444';
    _diceAnims.push({ col, row, finalRoll, color, start: performance.now(), duration: 520, cb, done: false });
    _tickDice();
}

function _tickDice() {
    requestAnimationFrame(() => {
        const cv  = document.getElementById('unit-canvas');
        const ctx = cv.getContext('2d');
        const now = performance.now();
        ctx.clearRect(0, 0, cv.width, cv.height);
        const sorted = [...STATE.units].sort((a,b) => hexDepth(a.col,a.row) - hexDepth(b.col,b.row));
        for (const u of sorted) drawUnit(ctx, u);
        drawProjectile(ctx);   // projectile layer above units
        drawSwing(ctx);        // melee swing arcs above units

        let anyActive = false;
        for (const a of _diceAnims) {
            if (a.done) continue;
            const prog = Math.min(1, (now - a.start) / a.duration);
            if (prog >= 1) {
                a.done = true;
                _drawDicePop(ctx, a.col, a.row, a.finalRoll, a.color);
                if (a.cb) setTimeout(a.cb, 5);
                continue;
            }
            anyActive = true;
            const num = prog > 0.76 ? a.finalRoll : (1 + Math.floor(Math.random() * 100));
            _drawDicePop(ctx, a.col, a.row, num, a.color);
        }
        if (anyActive) _tickDice();
        else _diceAnims.length = 0;
    });
}

function _drawDicePop(ctx, col, row, num, color) {
    const { sx: cx, sy: cy } = hexScreenCenter(col, row);
    const py = cy - 118;
    ctx.save();
    ctx.font = 'bold 18px "IM Fell English", serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur  = 5;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.88;
    ctx.fillText(num, cx, py);
    ctx.restore();
}

// ── Floating damage numbers ───────────────────────────────────────────────────
const _dmgAnims = [];

function showFloatDmg(col, row, dmg, isCrit, isMiss) {
    _dmgAnims.push({ col, row, dmg, isCrit, isMiss, start: performance.now(), duration: 1100, done: false });
    _tickDmg();
}

function _tickDmg() {
    requestAnimationFrame(() => {
        const cv  = document.getElementById('unit-canvas');
        const ctx = cv.getContext('2d');
        const now = performance.now();
        ctx.clearRect(0, 0, cv.width, cv.height);
        const sorted = [...STATE.units].sort((a,b) => hexDepth(a.col,a.row) - hexDepth(b.col,b.row));
        for (const u of sorted) drawUnit(ctx, u);

        let anyActive = false;
        for (const a of _dmgAnims) {
            if (a.done) continue;
            const t = (now - a.start) / a.duration;
            if (t >= 1) { a.done = true; continue; }
            anyActive = true;
            const { sx: cx, sy: cy } = hexScreenCenter(a.col, a.row);
            const posY = cy - 108 - t * 34;
            const alp  = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1.0;
            ctx.save();
            ctx.globalAlpha = alp * 0.82;
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.90)';
            ctx.shadowBlur  = 6;
            if (a.isMiss) {
                ctx.font = 'bold 16px "IM Fell English"';
                ctx.fillStyle = '#b0b0b0';
                ctx.fillText('MISS', cx, posY);
            } else if (a.isCrit) {
                // Two lines: big "CRITICAL STRIKE!" then damage below
                ctx.font = 'bold 57px "IM Fell English"';
                ctx.fillStyle = '#ffe040';
                ctx.shadowColor = 'rgba(255,140,0,0.70)';
                ctx.shadowBlur  = 18;
                ctx.fillText('CRITICAL STRIKE!', cx, posY);
                ctx.shadowBlur = 6;
                ctx.shadowColor = 'rgba(0,0,0,0.90)';
                ctx.font = 'bold 19px "IM Fell English"';
                ctx.fillStyle = '#ffcc44';
                ctx.fillText('−' + a.dmg, cx, posY + 30);
            } else {
                ctx.font = 'bold 19px "IM Fell English"';
                ctx.fillStyle = '#ff6633';
                ctx.fillText('−' + a.dmg, cx, posY);
            }
            ctx.restore();
        }
        // Blood splatter runs alongside damage numbers
        _drawBlood(ctx, now);
        let bloodActive = _bloodAnims.some(b => !b.done);

        if (anyActive || bloodActive) _tickDmg();
        else { _dmgAnims.length = 0; _bloodAnims.length = 0; redrawAll(); }
    });
}

// ── Attack range query ────────────────────────────────────────────────────────
function getAttackableEnemies(unit, atkFilter) {
    const atks = atkFilter ? [atkFilter] : getUnitAttacks(unit);
    const maxRange = Math.max(...atks.map(a => a.range));
    return STATE.units.filter(u => {
        if (u.team === unit.team || u.hp <= 0) return false;
        const d = hexDist(unit.col, unit.row, u.col, u.row);
        return d <= maxRange;
    });
}

// ── Round banner ──────────────────────────────────────────────────────────────
function showRoundBanner(n) {
    const el = document.getElementById('turn-banner');
    el.textContent = 'Round ' + n;
    el.classList.remove('visible');
    // Force reflow so animation restarts
    void el.offsetWidth;
    el.classList.add('visible');
}

// ── Range / action warning toast ──────────────────────────────────────────────
const RANGE_MSGS = {
    melee : 'Close range only — move adjacent first!',
    ranged: 'Target out of range!',
    spell : 'Target out of spell range!',
};
const NO_TARGET_MSGS = {
    melee : 'No enemies in melee range — move closer.',
    ranged: 'No enemies within bow range.',
    spell : 'No enemies within spell range.',
};
let _rangeWarnTimer = null;
function showRangeWarning(msg) {
    const el = document.getElementById('range-warning');
    if (!el) return;
    if (_rangeWarnTimer) { clearTimeout(_rangeWarnTimer); _rangeWarnTimer = null; }
    el.textContent = msg;
    el.classList.remove('visible');
    void el.offsetWidth; // reflow to restart animation
    el.classList.add('visible');
    _rangeWarnTimer = setTimeout(() => el.classList.remove('visible'), 2000);
}

// ── Battle result ─────────────────────────────────────────────────────────────
function showBattleResult(result) {
    const el = document.getElementById('battle-result');
    el.textContent = result === 'victory' ? '⚔ Victory!' : '☠ Defeated!';
    el.className   = 'battle-result result-' + result;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; resetBattle(); }, 3200);
}

// ── Check battle end ──────────────────────────────────────────────────────────
function checkBattleEnd() {
    const heroes  = STATE.units.filter(u => u.team === 'heroes'  && u.hp > 0).length;
    const enemies = STATE.units.filter(u => u.team === 'enemies' && u.hp > 0).length;
    if (heroes  === 0) { showBattleResult('defeat');  return true; }
    if (enemies === 0) { showBattleResult('victory'); return true; }
    return false;
}

// ── Combat log ────────────────────────────────────────────────────────────────
function combatLog(msg) {
    const log = document.getElementById('combat-log');
    if (!log) return;
    const line = document.createElement('div');
    line.className   = 'log-line';
    line.textContent = msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
    while (log.children.length > 26) log.removeChild(log.firstChild);
}

// ── Initiative UI ─────────────────────────────────────────────────────────────
function updateInitiativeUI() {
    const bar = document.getElementById('initiative-bar');
    if (!bar) return;
    bar.innerHTML = '';

    const PW = 52, PH = 64;   // portrait canvas size inside each slot

    for (let i = 0; i < COMBAT.initiative.length; i++) {
        const entry = COMBAT.initiative[i];
        const u     = STATE.units.find(u => u.id === entry.id);
        if (!u || u.hp <= 0) continue;

        const slot = document.createElement('div');
        slot.className = 'init-slot' +
            (i === COMBAT.turnIndex ? ' init-active' : '') +
            (u.hasActed ? ' init-acted' : '');

        // Portrait canvas
        const cv  = document.createElement('canvas');
        cv.width  = PW; cv.height = PH;
        cv.style.borderRadius = '3px';
        cv.style.border = u.team === 'heroes'
            ? '1px solid rgba(64,184,255,0.45)'
            : '1px solid rgba(255,80,80,0.45)';
        cv.style.display = 'block';

        const pctx = cv.getContext('2d');
        const bg   = pctx.createLinearGradient(0, 0, 0, PH);
        bg.addColorStop(0, '#1c2e10'); bg.addColorStop(1, '#0e1808');
        pctx.fillStyle = bg; pctx.fillRect(0, 0, PW, PH);

        if (u.portrait) {
            const img = new Image();
            img.onload = () => {
                pctx.fillStyle = bg; pctx.fillRect(0, 0, PW, PH);
                drawPortraitCover(pctx, img, PW, PH);
                // Bottom fade for name legibility
                const fade = pctx.createLinearGradient(0, PH - 20, 0, PH);
                fade.addColorStop(0, 'rgba(0,0,0,0)');
                fade.addColorStop(1, 'rgba(0,0,0,0.7)');
                pctx.fillStyle = fade; pctx.fillRect(0, PH - 20, PW, 20);
            };
            img.src = u.portrait;
        } else {
            // Draw unit sprite scaled to fit the slot
            pctx.save();
            pctx.scale(PW / 60, PH / 96);
            switch (u.spriteType || u.type) {
                case 'warrior':       drawWarrior      (pctx, 30, 90, false); break;
                case 'wizard':        drawWizard       (pctx, 30, 90, false); break;
                case 'rogue':         drawRogue        (pctx, 30, 90, false); break;
                case 'goblin':        drawGoblin       (pctx, 30, 90, false); break;
                case 'goblin_archer': drawGoblinArcher (pctx, 30, 90, false); break;
            }
            pctx.restore();
        }

        // Name label
        const nameSpan = document.createElement('span');
        nameSpan.className   = 'init-slot-name';
        nameSpan.style.color = u.team === 'heroes' ? '#70d0ff' : '#ff8080';
        nameSpan.textContent = u.name;

        // Roll
        const rollSpan = document.createElement('span');
        rollSpan.className   = 'init-roll';
        rollSpan.textContent = entry.roll;

        slot.appendChild(cv);
        slot.appendChild(nameSpan);
        slot.appendChild(rollSpan);

        // Hover → tooltip
        slot.addEventListener('mouseenter', e => showUnitTooltip(u, e));
        slot.addEventListener('mousemove',  e => repositionTooltip(e));
        slot.addEventListener('mouseleave',  () => hideTooltip());

        // Click → character sheet for heroes; select unit on map for enemies
        slot.addEventListener('click', () => {
            if (u.team === 'heroes') openCharSheet(u);
            else selectUnit(u.id);
        });

        bar.appendChild(slot);
    }
}

// ── Combat panel ──────────────────────────────────────────────────────────────
// Attack-type icons used on action buttons
const ATK_ICON = { melee: '⚔', ranged: '🏹', spell: '✨' };

function updateCombatPanel() {
    const panel = document.getElementById('combat-panel');
    if (!panel) return;
    const cur = getCurrentUnit();
    if (!cur || cur.team !== 'heroes' || cur.hasActed || COMBAT.animating) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'flex';
    document.getElementById('cp-name').textContent = cur.name;

    // Rebuild one button per attack the hero owns
    const container = document.getElementById('cp-attacks');
    container.innerHTML = '';
    getUnitAttacks(cur).forEach(atk => {
        const key    = Object.keys(ATTACKS).find(k => ATTACKS[k] === atk);
        const active = COMBAT.attackMode && COMBAT.selectedAttack === key;
        const icon   = ATK_ICON[atk.type] || '⚔';
        const btn    = document.createElement('button');
        btn.className = 'cp-btn cp-attack-btn' + (active ? ' active' : '');
        btn.dataset.atk = key;
        btn.textContent = active ? ('✗ ' + atk.name) : (icon + ' ' + atk.name);
        container.appendChild(btn);
    });
}

// ── Hex neighbours (flat-top) ─────────────────────────────────────────────────
function hexNeighbours(col, row) {
    const odd = col & 1;
    return [
        [col-1, row + (odd ? 0:-1)],
        [col-1, row + (odd ? 1: 0)],
        [col,   row - 1],
        [col,   row + 1],
        [col+1, row + (odd ? 0:-1)],
        [col+1, row + (odd ? 1: 0)],
    ].filter(([c,r]) => c>=0 && c<COLS && r>=0 && r<ROWS);
}

// ── Initiative ────────────────────────────────────────────────────────────────
function rollInitiative() {
    COMBAT.initiative = STATE.units
        .filter(u => u.hp > 0)
        .map(u => ({ id: u.id, roll: rollD100() }))
        .sort((a, b) => {
            if (b.roll !== a.roll) return b.roll - a.roll;
            const ua = STATE.units.find(u => u.id === a.id);
            const ub = STATE.units.find(u => u.id === b.id);
            return (ua.team === 'heroes' ? -1 : 1) - (ub.team === 'heroes' ? -1 : 1);
        });
}

// ── Get current unit ──────────────────────────────────────────────────────────
function getCurrentUnit() {
    if (COMBAT.turnIndex < 0 || COMBAT.turnIndex >= COMBAT.initiative.length) return null;
    const id = COMBAT.initiative[COMBAT.turnIndex].id;
    return STATE.units.find(u => u.id === id && u.hp > 0) || null;
}

// ── Advance turn ──────────────────────────────────────────────────────────────
function advanceTurn() {
    if (checkBattleEnd()) return;

    const order = COMBAT.initiative;
    const n     = order.length;
    let   found = false;

    for (let i = 1; i <= n; i++) {
        const idx  = (COMBAT.turnIndex + i) % n;
        const unit = STATE.units.find(u => u.id === order[idx].id && u.hp > 0 && !u.hasActed);
        if (!unit) continue;
        COMBAT.turnIndex = idx;
        STATE.selected   = unit.id;

        if (unit.team === 'heroes') {
            // Auto-select attack mode if enemies are already in range
            const attackable = getAttackableEnemies(unit);
            if (attackable.length > 0) {
                COMBAT.attackMode = true;
                STATE.attackRange = attackable.map(e => [e.col, e.row]);
                STATE.moveRange   = [];
            } else {
                COMBAT.attackMode     = false;
                COMBAT.selectedAttack = null;
                STATE.attackRange     = [];
                STATE.moveRange       = calcMoveRange(unit, UNIT_STATS[unit.type].speed);
            }
            combatLog('─ ' + unit.name + '\'s turn');
        } else {
            COMBAT.attackMode     = false;
            COMBAT.selectedAttack = null;
            STATE.attackRange     = [];
            STATE.moveRange       = [];
        }

        updateInitiativeUI();
        updateCombatPanel();
        redrawAll();
        found = true;

        if (unit.team === 'enemies') {
            COMBAT.animating = true;
            setTimeout(() => { COMBAT.animating = false; doAITurn(unit); }, 900);
        }
        break;
    }

    if (!found) setTimeout(startNewRound, 500);
}

// ── New round ─────────────────────────────────────────────────────────────────
function startNewRound() {
    COMBAT.round++;
    document.getElementById('turn-counter').textContent = COMBAT.round;
    showRoundBanner(COMBAT.round);
    for (const u of STATE.units) {
        if (u.hp > 0) { u.hasActed = false; u.movedHexes = 0; }
    }
    rollInitiative();
    combatLog('══════ Round ' + COMBAT.round + ' ══════');
    COMBAT.turnIndex = -1;
    setTimeout(advanceTurn, 450);
}

// ── End the current unit's turn ───────────────────────────────────────────────
function endUnitTurn() {
    const cur = getCurrentUnit();
    if (cur) cur.hasActed = true;
    COMBAT.attackMode     = false;
    COMBAT.selectedAttack = null;
    STATE.selected        = null;
    STATE.moveRange   = [];
    STATE.attackRange = [];
    updateCombatPanel();
    redrawAll();
    setTimeout(advanceTurn, 300);
}

// ── AI: move towards target ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// TACTICS-DRIVEN AI
//
// Reads AI_TACTICS[unit.type] from data/combat/ai_tactics.js.
// Falls back to a plain charge on unknown monster types.
//
// Design rules:
//   • Melee monsters ALWAYS advance toward the target — cover is a tiebreaker
//     among equally-close hexes, never a reason to move backwards.
//   • Ranged/caster monsters seek a covered hex that still has LOS to the target
//     and is within attack range; they advance only when no such hex is reachable.
//   • All monsters pick the most VULNERABLE target for their attack type:
//       vulnerability = (current HP / max HP) × (0.4 + dodge / 100)
//     Lowest score = juiciest target. Melee then weight by distance on top.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Helpers ───────────────────────────────────────────────────────────────────

function _aiHexFree(c, r, exclude) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
    if (isBlocked(c, r)) return false;
    return !STATE.units.some(u => u.hp > 0 && u.col === c && u.row === r && u !== exclude);
}

function _aiRangedHeroes(heroes) {
    return heroes.filter(h => {
        const a = getUnitAttack(h);
        return a.type === 'ranged' || a.type === 'spell';
    });
}

// How many heroes in `list` have clear LOS to position (c,r)?
// Temporarily moves `unit` there for the check.
function _aiCountExposed(unit, c, r, list) {
    const origC = unit.col, origR = unit.row;
    unit.col = c; unit.row = r;
    let n = 0;
    for (const h of list) if (checkLOS(h, unit) === 'clear') n++;
    unit.col = origC; unit.row = origR;
    return n;
}

// ── Target selection ──────────────────────────────────────────────────────────
// Score every living enemy by how easy they are to kill with THIS attack type.
// Lower score = better target.
//
// vulnerability = (hp / maxHp) × (0.4 + dodge/100)
//   — low HP and low dodge both make a hero fragile
//
// Melee monsters add a distance weight so they prefer the closest fragile hero.
// Ranged/caster monsters ignore distance entirely (they can reach anywhere).

function aiPickTarget(unit, tactics) {
    const atk     = getUnitAttack(unit);
    const enemies = STATE.units.filter(u => u.team !== unit.team && u.hp > 0);
    if (!enemies.length) return null;

    const isMelee = atk.type === 'melee';

    let best = null, bestScore = Infinity;
    for (const e of enemies) {
        const vuln = (e.hp / e.maxHp) * (0.4 + (e.dodge || 0) / 100);
        const dist  = hexDist(unit.col, unit.row, e.col, e.row);
        // Melee: distance matters a lot (wants the closest fragile hero)
        // Ranged/spell: pure vulnerability
        const score = isMelee ? vuln * 0.5 + (dist / 18) * 0.5 : vuln;
        if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
}

// ── Melee movement ────────────────────────────────────────────────────────────
// Steps one hex at a time. Constraint: each step MUST reduce distance to target
// (never sidestep, never retreat). Among advancing hexes, covered ones are
// preferred when seekCover is true.

function aiMeleeMoveTowards(unit, target, steps, tactics) {
    const heroes      = STATE.units.filter(u => u.team === 'heroes' && u.hp > 0);
    const rangedHeros = _aiRangedHeroes(heroes);
    const maxR        = Math.max(1, rangedHeros.length);

    for (let s = 0; s < steps; s++) {
        const curDist = hexDist(unit.col, unit.row, target.col, target.row);
        const nbrs    = hexNeighbours(unit.col, unit.row);

        let best = null, bestScore = Infinity;
        for (const [nc, nr] of nbrs) {
            if (!_aiHexFree(nc, nr, unit)) continue;
            const d = hexDist(nc, nr, target.col, target.row);
            if (d >= curDist) continue;          // must advance — no exceptions

            let score = d;                       // primary: get closer
            if (tactics && tactics.seekCover) {
                // Secondary: among equally-close hexes prefer covered ones.
                // Cover bonus is capped at 0.9 so it can never beat even 1 hex
                // of extra distance.
                const exposed    = _aiCountExposed(unit, nc, nr, rangedHeros);
                const coverBonus = ((maxR - exposed) / maxR) * 0.9;
                score = d - coverBonus * tactics.coverWeight;
            }
            if (score < bestScore) { bestScore = score; best = [nc, nr]; }
        }

        if (!best) break;
        unit.col = best[0]; unit.row = best[1];
        unit.movedHexes = (unit.movedHexes || 0) + 1;
    }
    redrawAll();
}

// ── Ranged / caster movement ──────────────────────────────────────────────────
// Finds the best hex within attack range that has LOS to the target AND gives
// maximum cover from enemy ranged attacks. If no such hex is reachable with the
// monster's speed, it advances one step toward the target instead.

function aiRangedRepositionOrAdvance(unit, target, tactics) {
    const atk         = getUnitAttack(unit);
    const speed       = UNIT_STATS[unit.type].speed;
    const heroes      = STATE.units.filter(u => u.team === 'heroes' && u.hp > 0);
    const rangedHeros = _aiRangedHeroes(heroes);
    const maxR        = Math.max(1, rangedHeros.length);

    // Collect all hexes reachable within speed that are within attack range
    // and have at least partial LOS to target.
    let bestHex = null, bestScore = Infinity;

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (!_aiHexFree(c, r, unit)) continue;
            if (hexDist(unit.col, unit.row, c, r) > speed) continue;
            if (hexDist(c, r, target.col, target.row) > atk.range) continue;

            // Must have at least partial LOS (obstacle-blocked counts as partial)
            const origC = unit.col, origR = unit.row;
            unit.col = c; unit.row = r;
            const los = checkLOS(unit, target);
            unit.col = origC; unit.row = origR;
            if (los === 'clear' || los === 'partial' || los === 'obstacle') {
                // Score: prefer covered hexes (fewer ranged heroes can see us)
                const exposed    = _aiCountExposed(unit, c, r, rangedHeros);
                const coverBonus = (maxR - exposed) / maxR;
                const w          = (tactics && tactics.coverWeight) || 0.5;
                // Also reward being further from melee heroes
                const meleeDist  = Math.min(...heroes.map(h => hexDist(c, r, h.col, h.row)));
                const score      = -w * coverBonus - (1 - w) * (meleeDist / 18);
                if (score < bestScore) { bestScore = score; bestHex = [c, r]; }
            }
        }
    }

    if (bestHex && (bestHex[0] !== unit.col || bestHex[1] !== unit.row)) {
        // Walk toward bestHex one step at a time
        for (let s = 0; s < speed; s++) {
            const [tc, tr] = bestHex;
            if (unit.col === tc && unit.row === tr) break;
            const nbrs = hexNeighbours(unit.col, unit.row);
            let stepBest = null, stepD = Infinity;
            for (const [nc, nr] of nbrs) {
                if (!_aiHexFree(nc, nr, unit)) continue;
                const d = hexDist(nc, nr, tc, tr);
                if (d < stepD) { stepD = d; stepBest = [nc, nr]; }
            }
            if (!stepBest) break;
            unit.col = stepBest[0]; unit.row = stepBest[1];
            unit.movedHexes = (unit.movedHexes || 0) + 1;
        }
        redrawAll();
    } else if (!bestHex) {
        // No covered firing position reachable — just advance toward target
        aiMeleeMoveTowards(unit, target, speed, null);
    }
}

// ── Retreat ───────────────────────────────────────────────────────────────────

function aiRetreat(unit, steps) {
    const heroes = STATE.units.filter(u => u.team === 'heroes' && u.hp > 0);
    for (let s = 0; s < steps; s++) {
        const nbrs = hexNeighbours(unit.col, unit.row);
        let best = null, bestDist = -Infinity;
        for (const [nc, nr] of nbrs) {
            if (!_aiHexFree(nc, nr, unit)) continue;
            const totalDist = heroes.reduce((sum, h) => sum + hexDist(nc, nr, h.col, h.row), 0);
            if (totalDist > bestDist) { bestDist = totalDist; best = [nc, nr]; }
        }
        if (!best) break;
        unit.col = best[0]; unit.row = best[1];
        unit.movedHexes = (unit.movedHexes || 0) + 1;
    }
    redrawAll();
}

// ── Main AI turn ──────────────────────────────────────────────────────────────

function doAITurn(unit) {
    const heroes = STATE.units.filter(u => u.team === 'heroes' && u.hp > 0);
    if (!heroes.length) { endUnitTurn(); return; }

    const tactics  = (window.AI_TACTICS && window.AI_TACTICS[unit.type]) || null;
    const role     = tactics ? tactics.role : 'melee';
    // Primary attack used for movement range planning
    const primaryAtk = getUnitAttacks(unit)[0];

    // ── Retreat when badly hurt ────────────────────────────────────────────────
    if (tactics && tactics.retreatBelowHpPct !== null &&
        unit.hp / unit.maxHp < tactics.retreatBelowHpPct) {
        combatLog(unit.name + ' retreats!');
        aiRetreat(unit, UNIT_STATS[unit.type].speed);
        setTimeout(endUnitTurn, 450);
        return;
    }

    // ── Pick most vulnerable target ────────────────────────────────────────────
    const target = aiPickTarget(unit, tactics);
    if (!target) { endUnitTurn(); return; }

    const dist    = hexDist(unit.col, unit.row, target.col, target.row);
    // Best attack we can use at current distance
    const bestAtk = getBestAttack(unit, dist);

    // ── Already in range → attack immediately ──────────────────────────────────
    if (dist <= bestAtk.range) {
        resolveAttack(unit, target, () => setTimeout(endUnitTurn, 450));
        return;
    }

    // ── ZoC: a hero is adjacent → use best melee/ranged attack we can ──────────
    const inZoC = tactics && tactics.zcOverride &&
        heroes.some(h => hexDist(unit.col, unit.row, h.col, h.row) <= 1);

    if (inZoC) {
        // Find the adjacent hero we can hit with any available attack
        const adjHero = heroes.find(h => {
            const d = hexDist(unit.col, unit.row, h.col, h.row);
            return getBestAttack(unit, d).range >= d;
        });
        if (adjHero) {
            resolveAttack(unit, adjHero, () => setTimeout(endUnitTurn, 450));
        } else {
            setTimeout(endUnitTurn, 450);
        }
        return;
    }

    // ── Move based on role ─────────────────────────────────────────────────────
    const speed = UNIT_STATS[unit.type].speed;

    if (role === 'melee') {
        // Melee: always advance. Cover is a tiebreaker, never overrides closing.
        const steps = Math.min(speed, dist - primaryAtk.range);
        if (steps > 0) aiMeleeMoveTowards(unit, target, steps, tactics);

        const nd = hexDist(unit.col, unit.row, target.col, target.row);
        const atkAfterMove = getBestAttack(unit, nd);
        if (nd <= atkAfterMove.range) {
            setTimeout(() => resolveAttack(unit, target, () => setTimeout(endUnitTurn, 450)), 350);
        } else {
            setTimeout(endUnitTurn, 450);
        }

    } else {
        // Ranged / caster: find a covered hex in primary range with LOS, then attack.
        aiRangedRepositionOrAdvance(unit, target, tactics);
        redrawAll();
        const nd = hexDist(unit.col, unit.row, target.col, target.row);
        const atkAfterMove = getBestAttack(unit, nd);
        if (nd <= atkAfterMove.range) {
            setTimeout(() => resolveAttack(unit, target, () => setTimeout(endUnitTurn, 450)), 350);
        } else {
            setTimeout(endUnitTurn, 450);
        }
    }
}

// ── Resolve an attack ─────────────────────────────────────────────────────────
function resolveAttack(attacker, target, onDone) {
    const dist = hexDist(attacker.col, attacker.row, target.col, target.row);
    // For heroes use the player-selected attack; AI always auto-picks best
    const atk  = (attacker.team === 'heroes' && COMBAT.selectedAttack && ATTACKS[COMBAT.selectedAttack])
        ? ATTACKS[COMBAT.selectedAttack]
        : getBestAttack(attacker, dist);

    if (dist > atk.range) {
        combatLog(attacker.name + ' cannot reach ' + target.name + '!');
        if (onDone) onDone();
        return;
    }

    COMBAT.animating      = true;
    COMBAT.attackMode     = false;
    COMBAT.selectedAttack = null;
    STATE.attackRange     = [];

    const hitRoll = rollD100();

    // Pre-calculate hit chance to know if ranged attack hits (for impact sound)
    let hitChance = atk.hitBase;
    let los = 'clear';

    if (atk.type === 'melee' && (attacker.movedHexes || 0) > 0) {
        hitChance -= attacker.movedHexes * 10;
    }

    if (atk.type !== 'melee') {
        if (inEnemyZoC(attacker)) {
            hitChance -= 20;
        }
        los = checkLOS(attacker, target);
        if (los === 'partial') {
            hitChance = Math.round(hitChance * 0.75);
        } else if (los === 'obstacle') {
            hitChance = Math.round(hitChance * 0.80);
        }
    }
    hitChance = Math.max(5, hitChance - (target.dodge || 0));
    const isMiss = hitRoll > hitChance;

    // Launch visual for ranged / spell attacks
    if (atk.type === 'ranged' || atk.type === 'spell') {
        const fromC  = hexScreenCenter(attacker.col, attacker.row);
        const toC    = hexScreenCenter(target.col,   target.row);
        const fromBy = fromC.sy;
        const toBy   = toC.sy;
        const fh     = atk.type === 'spell' ? 68 : 30;
        startProjectile(atk.type === 'spell' ? 'fireball' : 'arrow',
            fromC.sx, fromBy - fh, toC.sx, toBy - 30);
        if (atk.type === 'ranged' && !isMiss) setTimeout(() => playSound('arrowhit'), 160);
        if (atk.type === 'spell'  && !isMiss) setTimeout(() => playSound('firehit'),  160);
    }
    // Launch swing/stab for melee attacks
    if (atk.type === 'melee') {
        const fromC  = hexScreenCenter(attacker.col, attacker.row);
        const toC    = hexScreenCenter(target.col,   target.row);
        const fromBy = fromC.sy;
        const ang    = Math.atan2(toC.sy - fromC.sy, toC.sx - fromC.sx);
        // Rogue knives → stab; warrior → sword; everything else → claw
        let swingType = 'claw';
        if (attacker.type === 'warrior') swingType = 'sword';
        else if (atk === ATTACKS.rogue_knives) swingType = 'stab';
        startSwing(swingType, fromC.sx, fromBy, ang);
    }

    // Play attack sound at the moment animation starts.
    // Ranged/spell sounds are launch sounds (bow twang, fire whoosh) — play now.
    // Melee sounds start with swing animation (synced at 400ms duration).
    if (atk.type === 'melee') {
        if (!isMiss) playSound(atk.snd);
        else playSound('miss');
    } else {
        playSound(atk.snd);
    }

    updateCombatPanel();
    startDiceAnim(attacker.col, attacker.row, hitRoll, () => {
        // Log hit chance modifiers
        if (atk.type === 'melee' && (attacker.movedHexes || 0) > 0) {
            combatLog('  (moved ' + attacker.movedHexes + ' hex(es): −' + (attacker.movedHexes * 10) + ' hit)');
        }
        if (atk.type !== 'melee' && inEnemyZoC(attacker)) {
            combatLog('  (in ZoC while ranged: −20 hit)');
        }
        if (atk.type !== 'melee' && los === 'partial') {
            combatLog('  (LOS obscured: −25% hit)');
        } else if (atk.type !== 'melee' && los === 'obstacle') {
            combatLog('  (obstacle in the way: −20% hit)');
        }

        const isCrit = !isMiss && hitRoll >= atk.critMin;

        if (isMiss) {
            if (atk.type !== 'melee') playSound('miss');
            combatLog(attacker.name + ' misses ' + target.name +
                ' (rolled ' + hitRoll + ', needed ≤' + hitChance + ')');
            showFloatDmg(target.col, target.row, 0, false, true);
        } else {
            // Impact sounds are scheduled by animation timing, not here
            let dmg = rollDamage(atk.damageDice, atk.damageMod);
            if (isCrit) dmg = Math.round(dmg * 1.5);
            if (los === 'partial') dmg = Math.max(1, Math.round(dmg * (0.60 + Math.random() * 0.25)));
            target.hp = Math.max(0, target.hp - dmg);
            showBloodSplatter(target.col, target.row, isCrit);

            const verb = isCrit ? 'CRITS' : 'hits';
            combatLog(attacker.name + ' ' + verb + ' ' + target.name +
                ' for ' + dmg + ' dmg (rolled ' + hitRoll + ')');
            showFloatDmg(target.col, target.row, dmg, isCrit, false);

            if (target.hp <= 0) combatLog('  ✝ ' + target.name + ' is slain!');
        }

        attacker.hasActed = true;
        COMBAT.animating  = false;
        redrawAll();
        updateInitiativeUI();
        updateCombatPanel();

        if (checkBattleEnd()) return;
        if (onDone) setTimeout(onDone, 750);
    });
}

// ── Combat click handler ──────────────────────────────────────────────────────
function handleCombatClick(col, row) {
    if (COMBAT.animating) return;
    const cur = getCurrentUnit();
    if (!cur || cur.team !== 'heroes' || cur.hasActed) return;

    const clickedUnit = STATE.units.find(u => u.col === col && u.row === row && u.hp > 0);

    if (COMBAT.attackMode) {
        if (clickedUnit && clickedUnit.team === 'enemies') {
            // Guard: the clicked enemy must be within the selected attack's range
            const inRange = STATE.attackRange.some(([ac, ar]) => ac === clickedUnit.col && ar === clickedUnit.row);
            if (!inRange) {
                const atk = COMBAT.selectedAttack ? ATTACKS[COMBAT.selectedAttack] : null;
                showRangeWarning(atk ? RANGE_MSGS[atk.type] : 'Not in range!');
                return; // turn is NOT consumed
            }
            resolveAttack(cur, clickedUnit, endUnitTurn);
        } else {
            // Cancel attack mode → back to remaining movement
            COMBAT.attackMode     = false;
            COMBAT.selectedAttack = null;
            STATE.attackRange     = [];
            const rem = Math.max(0, UNIT_STATS[cur.type].speed - (cur.movedHexes || 0));
            STATE.moveRange = calcMoveRange(cur, rem);
            updateCombatPanel();
            redrawOverlay();
        }
        return;
    }

    // Default attack: clicking any enemy in range triggers the attack for all
    // character types — melee, ranged and spell alike
    if (clickedUnit && clickedUnit.team === 'enemies') {
        const atk = getUnitAttack(cur);
        if (hexDist(cur.col, cur.row, col, row) <= atk.range) {
            resolveAttack(cur, clickedUnit, endUnitTurn);
            return;
        }
    }

    // Click empty hex in move range → move
    if (!clickedUnit && STATE.moveRange.some(([mc,mr]) => mc===col && mr===row)) {
        const oldCol = cur.col, oldRow = cur.row;
        cur.col = col; cur.row = row;
        cur.movedHexes = (cur.movedHexes || 0) + hexDist(oldCol, oldRow, col, row);
        const remaining = Math.max(0, UNIT_STATS[cur.type].speed - cur.movedHexes);
        STATE.moveRange = calcMoveRange(cur, remaining);
        redrawAll();
        updateInitiativeUI();

        // After any move: auto-enter attack mode if enemies are now in range
        const targets = getAttackableEnemies(cur);
        if (targets.length > 0) {
            COMBAT.attackMode = true;
            STATE.attackRange = targets.map(e => [e.col, e.row]);
            STATE.moveRange   = [];
            updateCombatPanel();
            redrawOverlay();
        } else if (remaining === 0) {
            // No movement left and nothing to attack — end turn automatically
            setTimeout(endUnitTurn, 380);
        }
    }
}

// ── Wire up combat panel buttons ──────────────────────────────────────────────
function setupCombatButtons() {
    // Attack buttons are dynamically rebuilt; use event delegation
    document.getElementById('cp-attacks').addEventListener('click', e => {
        if (COMBAT.animating) return;
        const btn = e.target.closest('[data-atk]');
        if (!btn) return;
        const key = btn.dataset.atk;
        const cur = getCurrentUnit();
        if (!cur) return;

        if (COMBAT.attackMode && COMBAT.selectedAttack === key) {
            // Clicking the active button again cancels attack mode
            COMBAT.attackMode     = false;
            COMBAT.selectedAttack = null;
            STATE.attackRange     = [];
            STATE.moveRange       = calcMoveRange(cur, Math.max(0, UNIT_STATS[cur.type].speed - (cur.movedHexes || 0)));
        } else {
            // Activate this attack — check for reachable targets first
            const atk     = ATTACKS[key];
            const enemies = getAttackableEnemies(cur, atk);
            if (enemies.length === 0) {
                showRangeWarning(NO_TARGET_MSGS[atk.type] || 'No enemies in range.');
                return; // stay in current state, turn not wasted
            }
            COMBAT.attackMode     = true;
            COMBAT.selectedAttack = key;
            STATE.attackRange     = enemies.map(en => [en.col, en.row]);
            STATE.moveRange       = [];
        }
        updateCombatPanel();
        redrawOverlay();
    });

    document.getElementById('cp-end-btn').addEventListener('click', () => {
        if (!COMBAT.animating) endUnitTurn();
    });
}

// ── Reset battle ──────────────────────────────────────────────────────────────
function resetBattle() {
    // New seed → fresh terrain and obstacles every rematch
    BATTLE_SEED = Math.floor(Math.random() * 0x7fffffff);
    generateTerrain();
    generateObstacles();
    resizeCanvases();
    renderBackground();

    STATE.units = UNIT_DEFS.map(d => {
        const s = UNIT_STATS[d.type];
        return { ...d, hp: s.maxHp, maxHp: s.maxHp, dodge: s.dodge, hasActed: false, movedHexes: 0 };
    });
    COMBAT.round          = 1;
    COMBAT.turnIndex      = -1;
    COMBAT.attackMode     = false;
    COMBAT.selectedAttack = null;
    COMBAT.animating      = false;
    STATE.selected    = null;
    STATE.moveRange   = [];
    STATE.attackRange = [];
    document.getElementById('turn-counter').textContent = 1;
    rollInitiative();
    combatLog('══════ Battle resets ══════');
    redrawAll();
    setTimeout(advanceTurn, 800);
}

// ── Start combat ──────────────────────────────────────────────────────────────
function startCombat() {
    COMBAT.active = true;
    for (const u of STATE.units) {
        const s = UNIT_STATS[u.type];
        u.hp         = s.maxHp;
        u.maxHp      = s.maxHp;
        u.dodge      = s.dodge;
        u.hasActed   = false;
        u.movedHexes = 0;
    }
    rollInitiative();
    combatLog('══════ Round 1 — Battle begins! ══════');
    COMBAT.turnIndex = -1;
    setTimeout(advanceTurn, 900);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOOD SPLATTER SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

const _bloodAnims = [];

function showBloodSplatter(col, row, isCrit) {
    const { sx: cx, sy: cy } = hexScreenCenter(col, row);
    const by  = cy;
    // Approximate body centre (torso height)
    const hx  = cx, hy = by - 36;

    const pCount  = isCrit ? 24 : 13;
    const gravity = 280;   // px/s² (downward pull on drops)
    const dur     = isCrit ? 1150 : 900;
    const parts   = [];

    // ── Flying drops — burst upward and outward ─────────────────────────────
    for (let i = 0; i < pCount; i++) {
        // Bias heavily upward so drops arch over the character
        const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.55;
        const speed = 45 + Math.random() * (isCrit ? 210 : 125);
        const dark  = Math.random() > 0.55;
        parts.push({
            x0 : hx + (Math.random() - 0.5) * 12,
            y0 : hy + (Math.random() - 0.5) * 12,
            vx : Math.cos(angle) * speed,
            vy : Math.sin(angle) * speed,
            r  : dark ? 95  + Math.floor(Math.random() * 45)
                       : 185 + Math.floor(Math.random() * 55),
            g  : Math.floor(Math.random() * 14),
            b  : Math.floor(Math.random() * 8),
            sz : 1.3 + Math.random() * (isCrit ? 4.0 : 2.6),
            fadeAt : 0.50 + Math.random() * 0.32,
            static : false,
        });
    }

    // ── Small static splatter dots near the hit point ───────────────────────
    const dotCount = isCrit ? 10 : 5;
    for (let i = 0; i < dotCount; i++) {
        parts.push({
            x0 : hx + (Math.random() - 0.5) * 30,
            y0 : hy + (Math.random() - 0.5) * 24,
            vx : 0, vy: 0,
            r  : 75 + Math.floor(Math.random() * 65),
            g  : 0, b: 0,
            sz : 0.7 + Math.random() * 2.0,
            fadeAt : 0.62 + Math.random() * 0.25,
            static : true,
        });
    }

    _bloodAnims.push({ hx, hy, parts, gravity, start: performance.now(), dur, done: false });
}

function _drawBlood(ctx, now) {
    for (const b of _bloodAnims) {
        if (b.done) continue;
        const bt = (now - b.start) / b.dur;   // 0-1 over full duration
        if (bt >= 1) { b.done = true; continue; }
        const t  = (now - b.start) / 1000;    // seconds elapsed (for physics)

        // ── Impact flash — brief red pulse at hit point ─────────────────────
        if (bt < 0.20) {
            const fa = (1 - bt / 0.20) * 0.52;
            ctx.save();
            ctx.globalAlpha = fa;
            ctx.shadowColor = '#cc0000';
            ctx.shadowBlur  = 24;
            ctx.fillStyle   = 'rgba(190,0,0,0.42)';
            ctx.beginPath();
            ctx.ellipse(b.hx, b.hy, 24, 32, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // ── Particles ───────────────────────────────────────────────────────
        for (const p of b.parts) {
            const alpha = bt < p.fadeAt
                ? 1.0
                : 1.0 - (bt - p.fadeAt) / (1 - p.fadeAt);
            if (alpha <= 0.01) continue;

            // Kinematic position: x = x0 + vx·t,  y = y0 + vy·t + ½g·t²
            const px = p.x0 + p.vx * t;
            const py = p.y0 + p.vy * t + 0.5 * b.gravity * t * t;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = `rgb(${p.r},${p.g},${p.b})`;

            if (!p.static) {
                // Elongate drop in its current direction of travel
                const curVy  = p.vy + b.gravity * t;
                const angle  = Math.atan2(curVy, p.vx);
                const speed  = Math.hypot(p.vx, curVy);
                const stretch = Math.max(1.0, 1 + speed * 0.010);
                ctx.translate(px, py);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.ellipse(0, 0, p.sz * stretch, p.sz * 0.58, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Round splatter dot
                ctx.beginPath();
                ctx.arc(px, py, p.sz, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MELEE SWING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

const SWING = {
    active: false,
    type  : null,   // 'sword' | 'claw' | 'stab'
    x: 0, y: 0,    // screen anchor (attacker centre, torso height)
    angle: 0,       // direction toward target
    start: 0,
    dur  : 510,
};

function startSwing(type, cx, by, angle) {
    SWING.active = true;
    SWING.type   = type;
    // Offset anchor a bit toward target so the effect appears between units
    SWING.x      = cx + Math.cos(angle) * 14;
    SWING.y      = (by - 38) + Math.sin(angle) * 8;
    SWING.angle  = angle;
    SWING.start  = performance.now();
    SWING.dur    = 400;  // Match sword sound duration
}

function drawSwing(ctx) {
    if (!SWING.active) return;
    const t = Math.min(1, (performance.now() - SWING.start) / SWING.dur);
    if (t >= 1) { SWING.active = false; return; }
    if (SWING.type === 'sword') _drawSwordSwing(ctx, t);
    if (SWING.type === 'claw')  _drawClawSwing(ctx, t);
    if (SWING.type === 'stab')  _drawStab(ctx, t);
}

// ── Sword arc ─────────────────────────────────────────────────────────────────
function _drawSwordSwing(ctx, t) {
    const { x, y, angle } = SWING;

    // Banana curve: quadratic bezier from tail to tip, bulging outward
    // Sweep spans ±70° around the attack direction (wider than before)
    const half    = Math.PI * 0.70;
    const aStart  = angle - half;
    const aEnd    = angle + half;
    const r       = 36;   // blade reach

    // Phase 0–0.55: sweep tip forward; 0.55–1.0: fade out
    const sweepT  = Math.min(1, t / 0.55);
    const fadeA   = t > 0.55 ? 1.0 - (t - 0.55) / 0.45 : 1.0;
    if (sweepT < 0.02) return;

    // Current leading tip angle
    const tipAngle = aStart + (aEnd - aStart) * sweepT;

    // Tail stays at aStart; the control point bows out perpendicular to the
    // midpoint direction by "bulge" pixels — this is what makes it banana-shaped
    const tailX = x + Math.cos(aStart) * r;
    const tailY = y + Math.sin(aStart) * r;
    const tipX  = x + Math.cos(tipAngle) * r;
    const tipY  = y + Math.sin(tipAngle) * r;
    const midA  = (aStart + tipAngle) * 0.5;
    const bulge = r * 0.75;   // how far the banana bows outward
    const ctrlX = x + Math.cos(midA) * (r + bulge);
    const ctrlY = y + Math.sin(midA) * (r + bulge);

    function bananaPath() {
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
    }

    ctx.save();
    ctx.globalAlpha = fadeA;
    ctx.lineCap = 'round';

    // ── Wide outer glow ───────────────────────────────────────────────────────
    ctx.shadowColor = '#c8e8ff';
    ctx.shadowBlur  = 20;
    ctx.strokeStyle = 'rgba(160,210,255,0.32)';
    ctx.lineWidth   = 22;
    bananaPath(); ctx.stroke();

    // ── Mid glow ──────────────────────────────────────────────────────────────
    ctx.shadowBlur  = 10;
    ctx.strokeStyle = 'rgba(220,238,255,0.68)';
    ctx.lineWidth   = 8;
    bananaPath(); ctx.stroke();

    // ── Bright blade core ──────────────────────────────────────────────────────
    ctx.shadowBlur  = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2.5;
    bananaPath(); ctx.stroke();

    // ── Blade-tip glint ────────────────────────────────────────────────────────
    const glint = Math.min(1, sweepT * 3) * (t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35);
    ctx.globalAlpha = fadeA * glint;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(tipX, tipY, 3.8, 0, Math.PI * 2);
    ctx.fill();

    // 4-point star flare at tip
    ctx.strokeStyle = '#ffffd8';
    ctx.lineWidth   = 1.3;
    ctx.shadowBlur  = 6;
    for (let i = 0; i < 4; i++) {
        const fa  = (i / 4) * Math.PI;
        const len = i % 2 === 0 ? 10 : 6;
        ctx.beginPath();
        ctx.moveTo(tipX + Math.cos(fa) * 2.5, tipY + Math.sin(fa) * 2.5);
        ctx.lineTo(tipX + Math.cos(fa) * len,  tipY + Math.sin(fa) * len);
        ctx.stroke();
    }

    // ── Ghost trail (earlier banana position, 20% behind) ─────────────────────
    if (sweepT > 0.20) {
        const trailT     = Math.max(0, sweepT - 0.20);
        const trailAngle = aStart + (aEnd - aStart) * trailT;
        const trailTipX  = x + Math.cos(trailAngle) * r;
        const trailTipY  = y + Math.sin(trailAngle) * r;
        const trailCtrlX = x + Math.cos(midA) * (r + bulge * 0.85);
        const trailCtrlY = y + Math.sin(midA) * (r + bulge * 0.85);
        ctx.globalAlpha = fadeA * 0.20;
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = 'rgba(200,230,255,0.80)';
        ctx.lineWidth   = 5;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.quadraticCurveTo(trailCtrlX, trailCtrlY, trailTipX, trailTipY);
        ctx.stroke();
    }

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1.0;
    ctx.restore();
}

// ── Claw scratches ─────────────────────────────────────────────────────────────
function _drawClawSwing(ctx, t) {
    const { x, y, angle } = SWING;

    // 3 claw marks fanning out around the attack direction
    const marks = [
        { delay: 0.00, spread: -0.32 },
        { delay: 0.08, spread:  0.00 },
        { delay: 0.16, spread: +0.32 },
    ];

    const globalFade = t > 0.60 ? 1.0 - (t - 0.60) / 0.40 : 1.0;

    ctx.save();

    for (const m of marks) {
        const mt = Math.max(0, Math.min(1, (t - m.delay) / 0.46));
        if (mt <= 0) continue;

        const ca  = angle + m.spread;
        // Curve bends perpendicular to slash direction (right-of-direction)
        const perp = ca - Math.PI * 0.5;

        // Start near the attacker, end extends outward as mt grows
        const sx  = x + Math.cos(ca) * 6;
        const sy  = y + Math.sin(ca) * 6;
        const len = 32 * mt;
        const ex  = sx + Math.cos(ca) * len;
        const ey  = sy + Math.sin(ca) * len;
        // Control point curves the scratch like a sweeping claw
        const cpx = (sx + ex) * 0.5 + Math.cos(perp) * 10;
        const cpy = (sy + ey) * 0.5 + Math.sin(perp) * 10;

        ctx.save();
        ctx.globalAlpha = globalFade;

        // Outer dark-red glow
        ctx.shadowColor = '#cc2200';
        ctx.shadowBlur  = 10;
        ctx.strokeStyle = 'rgba(180,20,0,0.50)';
        ctx.lineWidth   = 6;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cpx, cpy, ex, ey);
        ctx.stroke();

        // Main claw mark (near-black with dark purple tint)
        ctx.shadowBlur  = 3;
        ctx.strokeStyle = '#180008';
        ctx.lineWidth   = 3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cpx, cpy, ex, ey);
        ctx.stroke();

        // Inner hot-red gleam along the scratch
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = 'rgba(255,50,10,0.65)';
        ctx.lineWidth   = 1.2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cpx, cpy, ex, ey);
        ctx.stroke();

        // Sharp tip spark at the leading end of each scratch
        if (mt > 0.6) {
            const sparkA = (mt - 0.6) / 0.4 * (t < 0.65 ? 1 : globalFade);
            ctx.globalAlpha = globalFade * sparkA;
            ctx.shadowColor = '#ff6020';
            ctx.shadowBlur  = 8;
            ctx.fillStyle   = '#ff8040';
            ctx.beginPath();
            ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1.0;
    ctx.restore();
}

// ── Steel Knife stab ──────────────────────────────────────────────────────────
// A quick forward thrust: two blades lunge forward and snap back.
// Duration = 255 ms (same as sword). Phase 0-0.45: lunge out; 0.45-1.0: retract.
function _drawStab(ctx, t) {
    const { x, y, angle } = SWING;

    // Two knives offset slightly perpendicular to the thrust direction
    const perp   = angle + Math.PI * 0.5;
    const blades = [
        { off: -5,  delay: 0.00 },
        { off: +5,  delay: 0.06 },
    ];

    // Lunge distance: 0→peak at t=0.45, then snap back
    const reach = t <= 0.45
        ? 36 * (t / 0.45)
        : 36 * (1 - (t - 0.45) / 0.55);
    const fadeA = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1.0;

    ctx.save();
    ctx.lineCap = 'round';

    for (const b of blades) {
        const bx0 = x + Math.cos(perp) * b.off;
        const by0 = y + Math.sin(perp) * b.off;
        // Blade tip: lunge forward in attack direction
        const bladeT = Math.max(0, t - b.delay);
        const lunge  = bladeT <= 0.45
            ? 36 * Math.min(1, bladeT / 0.45)
            : 36 * (1 - Math.min(1, (bladeT - 0.45) / 0.55));
        const bx1 = bx0 + Math.cos(angle) * lunge;
        const by1 = by0 + Math.sin(angle) * lunge;

        ctx.globalAlpha = fadeA;

        // ── Outer steel glow ──────────────────────────────────────────────────
        ctx.shadowColor = '#d0e8ff';
        ctx.shadowBlur  = 12;
        ctx.strokeStyle = 'rgba(180,210,255,0.40)';
        ctx.lineWidth   = 7;
        ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(bx1, by1); ctx.stroke();

        // ── Blade body ────────────────────────────────────────────────────────
        ctx.shadowBlur  = 4;
        ctx.strokeStyle = '#c8d8e8';
        ctx.lineWidth   = 2.8;
        ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(bx1, by1); ctx.stroke();

        // ── Sharp bright edge ─────────────────────────────────────────────────
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 1.0;
        ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(bx1, by1); ctx.stroke();

        // ── Glint at tip on lunge peak ────────────────────────────────────────
        const peakGlint = 1 - Math.abs(bladeT - 0.45) / 0.45;
        if (peakGlint > 0.1) {
            ctx.globalAlpha = fadeA * peakGlint;
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur  = 10;
            ctx.fillStyle   = '#ffffff';
            ctx.beginPath(); ctx.arc(bx1, by1, 2.8, 0, Math.PI * 2); ctx.fill();
            // Small cross flare
            ctx.strokeStyle = '#ffffc0';
            ctx.lineWidth   = 1.0;
            ctx.shadowBlur  = 4;
            for (const fa of [0, Math.PI * 0.5]) {
                ctx.beginPath();
                ctx.moveTo(bx1 + Math.cos(fa) * 1.5, by1 + Math.sin(fa) * 1.5);
                ctx.lineTo(bx1 + Math.cos(fa) * 7,   by1 + Math.sin(fa) * 7);
                ctx.stroke();
            }
        }
    }

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1.0;
    ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECTILE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

const PROJ = {
    active: false,
    type  : null,   // 'arrow' | 'fireball'
    fromX : 0, fromY: 0,
    toX   : 0, toY  : 0,
    start : 0,
    dur   : 460,
    // cached direction unit vector, set on start
    nx    : 0, ny   : 0,
    angle : 0,
};

function startProjectile(type, fx, fy, tx, ty) {
    const dx = tx - fx, dy = ty - fy;
    const len = Math.hypot(dx, dy) || 1;
    PROJ.active = true;
    PROJ.type   = type;
    PROJ.fromX  = fx;  PROJ.fromY = fy;
    PROJ.toX    = tx;  PROJ.toY   = ty;
    PROJ.start  = performance.now();
    // Both arrive at ~510 ms so the projectile hits just as the dice freezes (520 ms),
    // with the impact callback firing 5 ms later.
    PROJ.dur    = 510;
    PROJ.nx     = dx / len;
    PROJ.ny     = dy / len;
    PROJ.angle  = Math.atan2(dy, dx);
}

function drawProjectile(ctx) {
    if (!PROJ.active) return;
    const t = Math.min(1, (performance.now() - PROJ.start) / PROJ.dur);
    if (t >= 1) { PROJ.active = false; return; }

    // Ease-out: fast launch, gentle arrival
    const et = 1 - Math.pow(1 - t, 1.6);
    const x  = PROJ.fromX + (PROJ.toX - PROJ.fromX) * et;
    const y  = PROJ.fromY + (PROJ.toY - PROJ.fromY) * et;

    if (PROJ.type === 'arrow')    _drawArrow(ctx, x, y, t);
    if (PROJ.type === 'fireball') _drawFireball(ctx, x, y, t);
}

// ── Arrow ─────────────────────────────────────────────────────────────────────
function _drawArrow(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(PROJ.angle);

    // Motion-blur ghost copies trailing behind
    for (let i = 3; i >= 1; i--) {
        ctx.globalAlpha = 0.07 * i;
        ctx.strokeStyle = '#c09040';
        ctx.lineWidth   = 1.8;
        ctx.beginPath();
        ctx.moveTo(-16 - i * 7, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Shaft
    ctx.strokeStyle = '#7a5010';
    ctx.lineWidth   = 2.2;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(8, 0);
    ctx.stroke();

    // Shaft highlight
    ctx.strokeStyle = 'rgba(210,160,70,0.50)';
    ctx.lineWidth   = 0.9;
    ctx.beginPath();
    ctx.moveTo(-17, -0.7);
    ctx.lineTo(7, -0.7);
    ctx.stroke();

    // Arrowhead (steel)
    ctx.fillStyle = '#c8d4e0';
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(7, -3.2);
    ctx.lineTo(7,  3.2);
    ctx.closePath();
    ctx.fill();
    // highlight facet
    ctx.fillStyle = '#eef4ff';
    ctx.beginPath();
    ctx.moveTo(14, -0.4);
    ctx.lineTo(8, -2.8);
    ctx.lineTo(8, -0.4);
    ctx.closePath();
    ctx.fill();

    // Fletching — two pairs of vanes
    const vaneData = [
        { ox: -15, col: '#c02010' },
        { ox: -10, col: '#f0f0ec' },
    ];
    for (const v of vaneData) {
        ctx.fillStyle = v.col;
        ctx.beginPath();
        ctx.moveTo(v.ox,     0);
        ctx.lineTo(v.ox + 5, -5);
        ctx.lineTo(v.ox + 8,  0);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(v.ox,     0);
        ctx.lineTo(v.ox + 5,  5);
        ctx.lineTo(v.ox + 8,  0);
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

// ── Fireball ──────────────────────────────────────────────────────────────────
function _drawFireball(ctx, x, y, t) {
    const pulse = 1 + Math.sin(t * Math.PI * 9) * 0.10;
    const r     = 11 * pulse;

    // ── Ground glow — light cast on terrain below the fireball ───────────────
    // Offset down to approximate isometric ground plane
    const gx = x, gy = y + 20;
    const gw = 26 + t * 10, gh = 9 + t * 3;
    const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gw);
    gg.addColorStop(0,   'rgba(255,150,30,0.55)');
    gg.addColorStop(0.40,'rgba(255,80,0,0.25)');
    gg.addColorStop(0.75,'rgba(200,40,0,0.10)');
    gg.addColorStop(1,   'rgba(150,20,0,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.ellipse(gx, gy, gw, gh, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Smoke / ember trail ───────────────────────────────────────────────────
    for (let i = 5; i >= 1; i--) {
        const tr  = i / 6;
        const px  = x - PROJ.nx * i * 8;
        const py  = y - PROJ.ny * i * 8;
        const pr  = r * (1 - tr * 0.60);
        ctx.globalAlpha = (1 - tr) * 0.55;

        const pg = ctx.createRadialGradient(px, py, 0, px, py, pr);
        pg.addColorStop(0,  '#ffcc30');
        pg.addColorStop(0.4,'#ff4400');
        pg.addColorStop(1,  'rgba(160,20,0,0)');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();

        // Trailing ground glow for each ember
        const tgg = ctx.createRadialGradient(px, py+16, 0, px, py+16, pr * 1.6);
        tgg.addColorStop(0, 'rgba(255,100,0,0.20)');
        tgg.addColorStop(1, 'rgba(200,40,0,0)');
        ctx.fillStyle = tgg;
        ctx.beginPath();
        ctx.ellipse(px, py + 16, pr * 1.6, pr * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // ── Outer glow halo ───────────────────────────────────────────────────────
    ctx.shadowColor = '#ff5500';
    ctx.shadowBlur  = 24;
    const og = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
    og.addColorStop(0,    'rgba(255,230,80,0.70)');
    og.addColorStop(0.30, 'rgba(255,100,0,0.45)');
    og.addColorStop(0.65, 'rgba(200,40,0,0.15)');
    og.addColorStop(1,    'rgba(140,15,0,0)');
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
    ctx.fill();

    // ── Main fireball body ────────────────────────────────────────────────────
    const fg = ctx.createRadialGradient(x - r * 0.28, y - r * 0.28, 0, x, y, r);
    fg.addColorStop(0,    '#ffffff');
    fg.addColorStop(0.20, '#ffee50');
    fg.addColorStop(0.55, '#ff6600');
    fg.addColorStop(1,    'rgba(180,20,0,0.65)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── Hot white core ────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.beginPath();
    ctx.arc(x - r * 0.22, y - r * 0.22, r * 0.30, 0, Math.PI * 2);
    ctx.fill();

    // ── Wispy outer edge sparks ───────────────────────────────────────────────
    for (let s = 0; s < 5; s++) {
        const sa  = (s / 5) * Math.PI * 2 + t * 6;
        const sr  = r * (1.0 + Math.sin(t * 14 + s) * 0.22);
        const sx  = x + Math.cos(sa) * sr;
        const sy  = y + Math.sin(sa) * sr * 0.75;
        ctx.fillStyle = s % 2 === 0 ? 'rgba(255,200,40,0.65)' : 'rgba(255,80,0,0.50)';
        ctx.beginPath();
        ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
        ctx.fill();
    }
}

})();
