/* ═══════════════════════════════════════════════════════════════════════════
   character-creator.js  —  Leonoria Character Creator (Leonoria system)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

/* ╔════════════════════════════════════════════════════════════════════════════
   ║ CRITICAL: SPELL LEVELING SYSTEM - DO NOT MODIFY WITHOUT USER PERMISSION
   ╚════════════════════════════════════════════════════════════════════════════

   SPELL LEVEL DISTRIBUTION (for character level cap of 30):

   1. Each spell school in attacks_and_spells.json has its own min/max cost range
   2. Within each school, spells are rescaled so:
      - Weakest spell = level 1
      - Strongest spell = level 24 (80% of max character level 30)
      - All spells distributed proportionally between based on cost

   3. The character sheet reads ab.level directly from the JSON
      (see renderAbilitiesHTML, line ~517-525)

   4. Ability unlock levels in character sheet are determined by:
      - abilityChip() uses ab.level from JSON (line 400)
      - calculateAbilityLevel() is ONLY fallback for abilities without level field

   WHY THIS MATTERS:
   - If you destroy the spell level field in JSON, spells will collapse to 5 buckets
   - If you hardcode ability calculations, every school gets same max level
   - Both waste enormous tokens rescaling and debugging

   TO CHANGE THIS: Ask the user first. Document what you're changing and why.
   ════════════════════════════════════════════════════════════════════════════ */

// ─── Aptitude system ──────────────────────────────────────────────────────────
const APTITUDES = ['physiology', 'cognition', 'discipline'];

const APTITUDE_NAMES = {
    physiology:         'Physiology',
    cognition:          'Cognition',
    discipline:         'Discipline',
    martial_experience: 'Martial Experience',
    materium_affinity:  'Materium Affinity',
    intelligence:       'Intelligence',
    scarring:           'Scarring',
    shadow_connection:  'Shadow Connection',
    tenacity:           'Tenacity',
    resonance:          'Resonance',
    openness:           'Openness',
    erudition:          'Erudition',
    ingenuity:          'Ingenuity',
    worldliness:        'Worldliness',
    perception:         'Perception',
    conduit_grade:      'Conduit Grade',
    magical_insulation: 'Magical Insulation',
    vitality:           'Vitality',
    hardening:          'Hardening',
    vigor:              'Vigor',
    metabolism:         'Metabolism',
    conviction:         'Conviction',
};

const APTITUDE_SHORT = {
    physiology:         'PHY',
    cognition:          'COG',
    discipline:         'DIS',
};

const BASE_APTITUDE  = 30;   // default starting value for each aptitude
const ALLOC_BUDGET   = 20;   // extra points to distribute in point-allocation mode
const ALLOC_MIN      = 10;
const ALLOC_MAX      = 75;
const MAX_LEVEL      = 30;   // maximum character level

const TAB_ORDER = ['identity', 'aptitudes', 'skills', 'equipment', 'abilities', 'inventory'];

// ─── Aptitude descriptions (tooltip) ──────────────────────────────────────────
const APTITUDE_DESC = {
    physiology:
        'PHYSIOLOGY — Physical Body & Durability\nYour health, strength, endurance, and resistance.\n\n▸ CONTROLS:\n  • Vitality (HP) = 40 + (Physiology × 0.6)\n  • Hardening resistances (Physical, Magical, Poison)\n  • Vigor: Carry capacity & melee damage (peaks at 50)\n  • Metabolism: Movement & action stamina pool\n\n▸ RESISTANCES:\n  Max hardening per type: 50%\n  Gain ~5% resistance per 100 hits of that type\n\n▸ BREAKING POINTS:\n  At 30: Equip medium armor\n  At 50: Heavy armor available, +3 hardening\n  At 70: Vigor cap 80, heavy weapons free\n  At 100: Stone Body—reduce all physical by 10%\n\n▸ STARTING RANGE: 20–60 | MAX: 100',
    cognition:
        'COGNITION — Mental Acuity, Experience & Magical Attunement\nYour knowledge, creativity, perception, street smarts, and capacity to channel magical energy.\n\n▸ CONTROLS:\n  • Erudition: Learn spells, absorb knowledge faster\n  • Ingenuity: Crafting & magical item creation\n  • Worldliness: Lockpicking, reading people, survival\n  • Perception: Detect danger, notice hidden details\n  • Conduit Grade: Max spell power & Materium pool size\n  • Shadow Connection: Dark arts school access\n  • Insulation: Magic resistance vs all schools\n\n▸ CREATION-FIXED:\n  Does not grow through leveling\n  Set at character creation by race + class + age\n  Only items, curses, and spells can alter it\n\n▸ RESOURCE SCALING:\n  Materium pool = Cognition × 1.2 + age bonus + race bonus\n  Age increases pool until 80, then flat\n\n▸ BREAKING POINTS:\n  At 20: Access second Materium school\n  At 30: Read advanced Materium texts alone\n  At 40: Pool +15%, school mastery available\n  At 50: +5 to new skill starting values, Erudition +10%\n  At 60: Shadow & Materium regen together\n  At 70: +10% danger detection, Elemental synergies at 50%\n  At 80: Materium regen +2% per combat turn\n  At 100: All Cognition learning +20%, +5% combat regen\n\n▸ STARTING RANGE: 15–55 | MAX: 100\n▸ NOTE: Replaces former Materium Affinity aptitude',
    discipline:
        'DISCIPLINE — Willpower, Focus & Combat Readiness\nYour mental fortitude, focus under pressure, and ability to act quickly in combat.\n\n▸ CONTROLS:\n  • Initiative: Turn order modifier in combat (primary stat)\n  • Composure: Resistance to crowd control and mental effects\n  • Attentiveness: Detection of traps and ambushes\n  • Reaction Speed: Act sooner when surprised\n\n▸ BREAKING POINTS:\n  At 30: +5 to initiative\n  At 50: Crowd control durations reduced 20%\n  At 70: +10 to initiative, detect nearby traps\n  At 100: Act twice per turn on surprise, full initiative bonus\n\n▸ STARTING RANGE: 20–60 | MAX: 100',
    'Martial Experience':
        'MARTIAL EXPERIENCE — Combat Skill & Weaponry\nYour training with weapons, battlefield tactics, and physical combat techniques.\n\n▸ CONTROLS:\n  • Weapon mastery: Proficiency with martial weapons\n  • Combat maneuvers: Riposte, parry, defensive stances\n  • Armor effectiveness: Better use of protective gear\n  • Physical damage scaling: Melee and ranged attack power\n\n▸ CLASS FOCUS:\n  Warriors, Rogues, and Hybrid classes prioritize this strength.',
    'Conviction':
        'CONVICTION — Moral Fortitude & Divine Favor\nYour alignment with cosmic forces of light, redemption, and righteous purpose.\n\n▸ CONTROLS:\n  • Lightwielding access: Divine magic schools (requires morality 66+)\n  • Holy power scaling: Light magic damage and healing potency\n  • Blessing resonance: Protection from corruption and shadow\n  • Redemption resistance: Armor against curses and dark influence\n\n▸ CLASS FOCUS:\n  Wardens, Soulkindlers, and holy warriors prioritize this strength.',
    'Materium Affinity':
        'MATERIUM AFFINITY — Raw Magical Potential\nYour natural attunement to the raw substance of magic itself.\n\n▸ CONTROLS:\n  • School versatility: Access to multiple Materium schools\n  • Spell scaling: Base effectiveness of elemental and utility spells\n  • Rune carving: Enchantment and artifact creation power\n  • Conduit resonance: Stability when using magical channels\n\n▸ CLASS FOCUS:\n  Casters, Archmages, and magical hybrids prioritize this strength.',
    'Materium Affinity (Light)':
        'MATERIUM AFFINITY (LIGHT) — Divine Elemental Magic\nYour attunement to the luminous schools of Lightwielding and holy magic.\n\n▸ SCHOOLS UNLOCKED:\n  • Lightwielding: Holy smites, divine barriers, purification\n  • Solar Magic: Heat, radiance, and stellar forces\n\n▸ CLASS FOCUS:\n  Holy casters and divine-touched warriors prioritize this strength.',
    'Materium Affinity (Shadow)':
        'MATERIUM AFFINITY (SHADOW) — Dark Arts & Corruption\nYour attunement to the shadowed schools of dark magic and forbidden knowledge.\n\n▸ SCHOOLS UNLOCKED:\n  • Shadow Arts: Curses, hexes, shadow manipulation, and life drain\n  • Darkblood: Blood magic and forbidden rituals\n\n▸ CLASS FOCUS:\n  Dark casters, Voidweavers, and shadow-touched classes prioritize this strength.',
};

// SKILL_DESC removed — tooltips are now built dynamically from skills.json data in buildSkillTooltip()

// ─── Flavor blurbs ────────────────────────────────────────────────────────────
const RACE_BLURBS = {
    midlander:          'The most numerous people of Leonoria. Midlanders built the great kingdoms and trade routes. Adaptable, ambitious, and relentlessly practical.',
    northerner:         'Hardy folk of the cold northern borders. Short on words, long on endurance. The cold does not break a Northerner — it makes them.',
    step_folk:          'Nomadic wanderers of the outer steppes and gleam havens. Masters of horse, wind, and survival between civilizations.',
    archons_secluded:  'The oldest forest people, living in deep woodland enclaves, remembering ages most have forgotten entirely.',
    archons_greys:     'The scholar-elves. Grey Archons built libraries and observatories before the Great Death. Some still maintain them.',
    archons_dark_ones: 'Descended into the deep places after the War of the Well. Adapted to shadow, silence, and secrets.',
    ice_archons:       'The frozen north\'s original inhabitants. Said to have made a pact with the eternal winds. They do not feel cold as others do.',
    wildmen_foresters:  'Fierce hunters and trackers of the dark forests. They move in packs, live by the hunt, and respect only strength and loyalty.',
    wildmen_ravagers:   'Towering warriors shaped by war and hardship. Not savages — a people defined entirely by the harshness of their world.',
    oakpeople:          'Small, nimble, and eerily attuned to growing things. The Oakpeople were once trees, or so they say. The world is patient, they say back.',
    stone_folk:         'Born in the deep stone. The Stone Folk carry the patience of rock. What they build, they build to last. What they promise, they keep.',
    swampbrood:         'Adapted to the boglands over centuries. Thick-skinned, long-limbed, and deeply spiritual. The bogs are home. The bogs are sacred.',
    ashen_halfbreeds:   'Touched by shadow and fire in equal measure. The Ashen carry a burning restlessness and a shadow that precedes them. Powerful. Volatile.',
};

const CLASS_BLURBS = {
    ironguard:          'The shield that does not break. Ironguards are the wall between civilization and the dark. Pure physical warriors, utterly dedicated to durability and protection.',
    battlebrave:        'The tip of the spear. Where Ironguards hold the line, Battlebraves shatter it. Aggressive, mobile, and built for direct offensive combat.',
    reaver:              'Overwhelm. Destroy. Move on. The Reaver does not defend — they overwhelm before defense is needed.',
    hunter:             'Scouting the road ahead, hunting from shadow, surviving where others perish. Hunters are the eyes and blades of the wilderness.',
    shadowblade:        'Precision over power. The Shadowblade vanishes, strikes once with lethal intent, and is gone before the body falls.',
    warden:             'Bound by faith and duty to protect the innocent. Wardens are divine warriors — champions of a people, not servants of a god.',
    soulkindler:        'Healers, speakers, and spiritual fire. Soulkindlers work where medicine fails and morale breaks — they carry the light that cannot be put out.',
    elementalist:       'Bending the Materium of air, earth, fire, and water through scholarly discipline. A living formula applied to the battlefield.',
    pyrecrafter:        'Master of fire and heat magic. The Pyrecrafter does not merely burn — they craft fire as a sculptor crafts stone. Beautiful. Lethal.',
    stormcaller:        'Commanding wind, lightning, and tempest. Stormcallers call down the sky — storm-born warriors of terrifying range and power.',
    lifewhisperer:      'The great healers of Leonoria. Where the Soulkindler brings spiritual fire, the Lifewhisperer brings biological restoration.',
    voidweaver:         'Practitioners of the dark not through malice but mastery. Voidweavers understand shadow deeply enough to shape it without being consumed.',
    bloodsinger:        'Body as conduit. Blood as power. Bloodsingers burn their own vitality to fuel devastating magical effects. High risk. Absolute power.',
    archmage:           'No weapon sharper than a prepared mind. Archmages gather, analyze, and apply knowledge — often more dangerous than the warrior beside them.',
    bladedancer:        'Speed is the only armor worth wearing. The Bladedancer strikes before the enemy can raise a defense, using blade and knife with lethal precision.',
    subjugator:         'Break the will, then break the body. The Subjugator weaves mind magic into close-quarters blade work — every cut is preceded by a crack in the psyche.',
    paladin:            'Faith made manifest in steel. The Paladin is a warrior first, channeling simple light magic to protect allies, mend wounds, and consecrate their blade.',
    shaman:             'The shaman speaks to what others refuse to hear: fire spirits, beast totems, blood memory. Their magic is borrowed from the unseen — and they always repay the debt.',
    demonologist:       'The Demonologist does not fear demons. They catalogue them. Knowledge is control, and control is absolute power over the things that unmake lesser mages.',
    dreameater:         'By the time you wake, it will already be too late. The Dreameater invades dreams, sculpts dread, and breaks enemies before the first sword is drawn.',
    windwalker:         'Cold. Silent. Moving like the wind between the living and the dead. The Windwalker carries old death magic through the frozen sky.',
    envoy:              'The Envoy wins the battle before it starts. Through charisma, reputation, and social mastery, they reshape the field without drawing a sword.',
};

// ─── State ────────────────────────────────────────────────────────────────────
function makeAptObj(val) {
    const o = {};
    APTITUDES.forEach(a => { o[a] = val; });
    return o;
}
function makeNullAptObj() {
    const o = {};
    APTITUDES.forEach(a => { o[a] = null; });
    return o;
}

const S = {
    race: null, subrace: null, gender: null,
    cls: null,  subclass: null,
    level: 1,
    age: 35,
    morality: 50,
    aptitudeMethod: 'standard',
    aptitudes:      makeAptObj(BASE_APTITUDE),
    allocAptitudes: makeAptObj(BASE_APTITUDE),
    rollAptitudes:  makeNullAptObj(),
    intelligence:   null,
    rolledPool:  [],
    pendingRoll: null,
    birthSign:   null,
    personality: null,
    skills:      new Set(),
    background:  null,
    equipment:   'pack',
    name:        '',
    savedChars:      [],
    party:           { name: '', size: 3, members: [] },
    savedParties:    [],
    activeParty:     null,
    viewSheetOrigin: 'create',
};

let DB = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function $(id)      { return document.getElementById(id); }
function el(tag, cls){ const e = document.createElement(tag); if (cls) e.className = cls; return e; }

function aptName(id)  { return APTITUDE_NAMES[id]  || id; }
function aptShort(id) { return APTITUDE_SHORT[id]  || id.slice(0,3).toUpperCase(); }

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

// ─── DB helpers ───────────────────────────────────────────────────────────────
function getAllRaces() {
    const groups = DB.races?.race_groups || [];
    const out = [];
    groups.forEach(g => (g.sub_races || []).forEach(r => out.push({ ...r, group: g.name })));
    return out;
}

function findRace(id) { return getAllRaces().find(r => r.id === id) || null; }
function findClass(id) { return (DB.classes?.classes || []).find(c => c.id === id) || null; }

