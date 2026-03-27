/* ═══════════════════════════════════════════════════════════════════════════
   character-creator.js  —  Leonoria Character Creator
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── Class mechanics ──────────────────────────────────────────────────────────
const CLASS_DATA = {
    'Barbarian':    { hitDie: 12, saves: ['Strength','Constitution'],     skillCount: 2, skills: ['Animal Handling','Athletics','Intimidation','Nature','Perception','Survival'],                                                                        startGold: '2d4×10' },
    'Bard':         { hitDie:  8, saves: ['Dexterity','Charisma'],        skillCount: 3, skills: 'any',                                                                                                                                                   startGold: '5d4×10' },
    'Cleric':       { hitDie:  8, saves: ['Wisdom','Charisma'],           skillCount: 2, skills: ['History','Insight','Medicine','Persuasion','Religion'],                                                                                                 startGold: '5d4×10' },
    'Druid':        { hitDie:  8, saves: ['Intelligence','Wisdom'],       skillCount: 2, skills: ['Arcana','Animal Handling','Insight','Medicine','Nature','Perception','Religion','Survival'],                                                             startGold: '2d4×10' },
    'Fighter':      { hitDie: 10, saves: ['Strength','Constitution'],     skillCount: 2, skills: ['Acrobatics','Animal Handling','Athletics','History','Insight','Intimidation','Perception','Survival'],                                                   startGold: '5d4×10' },
    'Monk':         { hitDie:  8, saves: ['Strength','Dexterity'],        skillCount: 2, skills: ['Acrobatics','Athletics','History','Insight','Religion','Stealth'],                                                                                      startGold: '5d4'    },
    'Paladin':      { hitDie: 10, saves: ['Wisdom','Charisma'],           skillCount: 2, skills: ['Athletics','Insight','Intimidation','Medicine','Persuasion','Religion'],                                                                                startGold: '5d4×10' },
    'Ranger':       { hitDie: 10, saves: ['Strength','Dexterity'],        skillCount: 3, skills: ['Animal Handling','Athletics','Insight','Investigation','Nature','Perception','Stealth','Survival'],                                                      startGold: '5d4×10' },
    'Rogue':        { hitDie:  8, saves: ['Dexterity','Intelligence'],    skillCount: 4, skills: ['Acrobatics','Athletics','Deception','Insight','Intimidation','Investigation','Perception','Performance','Persuasion','Sleight of Hand','Stealth'],       startGold: '4d4×10' },
    'Sorcerer':     { hitDie:  6, saves: ['Constitution','Charisma'],     skillCount: 2, skills: ['Arcana','Deception','Insight','Intimidation','Persuasion','Religion'],                                                                                  startGold: '3d4×10' },
    'Warlock':      { hitDie:  8, saves: ['Wisdom','Charisma'],           skillCount: 2, skills: ['Arcana','Deception','History','Intimidation','Investigation','Nature','Religion'],                                                                       startGold: '4d4×10' },
    'Wizard':       { hitDie:  6, saves: ['Intelligence','Wisdom'],       skillCount: 2, skills: ['Arcana','History','Insight','Investigation','Medicine','Religion'],                                                                                      startGold: '4d4×10' },
    'Pyromancer':   { hitDie:  6, saves: ['Intelligence','Constitution'], skillCount: 2, skills: 'any', startGold: '3d4×10' },
    'Cryomancer':   { hitDie:  6, saves: ['Intelligence','Constitution'], skillCount: 2, skills: 'any', startGold: '3d4×10' },
    'Battle Mage':  { hitDie:  8, saves: ['Strength','Intelligence'],     skillCount: 2, skills: 'any', startGold: '4d4×10' },
    'Shadow Knight':{ hitDie: 10, saves: ['Dexterity','Charisma'],        skillCount: 2, skills: 'any', startGold: '4d4×10' },
    'Necromancer':  { hitDie:  6, saves: ['Intelligence','Wisdom'],       skillCount: 2, skills: 'any', startGold: '3d4×10' },
    'Alchemist':    { hitDie:  8, saves: ['Intelligence','Constitution'], skillCount: 2, skills: 'any', startGold: '4d4×10' },
    'Beastmaster':  { hitDie: 10, saves: ['Strength','Wisdom'],           skillCount: 3, skills: 'any', startGold: '3d4×10' },
    'Elementalist': { hitDie:  6, saves: ['Intelligence','Wisdom'],       skillCount: 2, skills: 'any', startGold: '3d4×10' },
    'Illusionist':  { hitDie:  6, saves: ['Intelligence','Charisma'],     skillCount: 2, skills: 'any', startGold: '3d4×10' },
    'Runesmith':    { hitDie:  8, saves: ['Intelligence','Constitution'], skillCount: 2, skills: 'any', startGold: '4d4×10' },
};

const ALIGNMENTS = [
    'Lawful Good',    'Neutral Good',    'Chaotic Good',
    'Lawful Neutral', 'True Neutral',    'Chaotic Neutral',
    'Lawful Evil',    'Neutral Evil',    'Chaotic Evil',
];

const ABILITIES      = ['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma'];
const ABILITY_SHORT  = ['STR','DEX','CON','INT','WIS','CHA'];
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const PB_COST        = { 8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9 };
const PB_BUDGET      = 27;
const PROF_BONUS     = [0,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6];
const RACE_SPEED     = { 'Dwarf': 25, 'Halfling': 25, 'Gnome': 25 };
const TAB_ORDER      = ['identity', 'attributes', 'skills', 'equipment'];

// ─── Class ability score priorities (for auto-fill) ──────────────────────────
const CLASS_STAT_PRIORITY = {
    'Barbarian':    ['Strength','Constitution','Dexterity','Wisdom','Charisma','Intelligence'],
    'Bard':         ['Charisma','Dexterity','Constitution','Wisdom','Intelligence','Strength'],
    'Cleric':       ['Wisdom','Constitution','Strength','Charisma','Intelligence','Dexterity'],
    'Druid':        ['Wisdom','Constitution','Intelligence','Dexterity','Charisma','Strength'],
    'Fighter':      ['Strength','Constitution','Dexterity','Wisdom','Charisma','Intelligence'],
    'Monk':         ['Dexterity','Wisdom','Constitution','Strength','Intelligence','Charisma'],
    'Paladin':      ['Strength','Charisma','Constitution','Wisdom','Dexterity','Intelligence'],
    'Ranger':       ['Dexterity','Wisdom','Constitution','Strength','Intelligence','Charisma'],
    'Rogue':        ['Dexterity','Intelligence','Charisma','Constitution','Wisdom','Strength'],
    'Sorcerer':     ['Charisma','Constitution','Dexterity','Intelligence','Wisdom','Strength'],
    'Warlock':      ['Charisma','Constitution','Dexterity','Intelligence','Wisdom','Strength'],
    'Wizard':       ['Intelligence','Constitution','Dexterity','Wisdom','Charisma','Strength'],
    'Pyromancer':   ['Intelligence','Constitution','Dexterity','Wisdom','Charisma','Strength'],
    'Cryomancer':   ['Intelligence','Constitution','Dexterity','Wisdom','Charisma','Strength'],
    'Battle Mage':  ['Strength','Intelligence','Constitution','Dexterity','Wisdom','Charisma'],
    'Shadow Knight':['Dexterity','Charisma','Constitution','Strength','Wisdom','Intelligence'],
    'Necromancer':  ['Intelligence','Wisdom','Constitution','Dexterity','Charisma','Strength'],
    'Alchemist':    ['Intelligence','Constitution','Dexterity','Wisdom','Charisma','Strength'],
    'Beastmaster':  ['Strength','Wisdom','Constitution','Dexterity','Intelligence','Charisma'],
    'Elementalist': ['Intelligence','Wisdom','Constitution','Dexterity','Charisma','Strength'],
    'Illusionist':  ['Intelligence','Charisma','Dexterity','Constitution','Wisdom','Strength'],
    'Runesmith':    ['Intelligence','Constitution','Strength','Dexterity','Wisdom','Charisma'],
};

// ─── Default skill picks per class ───────────────────────────────────────────
const CLASS_DEFAULT_SKILLS = {
    'Barbarian':    ['Athletics','Intimidation'],
    'Bard':         ['Persuasion','Performance','Deception'],
    'Cleric':       ['Insight','Religion'],
    'Druid':        ['Nature','Perception'],
    'Fighter':      ['Athletics','Perception'],
    'Monk':         ['Acrobatics','Stealth'],
    'Paladin':      ['Persuasion','Religion'],
    'Ranger':       ['Perception','Survival','Stealth'],
    'Rogue':        ['Stealth','Deception','Investigation','Perception'],
    'Sorcerer':     ['Arcana','Persuasion'],
    'Warlock':      ['Arcana','Deception'],
    'Wizard':       ['Arcana','History'],
    'Pyromancer':   ['Arcana','Investigation'],
    'Cryomancer':   ['Arcana','Investigation'],
    'Battle Mage':  ['Arcana','Athletics'],
    'Shadow Knight':['Stealth','Deception'],
    'Necromancer':  ['Arcana','History'],
    'Alchemist':    ['Investigation','Nature'],
    'Beastmaster':  ['Animal Handling','Survival','Nature'],
    'Elementalist': ['Arcana','Nature'],
    'Illusionist':  ['Arcana','Deception'],
    'Runesmith':    ['Arcana','History'],
};

// ─── Ability descriptions (tooltip) ──────────────────────────────────────────
const ABILITY_DESC = {
    'Strength':     'Raw physical power. Governs melee attacks, carrying capacity, and feats of brute force like lifting, pushing, and breaking.',
    'Dexterity':    'Agility and reflexes. Governs ranged attacks, Armor Class (light armour), stealth, sleight of hand, and acrobatic feats.',
    'Constitution': 'Toughness and endurance. Determines your hit points and your ability to resist fatigue, poison, and physical hardship.',
    'Intelligence': 'Reasoning and memory. Governs arcane spellcasting, knowledge skills, and your ability to recall lore and solve puzzles.',
    'Wisdom':       'Awareness and intuition. Governs perception, insight, and divine spellcasting for classes like Clerics and Druids.',
    'Charisma':     'Force of personality. Governs persuasion, deception, performance, and spellcasting for Bards, Sorcerers, and Warlocks.',
};

// ─── Skill descriptions (tooltip) ────────────────────────────────────────────
const SKILL_DESC = {
    'Acrobatics':       'Tumble, flip, and balance in precarious situations. Used to stay upright and perform stunts.',
    'Animal Handling':  'Calm skittish animals, control mounts in chaos, and intuit the intentions of wild creatures.',
    'Arcana':           'Recall lore about spells, magical items, eldritch symbols, and the denizens of the planes.',
    'Athletics':        'Climb sheer surfaces, swim against currents, jump great distances, and grapple foes.',
    'Deception':        'Lie convincingly, disguise your true intentions, or give false impressions through speech and action.',
    'History':          'Recall historical events, legendary figures, ancient kingdoms, and the outcomes of past wars.',
    'Insight':          'Determine the true intentions of another creature — detect lies, sense emotions, and read motives.',
    'Intimidation':     'Influence others through menace, displays of force, or hostile threats.',
    'Investigation':    'Search for hidden clues, deduce from evidence, and figure out how magical devices work.',
    'Medicine':         'Stabilize a dying creature, diagnose illness, and recognize the cause of wounds.',
    'Nature':           'Know the lore of natural terrain, plants, animals, weather patterns, and the cycles of the wild.',
    'Perception':       'Notice details, spot hidden enemies, and detect things others might miss using your senses.',
    'Performance':      'Entertain an audience through music, acting, dance, storytelling, or other artistic expression.',
    'Persuasion':       'Influence others through tact, charm, and reasoned diplomacy — without force or deception.',
    'Religion':         'Know the lore of gods, religious rites, holy symbols, prayers, and the nature of the divine.',
    'Sleight of Hand':  'Pick pockets, plant objects unseen, palm small items, and perform feats of manual dexterity.',
    'Stealth':          'Move silently, hide in shadows, and avoid detection — essential for scouts and ambush predators.',
    'Survival':         'Track prey, navigate wild terrain, find food and shelter, and predict natural hazards.',
    'Alchemy':          'Brew potions, identify alchemical substances, and transmute materials through learned formulae.',
    'Artisan':          'Craft fine goods with expert skill — metalwork, leatherwork, carpentry, or jewellery.',
    'Tracking':         'Follow the trail left by creatures — footprints, broken branches, disturbances in earth or snow.',
    'Beast Taming':     'Establish a bond with wild animals and command them through patience, trust, and authority.',
    'Elemental Control':'Channel raw elemental forces — directing flame, wind, water, or stone with trained precision.',
    'Spellcraft':       'Identify spells in the act of casting, analyse magical effects, and improvise arcane solutions.',
    'Riding':           'Control mounts in dangerous terrain, during combat, and at great speed without losing command.',
    'Enchanting':       'Imbue items with magical properties using ritual, focus, and deep arcane knowledge.',
    'Herbalism':        'Identify herbs and plants, brew natural remedies, and recognise toxic or healing flora.',
    'Shadow Arts':      'Manipulate ambient darkness, step through shadows, and weave obscuring darkness into technique.',
    'Runecrafting':     'Inscribe and activate runic symbols that carry magical power, permanence, and protective force.',
};

// ─── Flavor blurbs ────────────────────────────────────────────────────────────
const RACE_BLURBS = {
    'Human':        'Versatile and ambitious, humans spread across every corner of the world, driven by curiosity and an unmatched will to endure.',
    'Elf':          'Graceful and ancient, elves walk through centuries with ease, their magic woven into their very being.',
    'Dwarf':        'Stubborn as the mountains they call home, dwarves forge their legacy in stone and steel, their loyalty as enduring as the deep earth.',
    'Halfling':     'Small in stature but vast in courage, halflings navigate the world with a lightness of foot and an irrepressible optimism.',
    'Gnome':        'Boundlessly curious, gnomes see the world as a puzzle to be solved — and delight in every discovery.',
    'Half-Elf':     'Born between two worlds, half-elves carry the grace of elves and the adaptability of humanity, at home in neither and yet welcome in both.',
    'Half-Orc':     'Marked by strength and fire, half-orcs have learned that the world will not make room for them — so they carve their own path through it.',
    'Tiefling':     'Bearing the infernal mark of a distant ancestor, tieflings walk under suspicion, yet many rise above it with fierce determination.',
    'Dragonborn':   'Descendants of great dragons, they carry the pride of ancient wyrms in their breath and the fire of legend in their blood.',
    'Aasimar':      'Touched by the divine, aasimar carry a celestial spark — a radiant purpose that calls them toward greatness or ruin.',
    'Genasi':       'Children of elemental power, shaped by the raw forces of nature: wind, stone, flame, or tide.',
    'Goliath':      'Born in high peaks where the air is thin and the stakes absolute, goliaths measure themselves against the impossible every day.',
    'Tabaxi':       'Lithe and insatiably curious, tabaxi roam the world collecting stories, relics, and knowledge — always hunting the next marvel.',
    'Firbolg':      'Gentle giants of the deep forest, firbolgs live in quiet harmony with nature and stir only when something sacred is threatened.',
    'Kenku':        'Burdened by an ancient curse of silence, kenku speak only in mimicry — yet what they express through action is louder than any voice.',
    'Triton':       'Guardians of the deep sea, tritons stand as watchful sentinels between the surface world and the terrors lurking in the abyss.',
    'Warforged':    'Forged in the crucible of war and given sentience, warforged struggle with one profound question: what does it mean to truly live?',
    'Shifter':      'Touched by the primal beast within, shifters blur the line between civilization and the wild, tapping raw instinct when it matters most.',
};

const CLASS_BLURBS = {
    'Barbarian':    'A primal warrior who channels rage into devastating power, the barbarian is at home in the chaos of battle.',
    'Bard':         'A master of words and music, the bard shapes reality through performance, inspiring allies and unraveling enemies with equal flair.',
    'Cleric':       'A vessel of divine will, the cleric carries the power of a god into the mortal realm — to heal, to protect, or to judge.',
    'Druid':        'A speaker for the natural world, the druid wields the untamed forces of earth, sky, and season.',
    'Fighter':      'A disciplined warrior trained in the art of combat, the fighter excels through skill, endurance, and relentless resolve.',
    'Monk':         'A student of inner mastery, the monk turns their own body into a weapon through years of spiritual discipline.',
    'Paladin':      'Bound by sacred oath, the paladin rides the edge between divine warrior and righteous judge, smiting evil and lifting the fallen.',
    'Ranger':       'A hunter and tracker of the wild places, equally at home in shadow-draped forests as in open combat.',
    'Rogue':        'A creature of shadow and cunning, striking with precision and vanishing without trace.',
    'Sorcerer':     'Born with raw arcane power in their veins, the sorcerer shapes magic by pure instinct — unpredictable and awe-inspiring.',
    'Warlock':      'Bound to a patron beyond mortal comprehension, the warlock wields eldritch power at a price that may one day come due.',
    'Wizard':       'A scholar of the arcane arts, commanding spells of breathtaking complexity through meticulous study and iron discipline.',
    'Pyromancer':   'Wielding the essence of fire, the pyromancer scorches all who stand against them — a living flame commanding destruction.',
    'Cryomancer':   'Master of frost and ice, the cryomancer freezes time itself, reshaping the battlefield with glacial precision.',
    'Battle Mage':  'Where others must choose between blade and spell, the Battle Mage wields both with seamless, devastating unity.',
    'Shadow Knight':'Cloaked in darkness, the Shadow Knight walks the razor edge between protector and executioner.',
    'Necromancer':  'Wielding power over death and undeath alike, the necromancer commands the boundary between the living and the departed.',
    'Alchemist':    'Through experiment and a healthy disregard for safety, the alchemist transmutes the world — one explosive concoction at a time.',
    'Beastmaster':  'Bonded to wild creatures, the beastmaster fights alongside loyal companions whose ferocity matches their own.',
    'Elementalist': 'Harnessing the raw power of all four elements, bending earth, air, fire, and water to their will.',
    'Illusionist':  'A weaver of impossible things, the illusionist shapes perception itself — making enemies fear what does not exist.',
    'Runesmith':    'Carving ancient symbols of power into weapon and stone, the runesmith channels magic through craft alone.',
};

const STARTING_PACKS = {
    'Barbarian':    ['Greataxe', 'Two handaxes', "Explorer's pack", 'Four javelins'],
    'Bard':         ['Rapier', "Diplomat's pack", 'Lute', 'Leather armor', 'Dagger'],
    'Cleric':       ['Mace', 'Scale mail', 'Light crossbow & 20 bolts', "Priest's pack", 'Shield', 'Holy symbol'],
    'Druid':        ['Wooden shield', 'Scimitar', 'Leather armor', "Explorer's pack", 'Druidic focus'],
    'Fighter':      ['Chain mail', 'Longsword & shield', 'Light crossbow & 20 bolts', "Dungeoneer's pack"],
    'Monk':         ['Shortsword', '10 darts', "Dungeoneer's pack"],
    'Paladin':      ['Longsword & shield', 'Five javelins', "Priest's pack", 'Chain mail', 'Holy symbol'],
    'Ranger':       ['Scale mail', 'Two shortswords', "Explorer's pack", 'Longbow & quiver of 20 arrows'],
    'Rogue':        ['Rapier', 'Shortbow & quiver of 20 arrows', "Burglar's pack", 'Leather armor', 'Two daggers', "Thieves' tools"],
    'Sorcerer':     ['Light crossbow & 20 bolts', 'Component pouch', "Dungeoneer's pack", 'Two daggers'],
    'Warlock':      ['Light crossbow & 20 bolts', 'Component pouch', "Scholar's pack", 'Leather armor', 'Any simple weapon', 'Two daggers'],
    'Wizard':       ['Quarterstaff', 'Component pouch', "Scholar's pack", 'Spellbook'],
    'Pyromancer':   ['Fire staff', 'Flame wand', "Scholar's pack", 'Arcane focus', 'Fire-resistant cloak'],
    'Cryomancer':   ['Frost staff', 'Ice shard wand', "Scholar's pack", 'Arcane focus', 'Winter cloak'],
    'Battle Mage':  ['Enchanted longsword', 'Chain shirt', 'Arcane focus', "Adventurer's pack", 'Spellbook'],
    'Shadow Knight':['Shadow blade', 'Dark leather armor', 'Cloak of shadows', "Adventurer's pack"],
    'Necromancer':  ['Bone staff', 'Component pouch', "Scholar's pack", 'Dark robes', 'Spellbook'],
    'Alchemist':    ["Alchemist's kit", 'Leather armor', "Dungeoneer's pack", 'Two daggers', 'Component pouch'],
    'Beastmaster':  ['Longbow & quiver', 'Shortsword', "Explorer's pack", 'Leather armor', 'Beast bond token'],
    'Elementalist': ['Elemental staff', 'Component pouch', "Scholar's pack", 'Elemental focus gem'],
    'Illusionist':  ['Wand of illusions', 'Mirror shard focus', "Scholar's pack", 'Silk robes'],
    'Runesmith':    ['Rune-etched warhammer', 'Scale mail', "Smith's tools", "Adventurer's pack", 'Runestone set'],
};

// ─── State ────────────────────────────────────────────────────────────────────
const S = {
    race: null, subrace: null, gender: null,
    cls: null,  subclass: null,
    level: 1,
    abilityMethod: 'standard',
    scores:      { Strength:8, Dexterity:8, Constitution:8, Intelligence:8, Wisdom:8, Charisma:8 },
    pbScores:    { Strength:8, Dexterity:8, Constitution:8, Intelligence:8, Wisdom:8, Charisma:8 },
    rollScores:  { Strength:null, Dexterity:null, Constitution:null, Intelligence:null, Wisdom:null, Charisma:null },
    rolledPool:  [],
    pendingRoll: null,
    alignment:   null,
    skills:      new Set(),
    background:  null,
    equipment:   'pack',
    name:        '',
    savedChars:      [],
    party:           { name: '', size: 3, members: [] },
    savedParties:    [],
    activeParty:     null,     // party currently displayed in party sheet
    viewSheetOrigin: 'create', // 'create' | 'party' — where to go on back
};

let DB = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function $(id)       { return document.getElementById(id); }
function el(tag, cls){ const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function mod(score)  { return Math.floor((score - 10) / 2); }
function fmod(score) { const m = mod(score); return (m >= 0 ? '+' : '') + m; }

function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tid);
    t._tid = setTimeout(() => t.classList.remove('show'), 2400);
}

async function loadJSON(url) {
    const res = await fetch(url);
    return res.json();
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const TTip = { el: null, visible: false };

function initTooltip() {
    const t = document.createElement('div');
    Object.assign(t.style, {
        position: 'fixed', maxWidth: '240px',
        background: 'var(--bg-card)', border: '1px solid var(--gold-dim)',
        color: 'var(--text-muted)', fontSize: '0.7rem', lineHeight: '1.55',
        padding: '0.5em 0.75em', pointerEvents: 'none',
        opacity: '0', transition: 'opacity 0.12s', zIndex: '1001',
        fontStyle: 'italic', fontFamily: 'inherit',
    });
    document.body.appendChild(t);
    TTip.el = t;

    document.addEventListener('mousemove', e => {
        if (!TTip.visible) return;
        const x = Math.min(e.clientX + 16, window.innerWidth  - 260);
        const y = Math.min(e.clientY + 16, window.innerHeight - 80);
        TTip.el.style.left = x + 'px';
        TTip.el.style.top  = y + 'px';
    });
}

function showTip(e, text) {
    if (!TTip.el) return;
    TTip.el.textContent = text;
    TTip.visible = true;
    TTip.el.style.opacity = '1';
    const x = Math.min(e.clientX + 16, window.innerWidth  - 260);
    const y = Math.min(e.clientY + 16, window.innerHeight - 80);
    TTip.el.style.left = x + 'px';
    TTip.el.style.top  = y + 'px';
}

function hideTip() {
    TTip.visible = false;
    if (TTip.el) TTip.el.style.opacity = '0';
}

// ─── Select population helpers ────────────────────────────────────────────────
function populateGroupedSelect(selId, items, nameKey, srcKey) {
    const sel = $(selId);
    sel.innerHTML = '<option value="">— Choose —</option>';
    const groups = { core: [], expanded: [] };
    items.forEach(item => (groups[item[srcKey]] || groups.expanded).push(item));
    ['core','expanded'].forEach(src => {
        if (!groups[src].length) return;
        const og = document.createElement('optgroup');
        og.label = src === 'core' ? '── Core ──' : '── Expanded ──';
        groups[src].forEach(item => {
            const opt = document.createElement('option');
            opt.value = item[nameKey];
            opt.textContent = item[nameKey];
            opt.dataset.source = src;
            og.appendChild(opt);
        });
        sel.appendChild(og);
    });
}

function populateSubSelect(selId, values) {
    const sel = $(selId);
    sel.innerHTML = '<option value="">— Choose —</option>';
    (values || []).forEach(v => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        sel.appendChild(opt);
    });
}

function setBadge(badgeId, src) {
    const b = $(badgeId);
    if (!src) { b.textContent = ''; b.className = 'src-badge'; return; }
    b.textContent = src === 'core' ? 'Core' : 'Expanded';
    b.className = `src-badge ${src}`;
}

function getSelectedSource(selEl) {
    const opt = selEl.options[selEl.selectedIndex];
    return opt ? opt.dataset.source || null : null;
}

// ─── Auto-fill defaults ───────────────────────────────────────────────────────
function applyDefaultAbilityScores() {
    if (!S.cls) return;
    const priority = CLASS_STAT_PRIORITY[S.cls] || ABILITIES;
    priority.forEach((ab, i) => {
        const val = STANDARD_ARRAY[i];
        const sel = $(`std-${ab}`);
        if (sel) {
            sel.value = val;
            const modEl = $(`std-${ab}-mod`);
            if (modEl) modEl.textContent = fmod(val);
        }
        S.scores[ab] = val;
    });
    updateDerivedStats();
}

function applyDefaultSkills() {
    if (!S.cls) return;
    const defaults  = CLASS_DEFAULT_SKILLS[S.cls] || [];
    const cd        = CLASS_DATA[S.cls];
    const maxPicks  = cd ? cd.skillCount : 2;

    S.skills.clear();
    let picked = 0;

    // First pass: apply curated defaults
    document.querySelectorAll('#skills-grid .skill-row:not(.sk-disabled)').forEach(row => {
        if (picked >= maxPicks) return;
        if (defaults.includes(row.dataset.name)) {
            row.classList.add('sk-on');
            S.skills.add(row.dataset.name);
            picked++;
        }
    });
    // Second pass: fill any remaining slots with the first available skills
    if (picked < maxPicks) {
        document.querySelectorAll('#skills-grid .skill-row:not(.sk-disabled):not(.sk-on)').forEach(row => {
            if (picked >= maxPicks) return;
            row.classList.add('sk-on');
            S.skills.add(row.dataset.name);
            picked++;
        });
    }
}

// ─── Race ─────────────────────────────────────────────────────────────────────
function buildRaceSelect() {
    populateGroupedSelect('sel-race', DB.races, 'raceName', 'source');
    $('sel-race').addEventListener('change', e => {
        const name = e.target.value;
        S.race    = name || null;
        S.subrace = null;
        setBadge('race-badge', getSelectedSource(e.target));
        const race = DB.races.find(r => r.raceName === name);
        if (race && race.subraces && race.subraces.length) {
            populateSubSelect('sel-subrace', race.subraces);
            $('row-subrace').style.display = '';
        } else {
            $('row-subrace').style.display = 'none';
            $('sel-subrace').innerHTML = '';
        }
        updateDerivedStats();
        updateFlavorText();
    });
    $('sel-subrace').addEventListener('change', e => { S.subrace = e.target.value || null; });
}

// ─── Class ────────────────────────────────────────────────────────────────────
function buildClassSelect() {
    populateGroupedSelect('sel-class', DB.classes, 'className', 'source');
    $('sel-class').addEventListener('change', e => {
        const name = e.target.value;
        S.cls      = name || null;
        S.subclass = null;
        setBadge('class-badge', getSelectedSource(e.target));
        const cls = DB.classes.find(c => c.className === name);
        if (cls && cls.subclasses && cls.subclasses.length) {
            populateSubSelect('sel-subclass', cls.subclasses);
            $('row-subclass').style.display = '';
        } else {
            $('row-subclass').style.display = 'none';
            $('sel-subclass').innerHTML = '';
        }
        // Apply smart defaults: ability scores + skills
        applyDefaultAbilityScores();
        buildSkillRows();
        applyDefaultSkills();
        updateDerivedStats();
        updateFlavorText();
        updateInventory();
        updateEquipGoldHint();
    });
    $('sel-subclass').addEventListener('change', e => { S.subclass = e.target.value || null; });
}

// ─── Background ───────────────────────────────────────────────────────────────
function buildBackgroundSelect() {
    populateGroupedSelect('sel-background', DB.backgrounds, 'name', 'source');

    const sel = $('sel-background');
    sel.addEventListener('change', e => {
        S.background = e.target.value || null;
        const bg = DB.backgrounds.find(b => b.name === S.background);
        setBadge('bg-badge', bg ? bg.source : null);
        updateBgDetail(bg);
    });

    // Tooltip: show skills & feature when hovering the select
    sel.addEventListener('mouseenter', e => {
        if (!S.background) return;
        const bg = DB.backgrounds.find(b => b.name === S.background);
        if (!bg) return;
        const parts = [];
        if (bg.feature)        parts.push(`Feature: ${bg.feature}`);
        if (bg.skills?.length) parts.push(`Skills: ${bg.skills.join(', ')}`);
        if (bg.tools?.length)  parts.push(`Tools: ${bg.tools.join(', ')}`);
        if (bg.languages)      parts.push(`+${bg.languages} language${bg.languages > 1 ? 's' : ''}`);
        if (parts.length) showTip(e, parts.join('\n'));
    });
    sel.addEventListener('mouseleave', hideTip);
}

// ─── Gender & Level ───────────────────────────────────────────────────────────
function wireGender() {
    $('sel-gender').addEventListener('change', e => { S.gender = e.target.value || null; });
}

function wireLevel() {
    const slider = $('level-slider');
    const disp   = $('level-disp');
    slider.addEventListener('input', () => {
        S.level = +slider.value;
        disp.textContent = S.level;
        updateDerivedStats();
    });
}

// ─── Alignment ────────────────────────────────────────────────────────────────
function buildAlignmentGrid() {
    const grid = $('alignment-grid');
    ALIGNMENTS.forEach(a => {
        const btn = el('button', 'align-btn');
        btn.textContent = a;
        btn.addEventListener('click', () => {
            grid.querySelectorAll('.align-btn').forEach(b => b.classList.remove('sel'));
            btn.classList.add('sel');
            S.alignment = a;
        });
        grid.appendChild(btn);
    });
}

// ─── Ability scores ───────────────────────────────────────────────────────────
function buildAbilityScores() {
    buildStdRows();
    buildPbRows();
    buildRollRows();

    document.querySelectorAll('.mth-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mth-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.ab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            S.abilityMethod = btn.dataset.method;
            $(`ab-${S.abilityMethod}`).classList.add('active');
            syncScoresToState();
            updateDerivedStats();
        });
    });
}

function makeAbRow(ab, abbr) {
    const row    = el('div', 'ab-row');
    const abbrEl = el('span', 'ab-abbr'); abbrEl.textContent = abbr;
    const nameEl = el('span', 'ab-name'); nameEl.textContent = ab;
    // Tooltip on ability name
    const desc = ABILITY_DESC[ab];
    if (desc) {
        nameEl.style.cursor = 'help';
        nameEl.addEventListener('mouseenter', e => showTip(e, desc));
        nameEl.addEventListener('mouseleave', hideTip);
    }
    row.append(abbrEl, nameEl);
    return row;
}

function buildStdRows() {
    const cont = $('std-rows');
    cont.innerHTML = '';
    ABILITIES.forEach((ab, i) => {
        const row   = makeAbRow(ab, ABILITY_SHORT[i]);
        const sel   = document.createElement('select');
        sel.className = 'ab-roll-sel';
        sel.id = `std-${ab}`;
        const blank = document.createElement('option'); blank.value = ''; blank.textContent = '—'; sel.appendChild(blank);
        STANDARD_ARRAY.forEach(v => {
            const opt = document.createElement('option'); opt.value = v; opt.textContent = v; sel.appendChild(opt);
        });
        const modEl = el('span', 'ab-mod'); modEl.id = `std-${ab}-mod`; modEl.textContent = '—';
        sel.addEventListener('change', () => {
            modEl.textContent = sel.value ? fmod(+sel.value) : '—';
            syncScoresToState();
            updateDerivedStats();
        });
        row.append(sel, modEl);
        cont.appendChild(row);
    });
}

function buildPbRows() {
    const cont = $('pb-rows');
    cont.innerHTML = '';
    ABILITIES.forEach((ab, i) => {
        const row   = makeAbRow(ab, ABILITY_SHORT[i]);
        const ctrl  = el('div', 'ab-pb-ctrl');
        const minus = el('button', 'pb-adj'); minus.textContent = '−';
        const valEl = el('span', 'ab-score'); valEl.id = `pb-${ab}-val`; valEl.textContent = '8';
        const plus  = el('button', 'pb-adj'); plus.textContent  = '+';
        minus.addEventListener('click', () => adjustPB(ab, -1));
        plus.addEventListener('click',  () => adjustPB(ab, +1));
        ctrl.append(minus, valEl, plus);
        const modEl = el('span', 'ab-mod'); modEl.id = `pb-${ab}-mod`; modEl.textContent = fmod(8);
        row.append(ctrl, modEl);
        cont.appendChild(row);
        S.pbScores[ab] = 8;
    });
}

function adjustPB(ab, delta) {
    const cur  = S.pbScores[ab];
    const next = Math.min(15, Math.max(8, cur + delta));
    if (next === cur) return;
    const spent = ABILITIES.reduce((s, a) => s + (PB_COST[S.pbScores[a]] || 0), 0)
                - (PB_COST[cur] || 0) + (PB_COST[next] || 0);
    if (spent > PB_BUDGET) { toast('Not enough points.'); return; }
    S.pbScores[ab] = next;
    $(`pb-${ab}-val`).textContent = next;
    $(`pb-${ab}-mod`).textContent = fmod(next);
    $('pb-remain').textContent    = PB_BUDGET - spent;
    syncScoresToState();
    updateDerivedStats();
}

function buildRollRows() {
    const cont = $('roll-rows');
    cont.innerHTML = '';

    let pool = $('roll-pool');
    if (!pool) {
        pool = el('div'); pool.id = 'roll-pool';
        pool.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.8rem;min-height:2rem;align-items:center;';
        cont.parentElement.insertBefore(pool, cont);
    }

    ABILITIES.forEach((ab, i) => {
        const row     = makeAbRow(ab, ABILITY_SHORT[i]);
        row.style.cursor = 'pointer';
        row.title = 'Click a rolled value above, then click here to assign it';
        const scoreEl = el('span', 'ab-score'); scoreEl.id = `roll-${ab}-val`; scoreEl.textContent = '—';
        const modEl   = el('span', 'ab-mod');   modEl.id   = `roll-${ab}-mod`; modEl.textContent   = '—';
        row.append(scoreEl, modEl);
        row.addEventListener('click', () => {
            if (S.pendingRoll !== null && S.rollScores[ab] === null) {
                assignRoll(ab, S.pendingRoll);
            } else if (S.rollScores[ab] !== null) {
                S.rolledPool.push(S.rollScores[ab]);
                S.rollScores[ab] = null;
                scoreEl.textContent = '—';
                modEl.textContent   = '—';
                S.pendingRoll = null;
                refreshRollPool();
                syncScoresToState();
                updateDerivedStats();
            }
        });
        cont.appendChild(row);
    });

    $('btn-roll').addEventListener('click', () => {
        S.rolledPool  = [];
        S.pendingRoll = null;
        S.rollScores  = { Strength:null, Dexterity:null, Constitution:null, Intelligence:null, Wisdom:null, Charisma:null };
        ABILITIES.forEach(ab => {
            const v = $(`roll-${ab}-val`); if (v) v.textContent = '—';
            const m = $(`roll-${ab}-mod`); if (m) m.textContent = '—';
        });
        for (let i = 0; i < 6; i++) {
            const rolls = [0,0,0,0].map(() => Math.floor(Math.random()*6)+1);
            rolls.sort((a,b) => a-b);
            S.rolledPool.push(rolls[1]+rolls[2]+rolls[3]);
        }
        refreshRollPool();
        syncScoresToState();
        updateDerivedStats();
    });
}

function refreshRollPool() {
    const pool = $('roll-pool');
    if (!pool) return;
    pool.innerHTML = '';
    if (!S.rolledPool.length && Object.values(S.rollScores).every(v => v === null)) {
        pool.innerHTML = '<span style="font-size:0.68rem;color:var(--text-muted);font-style:italic;">Click Roll to generate scores, then assign each to an ability.</span>';
        return;
    }
    S.rolledPool.forEach(v => {
        const chip = el('span');
        chip.textContent = v;
        chip.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:2rem;height:2rem;border:1px solid var(--green-dim);background:var(--bg-card);color:var(--gold);font-size:0.9rem;cursor:pointer;transition:border-color 0.15s,background 0.15s;';
        chip.title = 'Click to select, then click an ability row to assign';
        chip.addEventListener('click', () => {
            pool.querySelectorAll('span').forEach(c => {
                c.style.borderColor = 'var(--green-dim)';
                c.style.background  = 'var(--bg-card)';
            });
            S.pendingRoll = v;
            chip.style.borderColor = 'var(--gold)';
            chip.style.background  = 'rgba(201,168,76,0.12)';
        });
        pool.appendChild(chip);
    });
}

function assignRoll(ab, val) {
    const idx = S.rolledPool.indexOf(val);
    if (idx !== -1) S.rolledPool.splice(idx, 1);
    S.rollScores[ab] = val;
    S.pendingRoll    = null;
    const scoreEl = $(`roll-${ab}-val`); if (scoreEl) scoreEl.textContent = val;
    const modEl   = $(`roll-${ab}-mod`); if (modEl)   modEl.textContent   = fmod(val);
    refreshRollPool();
    syncScoresToState();
    updateDerivedStats();
}

function syncScoresToState() {
    if (S.abilityMethod === 'standard') {
        ABILITIES.forEach(ab => {
            const sel = $(`std-${ab}`);
            S.scores[ab] = (sel && sel.value) ? +sel.value : 8;
        });
    } else if (S.abilityMethod === 'pointbuy') {
        ABILITIES.forEach(ab => { S.scores[ab] = S.pbScores[ab]; });
    } else {
        ABILITIES.forEach(ab => { S.scores[ab] = S.rollScores[ab] ?? 8; });
    }
}

// ─── Skills ───────────────────────────────────────────────────────────────────
function buildSkillRows() {
    const grid = $('skills-grid');
    grid.innerHTML = '';
    S.skills.clear();

    const cd       = S.cls ? CLASS_DATA[S.cls] : null;
    const allowed  = cd ? (cd.skills === 'any' ? null : new Set(cd.skills)) : null;
    const maxPicks = cd ? cd.skillCount : 2;

    const infoEl = $('skill-info');
    if (cd) {
        const from = (cd.skills !== 'any') ? ` from the ${S.cls} list` : '';
        infoEl.textContent = `Choose ${maxPicks} skill${maxPicks > 1 ? 's' : ''}${from}. Defaults have been pre-selected — adjust as you wish.`;
    } else {
        infoEl.textContent = 'Select a class to see available skills.';
    }

    DB.skills.forEach(sk => {
        const inList = !allowed || allowed.has(sk.skillName);
        const row    = el('div', `skill-row${inList ? '' : ' sk-disabled'}`);
        row.dataset.name = sk.skillName;

        const check = el('span', 'sk-check'); row.appendChild(check);
        const name  = el('span', 'sk-name');  name.textContent = sk.skillName; row.appendChild(name);
        const ab    = el('span', 'sk-ab');    ab.textContent = sk.associatedAbility.slice(0,3).toUpperCase(); row.appendChild(ab);
        const tag   = el('span', `sk-tag ${sk.source}`); tag.textContent = sk.source === 'core' ? 'Core' : 'Exp'; row.appendChild(tag);

        // Skill tooltip
        const desc = SKILL_DESC[sk.skillName];
        if (desc) {
            row.addEventListener('mouseenter', e => showTip(e, desc));
            row.addEventListener('mouseleave', hideTip);
        }

        if (inList) {
            row.addEventListener('click', () => {
                if (row.classList.contains('sk-on')) {
                    row.classList.remove('sk-on');
                    S.skills.delete(sk.skillName);
                } else {
                    if (S.skills.size >= maxPicks) { toast(`Max ${maxPicks} skills for this class.`); return; }
                    row.classList.add('sk-on');
                    S.skills.add(sk.skillName);
                }
            });
        }
        grid.appendChild(row);
    });
}

// ─── Equipment ────────────────────────────────────────────────────────────────
function wireEquipment() {
    document.querySelectorAll('.equip-opt').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.equip-opt').forEach(o => o.classList.remove('sel'));
            opt.classList.add('sel');
            S.equipment = opt.dataset.val;
            updateEquipGoldHint();
        });
    });
}

function updateEquipGoldHint() {
    const cd  = S.cls ? CLASS_DATA[S.cls] : null;
    const h   = $('gold-hint');
    h.textContent = (S.equipment === 'gold' && cd) ? `Starting gold: ${cd.startGold} gp` : '';
}

// ─── Derived stats ────────────────────────────────────────────────────────────
function updateDerivedStats() {
    syncScoresToState();
    const cd     = S.cls ? CLASS_DATA[S.cls] : null;
    const conMod = mod(S.scores.Constitution);

    $('d-hp').textContent    = cd ? Math.max(1, cd.hitDie + conMod) : '—';
    $('d-hd').textContent    = cd ? `d${cd.hitDie}` : '—';
    $('d-prof').textContent  = `+${PROF_BONUS[S.level] || 2}`;
    $('d-speed').textContent = `${RACE_SPEED[S.race] || 30} ft`;

    const savesRow = $('saves-row');
    savesRow.innerHTML = '';
    const saves = cd ? cd.saves : [];
    if (!saves.length) {
        const p = el('span', 'save-pill'); p.textContent = '—'; savesRow.appendChild(p);
    } else {
        saves.forEach(s => {
            const p = el('span', 'save-pill'); p.textContent = s.slice(0,3).toUpperCase(); savesRow.appendChild(p);
        });
    }

    const parts = [];
    if (S.race) parts.push(S.subrace ? `${S.subrace} ${S.race}` : S.race);
    if (S.cls)  parts.push(S.subclass || S.cls);
    if (S.level > 1) parts.push(`Level ${S.level}`);
    $('identity-line').textContent = parts.length ? parts.join(' · ') : 'Choose race & class';
}

// ─── Flavor text ─────────────────────────────────────────────────────────────
function updateFlavorText() {
    const ft = $('flavor-text');
    if (!S.race && !S.cls) {
        ft.innerHTML = 'Select a race and class to reveal the lore of your hero...';
        return;
    }
    const raceName   = S.subrace ? `${S.subrace} ${S.race}` : S.race;
    const raceBlurb  = S.race ? (RACE_BLURBS[S.race]  || `The ${S.race} are a proud and storied people.`) : '';
    const classBlurb = S.cls  ? (CLASS_BLURBS[S.cls]   || `The ${S.cls} follows a path of power and purpose.`) : '';
    let html = '';
    if (S.race) html += `<strong>${raceName}.</strong> ${raceBlurb}`;
    if (S.race && S.cls) html += '<br><br>';
    if (S.cls)  html += `<strong>${S.cls}.</strong> ${classBlurb}`;
    ft.innerHTML = html;
}

// ─── Background detail ────────────────────────────────────────────────────────
function updateBgDetail(bg) {
    const d = $('bg-detail-text');
    if (!bg) { d.textContent = 'Select a background to see its perks.'; return; }
    const parts = [];
    if (bg.feature)        parts.push(`Feature: ${bg.feature}`);
    if (bg.skills?.length) parts.push(`Skills: ${bg.skills.join(', ')}`);
    if (bg.tools?.length)  parts.push(`Tools: ${bg.tools.join(', ')}`);
    if (bg.languages)      parts.push(`Languages: +${bg.languages}`);
    d.textContent = parts.length ? parts.join(' · ') : bg.name;
}

// ─── Inventory ────────────────────────────────────────────────────────────────
function updateInventory() {
    const list = $('inventory-list');
    list.innerHTML = '';
    const items = S.cls ? STARTING_PACKS[S.cls] : null;
    if (!items) {
        const s = el('span', 'inv-empty'); s.textContent = 'Choose a class to see starting gear.'; list.appendChild(s); return;
    }
    items.forEach(item => {
        const row    = el('div', 'inv-item');
        const bullet = el('span', 'inv-bullet'); bullet.textContent = '✦';
        row.append(bullet, document.createTextNode(item));
        list.appendChild(row);
    });
}

// ─── Party bar ────────────────────────────────────────────────────────────────
function renderPartySlots() {
    const container = $('party-slots');
    container.innerHTML = '';
    for (let i = 0; i < S.party.size; i++) {
        const member = S.party.members[i];
        const slot   = el('div', `party-slot${member ? ' filled' : ''}`);
        const port   = el('div', 'party-slot-port');
        const img    = document.createElement('img');
        img.src = 'assets/images/characterportraits/elfrougefemale.jpg';
        img.alt = member ? (member.name || 'Character') : 'Empty';
        port.appendChild(img);
        const nm = el('div', 'party-slot-name');
        nm.textContent = member ? (member.name || 'Unnamed') : `Slot ${i+1}`;
        slot.append(port, nm);
        if (member) {
            slot.title = `${member.name || 'Unnamed'} — click to view`;
            slot.addEventListener('click', () => showViewSheet(member));
        }
        container.appendChild(slot);
    }
}

function wirePartyBar() {
    renderPartySlots();
    document.querySelectorAll('.sz-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sz-btn').forEach(b => b.classList.remove('sel'));
            btn.classList.add('sel');
            S.party.size = +btn.dataset.size;
            if (S.party.members.length > S.party.size)
                S.party.members = S.party.members.slice(0, S.party.size);
            renderPartySlots();
        });
    });
    $('party-name').addEventListener('input', e => { S.party.name = e.target.value; });
    $('btn-view-party').addEventListener('click', () => {
        if (!S.party.members.length) { toast('No members in the current party.'); return; }
        showPartySheet(S.party);
    });
    $('btn-add-party').addEventListener('click', () => {
        if (!S.race && !S.cls && !S.name.trim()) { toast('Build a character first.'); return; }
        if (S.party.members.length >= S.party.size) { toast(`Party is full (${S.party.size} members).`); return; }
        const char = buildCharObj();
        S.party.members.push(char);
        renderPartySlots();
        toast(`${char.name || 'Character'} added to party.`);
    });
    $('btn-save-party').addEventListener('click', saveParty);
    $('btn-load-party').addEventListener('click', () => toast('Select a saved party from the right panel.'));
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function wireTabs() {
    document.querySelectorAll('.cc-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.cc-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            $(`tab-${tab.dataset.tab}`).classList.add('active');
            updateTabNav();
        });
    });
}

// ─── Tab prev/next navigation ─────────────────────────────────────────────────
function currentTabIdx() {
    return TAB_ORDER.findIndex(t => {
        const panel = $(`tab-${t}`);
        return panel && panel.classList.contains('active');
    });
}

function goToTabIdx(idx) {
    if (idx < 0 || idx >= TAB_ORDER.length) return;
    const name = TAB_ORDER[idx];
    document.querySelectorAll('.cc-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.cc-tab[data-tab="${name}"]`).classList.add('active');
    $(`tab-${name}`).classList.add('active');
    updateTabNav(idx);
}

function updateTabNav(idx) {
    if (idx === undefined) idx = currentTabIdx();
    if (idx < 0) idx = 0;
    const prev = $('btn-tab-prev');
    const next = $('btn-tab-next');
    const step = $('tab-step-ind');
    if (!prev) return;
    prev.disabled = idx <= 0;
    next.disabled = idx >= TAB_ORDER.length - 1;
    step.textContent = `${idx + 1} / ${TAB_ORDER.length}`;
}

function wireTabNav() {
    const prev = $('btn-tab-prev');
    const next = $('btn-tab-next');
    if (!prev || !next) return;
    prev.addEventListener('click', () => {
        const idx = currentTabIdx();
        if (idx > 0) goToTabIdx(idx - 1);
    });
    next.addEventListener('click', () => {
        const idx = currentTabIdx();
        if (idx < TAB_ORDER.length - 1) goToTabIdx(idx + 1);
    });
    updateTabNav(0);
}

// ─── View sheet ───────────────────────────────────────────────────────────────
function showViewSheet(char, origin = 'create') {
    S.viewSheetOrigin = origin;
    const raceStr = char.race ? (char.subrace ? `${char.subrace} ${char.race}` : char.race) : null;

    $('vs-name').textContent       = char.name || 'Unnamed Hero';
    $('vs-sub').textContent        = [`Lv${char.level}`, raceStr, char.cls, char.alignment].filter(Boolean).join(' · ');
    $('vs-race').textContent       = char.race       || '—';
    $('vs-subrace').textContent    = char.subrace    || '—';
    $('vs-gender').textContent     = char.gender     || '—';
    $('vs-class').textContent      = char.cls        || '—';
    $('vs-subclass').textContent   = char.subclass   || '—';
    $('vs-background').textContent = char.background || '—';
    $('vs-alignment').textContent  = char.alignment  || '—';
    $('vs-level').textContent      = char.level      || 1;

    const abGrid = $('vs-ab-grid');
    abGrid.innerHTML = '';
    ABILITIES.forEach((ab, i) => {
        const score = (char.scores && char.scores[ab]) || 8;
        const cell  = el('div', 'vs-ab-cell');
        const abbr  = el('span', 'vs-ab-abbr'); abbr.textContent = ABILITY_SHORT[i];
        const sc    = el('span', 'vs-ab-score'); sc.textContent  = score;
        const m     = el('span', 'vs-ab-mod');   m.textContent   = fmod(score);
        cell.append(abbr, sc, m);
        abGrid.appendChild(cell);
    });

    $('vs-skills').textContent = (char.skills && char.skills.length) ? char.skills.join(', ') : '—';
    const cd = char.cls ? CLASS_DATA[char.cls] : null;
    $('vs-equip').textContent  = char.equipment === 'gold'
        ? `Starting Gold (${(cd || {}).startGold || '?'} gp)`
        : 'Starting Pack';

    $('char-name').value = char.name || '';
    $('identity-line').textContent = [raceStr, char.subclass || char.cls].filter(Boolean).join(' · ') || 'Choose race & class';
    $('d-hp').textContent    = cd ? Math.max(1, cd.hitDie + mod((char.scores || {}).Constitution || 8)) : '—';
    $('d-hd').textContent    = cd ? `d${cd.hitDie}` : '—';
    $('d-prof').textContent  = `+${PROF_BONUS[char.level] || 2}`;
    $('d-speed').textContent = `${RACE_SPEED[char.race] || 30} ft`;

    const savesRow = $('saves-row');
    savesRow.innerHTML = '';
    (cd ? cd.saves : []).forEach(s => {
        const p = el('span', 'save-pill'); p.textContent = s.slice(0,3).toUpperCase(); savesRow.appendChild(p);
    });

    // Update back button label
    const vsBack = $('btn-vs-back');
    if (vsBack) vsBack.textContent = origin === 'party' ? '← Back to Party' : '← Back';
    // Hide "Create New" when coming from party (back button suffices)
    const newBtn = $('btn-view-new');
    if (newBtn) newBtn.style.display = origin === 'party' ? 'none' : '';

    $('cc-tabs').style.display = 'none';
    const footerNav = $('tab-footer-nav');
    if (footerNav) footerNav.classList.add('hidden');
    $('party-sheet').classList.remove('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    $('view-sheet').classList.add('active');
}

function hideViewSheet() {
    $('view-sheet').classList.remove('active');
    if (S.viewSheetOrigin === 'party' && S.activeParty) {
        showPartySheet(S.activeParty);
        return;
    }
    $('cc-tabs').style.display = '';
    const footerNav = $('tab-footer-nav');
    if (footerNav) footerNav.classList.remove('hidden');
    const activeTab = document.querySelector('.cc-tab.active');
    if (activeTab) {
        $(`tab-${activeTab.dataset.tab}`).classList.add('active');
    } else {
        document.querySelector('.cc-tab').classList.add('active');
        $('tab-identity').classList.add('active');
    }
}

// ─── Party sheet ──────────────────────────────────────────────────────────────
function showPartySheet(party) {
    S.activeParty = party;

    $('ps-party-name').textContent = party.name || 'Unnamed Party';
    $('ps-count').textContent = `${party.members.length} member${party.members.length !== 1 ? 's' : ''}`;

    const membersDiv = $('ps-members');
    membersDiv.innerHTML = '';
    party.members.forEach(char => membersDiv.appendChild(buildMemberCard(char)));

    $('cc-tabs').style.display = 'none';
    const footerNav = $('tab-footer-nav');
    if (footerNav) footerNav.classList.add('hidden');
    $('view-sheet').classList.remove('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    $('party-sheet').classList.add('active');
}

function hidePartySheet() {
    $('party-sheet').classList.remove('active');
    S.activeParty = null;
    $('cc-tabs').style.display = '';
    const footerNav = $('tab-footer-nav');
    if (footerNav) footerNav.classList.remove('hidden');
    const activeTab = document.querySelector('.cc-tab.active');
    if (activeTab) {
        $(`tab-${activeTab.dataset.tab}`).classList.add('active');
    } else {
        document.querySelector('.cc-tab').classList.add('active');
        $('tab-identity').classList.add('active');
    }
    updateTabNav();
}

function buildMemberCard(char) {
    const cd     = char.cls ? CLASS_DATA[char.cls] : null;
    const conMod = mod((char.scores || {}).Constitution || 8);
    const raceStr = char.subrace ? `${char.subrace} ${char.race}` : char.race;

    const card = el('div', 'ps-card');

    const port = el('div', 'ps-card-port');
    const img  = document.createElement('img');
    img.src = 'assets/images/characterportraits/elfrougefemale.jpg';
    img.alt = char.name || 'Character';
    port.appendChild(img);

    const name = el('div', 'ps-card-name'); name.textContent = char.name || 'Unnamed';

    const sub  = el('div', 'ps-card-sub');
    sub.textContent = [`Lv${char.level}`, raceStr, char.cls].filter(Boolean).join(' · ');

    const stats = el('div', 'ps-card-stats');
    const rows = [
        ['HP',         cd ? Math.max(1, cd.hitDie + conMod) : '—'],
        ['Hit Die',    cd ? `d${cd.hitDie}` : '—'],
        ['Saves',      cd ? cd.saves.map(s => s.slice(0,3).toUpperCase()).join(', ') : '—'],
        ['Alignment',  char.alignment  || '—'],
        ['Background', char.background || '—'],
    ];
    if (char.skills && char.skills.length) {
        rows.push(['Skills', char.skills.join(', ')]);
    }
    rows.forEach(([lbl, val]) => {
        const s = el('div', 'ps-stat');
        s.innerHTML = `${lbl}: <strong>${val}</strong>`;
        stats.appendChild(s);
    });

    card.append(port, name, sub, stats);
    card.addEventListener('click', () => showViewSheet(char, 'party'));
    return card;
}

// ─── Save / Load characters ───────────────────────────────────────────────────
function buildCharObj() {
    syncScoresToState();
    return {
        id:         Date.now(),
        name:       S.name,
        race:       S.race,       subrace:    S.subrace,
        gender:     S.gender,
        cls:        S.cls,        subclass:   S.subclass,
        level:      S.level,
        scores:     { ...S.scores },
        alignment:  S.alignment,
        skills:     [...S.skills],
        background: S.background,
        equipment:  S.equipment,
    };
}

function saveChar() {
    if (!S.race && !S.cls && !S.name.trim()) { toast('Build a character first.'); return; }
    const char = buildCharObj();
    const idx  = S.savedChars.findIndex(c => c.name === char.name && c.race === char.race && c.cls === char.cls);
    if (idx >= 0) {
        S.savedChars[idx] = { ...char, id: S.savedChars[idx].id };
        toast(`${char.name || 'Character'} updated.`);
    } else {
        S.savedChars.push(char);
        toast(`${char.name || 'Character'} saved.`);
    }
    persist();
    renderSavedChars();
}

function loadChar(char) {
    S.name       = char.name;
    S.race       = char.race;       S.subrace  = char.subrace;
    S.gender     = char.gender;
    S.cls        = char.cls;        S.subclass = char.subclass;
    S.level      = char.level;
    S.scores     = { ...char.scores };
    S.alignment  = char.alignment;
    S.skills     = new Set(char.skills || []);
    S.background = char.background;
    S.equipment  = char.equipment || 'pack';
    showViewSheet(char);
    toast(`Loaded: ${char.name || 'character'}`);
}

function deleteChar(id) {
    S.savedChars = S.savedChars.filter(c => c.id !== id);
    persist();
    renderSavedChars();
}

function renderSavedChars() {
    const list = $('saved-char-list');
    list.innerHTML = '';
    if (!S.savedChars.length) {
        const m = el('p', 'empty-msg'); m.textContent = 'No saved characters.'; list.appendChild(m); return;
    }
    S.savedChars.forEach(char => {
        const row  = el('div', 'saved-item');
        const info = el('div', 'saved-item-info');
        const nm   = el('div', 'saved-item-name'); nm.textContent = char.name || 'Unnamed';
        const sub  = el('div', 'saved-item-sub');  sub.textContent = `Lv${char.level} ${char.race||''} ${char.cls||''}`.trim();
        info.append(nm, sub);
        const del = el('button', 'del-btn'); del.textContent = '✕'; del.title = 'Delete';
        del.addEventListener('click', e => { e.stopPropagation(); deleteChar(char.id); });
        row.addEventListener('click', () => loadChar(char));
        row.append(info, del);
        list.appendChild(row);
    });
}

// ─── Save / Load parties ──────────────────────────────────────────────────────
function saveParty() {
    if (!S.party.members.length) { toast('Add members to the party first.'); return; }
    const party = { id: Date.now(), name: S.party.name || 'Unnamed Party', size: S.party.size, members: [...S.party.members] };
    S.savedParties.push(party);
    persist();
    renderSavedParties();
    toast(`Party "${party.name}" saved.`);
}

function loadParty(party) {
    S.party.name    = party.name;
    S.party.size    = party.size;
    S.party.members = [...party.members];
    $('party-name').value = party.name;
    document.querySelectorAll('.sz-btn').forEach(b => b.classList.toggle('sel', +b.dataset.size === party.size));
    renderPartySlots();
    toast(`Loaded party: ${party.name}`);
}

function deleteParty(id) {
    S.savedParties = S.savedParties.filter(p => p.id !== id);
    persist();
    renderSavedParties();
}

function renderSavedParties() {
    const list = $('saved-party-list');
    list.innerHTML = '';
    if (!S.savedParties.length) {
        const m = el('p', 'empty-msg'); m.textContent = 'No saved parties.'; list.appendChild(m); return;
    }
    S.savedParties.forEach(party => {
        const row  = el('div', 'saved-item');
        const info = el('div', 'saved-item-info');
        const nm   = el('div', 'saved-item-name'); nm.textContent = party.name;
        const sub  = el('div', 'saved-item-sub');  sub.textContent = `${party.members.length}/${party.size} members`;
        info.append(nm, sub);
        const view = el('button', 'view-btn'); view.textContent = '⊙'; view.title = 'View party details';
        view.addEventListener('click', e => { e.stopPropagation(); showPartySheet(party); });
        const del  = el('button', 'del-btn');  del.textContent  = '✕'; del.title = 'Delete';
        del.addEventListener('click', e => { e.stopPropagation(); deleteParty(party.id); });
        row.addEventListener('click', () => loadParty(party));
        row.append(info, view, del);
        list.appendChild(row);
    });
}

// ─── Clear / New character ────────────────────────────────────────────────────
function clearCreator() {
    S.race = null; S.subrace = null; S.gender = null;
    S.cls  = null; S.subclass = null; S.level = 1;
    S.abilityMethod = 'standard';
    S.scores     = { Strength:8, Dexterity:8, Constitution:8, Intelligence:8, Wisdom:8, Charisma:8 };
    S.pbScores   = { Strength:8, Dexterity:8, Constitution:8, Intelligence:8, Wisdom:8, Charisma:8 };
    S.rollScores = { Strength:null, Dexterity:null, Constitution:null, Intelligence:null, Wisdom:null, Charisma:null };
    S.rolledPool = []; S.pendingRoll = null;
    S.alignment  = null; S.skills = new Set();
    S.background = null; S.equipment = 'pack'; S.name = '';

    ['sel-race','sel-class','sel-background','sel-gender'].forEach(id => $(id).value = '');
    $('sel-subrace').innerHTML  = '';
    $('sel-subclass').innerHTML = '';
    $('row-subrace').style.display  = 'none';
    $('row-subclass').style.display = 'none';
    ['race-badge','class-badge','bg-badge'].forEach(id => setBadge(id, null));

    $('char-name').value        = '';
    $('level-disp').textContent = 1;
    $('level-slider').value     = 1;

    document.querySelectorAll('.align-btn').forEach(b => b.classList.remove('sel'));

    document.querySelectorAll('.mth-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.ab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('.mth-btn[data-method="standard"]').classList.add('active');
    $('ab-standard').classList.add('active');
    $('std-rows').querySelectorAll('select').forEach(s => { s.value = ''; });
    $('std-rows').querySelectorAll('.ab-mod').forEach(m => { m.textContent = '—'; });

    ABILITIES.forEach(ab => {
        S.pbScores[ab] = 8;
        const v = $(`pb-${ab}-val`); if (v) v.textContent = '8';
        const m = $(`pb-${ab}-mod`); if (m) m.textContent = fmod(8);
    });
    const pbR = $('pb-remain'); if (pbR) pbR.textContent = PB_BUDGET;

    const pool = $('roll-pool'); if (pool) pool.innerHTML = '';
    ABILITIES.forEach(ab => {
        const v = $(`roll-${ab}-val`); if (v) v.textContent = '—';
        const m = $(`roll-${ab}-mod`); if (m) m.textContent = '—';
    });

    document.querySelectorAll('.equip-opt').forEach(o => o.classList.remove('sel'));
    const packOpt = document.querySelector('.equip-opt[data-val="pack"]');
    if (packOpt) packOpt.classList.add('sel');
    const gh = $('gold-hint'); if (gh) gh.textContent = '';

    buildSkillRows();
    $('party-sheet').classList.remove('active');
    S.activeParty = null;
    hideViewSheet();
    updateDerivedStats();
    updateFlavorText();
    updateInventory();
    updateBgDetail(null);
}

// ─── Persistence ─────────────────────────────────────────────────────────────
function persist() {
    localStorage.setItem('leonoria_characters', JSON.stringify(S.savedChars));
    localStorage.setItem('leonoria_parties',    JSON.stringify(S.savedParties));
}

function loadPersisted() {
    try { S.savedChars   = JSON.parse(localStorage.getItem('leonoria_characters') || '[]'); } catch(_) { S.savedChars   = []; }
    try {
        const raw = localStorage.getItem('leonoria_parties') || localStorage.getItem('leonoria_teams') || '[]';
        S.savedParties = JSON.parse(raw);
    } catch(_) { S.savedParties = []; }
    renderSavedChars();
    renderSavedParties();
}

// ─── Wire buttons ─────────────────────────────────────────────────────────────
function wireButtons() {
    $('char-name').addEventListener('input',  e => { S.name = e.target.value; });
    $('btn-save-char').addEventListener('click', saveChar);
    $('btn-new-char').addEventListener('click',  clearCreator);
    $('btn-view-new').addEventListener('click',  clearCreator);
    // Back buttons on view-sheet and party-sheet
    $('btn-vs-back').addEventListener('click', hideViewSheet);
    $('btn-ps-back').addEventListener('click', hidePartySheet);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
    try {
        const [races, classes, skills, backgrounds] = await Promise.all([
            loadJSON('data/heroes/races.json'),
            loadJSON('data/heroes/classes.json'),
            loadJSON('data/heroes/skills.json'),
            loadJSON('data/heroes/backgrounds.json'),
        ]);
        DB = { races, classes, skills, backgrounds };

        initTooltip();
        buildRaceSelect();
        buildClassSelect();
        buildBackgroundSelect();
        wireGender();
        wireLevel();
        buildAlignmentGrid();
        buildAbilityScores();
        buildSkillRows();
        wireEquipment();
        wirePartyBar();
        wireTabs();
        wireTabNav();
        wireButtons();
        loadPersisted();
        updateDerivedStats();
        updateFlavorText();
        updateInventory();
    } catch (err) {
        console.error('Character creator init failed:', err);
    }
}

document.addEventListener('DOMContentLoaded', init);
