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

// Lighting state — drives sky, terrain tint, shadow direction, ambient overlays.
// In 'night' mode the bonfire obstacle at CAMPFIRE is the primary light source;
// shadows radiate outward from it and terrain/atmosphere go dark.
const LIGHTING = {
    mode    : 'day',       // 'day' | 'night'
    fireX   : 0,           // screen-x of the campfire (set when obstacles are generated)
    fireY   : 0,           // screen-y of the campfire
    fireRadius: 240,       // pixel radius of usable firelight
};

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

// ── Placeholder hero factory functions ───────────────────────────────────────
// Each rolls morality and one choice-skill from real class data (classes.json).
// _charData is display-only; combat stats come from UNIT_STATS per type.

function _rnd(n)   { return Math.floor(Math.random() * n); }
function _pick(a)  { return a[_rnd(a.length)]; }
function _apt(base, spread) { return base + _rnd(spread); }

function makeWarriorDef() {
    const morality = 45 + _rnd(26);
    const charData = {
        cls: 'ironguard', race: _pick(['midlander','northerner','stone_folk','wildmen_ravagers']),
        name: 'Warrior', level: 1, morality,
        age: 25 + _rnd(16),
        skills: ['shield_fighting', 'blunt_force', _pick(['swordsmanship','polearms','axewielding','athletics'])],
        aptitudes: { physiology: _apt(47,6), martial_experience: _apt(42,6), conviction: _apt(28,8), discipline: _apt(24,7), cognition: _apt(20,7) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'warrior', name:'Warrior', type:'warrior', spriteType:'warrior', team:'heroes', col:2, row:13, _charData: charData };
}

function makeWizardDef() {
    const morality = 40 + _rnd(26);
    const charData = {
        cls: 'elementalist', race: _pick(['archons_secluded','archons_greys','oakpeople','ashen_halfbreeds']),
        name: 'Wizard', level: 1, morality,
        age: 35 + _rnd(21),
        skills: ['materium_channeling', 'arcane_theory', _pick(['inscription','alchemy','monster_lore','stealth'])],
        aptitudes: { cognition: _apt(47,6), discipline: _apt(37,6), conviction: _apt(26,8), physiology: _apt(18,7), martial_experience: _apt(14,7) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'wizard', name:'Wizard', type:'wizard', spriteType:'wizard', team:'heroes', col:5, row:14, _charData: charData };
}

function makeRogueDef() {
    const morality = 25 + _rnd(36);
    const charData = {
        cls: 'shadowblade', race: _pick(['archons_dark_ones','step_folk','ashen_halfbreeds','midlander']),
        name: 'Rogue', level: 1, morality,
        age: 20 + _rnd(16),
        skills: ['small_arms', 'stealth', 'shadow_weaving', _pick(['thievery','lockpicking','acrobatics','swordsmanship'])],
        aptitudes: { martial_experience: _apt(45,6), cognition: _apt(40,6), discipline: _apt(30,8), physiology: _apt(24,7), conviction: _apt(16,7) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'rogue', name:'Rogue', type:'rogue', spriteType:'rogue', team:'heroes', col:8, row:13, _charData: charData };
}

// Default placeholder hero team
const DEFAULT_HERO_DEFS = [makeWarriorDef(), makeWizardDef(), makeRogueDef()];

function makeClericDef() {
    const morality = 66 + _rnd(20);
    const charData = {
        cls: 'warden', race: _pick(['archons_greys','ice_archons','northerner','midlander']),
        name: 'Cleric', level: 1, morality,
        age: 28 + _rnd(18),
        skills: ['lightwielding', 'leadership', _pick(['swordsmanship','shield_fighting','blunt_force','intimidation'])],
        aptitudes: { conviction: _apt(49,6), physiology: _apt(40,6), discipline: _apt(31,7), cognition: _apt(26,7), martial_experience: _apt(28,7) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'cleric', name:'Cleric', type:'cleric', spriteType:'cleric', team:'heroes', col:2, row:13, _charData: charData };
}

function makeRangerDef() {
    const morality = 38 + _rnd(28);
    const charData = {
        cls: 'hunter', race: _pick(['northerner','step_folk','wildmen_foresters','midlander']),
        name: 'Ranger', level: 1, morality,
        age: 20 + _rnd(16),
        skills: ['archery', 'survival', 'tracking', _pick(['beast_handling','stealth','athletics','navigation'])],
        aptitudes: { martial_experience: _apt(46,6), cognition: _apt(40,6), discipline: _apt(30,7), physiology: _apt(28,7), conviction: _apt(22,7) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'ranger', name:'Ranger', type:'ranger', spriteType:'ranger', team:'heroes', col:5, row:14, _charData: charData };
}

function makeWarlockDef() {
    const morality = 15 + _rnd(36);
    const c1 = _pick(['monster_lore','deception','intimidation','stealth','thievery']);
    const c2 = _pick(['monster_lore','deception','intimidation','stealth','thievery'].filter(s => s !== c1));
    const charData = {
        cls: 'voidweaver', race: _pick(['archons_dark_ones','swampbrood','ashen_halfbreeds']),
        name: 'Warlock', level: 1, morality,
        age: 25 + _rnd(21),
        skills: ['shadow_weaving', 'arcane_theory', c1, c2],
        aptitudes: { cognition: _apt(46,6), discipline: _apt(32,7), physiology: _apt(19,7), martial_experience: _apt(16,7), conviction: _apt(13,6) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'warlock', name:'Warlock', type:'warlock', spriteType:'warlock', team:'heroes', col:8, row:13, _charData: charData };
}

// Placeholder team 2: holy order
const TEAM_HOLY_DEFS = [makeClericDef(), makeRangerDef(), makeWarlockDef()];

function makeSorcererDef() {
    const morality = 45 + _rnd(26);
    const charData = {
        cls: 'pyrecrafter', race: _pick(['midlander','step_folk','archons_dark_ones']),
        name: 'Sorcerer', level: 1, morality,
        age: 25 + _rnd(16),
        skills: ['materium_channeling', 'arcane_theory', _pick(['alchemy','herbalism','survival','monster_lore'])],
        aptitudes: { cognition: _apt(47,6), discipline: _apt(38,6), conviction: _apt(24,7), physiology: _apt(20,7), martial_experience: _apt(16,6) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'sorcerer', name:'Sorcerer', type:'sorcerer', spriteType:'sorcerer', team:'heroes', col:2, row:13, _charData: charData };
}

function makeNecromancerDef() {
    const morality = 10 + _rnd(26);
    const charData = {
        cls: 'gravecaller', race: _pick(['swampbrood','archons_dark_ones','midlander']),
        name: 'Necromancer', level: 1, morality,
        age: 30 + _rnd(26),
        skills: ['shadow_weaving', 'summoning', _pick(['arcane_theory','monster_lore','ritualcraft','deception'])],
        aptitudes: { cognition: _apt(48,6), discipline: _apt(36,6), physiology: _apt(18,6), martial_experience: _apt(14,6), conviction: _apt(10,6) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'necromancer', name:'Necromancer', type:'necromancer', spriteType:'necromancer', team:'heroes', col:5, row:14, _charData: charData };
}

function makeWitchDef() {
    const morality = 20 + _rnd(36);
    const charData = {
        cls: 'blightweaver', race: _pick(['wildmen_foresters','swampbrood','midlander']),
        name: 'Witch', level: 1, morality,
        age: 25 + _rnd(21),
        skills: ['shadow_weaving', 'herbalism', _pick(['alchemy','survival','ritualcraft','monster_lore'])],
        aptitudes: { cognition: _apt(45,6), physiology: _apt(36,6), discipline: _apt(30,7), conviction: _apt(20,7), martial_experience: _apt(16,6) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'witch', name:'Witch', type:'witch', spriteType:'witch', team:'heroes', col:8, row:13, _charData: charData };
}

// Placeholder team 3: dark casters
const TEAM_DARK_DEFS = [makeSorcererDef(), makeNecromancerDef(), makeWitchDef()];

function makeLifewhispererDef() {
    const morality = 48 + _rnd(23);
    const choices = ['alchemy','animal_handling','survival','arcane_theory','tracking'];
    const c1 = _pick(choices); const c2 = _pick(choices.filter(s => s !== c1));
    const charData = {
        cls: 'lifewhisperer', race: _pick(['archons_secluded','wildmen_foresters','oakpeople']),
        name: 'Lifewhisperer', level: 1, morality,
        age: 22 + _rnd(19),
        skills: ['materium_channeling', 'herbalism', c1, c2],
        aptitudes: { conviction: _apt(46,6), cognition: _apt(38,6), discipline: _apt(30,7), physiology: _apt(24,7), martial_experience: _apt(16,6) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'lifewhisperer', name:'Lifewhisperer', type:'lifewhisperer', spriteType:'lifewhisperer', team:'heroes', col:2, row:13, _charData: charData };
}

function makeAquoristDef() {
    const morality = 45 + _rnd(26);
    const charData = {
        cls: 'aquorist', race: _pick(['midlander','step_folk','archons_secluded']),
        name: 'Aquorist', level: 1, morality,
        age: 22 + _rnd(19),
        skills: ['materium_channeling', 'flow_control', _pick(['arcane_theory','survival','navigation','monster_lore'])],
        aptitudes: { cognition: _apt(47,6), discipline: _apt(38,6), conviction: _apt(27,7), physiology: _apt(20,7), martial_experience: _apt(15,6) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'aquorist', name:'Aquorist', type:'aquorist', spriteType:'aquorist', team:'heroes', col:5, row:14, _charData: charData };
}

function makeShamanDef() {
    const morality = 40 + _rnd(26);
    const charData = {
        cls: 'shaman', race: _pick(['northerner','stone_folk','wildmen_foresters']),
        name: 'Shaman', level: 1, morality,
        age: 25 + _rnd(21),
        skills: ['materium_channeling', 'ritualcraft', _pick(['monster_lore','beast_handling','herbalism','animal_handling'])],
        aptitudes: { conviction: _apt(46,6), cognition: _apt(38,6), discipline: _apt(28,7), physiology: _apt(26,7), martial_experience: _apt(18,6) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'shaman', name:'Shaman', type:'shaman', spriteType:'shaman', team:'heroes', col:8, row:13, _charData: charData };
}

// Placeholder team 4: nature's triad (Cold · Nature · Spirit)
const TEAM_NATURE_DEFS = [makeLifewhispererDef(), makeAquoristDef(), makeShamanDef()];

function makeStormcallerDef() {
    const morality = 45 + _rnd(26);
    const charData = {
        cls: 'stormcaller', race: _pick(['ice_archons','archons_greys','midlander']),
        name: 'Stormcaller', level: 1, morality,
        age: 25 + _rnd(16),
        skills: ['materium_channeling', 'arcane_theory', _pick(['navigation','survival','monster_lore','acrobatics'])],
        aptitudes: { cognition: _apt(48,6), discipline: _apt(37,6), conviction: _apt(25,7), physiology: _apt(20,7), martial_experience: _apt(16,6) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'stormcaller', name:'Stormcaller', type:'stormcaller', spriteType:'stormcaller', team:'heroes', col:2, row:13, _charData: charData };
}

function makeBloodsingerDef() {
    const morality = 15 + _rnd(36);
    const charData = {
        cls: 'bloodsinger', race: _pick(['archons_dark_ones','wildmen_ravagers','midlander']),
        name: 'Bloodsinger', level: 1, morality,
        age: 22 + _rnd(17),
        skills: ['shadow_weaving', 'athletics', _pick(['alchemy','herbalism','intimidation','small_arms'])],
        aptitudes: { cognition: _apt(45,6), physiology: _apt(38,6), discipline: _apt(31,7), martial_experience: _apt(26,7), conviction: _apt(12,6) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'bloodsinger', name:'Bloodsinger', type:'bloodsinger', spriteType:'bloodsinger', team:'heroes', col:5, row:14, _charData: charData };
}

function makeBeastcallerDef() {
    const morality = 48 + _rnd(23);
    const charData = {
        cls: 'beastcaller', race: _pick(['wildmen_foresters','oakpeople','northerner']),
        name: 'Beastcaller', level: 1, morality,
        age: 20 + _rnd(19),
        skills: ['materium_channeling', 'beastcraft', _pick(['animal_handling','tracking','survival','herbalism'])],
        aptitudes: { conviction: _apt(46,6), cognition: _apt(40,6), physiology: _apt(28,7), discipline: _apt(26,7), martial_experience: _apt(20,6) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'beastcaller', name:'Beastcaller', type:'beastcaller', spriteType:'beastcaller', team:'heroes', col:8, row:13, _charData: charData };
}

// Placeholder team 5: storm & blood (Lightning · Bleed · Water)
const TEAM_STORM_DEFS = [makeStormcallerDef(), makeBloodsingerDef(), makeBeastcallerDef()];

// Placeholder team 6: new classes (Dark Templar · Priest · Rascal)
function makeDarkTemplarDef() {
    const morality = 5 + _rnd(21); // [5, 25] — always Despair
    const charData = {
        cls: 'dark_templar', race: _pick(['northerner','wildmen_ravagers','midlander']),
        name: 'Dark Templar', level: 1, morality,
        age: 30 + _rnd(20),
        skills: ['swordsmanship', 'shadow_weaving', 'intimidation', _pick(['athletics','survival','deception','monster_lore'])],
        aptitudes: { physiology: _apt(47,6), martial_experience: _apt(45,6), discipline: _apt(28,7), conviction: _apt(21,7), cognition: _apt(33,7) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'dark_templar', name:'Dark Templar', type:'dark_templar', spriteType:'dark_templar', team:'heroes', col:2, row:13, _charData: charData };
}

function makePriestDef() {
    const morality = 55 + _rnd(34);
    const charData = {
        cls: 'priest', race: _pick(['midlander','archons_greys','northerner']),
        name: 'Priest', level: 1, morality,
        age: 25 + _rnd(26),
        skills: ['lightwielding', 'herbalism', 'persuasion', _pick(['healing','leadership','ritualcraft','monster_lore'])].filter((v,i,a) => a.indexOf(v) === i),
        aptitudes: { conviction: _apt(49,6), cognition: _apt(37,6), discipline: _apt(30,7), physiology: _apt(24,7), martial_experience: _apt(16,6) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'priest', name:'Priest', type:'priest', spriteType:'priest', team:'heroes', col:5, row:14, _charData: charData };
}

function makeRascalDef() {
    const morality = 30 + _rnd(36);
    const charData = {
        cls: 'rascal', race: _pick(['midlander','step_folk','ashen_halfbreeds']),
        name: 'Rascal', level: 1, morality,
        age: 18 + _rnd(15),
        skills: ['small_arms', 'thievery', 'arcane_theory', _pick(['stealth','deception','athletics','lockpicking'])],
        aptitudes: { cognition: _apt(46,6), martial_experience: _apt(40,6), discipline: _apt(34,7), physiology: _apt(25,7), conviction: _apt(19,7) },
        personality: null, background: null, birthSign: null,
    };
    return { id:'rascal', name:'Rascal', type:'rascal', spriteType:'rogue', team:'heroes', col:8, row:13, _charData: charData };
}

const TEAM_NEW_CLASSES_DEFS = [makeDarkTemplarDef(), makePriestDef(), makeRascalDef()];

// Active unit definitions — rebuilt each time a team is loaded
let UNIT_DEFS = [...DEFAULT_HERO_DEFS, ...ENEMY_DEFS];

// ─────────────────────────────────────────────────────────────────────────────
// PARTY → BATTLE-UNIT CONVERSION
// ─────────────────────────────────────────────────────────────────────────────

// Maps class id → class group (matches character-creator.js class groups)
const CLASS_GROUP_MAP = {
    ironguard:'Warrior',  battlebrave:'Warrior', reaver:'Warrior',     vanguard:'Warrior',   warmaster:'Warrior',   bladedancer:'Warrior',
    hunter:'Ranger',      marksman:'Ranger',     beastwarden:'Ranger', skirmisher:'Ranger',
    shadowblade:'Rogue',  assassin:'Rogue',      thief:'Rogue',        saboteur:'Rogue',     subjugator:'Rogue',
    warden:'Cleric',      soulkindler:'Cleric',  dawncaller:'Cleric',  aegisbearer:'Cleric', paladin:'Cleric',
    archmage:'Mage',      elementalist:'Mage',   arcanist:'Mage',      runescribe:'Mage',
    pyrecrafter:'Sorcerer', stormcaller:'Sorcerer', geomancer:'Sorcerer', aquorist:'Sorcerer',
    lifewhisperer:'Druid',  beastcaller:'Druid',    verdant_warden:'Druid', shaman:'Druid',
    voidweaver:'Warlock',   bloodsinger:'Warlock',  dreadbinder:'Warlock',  dominionist:'Warlock', demonologist:'Warlock',
    malefactor:'Witch',     blightweaver:'Witch',   bloodwitch:'Witch',     dreameater:'Witch',
    gravecaller:'Necromancer', soulreaper:'Necromancer', rotforged:'Necromancer', windwalker:'Necromancer',
    dark_templar:'DarkKnight',
    rascal:'Rogue',
    priest:'Cleric',
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

// Damage type → display color. Shadow uses its secondary (purple) as display color since near-black is invisible.
const DAMAGE_TYPE_COLOR = {
    Physical : '#b0a090',
    Bleed    : '#c82020',
    Fire     : '#e85820',
    Cold     : '#88d8f0',
    Lightning: '#e8f0ff',
    Nature   : '#5ab840',
    Water    : '#2878c8',
    Arcane   : '#b060f0',
    Radiant  : '#f5c840',
    Shadow   : '#7030a0',
    Void     : '#3018a0',
    Blight   : '#88b010',
    Spirit   : '#60c8c0',
};

// Spell orb two-color data: core = center of orb, outer = edge/glow.
// Types not listed default to core=#ffffff (white hot), outer=DAMAGE_TYPE_COLOR value.
const DAMAGE_TYPE_ORB = {
    Shadow   : { core: '#ffffff', outer: '#0a0010', glow: '#7030a0' },
    Void     : { core: '#3018a0', outer: '#000000', glow: '#3018a0' },
    Fire     : { core: '#ffe040', outer: '#c01000', glow: '#e85820' },
    Lightning: { core: '#e8f0ff', outer: '#4080e0', glow: '#4080e0' },
    Arcane   : { core: '#b060f0', outer: '#c02020', glow: '#9030d0' },
};

// Physical skill name → melee/ranged attack definition
const SKILL_ATTACK_MAP = {
    'Swordsmanship':  { name:'Sword Strike',   type:'melee',  range:1,  damageDice:[2,8],  damageMod:3,  hitBase:98, critMin:92, snd:'sword', damage_type:'Physical' },
    'Archery':        { name:'Arrow Shot',      type:'ranged', range:12, damageDice:[2,6],  damageMod:3,  hitBase:98, critMin:94, snd:'bow',   damage_type:'Physical' },
    'Axewielding':    { name:'Axe Strike',      type:'melee',  range:1,  damageDice:[2,8],  damageMod:4,  hitBase:98, critMin:90, snd:'sword', damage_type:'Physical' },
    'Blunt Force':    { name:'Mace Smash',      type:'melee',  range:1,  damageDice:[2,8],  damageMod:2,  hitBase:98, critMin:93, snd:'sword', damage_type:'Physical' },
    'Small Arms':     { name:'Knife Strike',    type:'melee',  range:1,  damageDice:[2,6],  damageMod:2,  hitBase:98, critMin:91, snd:'stab',  damage_type:'Physical' },
    'Polearms':       { name:'Spear Jab',       type:'melee',  range:2,  damageDice:[1,10], damageMod:3,  hitBase:98, critMin:93, snd:'sword', damage_type:'Physical' },
    'Shield Fighting':{ name:'Shield Bash',     type:'melee',  range:1,  damageDice:[1,8],  damageMod:2,  hitBase:98, critMin:94, snd:'sword', damage_type:'Physical' },
    'Crossbow':       { name:'Crossbow Bolt',   type:'ranged', range:10, damageDice:[2,8],  damageMod:2,  hitBase:98, critMin:93, snd:'bow',   damage_type:'Physical' },
    'Blowgun & Sling':{ name:'Sling Shot',      type:'ranged', range:8,  damageDice:[1,6],  damageMod:1,  hitBase:98, critMin:95, snd:'bow',   damage_type:'Physical' },
    'Stealth':        { name:'Shadow Jab',      type:'melee',  range:1,  damageDice:[2,8],  damageMod:3,  hitBase:98, critMin:88, snd:'stab',  damage_type:'Physical' },
    'Thievery':       { name:'Quick Stab',      type:'melee',  range:1,  damageDice:[2,6],  damageMod:2,  hitBase:98, critMin:90, snd:'stab',  damage_type:'Physical' },
};

// Materium skill → spell attack definition
const MATERIUM_ATTACK_MAP = {
    'Lightwielding':       { name:'Holy Bolt',   type:'spell', range:12, damageDice:[2,6], damageMod:3, hitBase:98, critMin:96, snd:'fire', damage_type:'Radiant', effect:'Minor blind — 10% accuracy reduction (1 turn)' },
    'Materium Channeling': { name:'Arcane Bolt', type:'spell', range:14, damageDice:[2,8], damageMod:4, hitBase:98, critMin:96, snd:'fire', damage_type:'Arcane',  effect:'Stable reliable damage — no variance' },
    'Shadow Weaving':      { name:'Shadow Bolt', type:'spell', range:13, damageDice:[2,8], damageMod:3, hitBase:98, critMin:95, snd:'fire', damage_type:'Shadow',  effect:'Minor evasion boost to caster' },
};

// Caster class group → default spell when no materium skills
const CASTER_DEFAULT_SPELL = {
    Cleric:      { name:'Glimmer Spark', type:'spell', range:12, damageDice:[2,6],  damageMod:3,  hitBase:98, critMin:96, snd:'fire', damage_type:'Radiant', effect:'Minor blind — 10% accuracy reduction (1 turn)' },
    Mage:        { name:'Arcane Pulse',  type:'spell', range:14, damageDice:[2,8],  damageMod:4,  hitBase:98, critMin:96, snd:'fire', damage_type:'Arcane',  effect:'Stable reliable damage — no variance' },
    Sorcerer:    { name:'Ember Flick',   type:'spell', range:13, damageDice:[3,6],  damageMod:4,  hitBase:98, critMin:96, snd:'fire', damage_type:'Fire',    effect:'Ignite (5 damage per turn)' },
    Druid:       { name:'Sprout Bind',   type:'spell', range:11, damageDice:[2,6],  damageMod:3,  hitBase:98, critMin:96, snd:'fire', damage_type:'Nature',  effect:'Root target for 1 turn' },
    Warlock:     { name:'Void Flicker',  type:'spell', range:13, damageDice:[2,8],  damageMod:3,  hitBase:98, critMin:95, snd:'fire', damage_type:'Void',    effect:'Minor instability — 20% chance of random secondary effect' },
    Witch:       { name:'Rot Touch',     type:'spell', range:11, damageDice:[2,6],  damageMod:3,  hitBase:98, critMin:95, snd:'fire', damage_type:'Blight',  effect:'Disease (8 damage per turn)' },
    Necromancer: { name:'Grave Touch',   type:'spell', range:12, damageDice:[2,8],  damageMod:3,  hitBase:98, critMin:95, snd:'fire', damage_type:'Shadow',  effect:'Minor heal to caster (50% of damage dealt)' },
};

// Martial class group → default attack when no weapon skills
const MARTIAL_DEFAULT_ATTACK = {
    Warrior: { name:'Sword Strike',   type:'melee',  range:1,  damageDice:[2,10], damageMod:5,  hitBase:98, critMin:90, snd:'sword' },
    Ranger:  { name:'Arrow Shot',     type:'ranged', range:14, damageDice:[2,8],  damageMod:3,  hitBase:98, critMin:95, snd:'bow'   },
    Rogue:   { name:'Steel Knives',   type:'melee',  range:1,  damageDice:[2,9],  damageMod:4,  hitBase:98, critMin:92, snd:'stab'  },
};

// Sprite type from class group
function spriteTypeFromGroup(group) {
    if (group === 'Warrior')     return 'warrior';
    if (group === 'Rogue')       return 'rogue';
    if (group === 'Ranger')      return 'ranger';
    if (group === 'Cleric')      return 'cleric';
    if (group === 'Mage')        return 'wizard';
    if (group === 'Necromancer') return 'necromancer';
    if (group === 'Witch')       return 'witch';
    if (group === 'Sorcerer')    return 'sorcerer';
    if (group === 'Warlock')     return 'warlock';
    if (group === 'Druid')       return 'lifewhisperer';
    if (group === 'DarkKnight')  return 'warrior';
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
    if (group === 'DarkKnight') speed = 2; // Dark Templar: half warrior speed, regardless of discipline

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
    const spriteType = char.cls === 'priest' ? 'priest' : spriteTypeFromGroup(group);
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
// ('bonfire' is only placed by night-mode generation, not in random pool)
const OBS_TYPES = ['boulder','log','rubble','bush','tree','fence','ruins'];

// Shadow direction helper.
// Day: fixed low-horizon sun in upper-left → shadows cast down-right.
// Night: the bonfire is the light source → shadows radiate outward from it
// with length growing with distance and opacity fading beyond the firelight.
// Returns: { dx, dy, angle, alpha, length } where (dx,dy) is a unit vector
// pointing AWAY from the light, and (length, alpha) scale the shadow.
function shadowDir(cx, cy) {
    if (LIGHTING.mode === 'night') {
        const vx = cx - LIGHTING.fireX;
        const vy = cy - LIGHTING.fireY;
        const dist = Math.hypot(vx, vy) || 1;
        const ux = vx / dist, uy = vy / dist;
        // Near fire: short crisp shadow. Mid-range: long oblique shadow.
        // Beyond firelight: too dark to see — alpha fades to near-zero.
        const t = Math.min(1, dist / LIGHTING.fireRadius);
        const length = 1.2 + t * 2.8;
        const alpha  = t < 0.95 ? (1.6 * (1 - t * 0.55)) : 0.12;
        return { dx: ux, dy: uy, angle: Math.atan2(uy, ux), alpha, length };
    }
    // Day: down-right, small vertical component (low-horizon sun).
    return { dx: 0.97, dy: 0.22, angle: 0.22, alpha: 1.0, length: 1.0 };
}

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

    // Night mode: place a bonfire in the centre of the map as the one light source.
    if (LIGHTING.mode === 'night') {
        const cCol = (COLS / 2) | 0;
        const cRow = (ROWS / 2) | 0;
        const bonfireSeed = (rng() * 0x7fffffff) | 0;
        OBSTACLES.push({ type: 'bonfire', hexes: [[cCol, cRow]], seed: bonfireSeed });
        BLOCKED.add(`${cCol},${cRow}`);
        reserved.add(`${cCol},${cRow}`);
        // Cache screen position so shadowDir() can read it without re-querying.
        const { sx, sy } = hexScreenCenter(cCol, cRow);
        LIGHTING.fireX = sx;
        LIGHTING.fireY = sy;
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
    if (LIGHTING.mode === 'night') {
        drawFullTerrainNight(ctx, W, H);
        return;
    }
    // Grass ground with atmospheric perspective. The depth gradient (haze,
    // brightness, saturation, noise frequency) delivers the sense of distance.
    // Texture is sampled in SCREEN space at fine scales so noise doesn't
    // streak along radial perspective lines — real grass photographs show
    // fine uniform grain, not elongated features pointing at the vanishing
    // point. A very low-amplitude perspective-warped tint adds large-scale
    // hue breakup without creating visible stripes.
    const SCALE = 3;
    const pw = Math.ceil(W / SCALE);
    const ph = Math.ceil(H / SCALE);

    const off  = document.createElement('canvas');
    off.width  = pw;
    off.height = ph;
    const oc   = off.getContext('2d');
    const img  = oc.createImageData(pw, ph);
    const d    = img.data;

    // Horizon Y — same reference used by drawBackgroundForest for sky
    let hexTopSY = Infinity;
    for (let c = 0; c < COLS; c++) {
        const { sy } = hexScreenCenter(c, 0);
        if (sy < hexTopSY) hexTopSY = sy;
    }
    hexTopSY = Math.max(10, hexTopSY - S * K * 1.6);
    const horizonSY = hexTopSY * 0.58;
    const horizonPY = Math.max(0, Math.floor(horizonSY / SCALE));
    const belowHorizon = Math.max(1, ph - horizonPY);

    // Above horizon: neutral dark fill — sky overlay will cover this.
    for (let py = 0; py < horizonPY; py++) {
        const base = py * pw * 4;
        for (let px = 0; px < pw; px++) {
            const idx = base + px * 4;
            d[idx] = 28; d[idx+1] = 42; d[idx+2] = 48; d[idx+3] = 255;
        }
    }

    // Colour anchors for the grass palette
    // Foreground: warm bright grass; Horizon: cool hazy blue-green
    const FG_R = 108, FG_G = 146, FG_B = 74;
    const HZ_R = 128, HZ_G = 152, HZ_B = 140;

    for (let py = horizonPY; py < ph; py++) {
        // Depth 0 at foreground, 1 at horizon
        const depth  = 1 - (py - horizonPY) / belowHorizon;
        const depthQ = depth * depth;           // stronger haze pileup at horizon

        // As distance grows, texture compresses into fewer screen pixels.
        // Scale noise frequency so far ground looks smoother (not pixel hash).
        const freqScale = 1 / (1 + depthQ * 6);

        // Row-wide lerp toward horizon haze
        const baseR = FG_R * (1 - depthQ) + HZ_R * depthQ;
        const baseG = FG_G * (1 - depthQ) + HZ_G * depthQ;
        const baseB = FG_B * (1 - depthQ) + HZ_B * depthQ;

        // Saturation falls off with distance; foreground is crisper
        const sat = 1 - depthQ * 0.55;

        for (let px = 0; px < pw; px++) {
            // Screen-space noise (no perspective warp → no streaks).
            // Frequencies scale with distance so far ground stays soft.
            const sx = px * freqScale;
            const sy = py * freqScale;

            const nLo  = noise2(sx * 0.035, sy * 0.035, BATTLE_SEED);
            const nMid = noise2(sx * 0.130, sy * 0.130, BATTLE_SEED + 501);
            const nHi  = noise2(sx * 0.520, sy * 0.520, BATTLE_SEED + 1003);

            const hue = nLo * 0.55 + nMid * 0.30 + nHi * 0.15;  // 0..1

            // Secondary fields — still screen-space, different seeds
            const dirtField = noise2(sx * 0.045, sy * 0.045, BATTLE_SEED + 7113);
            const mossField = noise2(sx * 0.180, sy * 0.180, BATTLE_SEED + 9341);
            const warmField = noise2(sx * 0.022, sy * 0.022, BATTLE_SEED + 6501);
            const micro     = noise2(px * 0.85,  py * 0.85,  BATTLE_SEED + 2007);

            let r = baseR, g = baseG, b = baseB;

            // Green hue variation — shift toward sage / deep / bright greens
            const hShift = (hue - 0.5) * 2;   // -1..1
            if (hShift > 0) {
                r += hShift * 24 * sat;
                g += hShift * 14 * sat;
                b -= hShift * 10 * sat;
            } else {
                r += hShift * 18 * sat;       // darker, cooler
                g += hShift * 6  * sat;
                b -= hShift * 6  * sat;
            }

            // Warm golden patches (dry grass) — subtle in foreground only
            if (warmField > 0.60 && depth > 0.35) {
                const wt = Math.min(1, (warmField - 0.60) / 0.30) * 0.28 * (1 - depthQ);
                r += (198 - r) * wt;
                g += (170 - g) * wt;
                b += (96  - b) * wt;
            }

            // Dirt patches — brown breakthrough, suppressed at distance
            if (dirtField > 0.72) {
                const dt = Math.min(1, (dirtField - 0.72) / 0.22);
                const amt = dt * 0.45 * (1 - depthQ * 0.8);
                r += (126 - r) * amt;
                g += (88  - g) * amt;
                b += (54  - b) * amt;
            }

            // Moss / darker green patches
            if (mossField > 0.72) {
                const mt = (mossField - 0.72) / 0.28;
                const amt = mt * 0.40 * (1 - depthQ * 0.6);
                r += (52  - r) * amt;
                g += (108 - g) * amt;
                b += (48  - b) * amt;
            }

            // Fine grain texture — grass-blade-level noise, strongest at front
            const grain = (micro - 0.5) * 22 * (1 - depthQ * 0.85);
            r += grain * 0.9;
            g += grain;
            b += grain * 0.6;

            // Foreground brightness lift (sun hitting close grass)
            const lift = (1 - depth) * 10;
            r += lift;
            g += lift * 0.9;
            b += lift * 0.4;

            r = r < 0 ? 0 : r > 255 ? 255 : r;
            g = g < 0 ? 0 : g > 255 ? 255 : g;
            b = b < 0 ? 0 : b > 255 ? 255 : b;

            const idx = (py * pw + px) * 4;
            d[idx] = r; d[idx+1] = g; d[idx+2] = b; d[idx+3] = 255;
        }
    }

    oc.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, W, H);
}

// Night terrain: cold dark ground, moonlit from above with a warm radial
// lift around the bonfire. No sun; firelight is the only warm source.
function drawFullTerrainNight(ctx, W, H) {
    const SCALE = 3;
    const pw = Math.ceil(W / SCALE);
    const ph = Math.ceil(H / SCALE);

    const off = document.createElement('canvas');
    off.width = pw; off.height = ph;
    const oc = off.getContext('2d');
    const img = oc.createImageData(pw, ph);
    const d = img.data;

    // Horizon (same reference as background forest)
    let hexTopSY = Infinity;
    for (let c = 0; c < COLS; c++) {
        const { sy } = hexScreenCenter(c, 0);
        if (sy < hexTopSY) hexTopSY = sy;
    }
    hexTopSY = Math.max(10, hexTopSY - S * K * 1.6);
    const horizonPY = Math.max(0, Math.floor(hexTopSY * 0.58 / SCALE));
    const belowHorizon = Math.max(1, ph - horizonPY);

    // Fire position in the downsampled image space
    const fireBX = LIGHTING.fireX / SCALE;
    const fireBY = LIGHTING.fireY / SCALE;
    const fireR  = LIGHTING.fireRadius / SCALE;

    // Above horizon: neutral dark fill (sky overlay covers this)
    for (let py = 0; py < horizonPY; py++) {
        const base = py * pw * 4;
        for (let px = 0; px < pw; px++) {
            const idx = base + px * 4;
            d[idx] = 6; d[idx+1] = 8; d[idx+2] = 14; d[idx+3] = 255;
        }
    }

    // Moonlit grass palette — night greens, but bright enough to survive the
    // atmosphere multiply pass without crushing to black.
    const FG_R = 68, FG_G = 96, FG_B = 62;     // foreground grass under moon
    const HZ_R = 46, HZ_G = 62, HZ_B = 70;     // cool distant mist at horizon
    const FIRE_R = 255, FIRE_G = 180, FIRE_B = 90;

    for (let py = horizonPY; py < ph; py++) {
        const depth  = 1 - (py - horizonPY) / belowHorizon;
        const depthQ = depth * depth;

        const baseR = FG_R * (1 - depthQ) + HZ_R * depthQ;
        const baseG = FG_G * (1 - depthQ) + HZ_G * depthQ;
        const baseB = FG_B * (1 - depthQ) + HZ_B * depthQ;

        for (let px = 0; px < pw; px++) {
            // Screen-space noise at fixed frequencies — no per-row scale, so
            // noise is continuous between rows (no horizontal banding).
            const nLo  = noise2(px * 0.035, py * 0.035, BATTLE_SEED);
            const nMid = noise2(px * 0.130, py * 0.130, BATTLE_SEED + 501);
            const nHi  = noise2(px * 0.520, py * 0.520, BATTLE_SEED + 1003);
            const hue   = nLo * 0.55 + nMid * 0.30 + nHi * 0.15;
            const micro = noise2(px * 0.85, py * 0.85, BATTLE_SEED + 2007);

            let r = baseR, g = baseG, b = baseB;

            // Green/teal hue variation — a bit wider than before to keep the
            // ground visibly grassy rather than a flat block.
            const hShift = (hue - 0.5) * 2;
            r += hShift * 6;
            g += hShift * 14;
            b += hShift * 8;

            // Fine grain
            const grain = (micro - 0.5) * 12;
            r += grain * 0.5; g += grain * 0.7; b += grain * 0.5;

            // Firelight — gentle warm lift right at the pit only.
            const dxF = px - fireBX;
            const dyF = (py - fireBY) * 1.8;
            const distF = Math.hypot(dxF, dyF);
            if (distF < fireR * 0.8) {
                const t = Math.max(0, 1 - distF / (fireR * 0.8));
                const strength = t * t * 0.85;
                r += (FIRE_R - r) * strength * 0.28;
                g += (FIRE_G - g) * strength * 0.18;
                b += (FIRE_B - b) * strength * 0.05;
            }

            // Cool moonlight: bluish lift strongest in the foreground.
            const moonlift = (1 - depthQ) * 10;
            r += moonlift * 0.5;
            g += moonlift * 0.8;
            b += moonlift * 1.2;

            r = r < 0 ? 0 : r > 255 ? 255 : r;
            g = g < 0 ? 0 : g > 255 ? 255 : g;
            b = b < 0 ? 0 : b > 255 ? 255 : b;

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

    // Long low-sun shadow — stretched down-right, soft penumbra
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath(); ctx.ellipse(gx+22*F, gy+3*F, 34*F, 6.5*F, -0.08, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(gx+16*F, gy+2*F, 24*F, 5*F, -0.08, 0, Math.PI*2); ctx.fill();

    // Slight hue variation per rock
    const warm = rng() > 0.5;
    const dk  = warm ? '#3e3a30' : '#44443c';
    const md  = warm ? '#706a5c' : '#6e6e68';
    const mid = warm ? '#8c8676' : '#8c8c86';
    const lit = warm ? '#c0b8a2' : '#bababa';

    // Dark silhouette (shaded side)
    ctx.beginPath();
    ctx.moveTo(gx-11*F,gy); ctx.lineTo(gx-5*F,gy-13*F);
    ctx.lineTo(gx+2*F,gy-18*F); ctx.lineTo(gx+13*F,gy-10*F);
    ctx.lineTo(gx+15*F,gy); ctx.lineTo(gx+4*F,gy+4*F); ctx.closePath();
    ctx.fillStyle = dk; ctx.fill();

    // Mid tone body
    ctx.beginPath();
    ctx.moveTo(gx-9*F,gy); ctx.lineTo(gx-4*F,gy-12*F);
    ctx.lineTo(gx+2*F,gy-17*F); ctx.lineTo(gx+11*F,gy-9*F);
    ctx.lineTo(gx+12*F,gy); ctx.lineTo(gx+3*F,gy+3*F); ctx.closePath();
    ctx.fillStyle = md; ctx.fill();

    // Right lit plane
    ctx.beginPath();
    ctx.moveTo(gx+2*F,gy-17*F); ctx.lineTo(gx+11*F,gy-9*F);
    ctx.lineTo(gx+12*F,gy); ctx.lineTo(gx+3*F,gy+2*F);
    ctx.lineTo(gx+2*F,gy-2*F); ctx.closePath();
    ctx.fillStyle = mid; ctx.fill();

    // Top highlight — sun-lit upper facet
    ctx.beginPath();
    ctx.moveTo(gx-3*F,gy-13*F); ctx.lineTo(gx+5*F,gy-16*F);
    ctx.lineTo(gx+2*F,gy-18*F); ctx.lineTo(gx-4*F,gy-15*F); ctx.closePath();
    ctx.fillStyle = lit; ctx.fill();

    // Specular micro-highlight on the ridge
    ctx.fillStyle = 'rgba(255,250,230,0.35)';
    ctx.beginPath(); ctx.ellipse(gx-1*F, gy-15*F, 2.4*F, 0.9*F, -0.4, 0, Math.PI*2); ctx.fill();

    // Crack line
    if (rng() > 0.45) {
        ctx.strokeStyle = 'rgba(10,8,6,0.45)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(gx-2*F, gy-14*F);
        ctx.quadraticCurveTo(gx+3*F, gy-10*F, gx+6*F, gy-4*F);
        ctx.stroke();
    }

    // Moss patch near base
    if (rng() > 0.55) {
        ctx.fillStyle = 'rgba(60,110,40,0.42)';
        ctx.beginPath();
        ctx.ellipse(gx-3*F, gy-3*F, 4*F, 2*F, 0.2, 0, Math.PI*2);
        ctx.fill();
    }
}

function drawShrub(ctx, cx, cy, rng) {
    const F = 0.62;
    const gx = cx + (rng()*6-3)*F, gy = cy;

    // Long low-sun shadow — elongated down-right
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath(); ctx.ellipse(gx+22*F, gy+4*F, 40*F, 7*F, -0.08, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath(); ctx.ellipse(gx+16*F, gy+3*F, 28*F, 5*F, -0.08, 0, Math.PI*2); ctx.fill();

    // Hue roll — varies between dusty sage, deep forest, fresh spring green
    const hueRoll = rng();
    const dark = hueRoll < 0.33 ? '#203810' :
                 hueRoll < 0.66 ? '#1c3410' : '#2a4214';
    const mid  = hueRoll < 0.33 ? '#3a5a1c' :
                 hueRoll < 0.66 ? '#3c6420' : '#4a7220';
    const lit  = hueRoll < 0.33 ? '#5a8830' :
                 hueRoll < 0.66 ? '#5e9030' : '#7aa836';
    const hi   = hueRoll < 0.33 ? '#7ca840' :
                 hueRoll < 0.66 ? '#84b444' : '#98c450';

    const blobs = [
        {ox:-8*F,oy:-4*F,rx:9*F,ry:7*F},
        {ox: 6*F,oy:-3*F,rx:8*F,ry:6*F},
        {ox:-1*F,oy:-9*F,rx:10*F,ry:8*F},
        {ox: 2*F,oy:-14*F,rx:7*F,ry:6*F},
    ];
    // Back-shadow pass
    for (const b of blobs) {
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(gx+b.ox+1.2*F, gy+b.oy+1.2*F, b.rx*1.05, b.ry*1.05, 0, 0, Math.PI*2);
        ctx.fill();
    }
    // Mid body
    for (const b of blobs) {
        ctx.fillStyle = mid;
        ctx.beginPath();
        ctx.ellipse(gx+b.ox, gy+b.oy, b.rx, b.ry, 0, 0, Math.PI*2);
        ctx.fill();
    }
    // Sunlit upper-left wedge
    for (const b of blobs) {
        ctx.fillStyle = lit;
        ctx.beginPath();
        ctx.ellipse(gx+b.ox-b.rx*0.28, gy+b.oy-b.ry*0.32, b.rx*0.62, b.ry*0.55, 0, 0, Math.PI*2);
        ctx.fill();
    }
    // Specular rim highlight
    ctx.fillStyle = hi;
    ctx.globalAlpha = 0.75;
    for (const b of blobs) {
        ctx.beginPath();
        ctx.ellipse(gx+b.ox-b.rx*0.40, gy+b.oy-b.ry*0.50, b.rx*0.28, b.ry*0.22, 0, 0, Math.PI*2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
}

// A denser, rounder bush — distinct from drawShrub. Random berries / flowers.
function drawBush(ctx, cx, cy, rng) {
    const F = 0.62 * (0.85 + rng() * 0.45);
    const gx = cx + (rng()*5-2.5)*F, gy = cy;

    // Long low-sun shadow — stretched down-right
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath(); ctx.ellipse(gx+24*F, gy+4*F, 44*F, 7*F, -0.08, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.11)';
    ctx.beginPath(); ctx.ellipse(gx+18*F, gy+3*F, 30*F, 5.5*F, -0.08, 0, Math.PI*2); ctx.fill();

    // Multi-blob rounded canopy — more compact than shrub
    const cnt = 6 + (rng()*4|0);
    const blobs = [];
    for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * Math.PI * 2 + rng() * 0.5;
        const d = 5 * F + rng() * 6 * F;
        blobs.push({
            ox: Math.cos(a) * d,
            oy: Math.sin(a) * d * 0.55 - (4 + rng()*5) * F,
            rx: (5 + rng() * 4) * F,
            ry: (4 + rng() * 3) * F,
        });
    }
    blobs.push({ ox: 0, oy: -10*F, rx: 11*F, ry: 9*F });

    const hueRoll = rng();
    // Varied bush hues: deep green, sage, golden-autumn, russet-berry
    let dark, mid, lit, hi, berry;
    if (hueRoll < 0.40) {
        dark = '#1a3410'; mid  = '#335820'; lit  = '#60902e'; hi   = '#88b844'; berry = '#c03430';
    } else if (hueRoll < 0.70) {
        dark = '#223010'; mid  = '#3a5420'; lit  = '#6c8a32'; hi   = '#9cb444'; berry = '#5c2480';
    } else if (hueRoll < 0.88) {
        dark = '#403218'; mid  = '#6a5424'; lit  = '#a88a38'; hi   = '#d8b850'; berry = '#d04020';
    } else {
        dark = '#1c2c18'; mid  = '#2e4a20'; lit  = '#4c7828'; hi   = '#7aa030'; berry = '#f8e060';
    }

    // Back shadow pass
    for (const b of blobs) {
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(gx+b.ox+1.2*F, gy+b.oy+1.2*F, b.rx*1.05, b.ry*1.05, 0, 0, Math.PI*2);
        ctx.fill();
    }
    // Mid body
    for (const b of blobs) {
        ctx.fillStyle = mid;
        ctx.beginPath();
        ctx.ellipse(gx+b.ox, gy+b.oy, b.rx, b.ry, 0, 0, Math.PI*2);
        ctx.fill();
    }
    // Sunlit wedges
    for (const b of blobs) {
        ctx.fillStyle = lit;
        ctx.beginPath();
        ctx.ellipse(gx+b.ox-b.rx*0.28, gy+b.oy-b.ry*0.32, b.rx*0.62, b.ry*0.55, 0, 0, Math.PI*2);
        ctx.fill();
    }
    // Rim highlights
    ctx.fillStyle = hi;
    ctx.globalAlpha = 0.80;
    for (const b of blobs) {
        ctx.beginPath();
        ctx.ellipse(gx+b.ox-b.rx*0.42, gy+b.oy-b.ry*0.52, b.rx*0.28, b.ry*0.20, 0, 0, Math.PI*2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Scattered berries / flowers
    if (rng() > 0.45) {
        const bc = 4 + (rng()*6|0);
        ctx.fillStyle = berry;
        for (let i = 0; i < bc; i++) {
            const a = rng() * Math.PI * 2;
            const d = (2 + rng() * 8) * F;
            ctx.beginPath();
            ctx.arc(gx + Math.cos(a)*d, gy + Math.sin(a)*d*0.6 - (5+rng()*6)*F, 1.1*F + rng()*0.9*F, 0, Math.PI*2);
            ctx.fill();
        }
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
    for (let m=0;m<4;m++) {
        ctx.beginPath(); ctx.ellipse(cx+(rng()-0.5)*16*F,cy-5*F+(rng()-0.5)*8*F,3*F+rng()*4*F,2*F+rng()*2*F,rng()*Math.PI,0,Math.PI*2); ctx.fill();
    }
}

function drawObstacleLog(ctx, cx, cy, angle, scale, rng) {
    const L = 38*scale, R = 5.5*scale;
    const ax = Math.cos(angle)*L*0.5, ay = Math.sin(angle)*L*0.5;
    // Long low-sun shadow — soft, stretched down-right (ground projection)
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.beginPath(); ctx.ellipse(cx+12*scale,cy+3*scale,L*0.75,R*0.70,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.save(); ctx.translate(cx+8*scale,cy+2*scale); ctx.rotate(angle);
    ctx.beginPath(); ctx.ellipse(0,0,L*0.55,R*0.45,0,0,Math.PI*2); ctx.fill();
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
        case 'bonfire': drawObstacleBonfire(ctx, cx, cy, scale, rng); break;
    }
}

// Bonfire — stacked logs + embers. The animated flame licks are drawn on the
// overlay canvas each frame by drawBonfireFlames(); this function only lays
// down the static base (logs, stones, ash, ember bed) so it bakes cleanly
// into the background layer.
function drawObstacleBonfire(ctx, cx, cy, scale, rng) {
    scale *= 0.5;   // halved footprint per request
    // Soft dark halo under the fire (scorch mark / charred ground)
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 2*scale, 30*scale, 10*scale, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(40,20,10,0.50)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 1*scale, 24*scale, 8*scale, 0, 0, Math.PI*2); ctx.fill();

    // Ring of stones around the pit
    const stoneN = 9;
    for (let i = 0; i < stoneN; i++) {
        const a = (i / stoneN) * Math.PI * 2 + rng() * 0.3;
        const rx = cx + Math.cos(a) * 22 * scale;
        const ry = cy + Math.sin(a) * 8 * scale + 1;
        const sw = (3 + rng() * 2) * scale;
        const sh = (2 + rng() * 1.2) * scale;
        ctx.fillStyle = '#2a2620';
        ctx.beginPath(); ctx.ellipse(rx, ry+1.5, sw*1.1, sh*0.8, 0, 0, Math.PI*2); ctx.fill();
        const g = ctx.createRadialGradient(rx - sw*0.3, ry - sh*0.4, 0, rx, ry, sw);
        g.addColorStop(0,   '#6a5c50');
        g.addColorStop(0.6, '#3c342c');
        g.addColorStop(1,   '#1e1814');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(rx, ry, sw, sh, 0, 0, Math.PI*2); ctx.fill();
    }

    // Ember bed inside the ring — hot coals glowing
    const bed = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16 * scale);
    bed.addColorStop(0.0, '#ffe890');
    bed.addColorStop(0.25,'#ff8020');
    bed.addColorStop(0.60,'#902010');
    bed.addColorStop(1.0, 'rgba(30,10,6,0.9)');
    ctx.fillStyle = bed;
    ctx.beginPath(); ctx.ellipse(cx, cy, 16*scale, 6*scale, 0, 0, Math.PI*2); ctx.fill();

    // Crossed charred logs
    const logs = [
        { ang:  0.35, len: 30 * scale },
        { ang: -0.55, len: 26 * scale },
        { ang:  1.20, len: 24 * scale },
    ];
    for (const L of logs) {
        const hx = Math.cos(L.ang) * L.len * 0.5;
        const hy = Math.sin(L.ang) * L.len * 0.5;
        const x0 = cx - hx, y0 = cy - hy * 0.55;
        const x1 = cx + hx, y1 = cy + hy * 0.55;
        // Dark underside
        ctx.strokeStyle = '#140a04';
        ctx.lineWidth = 4.5 * scale;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, y0 + 1); ctx.lineTo(x1, y1 + 1); ctx.stroke();
        // Charred gradient body
        const lg = ctx.createLinearGradient(x0, y0, x1, y1);
        lg.addColorStop(0.0, '#3a1e10');
        lg.addColorStop(0.3, '#1c100a');
        lg.addColorStop(0.6, '#2c1808');
        lg.addColorStop(1.0, '#180a04');
        ctx.strokeStyle = lg;
        ctx.lineWidth = 3.4 * scale;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        // Hot ember cracks running along the log
        ctx.strokeStyle = 'rgba(255, 120, 30, 0.78)';
        ctx.lineWidth = 0.9 * scale;
        const segs = 4;
        for (let i = 0; i < segs; i++) {
            const t0 = i / segs + rng() * 0.04;
            const t1 = Math.min(1, t0 + 0.08 + rng() * 0.07);
            ctx.beginPath();
            ctx.moveTo(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0);
            ctx.lineTo(x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1);
            ctx.stroke();
        }
    }

    // Scattered bright embers on top of the bed
    for (let i = 0; i < 14; i++) {
        const a = rng() * Math.PI * 2;
        const d = rng() * 12 * scale;
        const ex = cx + Math.cos(a) * d;
        const ey = cy + Math.sin(a) * d * 0.55;
        ctx.fillStyle = rng() > 0.5 ? 'rgba(255,220,120,0.9)' : 'rgba(255,120,30,0.85)';
        ctx.beginPath(); ctx.arc(ex, ey, 0.8 * scale + rng() * 0.8 * scale, 0, Math.PI * 2); ctx.fill();
    }
}

// Animated flames + dynamic flicker — drawn on the overlay canvas each frame
// so the bonfire appears to breathe without re-baking the whole background.
function drawBonfireFlames(ctx, cx, cy, scale, timeMs) {
    scale *= 0.5;   // halved flame size to match the shrunk pit
    const t = timeMs * 0.004;
    // Low-frequency breath + higher jitter layered on top
    const breath = Math.sin(t * 1.3) * 0.5 + Math.sin(t * 2.7 + 1.1) * 0.5;
    const flickerH = 1 + breath * 0.12 + (Math.sin(t * 11.0) * 0.04);
    const flickerW = 1 + Math.sin(t * 3.1 + 0.7) * 0.08;

    const baseY = cy - 1 * scale;
    const flameH = 34 * scale * flickerH;
    const flameW = 14 * scale * flickerW;

    // Outer halo glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(cx, baseY - flameH * 0.35, 0,
                                           cx, baseY - flameH * 0.35, 110 * scale);
    halo.addColorStop(0.0, 'rgba(255,200,90,0.55)');
    halo.addColorStop(0.25,'rgba(255,140,40,0.30)');
    halo.addColorStop(0.60,'rgba(200,60,10,0.10)');
    halo.addColorStop(1.0, 'rgba(120,20,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(cx - 120 * scale, baseY - 120 * scale, 240 * scale, 200 * scale);

    // Main outer flame — deep orange
    const f1 = ctx.createRadialGradient(cx, baseY - flameH * 0.4, 0,
                                         cx, baseY - flameH * 0.4, flameW * 2.2);
    f1.addColorStop(0.0, 'rgba(255,220,120,0.95)');
    f1.addColorStop(0.45,'rgba(255,110,20,0.70)');
    f1.addColorStop(1.0, 'rgba(180,40,0,0)');
    ctx.fillStyle = f1;
    ctx.beginPath();
    ctx.ellipse(cx, baseY - flameH * 0.45, flameW * 1.3, flameH * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner yellow-white tongue, offset by flicker
    const wob = Math.sin(t * 5.2) * flameW * 0.18;
    const f2 = ctx.createRadialGradient(cx + wob, baseY - flameH * 0.55, 0,
                                         cx + wob, baseY - flameH * 0.55, flameW);
    f2.addColorStop(0.0, 'rgba(255,255,230,0.95)');
    f2.addColorStop(0.35,'rgba(255,220,120,0.80)');
    f2.addColorStop(1.0, 'rgba(255,160,40,0)');
    ctx.fillStyle = f2;
    ctx.beginPath();
    ctx.ellipse(cx + wob, baseY - flameH * 0.55, flameW * 0.75, flameH * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hot white core
    ctx.fillStyle = 'rgba(255,255,240,0.85)';
    ctx.beginPath();
    ctx.ellipse(cx + wob * 0.5, baseY - flameH * 0.25, flameW * 0.30, flameH * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rising sparks
    for (let i = 0; i < 6; i++) {
        const phase = (t * 0.8 + i * 0.37) % 1;
        const sx = cx + Math.sin(t * 3 + i * 2.1) * flameW * 0.6;
        const sy = baseY - flameH * (0.4 + phase * 0.9);
        const sa = (1 - phase) * 0.8;
        ctx.fillStyle = `rgba(255,200,120,${sa.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.9 * scale, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// Long tree shadow — stretched away from the light source. Day: low sun in
// upper-left. Night: radiates out from the bonfire, faded beyond firelight.
function drawTreeShadow(ctx, cx, cy, w, h, scale) {
    const S = shadowDir(cx, cy);
    if (S.alpha <= 0.05) return;
    const ox = 22 * scale * S.length;
    ctx.save();
    ctx.translate(cx, cy + 1);
    ctx.rotate(S.angle);
    ctx.fillStyle = `rgba(10,25,5,${(0.06 * S.alpha).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(ox * 1.25, 0, w * 2.20 * S.length, h * 1.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(5,15,2,${(0.12 * S.alpha).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(ox, 0, w * 1.60 * S.length, h * 1.10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Contact core under the trunk (attached shadow — slightly visible even far from fire)
    ctx.fillStyle = `rgba(0,8,0,${(0.22 * Math.max(0.3, S.alpha)).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(ox * 0.25, 0, w * 0.55, h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
        if      (v < 0.35) drawBush(ctx, cx, cy, rng);
        else if (v < 0.65) drawShrub(ctx, cx, cy, rng);
        else if (v < 0.85) drawReedTufts(ctx, cx, cy, rng);
        else               drawMushrooms(ctx, cx, cy, rng);
    } else if (T.type === T_FLOWERS) {
        drawFlowers(ctx, cx, cy, rng);
        if (rng() > 0.60) drawMushrooms(ctx, cx, cy, rng);
    } else {
        // Grass hex: varied small details
        const v = rng();
        if      (v < 0.32) drawGrassTufts(ctx, cx, cy, rng);
        else if (v < 0.48) drawPebbles   (ctx, cx, cy, rng);
        else if (v < 0.60) drawReedTufts (ctx, cx, cy, rng);
        else if (v < 0.72) drawMudPatch  (ctx, cx, cy, rng);
        else if (v < 0.80) drawMushrooms (ctx, cx, cy, rng);
        else if (v < 0.88) drawFlowers   (ctx, cx, cy, rng);
        else               drawBush      (ctx, cx, cy, rng);
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
    const skyStopY = hexTopY * 0.58;   // = treelineY, bottom of front hill
    const isNight = LIGHTING.mode === 'night';

    if (isNight) {
        // Deep night sky: near-black with indigo gradient, moon in upper area.
        const skyGrad = ctx.createLinearGradient(0, 0, 0, skyStopY);
        // Moonlit sky — genuinely visible night blue. Atmosphere multiply
        // no longer touches the sky, so these values display as painted.
        skyGrad.addColorStop(0,    '#1a2a4e');
        skyGrad.addColorStop(0.35, '#253962');
        skyGrad.addColorStop(0.70, '#324978');
        skyGrad.addColorStop(1.0,  '#42598a');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, skyStopY);

        // Starfield
        const starRng = makeRng(BATTLE_SEED + 4711);
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 140; i++) {
            const sx = starRng() * W;
            const sy = starRng() * skyStopY * 0.85;
            const sa = 0.30 + starRng() * 0.70;
            const sr = starRng() < 0.08 ? 1.2 : 0.5;
            ctx.globalAlpha = sa;
            ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Moon — cold bluish white, upper-right
        const moonX = W * 0.76;
        const moonY = skyStopY * 0.26;
        const moonR = Math.min(W, skyStopY) * 0.055;
        // Soft halo
        const moonHalo = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 7);
        moonHalo.addColorStop(0.0, 'rgba(200,220,255,0.45)');
        moonHalo.addColorStop(0.25,'rgba(160,190,240,0.18)');
        moonHalo.addColorStop(0.65,'rgba(100,140,200,0.06)');
        moonHalo.addColorStop(1.0, 'rgba(60,90,160,0.00)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = moonHalo;
        ctx.fillRect(0, 0, W, skyStopY);
        ctx.restore();
        // Moon core
        ctx.fillStyle = '#e8efff';
        ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.fill();
        // Craters
        ctx.fillStyle = 'rgba(120,140,180,0.35)';
        ctx.beginPath(); ctx.arc(moonX - moonR * 0.35, moonY - moonR * 0.15, moonR * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(moonX + moonR * 0.20, moonY + moonR * 0.30, moonR * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(moonX + moonR * 0.40, moonY - moonR * 0.40, moonR * 0.09, 0, Math.PI * 2); ctx.fill();

        // Thin wispy low clouds drifting in front of moon (dark, smoky)
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#080b18';
        for (let i = 0; i < 4; i++) {
            const cx = rng() * W;
            const cy = skyStopY * (0.15 + rng() * 0.55);
            ctx.beginPath();
            ctx.ellipse(cx, cy, 70 + rng() * 90, 6 + rng() * 10, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    } else {
        // ── Sky: late-afternoon gradient with warm horizon ───────────────────
        const skyGrad = ctx.createLinearGradient(0, 0, 0, skyStopY);
        skyGrad.addColorStop(0,    '#3c6890');   // deep zenith
        skyGrad.addColorStop(0.28, '#5e8cae');   // mid sky
        skyGrad.addColorStop(0.55, '#a8b8b8');   // transitional haze
        skyGrad.addColorStop(0.80, '#e0b888');   // warm golden band
        skyGrad.addColorStop(1.0,  '#d8a880');   // hazy horizon
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, skyStopY);

        // Sun position — upper-left, matching ground-lighting direction
        const sunX = W * 0.20;
        const sunY = skyStopY * 0.30;
        const sunR = Math.min(W, skyStopY) * 0.09;

        // Procedural clouds (painted before sun halo so halo blooms over them)
        drawClouds(ctx, W, skyStopY, sunX, sunY);

        // Sun halo — wide radial glow
        const haloGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 6);
        haloGrad.addColorStop(0,    'rgba(255, 246, 210, 0.90)');
        haloGrad.addColorStop(0.15, 'rgba(255, 220, 160, 0.55)');
        haloGrad.addColorStop(0.35, 'rgba(255, 190, 130, 0.22)');
        haloGrad.addColorStop(0.70, 'rgba(255, 170, 110, 0.06)');
        haloGrad.addColorStop(1.0,  'rgba(255, 170, 110, 0.00)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = haloGrad;
        ctx.fillRect(0, 0, W, skyStopY);
        ctx.restore();

        // Sun core
        ctx.fillStyle = '#fff8dc';
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunR * 0.58, 0, Math.PI * 2);
        ctx.fill();

        // Soft diagonal light shafts from sun into sky
        drawSunRays(ctx, W, skyStopY, sunX, sunY);
    }

    // ── Hills: fully opaque, back-to-front, no transparency ──────────────
    // yRatio/hRatio define baseY and bandH relative to hexTopY.
    // treelineY = bottom of the front hill = hexTopY * (0.30 + 0.28) = 0.58.
    const silLayers = isNight ? [
        // Each hill steps darker toward the foreground, all darker than the
        // now-brighter sky so their silhouettes read against the horizon.
        { yRatio: 0.06, hRatio: 0.32, color: '#151d34', freq: 0.0055, spkFreq: 0.032 },
        { yRatio: 0.17, hRatio: 0.30, color: '#0c1222', freq: 0.0090, spkFreq: 0.048 },
        { yRatio: 0.30, hRatio: 0.28, color: '#060913', freq: 0.014,  spkFreq: 0.070 },
    ] : [
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

    if (isNight) {
        for (const t of allTrees) {
            const tr = makeRng(t.seed);
            ctx.globalAlpha = Math.min(1, t.op);
            if (t.conifer) drawConiferTree(ctx, t.x, t.y, t.scale, tr);
            else           drawDeciduousTree(ctx, t.x, t.y, t.scale, tr);
        }
        ctx.globalAlpha = 1.0;

        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';

        let hexMinY = Infinity, hexMaxY = -Infinity;
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                const { sy } = hexScreenCenter(c, r);
                if (sy < hexMinY) hexMinY = sy;
                if (sy > hexMaxY) hexMaxY = sy;
            }
        }
        const sideHexStartY = Math.max(10, hexMinY - S * K * 1.6);
        const sideHexRangeH = (hexMaxY + S * K * 2.5) - sideHexStartY;
        const sideTreesEndY = sideHexStartY + 0.50 * sideHexRangeH;

        const dimBottom = sideTreesEndY + S * K;
        // Linear depth gradient: peaks at horizon, fades toward camera.
        const horizFrac = Math.min(0.98, skyStopY / Math.max(1, dimBottom));
        const dimGrad = ctx.createLinearGradient(0, 0, 0, dimBottom);
        dimGrad.addColorStop(0,                                    'rgba(4,6,12,0.00)');
        dimGrad.addColorStop(horizFrac,                            'rgba(4,6,12,0.65)');
        dimGrad.addColorStop(horizFrac + (1 - horizFrac) * 0.40,  'rgba(4,6,12,0.61)');
        dimGrad.addColorStop(horizFrac + (1 - horizFrac) * 0.70,  'rgba(4,6,12,0.48)');
        dimGrad.addColorStop(1.00,                                 'rgba(4,6,12,0.00)');
        ctx.fillStyle = dimGrad;
        ctx.fillRect(0, 0, W, dimBottom);
        ctx.restore();
    } else {
        for (const t of allTrees) {
            const tr = makeRng(t.seed);
            ctx.globalAlpha = Math.min(1, t.op);
            if (t.conifer) drawConiferTree(ctx, t.x, t.y, t.scale, tr);
            else           drawDeciduousTree(ctx, t.x, t.y, t.scale, tr);
        }
        ctx.globalAlpha = 1.0;
    }
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
            else if (ttype === T_SHRUBS)  (rng() < 0.55 ? drawBush : drawShrub)(ctx, cx, cy, rng);
            else if (ttype === T_FLOWERS) drawFlowers   (ctx, cx, cy, rng);
            else                           drawGrassTufts(ctx, cx, cy, rng);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ATMOSPHERE — sky clouds, sun rays, warm colour grade, vignette
// ─────────────────────────────────────────────────────────────────────────────

function drawClouds(ctx, W, skyH, sunX, sunY) {
    // Render clouds to an offscreen buffer at quarter resolution.
    const CW = Math.ceil(W / 4);
    const CH = Math.ceil(skyH / 4);
    if (CW <= 0 || CH <= 0) return;

    const off = document.createElement('canvas');
    off.width = CW; off.height = CH;
    const oc  = off.getContext('2d');
    const img = oc.createImageData(CW, CH);
    const d   = img.data;

    // Scale the sun position from full canvas into buffer-space
    const sxb = sunX / 4, syb = sunY / 4;

    for (let py = 0; py < CH; py++) {
        // Clouds concentrate in the upper-mid band; taper at zenith + horizon
        const yt  = py / CH;
        const band = Math.max(0, 1 - Math.abs(yt - 0.36) * 2.6);
        if (band <= 0.02) continue;

        for (let px = 0; px < CW; px++) {
            const nx = px / CW * 7.5;
            const ny = py / CH * 3.0;
            const n1 = noise2(nx * 1.2, ny * 1.2, BATTLE_SEED + 8881);
            const n2 = noise2(nx * 2.8, ny * 2.8, BATTLE_SEED + 8882);
            const n3 = noise2(nx * 6.2, ny * 6.2, BATTLE_SEED + 8883);
            const nv = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;

            // Clamp to a density that leaves clear sky between blobs
            const density = Math.max(0, nv - 0.52) * 4.0 * band;
            if (density < 0.04) continue;

            // Sun-direction shading: pixels on the "lit side" of a blob get
            // warmer/brighter, underside gets cooler and darker.
            const dx = px - sxb, dy = py - syb;
            const dl = Math.sqrt(dx * dx + dy * dy) + 0.001;
            const ndx = dx / dl, ndy = dy / dl;
            // Gradient of cloud density as a proxy for blob normal
            const gN = noise2((nx) * 1.2 + 0.08, ny * 1.2, BATTLE_SEED + 8881)
                     - noise2((nx) * 1.2 - 0.08, ny * 1.2, BATTLE_SEED + 8881);
            const gE = noise2((nx) * 1.2, ny * 1.2 + 0.08, BATTLE_SEED + 8881)
                     - noise2((nx) * 1.2, ny * 1.2 - 0.08, BATTLE_SEED + 8881);
            const lit = -(gN * ndx + gE * ndy) * 5.0;     // +lit, -shaded

            let r = 248, g = 244, b = 232;
            if (lit > 0) {
                r += lit * 8;
                g += lit * 2;
                b -= lit * 10;
            } else {
                r += lit * 50;
                g += lit * 58;
                b += lit * 52;
            }
            r = r < 120 ? 120 : r > 255 ? 255 : r;
            g = g < 110 ? 110 : g > 255 ? 255 : g;
            b = b < 110 ? 110 : b > 255 ? 255 : b;

            const a = Math.min(1, density * 0.95) * 255;
            const idx = (py * CW + px) * 4;
            d[idx] = r; d[idx+1] = g; d[idx+2] = b; d[idx+3] = a;
        }
    }
    oc.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, W, skyH);
}

function drawSunRays(ctx, W, skyH, sunX, sunY) {
    ctx.save();
    // Clip to sky rectangle so rays don't leak onto the ground
    ctx.beginPath();
    ctx.rect(0, 0, W, skyH);
    ctx.clip();

    ctx.globalCompositeOperation = 'lighter';
    const reach = Math.hypot(W, skyH) * 1.2;
    // Several soft wedges fanning downward from the sun
    const baseAngles = [0.35, 0.55, 0.78, 1.02, 1.28, 1.55, 1.82, 2.10];
    for (const a of baseAngles) {
        const width = 0.09 + ((a * 53) % 1) * 0.08;
        const half  = width * 0.5;
        const g = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, reach);
        g.addColorStop(0,   'rgba(255, 238, 200, 0.00)');
        g.addColorStop(0.05,'rgba(255, 238, 200, 0.16)');
        g.addColorStop(0.45,'rgba(255, 228, 180, 0.10)');
        g.addColorStop(1.0, 'rgba(255, 220, 170, 0.00)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        ctx.lineTo(sunX + Math.cos(a - half) * reach, sunY + Math.sin(a - half) * reach);
        ctx.lineTo(sunX + Math.cos(a + half) * reach, sunY + Math.sin(a + half) * reach);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

function drawAtmosphere(ctx, W, H) {
    if (LIGHTING.mode === 'night') {
        // No multiply darkening pass — terrain and sky are already painted at
        // night values, so multiplying created a hard seam at the horizon.
        // We only ADD light (fire glow, moonlight) and gently vignette corners.

        // Warm firelight glow — additive halo around the bonfire
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const fireGlow = ctx.createRadialGradient(
            LIGHTING.fireX, LIGHTING.fireY - 8, 0,
            LIGHTING.fireX, LIGHTING.fireY - 8, LIGHTING.fireRadius * 1.1
        );
        fireGlow.addColorStop(0.00, 'rgba(255,170,80,0.38)');
        fireGlow.addColorStop(0.25, 'rgba(255,120,40,0.22)');
        fireGlow.addColorStop(0.65, 'rgba(200,60,20,0.07)');
        fireGlow.addColorStop(1.00, 'rgba(120,20,0,0)');
        ctx.fillStyle = fireGlow;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        // Soft corner vignette — full-canvas continuous gradient so there's
        // no horizontal seam at the horizon. Alpha is gentle.
        ctx.save();
        const vign = ctx.createRadialGradient(
            LIGHTING.fireX, LIGHTING.fireY, Math.min(W, H) * 0.25,
            LIGHTING.fireX, LIGHTING.fireY, Math.max(W, H) * 0.90
        );
        vign.addColorStop(0.00, 'rgba(0, 0, 0, 0.00)');
        vign.addColorStop(0.65, 'rgba(0, 0, 0, 0.10)');
        vign.addColorStop(1.00, 'rgba(0, 0, 0, 0.30)');
        ctx.fillStyle = vign;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
        return;
    }

    // Soft warm glow anchored just above the canvas at sun position — fades
    // fast so it doesn't brighten the distant ground.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sunGlow = ctx.createRadialGradient(
        W * 0.20, -H * 0.05, 0,
        W * 0.20, -H * 0.05, Math.max(W, H) * 0.55
    );
    sunGlow.addColorStop(0,    'rgba(255, 220, 160, 0.18)');
    sunGlow.addColorStop(0.50, 'rgba(255, 210, 150, 0.04)');
    sunGlow.addColorStop(1.0,  'rgba(255, 210, 150, 0.00)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Corner vignette for framing
    const vign = ctx.createRadialGradient(
        W * 0.50, H * 0.58, Math.min(W, H) * 0.35,
        W * 0.50, H * 0.58, Math.max(W, H) * 0.80
    );
    vign.addColorStop(0, 'rgba(0, 0, 0, 0.00)');
    vign.addColorStop(1, 'rgba(6, 12, 20, 0.38)');
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, W, H);
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT SPRITES — oblique from-behind view; heroes face toward enemies (top of map)
// ─────────────────────────────────────────────────────────────────────────────
// anim = { t: 0..1, type: string } or null/undefined for idle pose.
// Screen-left = character's right side (sword/weapon arm).

function drawShadow(ctx, cx, by) {
    const S = shadowDir(cx, by);
    if (S.alpha <= 0.05) return;
    // Long shadow stretched away from the light source; the ellipse is
    // oriented along (dx, dy) so it looks like a ground projection.
    const ang = S.angle;
    const off = 18 * S.length;
    ctx.save();
    ctx.translate(cx + S.dx * off * 0.6, by + S.dy * off * 0.3);
    ctx.rotate(ang);
    ctx.fillStyle = `rgba(0,0,0,${(0.06 * S.alpha).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 38 * S.length, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(0,0,0,${(0.14 * S.alpha).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(-6 * S.length, 0, 26 * S.length, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Tight contact core under the feet (always visible — it's attached)
    ctx.fillStyle = `rgba(0,0,0,${(0.22 * Math.max(0.4, S.alpha)).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(cx + 2, by, 12, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
}

// ─── WARRIOR ──────────────────────────────────────────────────────────────────
// Plate knight. Sword arm = screen-left (char's right). Shield = screen-right.
// Red plumed helm and cape. Faces away; no face visible.
function drawWarrior(ctx, cx, by, sel, anim) {
    const C = {
        plDk:'#2c4464', plMid:'#435f82', plLit:'#6a90b4', plHi:'#9ac0d8',
        gold:'#c8a030',
        cDk:'#3c0606',  cMid:'#601010', cLit:'#841818',
        hDk:'#1c2e48',  hMid:'#324a6a', hLit:'#5a84aa',
        blade:'#c0d0e0', bladeHi:'#f0f8ff',
        hilt:'#b07820',  boot:'#16202e',
    };

    const t = anim?.t ?? 0;
    let dY = 0, swingT = 0;
    if (anim?.type === 'warrior_melee') {
        if (t < 0.22) {
            dY = -3 * (t / 0.22);
        } else if (t < 0.62) {
            const p = (t - 0.22) / 0.40;
            const e = 1 - Math.pow(1 - p, 3);
            dY = -3 + 14 * e;  swingT = e;
        } else {
            const p = (t - 0.62) / 0.38;
            dY = 11 - 11 * p;  swingT = 1 - p * 0.6;
        }
    }

    drawShadow(ctx, cx, by);

    // Key Y levels (legs fixed at by; upper body rises by dY toward enemies)
    const wY  = by - 26;                    // waist
    const bpB = wY - 4 - dY * 0.55;        // backplate bottom
    const bpT = bpB - 16;                   // backplate top = shoulder level
    const shY = bpT;
    const hcY = shY - 14;                   // helmet centre

    // ── Cape (behind body, drawn first) ──────────────────────────────────
    ctx.fillStyle = C.cDk;
    ctx.beginPath();
    ctx.moveTo(cx - 7, shY);
    ctx.quadraticCurveTo(cx - 18, shY + 22, cx - 15, by);
    ctx.lineTo(cx - 2, by); ctx.lineTo(cx - 2, shY + 8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.cMid;
    ctx.beginPath();
    ctx.moveTo(cx + 8, shY);
    ctx.quadraticCurveTo(cx + 18, shY + 22, cx + 14, by);
    ctx.lineTo(cx, by); ctx.lineTo(cx, shY + 8);
    ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = C.cLit; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + 5, shY + 2);
    ctx.quadraticCurveTo(cx + 12, shY + 14, cx + 9, by - 4);
    ctx.stroke();
    ctx.restore();

    // ── Sabatons (armoured boots) ─────────────────────────────────────────
    ctx.fillStyle = C.boot;
    ctx.beginPath();
    ctx.moveTo(cx-10,by); ctx.lineTo(cx-3,by); ctx.lineTo(cx-2,by-8); ctx.lineTo(cx-9,by-8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.plMid; ctx.fillRect(cx - 9, by - 9, 7, 2);
    ctx.fillStyle = C.boot;
    ctx.beginPath();
    ctx.moveTo(cx+3,by); ctx.lineTo(cx+10,by); ctx.lineTo(cx+9,by-7); ctx.lineTo(cx+3,by-7);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.plDk; ctx.fillRect(cx + 3, by - 8, 7, 2);

    // ── Greaves ───────────────────────────────────────────────────────────
    ctx.fillStyle = C.plMid; ctx.fillRect(cx - 9, by - 18, 7, 10);
    ctx.fillStyle = C.plLit; ctx.fillRect(cx - 8, by - 17, 2,  8);
    ctx.fillStyle = C.gold;  ctx.fillRect(cx - 9, by - 9,  7,  1);
    ctx.fillStyle = C.plDk;  ctx.fillRect(cx + 2, by - 16, 7,  8);
    ctx.fillStyle = C.plMid; ctx.fillRect(cx + 3, by - 15, 2,  6);
    // Knee couters
    ctx.fillStyle = C.plHi;
    ctx.beginPath(); ctx.ellipse(cx-5, by-18, 4, 2.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.plMid;
    ctx.beginPath(); ctx.ellipse(cx+6, by-16, 3, 2,   0, 0, Math.PI*2); ctx.fill();

    // ── Cuisses (thighs) ──────────────────────────────────────────────────
    ctx.fillStyle = C.plMid; ctx.fillRect(cx - 9, by - 26, 7, 8);
    ctx.fillStyle = C.plDk;  ctx.fillRect(cx + 2, by - 24, 7, 8);

    // ── Faulds / tassets ──────────────────────────────────────────────────
    ctx.fillStyle = C.plMid;
    ctx.beginPath();
    ctx.moveTo(cx-11,wY); ctx.lineTo(cx+11,wY);
    ctx.lineTo(cx+9, wY-5); ctx.lineTo(cx-9, wY-5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.gold; ctx.fillRect(cx - 11, wY - 1, 22, 1.5);
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i === 1 ? C.plLit : C.plMid;
        ctx.fillRect(cx - 7 + i * 5, wY, 4, 4);
        ctx.fillStyle = '#080c10';
        ctx.fillRect(cx - 7 + i * 5 - 0.5, wY, 0.5, 4);
    }

    // ── Backplate ─────────────────────────────────────────────────────────
    ctx.fillStyle = C.plDk;
    ctx.beginPath();
    ctx.moveTo(cx-10,bpB); ctx.lineTo(cx+10,bpB); ctx.lineTo(cx+8,bpT); ctx.lineTo(cx-8,bpT);
    ctx.closePath(); ctx.fill();
    // Spine highlight
    ctx.fillStyle = C.plLit;
    ctx.beginPath();
    ctx.moveTo(cx-1,bpB); ctx.lineTo(cx+4,bpB); ctx.lineTo(cx+3,bpT); ctx.lineTo(cx+0,bpT);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#080c10'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(cx+1,bpB); ctx.lineTo(cx+1,bpT); ctx.stroke();
    ctx.fillStyle = C.gold;
    ctx.fillRect(cx - 9, bpB - 4, 18, 1.5);
    ctx.fillRect(cx - 8, bpT + 3, 16, 1.5);

    // ── Pauldrons ─────────────────────────────────────────────────────────
    ctx.fillStyle = C.plDk;
    ctx.beginPath(); ctx.ellipse(cx-12, shY, 11, 6, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.plHi;
    ctx.beginPath(); ctx.ellipse(cx-11, shY-1, 7, 4, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C.gold; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx-12, shY, 11, 6, -0.2, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = C.plDk;
    ctx.beginPath(); ctx.ellipse(cx+12, shY,  9, 5, 0.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.plMid;
    ctx.beginPath(); ctx.ellipse(cx+11, shY-1, 6, 3.5, 0.2, 0, Math.PI*2); ctx.fill();

    // ── Shield (char's left = screen-right, partially visible) ────────────
    const sdX = cx + 13, sdY = shY + 2;
    ctx.fillStyle = '#1a3260';
    ctx.beginPath();
    ctx.moveTo(sdX,sdY); ctx.lineTo(sdX+14,sdY-5); ctx.lineTo(sdX+12,sdY-20);
    ctx.lineTo(sdX+4,sdY-26); ctx.lineTo(sdX-1,sdY-12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#304e82';
    ctx.beginPath();
    ctx.moveTo(sdX+1,sdY-1); ctx.lineTo(sdX+11,sdY-6); ctx.lineTo(sdX+10,sdY-18);
    ctx.lineTo(sdX+5,sdY-23); ctx.lineTo(sdX,sdY-12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.gold;
    ctx.beginPath(); ctx.arc(sdX+6, sdY-12, 3, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C.gold; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sdX,sdY); ctx.lineTo(sdX+14,sdY-5); ctx.lineTo(sdX+12,sdY-20);
    ctx.lineTo(sdX+4,sdY-26); ctx.lineTo(sdX-1,sdY-12); ctx.closePath(); ctx.stroke();

    // ── Sword arm (char's right = screen-left) ────────────────────────────
    // Rest: sword raised upper-left (guard).  Swing: sweeps toward enemy (upward).
    const aAncX = cx - 12, aAncY = shY + 1;
    const aA0   = -Math.PI * 0.60;   // guard pose
    const aA1   = -Math.PI * 0.35;   // forward swing
    const aAng  = aA0 + (aA1 - aA0) * swingT;
    const aLen  = 16;
    const elbX  = aAncX + Math.cos(aAng) * aLen * 0.52;
    const elbY  = aAncY + Math.sin(aAng) * aLen * 0.52;
    const hndX  = aAncX + Math.cos(aAng) * aLen;
    const hndY  = aAncY + Math.sin(aAng) * aLen;

    ctx.strokeStyle = C.plDk;  ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(aAncX,aAncY); ctx.lineTo(elbX,elbY); ctx.stroke();
    ctx.strokeStyle = C.plLit; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(aAncX,aAncY); ctx.lineTo(elbX,elbY); ctx.stroke();
    ctx.fillStyle = C.plHi;
    ctx.beginPath(); ctx.arc(elbX, elbY, 4, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C.plMid; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(elbX,elbY); ctx.lineTo(hndX,hndY); ctx.stroke();
    ctx.strokeStyle = C.plLit; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(elbX,elbY); ctx.lineTo(hndX,hndY); ctx.stroke();
    ctx.fillStyle = C.plMid;
    ctx.beginPath(); ctx.arc(hndX, hndY, 5, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C.gold; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(hndX, hndY, 5, 0, Math.PI*2); ctx.stroke();

    // Sword blade
    const bAng = aAng - 0.12;
    const bLen = 30;
    const btX  = hndX + Math.cos(bAng) * bLen;
    const btY  = hndY + Math.sin(bAng) * bLen;
    const pa   = bAng + Math.PI * 0.5;
    ctx.strokeStyle = C.hilt; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hndX + Math.cos(pa)*8, hndY + Math.sin(pa)*8);
    ctx.lineTo(hndX - Math.cos(pa)*8, hndY - Math.sin(pa)*8);
    ctx.stroke();
    const gX = hndX - Math.cos(bAng)*10, gY = hndY - Math.sin(bAng)*10;
    ctx.beginPath(); ctx.moveTo(hndX,hndY); ctx.lineTo(gX,gY); ctx.stroke();
    ctx.fillStyle = C.hilt;
    ctx.beginPath(); ctx.arc(gX, gY, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C.blade;   ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(hndX,hndY); ctx.lineTo(btX,btY); ctx.stroke();
    ctx.strokeStyle = C.bladeHi; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(hndX,hndY); ctx.lineTo(btX,btY); ctx.stroke();

    // ── Gorget + Helmet ───────────────────────────────────────────────────
    const hcX = cx;
    ctx.fillStyle = C.plDk;  ctx.fillRect(hcX - 4, hcY + 2, 8, 7);
    ctx.fillStyle = C.plMid; ctx.fillRect(hcX - 3, hcY + 3, 5, 5);
    ctx.fillStyle = C.gold;  ctx.fillRect(hcX - 4, hcY + 2, 8, 1);
    ctx.fillStyle = C.hDk;
    ctx.beginPath(); ctx.arc(hcX, hcY, 13, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.hLit;
    ctx.beginPath(); ctx.arc(hcX-2, hcY-2, 9, Math.PI*1.1, Math.PI*2.4); ctx.fill();
    // Back neck-guard
    ctx.fillStyle = C.hDk; ctx.fillRect(hcX - 8, hcY + 4, 16, 6);
    ctx.fillStyle = C.hMid;
    for (let i = 0; i < 4; i++) ctx.fillRect(hcX - 6 + i * 3.5, hcY + 5, 2, 4);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(hcX, hcY, 13, Math.PI*0.5, Math.PI*1.75); ctx.stroke();

    // ── Plume ─────────────────────────────────────────────────────────────
    const pY   = hcY - 10;
    const sway = swingT * 4;
    ctx.fillStyle = '#7a0808';
    ctx.beginPath();
    ctx.moveTo(hcX-2, pY); ctx.lineTo(hcX+2, pY);
    ctx.lineTo(hcX+4+sway, pY-17); ctx.lineTo(hcX+2+sway, pY-21);
    ctx.lineTo(hcX-1+sway*0.5, pY-17); ctx.lineTo(hcX-2, pY-8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#cc1818';
    ctx.beginPath();
    ctx.moveTo(hcX, pY-1); ctx.lineTo(hcX+2, pY-2);
    ctx.lineTo(hcX+3+sway, pY-15); ctx.lineTo(hcX+1.5+sway, pY-19);
    ctx.lineTo(hcX+0.5+sway*0.7, pY-15);
    ctx.closePath(); ctx.fill();

    if (sel) _drawSelectRing(ctx, cx, by);
}

// ─── DARK TEMPLAR ─────────────────────────────────────────────────────────────
// Black iron plate. Two-handed greatsword, no shield. Spiked horned helm.
// Tattered void-shadow cape. Void rune on breastplate glows purple.
function drawDarkTemplar(ctx, cx, by, sel, anim) {
    const C = {
        arDk:'#0a0a0e',   arMid:'#18181e', arLit:'#2a2832', arHi:'#3a3848',
        trim:'#4a1060',   trimLit:'#7020a0',
        rune:'#8020c0',   runeGl:'#c060ff',
        capeDk:'#080810', capeMid:'#100c1a', capeLit:'#1c1430',
        bladeDk:'#1a0a28', bladeMid:'#2c1448', bladeEdge:'#9040d0',
        hilt:'#2a1840',   hiltGl:'#7030b0',
        spike:'#1e1e28',  spikeTip:'#4a4060',
        boot:'#080808',
    };

    const t = anim?.t ?? 0;
    let dY = 0, swingT = 0;
    if (anim?.type === 'dark_templar_melee') {
        if (t < 0.20)      { dY = -4*(t/0.20); }
        else if (t < 0.58) { const p=(t-0.20)/0.38, e=1-Math.pow(1-p,3); dY=-4+18*e; swingT=e; }
        else               { const p=(t-0.58)/0.42; dY=14-14*p; swingT=1-p*0.5; }
    }

    drawShadow(ctx, cx, by);

    const wY  = by - 26;
    const bpB = wY - 4 - dY*0.55;
    const bpT = bpB - 18;
    const shY = bpT;
    const hcY = shY - 15;

    // ── Void-shadow cape (behind body) ────────────────────────────────────
    ctx.fillStyle = C.capeDk;
    ctx.beginPath();
    ctx.moveTo(cx-6, shY); ctx.quadraticCurveTo(cx-22, shY+20, cx-18, by);
    ctx.lineTo(cx-3, by); ctx.lineTo(cx-2, shY+6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.capeMid;
    ctx.beginPath();
    ctx.moveTo(cx+7, shY); ctx.quadraticCurveTo(cx+20, shY+18, cx+16, by);
    ctx.lineTo(cx+1, by); ctx.lineTo(cx+1, shY+6); ctx.closePath(); ctx.fill();
    // Ragged cape hem tears
    ctx.fillStyle = C.capeDk;
    for (let i = 0; i < 4; i++) {
        const tx = cx - 16 + i * 9, th = 6 + (i % 2) * 4;
        ctx.beginPath(); ctx.moveTo(tx, by); ctx.lineTo(tx+4, by); ctx.lineTo(tx+2, by+th); ctx.closePath(); ctx.fill();
    }
    // Shadow wisps along cape edge during swing
    if (swingT > 0) {
        ctx.save(); ctx.globalAlpha = swingT * 0.35; ctx.strokeStyle = C.runeGl; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const wy = shY + 8 + i * 12, wx = cx - 18 + swingT * 6;
            ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx-6, wy+4, wx-3, wy+9); ctx.stroke();
        }
        ctx.restore();
    }

    // ── Sabatons ──────────────────────────────────────────────────────────
    ctx.fillStyle = C.boot;
    ctx.beginPath(); ctx.moveTo(cx-11,by); ctx.lineTo(cx-3,by); ctx.lineTo(cx-2,by-8); ctx.lineTo(cx-10,by-8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.arMid; ctx.fillRect(cx-10, by-9, 8, 2);
    ctx.fillStyle = C.boot;
    ctx.beginPath(); ctx.moveTo(cx+3,by); ctx.lineTo(cx+11,by); ctx.lineTo(cx+10,by-7); ctx.lineTo(cx+3,by-7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.arDk; ctx.fillRect(cx+3, by-8, 8, 2);

    // ── Greaves ───────────────────────────────────────────────────────────
    ctx.fillStyle = C.arMid; ctx.fillRect(cx-10, by-18, 8, 10);
    ctx.fillStyle = C.arLit; ctx.fillRect(cx-9,  by-17, 2,  8);
    ctx.fillStyle = C.trim;  ctx.fillRect(cx-10, by-9,  8,  1);
    ctx.fillStyle = C.arDk;  ctx.fillRect(cx+2,  by-16, 8,  8);
    ctx.fillStyle = C.arMid; ctx.fillRect(cx+3,  by-15, 2,  6);
    ctx.fillStyle = C.arHi;
    ctx.beginPath(); ctx.ellipse(cx-5, by-18, 4.5, 2.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.arMid;
    ctx.beginPath(); ctx.ellipse(cx+6, by-16, 3.5, 2,   0, 0, Math.PI*2); ctx.fill();
    // Spike on knee
    ctx.fillStyle = C.spikeTip;
    ctx.beginPath(); ctx.moveTo(cx-5, by-20.5); ctx.lineTo(cx-7, by-26); ctx.lineTo(cx-3, by-26); ctx.closePath(); ctx.fill();

    // ── Cuisses ───────────────────────────────────────────────────────────
    ctx.fillStyle = C.arMid; ctx.fillRect(cx-10, by-26, 8, 8);
    ctx.fillStyle = C.arDk;  ctx.fillRect(cx+2,  by-24, 8, 8);

    // ── Faulds ────────────────────────────────────────────────────────────
    ctx.fillStyle = C.arMid;
    ctx.beginPath(); ctx.moveTo(cx-12,wY); ctx.lineTo(cx+12,wY); ctx.lineTo(cx+10,wY-5); ctx.lineTo(cx-10,wY-5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.trim; ctx.fillRect(cx-12, wY-1, 24, 1.5);
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = C.arDk; ctx.fillRect(cx-7+i*5, wY, 4, 4);
        ctx.fillStyle = '#000005'; ctx.fillRect(cx-7+i*5-0.5, wY, 0.5, 4);
    }

    // ── Backplate ─────────────────────────────────────────────────────────
    ctx.fillStyle = C.arDk;
    ctx.beginPath(); ctx.moveTo(cx-11,bpB); ctx.lineTo(cx+11,bpB); ctx.lineTo(cx+9,bpT); ctx.lineTo(cx-9,bpT); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.arMid;
    ctx.beginPath(); ctx.moveTo(cx-1,bpB); ctx.lineTo(cx+4,bpB); ctx.lineTo(cx+3,bpT); ctx.lineTo(cx,bpT); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.trim; ctx.fillRect(cx-10, bpB-4, 20, 1.5);
    ctx.fillStyle = C.trim; ctx.fillRect(cx-8,  bpT+3, 16, 1.5);

    // ── Void rune on breastplate ──────────────────────────────────────────
    const runeA = 0.35 + swingT * 0.50;
    ctx.save(); ctx.globalAlpha = runeA;
    if (swingT > 0) { ctx.shadowColor = C.runeGl; ctx.shadowBlur = 8 + swingT * 14; }
    ctx.strokeStyle = C.rune; ctx.lineWidth = 0.9;
    const rY = (bpT + bpB) / 2;
    ctx.beginPath(); ctx.arc(cx+1, rY, 5, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+1, rY-5); ctx.lineTo(cx+1, rY+5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-4, rY-2); ctx.lineTo(cx+6, rY+2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-4, rY+2); ctx.lineTo(cx+6, rY-2); ctx.stroke();
    ctx.restore();

    // ── Pauldrons (spiked) ────────────────────────────────────────────────
    ctx.fillStyle = C.arDk;
    ctx.beginPath(); ctx.ellipse(cx-13, shY, 12, 6.5, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.arLit;
    ctx.beginPath(); ctx.ellipse(cx-12, shY-1, 8,  4,  -0.2, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C.trim; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(cx-13, shY, 12, 6.5, -0.2, 0, Math.PI*2); ctx.stroke();
    // Left pauldron spike
    ctx.fillStyle = C.spike;
    ctx.beginPath(); ctx.moveTo(cx-16, shY-4); ctx.lineTo(cx-10, shY-4); ctx.lineTo(cx-13, shY-15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.spikeTip;
    ctx.beginPath(); ctx.moveTo(cx-14.5, shY-10); ctx.lineTo(cx-11.5, shY-10); ctx.lineTo(cx-13, shY-15); ctx.closePath(); ctx.fill();

    ctx.fillStyle = C.arDk;
    ctx.beginPath(); ctx.ellipse(cx+13, shY, 10, 6,  0.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.arMid;
    ctx.beginPath(); ctx.ellipse(cx+12, shY-1, 7, 4,  0.2, 0, Math.PI*2); ctx.fill();
    // Right pauldron spike
    ctx.fillStyle = C.spike;
    ctx.beginPath(); ctx.moveTo(cx+10, shY-4); ctx.lineTo(cx+16, shY-4); ctx.lineTo(cx+13, shY-14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.spikeTip;
    ctx.beginPath(); ctx.moveTo(cx+11.5, shY-9); ctx.lineTo(cx+14.5, shY-9); ctx.lineTo(cx+13, shY-14); ctx.closePath(); ctx.fill();

    // ── Greatsword (two hands, held left-forward high guard) ──────────────
    const a0 = -Math.PI * 0.72;
    const a1 = -Math.PI * 0.25;
    const sA = a0 + (a1 - a0) * swingT;
    // Upper hand (right arm, screen-left shoulder)
    const uHX = cx - 10, uHY = shY + 3;
    // Lower hand (extends below)
    const lHX = uHX + Math.cos(sA + Math.PI) * 9;
    const lHY = uHY + Math.sin(sA + Math.PI) * 9;
    // Blade tip
    const bLen = 38;
    const btX  = uHX + Math.cos(sA) * bLen;
    const btY  = uHY + Math.sin(sA) * bLen;

    // Arms
    ctx.strokeStyle = C.arDk; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx-11, shY+2); ctx.lineTo(lHX, lHY); ctx.stroke();
    ctx.strokeStyle = C.arLit; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx-11, shY+2); ctx.lineTo(lHX, lHY); ctx.stroke();
    ctx.strokeStyle = C.arDk; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(cx+10, shY+3); ctx.lineTo(uHX+4, uHY+5); ctx.stroke();
    ctx.strokeStyle = C.arMid; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx+10, shY+3); ctx.lineTo(uHX+4, uHY+5); ctx.stroke();

    // Grip
    ctx.strokeStyle = C.hilt; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(lHX, lHY); ctx.lineTo(uHX, uHY); ctx.stroke();

    // Crossguard
    const gA = sA + Math.PI * 0.5;
    ctx.strokeStyle = C.hilt; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(uHX + Math.cos(gA)*10, uHY + Math.sin(gA)*10);
    ctx.lineTo(uHX - Math.cos(gA)*10, uHY - Math.sin(gA)*10);
    ctx.stroke();
    ctx.strokeStyle = C.hiltGl; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(uHX + Math.cos(gA)*10, uHY + Math.sin(gA)*10);
    ctx.lineTo(uHX - Math.cos(gA)*10, uHY - Math.sin(gA)*10);
    ctx.stroke();

    // Blade body (dark, near-void)
    ctx.strokeStyle = C.bladeDk; ctx.lineWidth = 5; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(uHX, uHY); ctx.lineTo(btX, btY); ctx.stroke();
    ctx.strokeStyle = C.bladeMid; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(uHX, uHY); ctx.lineTo(btX, btY); ctx.stroke();
    // Void edge glow
    ctx.save();
    ctx.globalAlpha = 0.45 + swingT * 0.45;
    if (swingT > 0) { ctx.shadowColor = C.bladeEdge; ctx.shadowBlur = 6 + swingT * 12; }
    ctx.strokeStyle = C.bladeEdge; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(uHX, uHY); ctx.lineTo(btX, btY); ctx.stroke();
    ctx.restore();

    // ── Gorget + Helmet ───────────────────────────────────────────────────
    const hcX = cx;
    ctx.fillStyle = C.arDk;  ctx.fillRect(hcX-4, hcY+2, 8, 8);
    ctx.fillStyle = C.arMid; ctx.fillRect(hcX-3, hcY+3, 5, 6);
    ctx.fillStyle = C.trim;  ctx.fillRect(hcX-4, hcY+2, 8, 1);
    // Helm bowl
    ctx.fillStyle = C.arDk;
    ctx.beginPath(); ctx.arc(hcX, hcY, 13, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.arLit;
    ctx.beginPath(); ctx.arc(hcX-2, hcY-2, 8, Math.PI*1.1, Math.PI*2.4); ctx.fill();
    ctx.fillStyle = C.arDk; ctx.fillRect(hcX-8, hcY+4, 16, 7);
    ctx.fillStyle = C.arMid;
    for (let i = 0; i < 4; i++) ctx.fillRect(hcX-6+i*3.5, hcY+5, 2, 5);
    ctx.strokeStyle = C.trim; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(hcX, hcY, 13, Math.PI*0.5, Math.PI*1.75); ctx.stroke();
    // Visor slit (glowing void-purple)
    ctx.save();
    ctx.globalAlpha = 0.70 + swingT * 0.25;
    ctx.shadowColor = C.runeGl; ctx.shadowBlur = 4 + swingT * 8;
    ctx.fillStyle = C.runeGl;
    ctx.fillRect(hcX-6, hcY-1, 5, 1.5);
    ctx.fillRect(hcX+1, hcY-1, 5, 1.5);
    ctx.restore();
    // Central helm spike
    ctx.fillStyle = C.spike;
    ctx.beginPath(); ctx.moveTo(hcX-3, hcY-11); ctx.lineTo(hcX+3, hcY-11); ctx.lineTo(hcX, hcY-24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.spikeTip;
    ctx.beginPath(); ctx.moveTo(hcX-1.5, hcY-17); ctx.lineTo(hcX+1.5, hcY-17); ctx.lineTo(hcX, hcY-24); ctx.closePath(); ctx.fill();
    // Two side horns
    ctx.fillStyle = C.arDk;
    ctx.beginPath(); ctx.moveTo(hcX-12, hcY-6); ctx.lineTo(hcX-14, hcY-8); ctx.lineTo(hcX-10, hcY-18); ctx.lineTo(hcX-8, hcY-16); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hcX+12, hcY-6); ctx.lineTo(hcX+14, hcY-8); ctx.lineTo(hcX+10, hcY-18); ctx.lineTo(hcX+8, hcY-16); ctx.closePath(); ctx.fill();

    if (sel) _drawSelectRing(ctx, cx, by);
}

// ─── WIZARD ───────────────────────────────────────────────────────────────────
// Robed mage. Staff arm = screen-left (char's right). Tall pointed hat.
// Arcane rune visible on robe back. Staff raises and orb charges during cast.
function drawWizard(ctx, cx, by, sel, anim) {
    const C = {
        rDk:'#2e0a4a', rMid:'#4a1270', rLit:'#6e1e9e', rFold:'#3e0e60',
        sash:'#c8a030', sashDk:'#907020',
        hDk:'#1e0638', hMid:'#2e0a50', hBrim:'#160426',
        star:'#9060d8',
        stWd:'#7a4a18', stLt:'#a06828',
        orb:'#50d0ff', orbIn:'#c0f0ff', orbGl:'#40a8ee',
        skin:'#c8a878',
        rune:'#9060e0',
    };

    const t = anim?.t ?? 0;
    let dY = 0, staffRaise = 0, orbPulse = 0;
    if (anim?.type === 'wizard_spell') {
        if (t < 0.30) {
            staffRaise = t / 0.30;
        } else if (t < 0.60) {
            staffRaise = 1;
            orbPulse = (t - 0.30) / 0.30;
            dY = orbPulse * 3;
        } else if (t < 0.72) {
            const p = (t - 0.60) / 0.12;
            staffRaise = 1;
            orbPulse = 1 + p * 2;   // flash at release
            dY = 3 - p * 3;
        } else {
            const p = (t - 0.72) / 0.28;
            staffRaise = 1 - p * 0.5;
            orbPulse = 0;
        }
    }

    drawShadow(ctx, cx, by);

    // ── Robe skirt (wide billow) ──────────────────────────────────────────
    ctx.fillStyle = C.rDk;
    ctx.beginPath();
    ctx.moveTo(cx-15,by); ctx.lineTo(cx+15,by); ctx.lineTo(cx+11,by-38); ctx.lineTo(cx-10,by-38);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.rLit;
    ctx.beginPath();
    ctx.moveTo(cx-2,by); ctx.lineTo(cx+6,by); ctx.lineTo(cx+5,by-38); ctx.lineTo(cx-1,by-38);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.rDk;
    ctx.beginPath();
    ctx.moveTo(cx+8,by); ctx.lineTo(cx+15,by); ctx.lineTo(cx+11,by-38); ctx.lineTo(cx+8,by-38);
    ctx.closePath(); ctx.fill();
    // Fold lines
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = C.rLit; ctx.lineWidth = 0.9;
    for (let i = 0; i < 3; i++) {
        const fx = cx - 8 + i * 7;
        ctx.beginPath(); ctx.moveTo(fx, by); ctx.lineTo(fx - 1, by - 36); ctx.stroke();
    }
    ctx.restore();

    // Sash
    ctx.fillStyle = C.sashDk; ctx.fillRect(cx - 10, by - 32, 22, 4);
    ctx.fillStyle = C.sash;   ctx.fillRect(cx - 10, by - 33, 22, 3);

    // Arcane rune on robe back (glows stronger during cast)
    const runeAlpha = 0.30 + Math.min(1, orbPulse) * 0.30;
    ctx.save();
    ctx.globalAlpha = runeAlpha;
    ctx.strokeStyle = C.rLit; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(cx, by-20, 6, 0, Math.PI*2); ctx.stroke();
    for (let a = 0; a < 4; a++) {
        const ang = a * Math.PI * 0.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang)*3, by-20 + Math.sin(ang)*3);
        ctx.lineTo(cx + Math.cos(ang)*8, by-20 + Math.sin(ang)*8);
        ctx.stroke();
    }
    ctx.restore();

    // ── Upper robe + shoulders ─────────────────────────────────────────────
    const shY = by - 38 - dY * 0.70;
    ctx.fillStyle = C.rDk;
    ctx.beginPath();
    ctx.moveTo(cx-10, by-38); ctx.lineTo(cx+11, by-38);
    ctx.lineTo(cx+9, shY-14); ctx.lineTo(cx-8, shY-14);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.rMid;
    ctx.beginPath();
    ctx.moveTo(cx-1, by-38); ctx.lineTo(cx+6, by-38);
    ctx.lineTo(cx+5, shY-14); ctx.lineTo(cx-0, shY-14);
    ctx.closePath(); ctx.fill();
    const upShY = shY - 14;

    // ── Free arm (char's left = screen-right) ─────────────────────────────
    ctx.fillStyle = C.rDk;
    ctx.beginPath();
    ctx.moveTo(cx+10, upShY); ctx.lineTo(cx+17, upShY+6); ctx.lineTo(cx+18, upShY+14);
    ctx.lineTo(cx+14, upShY+16); ctx.lineTo(cx+8, upShY+10);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.skin;
    ctx.beginPath(); ctx.arc(cx+17, upShY+14, 4, 0, Math.PI*2); ctx.fill();

    // ── Staff arm (char's right = screen-left) ────────────────────────────
    const stAncX = cx - 10, stAncY = upShY + 2;
    // Rest: staff nearly vertical (pointing up). Cast: tilts toward enemies (upper-left).
    const stA0  = -Math.PI * 0.50;   // straight up at rest
    const stA1  = -Math.PI * 0.68;   // angled upper-left during cast
    const stAng = stA0 + (stA1 - stA0) * staffRaise;
    const stLen = 42;
    const orbX  = stAncX + Math.cos(stAng) * stLen;
    const orbY  = stAncY + Math.sin(stAng) * stLen;

    // Staff pole
    ctx.strokeStyle = C.stWd; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(stAncX, stAncY); ctx.lineTo(orbX, orbY); ctx.stroke();
    ctx.strokeStyle = C.stLt; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(stAncX, stAncY); ctx.lineTo(orbX, orbY); ctx.stroke();

    // Staff arm sleeve
    ctx.fillStyle = C.rDk;
    ctx.beginPath();
    ctx.moveTo(stAncX, stAncY); ctx.lineTo(stAncX-8, stAncY+8);
    ctx.lineTo(stAncX-6, stAncY+14); ctx.lineTo(stAncX, stAncY+8);
    ctx.closePath(); ctx.fill();

    // Orb
    const glowBlur = 12 + Math.min(1, orbPulse) * 20;
    ctx.save();
    ctx.shadowColor = C.orbGl;
    ctx.shadowBlur  = glowBlur;
    ctx.globalAlpha = 0.75 + Math.min(1, orbPulse) * 0.20;
    ctx.fillStyle   = C.orb;
    ctx.beginPath(); ctx.arc(orbX, orbY, 8, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle  = C.orbIn;
    ctx.beginPath(); ctx.arc(orbX-2, orbY-2, 5, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    // Charge ring
    if (orbPulse > 0 && orbPulse <= 1) {
        ctx.save();
        ctx.globalAlpha  = orbPulse * 0.5;
        ctx.strokeStyle  = C.orb; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(orbX, orbY, 10 + orbPulse * 8, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
    }
    // Release flash
    if (orbPulse > 1) {
        ctx.save();
        ctx.globalAlpha  = Math.min(1, (orbPulse - 1) * 0.9);
        ctx.shadowColor  = '#ffffff'; ctx.shadowBlur = 28;
        ctx.fillStyle    = '#d0f0ff';
        ctx.beginPath(); ctx.arc(orbX, orbY, 12, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    // ── Head and hat ──────────────────────────────────────────────────────
    const hcX = cx;
    const hcY = upShY - 10 - dY;

    // Back of head / nape
    ctx.fillStyle = '#1c0830';
    ctx.beginPath(); ctx.arc(hcX, hcY, 10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.skin;
    ctx.beginPath(); ctx.arc(hcX+1, hcY+1, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a0a00';
    ctx.beginPath(); ctx.arc(hcX, hcY-2, 8, Math.PI*1.1, Math.PI*2.2); ctx.fill();
    ctx.fillStyle = C.skin; ctx.fillRect(hcX - 3, hcY + 6, 6, 4);

    // Hat brim
    ctx.fillStyle = C.hBrim;
    ctx.beginPath(); ctx.ellipse(hcX, hcY-8, 15, 6, 0, 0, Math.PI*2); ctx.fill();

    // Hat cone (back face visible)
    ctx.fillStyle = C.hDk;
    ctx.beginPath();
    ctx.moveTo(hcX-12, hcY-8); ctx.lineTo(hcX+14, hcY-8);
    ctx.lineTo(hcX+5,  hcY-38); ctx.lineTo(hcX+1,  hcY-42);
    ctx.lineTo(hcX-2,  hcY-38); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.hMid;
    ctx.beginPath();
    ctx.moveTo(hcX+2,  hcY-9); ctx.lineTo(hcX+14, hcY-8);
    ctx.lineTo(hcX+5,  hcY-38); ctx.lineTo(hcX+2,  hcY-36);
    ctx.closePath(); ctx.fill();

    // Stars on hat
    ctx.save();
    ctx.fillStyle  = C.star;
    ctx.globalAlpha = 0.55 + Math.min(1, orbPulse) * 0.30;
    for (const [sx, sy] of [[-4,-18],[4,-28],[-2,-32],[6,-22],[1,-14]]) {
        ctx.beginPath(); ctx.arc(hcX+sx, hcY+sy, 1.2, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();

    // Hat band
    ctx.fillStyle = C.sash;
    ctx.beginPath(); ctx.ellipse(hcX+1, hcY-11, 11, 4, 0, 0, Math.PI*2); ctx.fill();

    if (sel) _drawSelectRing(ctx, cx, by);
}

// ─── ROGUE ────────────────────────────────────────────────────────────────────
// Hooded assassin. Dual daggers at belt. Short bow slung / raised for bow attacks.
// Left hood eye faintly glowing amber. Quiver on back.
function drawRogue(ctx, cx, by, sel, anim) {
    const C = {
        cDk:'#1a2010', cMid:'#2e3a1a', cLit:'#425428',
        lth:'#4a3018',  lthLt:'#6a4828',
        blade:'#c0d0e0', bladeHi:'#f0f8ff', hilt:'#885018',
        boot:'#100c06',
        sDk:'#906040',  skin:'#b07850',
        hDk:'#141c0a',  hMid:'#202e10', hLit:'#384a1e',
        eyes:'#c07828', eyeGl:'rgba(192,120,40,0.5)',
        bowWd:'#704020', bowStr:'#c8c090',
        quiv:'#3a2008',  arrow:'#805020',
    };

    const t = anim?.t ?? 0;
    let dY = 0, stabT = 0, bowDraw = 0;
    if (anim?.type === 'rogue_stab') {
        if (t < 0.18) {
            const p = t / 0.18;
            dY = -4 * p;
        } else if (t < 0.50) {
            const p = (t - 0.18) / 0.32;
            const e = 1 - Math.pow(1 - p, 3);
            dY = -4 + 16 * e;  stabT = e;
        } else {
            const p = (t - 0.50) / 0.50;
            dY = 12 - 12 * p;  stabT = 1 - p * 0.5;
        }
    } else if (anim?.type === 'rogue_bow') {
        if (t < 0.50) {
            bowDraw = t / 0.50;  dY = bowDraw * 2;
        } else if (t < 0.62) {
            bowDraw = 1;  dY = 2;
        } else {
            const p = (t - 0.62) / 0.38;
            bowDraw = 1 - p * 0.8;  dY = 2 - 2 * p;
        }
    }

    drawShadow(ctx, cx, by);

    // ── Cloak tail (behind body) ──────────────────────────────────────────
    const shY = by - 38 - dY * 0.70;
    ctx.fillStyle = C.cDk;
    ctx.beginPath();
    ctx.moveTo(cx-6, shY); ctx.quadraticCurveTo(cx-16, shY+20, cx-14, by);
    ctx.lineTo(cx-2, by); ctx.lineTo(cx-2, shY+8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.cMid;
    ctx.beginPath();
    ctx.moveTo(cx+7, shY); ctx.quadraticCurveTo(cx+15, shY+20, cx+12, by);
    ctx.lineTo(cx+0, by); ctx.lineTo(cx+1, shY+8); ctx.closePath(); ctx.fill();

    // ── Boots ─────────────────────────────────────────────────────────────
    ctx.fillStyle = C.boot;
    ctx.fillRect(cx - 9, by - 5, 6, 5);
    ctx.fillRect(cx + 3, by - 4, 6, 4);

    // ── Legs (leather) ────────────────────────────────────────────────────
    ctx.fillStyle = C.lth;  ctx.fillRect(cx - 8, by - 20, 5, 15);
    ctx.fillStyle = C.cDk;  ctx.fillRect(cx + 3, by - 18, 5, 14);

    // ── Torso (leather armour from behind) ────────────────────────────────
    const tbY = by - 20 - dY * 0.45;
    ctx.fillStyle = C.cDk;
    ctx.beginPath();
    ctx.moveTo(cx-8,tbY); ctx.lineTo(cx+8,tbY); ctx.lineTo(cx+7,tbY-18); ctx.lineTo(cx-7,tbY-18);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.lth;
    ctx.beginPath();
    ctx.moveTo(cx-1,tbY); ctx.lineTo(cx+5,tbY); ctx.lineTo(cx+4,tbY-18); ctx.lineTo(cx-0,tbY-18);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.hilt; ctx.fillRect(cx - 8, tbY - 4, 16, 2);   // belt

    // ── Quiver ────────────────────────────────────────────────────────────
    ctx.fillStyle = C.quiv; ctx.fillRect(cx + 7, tbY - 22, 5, 14);
    ctx.fillStyle = C.arrow;
    for (let i = 0; i < 3; i++) ctx.fillRect(cx + 8 + i, tbY - 26, 1, 5);

    // ── Daggers at belt (extend during stab) ──────────────────────────────
    const d1X = cx - 6 - stabT * 14, d1Y = tbY - 3 - stabT * 10;
    ctx.strokeStyle = C.hilt; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(d1X, d1Y); ctx.lineTo(d1X-2, d1Y-2); ctx.stroke();
    ctx.strokeStyle = C.blade;    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(d1X-2, d1Y-2); ctx.lineTo(d1X-9, d1Y-15); ctx.stroke();
    ctx.strokeStyle = C.bladeHi;  ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(d1X-2, d1Y-2); ctx.lineTo(d1X-9, d1Y-15); ctx.stroke();

    const d2X = cx + 6 + stabT * 8,  d2Y = tbY - 3 - stabT * 6;
    ctx.strokeStyle = C.hilt; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(d2X, d2Y); ctx.lineTo(d2X+2, d2Y-2); ctx.stroke();
    ctx.strokeStyle = C.cDk; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(d2X+2, d2Y-2); ctx.lineTo(d2X+7, d2Y-11); ctx.stroke();

    // ── Bow (raised during bow attack) ────────────────────────────────────
    const bAncX = cx - 10, bAncY = tbY - 20 - dY * 0.20;
    // Rest: vertical. Draw: angled toward enemy (upper-left).
    const bA0   = -Math.PI * 0.50;
    const bA1   = -Math.PI * 0.28;
    const bCurA = bA0 + (bA1 - bA0) * bowDraw;
    const bR    = 15;
    const bTU   = { x: bAncX + Math.cos(bCurA - 0.55)*bR, y: bAncY + Math.sin(bCurA - 0.55)*bR };
    const bTL   = { x: bAncX + Math.cos(bCurA + 0.55)*bR, y: bAncY + Math.sin(bCurA + 0.55)*bR };

    ctx.strokeStyle = C.bowWd; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bTU.x, bTU.y);
    ctx.quadraticCurveTo(bAncX + Math.cos(bCurA)*(bR+6), bAncY + Math.sin(bCurA)*(bR+6), bTL.x, bTL.y);
    ctx.stroke();

    const pull = bowDraw * 11;
    const sMX  = bAncX - Math.cos(bCurA) * pull;
    const sMY  = bAncY - Math.sin(bCurA) * pull;
    ctx.strokeStyle = C.bowStr; ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(bTU.x, bTU.y); ctx.lineTo(sMX, sMY); ctx.lineTo(bTL.x, bTL.y);
    ctx.stroke();

    if (bowDraw > 0.08) {
        ctx.strokeStyle = C.arrow; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sMX, sMY);
        ctx.lineTo(sMX + Math.cos(bCurA + Math.PI)*20, sMY + Math.sin(bCurA + Math.PI)*20);
        ctx.stroke();
    }

    // ── Shoulders ─────────────────────────────────────────────────────────
    ctx.fillStyle = C.cDk;
    ctx.beginPath(); ctx.ellipse(cx-10, shY, 8, 5, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.cMid;
    ctx.beginPath(); ctx.ellipse(cx-9, shY-1, 5, 3, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.cDk;
    ctx.beginPath(); ctx.ellipse(cx+10, shY, 7, 4,  0.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.cMid;
    ctx.beginPath(); ctx.ellipse(cx+9, shY-1, 4, 3,  0.2, 0, Math.PI*2); ctx.fill();

    // ── Hood / head ───────────────────────────────────────────────────────
    const hcX = cx, hcY = shY - 13 - dY;

    ctx.fillStyle = C.hDk;
    ctx.beginPath(); ctx.arc(hcX, hcY, 12, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.hLit;
    ctx.beginPath(); ctx.arc(hcX-3, hcY-2, 8, Math.PI*0.9, Math.PI*2.3); ctx.fill();
    ctx.fillStyle = C.hMid;
    ctx.beginPath(); ctx.arc(hcX+2, hcY, 8, Math.PI*0.1, Math.PI*1.2); ctx.fill();

    // Eye (amber glow visible under hood from the side)
    ctx.save();
    ctx.globalAlpha  = 0.65;
    ctx.shadowColor  = C.eyeGl; ctx.shadowBlur = 6;
    ctx.fillStyle    = C.eyes;
    ctx.beginPath(); ctx.arc(hcX+4, hcY, 2, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // Hood peak
    ctx.fillStyle = C.hDk;
    ctx.beginPath();
    ctx.moveTo(hcX-6, hcY-10); ctx.lineTo(hcX+6, hcY-10);
    ctx.lineTo(hcX+4, hcY-22); ctx.lineTo(hcX,   hcY-26);
    ctx.lineTo(hcX-2, hcY-22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.hMid;
    ctx.beginPath();
    ctx.moveTo(hcX+2, hcY-10); ctx.lineTo(hcX+6, hcY-10);
    ctx.lineTo(hcX+4, hcY-22); ctx.lineTo(hcX+1, hcY-24);
    ctx.closePath(); ctx.fill();

    if (sel) _drawSelectRing(ctx, cx, by);
}

// ── Cleric ────────────────────────────────────────────────────────────────────
function drawCleric(ctx, cx, by, sel, anim) {
    const C = {
        pl:'#c0ccd8',   plLit:'#e0ecf8', plDk:'#7888a0',  plHi:'#f0f8ff',
        tab:'#e8e2d4',  tabDk:'#b0a890', cross:'#c8a030',
        gold:'#c8a030', goldDk:'#907020',
        hDk:'#687078',  hMid:'#8890a0',  hLit:'#b0b8c4',
        maceH:'#b0bcc8',maceDk:'#4e606e',
        boot:'#303840', skin:'#c8a878',
    };
    const t = anim?.t ?? 0;
    let dY = 0, smiteT = 0, spellT = 0, holyPulse = 0;
    if (anim?.type === 'cleric_smite') {
        if (t < 0.25)      { dY = -4*(t/0.25); smiteT = t/0.25; }
        else if (t < 0.60) { const p=(t-0.25)/0.35, e=1-Math.pow(1-p,2); dY=-4+16*e; smiteT=1-e*0.5; holyPulse=e; }
        else               { const p=(t-0.60)/0.40; dY=12-12*p; holyPulse=1-p; }
    } else if (anim?.type === 'cleric_spell') {
        if (t < 0.35)      { spellT=t/0.35; dY=spellT*2; }
        else if (t < 0.65) { const p=(t-0.35)/0.30; spellT=1; holyPulse=p; dY=2+p; }
        else if (t < 0.75) { const p=(t-0.65)/0.10; spellT=1; holyPulse=1+p*1.5; dY=3-p*3; }
        else               { const p=(t-0.75)/0.25; spellT=1-p*0.4; holyPulse=0; }
    }
    drawShadow(ctx, cx, by);
    const shY = by - 36 - dY*0.6;
    // Boots
    ctx.fillStyle=C.boot; ctx.fillRect(cx-10,by-5,7,5); ctx.fillRect(cx+3,by-4,7,4);
    ctx.fillStyle=C.pl; ctx.fillRect(cx-10,by-7,7,2);
    ctx.fillStyle=C.plDk; ctx.fillRect(cx+3,by-6,7,2);
    // Greaves
    ctx.fillStyle=C.pl; ctx.fillRect(cx-9,by-18,7,11);
    ctx.fillStyle=C.plLit; ctx.fillRect(cx-8,by-17,2,9);
    ctx.fillStyle=C.plDk; ctx.fillRect(cx+2,by-16,7,10);
    ctx.fillStyle=C.pl; ctx.fillRect(cx+3,by-15,2,8);
    ctx.fillStyle=C.gold; ctx.fillRect(cx-9,by-9,7,1.5);
    ctx.fillStyle=C.plLit; ctx.beginPath(); ctx.ellipse(cx-5,by-18,4,2.5,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.pl; ctx.beginPath(); ctx.ellipse(cx+6,by-16,3,2,0,0,Math.PI*2); ctx.fill();
    // Cuisses + tabard skirt
    ctx.fillStyle=C.pl; ctx.fillRect(cx-9,by-26,7,8); ctx.fillRect(cx+2,by-24,7,8);
    const wY=by-26;
    ctx.fillStyle=C.tab;
    ctx.beginPath(); ctx.moveTo(cx-8,wY); ctx.lineTo(cx+8,wY); ctx.lineTo(cx+6,wY-5); ctx.lineTo(cx-6,wY-5); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.gold; ctx.fillRect(cx-8,wY-1,16,1.5);
    // Backplate
    const bpB=wY-5-dY*0.45, bpT=bpB-16;
    ctx.fillStyle=C.plDk;
    ctx.beginPath(); ctx.moveTo(cx-10,bpB); ctx.lineTo(cx+10,bpB); ctx.lineTo(cx+8,bpT); ctx.lineTo(cx-8,bpT); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.tab;
    ctx.beginPath(); ctx.moveTo(cx-0,bpB); ctx.lineTo(cx+6,bpB); ctx.lineTo(cx+5,bpT); ctx.lineTo(cx+0,bpT); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.gold; ctx.fillRect(cx-9,bpB-2,18,1.5);
    // Cross on tabard
    ctx.save(); ctx.globalAlpha=0.30+holyPulse*0.55;
    ctx.fillStyle=C.cross;
    ctx.fillRect(cx+1,bpT+4,2,9); ctx.fillRect(cx-2,bpT+8,8,2);
    ctx.restore();
    // Pauldrons
    ctx.fillStyle=C.plDk; ctx.beginPath(); ctx.ellipse(cx-12,shY,10,5.5,-0.15,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.plLit; ctx.beginPath(); ctx.ellipse(cx-11,shY-1,7,3.5,-0.15,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=C.gold; ctx.lineWidth=0.8; ctx.beginPath(); ctx.ellipse(cx-12,shY,10,5.5,-0.15,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle=C.plDk; ctx.beginPath(); ctx.ellipse(cx+12,shY,9,5,0.15,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.pl; ctx.beginPath(); ctx.ellipse(cx+11,shY-1,6,3.5,0.15,0,Math.PI*2); ctx.fill();
    // Shield (right side)
    const sdX=cx+13, sdY=shY+2;
    ctx.fillStyle='#1e3498';
    ctx.beginPath(); ctx.moveTo(sdX,sdY); ctx.lineTo(sdX+13,sdY-4); ctx.lineTo(sdX+11,sdY-18); ctx.lineTo(sdX+3,sdY-24); ctx.lineTo(sdX-1,sdY-11); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#2e48c8';
    ctx.beginPath(); ctx.moveTo(sdX+1,sdY-1); ctx.lineTo(sdX+10,sdY-5); ctx.lineTo(sdX+9,sdY-16); ctx.lineTo(sdX+4,sdY-21); ctx.lineTo(sdX,sdY-11); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalAlpha=0.85; ctx.fillStyle=C.gold;
    ctx.fillRect(sdX+4,sdY-17,2,9); ctx.fillRect(sdX+1,sdY-13,8,2);
    ctx.restore();
    ctx.strokeStyle=C.gold; ctx.lineWidth=0.9;
    ctx.beginPath(); ctx.moveTo(sdX,sdY); ctx.lineTo(sdX+13,sdY-4); ctx.lineTo(sdX+11,sdY-18); ctx.lineTo(sdX+3,sdY-24); ctx.lineTo(sdX-1,sdY-11); ctx.closePath(); ctx.stroke();
    // Mace arm (left/attacking side)
    const aAncX=cx-11, aAncY=shY+1;
    const aA0=-Math.PI*0.55, aA1=-Math.PI*0.22;
    const aA2=-Math.PI*0.72;
    let armAng = aA0 + (aA1-aA0)*(smiteT>0 ? 1-smiteT : 0);
    if (spellT>0) armAng = aA0 + (aA2-aA0)*spellT;
    const aLen=15, elbX=aAncX+Math.cos(armAng)*aLen*0.5, elbY=aAncY+Math.sin(armAng)*aLen*0.5;
    const hndX=aAncX+Math.cos(armAng)*aLen, hndY=aAncY+Math.sin(armAng)*aLen;
    ctx.strokeStyle=C.plDk; ctx.lineWidth=8; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(aAncX,aAncY); ctx.lineTo(elbX,elbY); ctx.stroke();
    ctx.strokeStyle=C.pl; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(aAncX,aAncY); ctx.lineTo(elbX,elbY); ctx.stroke();
    ctx.fillStyle=C.plLit; ctx.beginPath(); ctx.arc(elbX,elbY,4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=C.plDk; ctx.lineWidth=7;
    ctx.beginPath(); ctx.moveTo(elbX,elbY); ctx.lineTo(hndX,hndY); ctx.stroke();
    ctx.strokeStyle=C.pl; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(elbX,elbY); ctx.lineTo(hndX,hndY); ctx.stroke();
    // Mace
    const mAng=armAng-0.10, mLen=26;
    const mTX=hndX+Math.cos(mAng)*mLen, mTY=hndY+Math.sin(mAng)*mLen;
    ctx.strokeStyle=C.maceDk; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(hndX,hndY); ctx.lineTo(mTX,mTY); ctx.stroke();
    ctx.strokeStyle='#8898a8'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(hndX,hndY); ctx.lineTo(mTX,mTY); ctx.stroke();
    ctx.fillStyle=C.maceH; ctx.beginPath(); ctx.arc(mTX,mTY,6,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=C.gold; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(mTX,mTY,6,0,Math.PI*2); ctx.stroke();
    for (let f=0;f<6;f++) { const fa=f*Math.PI/3; ctx.fillStyle=C.pl; ctx.beginPath(); ctx.arc(mTX+Math.cos(fa)*5.5,mTY+Math.sin(fa)*5.5,2,0,Math.PI*2); ctx.fill(); }
    // Holy glow
    if (holyPulse>0) {
        ctx.save(); ctx.shadowColor='#ffffc0'; ctx.shadowBlur=18;
        ctx.globalAlpha=Math.min(1,holyPulse)*0.6;
        ctx.fillStyle='#fffff4';
        const gTX=spellT>0?hndX:mTX, gTY=spellT>0?hndY:mTY;
        ctx.beginPath(); ctx.arc(gTX,gTY,8+holyPulse*6,0,Math.PI*2); ctx.fill();
        if (holyPulse>1) { ctx.globalAlpha=(holyPulse-1)*0.9; ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(gTX,gTY,15,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
    }
    // Helmet
    const hcX=cx, hcY=shY-13-dY;
    ctx.fillStyle=C.plDk; ctx.fillRect(hcX-4,hcY+2,8,6);
    ctx.fillStyle=C.pl; ctx.fillRect(hcX-3,hcY+3,5,5);
    ctx.fillStyle=C.gold; ctx.fillRect(hcX-4,hcY+2,8,1);
    ctx.fillStyle=C.hDk; ctx.beginPath(); ctx.arc(hcX,hcY,12,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.hLit; ctx.beginPath(); ctx.arc(hcX-2,hcY-2,8,Math.PI*1.0,Math.PI*2.3); ctx.fill();
    ctx.fillStyle='#101820'; ctx.beginPath(); ctx.ellipse(hcX+2,hcY,5,2.5,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin; ctx.beginPath(); ctx.arc(hcX+3,hcY,1.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.gold; ctx.fillRect(hcX-1,hcY-12,3,12);
    ctx.fillStyle=C.cross; ctx.beginPath(); ctx.arc(hcX,hcY-12,3,Math.PI,0); ctx.fill();
    ctx.strokeStyle=C.gold; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(hcX,hcY,12,Math.PI*0.5,Math.PI*1.8); ctx.stroke();
    if (sel) _drawSelectRing(ctx, cx, by);
}

// ── Necromancer ───────────────────────────────────────────────────────────────
function drawNecromancer(ctx, cx, by, sel, anim) {
    const C = {
        rDk:'#120820', rMid:'#1e1030', rLit:'#3a1848', rFold:'#2a1040',
        boneW:'#d8d4c0', boneDk:'#a09870', skullDk:'#8a8470',
        dGreen:'#28c858', dGlo:'rgba(30,200,70,0.55)',
        sash:'#601080', sashLt:'#8820b0',
        stWd:'#281808', stLt:'#402810',
        eye:'#30f060', eyeGlo:'rgba(40,240,80,0.6)',
        skin:'#9090a0',
    };
    const t = anim?.t ?? 0;
    let dY=0, staffRaise=0, deathPulse=0;
    if (anim?.type === 'necromancer_spell') {
        if (t < 0.28)      { staffRaise=t/0.28; }
        else if (t < 0.58) { staffRaise=1; deathPulse=(t-0.28)/0.30; dY=deathPulse*3; }
        else if (t < 0.70) { const p=(t-0.58)/0.12; staffRaise=1; deathPulse=1+p*2; dY=3-p*3; }
        else               { const p=(t-0.70)/0.30; staffRaise=1-p*0.5; deathPulse=0; }
    }
    drawShadow(ctx, cx, by);
    const shY=by-38-dY*0.70;
    // Robe skirt (long, tattered hem)
    ctx.fillStyle=C.rDk;
    ctx.beginPath();
    ctx.moveTo(cx-14,by); ctx.lineTo(cx+14,by); ctx.lineTo(cx+10,by-38); ctx.lineTo(cx-11,by-38);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.rMid;
    ctx.beginPath();
    ctx.moveTo(cx-2,by); ctx.lineTo(cx+5,by); ctx.lineTo(cx+4,by-38); ctx.lineTo(cx-1,by-38);
    ctx.closePath(); ctx.fill();
    // Tattered hem
    ctx.fillStyle=C.rDk;
    for (let i=0;i<5;i++) {
        const hx=cx-12+i*5.5, hy=by;
        ctx.beginPath(); ctx.moveTo(hx,hy-1); ctx.lineTo(hx+2,hy-1); ctx.lineTo(hx+1,hy+4+Math.sin(i*1.7)*2); ctx.closePath(); ctx.fill();
    }
    // Bone trim at hem
    ctx.strokeStyle=C.boneDk; ctx.lineWidth=1; ctx.setLineDash([2,3]);
    ctx.beginPath(); ctx.moveTo(cx-13,by-2); ctx.lineTo(cx+13,by-2); ctx.stroke();
    ctx.setLineDash([]);
    // Skull decorations on robe
    ctx.save(); ctx.globalAlpha=0.35+deathPulse*0.2;
    ctx.fillStyle=C.boneW;
    for (const [sx,sy] of [[-6,-10],[4,-18],[-2,-28],[6,-8]]) {
        ctx.beginPath(); ctx.arc(cx+sx,by+sy,1.5,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
    // Sash
    ctx.fillStyle=C.sash; ctx.fillRect(cx-10,by-32,21,3);
    ctx.fillStyle=C.sashLt; ctx.fillRect(cx-10,by-33,21,2);
    // Upper robe
    const upShY=shY-14;
    ctx.fillStyle=C.rDk;
    ctx.beginPath();
    ctx.moveTo(cx-11,by-38); ctx.lineTo(cx+10,by-38);
    ctx.lineTo(cx+8,upShY); ctx.lineTo(cx-9,upShY);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.rMid;
    ctx.beginPath();
    ctx.moveTo(cx-1,by-38); ctx.lineTo(cx+6,by-38);
    ctx.lineTo(cx+5,upShY); ctx.lineTo(cx-0,upShY);
    ctx.closePath(); ctx.fill();
    // Death rune glow on back
    ctx.save(); ctx.globalAlpha=0.25+Math.min(1,deathPulse)*0.35;
    ctx.shadowColor=C.dGreen; ctx.shadowBlur=8;
    ctx.strokeStyle=C.dGreen; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.arc(cx,by-24,5,0,Math.PI*2); ctx.stroke();
    for (let a=0;a<3;a++) { const ang=a*Math.PI*2/3; ctx.beginPath(); ctx.moveTo(cx+Math.cos(ang)*3,by-24+Math.sin(ang)*3); ctx.lineTo(cx+Math.cos(ang)*8,by-24+Math.sin(ang)*8); ctx.stroke(); }
    ctx.restore();
    // Free arm (right)
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(cx+10,upShY); ctx.lineTo(cx+16,upShY+5); ctx.lineTo(cx+17,upShY+13); ctx.lineTo(cx+13,upShY+15); ctx.lineTo(cx+8,upShY+9); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.skin; ctx.beginPath(); ctx.arc(cx+16,upShY+13,4,0,Math.PI*2); ctx.fill();
    // Staff arm (left/attacking)
    const stAncX=cx-10, stAncY=upShY+2;
    const stA0=-Math.PI*0.50, stA1=-Math.PI*0.70;
    const stAng=stA0+(stA1-stA0)*staffRaise;
    const stLen=44;
    const orbX=stAncX+Math.cos(stAng)*stLen, orbY=stAncY+Math.sin(stAng)*stLen;
    // Staff pole
    ctx.strokeStyle=C.stWd; ctx.lineWidth=4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(stAncX,stAncY); ctx.lineTo(orbX,orbY); ctx.stroke();
    ctx.strokeStyle=C.stLt; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(stAncX,stAncY); ctx.lineTo(orbX,orbY); ctx.stroke();
    // Skull head on staff
    const skY=orbY, skX=orbX;
    ctx.save();
    ctx.shadowColor=C.dGreen; ctx.shadowBlur=12+Math.min(1,deathPulse)*18;
    ctx.globalAlpha=0.8+Math.min(1,deathPulse)*0.15;
    ctx.fillStyle=C.boneW; ctx.beginPath(); ctx.arc(skX,skY,7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skullDk; ctx.fillRect(skX-5,skY,10,4);
    // Eye sockets
    ctx.fillStyle=C.dGreen;
    ctx.beginPath(); ctx.arc(skX-2.5,skY-1.5,2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(skX+2.5,skY-1.5,2,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // Death charge
    if (deathPulse>0) {
        ctx.save();
        ctx.shadowColor=C.dGreen; ctx.shadowBlur=20;
        ctx.globalAlpha=Math.min(1,deathPulse)*0.5;
        ctx.strokeStyle=C.dGreen; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(skX,skY,9+Math.min(1,deathPulse)*8,0,Math.PI*2); ctx.stroke();
        if (deathPulse>1) {
            ctx.globalAlpha=(deathPulse-1)*0.85;
            ctx.fillStyle=C.dGreen;
            ctx.beginPath(); ctx.arc(skX,skY,14,0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
    // Staff arm sleeve
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(stAncX,stAncY); ctx.lineTo(stAncX-7,stAncY+7); ctx.lineTo(stAncX-5,stAncY+13); ctx.lineTo(stAncX,stAncY+7); ctx.closePath(); ctx.fill();
    // Hood/head
    const hcX=cx, hcY=upShY-10-dY;
    ctx.fillStyle=C.rDk; ctx.beginPath(); ctx.arc(hcX,hcY,12,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1c0e2c'; ctx.beginPath(); ctx.arc(hcX+1,hcY+1,9,0,Math.PI*2); ctx.fill();
    // Shadow under hood hiding face
    ctx.fillStyle='#0a0614';
    ctx.beginPath(); ctx.ellipse(hcX+2,hcY+2,7,5,0,0,Math.PI*2); ctx.fill();
    // Glowing eyes under hood
    ctx.save();
    ctx.shadowColor=C.eye; ctx.shadowBlur=8;
    ctx.globalAlpha=0.7+Math.min(1,deathPulse)*0.25;
    ctx.fillStyle=C.eye;
    ctx.beginPath(); ctx.arc(hcX,hcY+1,2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(hcX+5,hcY+1,2,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // Hood peak
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(hcX-6,hcY-9); ctx.lineTo(hcX+6,hcY-9); ctx.lineTo(hcX+3,hcY-24); ctx.lineTo(hcX-1,hcY-28); ctx.lineTo(hcX-3,hcY-24); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.rMid;
    ctx.beginPath(); ctx.moveTo(hcX+2,hcY-9); ctx.lineTo(hcX+6,hcY-9); ctx.lineTo(hcX+3,hcY-24); ctx.lineTo(hcX+1,hcY-22); ctx.closePath(); ctx.fill();
    if (sel) _drawSelectRing(ctx, cx, by);
}

// ── Witch ─────────────────────────────────────────────────────────────────────
function drawWitch(ctx, cx, by, sel, anim) {
    const C = {
        rDk:'#1e0a2e', rMid:'#361450', rLit:'#5a2478', rFold:'#2c0e42',
        sash:'#c04080', sashDk:'#803060',
        hex:'#20e890',  hexGlo:'rgba(20,232,130,0.55)',
        wWd:'#3c2010',  wKnot:'#5a3820',
        eye:'#e020a0',  eyeGlo:'rgba(220,20,140,0.5)',
        skin:'#c09878',
        hDk:'#1a0828',  hMid:'#2e1048', hLit:'#501870',
        hair:'#1c1018',
    };
    const t = anim?.t ?? 0;
    let dY=0, staffRaise=0, hexPulse=0;
    if (anim?.type === 'witch_spell') {
        if (t < 0.30)      { staffRaise=t/0.30; dY=staffRaise*2; }
        else if (t < 0.60) { staffRaise=1; hexPulse=(t-0.30)/0.30; dY=2+hexPulse*2; }
        else if (t < 0.72) { const p=(t-0.60)/0.12; staffRaise=1; hexPulse=1+p*2; dY=4-p*4; }
        else               { const p=(t-0.72)/0.28; staffRaise=1-p*0.4; hexPulse=0; }
    }
    drawShadow(ctx, cx, by);
    const shY=by-38-dY*0.65;
    // Robe skirt (asymmetric, slightly tattered)
    ctx.fillStyle=C.rDk;
    ctx.beginPath();
    ctx.moveTo(cx-14,by+2); ctx.lineTo(cx+13,by); ctx.lineTo(cx+10,by-38); ctx.lineTo(cx-12,by-38);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.rLit;
    ctx.beginPath();
    ctx.moveTo(cx-2,by+1); ctx.lineTo(cx+6,by); ctx.lineTo(cx+5,by-38); ctx.lineTo(cx-1,by-38);
    ctx.closePath(); ctx.fill();
    // Tattered extra panel (right side)
    ctx.fillStyle=C.rMid;
    ctx.beginPath();
    ctx.moveTo(cx+9,by); ctx.lineTo(cx+16,by-5); ctx.lineTo(cx+12,by-22); ctx.lineTo(cx+10,by-22);
    ctx.closePath(); ctx.fill();
    // Hex rune glow on robe
    ctx.save(); ctx.globalAlpha=0.22+Math.min(1,hexPulse)*0.30;
    ctx.shadowColor=C.hex; ctx.shadowBlur=6;
    ctx.strokeStyle=C.hex; ctx.lineWidth=0.8;
    for (let i=0;i<6;i++) { const ha=i*Math.PI/3; ctx.beginPath(); ctx.moveTo(cx+Math.cos(ha)*3,by-18+Math.sin(ha)*3); ctx.lineTo(cx+Math.cos(ha)*9,by-18+Math.sin(ha)*9); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(cx,by-18,3,0,Math.PI*2); ctx.stroke();
    ctx.restore();
    // Sash
    ctx.fillStyle=C.sashDk; ctx.fillRect(cx-11,by-33,23,4);
    ctx.fillStyle=C.sash;   ctx.fillRect(cx-11,by-34,23,3);
    // Upper robe
    const upShY=shY-14;
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(cx-12,by-38); ctx.lineTo(cx+10,by-38); ctx.lineTo(cx+8,upShY); ctx.lineTo(cx-10,upShY); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.rMid;
    ctx.beginPath(); ctx.moveTo(cx-1,by-38); ctx.lineTo(cx+6,by-38); ctx.lineTo(cx+5,upShY); ctx.lineTo(cx-0,upShY); ctx.closePath(); ctx.fill();
    // Free arm (right) — gesturing outward
    const fAX=cx+10, fAY=upShY+2;
    const fAng=-Math.PI*0.25+(hexPulse>0?-0.3*Math.min(1,hexPulse):0);
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(fAX,fAY); ctx.lineTo(fAX+8*Math.cos(fAng),fAY+8*Math.sin(fAng)); ctx.lineTo(fAX+15*Math.cos(fAng-0.3),fAY+15*Math.sin(fAng-0.3)); ctx.lineTo(fAX+13,fAY+14); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.skin;
    const fHX=fAX+Math.cos(fAng-0.2)*16, fHY=fAY+Math.sin(fAng-0.2)*16;
    ctx.beginPath(); ctx.arc(fHX,fHY,4,0,Math.PI*2); ctx.fill();
    // Hex from free hand
    if (hexPulse>0) {
        ctx.save(); ctx.shadowColor=C.hex; ctx.shadowBlur=14;
        ctx.globalAlpha=Math.min(1,hexPulse)*0.55;
        ctx.fillStyle=C.hex;
        ctx.beginPath(); ctx.arc(fHX,fHY,5+Math.min(1,hexPulse)*6,0,Math.PI*2); ctx.fill();
        if (hexPulse>1) { ctx.globalAlpha=(hexPulse-1)*0.9; ctx.fillStyle='#a0ffd8'; ctx.beginPath(); ctx.arc(fHX,fHY,14,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
    }
    // Staff arm (left/attacking)
    const stAncX=cx-10, stAncY=upShY+2;
    const stA0=-Math.PI*0.48, stA1=-Math.PI*0.72;
    const stAng=stA0+(stA1-stA0)*staffRaise;
    const stLen=40;
    const stTX=stAncX+Math.cos(stAng)*stLen, stTY=stAncY+Math.sin(stAng)*stLen;
    // Gnarled staff
    ctx.strokeStyle=C.wWd; ctx.lineWidth=3; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(stAncX,stAncY); ctx.lineTo(stTX,stTY); ctx.stroke();
    ctx.strokeStyle=C.wKnot; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(stAncX,stAncY); ctx.lineTo(stTX,stTY); ctx.stroke();
    // Knots on staff
    for (const [kf] of [[0.3],[0.55],[0.75]]) {
        const kX=stAncX+Math.cos(stAng)*stLen*kf, kY=stAncY+Math.sin(stAng)*stLen*kf;
        ctx.fillStyle=C.wKnot; ctx.beginPath(); ctx.arc(kX,kY,2.5,0,Math.PI*2); ctx.fill();
    }
    // Staff tip (twisted fork)
    ctx.strokeStyle=C.wKnot; ctx.lineWidth=2;
    const pa=stAng-Math.PI*0.5;
    ctx.beginPath(); ctx.moveTo(stTX,stTY); ctx.lineTo(stTX+Math.cos(stAng-0.3)*8,stTY+Math.sin(stAng-0.3)*8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(stTX,stTY); ctx.lineTo(stTX+Math.cos(stAng+0.3)*8,stTY+Math.sin(stAng+0.3)*8); ctx.stroke();
    // Hex energy at tip
    ctx.save(); ctx.shadowColor=C.hex; ctx.shadowBlur=10+Math.min(1,hexPulse)*16;
    ctx.globalAlpha=0.6+Math.min(1,hexPulse)*0.3;
    ctx.fillStyle=C.hex;
    ctx.beginPath(); ctx.arc(stTX,stTY,4+Math.min(1,hexPulse)*5,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // Staff arm sleeve
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(stAncX,stAncY); ctx.lineTo(stAncX-8,stAncY+8); ctx.lineTo(stAncX-6,stAncY+14); ctx.lineTo(stAncX,stAncY+8); ctx.closePath(); ctx.fill();
    // Head and wild hair
    const hcX=cx, hcY=upShY-10-dY;
    ctx.fillStyle=C.hDk; ctx.beginPath(); ctx.arc(hcX,hcY,11,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin; ctx.beginPath(); ctx.arc(hcX+1,hcY+1,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin; ctx.fillRect(hcX-3,hcY+6,6,4);
    // Wild hair strands
    ctx.strokeStyle=C.hair; ctx.lineWidth=2; ctx.lineCap='round';
    const hairStrands=[[-8,-6,-14,-14],[-5,-10,-10,-20],[2,-11,4,-22],[7,-8,14,-16],[9,-3,18,-8]];
    for (const [x1,y1,x2,y2] of hairStrands) {
        ctx.beginPath(); ctx.moveTo(hcX+x1,hcY+y1); ctx.quadraticCurveTo(hcX+(x1+x2)/2+2,hcY+(y1+y2)/2,hcX+x2,hcY+y2); ctx.stroke();
    }
    // Glowing eye
    ctx.save(); ctx.shadowColor=C.eyeGlo; ctx.shadowBlur=8;
    ctx.globalAlpha=0.70+Math.min(1,hexPulse)*0.25;
    ctx.fillStyle=C.eye; ctx.beginPath(); ctx.arc(hcX+4,hcY,2,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // Hood/cap edge
    ctx.fillStyle=C.hDk;
    ctx.beginPath(); ctx.arc(hcX,hcY,11,Math.PI*1.0,0,false); ctx.fill();
    ctx.fillStyle=C.hMid;
    ctx.beginPath(); ctx.arc(hcX,hcY,9,Math.PI*1.1,Math.PI*1.9,false); ctx.fill();
    if (sel) _drawSelectRing(ctx, cx, by);
}

// ── Ranger ────────────────────────────────────────────────────────────────────
function drawRanger(ctx, cx, by, sel, anim) {
    const C = {
        lDk:'#3a2408',  lMid:'#5a3c18', lLit:'#7a5428',
        gDk:'#1e3008',  gMid:'#304a10', gLit:'#4a6820',
        bowWd:'#6a3c10', bowLt:'#8a5428', bowStr:'#c8c090',
        blade:'#c0d0e0', bladeHi:'#f0f8ff', hilt:'#6a3c10',
        quiv:'#3c2408',  arrow:'#7a4c18', aTip:'#b0c0d0',
        boot:'#120e06',  skin:'#c0a070',
        hDk:'#1e2e10',  hMid:'#304818', hair:'#3c2808',
        eye:'#6aaa40',
    };
    const t = anim?.t ?? 0;
    let dY=0, bowDraw=0, meleeT=0;
    if (anim?.type === 'ranger_bow') {
        if (t < 0.45)      { bowDraw=t/0.45; dY=bowDraw*2; }
        else if (t < 0.58) { bowDraw=1; dY=2; }
        else               { const p=(t-0.58)/0.42; bowDraw=1-p*0.85; dY=2-2*p; }
    } else if (anim?.type === 'ranger_melee') {
        if (t < 0.20)      { dY=-4*(t/0.20); meleeT=t/0.20; }
        else if (t < 0.55) { const p=(t-0.20)/0.35, e=1-Math.pow(1-p,3); dY=-4+15*e; meleeT=e; }
        else               { const p=(t-0.55)/0.45; dY=11-11*p; meleeT=1-p*0.5; }
    }
    drawShadow(ctx, cx, by);
    const shY=by-36-dY*0.65;
    // Boots
    ctx.fillStyle=C.boot; ctx.fillRect(cx-9,by-5,6,5); ctx.fillRect(cx+3,by-4,6,4);
    ctx.fillStyle=C.lDk; ctx.fillRect(cx-9,by-7,6,2); ctx.fillRect(cx+3,by-6,6,2);
    // Leggings (leather)
    ctx.fillStyle=C.lMid; ctx.fillRect(cx-8,by-20,5,14);
    ctx.fillStyle=C.lLit; ctx.fillRect(cx-7,by-19,2,12);
    ctx.fillStyle=C.lDk; ctx.fillRect(cx+3,by-18,5,13);
    ctx.fillStyle=C.lMid; ctx.fillRect(cx+4,by-17,2,11);
    // Knee pads
    ctx.fillStyle=C.lLit; ctx.beginPath(); ctx.ellipse(cx-5,by-20,3.5,2,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.lMid; ctx.beginPath(); ctx.ellipse(cx+5,by-18,3,2,0,0,Math.PI*2); ctx.fill();
    // Leather vest + cloak back
    const tbY=by-20-dY*0.40;
    ctx.fillStyle=C.gDk;
    ctx.beginPath(); ctx.moveTo(cx-6,tbY); ctx.quadraticCurveTo(cx-16,tbY+15,cx-14,by); ctx.lineTo(cx-3,by); ctx.lineTo(cx-3,tbY+8); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.gMid;
    ctx.beginPath(); ctx.moveTo(cx+6,tbY); ctx.quadraticCurveTo(cx+14,tbY+15,cx+12,by); ctx.lineTo(cx+1,by); ctx.lineTo(cx+1,tbY+8); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.lDk;
    ctx.beginPath(); ctx.moveTo(cx-8,tbY); ctx.lineTo(cx+8,tbY); ctx.lineTo(cx+7,tbY-17); ctx.lineTo(cx-7,tbY-17); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.lMid;
    ctx.beginPath(); ctx.moveTo(cx-0,tbY); ctx.lineTo(cx+5,tbY); ctx.lineTo(cx+4,tbY-17); ctx.lineTo(cx-0,tbY-17); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.hilt; ctx.fillRect(cx-8,tbY-5,16,2);
    // Quiver (back right)
    ctx.fillStyle=C.quiv; ctx.fillRect(cx+7,tbY-22,5,13);
    ctx.fillStyle=C.lDk; ctx.fillRect(cx+6,tbY-22,1,13); ctx.fillRect(cx+12,tbY-22,1,13);
    for (let i=0;i<4;i++) { ctx.fillStyle=i%2===0?C.arrow:C.aTip; ctx.fillRect(cx+8+i,tbY-26,1,5); }
    // Belt buckle
    ctx.fillStyle='#a07828'; ctx.fillRect(cx-2,tbY-6,4,3);
    // Short sword at hip (extends during melee)
    const sX=cx-6-meleeT*14, sY=tbY-3-meleeT*12;
    ctx.strokeStyle=C.hilt; ctx.lineWidth=2.5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(sX,sY); ctx.lineTo(sX-2,sY-2); ctx.stroke();
    ctx.strokeStyle=C.blade; ctx.lineWidth=2.2;
    ctx.beginPath(); ctx.moveTo(sX-2,sY-2); ctx.lineTo(sX-10,sY-16); ctx.stroke();
    ctx.strokeStyle=C.bladeHi; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(sX-2,sY-2); ctx.lineTo(sX-10,sY-16); ctx.stroke();
    // Longbow (raised left arm)
    const bAncX=cx-10, bAncY=tbY-18-dY*0.20;
    const bA0=-Math.PI*0.50, bA1=-Math.PI*0.25;
    const bCurA=bA0+(bA1-bA0)*bowDraw;
    const bR=17;
    const bTU={x:bAncX+Math.cos(bCurA-0.5)*bR, y:bAncY+Math.sin(bCurA-0.5)*bR};
    const bTL={x:bAncX+Math.cos(bCurA+0.5)*bR, y:bAncY+Math.sin(bCurA+0.5)*bR};
    ctx.strokeStyle=C.bowWd; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(bTU.x,bTU.y); ctx.quadraticCurveTo(bAncX+Math.cos(bCurA)*(bR+8),bAncY+Math.sin(bCurA)*(bR+8),bTL.x,bTL.y); ctx.stroke();
    ctx.strokeStyle=C.bowLt; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(bTU.x,bTU.y); ctx.quadraticCurveTo(bAncX+Math.cos(bCurA)*(bR+5),bAncY+Math.sin(bCurA)*(bR+5),bTL.x,bTL.y); ctx.stroke();
    const pull=bowDraw*13;
    const sMX=bAncX-Math.cos(bCurA)*pull, sMY=bAncY-Math.sin(bCurA)*pull;
    ctx.strokeStyle=C.bowStr; ctx.lineWidth=0.9;
    ctx.beginPath(); ctx.moveTo(bTU.x,bTU.y); ctx.lineTo(sMX,sMY); ctx.lineTo(bTL.x,bTL.y); ctx.stroke();
    if (bowDraw>0.05) {
        ctx.strokeStyle=C.arrow; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.moveTo(sMX,sMY); ctx.lineTo(sMX+Math.cos(bCurA+Math.PI)*22,sMY+Math.sin(bCurA+Math.PI)*22); ctx.stroke();
        ctx.fillStyle=C.aTip; ctx.beginPath(); ctx.arc(sMX+Math.cos(bCurA+Math.PI)*22,sMY+Math.sin(bCurA+Math.PI)*22,1.5,0,Math.PI*2); ctx.fill();
    }
    // Shoulders (leather spaulders)
    ctx.fillStyle=C.lDk; ctx.beginPath(); ctx.ellipse(cx-10,shY,8,4.5,-0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.lMid; ctx.beginPath(); ctx.ellipse(cx-9,shY-1,5,3,-0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.lDk; ctx.beginPath(); ctx.ellipse(cx+10,shY,7,4,0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.lLit; ctx.beginPath(); ctx.ellipse(cx+9,shY-1,4,2.5,0.2,0,Math.PI*2); ctx.fill();
    // Hood/head
    const hcX=cx, hcY=shY-13-dY;
    ctx.fillStyle=C.hDk; ctx.beginPath(); ctx.arc(hcX,hcY,12,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.gMid; ctx.beginPath(); ctx.arc(hcX-2,hcY-1,8,Math.PI*0.9,Math.PI*2.2); ctx.fill();
    ctx.fillStyle=C.hMid; ctx.beginPath(); ctx.arc(hcX+2,hcY,8,Math.PI*0.1,Math.PI*1.2); ctx.fill();
    // Visible hair below hood
    ctx.fillStyle=C.hair; ctx.fillRect(hcX-6,hcY+5,12,5);
    ctx.fillStyle=C.hair;
    ctx.beginPath(); ctx.moveTo(hcX-6,hcY+6); ctx.quadraticCurveTo(hcX-10,hcY+12,hcX-8,hcY+14); ctx.lineTo(hcX-6,hcY+14); ctx.closePath(); ctx.fill();
    // Eye glint
    ctx.save(); ctx.globalAlpha=0.65; ctx.shadowColor=C.eye; ctx.shadowBlur=4;
    ctx.fillStyle=C.eye; ctx.beginPath(); ctx.arc(hcX+4,hcY,2,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // Hood peak (forward-facing, practical)
    ctx.fillStyle=C.hDk;
    ctx.beginPath(); ctx.moveTo(hcX-5,hcY-9); ctx.lineTo(hcX+6,hcY-9); ctx.lineTo(hcX+4,hcY-19); ctx.lineTo(hcX,hcY-22); ctx.lineTo(hcX-2,hcY-19); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.hMid;
    ctx.beginPath(); ctx.moveTo(hcX+2,hcY-9); ctx.lineTo(hcX+6,hcY-9); ctx.lineTo(hcX+4,hcY-19); ctx.lineTo(hcX+2,hcY-17); ctx.closePath(); ctx.fill();
    if (sel) _drawSelectRing(ctx, cx, by);
}

// ── Sorcerer ──────────────────────────────────────────────────────────────────
function drawSorcerer(ctx, cx, by, sel, anim) {
    const C = {
        rDk:'#280810', rMid:'#481020', rLit:'#781828',
        sash:'#e05828', sashDk:'#a03c18',
        fire:'#f08030', fireDk:'#c04010', fireHi:'#fff080',
        arc:'#4060f8',  arcGlo:'rgba(60,100,248,0.5)',
        skin:'#c8a070',
        hDk:'#1e0608',  hMid:'#380c10', hLit:'#601018',
        tattoo:'#e06020',
        rune:'#f0a030',
    };
    const t = anim?.t ?? 0;
    let dY=0, burstT=0, chargePulse=0;
    if (anim?.type === 'sorcerer_spell') {
        if (t < 0.25)      { burstT=t/0.25; dY=burstT*2; }
        else if (t < 0.55) { burstT=1; chargePulse=(t-0.25)/0.30; dY=2+chargePulse*2; }
        else if (t < 0.68) { const p=(t-0.55)/0.13; burstT=1; chargePulse=1+p*2; dY=4-p*4; }
        else               { const p=(t-0.68)/0.32; burstT=1-p*0.5; chargePulse=0; }
    }
    drawShadow(ctx, cx, by);
    const shY=by-38-dY*0.65;
    // Robe skirt
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(cx-13,by); ctx.lineTo(cx+14,by); ctx.lineTo(cx+10,by-36); ctx.lineTo(cx-11,by-36); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.rMid;
    ctx.beginPath(); ctx.moveTo(cx-2,by); ctx.lineTo(cx+6,by); ctx.lineTo(cx+5,by-36); ctx.lineTo(cx-1,by-36); ctx.closePath(); ctx.fill();
    // Flame-lick robe edge
    ctx.fillStyle=C.rLit;
    for (let i=0;i<4;i++) { const fx=cx-10+i*6.5; ctx.beginPath(); ctx.moveTo(fx,by); ctx.lineTo(fx+2,by); ctx.lineTo(fx+1+i%2,by-5-i%3*2); ctx.closePath(); ctx.fill(); }
    // Sash (fiery orange)
    ctx.fillStyle=C.sashDk; ctx.fillRect(cx-11,by-31,23,4);
    ctx.fillStyle=C.sash;   ctx.fillRect(cx-11,by-32,23,3);
    // Arcane rune on back (glows brighter during cast)
    ctx.save();
    ctx.globalAlpha=0.28+Math.min(1,chargePulse)*0.45;
    ctx.shadowColor=C.rune; ctx.shadowBlur=10;
    ctx.strokeStyle=C.rune; ctx.lineWidth=0.9;
    ctx.beginPath(); ctx.arc(cx,by-20,7,0,Math.PI*2); ctx.stroke();
    for (let a=0;a<3;a++) { const ang=a*Math.PI*2/3+Math.PI/6; ctx.beginPath(); ctx.moveTo(cx+Math.cos(ang)*4,by-20+Math.sin(ang)*4); ctx.lineTo(cx+Math.cos(ang)*9,by-20+Math.sin(ang)*9); ctx.stroke(); }
    ctx.restore();
    // Upper robe
    const upShY=shY-14;
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(cx-11,by-36); ctx.lineTo(cx+10,by-36); ctx.lineTo(cx+8,upShY); ctx.lineTo(cx-9,upShY); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.rMid;
    ctx.beginPath(); ctx.moveTo(cx-1,by-36); ctx.lineTo(cx+6,by-36); ctx.lineTo(cx+5,upShY); ctx.lineTo(cx-0,upShY); ctx.closePath(); ctx.fill();
    // Both arms thrust forward — raw arcane burst from palms
    const aA0R=-Math.PI*0.30, aA1R=-Math.PI*0.55;
    const aA0L=-Math.PI*0.55, aA1L=-Math.PI*0.72;
    const rAng=aA0R+(aA1R-aA0R)*burstT;
    const lAng=aA0L+(aA1L-aA0L)*burstT;
    const aLen=16;
    // Right arm
    const rAncX=cx+10, rAncY=upShY+2;
    const rElbX=rAncX+Math.cos(rAng)*aLen*0.5, rElbY=rAncY+Math.sin(rAng)*aLen*0.5;
    const rHndX=rAncX+Math.cos(rAng)*aLen,     rHndY=rAncY+Math.sin(rAng)*aLen;
    ctx.strokeStyle=C.rDk; ctx.lineWidth=8; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(rAncX,rAncY); ctx.lineTo(rElbX,rElbY); ctx.stroke();
    ctx.strokeStyle=C.rLit; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(rAncX,rAncY); ctx.lineTo(rElbX,rElbY); ctx.stroke();
    ctx.fillStyle=C.rMid; ctx.beginPath(); ctx.arc(rElbX,rElbY,4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=C.rDk; ctx.lineWidth=7;
    ctx.beginPath(); ctx.moveTo(rElbX,rElbY); ctx.lineTo(rHndX,rHndY); ctx.stroke();
    ctx.fillStyle=C.skin; ctx.beginPath(); ctx.arc(rHndX,rHndY,5,0,Math.PI*2); ctx.fill();
    // Tattoo on visible forearm
    ctx.save(); ctx.globalAlpha=0.5+Math.min(1,chargePulse)*0.3;
    ctx.strokeStyle=C.tattoo; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.arc(rElbX+1,rElbY+2,3,0.5,Math.PI*1.5); ctx.stroke();
    ctx.restore();
    // Left arm
    const lAncX=cx-10, lAncY=upShY+2;
    const lElbX=lAncX+Math.cos(lAng)*aLen*0.5, lElbY=lAncY+Math.sin(lAng)*aLen*0.5;
    const lHndX=lAncX+Math.cos(lAng)*aLen,     lHndY=lAncY+Math.sin(lAng)*aLen;
    ctx.strokeStyle=C.rDk; ctx.lineWidth=8;
    ctx.beginPath(); ctx.moveTo(lAncX,lAncY); ctx.lineTo(lElbX,lElbY); ctx.stroke();
    ctx.strokeStyle=C.rLit; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(lAncX,lAncY); ctx.lineTo(lElbX,lElbY); ctx.stroke();
    ctx.fillStyle=C.rMid; ctx.beginPath(); ctx.arc(lElbX,lElbY,4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=C.rDk; ctx.lineWidth=7;
    ctx.beginPath(); ctx.moveTo(lElbX,lElbY); ctx.lineTo(lHndX,lHndY); ctx.stroke();
    ctx.fillStyle=C.skin; ctx.beginPath(); ctx.arc(lHndX,lHndY,5,0,Math.PI*2); ctx.fill();
    // Fire/arcane burst from hands
    if (burstT>0) {
        for (const [hX,hY] of [[rHndX,rHndY],[lHndX,lHndY]]) {
            ctx.save();
            ctx.shadowColor=C.fire; ctx.shadowBlur=14+Math.min(1,chargePulse)*18;
            ctx.globalAlpha=burstT*(0.5+Math.min(1,chargePulse)*0.35);
            ctx.fillStyle=C.fireDk;
            ctx.beginPath(); ctx.arc(hX,hY,5+Math.min(1,chargePulse)*7,0,Math.PI*2); ctx.fill();
            ctx.fillStyle=C.fire;
            ctx.beginPath(); ctx.arc(hX-1,hY-1,3+Math.min(1,chargePulse)*4,0,Math.PI*2); ctx.fill();
            if (chargePulse>1) {
                ctx.globalAlpha=(chargePulse-1)*0.8;
                ctx.fillStyle=C.fireHi;
                ctx.beginPath(); ctx.arc(hX,hY,15,0,Math.PI*2); ctx.fill();
            }
            ctx.restore();
        }
    }
    // Head (wild, partially hooded)
    const hcX=cx, hcY=upShY-10-dY;
    ctx.fillStyle=C.hDk; ctx.beginPath(); ctx.arc(hcX,hcY,11,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin; ctx.beginPath(); ctx.arc(hcX+1,hcY+1,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin; ctx.fillRect(hcX-3,hcY+6,6,4);
    // Arcane energy glinting around head during cast
    if (chargePulse>0) {
        ctx.save();
        ctx.globalAlpha=Math.min(1,chargePulse)*0.35;
        ctx.shadowColor=C.fire; ctx.shadowBlur=16;
        ctx.strokeStyle=C.fire; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.arc(hcX,hcY,14,0,Math.PI*2); ctx.stroke();
        ctx.restore();
    }
    // Partial hood/hair
    ctx.fillStyle=C.hDk; ctx.beginPath(); ctx.arc(hcX,hcY,11,Math.PI*0.9,0,false); ctx.fill();
    ctx.fillStyle=C.hMid; ctx.beginPath(); ctx.arc(hcX-1,hcY-1,8,Math.PI*0.95,Math.PI*1.85); ctx.fill();
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(hcX-5,hcY-8); ctx.lineTo(hcX+5,hcY-8); ctx.lineTo(hcX+3,hcY-18); ctx.lineTo(hcX-1,hcY-21); ctx.lineTo(hcX-3,hcY-17); ctx.closePath(); ctx.fill();
    if (sel) _drawSelectRing(ctx, cx, by);
}

// ── Priest ────────────────────────────────────────────────────────────────────
function drawPriest(ctx, cx, by, sel, anim) {
    const C = {
        robe:'#e8e8ec',   rMid:'#d0d0d8',   rDk:'#b4b4c0',   rFold:'#c8c8d0',
        sash:'#c0c0cc',   sashDk:'#9090a0',
        hood:'#d8d8e0',   hoodDk:'#a8a8b8',
        symbol:'#d4d4f0',
        stWd:'#8a6840',   stLt:'#b08858',
        crystal:'#d8eeff', crystGl:'#b0d0f8',
        skin:'#c8a878',
        hDk:'#907858',
        sandal:'#a07848',
    };

    const t = anim?.t ?? 0;
    let dY = 0, staffRaise = 0, holyPulse = 0;
    if (anim?.type === 'priest_strike') {
        if (t < 0.30)      { dY = -(t/0.30)*3; staffRaise = t/0.30; }
        else if (t < 0.55) { const p=(t-0.30)/0.25; dY=-3+p*9; staffRaise=1; }
        else               { const p=(t-0.55)/0.45; dY=6-p*6; staffRaise=1-p; }
    } else if (anim?.type === 'priest_spell') {
        if (t < 0.35)      { staffRaise=t/0.35; dY=staffRaise*2; }
        else if (t < 0.65) { const p=(t-0.35)/0.30; staffRaise=1; holyPulse=p; dY=2+p; }
        else if (t < 0.75) { const p=(t-0.65)/0.10; staffRaise=1; holyPulse=1+p*1.5; dY=3-p*3; }
        else               { const p=(t-0.75)/0.25; staffRaise=1-p*0.4; holyPulse=0; }
    }

    drawShadow(ctx, cx, by);

    // Sandals
    ctx.fillStyle=C.sandal; ctx.fillRect(cx-9,by-3,8,3); ctx.fillRect(cx+2,by-3,8,3);
    ctx.fillStyle=C.skin;   ctx.fillRect(cx-8,by-6,6,3); ctx.fillRect(cx+3,by-6,6,3);

    // Robe skirt
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(cx-14,by); ctx.lineTo(cx+14,by); ctx.lineTo(cx+10,by-40); ctx.lineTo(cx-10,by-40); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.robe;
    ctx.beginPath(); ctx.moveTo(cx-3,by); ctx.lineTo(cx+5,by); ctx.lineTo(cx+4,by-40); ctx.lineTo(cx-2,by-40); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.rMid;
    ctx.beginPath(); ctx.moveTo(cx+7,by); ctx.lineTo(cx+14,by); ctx.lineTo(cx+10,by-40); ctx.lineTo(cx+7,by-40); ctx.closePath(); ctx.fill();
    // Fold lines
    ctx.save(); ctx.globalAlpha=0.18; ctx.strokeStyle=C.robe; ctx.lineWidth=0.8;
    for (let i=0;i<3;i++) { const fx=cx-7+i*6; ctx.beginPath(); ctx.moveTo(fx,by); ctx.lineTo(fx-1,by-38); ctx.stroke(); }
    ctx.restore();

    // Sash
    ctx.fillStyle=C.sashDk; ctx.fillRect(cx-10,by-33,20,4);
    ctx.fillStyle=C.sash;   ctx.fillRect(cx-10,by-34,20,3);

    // Holy cross symbol on chest
    const symA = 0.20 + holyPulse*0.55;
    ctx.save(); ctx.globalAlpha=symA; ctx.strokeStyle=C.symbol; ctx.lineWidth=1.1;
    ctx.beginPath(); ctx.moveTo(cx,by-26); ctx.lineTo(cx,by-17); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-4,by-23); ctx.lineTo(cx+4,by-23); ctx.stroke();
    ctx.restore();

    // Upper robe + shoulders
    const shY = by-40-dY*0.65;
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(cx-12,by-40); ctx.lineTo(cx+12,by-40); ctx.lineTo(cx+9,shY); ctx.lineTo(cx-9,shY); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.robe;
    ctx.beginPath(); ctx.moveTo(cx-2,by-40); ctx.lineTo(cx+4,by-40); ctx.lineTo(cx+3,shY); ctx.lineTo(cx-2,shY); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.rMid; ctx.beginPath(); ctx.ellipse(cx-10,shY+2,6,4,-0.15,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.robe; ctx.beginPath(); ctx.ellipse(cx-9,shY+1,4,2.5,-0.15,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.rMid; ctx.beginPath(); ctx.ellipse(cx+10,shY+2,6,4,0.15,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.rDk;  ctx.beginPath(); ctx.ellipse(cx+9,shY+1,4,2.5,0.15,0,Math.PI*2); ctx.fill();

    // Staff (left hand)
    const staffTopY = shY-10-staffRaise*18-dY;
    const sX = cx-14;
    ctx.strokeStyle=C.stWd; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(sX,by-5); ctx.lineTo(sX+staffRaise*4,staffTopY+10); ctx.stroke();
    ctx.strokeStyle=C.stLt; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(sX+1,by-7); ctx.lineTo(sX+staffRaise*4+1,staffTopY+10); ctx.stroke();
    // Crystal tip
    const cX=sX+staffRaise*4, cY=staffTopY;
    ctx.save();
    ctx.globalAlpha=0.6+holyPulse*0.4;
    if (holyPulse>0) { ctx.shadowColor='#d8eeff'; ctx.shadowBlur=8+holyPulse*14; }
    ctx.fillStyle=C.crystal; ctx.beginPath(); ctx.arc(cX,cY,3.5+holyPulse*2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.crystGl; ctx.beginPath(); ctx.arc(cX-1,cY-1,1.8,0,Math.PI*2); ctx.fill();
    ctx.restore();

    // Left arm
    ctx.fillStyle=C.rDk; ctx.fillRect(cx-15,shY+4,5,12);
    ctx.fillStyle=C.skin; ctx.fillRect(cx-15,shY+14,4,5);
    // Right arm
    ctx.fillStyle=C.robe; ctx.fillRect(cx+9,shY+4,5,10);
    ctx.fillStyle=C.skin; ctx.fillRect(cx+10,shY+13,4,5);

    // Head
    const hcX=cx, hcY=shY-9-dY;
    ctx.fillStyle=C.skin; ctx.beginPath(); ctx.arc(hcX,hcY,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.hDk;  ctx.beginPath(); ctx.arc(hcX-1,hcY-1,5,Math.PI*1.1,Math.PI*1.9); ctx.fill();

    // Hood
    ctx.fillStyle=C.hoodDk;
    ctx.beginPath(); ctx.moveTo(hcX-7,hcY-5); ctx.lineTo(hcX+7,hcY-5); ctx.lineTo(hcX+8,hcY+7); ctx.lineTo(hcX+5,hcY+10); ctx.lineTo(hcX-5,hcY+10); ctx.lineTo(hcX-8,hcY+7); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.hood;
    ctx.beginPath(); ctx.arc(hcX,hcY,9,Math.PI*1.05,Math.PI*1.95,false); ctx.fill();
    ctx.fillStyle=C.hoodDk;
    ctx.beginPath(); ctx.moveTo(hcX-6,hcY-4); ctx.lineTo(hcX+6,hcY-4); ctx.lineTo(hcX+5,hcY-15); ctx.lineTo(hcX-1,hcY-17); ctx.lineTo(hcX-5,hcY-15); ctx.closePath(); ctx.fill();

    // Holy radiance during cast
    if (holyPulse>0) {
        ctx.save();
        ctx.globalAlpha=Math.min(1,holyPulse)*0.15;
        ctx.shadowColor='#e8e8ff'; ctx.shadowBlur=20;
        ctx.fillStyle='#e8e8ff';
        ctx.beginPath(); ctx.arc(hcX,hcY,16,0,Math.PI*2); ctx.fill();
        ctx.restore();
    }

    if (sel) _drawSelectRing(ctx, cx, by);
}

// ── Warlock ───────────────────────────────────────────────────────────────────
function drawWarlock(ctx, cx, by, sel, anim) {
    const C = {
        cDk:'#0c0818', cMid:'#1a1030', cLit:'#2c1a4a',
        lth:'#2a1c38',  lthLt:'#3e2c50',
        sash:'#601898', sashLt:'#8020cc',
        orb:'#a040f8',  orbIn:'#d090ff', orbGlo:'rgba(160,60,248,0.55)',
        blast:'#7020e0',blastHi:'#e0a0ff',
        eye:'#b040e8',  eyeGlo:'rgba(180,40,240,0.5)',
        skin:'#b090a0',
        hDk:'#100a1c',  hMid:'#1e1030', hLit:'#301848',
        tentDk:'#200830',tentLt:'#3a1458',
        boot:'#0c0814',
    };
    const t = anim?.t ?? 0;
    let dY=0, orbRaise=0, blastPulse=0;
    if (anim?.type === 'warlock_blast') {
        if (t < 0.28)      { orbRaise=t/0.28; }
        else if (t < 0.58) { orbRaise=1; blastPulse=(t-0.28)/0.30; dY=blastPulse*3; }
        else if (t < 0.70) { const p=(t-0.58)/0.12; orbRaise=1; blastPulse=1+p*2; dY=3-p*3; }
        else               { const p=(t-0.70)/0.30; orbRaise=1-p*0.45; blastPulse=0; }
    }
    drawShadow(ctx, cx, by);
    const shY=by-38-dY*0.65;
    // Long dark coat (tighter than wizard robe)
    ctx.fillStyle=C.cDk;
    ctx.beginPath(); ctx.moveTo(cx-11,by); ctx.lineTo(cx+12,by); ctx.lineTo(cx+9,by-36); ctx.lineTo(cx-10,by-36); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.cMid;
    ctx.beginPath(); ctx.moveTo(cx-1,by); ctx.lineTo(cx+5,by); ctx.lineTo(cx+4,by-36); ctx.lineTo(cx-1,by-36); ctx.closePath(); ctx.fill();
    // Boots
    ctx.fillStyle=C.boot; ctx.fillRect(cx-9,by-6,6,6); ctx.fillRect(cx+3,by-5,6,5);
    ctx.fillStyle=C.lth; ctx.fillRect(cx-9,by-8,6,2); ctx.fillRect(cx+3,by-7,6,2);
    // Coat splits at legs
    ctx.fillStyle=C.cDk;
    ctx.fillRect(cx-9,by-22,5,16); ctx.fillRect(cx+4,by-20,5,15);
    ctx.fillStyle=C.lth; ctx.fillRect(cx-8,by-21,2,14); ctx.fillRect(cx+5,by-19,2,13);
    // Eldritch rune on coat back
    ctx.save(); ctx.globalAlpha=0.22+Math.min(1,blastPulse)*0.38;
    ctx.shadowColor=C.orb; ctx.shadowBlur=8;
    ctx.strokeStyle=C.orb; ctx.lineWidth=0.8;
    for (let v=0;v<5;v++) { const va=v*Math.PI*2/5-Math.PI/2; const vb=((v+2)%5)*Math.PI*2/5-Math.PI/2; ctx.beginPath(); ctx.moveTo(cx+Math.cos(va)*7,by-22+Math.sin(va)*7); ctx.lineTo(cx+Math.cos(vb)*7,by-22+Math.sin(vb)*7); ctx.stroke(); }
    ctx.restore();
    // Belt/sash
    ctx.fillStyle=C.sash; ctx.fillRect(cx-10,by-30,21,3);
    ctx.fillStyle=C.sashLt; ctx.fillRect(cx-10,by-31,21,2);
    // Tentacle motifs on coat sides (subtle)
    ctx.save(); ctx.globalAlpha=0.18+Math.min(1,blastPulse)*0.15;
    ctx.strokeStyle=C.tentLt; ctx.lineWidth=1;
    for (const [tx,dir] of [[-9,1],[9,-1]]) {
        ctx.beginPath(); ctx.moveTo(cx+tx,by-10); ctx.quadraticCurveTo(cx+tx+dir*5,by-16,cx+tx,by-22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx+tx,by-15); ctx.quadraticCurveTo(cx+tx+dir*4,by-20,cx+tx+dir*3,by-26); ctx.stroke();
    }
    ctx.restore();
    // Upper coat
    const upShY=shY-14;
    ctx.fillStyle=C.cDk;
    ctx.beginPath(); ctx.moveTo(cx-10,by-36); ctx.lineTo(cx+9,by-36); ctx.lineTo(cx+7,upShY); ctx.lineTo(cx-9,upShY); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.cMid;
    ctx.beginPath(); ctx.moveTo(cx-1,by-36); ctx.lineTo(cx+5,by-36); ctx.lineTo(cx+4,upShY); ctx.lineTo(cx-0,upShY); ctx.closePath(); ctx.fill();
    // Free arm (right)
    ctx.fillStyle=C.cDk;
    ctx.beginPath(); ctx.moveTo(cx+9,upShY); ctx.lineTo(cx+16,upShY+5); ctx.lineTo(cx+17,upShY+14); ctx.lineTo(cx+13,upShY+16); ctx.lineTo(cx+7,upShY+10); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.skin; ctx.beginPath(); ctx.arc(cx+16,upShY+14,4,0,Math.PI*2); ctx.fill();
    // Pact focus arm (left/attacking)
    const pAncX=cx-10, pAncY=upShY+2;
    const pA0=-Math.PI*0.50, pA1=-Math.PI*0.72;
    const pAng=pA0+(pA1-pA0)*orbRaise;
    const pLen=18;
    const pHX=pAncX+Math.cos(pAng)*pLen, pHY=pAncY+Math.sin(pAng)*pLen;
    ctx.strokeStyle=C.cDk; ctx.lineWidth=8; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(pAncX,pAncY); ctx.lineTo(pHX-Math.cos(pAng)*pLen*0.5,pHY-Math.sin(pAng)*pLen*0.5); ctx.stroke();
    ctx.strokeStyle=C.lth; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(pAncX,pAncY); ctx.lineTo(pHX-Math.cos(pAng)*pLen*0.5,pHY-Math.sin(pAng)*pLen*0.5); ctx.stroke();
    ctx.fillStyle=C.lth; ctx.beginPath(); ctx.arc(pHX-Math.cos(pAng)*pLen*0.5,pHY-Math.sin(pAng)*pLen*0.5,4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=C.cDk; ctx.lineWidth=7;
    ctx.beginPath(); ctx.moveTo(pHX-Math.cos(pAng)*pLen*0.5,pHY-Math.sin(pAng)*pLen*0.5); ctx.lineTo(pHX,pHY); ctx.stroke();
    ctx.fillStyle=C.skin; ctx.beginPath(); ctx.arc(pHX,pHY,5,0,Math.PI*2); ctx.fill();
    // Pact crystal (floating eye-orb held in hand)
    ctx.save();
    ctx.shadowColor=C.orb; ctx.shadowBlur=10+Math.min(1,blastPulse)*22;
    ctx.globalAlpha=0.85+Math.min(1,blastPulse)*0.12;
    // Crystal facets
    ctx.fillStyle=C.orb;
    ctx.beginPath(); ctx.moveTo(pHX,pHY-10); ctx.lineTo(pHX+6,pHY); ctx.lineTo(pHX,pHY+6); ctx.lineTo(pHX-6,pHY); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.orbIn;
    ctx.beginPath(); ctx.moveTo(pHX,pHY-7); ctx.lineTo(pHX+4,pHY); ctx.lineTo(pHX,pHY+3); ctx.lineTo(pHX-4,pHY); ctx.closePath(); ctx.fill();
    // Eye slit inside crystal
    ctx.fillStyle='#200840';
    ctx.beginPath(); ctx.ellipse(pHX,pHY-1,3,1.5,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.orb;
    ctx.beginPath(); ctx.arc(pHX,pHY-1,1,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // Charge ring + blast release
    if (blastPulse>0) {
        ctx.save();
        ctx.globalAlpha=Math.min(1,blastPulse)*0.5;
        ctx.shadowColor=C.orb; ctx.shadowBlur=0;
        ctx.strokeStyle=C.orb; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.arc(pHX,pHY,10+Math.min(1,blastPulse)*8,0,Math.PI*2); ctx.stroke();
        if (blastPulse>1) {
            ctx.globalAlpha=(blastPulse-1)*0.85;
            ctx.shadowColor=C.blastHi; ctx.shadowBlur=24;
            ctx.fillStyle=C.blastHi;
            ctx.beginPath(); ctx.arc(pHX,pHY,14,0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
    // Coat arm sleeve
    ctx.fillStyle=C.cDk;
    ctx.beginPath(); ctx.moveTo(pAncX,pAncY); ctx.lineTo(pAncX-8,pAncY+8); ctx.lineTo(pAncX-6,pAncY+14); ctx.lineTo(pAncX,pAncY+8); ctx.closePath(); ctx.fill();
    // Shoulders
    ctx.fillStyle=C.cDk; ctx.beginPath(); ctx.ellipse(cx-11,shY,9,5,-0.15,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.cMid; ctx.beginPath(); ctx.ellipse(cx-10,shY-1,6,3.5,-0.15,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=C.sash; ctx.lineWidth=0.8; ctx.beginPath(); ctx.ellipse(cx-11,shY,9,5,-0.15,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle=C.cDk; ctx.beginPath(); ctx.ellipse(cx+11,shY,8,4.5,0.15,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.cMid; ctx.beginPath(); ctx.ellipse(cx+10,shY-1,5,3.5,0.15,0,Math.PI*2); ctx.fill();
    // Head (dark cowl/hood)
    const hcX=cx, hcY=shY-13-dY;
    ctx.fillStyle=C.hDk; ctx.beginPath(); ctx.arc(hcX,hcY,12,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.hMid; ctx.beginPath(); ctx.arc(hcX-1,hcY-1,9,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#0a0510'; ctx.beginPath(); ctx.ellipse(hcX+2,hcY+2,8,6,0,0,Math.PI*2); ctx.fill();
    // Glowing eyes under cowl
    ctx.save();
    ctx.shadowColor=C.eye; ctx.shadowBlur=10;
    ctx.globalAlpha=0.65+Math.min(1,blastPulse)*0.30;
    ctx.fillStyle=C.eye;
    ctx.beginPath(); ctx.arc(hcX,hcY+1,2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(hcX+5,hcY+1,2,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // Cowl peak
    ctx.fillStyle=C.hDk;
    ctx.beginPath(); ctx.moveTo(hcX-6,hcY-9); ctx.lineTo(hcX+6,hcY-9); ctx.lineTo(hcX+4,hcY-22); ctx.lineTo(hcX,hcY-26); ctx.lineTo(hcX-2,hcY-21); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.hMid;
    ctx.beginPath(); ctx.moveTo(hcX+2,hcY-9); ctx.lineTo(hcX+6,hcY-9); ctx.lineTo(hcX+4,hcY-22); ctx.lineTo(hcX+2,hcY-20); ctx.closePath(); ctx.fill();
    if (sel) _drawSelectRing(ctx, cx, by);
}

// ── Aquorist (Cold) ───────────────────────────────────────────────────────────
function drawAquorist(ctx, cx, by, sel, anim) {
    const C = {
        rDk:'#0c2038', rMid:'#183868', rLit:'#2a60a0',
        crys:'#90d4f8', crysIn:'#dff0ff',
        sash:'#3880c0', sashLt:'#60a0d8',
        stWd:'#1a3058', stLt:'#2858a0',
        eye:'#70c8f8', skin:'#bcc8d8',
        hDk:'#091c2e', hMid:'#162e4a', hair:'#d0e4f0',
    };
    const t = anim?.t ?? 0;
    let dY=0, staffRaise=0, frostPulse=0;
    if (anim?.type === 'aquorist_spell') {
        if (t < 0.30)      { staffRaise=t/0.30; dY=staffRaise*2; }
        else if (t < 0.60) { staffRaise=1; frostPulse=(t-0.30)/0.30; dY=2+frostPulse*2; }
        else if (t < 0.72) { const p=(t-0.60)/0.12; staffRaise=1; frostPulse=1+p*2; dY=4-p*4; }
        else               { const p=(t-0.72)/0.28; staffRaise=1-p*0.4; frostPulse=0; }
    }
    drawShadow(ctx, cx, by);
    const shY=by-38-dY*0.65;
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(cx-13,by+1); ctx.lineTo(cx+13,by+1); ctx.lineTo(cx+10,by-38); ctx.lineTo(cx-11,by-38); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.rMid;
    ctx.beginPath(); ctx.moveTo(cx,by+1); ctx.lineTo(cx+5,by+1); ctx.lineTo(cx+4,by-38); ctx.lineTo(cx,by-38); ctx.closePath(); ctx.fill();
    // Frost crystal trim at hem
    ctx.save(); ctx.globalAlpha=0.40+frostPulse*0.25; ctx.strokeStyle=C.crys; ctx.lineWidth=0.8;
    for (let i=0;i<6;i++) { const hx=cx-12+i*5; ctx.beginPath(); ctx.moveTo(hx,by-1); ctx.lineTo(hx+1.5,by+4); ctx.lineTo(hx+3,by-1); ctx.stroke(); }
    ctx.restore();
    // Snowflake rune on robe
    ctx.save(); ctx.globalAlpha=0.18+Math.min(1,frostPulse)*0.30; ctx.shadowColor=C.crys; ctx.shadowBlur=8;
    ctx.strokeStyle=C.crys; ctx.lineWidth=0.8;
    for (let a=0;a<6;a++) { const ang=a*Math.PI/3; ctx.beginPath(); ctx.moveTo(cx+Math.cos(ang)*2,by-18+Math.sin(ang)*2); ctx.lineTo(cx+Math.cos(ang)*8,by-18+Math.sin(ang)*8); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle=C.sash; ctx.fillRect(cx-10,by-33,21,3);
    ctx.fillStyle=C.sashLt; ctx.fillRect(cx-10,by-34,21,2);
    const upShY=shY-14;
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(cx-11,by-38); ctx.lineTo(cx+10,by-38); ctx.lineTo(cx+8,upShY); ctx.lineTo(cx-9,upShY); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.rMid;
    ctx.beginPath(); ctx.moveTo(cx,by-38); ctx.lineTo(cx+6,by-38); ctx.lineTo(cx+5,upShY); ctx.lineTo(cx,upShY); ctx.closePath(); ctx.fill();
    const fAX=cx+10, fAY=upShY+2;
    const fAngA=-Math.PI*0.20-(frostPulse>0?0.2*Math.min(1,frostPulse):0);
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(fAX,fAY); ctx.lineTo(fAX+10*Math.cos(fAngA),fAY+10*Math.sin(fAngA)); ctx.lineTo(fAX+16*Math.cos(fAngA-0.25),fAY+16*Math.sin(fAngA-0.25)); ctx.lineTo(fAX+12,fAY+14); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.skin;
    const fHAX=fAX+Math.cos(fAngA-0.15)*17, fHAY=fAY+Math.sin(fAngA-0.15)*17;
    ctx.beginPath(); ctx.arc(fHAX,fHAY,4,0,Math.PI*2); ctx.fill();
    if (frostPulse>0) {
        ctx.save(); ctx.shadowColor=C.crys; ctx.shadowBlur=14;
        ctx.globalAlpha=Math.min(1,frostPulse)*0.5; ctx.fillStyle=C.crys;
        ctx.beginPath(); ctx.arc(fHAX,fHAY,4+Math.min(1,frostPulse)*6,0,Math.PI*2); ctx.fill();
        if (frostPulse>1) { ctx.globalAlpha=(frostPulse-1)*0.80; ctx.fillStyle=C.crysIn; ctx.beginPath(); ctx.arc(fHAX,fHAY,14,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
    }
    const stAncAX=cx-10, stAncAY=upShY+2;
    const stA0A=-Math.PI*0.48, stA1A=-Math.PI*0.70;
    const stAngA=stA0A+(stA1A-stA0A)*staffRaise;
    const stLenA=40;
    const stTAX=stAncAX+Math.cos(stAngA)*stLenA, stTAY=stAncAY+Math.sin(stAngA)*stLenA;
    ctx.strokeStyle=C.stWd; ctx.lineWidth=3; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(stAncAX,stAncAY); ctx.lineTo(stTAX,stTAY); ctx.stroke();
    ctx.strokeStyle=C.stLt; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(stAncAX,stAncAY); ctx.lineTo(stTAX,stTAY); ctx.stroke();
    ctx.save(); ctx.shadowColor=C.crys; ctx.shadowBlur=10+Math.min(1,frostPulse)*18;
    ctx.fillStyle=C.crys; ctx.beginPath(); ctx.arc(stTAX,stTAY,7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.crysIn; ctx.beginPath(); ctx.arc(stTAX-2,stTAY-2,4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#d0eeff'; ctx.lineWidth=0.7; ctx.globalAlpha=0.7;
    ctx.beginPath(); ctx.moveTo(stTAX-6,stTAY); ctx.lineTo(stTAX+6,stTAY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(stTAX,stTAY-6); ctx.lineTo(stTAX,stTAY+6); ctx.stroke();
    ctx.restore();
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(stAncAX,stAncAY); ctx.lineTo(stAncAX-7,stAncAY+8); ctx.lineTo(stAncAX-5,stAncAY+13); ctx.lineTo(stAncAX,stAncAY+8); ctx.closePath(); ctx.fill();
    const hcAX=cx, hcAY=upShY-10-dY;
    ctx.fillStyle=C.hDk; ctx.beginPath(); ctx.arc(hcAX,hcAY,11,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin; ctx.beginPath(); ctx.arc(hcAX+1,hcAY+1,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin; ctx.fillRect(hcAX-3,hcAY+6,6,4);
    ctx.strokeStyle=C.hair; ctx.lineWidth=2.5; ctx.lineCap='round';
    for (const [x1,y1,x2,y2] of [[-7,-5,-12,-16],[-3,-9,-7,-21],[4,-10,6,-22],[8,-7,14,-15]]) {
        ctx.beginPath(); ctx.moveTo(hcAX+x1,hcAY+y1); ctx.quadraticCurveTo(hcAX+(x1+x2)/2,hcAY+(y1+y2)/2-3,hcAX+x2,hcAY+y2); ctx.stroke();
    }
    ctx.save(); ctx.shadowColor='rgba(80,200,248,0.45)'; ctx.shadowBlur=7;
    ctx.globalAlpha=0.70+Math.min(1,frostPulse)*0.25;
    ctx.fillStyle=C.eye; ctx.beginPath(); ctx.arc(hcAX+4,hcAY,2,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle=C.hDk; ctx.beginPath(); ctx.arc(hcAX,hcAY,11,Math.PI*1.0,0,false); ctx.fill();
    ctx.fillStyle=C.hMid; ctx.beginPath(); ctx.arc(hcAX,hcAY,9,Math.PI*1.1,Math.PI*1.9,false); ctx.fill();
    if (sel) _drawSelectRing(ctx, cx, by);
}

// ── Stormcaller (Lightning) ───────────────────────────────────────────────────
function drawStormcaller(ctx, cx, by, sel, anim) {
    const C = {
        cDk:'#18181e', cMid:'#24242e', cLit:'#36364a',
        bolt:'#c8e8ff', boltHi:'#ffffff',
        sash:'#2040a0', sashLt:'#3060d0',
        stWd:'#1e1e28', stLt:'#303048',
        eye:'#c0d8ff', skin:'#a8a8bc',
        hDk:'#101018', hMid:'#1e1e28',
        hair:'#8090b0',
    };
    const t = anim?.t ?? 0;
    let dY=0, staffRaise=0, boltPulse=0;
    if (anim?.type === 'stormcaller_spell') {
        if (t < 0.30)      { staffRaise=t/0.30; dY=staffRaise*2; }
        else if (t < 0.60) { staffRaise=1; boltPulse=(t-0.30)/0.30; dY=2+boltPulse*2; }
        else if (t < 0.72) { const p=(t-0.60)/0.12; staffRaise=1; boltPulse=1+p*2; dY=4-p*4; }
        else               { const p=(t-0.72)/0.28; staffRaise=1-p*0.4; boltPulse=0; }
    }
    drawShadow(ctx, cx, by);
    const shY=by-38-dY*0.65;
    ctx.fillStyle=C.cDk;
    ctx.beginPath(); ctx.moveTo(cx-11,by); ctx.lineTo(cx+12,by); ctx.lineTo(cx+10,by-38); ctx.lineTo(cx-10,by-38); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.cMid;
    ctx.beginPath(); ctx.moveTo(cx,by); ctx.lineTo(cx+5,by); ctx.lineTo(cx+4,by-38); ctx.lineTo(cx,by-38); ctx.closePath(); ctx.fill();
    // Jagged lightning trim at hem
    ctx.save(); ctx.globalAlpha=0.40+boltPulse*0.30; ctx.strokeStyle=C.bolt; ctx.lineWidth=0.9;
    ctx.beginPath(); ctx.moveTo(cx-11,by-1);
    for (let i=0;i<7;i++) { const bx=cx-11+i*3.5; ctx.lineTo(bx+1.5,by-3+(i%2)*4); ctx.lineTo(bx+3.5,by-1); }
    ctx.stroke(); ctx.restore();
    // Lightning bolt rune on coat
    ctx.save(); ctx.globalAlpha=0.20+Math.min(1,boltPulse)*0.32; ctx.shadowColor=C.bolt; ctx.shadowBlur=8;
    ctx.strokeStyle=C.bolt; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(cx+2,by-27); ctx.lineTo(cx-2,by-21); ctx.lineTo(cx+1,by-21); ctx.lineTo(cx-3,by-15); ctx.stroke();
    ctx.restore();
    ctx.fillStyle=C.sash; ctx.fillRect(cx-10,by-31,21,3);
    ctx.fillStyle=C.sashLt; ctx.fillRect(cx-10,by-32,21,2);
    const upShY=shY-14;
    ctx.fillStyle=C.cDk;
    ctx.beginPath(); ctx.moveTo(cx-10,by-38); ctx.lineTo(cx+10,by-38); ctx.lineTo(cx+8,upShY); ctx.lineTo(cx-8,upShY); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.cMid;
    ctx.beginPath(); ctx.moveTo(cx,by-38); ctx.lineTo(cx+5,by-38); ctx.lineTo(cx+4,upShY); ctx.lineTo(cx,upShY); ctx.closePath(); ctx.fill();
    const fAX=cx+10, fAY=upShY+2;
    const fAngS=-Math.PI*0.30-(boltPulse>0?0.25*Math.min(1,boltPulse):0);
    ctx.fillStyle=C.cDk;
    ctx.beginPath(); ctx.moveTo(fAX,fAY); ctx.lineTo(fAX+10*Math.cos(fAngS),fAY+10*Math.sin(fAngS)); ctx.lineTo(fAX+16*Math.cos(fAngS-0.2),fAY+16*Math.sin(fAngS-0.2)); ctx.lineTo(fAX+12,fAY+14); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.skin;
    const fHSX=fAX+Math.cos(fAngS-0.12)*17, fHSY=fAY+Math.sin(fAngS-0.12)*17;
    ctx.beginPath(); ctx.arc(fHSX,fHSY,4,0,Math.PI*2); ctx.fill();
    if (boltPulse>0) {
        ctx.save(); ctx.shadowColor=C.bolt; ctx.shadowBlur=16;
        ctx.globalAlpha=Math.min(1,boltPulse)*0.55; ctx.fillStyle=C.bolt;
        ctx.beginPath(); ctx.arc(fHSX,fHSY,4+Math.min(1,boltPulse)*7,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle=C.bolt; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(fHSX,fHSY); ctx.lineTo(fHSX+4,fHSY-5); ctx.lineTo(fHSX+2,fHSY-9); ctx.lineTo(fHSX+6,fHSY-14); ctx.stroke();
        if (boltPulse>1) { ctx.globalAlpha=(boltPulse-1)*0.85; ctx.fillStyle=C.boltHi; ctx.beginPath(); ctx.arc(fHSX,fHSY,14,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
    }
    const stAncSX=cx-10, stAncSY=upShY+2;
    const stA0S=-Math.PI*0.48, stA1S=-Math.PI*0.72;
    const stAngS=stA0S+(stA1S-stA0S)*staffRaise;
    const stLenS=42;
    const stTSX=stAncSX+Math.cos(stAngS)*stLenS, stTSY=stAncSY+Math.sin(stAngS)*stLenS;
    ctx.strokeStyle=C.stWd; ctx.lineWidth=3; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(stAncSX,stAncSY); ctx.lineTo(stTSX,stTSY); ctx.stroke();
    ctx.strokeStyle=C.stLt; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(stAncSX,stAncSY); ctx.lineTo(stTSX,stTSY); ctx.stroke();
    ctx.save(); ctx.shadowColor=C.bolt; ctx.shadowBlur=12+Math.min(1,boltPulse)*16;
    ctx.fillStyle=C.bolt; ctx.beginPath(); ctx.arc(stTSX,stTSY,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.boltHi; ctx.beginPath(); ctx.arc(stTSX,stTSY,3,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=C.bolt; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(stTSX,stTSY); ctx.lineTo(stTSX-5,stTSY-9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(stTSX,stTSY); ctx.lineTo(stTSX+5,stTSY-9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(stTSX,stTSY); ctx.lineTo(stTSX,stTSY-10); ctx.stroke();
    ctx.restore();
    ctx.fillStyle=C.cDk;
    ctx.beginPath(); ctx.moveTo(stAncSX,stAncSY); ctx.lineTo(stAncSX-7,stAncSY+7); ctx.lineTo(stAncSX-5,stAncSY+13); ctx.lineTo(stAncSX,stAncSY+8); ctx.closePath(); ctx.fill();
    const hcSX=cx, hcSY=upShY-10-dY;
    ctx.fillStyle=C.hDk; ctx.beginPath(); ctx.arc(hcSX,hcSY,11,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin; ctx.beginPath(); ctx.arc(hcSX+1,hcSY+1,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin; ctx.fillRect(hcSX-3,hcSY+6,6,4);
    // Wild windswept hair
    ctx.strokeStyle=C.hair; ctx.lineWidth=2; ctx.lineCap='round';
    for (const [x1,y1,x2,y2] of [[-8,-5,-16,-12],[-5,-9,-14,-18],[1,-11,2,-22],[7,-9,16,-18],[9,-4,18,-9]]) {
        ctx.beginPath(); ctx.moveTo(hcSX+x1,hcSY+y1); ctx.quadraticCurveTo(hcSX+(x1+x2)/2+3,hcSY+(y1+y2)/2-2,hcSX+x2,hcSY+y2); ctx.stroke();
    }
    ctx.save(); ctx.shadowColor='rgba(180,220,255,0.5)'; ctx.shadowBlur=7;
    ctx.globalAlpha=0.72+Math.min(1,boltPulse)*0.25;
    ctx.fillStyle=C.eye; ctx.beginPath(); ctx.arc(hcSX+4,hcSY,2,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle=C.hDk; ctx.beginPath(); ctx.arc(hcSX,hcSY,11,Math.PI*1.0,0,false); ctx.fill();
    ctx.fillStyle=C.hMid; ctx.beginPath(); ctx.arc(hcSX,hcSY,9,Math.PI*1.1,Math.PI*1.9,false); ctx.fill();
    if (sel) _drawSelectRing(ctx, cx, by);
}

// ── Lifewhisperer (Nature) ────────────────────────────────────────────────────
function drawLifewhisperer(ctx, cx, by, sel, anim) {
    const C = {
        rDk:'#1a3010', rMid:'#284818', rLit:'#3a6022',
        leaf:'#50b830', leafLt:'#80d850',
        sash:'#4a7820', sashLt:'#6a9830',
        stWd:'#3a2010', stLt:'#5a3818',
        eye:'#60c838', skin:'#c8a878',
        hDk:'#1a2a10', hMid:'#283a18', hair:'#3a2808',
    };
    const t = anim?.t ?? 0;
    let dY=0, staffRaise=0, naturePulse=0;
    if (anim?.type === 'lifewhisperer_spell') {
        if (t < 0.30)      { staffRaise=t/0.30; dY=staffRaise*2; }
        else if (t < 0.60) { staffRaise=1; naturePulse=(t-0.30)/0.30; dY=2+naturePulse*2; }
        else if (t < 0.72) { const p=(t-0.60)/0.12; staffRaise=1; naturePulse=1+p*2; dY=4-p*4; }
        else               { const p=(t-0.72)/0.28; staffRaise=1-p*0.4; naturePulse=0; }
    }
    drawShadow(ctx, cx, by);
    const shY=by-38-dY*0.65;
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(cx-13,by+1); ctx.lineTo(cx+13,by+1); ctx.lineTo(cx+11,by-38); ctx.lineTo(cx-12,by-38); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.rMid;
    ctx.beginPath(); ctx.moveTo(cx-1,by+1); ctx.lineTo(cx+5,by+1); ctx.lineTo(cx+4,by-38); ctx.lineTo(cx-1,by-38); ctx.closePath(); ctx.fill();
    // Leaf motifs at hem
    ctx.save(); ctx.globalAlpha=0.35+naturePulse*0.25; ctx.fillStyle=C.leaf;
    for (let i=0;i<4;i++) { const hx=cx-9+i*6; ctx.beginPath(); ctx.ellipse(hx,by-1,2,4,0.3+i*0.15,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
    // Vine rune on robe
    ctx.save(); ctx.globalAlpha=0.20+Math.min(1,naturePulse)*0.30; ctx.shadowColor=C.leaf; ctx.shadowBlur=6;
    ctx.strokeStyle=C.leaf; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(cx-4,by-26); ctx.quadraticCurveTo(cx+4,by-22,cx+2,by-14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+3,by-22); ctx.quadraticCurveTo(cx+8,by-20,cx+7,by-16); ctx.stroke();
    ctx.restore();
    ctx.fillStyle=C.sash; ctx.fillRect(cx-10,by-33,21,3);
    ctx.fillStyle=C.sashLt; ctx.fillRect(cx-10,by-34,21,2);
    const upShY=shY-14;
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(cx-12,by-38); ctx.lineTo(cx+11,by-38); ctx.lineTo(cx+9,upShY); ctx.lineTo(cx-10,upShY); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.rMid;
    ctx.beginPath(); ctx.moveTo(cx-1,by-38); ctx.lineTo(cx+5,by-38); ctx.lineTo(cx+4,upShY); ctx.lineTo(cx-1,upShY); ctx.closePath(); ctx.fill();
    const fAX=cx+10, fAY=upShY+2;
    const fAngL=-Math.PI*0.18-(naturePulse>0?0.25*Math.min(1,naturePulse):0);
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(fAX,fAY); ctx.lineTo(fAX+10*Math.cos(fAngL),fAY+10*Math.sin(fAngL)); ctx.lineTo(fAX+16*Math.cos(fAngL-0.25),fAY+16*Math.sin(fAngL-0.25)); ctx.lineTo(fAX+12,fAY+14); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.skin;
    const fHLX=fAX+Math.cos(fAngL-0.15)*17, fHLY=fAY+Math.sin(fAngL-0.15)*17;
    ctx.beginPath(); ctx.arc(fHLX,fHLY,4,0,Math.PI*2); ctx.fill();
    if (naturePulse>0) {
        ctx.save(); ctx.shadowColor=C.leaf; ctx.shadowBlur=14;
        ctx.globalAlpha=Math.min(1,naturePulse)*0.50; ctx.fillStyle=C.leaf;
        ctx.beginPath(); ctx.arc(fHLX,fHLY,5+Math.min(1,naturePulse)*6,0,Math.PI*2); ctx.fill();
        if (naturePulse>1) { ctx.globalAlpha=(naturePulse-1)*0.85; ctx.fillStyle=C.leafLt; ctx.beginPath(); ctx.arc(fHLX,fHLY,14,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
    }
    const stAncLX=cx-10, stAncLY=upShY+2;
    const stA0L=-Math.PI*0.48, stA1L=-Math.PI*0.68;
    const stAngL=stA0L+(stA1L-stA0L)*staffRaise;
    const stLenL=41;
    const stTLX=stAncLX+Math.cos(stAngL)*stLenL, stTLY=stAncLY+Math.sin(stAngL)*stLenL;
    ctx.strokeStyle=C.stWd; ctx.lineWidth=4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(stAncLX,stAncLY); ctx.lineTo(stTLX,stTLY); ctx.stroke();
    ctx.strokeStyle=C.stLt; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(stAncLX,stAncLY); ctx.lineTo(stTLX,stTLY); ctx.stroke();
    for (const kf of [0.3,0.6,0.8]) { const kX=stAncLX+Math.cos(stAngL)*stLenL*kf, kY=stAncLY+Math.sin(stAngL)*stLenL*kf; ctx.fillStyle=C.stLt; ctx.beginPath(); ctx.arc(kX,kY,2.5,0,Math.PI*2); ctx.fill(); }
    // Leaf at staff tip
    ctx.save(); ctx.shadowColor=C.leaf; ctx.shadowBlur=10+Math.min(1,naturePulse)*14;
    ctx.fillStyle=C.leaf; ctx.globalAlpha=0.7+Math.min(1,naturePulse)*0.3;
    ctx.beginPath(); ctx.ellipse(stTLX,stTLY,5,9,stAngL+Math.PI*0.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.leafLt; ctx.beginPath(); ctx.ellipse(stTLX-1,stTLY-1,3,6,stAngL+Math.PI*0.5,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(stAncLX,stAncLY); ctx.lineTo(stAncLX-8,stAncLY+8); ctx.lineTo(stAncLX-6,stAncLY+14); ctx.lineTo(stAncLX,stAncLY+8); ctx.closePath(); ctx.fill();
    const hcLX=cx, hcLY=upShY-10-dY;
    ctx.fillStyle=C.hDk; ctx.beginPath(); ctx.arc(hcLX,hcLY,11,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin; ctx.beginPath(); ctx.arc(hcLX+1,hcLY+1,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin; ctx.fillRect(hcLX-3,hcLY+6,6,4);
    ctx.strokeStyle=C.hair; ctx.lineWidth=3; ctx.lineCap='round';
    for (const [x1,y1,x2,y2] of [[-7,-6,-10,-18],[-2,-10,-4,-22],[5,-10,8,-20],[8,-6,12,-14]]) {
        ctx.beginPath(); ctx.moveTo(hcLX+x1,hcLY+y1); ctx.quadraticCurveTo(hcLX+(x1+x2)/2,hcLY+(y1+y2)/2-2,hcLX+x2,hcLY+y2); ctx.stroke();
    }
    ctx.save(); ctx.shadowColor='rgba(60,200,40,0.4)'; ctx.shadowBlur=7;
    ctx.globalAlpha=0.70+Math.min(1,naturePulse)*0.25;
    ctx.fillStyle=C.eye; ctx.beginPath(); ctx.arc(hcLX+4,hcLY,2,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle=C.hDk; ctx.beginPath(); ctx.arc(hcLX,hcLY,11,Math.PI*1.0,0,false); ctx.fill();
    ctx.fillStyle=C.hMid; ctx.beginPath(); ctx.arc(hcLX,hcLY,9,Math.PI*1.1,Math.PI*1.9,false); ctx.fill();
    if (sel) _drawSelectRing(ctx, cx, by);
}

// ── Shaman (Spirit) ───────────────────────────────────────────────────────────
function drawShaman(ctx, cx, by, sel, anim) {
    const C = {
        hide:'#5a3c18', hideLt:'#7a5428', hideDk:'#3a2810',
        bone:'#d0c898', boneDk:'#a09870',
        sash:'#2858a0', sashLt:'#4078c8',
        spirit:'#40c8c0', spiritGlo:'rgba(48,200,192,0.55)',
        stWd:'#3a2810', stLt:'#5a4020',
        eye:'#50d8d0', skin:'#c0946a',
        feather:'#2048a0',
        hHide:'#1e1008', hLt:'#3a2010',
    };
    const t = anim?.t ?? 0;
    let dY=0, staffRaise=0, spiritPulse=0;
    if (anim?.type === 'shaman_spell') {
        if (t < 0.30)      { staffRaise=t/0.30; dY=staffRaise*2; }
        else if (t < 0.60) { staffRaise=1; spiritPulse=(t-0.30)/0.30; dY=2+spiritPulse*2; }
        else if (t < 0.72) { const p=(t-0.60)/0.12; staffRaise=1; spiritPulse=1+p*2; dY=4-p*4; }
        else               { const p=(t-0.72)/0.28; staffRaise=1-p*0.4; spiritPulse=0; }
    }
    drawShadow(ctx, cx, by);
    const shY=by-38-dY*0.65;
    // Leather boots
    ctx.fillStyle=C.hideDk; ctx.fillRect(cx-9,by-5,7,5); ctx.fillRect(cx+2,by-4,7,4);
    ctx.fillStyle=C.hide; ctx.fillRect(cx-9,by-8,7,3); ctx.fillRect(cx+2,by-6,7,2);
    // Leather leggings
    ctx.fillStyle=C.hideDk; ctx.fillRect(cx-8,by-24,7,16); ctx.fillRect(cx+1,by-22,7,15);
    ctx.fillStyle=C.hideLt; ctx.fillRect(cx-7,by-20,2,10); ctx.fillRect(cx+2,by-18,2,10);
    // Leather torso
    ctx.fillStyle=C.hideDk;
    ctx.beginPath(); ctx.moveTo(cx-11,by-24); ctx.lineTo(cx+11,by-24); ctx.lineTo(cx+9,by-38); ctx.lineTo(cx-10,by-38); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.hide;
    ctx.beginPath(); ctx.moveTo(cx,by-24); ctx.lineTo(cx+7,by-24); ctx.lineTo(cx+6,by-38); ctx.lineTo(cx,by-38); ctx.closePath(); ctx.fill();
    // Bone trim
    ctx.strokeStyle=C.boneDk; ctx.lineWidth=1; ctx.setLineDash([2,3]);
    ctx.beginPath(); ctx.moveTo(cx-10,by-24); ctx.lineTo(cx+10,by-24); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle=C.bone;
    for (const [bx,by2] of [[-6,-29],[0,-27],[6,-29]]) { ctx.beginPath(); ctx.ellipse(cx+bx,by+by2,1.5,3,0,0,Math.PI*2); ctx.fill(); }
    // Spirit rune on tunic
    ctx.save(); ctx.globalAlpha=0.22+Math.min(1,spiritPulse)*0.32; ctx.shadowColor=C.spirit; ctx.shadowBlur=8;
    ctx.strokeStyle=C.spirit; ctx.lineWidth=0.9;
    ctx.beginPath(); ctx.arc(cx,by-32,5,0,Math.PI*2); ctx.stroke();
    for (let a=0;a<4;a++) { const ang=a*Math.PI/2; ctx.beginPath(); ctx.moveTo(cx+Math.cos(ang)*5,by-32+Math.sin(ang)*5); ctx.lineTo(cx+Math.cos(ang)*9,by-32+Math.sin(ang)*9); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle=C.sash; ctx.fillRect(cx-10,by-26,21,3);
    ctx.fillStyle=C.sashLt; ctx.fillRect(cx-10,by-27,21,2);
    const upShY=shY-14;
    ctx.fillStyle=C.hideDk;
    ctx.beginPath(); ctx.moveTo(cx-10,by-38); ctx.lineTo(cx+9,by-38); ctx.lineTo(cx+7,upShY); ctx.lineTo(cx-8,upShY); ctx.closePath(); ctx.fill();
    const fAX=cx+9, fAY=upShY+2;
    const fAngH=-Math.PI*0.25-(spiritPulse>0?0.25*Math.min(1,spiritPulse):0);
    ctx.fillStyle=C.hideDk;
    ctx.beginPath(); ctx.moveTo(fAX,fAY); ctx.lineTo(fAX+10*Math.cos(fAngH),fAY+10*Math.sin(fAngH)); ctx.lineTo(fAX+15*Math.cos(fAngH-0.22),fAY+15*Math.sin(fAngH-0.22)); ctx.lineTo(fAX+11,fAY+13); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.skin;
    const fHHX=fAX+Math.cos(fAngH-0.12)*16, fHHY=fAY+Math.sin(fAngH-0.12)*16;
    ctx.beginPath(); ctx.arc(fHHX,fHHY,4,0,Math.PI*2); ctx.fill();
    if (spiritPulse>0) {
        ctx.save(); ctx.shadowColor=C.spirit; ctx.shadowBlur=15;
        ctx.globalAlpha=Math.min(1,spiritPulse)*0.50; ctx.fillStyle=C.spirit;
        ctx.beginPath(); ctx.arc(fHHX,fHHY,4+Math.min(1,spiritPulse)*6,0,Math.PI*2); ctx.fill();
        if (spiritPulse>1) { ctx.globalAlpha=(spiritPulse-1)*0.8; ctx.fillStyle='#c0fff8'; ctx.beginPath(); ctx.arc(fHHX,fHHY,14,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
    }
    const stAncHX=cx-9, stAncHY=upShY+2;
    const stA0H=-Math.PI*0.50, stA1H=-Math.PI*0.72;
    const stAngH=stA0H+(stA1H-stA0H)*staffRaise;
    const stLenH=42;
    const stTHX=stAncHX+Math.cos(stAngH)*stLenH, stTHY=stAncHY+Math.sin(stAngH)*stLenH;
    ctx.strokeStyle=C.stWd; ctx.lineWidth=4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(stAncHX,stAncHY); ctx.lineTo(stTHX,stTHY); ctx.stroke();
    ctx.strokeStyle=C.stLt; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(stAncHX,stAncHY); ctx.lineTo(stTHX,stTHY); ctx.stroke();
    // Spirit orb at staff tip
    ctx.save(); ctx.shadowColor=C.spirit; ctx.shadowBlur=12+Math.min(1,spiritPulse)*18;
    ctx.fillStyle=C.spirit; ctx.beginPath(); ctx.arc(stTHX,stTHY,7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#c0fff8'; ctx.beginPath(); ctx.arc(stTHX-2,stTHY-2,4,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // Feathers on staff
    ctx.strokeStyle=C.feather; ctx.lineWidth=2; ctx.lineCap='round';
    for (const kf of [0.4,0.55]) { const kX=stAncHX+Math.cos(stAngH)*stLenH*kf, kY=stAncHY+Math.sin(stAngH)*stLenH*kf; ctx.beginPath(); ctx.moveTo(kX,kY); ctx.lineTo(kX+6,kY-8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(kX,kY); ctx.lineTo(kX+9,kY-4); ctx.stroke(); }
    ctx.fillStyle=C.hideDk;
    ctx.beginPath(); ctx.moveTo(stAncHX,stAncHY); ctx.lineTo(stAncHX-7,stAncHY+7); ctx.lineTo(stAncHX-5,stAncHY+13); ctx.lineTo(stAncHX,stAncHY+8); ctx.closePath(); ctx.fill();
    // Head — open face, tribal headband
    const hcHX=cx, hcHY=upShY-10-dY;
    ctx.fillStyle=C.skin; ctx.beginPath(); ctx.arc(hcHX,hcHY,10,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin; ctx.fillRect(hcHX-3,hcHY+6,6,4);
    ctx.fillStyle=C.hHide;
    ctx.beginPath(); ctx.arc(hcHX,hcHY,10,Math.PI*1.05,0); ctx.lineTo(hcHX,hcHY); ctx.closePath(); ctx.fill();
    // Headband
    ctx.fillStyle=C.sash; ctx.fillRect(hcHX-10,hcHY-2,20,4);
    ctx.fillStyle=C.sashLt; ctx.fillRect(hcHX-10,hcHY-3,20,2);
    ctx.fillStyle=C.bone; ctx.beginPath(); ctx.arc(hcHX,hcHY-2,3,0,Math.PI*2); ctx.fill();
    ctx.save(); ctx.shadowColor=C.spirit; ctx.shadowBlur=8;
    ctx.globalAlpha=0.70+Math.min(1,spiritPulse)*0.25;
    ctx.fillStyle=C.eye; ctx.beginPath(); ctx.arc(hcHX+4,hcHY+2,2,0,Math.PI*2); ctx.fill();
    ctx.restore();
    if (sel) _drawSelectRing(ctx, cx, by);
}

// ── Bloodsinger (Bleed) ───────────────────────────────────────────────────────
function drawBloodsinger(ctx, cx, by, sel, anim) {
    const C = {
        rDk:'#2e0008', rMid:'#480010', rLit:'#7a0018',
        blood:'#c82020', bloodLt:'#f04040', bloodDk:'#880010',
        sash:'#800018', sashLt:'#b82028',
        stWd:'#2a0808', stLt:'#4a1010',
        eye:'#f03030', skin:'#c09090',
        hDk:'#1e0006', hMid:'#360010', hair:'#1a0004',
    };
    const t = anim?.t ?? 0;
    let dY=0, staffRaise=0, bloodPulse=0;
    if (anim?.type === 'bloodsinger_spell') {
        if (t < 0.30)      { staffRaise=t/0.30; dY=staffRaise*2; }
        else if (t < 0.60) { staffRaise=1; bloodPulse=(t-0.30)/0.30; dY=2+bloodPulse*2; }
        else if (t < 0.72) { const p=(t-0.60)/0.12; staffRaise=1; bloodPulse=1+p*2; dY=4-p*4; }
        else               { const p=(t-0.72)/0.28; staffRaise=1-p*0.4; bloodPulse=0; }
    }
    drawShadow(ctx, cx, by);
    const shY=by-38-dY*0.65;
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(cx-13,by+1); ctx.lineTo(cx+14,by+1); ctx.lineTo(cx+11,by-38); ctx.lineTo(cx-12,by-38); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.rMid;
    ctx.beginPath(); ctx.moveTo(cx-1,by+1); ctx.lineTo(cx+5,by+1); ctx.lineTo(cx+4,by-38); ctx.lineTo(cx-1,by-38); ctx.closePath(); ctx.fill();
    // Blood drip trim at hem
    ctx.save(); ctx.globalAlpha=0.45+bloodPulse*0.3; ctx.fillStyle=C.blood;
    for (let i=0;i<5;i++) { const hx=cx-10+i*5; ctx.fillRect(hx,by-3,2,4+i%2*2); ctx.beginPath(); ctx.arc(hx+1,by+2,1.5,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
    // Blood sigil on robe
    ctx.save(); ctx.globalAlpha=0.20+Math.min(1,bloodPulse)*0.35; ctx.shadowColor=C.blood; ctx.shadowBlur=8;
    ctx.strokeStyle=C.blood; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(cx,by-20,6,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx,by-26); ctx.lineTo(cx-5,by-15); ctx.lineTo(cx+5,by-15); ctx.closePath(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle=C.sash; ctx.fillRect(cx-10,by-33,21,3);
    ctx.fillStyle=C.sashLt; ctx.fillRect(cx-10,by-34,21,2);
    const upShY=shY-14;
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(cx-12,by-38); ctx.lineTo(cx+11,by-38); ctx.lineTo(cx+9,upShY); ctx.lineTo(cx-10,upShY); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.rMid;
    ctx.beginPath(); ctx.moveTo(cx-1,by-38); ctx.lineTo(cx+5,by-38); ctx.lineTo(cx+4,upShY); ctx.lineTo(cx-1,upShY); ctx.closePath(); ctx.fill();
    const fAX=cx+10, fAY=upShY+2;
    const fAngB=-Math.PI*0.20-(bloodPulse>0?0.22*Math.min(1,bloodPulse):0);
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(fAX,fAY); ctx.lineTo(fAX+10*Math.cos(fAngB),fAY+10*Math.sin(fAngB)); ctx.lineTo(fAX+16*Math.cos(fAngB-0.25),fAY+16*Math.sin(fAngB-0.25)); ctx.lineTo(fAX+12,fAY+14); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.skin;
    const fHBX=fAX+Math.cos(fAngB-0.15)*17, fHBY=fAY+Math.sin(fAngB-0.15)*17;
    ctx.beginPath(); ctx.arc(fHBX,fHBY,4,0,Math.PI*2); ctx.fill();
    if (bloodPulse>0) {
        ctx.save(); ctx.shadowColor=C.blood; ctx.shadowBlur=14;
        ctx.globalAlpha=Math.min(1,bloodPulse)*0.55; ctx.fillStyle=C.blood;
        ctx.beginPath(); ctx.arc(fHBX,fHBY,5+Math.min(1,bloodPulse)*6,0,Math.PI*2); ctx.fill();
        if (bloodPulse>1) { ctx.globalAlpha=(bloodPulse-1)*0.85; ctx.fillStyle=C.bloodLt; ctx.beginPath(); ctx.arc(fHBX,fHBY,14,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
    }
    const stAncBX=cx-10, stAncBY=upShY+2;
    const stA0B=-Math.PI*0.50, stA1B=-Math.PI*0.72;
    const stAngB=stA0B+(stA1B-stA0B)*staffRaise;
    const stLenB=40;
    const stTBX=stAncBX+Math.cos(stAngB)*stLenB, stTBY=stAncBY+Math.sin(stAngB)*stLenB;
    ctx.strokeStyle=C.stWd; ctx.lineWidth=3; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(stAncBX,stAncBY); ctx.lineTo(stTBX,stTBY); ctx.stroke();
    ctx.strokeStyle=C.stLt; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(stAncBX,stAncBY); ctx.lineTo(stTBX,stTBY); ctx.stroke();
    // Blood orb at staff tip — pulsing crimson sphere
    ctx.save(); ctx.shadowColor=C.blood; ctx.shadowBlur=14+Math.min(1,bloodPulse)*18;
    ctx.fillStyle=C.bloodDk; ctx.beginPath(); ctx.arc(stTBX,stTBY,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.blood;   ctx.beginPath(); ctx.arc(stTBX,stTBY,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.bloodLt; ctx.beginPath(); ctx.arc(stTBX-2,stTBY-3,3,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=0.7+Math.min(1,bloodPulse)*0.25; ctx.fillStyle=C.blood;
    ctx.beginPath(); ctx.arc(stTBX,stTBY+9,1.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(stTBX+3,stTBY+12,1,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle=C.rDk;
    ctx.beginPath(); ctx.moveTo(stAncBX,stAncBY); ctx.lineTo(stAncBX-8,stAncBY+8); ctx.lineTo(stAncBX-6,stAncBY+13); ctx.lineTo(stAncBX,stAncBY+8); ctx.closePath(); ctx.fill();
    const hcBX=cx, hcBY=upShY-10-dY;
    ctx.fillStyle=C.hDk; ctx.beginPath(); ctx.arc(hcBX,hcBY,11,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin; ctx.beginPath(); ctx.arc(hcBX+1,hcBY+1,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin; ctx.fillRect(hcBX-3,hcBY+6,6,4);
    ctx.fillStyle=C.hair;
    ctx.beginPath(); ctx.arc(hcBX,hcBY,10,Math.PI*1.05,0); ctx.lineTo(hcBX,hcBY); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.shadowColor='rgba(240,40,40,0.6)'; ctx.shadowBlur=8;
    ctx.globalAlpha=0.80+Math.min(1,bloodPulse)*0.18;
    ctx.fillStyle=C.eye; ctx.beginPath(); ctx.arc(hcBX+3,hcBY+1,2,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle=C.hDk; ctx.beginPath(); ctx.arc(hcBX,hcBY,11,Math.PI*1.0,0,false); ctx.fill();
    ctx.fillStyle=C.hMid; ctx.beginPath(); ctx.arc(hcBX,hcBY,9,Math.PI*1.1,Math.PI*1.9,false); ctx.fill();
    if (sel) _drawSelectRing(ctx, cx, by);
}

// ── Beastcaller (Water) ───────────────────────────────────────────────────────
function drawBeastcaller(ctx, cx, by, sel, anim) {
    const C = {
        lDk:'#2a3c28', lMid:'#3a5036', lLit:'#507048',
        water:'#2878c8', waterLt:'#60b8e8',
        scale:'#1e4060', scaleLt:'#2a6090',
        sash:'#1e4868', sashLt:'#2a6898',
        stWd:'#3a2808', stLt:'#5a4018',
        eye:'#2888d8', skin:'#b8966e',
        hDk:'#182810', hMid:'#243c1a', hair:'#1c1808',
    };
    const t = anim?.t ?? 0;
    let dY=0, staffRaise=0, waterPulse=0;
    if (anim?.type === 'beastcaller_spell') {
        if (t < 0.30)      { staffRaise=t/0.30; dY=staffRaise*2; }
        else if (t < 0.60) { staffRaise=1; waterPulse=(t-0.30)/0.30; dY=2+waterPulse*2; }
        else if (t < 0.72) { const p=(t-0.60)/0.12; staffRaise=1; waterPulse=1+p*2; dY=4-p*4; }
        else               { const p=(t-0.72)/0.28; staffRaise=1-p*0.4; waterPulse=0; }
    }
    drawShadow(ctx, cx, by);
    const shY=by-38-dY*0.65;
    // Boots
    ctx.fillStyle=C.lDk; ctx.fillRect(cx-9,by-5,7,5); ctx.fillRect(cx+2,by-4,7,4);
    ctx.fillStyle=C.lMid; ctx.fillRect(cx-9,by-8,7,3); ctx.fillRect(cx+2,by-6,7,2);
    // Leather leggings
    ctx.fillStyle=C.lDk; ctx.fillRect(cx-8,by-24,7,16); ctx.fillRect(cx+1,by-22,7,15);
    // Scale-mail strips on legs
    ctx.fillStyle=C.scale; ctx.fillRect(cx-7,by-20,5,3); ctx.fillRect(cx+2,by-18,5,3);
    ctx.fillStyle=C.scaleLt; ctx.fillRect(cx-6,by-20,2,2); ctx.fillRect(cx+3,by-18,2,2);
    // Leather torso + scale chest
    ctx.fillStyle=C.lDk;
    ctx.beginPath(); ctx.moveTo(cx-11,by-24); ctx.lineTo(cx+11,by-24); ctx.lineTo(cx+9,by-38); ctx.lineTo(cx-10,by-38); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.scale;
    ctx.beginPath(); ctx.moveTo(cx-8,by-26); ctx.lineTo(cx+8,by-26); ctx.lineTo(cx+6,by-36); ctx.lineTo(cx-7,by-36); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.scaleLt;
    ctx.beginPath(); ctx.moveTo(cx-4,by-27); ctx.lineTo(cx+5,by-27); ctx.lineTo(cx+3,by-35); ctx.lineTo(cx-3,by-35); ctx.closePath(); ctx.fill();
    // Water rune on chest
    ctx.save(); ctx.globalAlpha=0.22+Math.min(1,waterPulse)*0.32; ctx.shadowColor=C.water; ctx.shadowBlur=8;
    ctx.strokeStyle=C.water; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(cx-5,by-31); ctx.quadraticCurveTo(cx-2,by-34,cx+1,by-31); ctx.quadraticCurveTo(cx+4,by-28,cx+6,by-31); ctx.stroke();
    ctx.restore();
    ctx.fillStyle=C.sash; ctx.fillRect(cx-10,by-26,21,3);
    ctx.fillStyle=C.sashLt; ctx.fillRect(cx-10,by-27,21,2);
    const upShY=shY-14;
    ctx.fillStyle=C.lDk;
    ctx.beginPath(); ctx.moveTo(cx-10,by-38); ctx.lineTo(cx+9,by-38); ctx.lineTo(cx+7,upShY); ctx.lineTo(cx-8,upShY); ctx.closePath(); ctx.fill();
    const fAX=cx+9, fAY=upShY+2;
    const fAngW=-Math.PI*0.28-(waterPulse>0?0.22*Math.min(1,waterPulse):0);
    ctx.fillStyle=C.lDk;
    ctx.beginPath(); ctx.moveTo(fAX,fAY); ctx.lineTo(fAX+10*Math.cos(fAngW),fAY+10*Math.sin(fAngW)); ctx.lineTo(fAX+15*Math.cos(fAngW-0.22),fAY+15*Math.sin(fAngW-0.22)); ctx.lineTo(fAX+11,fAY+13); ctx.closePath(); ctx.fill();
    ctx.fillStyle=C.skin;
    const fHWX=fAX+Math.cos(fAngW-0.12)*16, fHWY=fAY+Math.sin(fAngW-0.12)*16;
    ctx.beginPath(); ctx.arc(fHWX,fHWY,4,0,Math.PI*2); ctx.fill();
    if (waterPulse>0) {
        ctx.save(); ctx.shadowColor=C.water; ctx.shadowBlur=14;
        ctx.globalAlpha=Math.min(1,waterPulse)*0.50; ctx.fillStyle=C.water;
        ctx.beginPath(); ctx.arc(fHWX,fHWY,4+Math.min(1,waterPulse)*7,0,Math.PI*2); ctx.fill();
        if (waterPulse>1) { ctx.globalAlpha=(waterPulse-1)*0.85; ctx.fillStyle=C.waterLt; ctx.beginPath(); ctx.arc(fHWX,fHWY,14,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
    }
    const stAncWX=cx-9, stAncWY=upShY+2;
    const stA0W=-Math.PI*0.50, stA1W=-Math.PI*0.72;
    const stAngW=stA0W+(stA1W-stA0W)*staffRaise;
    const stLenW=41;
    const stTWX=stAncWX+Math.cos(stAngW)*stLenW, stTWY=stAncWY+Math.sin(stAngW)*stLenW;
    ctx.strokeStyle=C.stWd; ctx.lineWidth=4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(stAncWX,stAncWY); ctx.lineTo(stTWX,stTWY); ctx.stroke();
    ctx.strokeStyle=C.stLt; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(stAncWX,stAncWY); ctx.lineTo(stTWX,stTWY); ctx.stroke();
    // Wave tips on staff
    ctx.save(); ctx.shadowColor=C.water; ctx.shadowBlur=10+Math.min(1,waterPulse)*16;
    ctx.strokeStyle=C.water; ctx.lineWidth=2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(stTWX,stTWY); ctx.quadraticCurveTo(stTWX-5,stTWY-6,stTWX-2,stTWY-11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(stTWX,stTWY); ctx.quadraticCurveTo(stTWX+5,stTWY-6,stTWX+2,stTWY-11); ctx.stroke();
    ctx.fillStyle=C.waterLt; ctx.beginPath(); ctx.arc(stTWX,stTWY,4+Math.min(1,waterPulse)*3,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle=C.lDk;
    ctx.beginPath(); ctx.moveTo(stAncWX,stAncWY); ctx.lineTo(stAncWX-7,stAncWY+7); ctx.lineTo(stAncWX-5,stAncWY+13); ctx.lineTo(stAncWX,stAncWY+8); ctx.closePath(); ctx.fill();
    const hcWX=cx, hcWY=upShY-10-dY;
    ctx.fillStyle=C.hDk; ctx.beginPath(); ctx.arc(hcWX,hcWY,11,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin; ctx.beginPath(); ctx.arc(hcWX+1,hcWY+1,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.skin; ctx.fillRect(hcWX-3,hcWY+6,6,4);
    ctx.fillStyle=C.hair;
    ctx.beginPath(); ctx.arc(hcWX,hcWY,10,Math.PI*1.2,Math.PI*2.0); ctx.fill();
    ctx.beginPath(); ctx.arc(hcWX,hcWY,10,Math.PI*2.5,Math.PI*3.0); ctx.fill();
    ctx.save(); ctx.shadowColor='rgba(30,140,220,0.45)'; ctx.shadowBlur=7;
    ctx.globalAlpha=0.70+Math.min(1,waterPulse)*0.25;
    ctx.fillStyle=C.eye; ctx.beginPath(); ctx.arc(hcWX+4,hcWY,2,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle=C.hDk; ctx.beginPath(); ctx.arc(hcWX,hcWY,11,Math.PI*1.0,0,false); ctx.fill();
    ctx.fillStyle=C.hMid; ctx.beginPath(); ctx.arc(hcWX,hcWY,9,Math.PI*1.1,Math.PI*1.9,false); ctx.fill();
    if (sel) _drawSelectRing(ctx, cx, by);
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

    // Compute body animation for this unit (null = idle)
    let anim = null;
    if (UNIT_ANIM.active && UNIT_ANIM.unitId === unit.id) {
        const at = Math.min(1, (performance.now() - UNIT_ANIM.start) / UNIT_ANIM.dur);
        if (at < 1) {
            anim = { t: at, type: UNIT_ANIM.type };
        } else {
            UNIT_ANIM.active = false;
        }
    }

    switch (unit.spriteType || unit.type) {
        case 'warrior':       drawWarrior      (ctx, cx, by, sel, anim); break;
        case 'dark_templar':  drawDarkTemplar  (ctx, cx, by, sel, anim); break;
        case 'wizard':        drawWizard       (ctx, cx, by, sel, anim); break;
        case 'rogue':         drawRogue        (ctx, cx, by, sel, anim); break;
        case 'cleric':        drawCleric       (ctx, cx, by, sel, anim); break;
        case 'priest':        drawPriest       (ctx, cx, by, sel, anim); break;
        case 'necromancer':   drawNecromancer  (ctx, cx, by, sel, anim); break;
        case 'witch':         drawWitch        (ctx, cx, by, sel, anim); break;
        case 'ranger':        drawRanger       (ctx, cx, by, sel, anim); break;
        case 'sorcerer':      drawSorcerer     (ctx, cx, by, sel, anim); break;
        case 'warlock':       drawWarlock      (ctx, cx, by, sel, anim); break;
        case 'aquorist':      drawAquorist     (ctx, cx, by, sel, anim); break;
        case 'stormcaller':   drawStormcaller  (ctx, cx, by, sel, anim); break;
        case 'lifewhisperer': drawLifewhisperer(ctx, cx, by, sel, anim); break;
        case 'shaman':        drawShaman       (ctx, cx, by, sel, anim); break;
        case 'bloodsinger':   drawBloodsinger  (ctx, cx, by, sel, anim); break;
        case 'beastcaller':   drawBeastcaller  (ctx, cx, by, sel, anim); break;
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
    const losResult = checkLOS(attacker, { col: targetCol, row: targetRow });
    const los = losResult.los;

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

    // 1.2. Warm foreground lift — sunlit boost on the near ground.
    // Skipped in night mode (no sun to lift anything).
    if (LIGHTING.mode !== 'night') {
        const perspLift = ctx.createLinearGradient(0, 0, 0, H);
        perspLift.addColorStop(0.00, 'rgba(255, 232, 180, 0.00)');
        perspLift.addColorStop(0.65, 'rgba(255, 232, 180, 0.00)');
        perspLift.addColorStop(0.85, 'rgba(255, 232, 180, 0.08)');
        perspLift.addColorStop(1.00, 'rgba(255, 232, 180, 0.15)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = perspLift;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

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

    // 6. Atmospheric pass — warm sun glow + cool shadow grade + vignette
    drawAtmosphere(ctx, W, H);
}

// Draws the animated bonfire flames on top of the unit-canvas in night mode.
// Called from every tick loop that clears the unit layer, so the fire never
// vanishes during projectile / dice / damage animations.
function drawNightBonfireFlames(ctx) {
    if (LIGHTING.mode !== 'night') return;
    const bonfire = OBSTACLES.find(o => o.type === 'bonfire');
    if (!bonfire) return;
    const [bc, br] = bonfire.hexes[0];
    const { sx, sy } = hexScreenCenter(bc, br);
    drawBonfireFlames(ctx, sx, sy, S / 28, performance.now());
}

function renderUnits() {
    const cv  = document.getElementById('unit-canvas');
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);

    const sorted = [...STATE.units].sort((a, b) =>
        hexDepth(a.col, a.row) - hexDepth(b.col, b.row)
    );
    for (const u of sorted) drawUnit(ctx, u);

    drawNightBonfireFlames(ctx);
}

// Continuous flame animation for night mode. Self-terminates when mode flips.
let _flameTicking = false;
function startFlameTick() {
    if (_flameTicking) return;
    _flameTicking = true;
    const loop = () => {
        if (LIGHTING.mode !== 'night') { _flameTicking = false; return; }
        renderUnits();
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
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
                case 'dark_templar':  drawDarkTemplar  (pctx, W/2, H - 6, false); break;
                case 'wizard':        drawWizard       (pctx, W/2, H - 6, false); break;
                case 'rogue':         drawRogue        (pctx, W/2, H - 6, false); break;
                case 'cleric':        drawCleric       (pctx, W/2, H - 6, false); break;
                case 'priest':        drawPriest       (pctx, W/2, H - 6, false); break;
                case 'necromancer':   drawNecromancer  (pctx, W/2, H - 6, false); break;
                case 'witch':         drawWitch        (pctx, W/2, H - 6, false); break;
                case 'ranger':        drawRanger       (pctx, W/2, H - 6, false); break;
                case 'sorcerer':      drawSorcerer     (pctx, W/2, H - 6, false); break;
                case 'warlock':       drawWarlock      (pctx, W/2, H - 6, false); break;
                case 'aquorist':      drawAquorist     (pctx, W/2, H - 6, false); break;
                case 'stormcaller':   drawStormcaller  (pctx, W/2, H - 6, false); break;
                case 'lifewhisperer': drawLifewhisperer(pctx, W/2, H - 6, false); break;
                case 'shaman':        drawShaman       (pctx, W/2, H - 6, false); break;
                case 'bloodsinger':   drawBloodsinger  (pctx, W/2, H - 6, false); break;
                case 'beastcaller':   drawBeastcaller  (pctx, W/2, H - 6, false); break;
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

        cv.addEventListener('click', () => openCharSheet(u));

        panel.appendChild(slot);
    }
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function showUnitTooltip(u, e) {
    const tip = document.getElementById('tooltip');
    const cd  = u._charData;
    const atkObjs = getUnitAttacks(u);

    let html = `<div style="font-size:1rem;color:#c9a84c;margin-bottom:4px">${u.name}</div>`;

    if (cd) {
        const group = CLASS_GROUP_MAP[cd.cls] || '';
        const cls   = prettyId(cd.cls);
        const race  = prettyId(cd.race);
        if (cls || race) html += `<div style="font-size:0.88rem;color:#aac880;margin-bottom:4px">${cls}${cls && race ? ' · ' : ''}${race}</div>`;
    } else {
        const sp = u.spriteType || u.type;
        html += `<div style="font-size:0.88rem;color:#aac880;margin-bottom:4px">${sp.charAt(0).toUpperCase() + sp.slice(1)} (placeholder)</div>`;
    }

    const s = UNIT_STATS[u.type] || {};
    const maxHp = u.maxHp || s.maxHp || '?';
    const spd   = s.speed   || '?';
    const dg    = u.dodge != null ? u.dodge : (s.dodge ?? '?');
    html += `<div style="font-size:0.86rem;color:rgba(237,224,196,0.72);margin-bottom:4px">` +
            `HP: ${maxHp} &nbsp;·&nbsp; Spd: ${spd} &nbsp;·&nbsp; Dodge: ${dg}%</div>`;

    if (atkObjs.length) {
        const ICON = { melee:'⚔', ranged:'🏹', spell:'✨' };
        html += `<div style="font-size:0.84rem;margin-top:2px">` +
            atkObjs.map(a => {
                const icon = ICON[a.type] || '⚔';
                const dtColor = DAMAGE_TYPE_COLOR[a.damage_type] || 'rgba(237,224,196,0.55)';
                const dt = a.damage_type ? ` · <span style="color:${dtColor}">${a.damage_type}</span>` : '';
                const eff = a.effect ? `<br><span style="color:rgba(237,224,196,0.55);padding-left:1.1em">${a.effect}</span>` : '';
                return `${icon} <span style="color:rgba(237,224,196,0.85)">${a.name}</span>${dt}${eff}`;
            }).join('<br>') + `</div>`;
    }

    if (u.team === 'heroes') {
        html += `<div style="font-size:0.80rem;color:rgba(201,168,76,0.55);margin-top:5px">Click for full sheet</div>`;
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

function showAttackTooltip(atk, e) {
    const tip = document.getElementById('tooltip');
    const icon = { melee:'⚔', ranged:'🏹', spell:'✨' }[atk.type] || '⚔';
    const dtColor = DAMAGE_TYPE_COLOR[atk.damage_type] || 'rgba(237,224,196,0.55)';
    const avg = Math.round(atk.damageDice[0] * (atk.damageDice[1] + 1) / 2 + atk.damageMod);

    let html = `<div style="font-size:1rem;color:#c9a84c;margin-bottom:4px">${icon} ${atk.name}</div>`;
    if (atk.damage_type) {
        html += `<div style="font-size:0.90rem;margin-bottom:3px">` +
                `<span style="color:${dtColor}">${atk.damage_type}</span> damage</div>`;
    }
    html += `<div style="font-size:0.86rem;color:rgba(237,224,196,0.60);margin-bottom:3px">` +
            `${atk.damageDice[0]}d${atk.damageDice[1]}+${atk.damageMod} &nbsp;·&nbsp; avg ${avg} &nbsp;·&nbsp; range ${atk.range}</div>`;
    if (atk.effect) {
        html += `<div style="font-size:0.84rem;color:rgba(237,224,196,0.55)">${atk.effect}</div>`;
    }

    tip.innerHTML = html;
    tip.classList.add('visible');
    repositionTooltip(e);
}

// ─── Character sheet overlay ──────────────────────────────────────────────────

let _classesData = null;
function loadClassesData() {
    if (_classesData) return Promise.resolve(_classesData);
    return fetch('data/heroes/classes.json')
        .then(r => r.json())
        .then(d => { _classesData = d; return d; })
        .catch(() => null);
}

function buildPortraitCanvas(u) {
    const W = 90, H = 120;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    cv.style.cssText = 'border-radius:4px;border:2px solid rgba(201,168,76,0.5);display:block;position:static;top:auto;left:auto;';
    const pctx = cv.getContext('2d');
    const bg = pctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#1c2e10'); bg.addColorStop(1,'#0e1808');
    pctx.fillStyle = bg; pctx.fillRect(0,0,W,H);
    if (u.portrait) {
        const img = new Image();
        img.onload = () => { pctx.fillStyle = bg; pctx.fillRect(0,0,W,H); drawPortraitCover(pctx, img, W, H); };
        img.src = u.portrait;
    } else {
        const drawFn = {
            warrior: drawWarrior, dark_templar: drawDarkTemplar, wizard: drawWizard,
            rogue: drawRogue, cleric: drawCleric, priest: drawPriest,
            necromancer: drawNecromancer, witch: drawWitch, ranger: drawRanger,
            sorcerer: drawSorcerer, warlock: drawWarlock, aquorist: drawAquorist,
            stormcaller: drawStormcaller, lifewhisperer: drawLifewhisperer,
            shaman: drawShaman, bloodsinger: drawBloodsinger, beastcaller: drawBeastcaller,
        }[u.spriteType || u.type];
        if (drawFn) drawFn(pctx, W/2, H - 8, false);
    }
    return cv;
}

function openCharSheet(u) {
    hideTooltip();
    const overlay = document.getElementById('cs-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';

    const content = document.getElementById('cs-content');
    content.innerHTML = '<div style="color:rgba(237,224,196,0.45);font-size:0.9rem;padding:1rem 0;">Loading…</div>';

    loadClassesData().then(classesJson => {
        const cd = u._charData;
        const s  = UNIT_STATS[u.type] || {};
        const maxHp = u.maxHp || s.maxHp || '?';
        const spd   = u.speed  != null ? u.speed  : (s.speed  ?? '?');
        const dg    = u.dodge  != null ? u.dodge  : (s.dodge  ?? '?');

        // Class trait from loaded JSON — use cd.cls for real chars, u.type for placeholders
        let classTrait = null;
        if (classesJson) {
            const clsId = cd?.cls || u.spriteType || u.type;
            const clsEntry = (classesJson.classes || []).find(c => c.id === clsId);
            if (clsEntry?.special_class_trait) classTrait = clsEntry.special_class_trait;
        }

        // Identity strings
        const isMonster = u.team === 'enemies';
        let identText, levelText;
        if (cd) {
            const cls   = prettyId(cd.cls);
            const race  = prettyId(cd.race);
            const group = CLASS_GROUP_MAP[cd.cls] || '';
            identText = [cls, race].filter(Boolean).join(' · ') + (group ? `  (${group})` : '');
            levelText = `Level ${cd.level || 1}`;
        } else if (isMonster) {
            identText = prettyId(u.type) + ' — Enemy';
            levelText = '';
        } else {
            const sp = u.spriteType || u.type;
            identText = prettyId(sp) + ' — Placeholder';
            levelText = 'Level 1';
        }

        // Build HTML
        let html = '';

        // ── Top: portrait + header ──
        html += '<div class="cs-top">';
        html += '<div class="cs-portrait-wrap" id="cs-portrait-slot"></div>';
        html += '<div class="cs-header">';
        html += `<div class="cs-name">${escHtml(u.name || 'Unknown')}</div>`;
        html += `<div class="cs-identity">${escHtml(identText)}</div>`;
        html += `<div class="cs-level">${levelText}</div>`;
        html += '<div class="cs-stats">';
        const hpDisplay = (u.hp != null && u.hp !== maxHp) ? `${u.hp} / ${maxHp}` : String(maxHp);
        const hpColor   = (u.hp != null && u.hp < maxHp * 0.3) ? '#e06060' : (u.hp != null && u.hp < maxHp * 0.6) ? 'var(--accent-gold)' : '#80d870';
        html += `<div class="cs-stat"><span class="cs-stat-label">HP</span><span class="cs-stat-value" style="color:${hpColor}">${hpDisplay}</span></div>`;
        html += `<div class="cs-stat"><span class="cs-stat-label">Speed</span><span class="cs-stat-value">${spd}</span></div>`;
        html += `<div class="cs-stat"><span class="cs-stat-label">Dodge</span><span class="cs-stat-value">${dg}%</span></div>`;
        if (cd?.age) html += `<div class="cs-stat"><span class="cs-stat-label">Age</span><span class="cs-stat-value">${cd.age}</span></div>`;
        html += '</div>'; // cs-stats
        if (cd?.morality != null || u.morality != null) {
            const mor = u.morality ?? cd?.morality ?? 50;
            const zone = mor >= 66 ? 'Conviction' : mor >= 35 ? 'Neutral' : 'Despair';
            const zoneColor = mor >= 66 ? '#d8c020' : mor >= 35 ? 'rgba(237,224,196,0.65)' : '#c84040';
            html += `<div class="cs-morality-wrap">`;
            html += `<div style="font-size:0.64rem;letter-spacing:0.08em;text-transform:uppercase;color:rgba(237,224,196,0.45);margin-bottom:0.15rem">Morality — <span style="color:${zoneColor}">${zone} (${mor}%)</span></div>`;
            html += `<div class="cs-morality-track">`;
            html += `<div class="cs-morality-bp" style="left:35%"></div>`;
            html += `<div class="cs-morality-bp" style="left:65%"></div>`;
            html += `<div class="cs-morality-thumb" style="left:${mor}%"></div>`;
            html += `</div>`;
            html += `<div class="cs-morality-labels"><span class="mz-despair">Despair</span><span class="mz-neutral mz-center">Neutral</span><span class="mz-conviction">Conviction</span></div>`;
            html += `</div>`;
        }
        html += '</div>'; // cs-header
        html += '</div>'; // cs-top

        // ── Class Trait (heroes/characters only, not monsters) ──
        if (classTrait && !isMonster) {
            const isAura = (classTrait.type || '').includes('aura');
            const isPassive = !isAura && (classTrait.type || '').includes('passive');
            const boxClass = isAura ? 'cs-trait-box cs-trait-aura' : 'cs-trait-box';
            let badge = '';
            if (isAura)    badge = '<span class="cs-aura-badge">Active Aura</span>';
            else if (isPassive) badge = '<span class="cs-passive-badge">Passive</span>';
            html += '<div class="cs-section">';
            html += '<div class="cs-section-title">Class Trait</div>';
            html += `<div class="${boxClass}">`;
            html += `<div class="cs-trait-header"><span class="cs-trait-name">${escHtml(classTrait.name)}</span>${badge}</div>`;
            html += `<div class="cs-trait-desc">${escHtml(classTrait.description)}</div>`;
            html += '</div></div>';
        }

        // ── Aptitudes (heroes only) ──
        const APT_LABELS = {
            physiology: 'Physio', cognition: 'Cogni', discipline: 'Discip',
            conviction: 'Convict', martial_experience: 'Martial', eloquence: 'Eloqu',
            intuition: 'Intuit', perception: 'Percep',
        };
        if (!isMonster && cd?.aptitudes && Object.keys(cd.aptitudes).length) {
            html += '<div class="cs-section">';
            html += '<div class="cs-section-title">Aptitudes</div>';
            html += '<div class="cs-apt-grid">';
            for (const [key, val] of Object.entries(cd.aptitudes)) {
                const label = APT_LABELS[key] || prettyId(key).slice(0,7);
                html += `<div class="cs-apt-item"><span class="cs-apt-label">${label}</span><span class="cs-apt-val">${val}</span></div>`;
            }
            html += '</div></div>';
        }

        // ── Skills (heroes only) ──
        if (!isMonster) {
            html += '<div class="cs-section">';
            html += '<div class="cs-section-title">Skills</div>';
            html += '<ul class="cs-list">';
            const skills = cd?.skills || [];
            if (skills.length) {
                skills.forEach(sk => { html += `<li>${escHtml(prettyId(sk))}</li>`; });
            } else {
                html += '<li>None</li>';
            }
            html += '</ul></div>';
        }

        // ── Attacks & Spells ──
        const atkKeys = u.attackKeys || [];
        const defaultAtks = {
            warrior:['warrior_melee'], wizard:['wizard_spell'], rogue:['rogue_bow','rogue_knives'],
            cleric:['cleric_smite','cleric_spell'], priest:['priest_staff','priest_spell'],
            necromancer:['necromancer_spell'], witch:['witch_spell'],
            ranger:['ranger_bow','ranger_blade'], sorcerer:['sorcerer_spell'],
            warlock:['warlock_blast'], druid:['druid_spell'],
            goblin:['goblin_melee'], goblin_archer:['goblin_arc_bow','goblin_arc_claw'],
        };
        const keys = atkKeys.length ? atkKeys : (defaultAtks[u.spriteType || u.type] || []);
        const ATK_TYPE_ICON = { melee:'⚔', ranged:'🏹', spell:'✨' };
        const atkItems = keys.map(k => ATTACKS[k]).filter(Boolean);
        if (atkItems.length) {
            html += '<div class="cs-section">';
            html += '<div class="cs-section-title">Attacks &amp; Spells</div>';
            html += '<ul class="cs-atk-list">';
            atkItems.forEach(atk => {
                const icon  = ATK_TYPE_ICON[atk.type] || '⚔';
                const avg   = Math.round(atk.damageDice[0] * (atk.damageDice[1] + 1) / 2 + atk.damageMod);
                const dtColor = DAMAGE_TYPE_COLOR[atk.damage_type] || 'rgba(237,224,196,0.55)';
                const dtPart  = atk.damage_type ? ` · <span style="color:${dtColor}">${escHtml(atk.damage_type)}</span>` : '';
                const eff     = atk.effect ? `<br><span style="color:rgba(200,230,160,0.60);font-size:0.75em;font-style:italic">${escHtml(atk.effect)}</span>` : '';
                html += `<li>${icon} <strong>${escHtml(atk.name)}</strong> <span style="color:rgba(237,224,196,0.55);font-size:0.82em">${atk.damageDice[0]}d${atk.damageDice[1]}+${atk.damageMod} · avg ${avg} · range ${atk.range}${dtPart}</span>${eff}</li>`;
            });
            html += '</ul></div>';
        }

        // ── Active Effects (blessings, curses, aura projections) ──
        const activeEffects = u.activeEffects || [];
        if (activeEffects.length) {
            html += '<div class="cs-section">';
            html += '<div class="cs-section-title">Active Effects</div>';
            html += '<ul class="cs-atk-list">';
            activeEffects.forEach(fx => {
                const isDebuff = fx.debuff || fx.type === 'curse' || fx.type === 'aura_debuff';
                const col = isDebuff ? '#e08060' : '#80d870';
                const src = fx.source ? ` <span style="color:rgba(237,224,196,0.40);font-size:0.78em">from ${escHtml(fx.source)}</span>` : '';
                const dur = fx.duration != null ? ` · ${fx.duration} turn${fx.duration !== 1 ? 's' : ''}` : ' · permanent';
                html += `<li style="border-color:${isDebuff ? 'rgba(220,80,40,0.35)' : 'rgba(80,200,80,0.28)'}"><span style="color:${col}">${escHtml(fx.name)}</span>${src} <span style="color:rgba(237,224,196,0.45);font-size:0.80em">${dur}</span>`;
                if (fx.description) html += `<br><span style="color:rgba(237,224,196,0.55);font-size:0.76em;font-style:italic">${escHtml(fx.description)}</span>`;
                html += '</li>';
            });
            html += '</ul></div>';
        }

        // ── Footer: background, personality, birthSign ──
        const footerParts = [];
        if (cd?.background)   footerParts.push(`Background: ${prettyId(cd.background)}`);
        if (cd?.personality)  footerParts.push(`Personality: ${prettyId(cd.personality)}`);
        if (cd?.birthSign)    footerParts.push(`Sign: ${prettyId(cd.birthSign)}`);
        if (footerParts.length) {
            html += `<div class="cs-footer-row">${footerParts.map(p => `<span>${escHtml(p)}</span>`).join('')}</div>`;
        }

        content.innerHTML = html;

        // Attach portrait canvas (can't put canvas in innerHTML)
        const slot = document.getElementById('cs-portrait-slot');
        if (slot) slot.appendChild(buildPortraitCanvas(u));
    });
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
        const hex = getHexAtPixel(e.clientX - r.left, e.clientY - r.top);
        STATE.hovered = hex;
        redrawOverlay();
        if (hex) {
            const [c, row] = hex;
            const unit = STATE.units.find(u => u.col === c && u.row === row && u.hp > 0);
            if (unit) showUnitTooltip(unit, e);
            else hideTooltip();
        } else {
            hideTooltip();
        }
    });

    uc.addEventListener('mouseleave', () => {
        STATE.hovered = null; redrawOverlay(); hideTooltip();
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
    if (LIGHTING.mode === 'night') startFlameTick();
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

    const holyBtn = document.getElementById('btn-team-holy');
    if (holyBtn) {
        holyBtn.addEventListener('click', () => {
            UNIT_DEFS = [...TEAM_HOLY_DEFS, ...ENEMY_DEFS];
            hideTeamSelectOverlay();
            startBattle();
        });
    }

    const darkBtn = document.getElementById('btn-team-dark');
    if (darkBtn) {
        darkBtn.addEventListener('click', () => {
            UNIT_DEFS = [...TEAM_DARK_DEFS, ...ENEMY_DEFS];
            hideTeamSelectOverlay();
            startBattle();
        });
    }

    const natureBtn = document.getElementById('btn-team-nature');
    if (natureBtn) {
        natureBtn.addEventListener('click', () => {
            UNIT_DEFS = [...TEAM_NATURE_DEFS, ...ENEMY_DEFS];
            hideTeamSelectOverlay();
            startBattle();
        });
    }

    const stormBtn = document.getElementById('btn-team-storm');
    if (stormBtn) {
        stormBtn.addEventListener('click', () => {
            UNIT_DEFS = [...TEAM_STORM_DEFS, ...ENEMY_DEFS];
            hideTeamSelectOverlay();
            startBattle();
        });
    }

    const newClassesBtn = document.getElementById('btn-team-new-classes');
    if (newClassesBtn) {
        newClassesBtn.addEventListener('click', () => {
            UNIT_DEFS = [makeDarkTemplarDef(), TEAM_NEW_CLASSES_DEFS[1], TEAM_NEW_CLASSES_DEFS[2], ...ENEMY_DEFS];
            hideTeamSelectOverlay();
            startBattle();
        });
    }

    // Wire up Change Party button in header
    const changeBtn = document.getElementById('btn-change-party');
    if (changeBtn) {
        changeBtn.addEventListener('click', () => showTeamSelectOverlay());
    }

    // Wire up day/night lighting selector in the team overlay.
    // Mode is latched on each click but only applied when a party is chosen,
    // so selection lives in the overlay rather than the header.
    const dayBtn   = document.getElementById('btn-lighting-day');
    const nightBtn = document.getElementById('btn-lighting-night');
    function setLightingSelection(mode) {
        LIGHTING.mode = mode;
        if (dayBtn)   dayBtn  .classList.toggle('active', mode === 'day');
        if (nightBtn) nightBtn.classList.toggle('active', mode === 'night');
    }
    if (dayBtn)   dayBtn  .addEventListener('click', () => setLightingSelection('day'));
    if (nightBtn) nightBtn.addEventListener('click', () => setLightingSelection('night'));
    setLightingSelection(LIGHTING.mode);

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
    cleric        : { maxHp: 65,  speed: 3, dodge: 18 },
    necromancer   : { maxHp: 42,  speed: 3, dodge: 14 },
    witch         : { maxHp: 40,  speed: 3, dodge: 16 },
    ranger        : { maxHp: 55,  speed: 4, dodge: 28 },
    sorcerer      : { maxHp: 44,  speed: 3, dodge: 16 },
    warlock       : { maxHp: 50,  speed: 3, dodge: 20 },
    aquorist      : { maxHp: 44,  speed: 3, dodge: 16 },
    stormcaller   : { maxHp: 44,  speed: 3, dodge: 16 },
    lifewhisperer : { maxHp: 48,  speed: 3, dodge: 18 },
    shaman        : { maxHp: 52,  speed: 3, dodge: 18 },
    bloodsinger   : { maxHp: 46,  speed: 3, dodge: 20 },
    dark_templar  : { maxHp: 80,  speed: 2, dodge: 16 },
    priest        : { maxHp: 52,  speed: 3, dodge: 16 },
    rascal        : { maxHp: 48,  speed: 4, dodge: 28 },
    beastcaller   : { maxHp: 55,  speed: 4, dodge: 24 },
    goblin        : { maxHp: 140, speed: 2, dodge: 10 },
    goblin_archer : { maxHp: 42,  speed: 3, dodge: 18 },
};

// ── Attack definitions ────────────────────────────────────────────────────────
const ATTACKS = {
    // Heroes
    warrior_melee      : { name:'Sword Strike',  type:'melee',  range:1,  damageDice:[2,10], damageMod:5,  hitBase:98, critMin:90, snd:'sword', damage_type:'Physical' },
    rogue_bow          : { name:'Arrow Shot',    type:'ranged', range:14, damageDice:[2,8],  damageMod:3,  hitBase:98, critMin:95, snd:'bow',   damage_type:'Physical' },
    rogue_knives       : { name:'Steel Knives',  type:'melee',  range:1,  damageDice:[2,9],  damageMod:4,  hitBase:98, critMin:92, snd:'sword', damage_type:'Physical' },
    wizard_spell       : { name:'Arcane Pulse',  type:'spell',  range:15, damageDice:[3,8],  damageMod:5,  hitBase:98, critMin:97, snd:'fire',  damage_type:'Arcane',  effect:'Stable reliable damage — no variance' },
    cleric_smite       : { name:'Holy Smite',    type:'melee',  range:1,  damageDice:[2,8],  damageMod:5,  hitBase:98, critMin:90, snd:'sword', damage_type:'Radiant' },
    cleric_spell       : { name:'Glimmer Spark', type:'spell',  range:12, damageDice:[2,8],  damageMod:4,  hitBase:98, critMin:96, snd:'fire',  damage_type:'Radiant', effect:'Minor blind — 10% accuracy reduction (1 turn)' },
    priest_staff       : { name:'Staff Blow',    type:'melee',  range:1,  damageDice:[1,8],  damageMod:2,  hitBase:98, critMin:96, snd:'sword', damage_type:'Physical' },
    priest_spell       : { name:'Luminance Pulse', type:'spell', range:10, damageDice:[1,8], damageMod:3,  hitBase:98, critMin:97, snd:'fire',  damage_type:'Radiant',  effect:'Minor holy daze — 5% accuracy reduction (1 turn)' },
    necromancer_spell  : { name:'Grave Touch',   type:'spell',  range:14, damageDice:[3,8],  damageMod:4,  hitBase:98, critMin:96, snd:'fire',  damage_type:'Shadow',  effect:'Minor heal to caster (50% of damage dealt)' },
    witch_spell        : { name:'Rot Touch',     type:'spell',  range:12, damageDice:[2,10], damageMod:4,  hitBase:98, critMin:96, snd:'fire',  damage_type:'Blight',  effect:'Disease (8 damage per turn)' },
    ranger_bow         : { name:'Precise Shot',  type:'ranged', range:16, damageDice:[2,8],  damageMod:4,  hitBase:98, critMin:94, snd:'bow',   damage_type:'Physical' },
    ranger_blade       : { name:'Short Blade',   type:'melee',  range:1,  damageDice:[2,8],  damageMod:3,  hitBase:98, critMin:92, snd:'sword', damage_type:'Physical' },
    sorcerer_spell     : { name:'Ember Flick',   type:'spell',  range:14, damageDice:[3,10], damageMod:5,  hitBase:98, critMin:96, snd:'fire',  damage_type:'Fire',    effect:'Ignite (5 damage per turn)' },
    warlock_blast      : { name:'Void Flicker',  type:'spell',  range:15, damageDice:[2,10], damageMod:5,  hitBase:98, critMin:96, snd:'fire',  damage_type:'Void',    effect:'Minor instability — 20% chance of random secondary effect' },
    druid_spell           : { name:'Sprout Bind',    type:'spell',  range:11, damageDice:[2,6],  damageMod:3,  hitBase:98, critMin:96, snd:'fire',  damage_type:'Nature',    effect:'Root target for 1 turn' },
    aquorist_spell        : { name:'Frost Lance',    type:'spell',  range:13, damageDice:[3,8],  damageMod:4,  hitBase:98, critMin:96, snd:'fire',  damage_type:'Cold',      effect:'Chill — target speed −1 for 1 turn' },
    stormcaller_spell     : { name:'Chain Bolt',     type:'spell',  range:15, damageDice:[3,8],  damageMod:4,  hitBase:98, critMin:96, snd:'fire',  damage_type:'Lightning', effect:'Stun — target skips next action (25% chance)' },
    lifewhisperer_spell   : { name:'Thorn Bind',     type:'spell',  range:11, damageDice:[2,8],  damageMod:3,  hitBase:98, critMin:96, snd:'fire',  damage_type:'Nature',    effect:'Root target for 1 turn' },
    shaman_spell          : { name:'Spirit Wail',    type:'spell',  range:12, damageDice:[2,8],  damageMod:4,  hitBase:98, critMin:96, snd:'fire',  damage_type:'Spirit',    effect:'Minor heal to nearest ally (4 HP)' },
    bloodsinger_spell     : { name:'Crimson Lash',   type:'spell',  range:13, damageDice:[3,8],  damageMod:5,  hitBase:98, critMin:94, snd:'fire',  damage_type:'Bleed',     effect:'Hemorrhage (6 damage per turn for 2 turns)' },
    beastcaller_spell     : { name:'Tide Surge',     type:'spell',  range:11, damageDice:[2,8],  damageMod:3,  hitBase:98, critMin:96, snd:'fire',  damage_type:'Water',     effect:'Knockback — pushes target 1 hex' },
    // Monsters
    goblin_melee   : { name:'Claw',         type:'melee',  range:1,  damageDice:[1,12], damageMod:4,  hitBase:95, critMin:90, snd:'claw', damage_type:'Physical' },
    goblin_arc_bow : { name:'Goblin Arrow', type:'ranged', range:10, damageDice:[1,6],  damageMod:1,  hitBase:92, critMin:93, snd:'bow',  damage_type:'Physical' },
    goblin_arc_claw: { name:'Weak Claw',    type:'melee',  range:1,  damageDice:[1,6],  damageMod:1,  hitBase:85, critMin:92, snd:'claw', damage_type:'Physical' },
};

// Returns all attacks a unit can use, ordered primary first.
function getUnitAttacks(unit) {
    // Custom characters carry their own attack key list
    if (unit.attackKeys?.length) return unit.attackKeys.map(k => ATTACKS[k]).filter(Boolean);
    switch (unit.spriteType || unit.type) {
        case 'warrior':     return [ATTACKS.warrior_melee];
        case 'rogue':       return [ATTACKS.rogue_bow, ATTACKS.rogue_knives];
        case 'wizard':      return [ATTACKS.wizard_spell];
        case 'cleric':      return [ATTACKS.cleric_smite, ATTACKS.cleric_spell];
        case 'priest':      return [ATTACKS.priest_staff, ATTACKS.priest_spell];
        case 'necromancer': return [ATTACKS.necromancer_spell];
        case 'witch':       return [ATTACKS.witch_spell];
        case 'ranger':      return [ATTACKS.ranger_bow, ATTACKS.ranger_blade];
        case 'sorcerer':    return [ATTACKS.sorcerer_spell];
        case 'warlock':       return [ATTACKS.warlock_blast];
        case 'druid':         return [ATTACKS.druid_spell];
        case 'aquorist':      return [ATTACKS.aquorist_spell];
        case 'stormcaller':   return [ATTACKS.stormcaller_spell];
        case 'lifewhisperer': return [ATTACKS.lifewhisperer_spell];
        case 'shaman':        return [ATTACKS.shaman_spell];
        case 'bloodsinger':   return [ATTACKS.bloodsinger_spell];
        case 'beastcaller':   return [ATTACKS.beastcaller_spell];
        case 'dark_templar':  return [ATTACKS.warrior_melee];
        case 'rascal':        return [ATTACKS.rogue_knives, ATTACKS.cleric_spell];
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
    if (dist <= 1) return { los: 'clear', obstacleCount: 0, hasUnit: false };

    // Use fine-grained line-of-sight: sample every 0.1 hex distance
    const steps = Math.max(dist * 10, 20);
    const visited = new Set();
    let obstacleCount = 0;
    let hasUnit = false;

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

                if (isBlocked(nc, nr)) {
                    obstacleCount++;
                } else if (STATE.units.some(u => u.hp > 0 && u.id !== atk.id && u.id !== tgt.id && u.col === nc && u.row === nr)) {
                    hasUnit = true;
                }
            }
        }
    }

    let los = 'clear';
    if (obstacleCount > 0) los = 'obstacle';
    else if (hasUnit) los = 'partial';

    return { los, obstacleCount, hasUnit };
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
        drawNightBonfireFlames(ctx);
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
        if (anyActive || UNIT_ANIM.active || SWING.active || PROJ.active) _tickDice();
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
        drawNightBonfireFlames(ctx);

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
                case 'dark_templar':  drawDarkTemplar  (pctx, 30, 90, false); break;
                case 'wizard':        drawWizard       (pctx, 30, 90, false); break;
                case 'rogue':         drawRogue        (pctx, 30, 90, false); break;
                case 'cleric':        drawCleric       (pctx, 30, 90, false); break;
                case 'priest':        drawPriest       (pctx, 30, 90, false); break;
                case 'necromancer':   drawNecromancer  (pctx, 30, 90, false); break;
                case 'witch':         drawWitch        (pctx, 30, 90, false); break;
                case 'ranger':        drawRanger       (pctx, 30, 90, false); break;
                case 'sorcerer':      drawSorcerer     (pctx, 30, 90, false); break;
                case 'warlock':       drawWarlock      (pctx, 30, 90, false); break;
                case 'aquorist':      drawAquorist     (pctx, 30, 90, false); break;
                case 'stormcaller':   drawStormcaller  (pctx, 30, 90, false); break;
                case 'lifewhisperer': drawLifewhisperer(pctx, 30, 90, false); break;
                case 'shaman':        drawShaman       (pctx, 30, 90, false); break;
                case 'bloodsinger':   drawBloodsinger  (pctx, 30, 90, false); break;
                case 'beastcaller':   drawBeastcaller  (pctx, 30, 90, false); break;
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

        slot.addEventListener('click', () => openCharSheet(u));

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
        btn.addEventListener('mouseenter', e => showAttackTooltip(atk, e));
        btn.addEventListener('mousemove',  e => repositionTooltip(e));
        btn.addEventListener('mouseleave', () => hideTooltip());
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

// ── Aura processing ───────────────────────────────────────────────────────────
// Runs at the start of each round. For every living unit that has a passive_aura
// class trait, apply its effect to the appropriate targets and record it in
// target.activeEffects so the character sheet can display it in real time.
// Aura effect definitions — how each passive_aura trait mutates unit state per round.
// Keyed by trait name. Each entry is applied once per round to each target.
const AURA_EFFECTS = {
    'Veil of Despair': (caster, target, round) => {
        // -5% morality per round for all units; extra penalty below 30% handled in display
        if (target.morality == null) target.morality = target._charData?.morality ?? 50;
        target.morality = Math.max(0, target.morality - 5);
    },
};

function processAuras() {
    if (!_classesData) return;
    const living = STATE.units.filter(u => u.hp > 0);

    // Clear aura-sourced effects each round so they don't stack in the list
    for (const u of living) {
        u.activeEffects = (u.activeEffects || []).filter(fx => fx._source !== 'aura');
    }

    for (const caster of living) {
        const clsId = caster._charData?.cls || caster.spriteType || caster.type;
        const clsEntry = (_classesData.classes || []).find(c => c.id === clsId);
        const trait = clsEntry?.special_class_trait;
        if (!trait || !(trait.type || '').includes('aura')) continue;

        const effectFn = AURA_EFFECTS[trait.name];
        const targets = living;

        for (const target of targets) {
            // Apply mechanical effect (mutates morality / stats on the unit)
            if (effectFn) effectFn(caster, target, COMBAT.round);

            // Record the effect for the character sheet
            target.activeEffects = target.activeEffects || [];
            const mor = target.morality ?? target._charData?.morality ?? 50;
            const penalty = mor < 30 ? ' +10% penalty on morale checks' : '';
            target.activeEffects.push({
                _source: 'aura',
                name: trait.name,
                source: caster.name,
                type: 'aura_debuff',
                debuff: true,
                duration: null,
                description: `Morality −5% per round (now ${mor}%)${penalty}`,
            });
        }

        combatLog(`☁ ${caster.name}: Veil of Despair drains morality across the battlefield.`);
    }
}

// ── New round ─────────────────────────────────────────────────────────────────
function startNewRound() {
    COMBAT.round++;
    document.getElementById('turn-counter').textContent = COMBAT.round;
    showRoundBanner(COMBAT.round);
    for (const u of STATE.units) {
        if (u.hp > 0) { u.hasActed = false; u.movedHexes = 0; }
    }
    processAuras();
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
    for (const h of list) if (checkLOS(h, unit).los === 'clear') n++;
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
            const losResult = checkLOS(unit, target);
            unit.col = origC; unit.row = origR;
            if (losResult.los === 'clear' || losResult.los === 'partial' || losResult.los === 'obstacle') {
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
        const losResult = checkLOS(attacker, target);
        los = losResult.los;
        COMBAT.obstacleCount = losResult.obstacleCount;
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
        const fh       = atk.type === 'spell' ? 68 : 30;
        const orb      = atk.type === 'spell' ? (DAMAGE_TYPE_ORB[atk.damage_type] || {}) : {};
        const projOuter = orb.outer || DAMAGE_TYPE_COLOR[atk.damage_type] || '#ff6600';
        const projCore  = orb.core  || '#ffffff';
        const projGlow  = orb.glow  || projOuter;
        startProjectile(atk.type === 'spell' ? 'fireball' : 'arrow',
            fromC.sx, fromBy - fh, toC.sx, toBy - 30, projOuter, projCore, projGlow);
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
        if (attacker.type === 'warrior' || attacker.spriteType === 'warrior') swingType = 'sword';
        else if (atk === ATTACKS.rogue_knives) swingType = 'stab';
        startSwing(swingType, fromC.sx, fromBy, ang);
    }

    // Trigger sprite body animation to match the attack
    {
        const sp = attacker.spriteType || attacker.type;
        if (atk.type === 'melee') {
            const meleeAnims = { warrior:'warrior_melee', cleric:'cleric_smite', ranger:'ranger_melee', priest:'priest_strike', dark_templar:'dark_templar_melee' };
            startUnitAnim(attacker.id, meleeAnims[sp] || 'rogue_stab', 480);
        } else if (atk.type === 'ranged') {
            startUnitAnim(attacker.id, sp === 'ranger' ? 'ranger_bow' : 'rogue_bow', 500);
        } else if (atk.type === 'spell') {
            const spellAnims = { wizard:'wizard_spell', cleric:'cleric_spell', priest:'priest_spell', necromancer:'necromancer_spell', witch:'witch_spell', sorcerer:'sorcerer_spell', warlock:'warlock_blast', aquorist:'aquorist_spell', stormcaller:'stormcaller_spell', lifewhisperer:'lifewhisperer_spell', shaman:'shaman_spell', bloodsinger:'bloodsinger_spell', beastcaller:'beastcaller_spell' };
            startUnitAnim(attacker.id, spellAnims[sp] || 'wizard_spell', 560);
        }
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
            combatLog('  (' + COMBAT.obstacleCount + ' obstacle' + (COMBAT.obstacleCount > 1 ? 's' : '') + ' in the way: −20% hit)');
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
            // Each obstacle in the path reduces damage further (cumulative)
            if (COMBAT.obstacleCount > 0) {
                for (let i = 0; i < COMBAT.obstacleCount; i++) {
                    dmg = Math.max(1, Math.round(dmg * 0.80));
                }
            }
            target.hp = Math.max(0, target.hp - dmg);
            showBloodSplatter(target.col, target.row, isCrit);

            const verb = isCrit ? 'CRITS' : 'hits';
            combatLog(attacker.name + ' ' + verb + ' ' + target.name +
                ' for ' + dmg + ' dmg (rolled ' + hitRoll + ')');
            if (COMBAT.obstacleCount > 0) {
                combatLog('  (obstacle' + (COMBAT.obstacleCount > 1 ? 's' : '') + ' in path: −' +
                    (20 * COMBAT.obstacleCount) + '% dmg)');
            }
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
    processAuras();
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
    loadClassesData().then(() => {
        processAuras();
        rollInitiative();
        combatLog('══════ Round 1 — Battle begins! ══════');
        COMBAT.turnIndex = -1;
        setTimeout(advanceTurn, 900);
    });
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
// ─────────────────────────────────────────────────────────────────────────────
// UNIT BODY ANIMATION — drives per-sprite pose during attacks
// ─────────────────────────────────────────────────────────────────────────────
const UNIT_ANIM = {
    active: false,
    unitId: null,
    type  : null,   // warrior_melee | rogue_stab | rogue_bow | wizard_spell | cleric_smite | cleric_spell | necromancer_spell | witch_spell | ranger_bow | ranger_melee | sorcerer_spell | warlock_blast
    start : 0,
    dur   : 500,
};

function startUnitAnim(unitId, type, dur) {
    UNIT_ANIM.active = true;
    UNIT_ANIM.unitId = unitId;
    UNIT_ANIM.type   = type;
    UNIT_ANIM.start  = performance.now();
    UNIT_ANIM.dur    = dur || 500;
}

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
    active   : false,
    type     : null,   // 'arrow' | 'fireball'
    color    : '#ff6600',
    coreColor: '#ffffff',
    glowColor: '#ff6600',
    fromX : 0, fromY: 0,
    toX   : 0, toY  : 0,
    start : 0,
    dur   : 460,
    // cached direction unit vector, set on start
    nx    : 0, ny   : 0,
    angle : 0,
};

function startProjectile(type, fx, fy, tx, ty, outerColor, coreColor, glowColor) {
    const dx = tx - fx, dy = ty - fy;
    const len = Math.hypot(dx, dy) || 1;
    PROJ.active    = true;
    PROJ.type      = type;
    PROJ.color     = outerColor || '#ff6600';
    PROJ.coreColor = coreColor  || '#ffffff';
    PROJ.glowColor = glowColor  || outerColor || '#ff6600';
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
    if (PROJ.type === 'fireball') _drawFireball(ctx, x, y, t, PROJ.color, PROJ.coreColor, PROJ.glowColor);
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

// ── Spell orb — two-color parameterized (core + outer + glow) ─────────────────
function _parseHex(hex) {
    const h = (hex || '#ff6600').replace('#', '');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function _lerpC(a, b, t) {
    return [Math.round(a[0]+(b[0]-a[0])*t), Math.round(a[1]+(b[1]-a[1])*t), Math.round(a[2]+(b[2]-a[2])*t)];
}
function _rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

function _drawFireball(ctx, x, y, t, outerColor, coreColor, glowColor) {
    const oc = _parseHex(outerColor);  // outer edge color
    const cc = _parseHex(coreColor  || '#ffffff');  // center color
    const gc = _parseHex(glowColor  || outerColor);  // halo/shadow color

    // Lerped stops for body gradient: center → 35% → outer → dark edge
    const bodyMid  = _lerpC(cc, oc, 0.35);
    const darkEdge = _lerpC(oc, [0,0,0], 0.55);

    const pulse = 1 + Math.sin(t * Math.PI * 9) * 0.10;
    const r     = 11 * pulse;

    // ── Ground glow ──────────────────────────────────────────────────────────
    const gx = x, gy = y + 20;
    const gw = 26 + t * 10, gh = 9 + t * 3;
    const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gw);
    gg.addColorStop(0,    _rgba(gc, 0.50));
    gg.addColorStop(0.40, _rgba(gc, 0.22));
    gg.addColorStop(0.75, _rgba(gc, 0.08));
    gg.addColorStop(1,    _rgba(gc, 0));
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.ellipse(gx, gy, gw, gh, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Ember trail ──────────────────────────────────────────────────────────
    for (let i = 5; i >= 1; i--) {
        const tr = i / 6;
        const px = x - PROJ.nx * i * 8;
        const py = y - PROJ.ny * i * 8;
        const pr = r * (1 - tr * 0.60);
        ctx.globalAlpha = (1 - tr) * 0.55;
        const pg = ctx.createRadialGradient(px, py, 0, px, py, pr);
        pg.addColorStop(0,   _rgba(bodyMid, 0.90));
        pg.addColorStop(0.4, _rgba(oc, 1));
        pg.addColorStop(1,   _rgba(oc, 0));
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        const tgg = ctx.createRadialGradient(px, py+16, 0, px, py+16, pr * 1.6);
        tgg.addColorStop(0, _rgba(gc, 0.22));
        tgg.addColorStop(1, _rgba(gc, 0));
        ctx.fillStyle = tgg;
        ctx.beginPath();
        ctx.ellipse(px, py + 16, pr * 1.6, pr * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // ── Outer glow halo ───────────────────────────────────────────────────────
    ctx.shadowColor = _rgba(gc, 1);
    ctx.shadowBlur  = 24;
    const og = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
    og.addColorStop(0,    _rgba(bodyMid, 0.65));
    og.addColorStop(0.30, _rgba(gc, 0.40));
    og.addColorStop(0.65, _rgba(gc, 0.12));
    og.addColorStop(1,    _rgba(gc, 0));
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
    ctx.fill();

    // ── Main orb body: lerp from core center to outer edge ────────────────────
    const fg = ctx.createRadialGradient(x - r * 0.28, y - r * 0.28, 0, x, y, r);
    fg.addColorStop(0,    _rgba(cc, 1));
    fg.addColorStop(0.25, _rgba(bodyMid, 0.95));
    fg.addColorStop(0.60, _rgba(oc, 1));
    fg.addColorStop(1,    _rgba(darkEdge, 0.70));
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── Core highlight ────────────────────────────────────────────────────────
    ctx.fillStyle = _rgba(cc, 0.90);
    ctx.beginPath();
    ctx.arc(x - r * 0.22, y - r * 0.22, r * 0.30, 0, Math.PI * 2);
    ctx.fill();

    // ── Wispy outer sparks ────────────────────────────────────────────────────
    for (let s = 0; s < 5; s++) {
        const sa = (s / 5) * Math.PI * 2 + t * 6;
        const sr = r * (1.0 + Math.sin(t * 14 + s) * 0.22);
        const sx = x + Math.cos(sa) * sr;
        const sy = y + Math.sin(sa) * sr * 0.75;
        ctx.fillStyle = s % 2 === 0 ? _rgba(bodyMid, 0.65) : _rgba(oc, 0.50);
        ctx.beginPath();
        ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
        ctx.fill();
    }
}

})();