// ─── Class colour by group ────────────────────────────────────────────────────
// Alignment anchors: Despair #c42020 · Neutral #4aaa38 · Conviction #e8c820
// Each class sits at its morality midpoint on that spectrum.
function classColor(classGroup) {
    switch (classGroup) {
        case 'Necromancer': return '#a81818'; // mid 22 — deep Despair, dark maroon-red
        case 'Warlock':     return '#c42020'; // mid 32 — full Despair red
        case 'Witch':       return '#c83838'; // mid 37 — Despair edge, lighter red
        case 'Rogue':       return '#4a8030'; // mid 42 — low Neutral, shadow green
        case 'Ranger':      return '#4aa040'; // mid 51 — mid Neutral, leafy green
        case 'Mage':        return '#3aaa60'; // mid 52 — mid Neutral, teal-green
        case 'Warrior':     return '#78a830'; // mid 57 — upper Neutral, warm yellow-green
        case 'Sorcerer':    return '#90a020'; // mid 57 — upper Neutral, amber-green
        case 'Druid':       return '#5ab840'; // mid 59 — high Neutral, bright nature green
        case 'Cleric':      return '#e8c820'; // mid 75 — full Conviction yellow
        default:            return 'var(--text)';
    }
}

// Returns a <span> coloured by class group containing the class name
function clsSpan(name, classGroup) {
    const s = el('span');
    s.textContent = name;
    s.style.color = classColor(classGroup);
    return s;
}
function findBackground(id) { return (DB.backgrounds?.profession_backgrounds || []).find(b => b.id === id) || null; }
function findSign(id)       { return (DB.birthmothersigns?.signs || []).find(s => s.id === id) || null; }

// ─── Personality helpers ──────────────────────────────────────────────────────
function getAllPersonalities() {
    return {
        standard: DB.personalities?.standard || [],
        combos:   DB.personalities?.combos   || [],
    };
}
function findPersonality(id) {
    if (!id) return null;
    const p = getAllPersonalities();
    return p.standard.find(x => x.id === id) || p.combos.find(x => x.id === id) || null;
}

// Parse race alignment_tendency string into a lean: 'good' | 'bad' | 'neutral'
function raceAlignLean(tendency) {
    if (!tendency) return 'neutral';
    const t = tendency.toLowerCase();
    if (/\bgood\b|\blawful\b/.test(t)) return 'good';
    if (/\bdark\b|\bevil\b/.test(t))   return 'bad';
    return 'neutral';
}

// ─── Resource usage ───────────────────────────────────────────────────────────
// Returns which resources a class actively spends in play.
function classResourceUsage(clsData) {
    if (!clsData) return { hp: false, stamina: false, materium: false };

    const martialGroups = ['Warrior', 'Ranger', 'Rogue'];
    const hybridIds     = ['shadowblade', 'warden', 'aegisbearer', 'verdant_warden', 'beastwarden', 'subjugator', 'paladin', 'shaman'];
    const bloodKeywords = ['Blood Magic', 'Darkblood', 'Bloodpassion', 'Siphoning'];

    const schools = clsData.materium_schools_available || [];
    return {
        stamina:  martialGroups.includes(clsData.class_group) || hybridIds.includes(clsData.id),
        materium: clsData.materium_access === true,
        hp:       schools.some(s => bloodKeywords.some(k => s.includes(k))),
    };
}

// Build a small embossed badge element for a resource
function makeResBadge(cssClass, symbol, tooltip) {
    const b = el('span', `res-badge ${cssClass}`);
    b.textContent = symbol;
    b.setAttribute('data-tooltip', tooltip);
    return b;
}

// Inject or remove a resource badge after a vs-vital-val span.
// Existing badge is always replaced so re-renders stay clean.
function _setResBadge(valId, active, cssClass, symbol, tooltip) {
    const valEl = $(valId);
    if (!valEl) return;
    // Remove any previous badge that is a direct next sibling
    const next = valEl.nextElementSibling;
    if (next?.classList.contains('res-badge')) next.remove();
    if (!active) return;
    const badge = makeResBadge(cssClass, symbol, tooltip);
    valEl.insertAdjacentElement('afterend', badge);
}

// Alignment colour for personality display
function personalityAlignColor(alignment) {
    if (alignment === 'good')    return '#e8c820'; // Conviction gold
    if (alignment === 'bad')     return '#c42020'; // Despair red
    return '#4aaa38';                               // Neutral green
}

// Roll a random personality based on current morality + race alignment
function rollPersonality() {
    const p = getAllPersonalities();
    if (!p.standard.length) return;

    const morality    = S.morality ?? 50;
    const raceData    = findRace(S.race);
    const raceLean    = raceAlignLean(raceData?.alignment_tendency);
    const moralZone   = getMoralityZone(morality); // 'Conviction' | 'Neutral' | 'Despair'

    // Combine morality zone + race lean into overall lean
    let lean;
    if (moralZone === 'Conviction' && raceLean !== 'bad')        lean = 'good';
    else if (moralZone === 'Despair' && raceLean !== 'good')     lean = 'bad';
    else if (moralZone === 'Conviction' && raceLean === 'bad')   lean = 'neutral'; // conflict
    else if (moralZone === 'Despair'    && raceLean === 'good')  lean = 'neutral'; // conflict
    else lean = raceLean; // morality is neutral — defer to race

    // 10% chance: combo personality
    const isCombo = Math.random() < 0.10;

    let chosen;
    if (isCombo && p.combos.length) {
        const good    = p.combos.filter(x => x.alignment === 'good');
        const bad     = p.combos.filter(x => x.alignment === 'bad');
        const neutral = p.combos.filter(x => x.alignment === 'neutral');
        chosen = _pickByLean(lean, good, bad, neutral, p.combos);
    } else {
        const good = p.standard.filter(x => x.alignment === 'good');
        const bad  = p.standard.filter(x => x.alignment === 'bad');
        chosen = _pickByLean(lean, good, bad, [], p.standard);
    }

    if (!chosen) return;
    S.personality = chosen.id;

    // Apply morality nudge from personality (re-applied fresh each roll since
    // rollMoralityForClass always resets from class range first)
    const adj = chosen.morality_adjust || 0;
    if (adj !== 0) {
        S.morality = Math.max(0, Math.min(100, (S.morality ?? 50) + adj));
        updateMoralityDisplay();
    }
}

function _pickByLean(lean, good, bad, neutral, fallback) {
    const r = Math.random();
    let pool;
    if (lean === 'good') {
        // 80% good, 10% neutral/any, 10% bad (contrary)
        if      (r < 0.80) pool = good.length    ? good    : fallback;
        else if (r < 0.90) pool = neutral.length ? neutral : fallback;
        else               pool = bad.length     ? bad     : fallback;
    } else if (lean === 'bad') {
        // 80% bad, 10% neutral/any, 10% good (contrary)
        if      (r < 0.80) pool = bad.length     ? bad     : fallback;
        else if (r < 0.90) pool = neutral.length ? neutral : fallback;
        else               pool = good.length    ? good    : fallback;
    } else {
        // Neutral: equal weight across all
        pool = fallback;
    }
    return pool[Math.floor(Math.random() * pool.length)] || null;
}
function getAllSkills() {
    const out = [];
    (DB.skills?.categories || []).forEach(cat => {
        (cat.skills || []).forEach(sk => out.push({ ...sk, category: cat.category, aptitude_link: cat.aptitude_link }));
    });
    return out;
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const TTip = { el: null, visible: false };

function initTooltip() {
    const t = document.createElement('div');
    Object.assign(t.style, {
        position: 'fixed', maxWidth: '380px',
        background: 'var(--bg-card)', border: '1px solid var(--gold-dim)',
        color: 'var(--text)', fontSize: '0.92rem', lineHeight: '1.65',
        padding: '0.65em 0.9em', pointerEvents: 'none',
        opacity: '0', transition: 'opacity 0.12s', zIndex: '1001',
        fontStyle: 'normal', fontFamily: 'inherit',
    });
    document.body.appendChild(t);
    TTip.el = t;
    document.addEventListener('mousemove', e => {
        if (!TTip.visible) return;
        const x = Math.min(e.clientX + 16, window.innerWidth  - 400);
        const y = Math.min(e.clientY + 16, window.innerHeight - 80);
        TTip.el.style.left = x + 'px';
        TTip.el.style.top  = y + 'px';
    });
    TTip.el.style.whiteSpace = 'pre-line';
    // Delegated tooltip for identity rows and ability chips
    document.addEventListener('mouseover', e => {
        const target = e.target.closest('[data-tooltip]');
        if (target) showTip(e, target.dataset.tooltip);
    });
    document.addEventListener('mouseout', e => {
        if (!e.relatedTarget?.closest('[data-tooltip]')) hideTip();
    });
}

function showTip(e, text) {
    if (!TTip.el) return;
    TTip.el.textContent = text;
    TTip.visible = true;
    TTip.el.style.opacity = '1';
    const x = Math.min(e.clientX + 16, window.innerWidth  - 400);
    const y = Math.min(e.clientY + 16, window.innerHeight - 80);
    TTip.el.style.left = x + 'px';
    TTip.el.style.top  = y + 'px';
}

function hideTip() {
    TTip.visible = false;
    if (TTip.el) TTip.el.style.opacity = '0';
}

// ─── Auto-fill defaults ───────────────────────────────────────────────────────
function applyDefaultAptitudes() {
    syncAptitudesToState();
    updateAptitudeSection();
}

function applyDefaultSkills() {
    const cls = findClass(S.cls);
    if (!cls) return;
    const fixed = new Set(cls.starting_skills?.fixed || []);
    const choices = cls.starting_skills?.choices || [];
    const choiceCount = cls.starting_skills?.choice_count || 1;

    S.skills.clear();
    let picked = 0;

    document.querySelectorAll('#skills-grid .skill-row').forEach(row => {
        const id = row.dataset.name;
        if (fixed.has(id)) {
            row.classList.add('sk-on');
            S.skills.add(id);
        }
    });
    document.querySelectorAll('#skills-grid .skill-row:not(.sk-disabled):not(.sk-fixed)').forEach(row => {
        if (picked >= choiceCount) return;
        row.classList.add('sk-on');
        S.skills.add(row.dataset.name);
        picked++;
    });
}

// ─── Race select ──────────────────────────────────────────────────────────────
function buildRaceSelect() {
    const sel = $('sel-race');
    sel.innerHTML = '<option value="">— Choose Race —</option>';
    const groups = DB.races?.race_groups || [];
    groups.forEach(group => {
        const og = document.createElement('optgroup');
        og.label = group.name;
        (group.sub_races || []).forEach(race => {
            const opt = document.createElement('option');
            opt.value = race.id;
            opt.textContent = race.own_name ? `${race.name} (${race.own_name})` : race.name;
            og.appendChild(opt);
        });
        sel.appendChild(og);
    });

    sel.addEventListener('change', e => {
        S.race    = e.target.value || null;
        S.subrace = null;
        const chk = $('chk-all-classes'); if (chk) chk.checked = false;
        populateClassSelect();
        rollPersonality();
        updateDerivedStats();
        updateFlavorText();
    });
}

// ─── Abilities tab ────────────────────────────────────────────────────────────
// Maps class IDs to their martial ability set ID in attacks_and_spells.json
const CLASS_MARTIAL_SET = {
    ironguard: 'vanguard_type', vanguard: 'vanguard_type', paladin: 'vanguard_type',
    battlebrave: 'skirmisher_type', bladedancer: 'skirmisher_type',
    reaver: 'skirmisher_type', skirmisher: 'skirmisher_type',
    hunter: 'marksman_type', marksman: 'marksman_type', beastwarden: 'marksman_type',
    shadowblade: 'rogue_type', assassin: 'rogue_type', thief: 'rogue_type', saboteur: 'rogue_type', subjugator: 'rogue_type',
    warmaster: 'commander_type',
};

// Maps school name keywords (from classes.json) to school IDs in attacks_and_spells.json
const SCHOOL_NAME_TO_ID = {
    'Purelight': 'luminance', 'Luminance': 'luminance',
    'Aegis Reflection': 'aegiscraft', 'Aegiscraft': 'aegiscraft', 'Sanctification': 'sanctification',
    'Vitalism': 'vitalism', 'Soulkindling': 'soulkindling', 'Revelation': 'revelation',
    'Dawncalling': 'dawncalling', 'Solacium': 'harmony_weaving', 'Harmony Weaving': 'harmony_weaving',
    'Seraphic Binding': 'seraphic_binding', 'Ascendance': 'ascendance',
    'Fire': 'pyricraft', 'Pyricraft': 'pyricraft',
    'Tempest': 'aeromancy', 'Aeromancy': 'aeromancy',
    'Aquas': 'aquorism', 'Aquorism': 'aquorism',
    'Earthen': 'terramancy', 'Terramancy': 'terramancy',
    'Impact': 'mindwielding', 'Mindwielding': 'mindwielding',
    'Athropium': 'lifewhispering', 'Lifewhispering': 'lifewhispering',
    'Bestial Communion': 'bestial_communion', 'Bloodpassion': 'bloodpassion',
    'Geometrics': 'geometrics', 'Arcane Arts': 'arcane_arts', 'Arcane': 'arcane_arts',
    'Darkvoid': 'voidreaving', 'Voidreaving': 'voidreaving',
    'Darkmind': 'dominion', 'Dominion': 'dominion',
    'Darkblood': 'blood_magic', 'Blood Magic': 'blood_magic', 'Bloodpassion': 'bloodpassion',
    'Necromancy': 'necromancy', 'Maleficium': 'maleficium', 'Rotweaving': 'rotweaving',
    'Demonology': 'demonology', 'Dreadforgering': 'dreadforgering',
    'Timewhispering': 'timewhispering', 'Umbramancy': 'umbramancy',
};

function resolveSchoolId(schoolName) {
    // Try direct lookup first, then partial keyword match
    const clean = schoolName.replace(/\s*\(.*?\)/g, '').trim(); // strip "(basic)" etc.
    if (SCHOOL_NAME_TO_ID[clean]) return SCHOOL_NAME_TO_ID[clean];
    for (const [key, id] of Object.entries(SCHOOL_NAME_TO_ID)) {
        if (clean.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(clean.toLowerCase())) return id;
    }
    return null;
}

// ─── Ability chips (compact, tooltip-based) ───────────────────────────────────
const MARTIAL_SET_ICON = {
    vanguard_type: '⚔', skirmisher_type: '⚔',
    marksman_type: '🏹', rogue_type: '🗡', commander_type: '✦',
};
const BASE_CLASS_ICON = {
    ironguard:'⚔', vanguard:'⚔', battlebrave:'⚔', reaver:'⚔', bladedancer:'⚔',
    warmaster:'✦', hunter:'🏹', marksman:'🏹', skirmisher:'🏹', beastwarden:'🏹',
    shadowblade:'🗡', assassin:'🗡', thief:'🗡', saboteur:'🗡', subjugator:'🗡',
    warden:'✦', aegisbearer:'✦', dawncaller:'✦', soulkindler:'✦', paladin:'✦',
};
const MAGIC_DOT_COLOR = {
    lightwielding: '#e8c820', // Conviction yellow
    materium:      '#5fbcff',
    shadow:        '#c42020', // Despair dark red
};

function escTip(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/\n/g,'&#10;');
}

function calculateAbilityLevel(ab, isWeakestSpell = false) {
    // Base attacks are always level 1
    if (ab.role === 'base_attack') return 1;

    // Weakest spell for a spellcaster is level 1
    if (isWeakestSpell) return 1;

    const dmg = ab.amount || 0;
    const cost = ab.cost || 0;
    const power = dmg + (cost * 0.5); // Combine damage and cost into power score

    if (power <= 0) return 5; // No damage = level 5 (control/utility)
    if (power <= 18) return 5; // Weak abilities = level 5
    if (power <= 28) return 9; // Light abilities = level 9
    if (power <= 38) return 14; // Medium abilities = level 14
    if (power <= 50) return 19; // Strong abilities = level 19
    return 24; // Top tier = level 24 (80% of max 30)
}

function abilityChip(ab, iconHtml, costType, charLevel) {
    const abilityLevel = ab.level || calculateAbilityLevel(ab);
    const isLocked = charLevel < abilityLevel;
    const costLabel = costType === 'stamina' ? 'Stamina' : costType === 'shadow' ? 'Materium (Shadow)' : 'Materium';
    const lines = [
        ab.name,
        `Cost: ${ab.cost || 0} ${costLabel}`,
    ];
    if (ab.damage_type && ab.damage_type !== 'null') lines.push(`Damage: ${ab.damage_type}${ab.amount ? ' — ' + ab.amount : ''}`);
    if (ab.effect) lines.push('', ab.effect);
    const tip = escTip(lines.join('\n'));
    const lockedClass = isLocked ? ' locked' : '';
    return `<span class="vs-abl-chip${lockedClass}" data-tooltip="${tip}">${iconHtml}${ab.name}</span>`;
}

function abilityCard(ab, costType) {
    const dmgParts = [];
    if (ab.damage_type && ab.damage_type !== 'null') dmgParts.push(ab.damage_type);
    if (ab.amount > 0) dmgParts.push(String(ab.amount) + (ab.amount_note ? ' ' + ab.amount_note : ''));
    if (ab.healing > 0) dmgParts.push('Heal ' + ab.healing);
    if (ab.shield > 0)  dmgParts.push('Shield ' + ab.shield);
    const costLabel = ab.vitality_cost
        ? `${ab.cost} + ${ab.vitality_cost} HP`
        : String(ab.cost);
    return `<div class="abl-card">
        <span class="abl-name">${ab.name}</span>
        <span class="abl-cost ${costType}">${costLabel} ${costType === 'stamina' ? 'Stamina' : 'Materium'}</span>
        ${dmgParts.length ? `<span class="abl-dmg">${dmgParts.join(' · ')}</span>` : ''}
        <span class="abl-effect">${ab.effect}</span>
    </div>`;
}

function sheetAbilityCard(ab, costType) { // kept for abilities tab
    const dmgParts = [];
    if (ab.damage_type && ab.damage_type !== 'null') dmgParts.push(ab.damage_type);
    if (ab.amount > 0)  dmgParts.push(String(ab.amount) + (ab.amount_note ? ' ' + ab.amount_note : ''));
    if (ab.healing > 0) dmgParts.push('Heals ' + ab.healing);
    if (ab.shield > 0)  dmgParts.push('Shield ' + ab.shield);
    const costLabel = ab.vitality_cost
        ? `${ab.cost} + ${ab.vitality_cost} HP`
        : String(ab.cost);
    const typeLabel = costType === 'stamina' ? 'Stamina' : costType === 'shadow' ? 'Materium' : 'Materium';
    return `<div class="vs-abl-card">
        <div class="vs-abl-top">
            <span class="vs-abl-name">${ab.name}</span>
            <span class="vs-abl-cost ${costType}">${costLabel} ${typeLabel}</span>
        </div>
        ${dmgParts.length ? `<div class="vs-abl-dmg">${dmgParts.join(' · ')}</div>` : ''}
        <div class="vs-abl-effect">${ab.effect}</div>
    </div>`;
}

function renderAbilitiesHTML(classId, charLevel = 1) {
    const cls = findClass(classId);
    if (!cls) return '<p class="skill-info">Select a class to see available abilities.</p>';

    const data = DB.spells;
    if (!data) return '<p class="skill-info">Ability data not loaded.</p>';

    // Collect all abilities with their level requirements
    const allAbilities = [];

    // Base attacks
    const baseAttacks = (data.base_attacks || []).filter(a => a.class_ids?.includes(classId));
    baseAttacks.forEach(a => {
        allAbilities.push({ ...a, type: 'attack', icon: BASE_CLASS_ICON[classId] || '⚔', costType: a.cost_type });
    });

    // Martial abilities
    const setId = CLASS_MARTIAL_SET[classId];
    if (setId && data.martial_ability_sets) {
        const set = data.martial_ability_sets.find(s => s.id === setId);
        if (set) {
            (set.subsets || []).forEach(sub => {
                (sub.abilities || []).forEach(a => {
                    allAbilities.push({ ...a, type: 'martial', icon: MARTIAL_SET_ICON[setId] || '⚔', costType: 'stamina' });
                });
            });
        }
    }

    // Find weakest ability overall (base attacks + martial + spells)
    let weakestAbilityPower = Infinity;

    // Check base attacks
    allAbilities.filter(a => a.type === 'attack').forEach(a => {
        const power = (a.amount || 0) + ((a.cost || 0) * 0.5);
        if (power < weakestAbilityPower) weakestAbilityPower = power;
    });

    // Check martial abilities
    allAbilities.filter(a => a.type === 'martial').forEach(a => {
        const power = (a.amount || 0) + ((a.cost || 0) * 0.5);
        if (power < weakestAbilityPower) weakestAbilityPower = power;
    });

    // Spells
    if (cls.materium_access && cls.materium_schools_available?.length && data.spell_schools) {
        const seen = new Set();
        cls.materium_schools_available.forEach(schoolName => {
            const schoolId = resolveSchoolId(schoolName);
            if (!schoolId || seen.has(schoolId)) return;
            seen.add(schoolId);
            const school = data.spell_schools.find(s => s.id === schoolId);
            if (!school) return;

            // Calculate power and add spells
            const costType = school.magic_type === 'shadow' ? 'shadow' : 'materium';
            const dotColor = MAGIC_DOT_COLOR[school.magic_type] || '#aaa';
            (school.spells || []).forEach(sp => {
                const power = (sp.amount || 0) + ((sp.cost || 0) * 0.5);
                if (power < weakestAbilityPower) weakestAbilityPower = power;
                allAbilities.push({ ...sp, type: 'spell', icon: `<span style="color:${dotColor}">●</span>`, costType: costType });
            });
        });
    }

    // Group by level requirement
    const byLevel = {};
    allAbilities.forEach(ab => {
        // Use level from JSON if available, otherwise calculate
        let lvl = ab.level;
        if (!lvl) {
            const abilityPower = (ab.amount || 0) + ((ab.cost || 0) * 0.5);
            const isWeakestAbility = weakestAbilityPower !== Infinity && abilityPower <= (weakestAbilityPower + 2);
            lvl = calculateAbilityLevel(ab, isWeakestAbility);
        }
        if (!byLevel[lvl]) byLevel[lvl] = [];
        byLevel[lvl].push(ab);
    });

    // Sort levels and create groups
    const groups = [];
    Object.keys(byLevel).map(Number).sort((a, b) => a - b).forEach(lvl => {
        const abilities = byLevel[lvl];
        const chips = abilities.map(a => abilityChip(a, `<span class="vs-abl-icon">${a.icon}</span>`, a.costType, charLevel)).join('');
        const titleText = charLevel >= lvl ? `Level ${lvl}` : `Unlocks at Level ${lvl}`;
        groups.push(`<div class="vs-abl-group">
            <div class="vs-abl-group-title">${titleText}</div>
            <div class="vs-abl-chips">${chips}</div>
        </div>`);
    });

    if (!groups.length) return '<p class="skill-info">No ability data found for this class.</p>';
    return `<div class="vs-abl-columns">${groups.join('')}</div>`;
}

function buildAbilitiesTab() {
    const el = $('abilities-content');
    if (!el) return;
    el.innerHTML = renderAbilitiesHTML(S.cls, S.level || 1);
}

// ─── Class select ─────────────────────────────────────────────────────────────
function normRaceName(s) {
    return String(s).toLowerCase().replace(/^the\s+/, '').replace(/\s+/g, ' ').trim();
}
function classTypicalForRace(cls, raceName) {
    if (!cls.typical_races?.length) return false;
    const rn = normRaceName(raceName);
    return cls.typical_races.some(tr => {
        const trn = normRaceName(tr);
        return trn === rn || trn.includes(rn) || rn.includes(trn);
    });
}
function raceIsGeneralist(raceData) {
    return (raceData?.special_traits || []).some(t => t.name === 'Generalist');
}

function populateClassSelect() {
    const sel      = $('sel-class');
    const showAll  = $('chk-all-classes')?.checked;
    const raceData = findRace(S.race);
    const raceName = raceData?.name || null;
    const generalist = raceName && raceIsGeneralist(raceData);

    // Show/hide filter hint
    const hint = $('class-filter-hint');
    const rnEl = $('race-filter-name');
    if (hint) hint.style.display = (raceName && !generalist) ? '' : 'none';
    if (rnEl && raceName) rnEl.textContent = raceName;

    const currentVal = sel.value;
    sel.innerHTML = '<option value="">— Choose Class —</option>';

    const archetypeOrder = ['Warrior','Ranger','Rogue','Cleric','Mage','Sorcerer','Druid','Warlock','Witch','Necromancer'];
    const groups = {};
    (DB.classes?.classes || []).forEach(cls => {
        const arch = cls.class_group || cls.archetype || 'Other';
        if (!groups[arch]) groups[arch] = [];
        groups[arch].push(cls);
    });
    const sortedArchetypes = [
        ...archetypeOrder.filter(a => groups[a]),
        ...Object.keys(groups).filter(a => !archetypeOrder.includes(a)).sort(),
    ];

    let hasCurrentVal = false;
    sortedArchetypes.forEach(arch => {
        const allInGroup = groups[arch];
        const isTypicalMap = new Map(allInGroup.map(c => [c.id, !raceName || generalist || classTypicalForRace(c, raceName)]));

        // When filtering: show only typical; when showAll: show all
        const visible = (!raceName || generalist || showAll)
            ? allInGroup
            : allInGroup.filter(c => isTypicalMap.get(c.id));

        if (!visible.length) return;
        const og = document.createElement('optgroup');
        og.label = arch;
        visible.forEach(cls => {
            const opt = document.createElement('option');
            opt.value = cls.id;
            const typical = isTypicalMap.get(cls.id);
            opt.textContent = cls.name + (showAll && !typical ? ' (unusual pairing)' : '');
            if (!typical && showAll) opt.className = 'unusual';
            if (cls.id === currentVal) hasCurrentVal = true;
            og.appendChild(opt);
        });
        sel.appendChild(og);
    });

    // If previous selection is no longer visible, clear it
    if (currentVal && !hasCurrentVal) {
        sel.value = '';
        S.cls = null;
        S.subclass = null;
        applyDefaultAptitudes();
        buildSkillRows();
        applyDefaultSkills();
        updateDerivedStats();
        updateFlavorText();
        updateInventory();
        updateEquipGoldHint();
        buildAbilitiesTab();
    } else {
        sel.value = currentVal;
    }
}

function buildClassSelect() {
    populateClassSelect();
    $('sel-class').addEventListener('change', e => {
        const id = e.target.value;
        S.cls       = id || null;
        S.subclass  = null;
        S.background = null;
        applyDefaultAptitudes();
        rollMoralityForClass(id);
        rollPersonality();
        buildSkillRows();
        applyDefaultSkills();
        updateDerivedStats();
        updateFlavorText();
        updateInventory();
        updateEquipGoldHint();
        buildAbilitiesTab();
        buildBackgroundSelect();
    });
    $('chk-all-classes')?.addEventListener('change', populateClassSelect);
}

// ─── Background select ────────────────────────────────────────────────────────
function buildBackgroundSelect() {
    const sel = $('sel-background');
    sel.innerHTML = '<option value="">— Choose Background —</option>';
    const all = DB.backgrounds?.profession_backgrounds || [];
    const filtered = S.cls
        ? all.filter(bg => Array.isArray(bg.for_classes) && bg.for_classes.includes(S.cls))
        : all;
    filtered.forEach(bg => {
        const opt = document.createElement('option');
        opt.value = bg.id;
        opt.textContent = bg.name;
        sel.appendChild(opt);
    });

    sel.addEventListener('change', e => {
        S.background = e.target.value || null;
        updateBgDetail(findBackground(S.background));
    });

    sel.addEventListener('mouseenter', e => {
        if (!S.background) return;
        const bg = findBackground(S.background);
        if (!bg) return;
        const parts = [];
        if (bg.flavor_trait) parts.push(bg.flavor_trait);
        if (bg.aptitude_modifier) {
            const mods = Object.entries(bg.aptitude_modifier).map(([k,v]) => `${aptName(k)} ${v>0?'+':''}${v}`).join(', ');
            if (mods) parts.push(`Aptitudes: ${mods}`);
        }
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
    if (!slider) return;
    const disp = $('level-disp');
    slider.addEventListener('input', () => {
        S.level = +slider.value;
        if (disp) disp.textContent = S.level;
        updateDerivedStats();
        buildAbilitiesTab();
    });
}

// ─── Birth Mother Sign ─────────────────────────────────────────────────────────
function buildBirthSignSelect() {
    const grid = $('alignment-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Build a dropdown-style selector from the birth mother signs
    const label = el('div');
    label.style.cssText = 'font-size:0.78rem;color:var(--text-muted);font-style:italic;margin-bottom:0.5rem;';
    label.textContent = 'Which of the 10 months where the hero born? It further sets the tone of the characters gifts.';
    grid.appendChild(label);

    const sel = document.createElement('select');
    sel.id = 'sel-birth-sign';
    sel.className = 'rpg-select';
    sel.style.width = '100%';
    sel.innerHTML = '<option value="">— Choose Sign —</option>';

    const signs = DB.birthmothersigns?.signs || [];
    const alignGroups = {};
    signs.forEach(sign => {
        if (!alignGroups[sign.alignment]) alignGroups[sign.alignment] = [];
        alignGroups[sign.alignment].push(sign);
    });

    ['None', 'Light', 'Materium', 'Dark'].forEach(align => {
        if (!alignGroups[align]) return;
        const og = document.createElement('optgroup');
        og.label = align === 'None' ? 'No Sign' : `${align} Signs`;
        alignGroups[align].forEach(sign => {
            const opt = document.createElement('option');
            opt.value = sign.id;
            opt.textContent = `${sign.name} (${sign.goddess_name || align})`;
            og.appendChild(opt);
        });
        sel.appendChild(og);
    });

    sel.addEventListener('change', e => {
        S.birthSign = e.target.value || null;
    });

    sel.addEventListener('mouseenter', e => {
        if (!S.birthSign) return;
        const sign = signs.find(s => s.id === S.birthSign);
        if (!sign) return;
        const parts = [sign.description];
        if (sign.perk) parts.push(`Perk — ${sign.perk.name}: ${sign.perk.effect}`);
        showTip(e, parts.join('\n'));
    });
    sel.addEventListener('mouseleave', hideTip);

    grid.appendChild(sel);
}

// ─── Age & Aptitudes ──────────────────────────────────────────────────────────
function getAptTier(val) {
    if (val >= 80) return 'Legendary';
    if (val >= 60) return 'Expert';
    if (val >= 40) return 'Seasoned';
    if (val >= 20) return 'Novice';
    return 'Untrained';
}

function getAgeNote(age) {
    if (age < 20)  return 'Very young — stamina and Materium pools both reduced';
    if (age <= 30) return 'Young — stamina building, Materium pool growing';
    if (age <= 45) return 'Prime — stamina near peak, Materium still growing';
    if (age <= 55) return 'Peak — stamina at maximum, Materium pool at its strongest';
    if (age <= 70) return 'Mature — stamina declining, Materium still strong';
    if (age <= 85) return 'Elder — stamina reduced, increased affliction risk';
    return 'Ancient — age penalties apply to stamina and affliction resistance';
}

function syncAptitudesToState() {
    const cls = findClass(S.cls);
    const bonuses = cls?.aptitude_bonuses || {};
    APTITUDES.forEach(a => {
        const base = S.rollAptitudes[a] ?? BASE_APTITUDE;
        S.aptitudes[a] = Math.min(ALLOC_MAX, Math.max(ALLOC_MIN, base + (bonuses[a] || 0)));
    });
}

function buildAptitudeSection() {
    const btn = $('btn-roll-all');
    if (btn) btn.addEventListener('click', rollAllAndAge);
    updateAptitudeSection();
}

function rollAllAndAge() {
    const race = findRace(S.race);
    const ageMin = race?.age_roll_range?.[0] || 15;
    const ageMax = race?.age_roll_range?.[1] || 100;
    S.age = Math.floor(Math.random() * (ageMax - ageMin + 1)) + ageMin;

    APTITUDES.forEach(a => {
        S.rollAptitudes[a] = 20 + Math.floor(Math.random() * 36); // 20–55
    });
    S.intelligence = Math.floor(Math.random() * 20) + 1; // 1–20, fixed at creation

    syncAptitudesToState();
    if (S.cls) rollMoralityForClass(S.cls);
    if (S.cls || S.race) rollPersonality();
    updateAptitudeSection();
    updateDerivedStats();
}

function updateAptitudeSection() {
    const cont = $('apt-section');
    if (!cont) return;
    cont.innerHTML = '';

    const cls = findClass(S.cls);
    const bonuses = cls?.aptitude_bonuses || {};
    const hasRolled = APTITUDES.some(a => S.rollAptitudes[a] !== null);

    // Age row
    const ageRolled = S.age !== 35 || hasRolled; // treat default 35 as unrolled until explicitly rolled
    const ageRow = el('div', `apt-display-row${hasRolled ? '' : ' apt-unrolled'}`);
    const ageLbl  = el('span', 'apt-disp-lbl'); ageLbl.textContent = 'Age';
    const ageVal  = el('span', 'apt-disp-val'); ageVal.textContent = S.age ?? '—';
    const ageTier = el('span', 'apt-disp-tier'); ageTier.textContent = '';
    const ageNote = el('span', 'apt-disp-note');
    ageNote.textContent = hasRolled ? getAgeNote(S.age) : 'not yet rolled';
    ageRow.setAttribute('data-tooltip',
        'AGE\nYour character\'s age at the start of play.\n\n' +
        'Effects:\n' +
        '  Stamina pool — peaks around age 50\n' +
        '  Materium pool — peaks around age 80\n' +
        '  HP regeneration — reduced in old age\n' +
        '  Affliction susceptibility — increases past age 60\n\n' +
        'Race affects the possible age range.'
    );
    ageRow.append(ageLbl, ageVal, ageTier, ageNote);
    cont.appendChild(ageRow);

    // Aptitude rows
    APTITUDES.forEach(a => {
        const rolled = S.rollAptitudes[a];
        const bonus  = bonuses[a] || 0;
        const final  = S.aptitudes[a] ?? BASE_APTITUDE;
        const tier   = getAptTier(final);

        const row     = el('div', `apt-display-row${rolled === null ? ' apt-unrolled' : ''}`);
        const lbl     = el('span', 'apt-disp-lbl'); lbl.textContent = aptName(a);
        const val     = el('span', 'apt-disp-val'); val.textContent = rolled !== null ? final : '—';
        const tierEl  = el('span', 'apt-disp-tier'); tierEl.textContent = rolled !== null ? tier : '';
        const noteEl  = el('span', 'apt-disp-note');

        if (rolled !== null) {
            noteEl.textContent = bonus !== 0
                ? `base ${rolled} ${bonus > 0 ? '+' : ''}${bonus} from class`
                : '';
        } else {
            noteEl.textContent = 'not yet rolled';
        }

        const desc = APTITUDE_DESC[a];
        if (desc) row.setAttribute('data-tooltip', desc);
        row.append(lbl, val, tierEl, noteEl);
        cont.appendChild(row);
    });

    if (!hasRolled) {
        const hint = el('p', 'apt-reroll-hint');
        hint.textContent = 'Click the button above to roll your age and aptitude scores.';
        cont.appendChild(hint);
    } else {
        const hint = el('p', 'apt-reroll-hint');
        hint.textContent = 'You can re-roll at any time before saving.';
        cont.appendChild(hint);
    }

    buildDerivedStatsDisplay();
}

// ─── Derived Stats Display ────────────────────────────────────────────────────
function buildDerivedStatsDisplay() {
    const cont = $('derived-stats-display');
    if (!cont) return;
    cont.innerHTML = '';

    const hasRolled = APTITUDES.some(a => S.rollAptitudes[a] !== null);
    if (!hasRolled) return;

    const cls  = findClass(S.cls);
    const race = findRace(S.race);
    const physVal = S.aptitudes.physiology || BASE_APTITUDE;
    const cogVal  = S.aptitudes.cognition  || BASE_APTITUDE;
    const dispVal = S.aptitudes.discipline || BASE_APTITUDE;
    const age     = S.age || 35;
    const raceMat = race?.materium_pool_bonus || 0;
    const morality = S.morality ?? 50;

    const vitality   = Math.round(physVal * 1.3 + 8);
    const stamina    = Math.round(physVal * 1.5 + ageStaminaBonus(age));
    const materium   = Math.round(cogVal * 1.2 + ageMateriumBonus(age) + raceMat);
    const hpRegen    = calcHpRegenPerTurn(physVal, age);
    const affliction = ageAfflictionModifier(age);
    const initiative = calcInitiative(dispVal, morality);
    const stamBonus  = ageStaminaBonus(age);
    const matBonus   = ageMateriumBonus(age);

    // Armor access threshold
    const armorAccess = physVal >= 70 ? 'All armour & heavy weapons' :
                        physVal >= 50 ? 'Heavy armour' :
                        physVal >= 30 ? 'Medium armour' : 'Light armour only';

    // Vigor tier (melee damage & carry capacity; peaks at physiology 50)
    const vigorScore = Math.min(physVal, 50);
    const vigor = getAptTier(vigorScore * 2); // scale 0–50 → 0–100 for tier

    // Insulation: magic resistance derived from cognition
    const insulation = Math.round(cogVal * 0.2) + '%';

    // Conduit grade: spell power capacity
    const conduitGrade = getAptTier(cogVal);

    // Composure: CC resistance (20% reduction unlocks at 50)
    const composure = dispVal >= 100 ? 'Full immunity (brief)' :
                      dispVal >= 70  ? 'Strong (−30% CC duration)' :
                      dispVal >= 50  ? 'Moderate (−20% CC duration)' :
                      dispVal >= 30  ? 'Low (+5 initiative)' : 'Baseline';

    // Reaction speed: surprise initiative bonus
    const reactionBonus = dispVal >= 100 ? 'Act twice on surprise' :
                          dispVal >= 70  ? '+10 initiative on surprise' :
                          dispVal >= 30  ? '+5 initiative on surprise' : 'No bonus';

    const section = el('div');
    section.style.cssText = 'margin-top: 1.5rem; padding: 1rem; background: var(--bg-card); border-left: 3px solid var(--green-dim);';

    const title = el('div');
    title.style.cssText = 'font-size: 1.08rem; color: var(--text); letter-spacing: 0.14em; margin-bottom: 1rem; text-transform: uppercase; border-bottom: 1px solid var(--green-dim); padding-bottom: 0.35rem;';
    title.textContent = 'Derived Attributes';
    section.appendChild(title);

    section.appendChild(createDerivedSection('Physiology', [
        { label: 'Vitality (HP)',            value: vitality,     tooltip: 'Health pool. Reaches 0 = defeated. Formula: Physiology × 1.3 + 8' },
        { label: 'Stamina Pool',             value: stamina,      tooltip: `Physical endurance pool. Powers attacks, dodge rolls, and movement. Formula: Physiology × 1.5 + Age bonus (${stamBonus >= 0 ? '+' : ''}${stamBonus})` },
        { label: 'HP Regen / Turn',          value: hpRegen,      tooltip: 'Health regenerated per turn on the world map. Slows with age after 50. Formula: Physiology × 0.03 − Age penalty' },
        { label: 'Vigor',                    value: vigor,        tooltip: 'Carry capacity and melee damage bonus. Peaks at Physiology 50; heavier weapons unlock at 70.' },
        { label: 'Armour Access',            value: armorAccess,  tooltip: 'Unlocked armour and weapon categories based on Physiology. At 30: medium; at 50: heavy; at 70: all heavy weapons.' },
    ]));

    const personalityData = findPersonality(S.personality);
    const personalityLabel = personalityData
        ? (personalityData.components
            ? `${personalityData.name} (${personalityData.components.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' + ')})`
            : personalityData.name)
        : '—';
    const personalityTip = personalityData
        ? `${personalityData.name}\n${personalityData.description}\n\n` +
          personalityData.effects.map(e => `• ${e}`).join('\n') +
          (personalityData.morality_adjust
              ? `\n\nMorality: ${personalityData.morality_adjust > 0 ? '+' : ''}${personalityData.morality_adjust} (${personalityData.morality_adjust > 0 ? 'towards Conviction' : 'towards Despair'})`
              : '')
        : 'Personality is rolled when class and race are chosen.';

    const shadowConn = race?.shadow_connection ?? 0;
    const intVal = S.intelligence !== null ? S.intelligence : '—';

    section.appendChild(createDerivedSection('Cognition', [
        { label: 'Materium Pool',            value: materium + ' MP', tooltip: `Elemental spell energy. Formula: Cognition × 1.2 + Age bonus (${matBonus >= 0 ? '+' : ''}${matBonus}) + Race bonus (${raceMat})` },
        { label: 'Conduit Grade',            value: conduitGrade, tooltip: 'Maximum spell power capacity. Determines which spell tiers you can channel. Scales directly with Cognition.' },
        { label: 'Insulation',               value: insulation,   tooltip: 'Passive magic resistance against all schools. Formula: Cognition × 0.2%' },
        { label: 'Intelligence',             value: intVal,       tooltip: 'Fixed at character creation (1–20). Raw cognitive capacity. Each point adds +0.5% to all non-physical skill rolls. Cannot be trained.' },
        { label: 'Erudition',                value: getAptTier(cogVal),  tooltip: 'Speed at which you learn spells and absorb knowledge. Improves at cognition 50 (+10% learning) and 100 (+20%).' },
        { label: 'Perception',               value: getAptTier(cogVal),  tooltip: 'Ability to detect danger, hidden details, and threats. Improves at cognition 70 (+10% detection).' },
        { label: 'Worldliness',              value: getAptTier(cogVal),  tooltip: 'Lockpicking, reading people, survival instincts. Improves at cognition 30 (read advanced texts) and 50.' },
        { label: 'Ingenuity',                value: getAptTier(cogVal),  tooltip: 'Crafting and magical item creation skill. Scales with Cognition.' },
        { label: 'Shadow Connection',        value: shadowConn,   tooltip: 'Innate link to the Shadow Realm and Dark Arts. Race and class determined. 0 = no access to Shadow Arts schools.' },
        { label: 'Scarring',                 value: 0,            tooltip: 'Accumulated trauma from battle failures, horror, and betrayal. Starts at 0. Every 10 Scarring reduces max Conviction by 2. Above 50: +5% resistance to Darkmind and Verdicium.' },
        { label: 'Personality',              value: personalityLabel, tooltip: personalityTip, valueColor: personalityData ? personalityAlignColor(personalityData.alignment) : undefined },
    ]));

    section.appendChild(createDerivedSection('Discipline', [
        { label: 'Initiative',               value: initiative,   tooltip: 'Turn order in combat. Higher = act sooner. Includes morality alignment bonus for Conviction and Despair zones.' },
        { label: 'Composure',                value: composure,    tooltip: 'Resistance to crowd control and mental effects. Unlocks at discipline 30 (+5 initiative), 50 (−20% CC), 70 (−30% CC), 100 (brief immunity).' },
        { label: 'Attentiveness',            value: getAptTier(dispVal), tooltip: 'Detection of traps and ambushes. At discipline 70 you detect nearby traps automatically.' },
        { label: 'Reaction Speed',           value: reactionBonus, tooltip: 'Initiative bonus when surprised. Unlocks at discipline 30 (+5) and 70 (+10). At 100: act twice on a surprise round.' },
    ]));

    section.appendChild(createDerivedSection('Age', [
        { label: 'Stamina Modifier',         value: (stamBonus >= 0 ? '+' : '') + stamBonus,   tooltip: 'Age-based bonus to stamina pool. Peaks at age 50, declines after 60.' },
        { label: 'Materium Modifier',        value: (matBonus >= 0 ? '+' : '') + matBonus,     tooltip: 'Age-based bonus to materium pool. Grows until age 80, then plateaus.' },
        { label: 'Affliction Susceptibility', value: (affliction > 0 ? '+' : '') + affliction + '%', tooltip: 'Modifier to susceptibility to afflictions, poisons, and venoms. Young characters have slight resistance (−5%), increases sharply past 70.' },
        { label: 'HP Regen Penalty',         value: age > 50 ? '−' + parseFloat(((age - 50) * 0.01).toFixed(2)) : 'None', tooltip: 'Regen penalty applied in old age. Begins after age 50.' },
    ]));

    // ── Resistances ──────────────────────────────────────────────────────────
    const RESIST_LABELS = {
        physical_hardening: 'Physical Hardening',
        magical_insulation: 'Magical Insulation',
        poisonous:          'Poison',
        venomous:           'Venom',
        moral_affliction:   'Moral Affliction',
        blight:             'Blight',
        fire:               'Fire',
        cold:               'Cold',
        chill:              'Chill',
        hot:                'Heat',
        earthen:            'Earthen',
        arcane:             'Arcane',
        darkvoid:           'Darkvoid',
        purelight:          'Purelight',
        darkblood:          'Darkblood',
        athropium:          'Athropium',
        slashing:           'Slashing',
        piercing:           'Piercing',
        blunt:              'Blunt',
        humidity:           'Humidity',
        weathering:         'Weathering',
    };
    const RESIST_TIPS = {
        physical_hardening: 'Reduces all incoming physical damage. Race starting value stacks with hardening earned in combat (max 50% per type).',
        magical_insulation: 'Reduces all incoming magical damage. Race starting value stacks with hardening earned in combat (max 50% per type).',
        poisonous:          'Reduces duration and potency of poison effects.',
        venomous:           'Reduces duration and potency of venom effects.',
        moral_affliction:   'Reduces susceptibility to fear, charm, and morale-breaking effects.',
        blight:             'Reduces damage from Blight school spells and rot effects.',
        fire:               'Reduces damage from fire and heat-based attacks.',
        cold:               'Reduces damage from cold and ice-based attacks.',
        chill:              'Reduces damage from chill-type Shadow Arts spells.',
        hot:                'Resistance to heat and arid environment effects.',
        earthen:            'Reduces damage from Earthen school spells and physical impacts.',
        arcane:             'Reduces damage from raw arcane energy attacks.',
        darkvoid:           'Reduces damage from Darkvoid school Shadow Arts spells.',
        purelight:          'Reduces damage from Lightwielding spells.',
        darkblood:          'Reduces damage from darkblood-type afflictions and spells.',
        athropium:          'Reduces damage from Athropium school spells.',
        slashing:           'Reduces incoming slashing weapon damage.',
        piercing:           'Reduces incoming piercing weapon damage.',
        blunt:              'Reduces incoming blunt weapon damage.',
        humidity:           'Resistance to humidity and wetness-related environment effects.',
        weathering:         'Resistance to weather and environmental wear effects.',
    };

    const startRes = race?.starting_resistances || {};
    // Always show physical and magical; show others only if non-zero
    const resRows = [];
    Object.entries(RESIST_LABELS).forEach(([key, label]) => {
        const val = startRes[key] ?? 0;
        if (key === 'physical_hardening' || key === 'magical_insulation' || val > 0) {
            resRows.push({ label, value: val + '%', tooltip: RESIST_TIPS[key] || '' });
        }
    });

    const resSection = createDerivedSection('Starting Resistances', resRows);

    // Add a small note about earned hardening
    const hardenNote = el('div');
    hardenNote.style.cssText = 'font-size: 0.78rem; color: var(--text-muted); font-style: italic; margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px solid rgba(255,255,255,0.04);';
    hardenNote.textContent = 'Physical and magical hardening grow through combat exposure — up to 50% per type.';
    resSection.appendChild(hardenNote);

    section.appendChild(resSection);

    cont.appendChild(section);
}

function createDerivedSection(title, stats) {
    const section = el('div');
    section.style.cssText = 'margin-bottom: 0.9rem; padding: 0.65rem 0.75rem; background: rgba(0,0,0,0.2);';

    const header = el('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem;';
    const titleEl = el('span');
    titleEl.style.cssText = 'font-size: 1.05rem; letter-spacing: 0.1em; color: var(--green); text-transform: uppercase;';
    titleEl.textContent = title;
    header.append(titleEl);
    section.appendChild(header);

    stats.forEach(stat => {
        const row = el('div');
        row.style.cssText = 'display: flex; justify-content: space-between; align-items: baseline; padding: 0.32rem 0; font-size: 0.98rem; border-bottom: 1px solid rgba(255,255,255,0.04);';
        row.setAttribute('data-tooltip', stat.tooltip);

        const lbl = el('span');
        lbl.style.cssText = 'color: var(--text-muted);';
        lbl.textContent = stat.label;

        const val = el('span');
        val.style.cssText = `color: ${stat.valueColor || 'var(--green)'};`;
        val.textContent = stat.value;

        row.append(lbl, val);
        section.appendChild(row);
    });

    return section;
}

// ─── Skills ───────────────────────────────────────────────────────────────────
function buildSkillTooltip(sk, aptFullName) {
    const lines = [];
    lines.push(sk.name.toUpperCase());
    if (sk.description) lines.push(sk.description);
    if (sk.primary_damage_types?.length) lines.push(`Damage types: ${sk.primary_damage_types.join(', ')}`);
    lines.push(`Linked to: ${aptFullName}`);
    const prereq = sk.prerequisite || (sk.prerequisites ? sk.prerequisites.join(', ') : null);
    if (prereq) lines.push(`Requires: ${prereq}`);
    if (sk.level_effects) {
        lines.push('');
        lines.push('── Level effects ──');
        const tiers = [
            ['Novice (1–10)',        sk.level_effects['Novice']],
            ['Seasoned (11–50)',     sk.level_effects['Seasoned']],
            ['Expert (51–80)',       sk.level_effects['Expert']],
            ['Master (81–99)',       sk.level_effects['Master']],
            ['Legendary Master (100)', sk.level_effects['Legendary Master']],
        ];
        tiers.forEach(([label, effect]) => {
            if (effect) lines.push(`${label}: ${effect}`);
        });
    }
    lines.push('');
    lines.push('Skills level through use. Maximum: 100.');
    return lines.join('\n');
}

function buildSkillRows() {
    const grid = $('skills-grid');
    grid.innerHTML = '';
    S.skills.clear();

    const cls           = findClass(S.cls);
    const startingSkills = cls?.starting_skills;
    const fixed         = new Set(startingSkills?.fixed || []);
    const choiceSet     = startingSkills?.choices ? new Set(startingSkills.choices) : null;
    const choiceCount   = startingSkills?.choice_count || 2;

    const infoEl = $('skill-info');
    if (cls) {
        const fixedNames = getAllSkills().filter(sk => fixed.has(sk.id)).map(sk => sk.name).join(', ');
        infoEl.textContent = `Included: ${fixedNames || '—'} · Choose ${choiceCount} additional skill${choiceCount > 1 ? 's' : ''} from the list below.`;
    } else {
        infoEl.textContent = 'Select a class to see available skills.';
    }

    (DB.skills?.categories || []).forEach(cat => {
        const catSkills = cat.skills || [];
        if (!catSkills.length) return;

        const visibleSkills = cls
            ? catSkills.filter(sk => fixed.has(sk.id) || !choiceSet || choiceSet.has(sk.id))
            : catSkills;
        if (!visibleSkills.length) return;

        const aptFullName = aptName(cat.aptitude_link);
        const header = el('div', 'sk-category-header');
        header.textContent = `${cat.category}`;
        const aptLabel = el('span', 'sk-cat-apt'); aptLabel.textContent = aptFullName;
        header.appendChild(aptLabel);
        grid.appendChild(header);

        visibleSkills.forEach(sk => {
            const isFixed = fixed.has(sk.id);

            const row = el('div', `skill-row${isFixed ? ' sk-fixed' : ''}`);
            row.dataset.name = sk.id;

            const check = el('span', 'sk-check'); row.appendChild(check);
            const name  = el('span', 'sk-name');  name.textContent = sk.name; row.appendChild(name);
            if (isFixed) {
                const tag = el('span', 'sk-fixed-tag'); tag.textContent = 'included'; row.appendChild(tag);
            }

            row.dataset.tooltip = buildSkillTooltip(sk, aptFullName);

            row.addEventListener('click', () => {
                if (isFixed) return;
                if (row.classList.contains('sk-on')) {
                    row.classList.remove('sk-on');
                    S.skills.delete(sk.id);
                } else {
                    const nonFixed = [...S.skills].filter(id => !fixed.has(id)).length;
                    if (nonFixed >= choiceCount) { toast(`Max ${choiceCount} choice skills for this class.`); return; }
                    row.classList.add('sk-on');
                    S.skills.add(sk.id);
                }
            });
            grid.appendChild(row);
        });
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
    const cls = findClass(S.cls);
    const h   = $('gold-hint');
    h.textContent = (S.equipment === 'gold' && cls)
        ? `Starting wealth: ${cls.starting_wealth_range ? cls.starting_wealth_range[0] + '–' + cls.starting_wealth_range[1] + ' gp' : 'varies by class'}`
        : '';
}

// ─── Derived stats ────────────────────────────────────────────────────────────
// ─── Wisdom Tier System ───────────────────────────────────────────────────────
const WISDOM_TIERS = [
    { name: 'Novice',        minLevel: 1,  maxLevel: 3,  damage_bonus: 3  },
    { name: 'Intermediate',  minLevel: 4,  maxLevel: 8,  damage_bonus: 8  },
    { name: 'Seasoned',      minLevel: 9,  maxLevel: 15, damage_bonus: 15 },
    { name: 'Expert',        minLevel: 16, maxLevel: 22, damage_bonus: 24 },
    { name: 'Master',        minLevel: 23, maxLevel: 27, damage_bonus: 34 },
    { name: 'Grandmaster',   minLevel: 28, maxLevel: 30, damage_bonus: 45 },
];

function getWisdomTier(level) {
    return WISDOM_TIERS.find(t => level >= t.minLevel && level <= t.maxLevel) || WISDOM_TIERS[0];
}

function getMoralityZone(morality) {
    if (morality >= 66) return 'Conviction';
    if (morality <= 34) return 'Despair';
    return 'Neutral';
}

function getSpellSchoolAccess(morality) {
    const zone = getMoralityZone(morality);
    if (zone === 'Conviction') {
        return { lightwielding: true, materium: false, shadow: false };
    } else if (zone === 'Despair') {
        return { lightwielding: false, materium: false, shadow: true };
    } else {
        return { lightwielding: false, materium: true, shadow: false };
    }
}

function getSpellAccessString(morality) {
    const access = getSpellSchoolAccess(morality);
    const parts = [];
    if (access.lightwielding) parts.push('✓ Lightwielding (Purelight, Solacium, etc.)');
    else parts.push('✗ Lightwielding (Purelight, Solacium, etc.)');

    if (access.materium) parts.push('✓ Materium (Impact, Earthen, Tempest, Fire, Aquas, etc.)');
    else parts.push('✗ Materium (Impact, Earthen, Tempest, Fire, Aquas, etc.)');

    if (access.shadow) parts.push('✓ Shadow Arts (Darkvoid, Chill, Darkmind, etc.)');
    else parts.push('✗ Shadow Arts (Darkvoid, Chill, Darkmind, etc.)');

    return parts.join('\n');
}

function calcInitiative(discipline, morality) {
    // Base initiative from Discipline (0-100)
    let initiative = discipline;

    // Alignment modifiers (alignment bonuses stack on top of discipline)
    const zone = getMoralityZone(morality);
    if (zone === 'Despair') {
        initiative += Math.round((34 - morality) / 10) + 1;  // +1 to +4 for being evil
    } else if (zone === 'Conviction') {
        initiative += Math.round((morality - 66) / 10) + 1;  // +1 to +4 for being good
    }
    // Neutral gets no alignment bonus

    return initiative;
}

// ─── Age-based scaling functions ──────────────────────────────────────────────
function ageStaminaBonus(age) {
    if (age <= 50) {
        return Math.round((age - 15) / 35 * 15); // Linear growth: 0 to +15
    } else if (age <= 60) {
        return 15; // Plateau
    } else {
        return Math.max(-15, Math.round(15 - (age - 60) * 0.75)); // Decline after 60
    }
}

function ageMateriumBonus(age) {
    return Math.min(20, Math.round((age - 15) / 65 * 20)); // +0 to +20, capped at age 80
}

function calcHpRegenPerTurn(physiology, age) {
    // PLACEHOLDER: Turn system not yet implemented
    // In combat: no regen unless healing spell active
    // World map: slow per-turn regen; one sleep = full restore
    const base = Math.max(0.5, physiology * 0.03);
    const agePenalty = age > 50 ? (age - 50) * 0.01 : 0;
    return Math.max(0.1, parseFloat((base - agePenalty).toFixed(2)));
}

function ageAfflictionModifier(age) {
    // % additional susceptibility to afflictions, poisons, venoms
    if (age <= 30) return -5;   // Young: slight resistance
    if (age <= 50) return 0;    // Prime: baseline
    if (age <= 70) return age - 50;  // +1% per year above 50
    return 20 + Math.round((age - 70) * 1.5); // Steep after 70
}

function updateMoralityDisplay() {
    const val = S.morality ?? 50;
    const zone = getMoralityZone(val);
    const pct = val; // 0-100 maps to 0%-100% position
    const thumb = $('morality-thumb');
    if (thumb) thumb.style.left = pct + '%';
}

function rollMoralityForClass(classId) {
    const cls = findClass(classId);
    const [min, max] = cls?.morality_range || [35, 65];
    S.morality = Math.floor(Math.random() * (max - min + 1)) + min;
    updateMoralityDisplay();
}

function updateDerivedStats() {
    syncAptitudesToState();
    const cls  = findClass(S.cls);
    const race = findRace(S.race);

    // Character attributes
    const physVal = S.aptitudes.physiology || BASE_APTITUDE;
    const cogVal  = S.aptitudes.cognition   || BASE_APTITUDE;
    const age     = S.age || 35;
    const raceMat = race?.materium_pool_bonus || 0;

    // Vitality (HP) = Physiology * 1.3 + 8
    const hp      = Math.round(physVal * 1.3 + 8);

    // Stamina pool = Physiology * 1.5 + age modifier
    const stamina = Math.round(physVal * 1.5 + ageStaminaBonus(age));

    // Materium pool = Cognition * 1.2 + age modifier + race bonus
    const materium = Math.round(cogVal * 1.2 + ageMateriumBonus(age) + raceMat);

    // Display derived stats
    if ($('d-hp'))    $('d-hp').textContent = hp;
    if ($('d-hd'))    $('d-hd').textContent = `${materium} MP`;

    // Level display
    if ($('d-prof'))  $('d-prof').textContent = `Lv ${S.level}`;

    // Class trait name
    if ($('d-speed')) $('d-speed').textContent = cls?.special_class_trait?.name || '—';

    // Aptitude focus (replaces saves-row): show class aptitude priorities
    const savesRow = $('saves-row');
    if (savesRow) {
        savesRow.innerHTML = '';
        const priorities = cls?.aptitude_priorities || [];
        if (!priorities.length) {
            const p = el('span', 'save-pill'); p.textContent = '—'; savesRow.appendChild(p);
        } else {
            priorities.slice(0, 3).forEach(ap => {
                const id = ap.toLowerCase().replace(/ /g, '_');
                const p = el('span', 'save-pill');
                p.textContent = aptName(id);
                savesRow.appendChild(p);
            });
        }
    }

    // Identity line
    const raceData  = race;
    const raceName  = raceData ? raceData.name : (S.race ? S.race.replace(/_/g, ' ') : null);
    const clsName   = cls ? cls.name : null;
    const parts = [];
    if (raceName) parts.push(raceName);
    if (clsName)  parts.push(clsName);
    if (S.level > 1) parts.push(`Level ${S.level}`);
    if ($('identity-line')) $('identity-line').textContent = parts.length ? parts.join(' · ') : 'Choose race & class';

    buildDerivedStatsDisplay();
}

// ─── Flavor text ─────────────────────────────────────────────────────────────
function updateFlavorText() {
    const ft = $('flavor-text');
    if (!S.race && !S.cls) {
        ft.innerHTML = 'Select a race and class to reveal the lore of your hero...';
        return;
    }
    const raceData = findRace(S.race);
    const raceName = raceData ? raceData.name : (S.race ? S.race.replace(/_/g, ' ') : '');
    const clsData  = findClass(S.cls);
    const clsName  = clsData ? clsData.name : (S.cls ? S.cls : '');

    const ownName    = raceData?.own_name || null;
    const ownMeaning = raceData?.own_name_meaning || null;
    const ownPrefix  = ownName ? ` Known among themselves as the <em>${ownName}</em>${ownMeaning ? ` — "${ownMeaning}"` : ''}.` : '';
    const raceBlurb  = S.race ? (RACE_BLURBS[S.race]  || (raceData?.description) || `The ${raceName} are a proud and storied people.`) : '';
    const classBlurb = S.cls  ? (CLASS_BLURBS[S.cls]  || (clsData?.description)  || `The ${clsName} follows a path of power and purpose.`) : '';

    const clsCol = classColor(clsData?.class_group);
    let html = '';
    if (S.race) html += `<strong>${raceName}.</strong> ${raceBlurb}${ownPrefix}`;
    if (S.race && S.cls) html += '<br><br>';
    if (S.cls)  html += `<strong style="color:${clsCol}">${clsName}.</strong> ${classBlurb}`;
    ft.innerHTML = html;
}

// ─── Background detail ────────────────────────────────────────────────────────
function makeBgBullet(label, value, valClass) {
    const row  = el('div', 'bg-bullet');
    const dot  = el('span', 'bg-bullet-dot');  dot.textContent  = '✦';
    const lbl  = el('span', 'bg-bullet-label'); lbl.textContent = label;
    const val  = el('span', `bg-bullet-val${valClass ? ' ' + valClass : ''}`); val.textContent = value;
    row.append(dot, lbl, val);
    return row;
}

function makeBgSection(title) {
    const h = el('div', 'bg-section-title');
    h.textContent = title;
    return h;
}

function updateBgDetail(bg) {
    const d = $('bg-detail-text');
    d.innerHTML = '';
    if (!bg) {
        d.textContent = 'Select a background to see its perks.';
        return;
    }

    // Background name heading
    const bgName = el('div', 'bg-detail-name');
    bgName.textContent = bg.name || 'Unknown Background';
    d.appendChild(bgName);

    // Flavor quote
    if (bg.flavor_trait) {
        const q = el('div', 'bg-flavor-quote');
        q.textContent = `"${bg.flavor_trait}"`;
        d.appendChild(q);
    }

    // Aptitude modifiers
    const aptMods = bg.aptitude_modifier ? Object.entries(bg.aptitude_modifier).filter(([, v]) => v !== 0) : [];
    if (aptMods.length) {
        d.appendChild(makeBgSection('Aptitude Effects'));
        aptMods.forEach(([k, v]) => {
            const sign = v > 0 ? '+' : '';
            d.appendChild(makeBgBullet(aptName(k), `${sign}${v}`, v > 0 ? 'pos' : 'neg'));
        });
    }

    // Skill bonuses
    if (bg.starting_skill_bonuses) {
        const allSk = getAllSkills();
        const entries = Object.entries(bg.starting_skill_bonuses).filter(([, v]) => v !== 0);
        if (entries.length) {
            d.appendChild(makeBgSection('Skill Bonuses'));
            entries.forEach(([id, v]) => {
                const sk = allSk.find(s => s.id === id);
                const sign = v > 0 ? '+' : '';
                const bullet = makeBgBullet(sk ? sk.name : id, `${sign}${v}`, v > 0 ? 'pos' : 'neg');
                const tier = v <= 0 ? 'Untrained' : v <= 10 ? 'Novice' : v <= 50 ? 'Seasoned' : v <= 80 ? 'Expert' : v <= 99 ? 'Master' : 'Legendary Master';
                const skName = sk ? sk.name : id;
                bullet.setAttribute('data-tooltip',
                    `${sign}${v} to your starting ${skName} level (${tier} tier).\n` +
                    `Skills scale from 0 to 100 and level through use in relevant situations.\n` +
                    `Backgrounds can grant up to +15 to a skill — the head start matters most early on.`
                );
                d.appendChild(bullet);
            });
        }
    }

    // Wealth
    if (bg.starting_wealth_modifier) {
        d.appendChild(makeBgSection('Starting Wealth'));
        const wv = bg.starting_wealth_modifier;
        const isNum = typeof wv === 'number';
        d.appendChild(makeBgBullet('Gold modifier', isNum ? `${wv > 0 ? '+' : ''}${wv} crowns` : String(wv), isNum && wv > 0 ? 'pos' : isNum && wv < 0 ? 'neg' : ''));
    }

    // Equipment bonus
    if (bg.equipment_bonus?.length) {
        d.appendChild(makeBgSection('Starting Gear'));
        bg.equipment_bonus.forEach(item => {
            d.appendChild(makeBgBullet('', item, ''));
        });
    }
}

// ─── Inventory ────────────────────────────────────────────────────────────────
function updateInventory() {
    const list = $('inventory-list');
    list.innerHTML = '';
    const cls = findClass(S.cls);
    const items = cls?.starter_kit || null;
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

// ─── Inventory paperdoll (shared by creator tab and character sheet) ──────────

const QUALITY_COLORS = {
    simple:  '#999999',
    normal:  '#d4c89a',
    fine:    '#88dd88',
    rare:    '#88aaff',
    magical: '#cc88ff',
    unique:  '#ffdd44',
    cursed:  '#ff5533',
};

function classifyKitItem(text) {
    const t = text.toLowerCase();
    if (/\b(helmet|helm|cap|hood|coif|crown|headband)\b/.test(t))                                       return 'helm';
    if (/\b(shield)\b/.test(t))                                                                          return 'offhand';
    if (/\b(hauberk|armou?r|robe|gambeson|coat|cuirass|chainmail|chain mail|plate|leather vest|tunic|jerkin|mail|breastplate)\b/.test(t)) return 'armor';
    if (/\b(amulet|necklace|pendant|talisman|medallion)\b/.test(t))                                     return 'amulet';
    if (/\b(ring)\b/.test(t))                                                                            return 'ring';
    if (/\b(sword|dagger|stiletto|axe|mace|spear|bow|hammer|staff|knife|blade|flail|quarterstaff|glaive|halberd|pike|lance|club|saber|cutlass|rapier|scythe|trident|crossbow|shortbow|longbow|arbalest|javelin|warhammer|waraxe)\b/.test(t)) return 'weapon';
    return 'bag';
}

function isTwoHandedItem(text) {
    const t = text.toLowerCase();
    return /\b(two.?handed|2h|greatsword|greataxe|great sword|great axe|halberd|pike|polearm|longbow|arbalest|longspear|quarterstaff)\b/.test(t);
}

function lookupWeaponData(text) {
    const all = [
        ...(DB.weapons_1h?.weapons  || []),
        ...(DB.weapons_2h?.weapons  || []),
        ...(DB.weapons_ranged?.weapons || []),
    ];
    const t = text.toLowerCase();
    return all.find(w => t.includes(w.name.toLowerCase())) || null;
}

function buildItemTooltip(text) {
    const wpn = lookupWeaponData(text);
    if (!wpn) return text;
    const parts = [text];
    if (wpn.base_dmg_range) {
        const dmg  = `${wpn.base_dmg_range[0]}–${wpn.base_dmg_range[1]} dmg`;
        const dist = (wpn.damage_distribution || []).map(d => `${d.type} ${d.percent}%`).join(', ');
        parts.push(dist ? `${dmg}  (${dist})` : dmg);
    }
    if (wpn.primary_stat) parts.push(`Scales: ${wpn.primary_stat}`);
    if (wpn.reach_hex)    parts.push(`Reach: ${wpn.reach_hex} hex`);
    if (wpn.flavor)       { parts.push(''); parts.push(wpn.flavor); }
    return parts.join('\n');
}

// Generic paperdoll renderer.  prefix = 'inv' (creator tab) | 'invs' (sheet).
function renderInventoryPaperdoll(prefix, items) {
    const SLOT_IDS = ['helm', 'mainhand', 'offhand', 'armor', 'ring1', 'ring2', 'amulet'];

    SLOT_IDS.forEach(sid => {
        const slotEl = $(`${prefix}-slot-${sid}`);
        if (!slotEl) return;
        const itemEl    = slotEl.querySelector('.inv-slot-item');
        const tooltipEl = slotEl.querySelector('.inv-tooltip');
        itemEl.textContent = '— empty —';
        itemEl.style.color = '';
        slotEl.classList.remove('filled', 'twohanded-grip');
        if (tooltipEl) tooltipEl.textContent = '';
    });

    const bagGrid = $(`${prefix}-bag-grid`);
    if (bagGrid) bagGrid.innerHTML = '';

    if (!items.length) {
        if (bagGrid) { const s = el('span', 'inv-empty'); s.textContent = 'No equipment data.'; bagGrid.appendChild(s); }
        return;
    }

    const slots = { helm: null, armor: null, mainhand: null, offhand: null, amulet: null, ring1: null, ring2: null };
    const bagItems = [];
    let twoHanded = false;

    items.forEach(item => {
        const type = classifyKitItem(item);
        switch (type) {
            case 'helm':    if (!slots.helm)   { slots.helm   = item; } else bagItems.push(item); break;
            case 'armor':   if (!slots.armor)  { slots.armor  = item; } else bagItems.push(item); break;
            case 'offhand': if (!slots.offhand && !twoHanded) { slots.offhand = item; } else bagItems.push(item); break;
            case 'amulet':  if (!slots.amulet) { slots.amulet = item; } else bagItems.push(item); break;
            case 'ring':
                if (!slots.ring1)      slots.ring1 = item;
                else if (!slots.ring2) slots.ring2 = item;
                else bagItems.push(item);
                break;
            case 'weapon':
                if (isTwoHandedItem(item)) {
                    slots.mainhand = item; twoHanded = true;
                } else if (!slots.mainhand) {
                    slots.mainhand = item;
                } else if (!slots.offhand && !twoHanded) {
                    slots.offhand = item;
                } else {
                    bagItems.push(item);
                }
                break;
            default: bagItems.push(item);
        }
    });

    // Fill equipped slots
    SLOT_IDS.forEach(sid => {
        const text = slots[sid];
        if (!text) return;
        const slotEl = $(`${prefix}-slot-${sid}`);
        if (!slotEl) return;
        const itemEl    = slotEl.querySelector('.inv-slot-item');
        const tooltipEl = slotEl.querySelector('.inv-tooltip');
        itemEl.textContent = text;
        itemEl.style.color = QUALITY_COLORS.normal;
        slotEl.classList.add('filled');
        if (tooltipEl) tooltipEl.textContent = buildItemTooltip(text);
    });

    // 2H grip marker
    if (twoHanded && !slots.offhand) {
        const offEl = $(`${prefix}-slot-offhand`);
        if (offEl) {
            offEl.querySelector('.inv-slot-item').textContent = '⟵ 2H grip';
            offEl.querySelector('.inv-slot-item').style.color = 'var(--text-muted)';
            offEl.classList.add('twohanded-grip');
        }
    }

    // Fill bag
    if (!bagGrid) return;
    if (bagItems.length === 0) {
        const s = el('span', 'inv-empty'); s.textContent = '— none —'; bagGrid.appendChild(s);
    } else {
        bagItems.forEach(item => {
            const div  = el('div', 'inv-bag-item');
            const span = el('span');
            span.textContent = item;
            span.style.color = QUALITY_COLORS.normal;
            div.appendChild(span);
            const tip = buildItemTooltip(item);
            if (tip !== item) {
                const tt = el('div', 'inv-tooltip');
                tt.textContent = tip;
                div.appendChild(tt);
            }
            bagGrid.appendChild(div);
        });
    }
}

function gatherKitItems(char) {
    const cls = findClass(char.cls);
    const items = [...(cls?.starter_kit || [])];
    const bg = findBackground(char.background);
    if (bg?.equipment_bonus?.length) bg.equipment_bonus.forEach(i => items.push(i));
    return items;
}

function renderInventoryTab() {
    const items = gatherKitItems({ cls: S.cls, background: S.background });
    if (!items.length) {
        const bagGrid = $('inv-bag-grid');
        if (bagGrid) { bagGrid.innerHTML = ''; const s = el('span', 'inv-empty'); s.textContent = 'Select a class to see equipment.'; bagGrid.appendChild(s); }
        return;
    }
    renderInventoryPaperdoll('inv', items);
}

// ─── Inventory sheet (character sheet sub-page) ───────────────────────────────
function showInvSheet() {
    const char = S.viewSheetChar;
    if (!char) return;
    const titleEl = $('inv-sheet-title');
    if (titleEl) titleEl.textContent = `${char.name || 'Hero'} — Inventory`;
    renderInventoryPaperdoll('invs', gatherKitItems(char));
    $('view-sheet').classList.remove('active');
    $('inv-sheet').classList.add('active');
}

function hideInvSheet() {
    $('inv-sheet').classList.remove('active');
    $('view-sheet').classList.add('active');
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
        img.src = member?.portrait || 'assets/images/characterportraits/ashenfemale.jpg';
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
        if (!S.party || !S.party.members.length) { toast('No members in the current party.'); return; }
        showPartySheet(S.party);
    });
    const addPartyBtn = $('btn-add-party');
    if (addPartyBtn) {
        addPartyBtn.addEventListener('click', () => {
            if (!S.race && !S.cls && !S.name.trim()) { toast('Build a character first.'); return; }
            if (S.party.members.length >= S.party.size) { toast(`Party is full (${S.party.size} members).`); return; }
            const char = buildCharObj();
            S.party.members.push(char);
            renderPartySlots();
            toast(`${char.name || 'Character'} added to party.`);
        });
    }
    $('btn-save-party').addEventListener('click', saveParty);
    $('btn-load-party').addEventListener('click', () => toast('Select a saved party from the right panel.'));
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function showTab(tabName) {
    const idx = TAB_ORDER.indexOf(tabName);
    if (idx >= 0) goToTabIdx(idx);
}

function wireTabs() {
    document.querySelectorAll('.cc-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.cc-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            $(`tab-${tab.dataset.tab}`).classList.add('active');
            updateTabNav();
            if (tab.dataset.tab === 'inventory') renderInventoryTab();
        });
    });
}

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
    if (name === 'inventory') renderInventoryTab();
}

function updateTabNav(idx) {
    if (idx === undefined) idx = currentTabIdx();
    if (idx < 0) idx = 0;
    const prev = $('btn-tab-prev');
    const next = $('btn-tab-next');
    if (!prev) return;
    prev.disabled = idx <= 0;
    next.disabled = idx >= TAB_ORDER.length - 1;
}

function wireTabNav() {
    const prev = $('btn-tab-prev');
    const next = $('btn-tab-next');
    if (!prev || !next) return;
    prev.addEventListener('click', () => { const idx = currentTabIdx(); if (idx > 0) goToTabIdx(idx - 1); });
    next.addEventListener('click', () => {
        const idx = currentTabIdx();
        // Block leaving identity tab without a name
        if (idx === 0 && !S.name.trim()) {
            const warn  = $('name-required-warning');
            const input = $('char-name');
            if (warn)  { warn.classList.add('visible'); }
            if (input) {
                input.classList.remove('shake');
                // Force reflow so the animation restarts if already shaking
                void input.offsetWidth;
                input.classList.add('shake');
                input.focus();
                input.addEventListener('animationend', () => input.classList.remove('shake'), { once: true });
            }
            return;
        }
        if (idx < TAB_ORDER.length - 1) goToTabIdx(idx + 1);
    });
    updateTabNav(0);
}

// ─── View sheet ───────────────────────────────────────────────────────────────
function showViewSheet(char, origin = 'create') {
    S.viewSheetChar   = char;
    S.viewSheetOrigin = origin;
    const raceData = findRace(char.race);
    const raceName = raceData ? raceData.name : (char.race ? char.race.replace(/_/g, ' ') : null);
    const clsData  = findClass(char.cls);
    const clsName  = clsData ? clsData.name : char.cls;
    const portraitSrc = char.portrait || $('char-portrait-img')?.getAttribute('src') || 'assets/images/characterportraits/ashenfemale.jpg';

    const bgData    = findBackground(char.background);
    const signData  = findSign(char.birthSign);
    const bgName    = bgData?.name   || (char.background   ? char.background.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) : '—');
    const signName  = signData?.name || (char.birthSign    ? char.birthSign.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())   : 'No Sign (Childless)');

    $('vs-name').textContent       = char.name || 'Unnamed Hero';
    // vs-sub: colour the class name segment
    const vsSub = $('vs-sub');
    vsSub.innerHTML = '';
    [`Level ${char.level}`, raceName, signName !== 'No Sign (Childless)' ? signName : null].filter(Boolean).forEach((part, i, arr) => {
        vsSub.appendChild(document.createTextNode((i === 0 ? '' : ' · ') + part));
    });
    if (clsName) { vsSub.appendChild(document.createTextNode(' · ')); vsSub.appendChild(clsSpan(clsName, clsData?.class_group)); }
    $('vs-race').textContent       = raceName  || '—';
    $('vs-gender').textContent     = char.gender || '—';
    // vs-class with colour
    const vsClassEl = $('vs-class');
    vsClassEl.textContent = '';
    vsClassEl.appendChild(clsSpan(clsName || '—', clsData?.class_group));
    $('vs-background').textContent = bgName;
    $('vs-alignment').textContent  = signName;
    if ($('vs-age')) {
        const charAge = char.age || 35;
        $('vs-age').textContent = charAge;
        const ageTip = `Natural Age: ${charAge}\nAffects:\n  • Stamina pool: peaks at age 50, declines after 60\n  • Materium pool: increases until age 80\n  • HP Regeneration: slows by ~1% per year after 50\n  • Affliction susceptibility: increases with age (young get -5%, elderly get +30%+)`;
        $('vs-age').setAttribute('data-tooltip', ageTip);
    }

    // Tooltips for identity rows
    const setRowTip = (spanId, text) => {
        const span = $(spanId);
        const row = span?.parentElement;
        if (!row) return;
        if (text) {
            row.dataset.tooltip = text;
            row.style.cursor = 'help';
            span.setAttribute('data-tooltip', text);
        }
        else      {
            delete row.dataset.tooltip;
            row.style.cursor = '';
            span.removeAttribute('data-tooltip');
        }
    };
    setRowTip('vs-race',       raceData ? `${raceData.name}\n${raceData.description || ''}` : null);
    setRowTip('vs-gender',     null);
    setRowTip('vs-class',      clsData  ? `${clsData.name} — ${clsData.archetype}\n${clsData.description}` : null);
    setRowTip('vs-background', bgData   ? `${bgData.name}\n${bgData.description}\n\n"${bgData.flavor_trait}"` : null);
    setRowTip('vs-alignment',  signData ? `${signData.name} (${signData.alignment})\n${signData.description}\n\nPerk — ${signData.perk.name}: ${signData.perk.effect}\nConflict — ${signData.conflict.name}: ${signData.conflict.effect}` : null);
    setRowTip('vs-level',      `Maximum level: ${MAX_LEVEL}`);
    $('vs-level').textContent      = `${char.level || 1} / ${MAX_LEVEL}`;
    const vsPortrait = $('vs-portrait-img');
    if (vsPortrait) {
        vsPortrait.src = portraitSrc;
        vsPortrait.alt = `${char.name || 'Character'} portrait`;
    }

    // Personality
    const pData = findPersonality(char.personality);
    if ($('vs-personality')) {
        if (pData) {
            const pLabel = pData.components
                ? `${pData.name} (${pData.components.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' + ')})`
                : pData.name;
            $('vs-personality').textContent = pLabel;
            $('vs-personality').style.color = personalityAlignColor(pData.alignment);
            const pTip = `${pData.name}\n${pData.description}\n\n` +
                pData.effects.map(e => `• ${e}`).join('\n') +
                (pData.morality_adjust
                    ? `\n\nMorality: ${pData.morality_adjust > 0 ? '+' : ''}${pData.morality_adjust} (${pData.morality_adjust > 0 ? 'towards Conviction' : 'towards Despair'})`
                    : '');
            $('vs-personality').setAttribute('data-tooltip', pTip);
        } else {
            $('vs-personality').textContent = '—';
            $('vs-personality').style.color = '';
            $('vs-personality').removeAttribute('data-tooltip');
        }
    }

    const allSk = getAllSkills();
    const skillsEl = $('vs-skills');
    skillsEl.innerHTML = '';
    if (char.skills && char.skills.length) {
        char.skills.forEach(id => {
            const skill = allSk.find(s => s.id === id);
            const name = skill?.name || id;
            const desc = skill?.description || '';
            const span = el('span', 'vs-skill-item');
            span.textContent = name;
            if (desc) span.setAttribute('data-tooltip', desc);
            skillsEl.appendChild(span);
        });
    } else {
        skillsEl.textContent = '—';
    }

    // Update left panel derived stats
    const physVal = ((char.aptitudes || {}).physiology) || BASE_APTITUDE;
    const cogVal = ((char.aptitudes || {}).cognition) || BASE_APTITUDE;
    const disciplineVal = ((char.aptitudes || {}).discipline) || BASE_APTITUDE;
    const age = char.age || 35;
    const morality = char.morality ?? 50;
    const raceMat = raceData?.materium_pool_bonus || 0;

    // Calculate resource pools using formulas
    const vitality = Math.round(physVal * 1.3 + 8);
    const stamina = Math.round(physVal * 1.5 + ageStaminaBonus(age));
    const materium = Math.round(cogVal * 1.2 + ageMateriumBonus(age) + raceMat);
    const hpRegen = calcHpRegenPerTurn(physVal, age);
    const afflictionMod = ageAfflictionModifier(age);
    const afflictionStr = afflictionMod === 0 ? 'Baseline' : (afflictionMod > 0 ? `+${afflictionMod}%` : `${afflictionMod}%`);

    const materiumPool = String(materium);
    const staminaPool = String(stamina);
    const classTrait   = clsData?.special_class_trait?.name || '—';
    const classTraitDesc = clsData?.special_class_trait?.description || '';
    const focusPriorities = (clsData?.aptitude_priorities || []).slice(0, 3);
    const focusText = focusPriorities.join('\n') || '—';
    const focusTooltips = {};
    focusPriorities.forEach(strength => {
        focusTooltips[strength] = APTITUDE_DESC[strength] || APTITUDE_DESC[strength.toLowerCase().replace(/ /g, '_')] || '';
    });

    if ($('d-hp'))           $('d-hp').textContent    = vitality;
    if ($('d-hd'))           $('d-hd').textContent    = materiumPool;
    if ($('d-prof'))         $('d-prof').textContent  = `Level ${char.level}`;
    if ($('d-speed'))        $('d-speed').textContent = classTrait;
    if ($('identity-line'))  $('identity-line').textContent = [raceName, char.subclass || clsName].filter(Boolean).join(' · ') || 'Choose race & class';
    if ($('vs-vitality')) {
        $('vs-vitality').textContent = vitality;
        $('vs-vitality').setAttribute('data-tooltip', 'Your health pool. When this reaches 0, you are defeated. Can be drained from using Blood Magic.');
    }
    if ($('vs-stamina')) {
        $('vs-stamina').textContent = staminaPool;
        const stamTip = `Stamina Pool: ${stamina}\nDerived from: Physiology (${physVal}) × 1.5 + Age (${age}) modifier\nPowers martial attacks, dodge rolls, movement, and physical exertion.`;
        $('vs-stamina').setAttribute('data-tooltip', stamTip);
    }
    if ($('vs-mpool')) {
        $('vs-mpool').textContent = materiumPool;
        const matTip = `Materium Pool: ${materium}\nDerived from: Cognition (${cogVal}) × 1.2 + Age (${age}) modifier + Race bonus (${raceMat})\nPowers spells from the schools of Materium.`;
        $('vs-mpool').setAttribute('data-tooltip', matTip);
    }

    // Resource-use badges — inject/replace after each value span
    const usage = classResourceUsage(clsData);
    const schoolList = (clsData?.materium_schools_available || []).join(', ') || 'various schools';
    _setResBadge('vs-vitality', usage.hp,
        'res-hp', '⬥ HP',
        `${clsData?.name || 'This class'} expends Vitality as fuel for blood magic.\nCasting certain spells drains your own life force directly.\nSchools: ${(clsData?.materium_schools_available || []).filter(s => ['Blood Magic','Darkblood','Bloodpassion','Siphoning'].some(k => s.includes(k))).join(', ')}`);
    _setResBadge('vs-stamina', usage.stamina,
        'res-st', '⚔ STA',
        `${clsData?.name || 'This class'} spends Stamina on martial abilities and combat manoeuvres.\nRecovers fully on Long Rest, partially on Short Rest.`);
    _setResBadge('vs-mpool', usage.materium,
        'res-mp', '✦ MP',
        `${clsData?.name || 'This class'} casts spells by spending Materium.\nSchools: ${schoolList}\nRecovers over time and on rest.`);

    if ($('vs-hp-regen')) {
        $('vs-hp-regen').textContent = hpRegen.toFixed(2) + '/turn';
        $('vs-hp-regen').setAttribute('data-tooltip', 'HP regenerated per turn on world map (not in combat). Reduced by age penalty after age 50.');
    }
    if ($('vs-affliction-mod')) {
        $('vs-affliction-mod').textContent = afflictionStr;
        $('vs-affliction-mod').setAttribute('data-tooltip', `Age ${age}: ${afflictionMod === 0 ? 'normal' : afflictionMod > 0 ? 'increased' : 'decreased'} susceptibility to afflictions, poisons, and venoms.`);
    }

    // Populate aptitudes in left column
    if ($('vs-apt-physiology')) {
        $('vs-apt-physiology').textContent = physVal;
        const physTip = `PHYSIOLOGY (${physVal})\n\nGoverns: Vitality (Health) & Stamina\n\nYour physical strength and endurance. Higher Physiology means more HP to survive damage and more Stamina to perform physical attacks and actions.`;
        $('vs-apt-physiology').setAttribute('data-tooltip', physTip);
    }
    if ($('vs-apt-cognition')) {
        $('vs-apt-cognition').textContent = cogVal;
        const cogTip = `COGNITION (${cogVal})\n\nGoverns: Materium Pool\n\nYour mental acuity and magical understanding. Higher Cognition means more Materium (spell power) for casting elemental spells.`;
        $('vs-apt-cognition').setAttribute('data-tooltip', cogTip);
    }
    if ($('vs-apt-discipline')) {
        $('vs-apt-discipline').textContent = disciplineVal;
        const disTip = `DISCIPLINE (${disciplineVal})\n\nGoverns: Initiative\n\nYour willpower and focus. Higher Discipline means you act sooner in combat — your turn comes earlier in the round, letting you strike or cast before enemies.`;
        $('vs-apt-discipline').setAttribute('data-tooltip', disTip);
    }

    // Morality slider
    if ($('morality-thumb')) {
        const moralityThumb = $('morality-thumb');
        moralityThumb.style.left = morality + '%';
        const zone = getMoralityZone(morality);
        const schoolAccess = zone === 'Conviction' ? 'Lightwielding' :
                             zone === 'Neutral' ? 'Materium (Elemental)' :
                             'Shadow Arts';
        const thumbTip = `${zone} (${morality})\nSchool: ${schoolAccess}\n\nDrag left for Despair • Center for Neutral • Right for Conviction`;
        moralityThumb.setAttribute('data-tooltip', thumbTip);
        moralityThumb.addEventListener('mouseenter', e => showTip(e, thumbTip));
        moralityThumb.addEventListener('mouseleave', hideTip);
    }
    // Morality track tooltip
    if ($('morality-track-outer')) {
        const trackTip = 'MORALITY SCALE — Three Alignments\n\n' +
            '◀ DESPAIR (0–34)    NEUTRAL (35–65)    CONVICTION (66+) ▶\n\n' +
            'Shadow Arts access: Despair zone (0–34)\n' +
            'Materium access: Neutral zone (35–65) — elemental spells\n' +
            'Lightwielding access: Conviction zone (66–100)\n\n' +
            'Golden marks at 35% and 65% show zone boundaries.\n' +
            'Each alignment has unique spells and powers.';
        const track = $('morality-track-outer');
        track.setAttribute('data-tooltip', trackTip);
        track.style.cursor = 'help';
        track.addEventListener('mouseenter', e => showTip(e, trackTip));
        track.addEventListener('mouseleave', hideTip);
    }

    // Zone label tooltips
    const despairLabel = $('zone-despair');
    if (despairLabel) {
        const despairTip = 'DESPAIR (0–34) — Evil Alignment\n\n' +
            'Aligned with shadow, malevolence, and dark power.\n\n' +
            'SPELL ACCESS:\n' +
            '✓ Shadow Arts (Darkvoid, Chill, Darkmind, Blight, etc.)\n' +
            '✗ Materium (Elemental spells)\n' +
            '✗ Lightwielding (Holy spells)\n\n' +
            'INITIATIVE BONUS: +1 to +4 for staying evil\n\n' +
            'Your character is driven by selfish goals and dark ambitions.\n' +
            'Maintain evil actions to keep this alignment.';
        despairLabel.setAttribute('data-tooltip', despairTip);
        despairLabel.addEventListener('mouseenter', e => showTip(e, despairTip));
        despairLabel.addEventListener('mouseleave', hideTip);
    }

    const neutralLabel = $('zone-neutral');
    if (neutralLabel) {
        const neutralTip = 'NEUTRAL (35–65) — Primal Alignment\n\n' +
            'You embrace raw elemental force without moral judgment.\n' +
            'A path of balance, pragmatism, and natural power.\n\n' +
            'SPELL ACCESS:\n' +
            '✓ Materium (Impact, Earthen, Tempest, Fire, Aquas, Athropium, Temporal)\n' +
            '✗ Shadow Arts (Dark magic)\n' +
            '✗ Lightwielding (Holy magic)\n\n' +
            'INITIATIVE BONUS: None (balanced approach)\n\n' +
            'Neutral spellcasters are versatile and independent,\n' +
            'neither bound by good nor evil doctrines.';
        neutralLabel.setAttribute('data-tooltip', neutralTip);
        neutralLabel.addEventListener('mouseenter', e => showTip(e, neutralTip));
        neutralLabel.addEventListener('mouseleave', hideTip);
    }

    const convictionLabel = $('zone-conviction');
    if (convictionLabel) {
        const convictionTip = 'CONVICTION (66–100) — Good Alignment\n\n' +
            'Aligned with light, benevolence, and divine magic.\n' +
            'Driven by ideals of justice, compassion, and righteousness.\n\n' +
            'SPELL ACCESS:\n' +
            '✓ Lightwielding (Purelight, Solacium, Aegis Reflection, Verdicium, etc.)\n' +
            '✗ Materium (Elemental spells)\n' +
            '✗ Shadow Arts (Dark magic)\n\n' +
            'INITIATIVE BONUS: +1 to +4 for staying good\n\n' +
            'Your character is noble and heroic, guided by faith.\n' +
            'Maintain righteous actions to keep this alignment.';
        convictionLabel.setAttribute('data-tooltip', convictionTip);
        convictionLabel.addEventListener('mouseenter', e => showTip(e, convictionTip));
        convictionLabel.addEventListener('mouseleave', hideTip);
    }

    // Detailed morality tooltip
    const moralityLbl = $('morality-lbl');
    if (moralityLbl) {
        const zone = getMoralityZone(morality);
        const zoneDesc =
            zone === 'Conviction' ? 'Conviction (Good/Light)\nYou are aligned with light, benevolence, and divine magic.' :
            zone === 'Despair' ? 'Despair (Evil/Shadow)\nYou are aligned with shadow, malevolence, and dark power.' :
            'Neutral (Primal Force)\nYou embrace raw elemental power without moral judgment.';

        const spellAccess = getSpellAccessString(morality);
        const initiativeValue = calcInitiative(disciplineVal, morality);
        const alignmentBonus = zone === 'Neutral' ? 0 :
            zone === 'Despair' ? Math.round((34 - morality) / 10) + 1 :
            Math.round((morality - 66) / 10) + 1;

        const tooltipText =
            'MORALITY — Three Alignments\n\n' +
            `Current Zone: ${zoneDesc}\n\n` +
            `Morality Value: ${morality}/100\n` +
            '0–34 = Despair (Evil), 35–65 = Neutral (Primal), 66–100 = Conviction (Good)\n\n' +
            'SPELL SCHOOL ACCESS:\n' +
            spellAccess + '\n\n' +
            'INITIATIVE:\n' +
            `Base (Discipline): ${disciplineVal} | Alignment Bonus: +${alignmentBonus} | Total: ${initiativeValue}\n\n` +
            'THREE ALIGNMENTS:\n' +
            '• CONVICTION (66+): Lightwielding spells only, +initiative bonus for staying good\n' +
            '• NEUTRAL (35–65): Materium spells only, no alignment bonus\n' +
            '• DESPAIR (0–34): Shadow Arts spells only, +initiative bonus for staying evil\n\n' +
            'HOW INITIATIVE WORKS:\n' +
            '• Base initiative is set by your Discipline trait (0–100)\n' +
            '• Conviction and Despair alignments add bonus on top of Discipline\n' +
            '• Neutral alignment grants no additional initiative bonus\n' +
            'HOW MORALITY WORKS:\n' +
            '• Your morality shifts slowly through actions and choices\n' +
            '• Each alignment grants access to unique spell schools\n' +
            '• Straying from your alignment weakens your access to those spells\n' +
            '• Your class has a natural morality range (e.g., Cleric 66–85, Necromancer 10–34)\n' +
            '• The three paths are equally powerful—choose the one that fits your character';

        moralityLbl.setAttribute('data-tooltip', tooltipText);
        moralityLbl.addEventListener('mouseenter', e => showTip(e, tooltipText));
        moralityLbl.addEventListener('mouseleave', hideTip);
    }
    if ($('vs-focus')) {
        $('vs-focus').innerHTML = '';
        focusPriorities.forEach((strength, idx) => {
            const strengthSpan = el('span', 'focus-strength');
            strengthSpan.textContent = strength;
            const desc = focusTooltips[strength];
            if (desc) {
                strengthSpan.setAttribute('data-tooltip', desc);
                strengthSpan.addEventListener('mouseenter', e => showTip(e, desc));
                strengthSpan.addEventListener('mouseleave', hideTip);
            }
            $('vs-focus').appendChild(strengthSpan);
            if (idx < focusPriorities.length - 1) {
                $('vs-focus').appendChild(document.createTextNode(', '));
            }
        });
    }
    if ($('vs-trait')) {
        $('vs-trait').textContent = classTrait;
        if (classTrait !== '—') $('vs-trait').setAttribute('data-tooltip', classTraitDesc);
    }
    if ($('vs-trait-desc')) {
        $('vs-trait-desc').textContent = classTraitDesc;
    }

    // Abilities & Spells section
    const ablContent = $('vs-abilities-content');
    if (ablContent) ablContent.innerHTML = renderAbilitiesHTML(char.cls, char.level || 1);

    // Wisdom block (experience tiers)
    const wisdomBlock = $('vs-wisdom-block');
    if (wisdomBlock) {
        wisdomBlock.innerHTML = '';
        const tier = getWisdomTier(char.level || 1);
        const clsGroup = clsData?.class_group || '';
        const hasMartial = ['Warrior', 'Ranger', 'Rogue'].includes(clsGroup);
        const hasMagical = ['Cleric', 'Mage', 'Sorcerer', 'Druid', 'Warlock', 'Witch', 'Necromancer'].includes(clsGroup);

        if (hasMartial) {
            const martRow = el('div', 'wisdom-row');
            const martLbl = el('span', 'wisdom-type-lbl');
            martLbl.textContent = 'Martial Experience';
            const martDisp = el('span', 'wisdom-tier-display');
            martDisp.textContent = `${tier.name} ${clsData?.name || clsName || 'Character'}`;
            martDisp.setAttribute('data-tooltip', `Martial Experience: ${tier.name}\nDamage bonus: +${tier.damage_bonus}% to all physical attacks.\nLevel ${char.level}: ${tier.minLevel}–${tier.maxLevel} = ${tier.name}`);
            martDisp.style.cursor = 'help';
            martRow.append(martLbl, martDisp);
            wisdomBlock.appendChild(martRow);
        }

        if (hasMagical) {
            const magRow = el('div', 'wisdom-row');
            const magLbl = el('span', 'wisdom-type-lbl');
            magLbl.textContent = 'Materium Insights';
            const magDisp = el('span', 'wisdom-tier-display');
            magDisp.textContent = `${tier.name} ${clsData?.name || clsName || 'Character'}`;
            magDisp.setAttribute('data-tooltip', `Materium Insights: ${tier.name}\nDamage bonus: +${tier.damage_bonus}% to all magical attacks.\nLevel ${char.level}: ${tier.minLevel}–${tier.maxLevel} = ${tier.name}`);
            magDisp.style.cursor = 'help';
            magRow.append(magLbl, magDisp);
            wisdomBlock.appendChild(magRow);
        }

        if (!hasMartial && !hasMagical) {
            const balRow = el('div', 'wisdom-row');
            const balDisp = el('span', 'wisdom-tier-display');
            balDisp.textContent = `${tier.name} ${clsData?.name || clsName || 'Character'}`;
            balDisp.setAttribute('data-tooltip', `Experience Tier: ${tier.name}\nAll-purpose experience bonus: +${tier.damage_bonus}% effectiveness.\nLevel ${char.level}: ${tier.minLevel}–${tier.maxLevel} = ${tier.name}`);
            balDisp.style.cursor = 'help';
            balRow.appendChild(balDisp);
            wisdomBlock.appendChild(balRow);
        }
    }

    const savesRow = $('saves-row');
    if (savesRow) {
        savesRow.innerHTML = '';
        (clsData?.aptitude_priorities || []).slice(0, 3).forEach(ap => {
            const id = ap.toLowerCase().replace(/ /g, '_');
            const p = el('span', 'save-pill'); p.textContent = aptName(id); savesRow.appendChild(p);
        });
    }

    const vsBack = $('btn-vs-back');
    if (vsBack) vsBack.textContent = origin === 'party' ? '← Back to Party' : '← Back';
    const newBtn = $('btn-view-new');
    if (newBtn) newBtn.style.display = origin === 'party' ? 'none' : '';

    $('cc-tabs').style.display = 'none';
    const footerNav = $('tab-footer-nav');
    if (footerNav) footerNav.classList.add('hidden');
    $('party-sheet').classList.remove('active');
    $('inv-sheet').classList.remove('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    $('view-sheet').classList.add('active');
    $('cc-main').classList.add('sheet-mode');
}

function hideViewSheet() {
    $('view-sheet').classList.remove('active');
    $('cc-main').classList.remove('sheet-mode');
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
    const clsData  = findClass(char.cls);
    const raceData = findRace(char.race);
    const raceName = raceData ? raceData.name : (char.race ? char.race.replace(/_/g, ' ') : '');
    const clsName  = clsData ? clsData.name : char.cls;

    const physVal = ((char.aptitudes || {}).physiology) || BASE_APTITUDE;
    const cogVal = ((char.aptitudes || {}).cognition) || BASE_APTITUDE;
    const age = char.age || 35;
    const raceMat = raceData?.materium_pool_bonus || 0;
    const hp = Math.round(40 + physVal * 0.6);
    const materium = Math.round(cogVal * 1.2 + ageMateriumBonus(age) + raceMat);

    const card = el('div', 'ps-card');
    const port = el('div', 'ps-card-port');
    const img  = document.createElement('img');
    img.src = char.portrait || 'assets/images/characterportraits/ashenfemale.jpg';
    img.alt = char.name || 'Character';
    port.appendChild(img);

    const name = el('div', 'ps-card-name'); name.textContent = char.name || 'Unnamed';
    const sub  = el('div', 'ps-card-sub');
    [`Lv${char.level}`, raceName].filter(Boolean).forEach((part, i) => {
        sub.appendChild(document.createTextNode((i === 0 ? '' : ' · ') + part));
    });
    if (clsName) { sub.appendChild(document.createTextNode(' · ')); sub.appendChild(clsSpan(clsName, clsData?.class_group)); }

    const stats = el('div', 'ps-card-stats');
    const rows = [
        ['Vitality',   hp],
        ['Materium Pool', String(materium)],
        ['Sign',       findSign(char.birthSign)?.name || (char.birthSign ? char.birthSign.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) : 'No Sign')],
        ['Background', findBackground(char.background)?.name || char.background || '—'],
    ];
    if (char.skills && char.skills.length) {
        const allSk = getAllSkills();
        const skNames = char.skills.slice(0, 3).map(id => allSk.find(s => s.id === id)?.name || id).join(', ');
        rows.push(['Skills', skNames + (char.skills.length > 3 ? '…' : '')]);
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
    syncAptitudesToState();
    return {
        id:         Date.now(),
        name:       S.name,
        race:       S.race,       subrace:    S.subrace,
        gender:     S.gender,
        cls:        S.cls,        subclass:   S.subclass,
        level:      S.level,
        age:        S.age || 35,
        morality:    S.morality ?? 50,
        personality: S.personality || null,
        aptitudes:   { ...S.aptitudes },
        birthSign:   S.birthSign,
        skills:      [...S.skills],
        background:  S.background,
        equipment:  S.equipment,
        portrait:   $('char-portrait-img')?.getAttribute('src') || 'assets/images/characterportraits/ashenfemale.jpg',
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
    const newBtn = $('btn-new-after-save');
    if (newBtn) newBtn.style.display = '';
}

function loadChar(char) {
    S.name       = char.name;
    S.race       = char.race;       S.subrace  = char.subrace;
    S.gender     = char.gender;
    S.cls        = char.cls;        S.subclass = char.subclass;
    S.level      = char.level;
    S.age        = char.age || 35;
    S.morality   = char.morality ?? 50;
    S.personality = char.personality || null;
    S.aptitudes  = { ...makeAptObj(BASE_APTITUDE), ...(char.aptitudes || char.scores || {}) };
    S.birthSign  = char.birthSign || char.alignment || null;
    S.skills     = new Set(char.skills || []);
    S.background = char.background;
    S.equipment  = char.equipment || 'pack';
    const portrait = char.portrait || 'assets/images/characterportraits/ashenfemale.jpg';
    if ($('char-portrait-img')) $('char-portrait-img').src = portrait;
    showViewSheet({ ...char, portrait, age: S.age, morality: S.morality, personality: S.personality });
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
        const raceData = findRace(char.race);
        const clsData  = findClass(char.cls);
        const sub  = el('div', 'saved-item-sub');
        const subParts = [`Lv${char.level}`, raceData?.name || char.race || ''].filter(Boolean);
        sub.textContent = subParts.join(' ') + (subParts.length ? ' ' : '');
        if (clsData || char.cls) sub.appendChild(clsSpan(clsData?.name || char.cls, clsData?.class_group));
        info.append(nm, sub);

        // Action buttons
        const actions = el('div', 'saved-item-actions');

        const addPartyBtn = el('button', 'saved-item-btn');
        addPartyBtn.textContent = 'Add to Party';
        addPartyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (S.party.members.length >= S.party.size) { toast(`Party is full (${S.party.size} members).`); return; }
            S.party.members.push(char);
            toast(`${char.name || 'Character'} added to party.`);
            renderPartySlots();
        });

        const delBtn = el('button', 'saved-item-btn delete-btn');
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteChar(char.id); });

        actions.append(addPartyBtn, delBtn);
        row.append(info, actions);

        // Click on row to load character
        row.addEventListener('click', () => loadChar(char));

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
        const del  = el('button', 'del-btn'); del.textContent  = '✕'; del.title = 'Delete';
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
    S.age  = 35;
    S.aptitudes      = makeAptObj(BASE_APTITUDE);
    S.allocAptitudes = makeAptObj(BASE_APTITUDE);
    S.rollAptitudes  = makeNullAptObj();
    S.intelligence   = null;
    S.birthSign  = null; S.skills = new Set();
    S.background = null; S.equipment = 'pack'; S.name = '';

    ['sel-race','sel-class','sel-background','sel-gender'].forEach(id => { const e = $(id); if (e) e.value = ''; });
    const signSel = $('sel-birth-sign'); if (signSel) signSel.value = '';

    $('char-name').value = '';

    updateAptitudeSection();

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
    const newAfterSave = $('btn-new-after-save');
    if (newAfterSave) newAfterSave.style.display = 'none';
    goToTabIdx(0);
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
    $('char-name').addEventListener('input',  e => {
        S.name = e.target.value;
        if (S.name.trim()) {
            const warn = $('name-required-warning');
            if (warn) warn.classList.remove('visible');
        }
    });
    $('btn-name-save').addEventListener('click', () => {
        if (!S.name.trim()) {
            toast('Please enter a character name.');
            return;
        }
        toast(`Name set: ${S.name}`);
        $('btn-name-save').style.display = 'none';
    });
    $('btn-view-rename').addEventListener('click', () => {
        showTab('identity');
        $('btn-name-save').style.display = '';
        $('char-name').focus();
    });
    $('btn-save-char').addEventListener('click', saveChar);
    $('btn-new-char').addEventListener('click',  clearCreator);
    $('btn-new-after-save').addEventListener('click', clearCreator);
    $('btn-view-new').addEventListener('click',  clearCreator);
    $('btn-vs-back').addEventListener('click', hideViewSheet);
    $('btn-vs-inventory').addEventListener('click', showInvSheet);
    $('btn-inv-back').addEventListener('click', hideInvSheet);
    $('btn-ps-back').addEventListener('click', hidePartySheet);
    $('btn-vs-add-party').addEventListener('click', () => {
        const char = S.viewSheetChar;
        if (!char) return;
        if (S.party.members.length >= S.party.size) { toast(`Party is full (${S.party.size} members).`); return; }
        S.party.members.push(char);
        toast(`${char.name || 'Character'} added to party.`);
        renderPartySlots();
    });
    $('btn-vs-delete').addEventListener('click', () => {
        const char = S.viewSheetChar;
        if (!char?.id) return;
        deleteChar(char.id);
        hideViewSheet();
    });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
    try {
        const [races, classes, skills, backgrounds, birthmothersigns, aptitudes, spells,
               weapons_1h, weapons_2h, weapons_ranged, personalities] = await Promise.all([
            loadJSON('data/heroes/races.json'),
            loadJSON('data/heroes/classes.json'),
            loadJSON('data/heroes/skills.json'),
            loadJSON('data/heroes/backgrounds.json'),
            loadJSON('data/mechanics/birthmothersigns.json'),
            loadJSON('data/heroes/aptitudes.json'),
            loadJSON('data/combat/attacks_and_spells.json'),
            loadJSON('data/items/weapons_melee_1h.json'),
            loadJSON('data/items/weapons_melee_2h.json'),
            loadJSON('data/items/weapons_ranged.json'),
            loadJSON('data/heroes/personalities.json'),
        ]);
        DB = { races, classes, skills, backgrounds, birthmothersigns, aptitudes, spells,
               weapons_1h, weapons_2h, weapons_ranged, personalities };

        initTooltip();
        buildRaceSelect();
        buildClassSelect();
        buildBackgroundSelect();
        wireGender();
        wireLevel();
        buildBirthSignSelect();
        buildAptitudeSection();
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
