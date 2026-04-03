/* ═══════════════════════════════════════════════════════════════════════════
   character-creator.js  —  Leonoria Character Creator (Leonoria system)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── Aptitude system ──────────────────────────────────────────────────────────
const APTITUDES = ['conviction', 'physiology', 'cognition', 'materium_affinity', 'martial_experience', 'presence'];

const APTITUDE_NAMES = {
    conviction:         'Conviction',
    physiology:         'Physiology',
    cognition:          'Cognition',
    materium_affinity:  'Materium Affinity',
    martial_experience: 'Martial Experience',
    presence:           'Presence',
};

const APTITUDE_SHORT = {
    conviction:         'COV',
    physiology:         'PHY',
    cognition:          'COG',
    materium_affinity:  'MAT',
    martial_experience: 'MAR',
    presence:           'PRE',
};

const BASE_APTITUDE  = 30;   // default starting value for each aptitude
const ALLOC_BUDGET   = 20;   // extra points to distribute in point-allocation mode
const ALLOC_MIN      = 10;
const ALLOC_MAX      = 75;
const MAX_LEVEL      = 30;   // maximum character level

const TAB_ORDER = ['identity', 'attributes', 'skills', 'equipment', 'abilities'];

// ─── Aptitude descriptions (tooltip) ──────────────────────────────────────────
const APTITUDE_DESC = {
    conviction:
        'CONVICTION — Mental & Spiritual Strength\nYour willpower, resilience, and connection to faith.\n\n▸ CONTROLS:\n  • Initiative order (higher = faster)\n  • Maximum dice roll outcomes (your ceiling for rolls)\n  • Resistance to fear, curses, morale shocks\n  • Maximum Stamina cost you can push through\n\n▸ SUB-TRAITS:\n  • Tenacity: Push past death, resist breaking\n  • Resonance: Team loyalty & faith effectiveness\n  • Openness: Receptivity to foreign magic (fixed)\n\n▸ BREAKING POINTS:\n  At 25: Can attempt fear saves\n  At 50: +1 initiative position\n  At 75: Dice ceiling raised to 90%\n  At 100: Once/battle, block any Conviction effect\n\n▸ STARTING RANGE: 20–60 | MAX: 100',
    physiology:
        'PHYSIOLOGY — Physical Body & Durability\nYour health, strength, endurance, and resistance.\n\n▸ CONTROLS:\n  • Vitality (HP) = 40 + (Physiology × 0.6)\n  • Hardening resistances (Physical, Magical, Poison)\n  • Vigor: Carry capacity & melee damage (peaks at 50)\n  • Metabolism: Movement & action stamina pool\n\n▸ RESISTANCES:\n  Max hardening per type: 50%\n  Gain ~5% resistance per 100 hits of that type\n\n▸ BREAKING POINTS:\n  At 30: Equip medium armor\n  At 50: Heavy armor available, +3 hardening\n  At 70: Vigor cap 80, heavy weapons free\n  At 100: Stone Body—reduce all physical by 10%\n\n▸ STARTING RANGE: 20–60 | MAX: 100',
    cognition:
        'COGNITION — Mental Acuity & Experience\nYour knowledge, creativity, perception, and street smarts.\n\n▸ CONTROLS:\n  • Erudition: Learn spells, absorb knowledge faster\n  • Ingenuity: Crafting & magical item creation\n  • Worldliness: Lockpicking, reading people, survival\n  • Perception: Detect danger, notice hidden details\n  • Intelligence: +0.5% to all non-physical skill rolls (fixed)\n\n▸ UNIQUE:\n  Grows naturally with age regardless of use\n  Never declines with age (unlike Physiology)\n\n▸ BREAKING POINTS:\n  At 30: Read advanced Materium texts alone\n  At 50: +5 to new skill starting values\n  At 70: +10% danger detection permanently\n  At 100: All Cognition skill learning +20%\n\n▸ STARTING RANGE: 15–55 | MAX: 100',
    materium_affinity:
        'MATERIUM AFFINITY — Magical Attunement\nYour capacity to channel and control magical energy.\n\n▸ CONTROLS:\n  • Conduit Grade: Max spell power (race/class set)\n  • Shadow Connection: Dark arts pool (separate from Materium)\n  • Insulation: Magic resistance vs all schools\n  • Materium Pool Size: More Affinity = larger pool\n\n▸ IMPORTANT NOTES:\n  Distinct from Materium Pool resource\n  Pool depletes when casting, pool is what you spend\n  Affinity is your capacity, determines max pool\n  High Vigor above 60 reduces Conduit Grade (−1 per 10)\n\n▸ BREAKING POINTS:\n  At 20: Access second Materium school\n  At 40: Pool +15%, school mastery available\n  At 60: Shadow & Materium regen together\n  At 80: Elemental synergies at 50% bonus\n  At 100: Living Conduit—+5% pool regen/turn in combat\n\n▸ STARTING RANGE: 5–45 | MAX: 100',
    martial_experience:
        'MARTIAL EXPERIENCE — Combat Skill\nYour training, reflexes, technique, and weapon mastery.\n\n▸ CONTROLS:\n  • Agilities: Dodge, reflex, crit strikes\n  • Weapon Affinities: Master each weapon type (1–100)\n  • Physical damage bonus: floor(Martial / 10)%\n  • Initiative bonus at 50+\n\n▸ LEVELING:\n  Fastest-growing aptitude\n  But: Veterans face diminishing returns\n  After 50 battles: −50% exp per battle\n  After 150 battles: −75% exp per battle\n\n▸ BREAKING POINTS:\n  At 20: Any weapon equippable\n  At 40: +5% physical damage, passive dodge\n  At 60: Combat Memory—reroll 1 failed attack/battle\n  At 80: +10% physical damage, crit +5%\n  At 100: Veteran\'s Edge—new heroes start weapons at 11\n\n▸ STARTING RANGE: 5–45 | MAX: 100',
    presence:
        'PRESENCE — Force of Personality\nHow the world perceives you. Your authority, charm, and social weight.\n\n▸ CONTROLS:\n  • Gravitas: Passive projection (fear or magnetism)\n  • Eloquence: Active persuasion & negotiation\n  • Social impact based on Openness filter\n  • Reputation spread\n\n▸ FILTERED BY OPENNESS:\n  Low Openness + High Presence = Domination (fear)\n  High Openness + High Presence = Magnetism (inspiration)\n  Low Openness + Low = Ghost (invisible)\n  High Openness + Low = Everyman (trusted, underestimated)\n\n▸ BREAKING POINTS:\n  At 25: Social rolls vs neutral NPCs\n  At 50: Reputation spreads to regions\n  At 75: Commanding Presence—hostile NPCs Conviction <30 hesitate\n  At 100: Legend—known across continent, free items per town\n\n▸ STARTING RANGE: 10–55 | MAX: 100',
};

// ─── Skill descriptions (tooltip) ────────────────────────────────────────────
const SKILL_DESC = {
    swordsmanship:      'Mastery of bladed swords — slash, thrust, and parry. The quintessential weapon art of the Midlanders.',
    archery:            'Skilled use of bows, aimed fire, and movement shooting. Common among Wayfarers and Ancients.',
    axewielding:        'Combat use of axes and hatchets — powerful cleaving strikes and throwing techniques.',
    blunt_force:        'Mace, hammer, and club fighting. Effective against armoured targets. Core to Ironguard doctrine.',
    small_arms:         'Knives, daggers, and short blades. Essential for close-quarters and backup combat.',
    polearms:           'Spear, halberd, and pike — controlling range and fighting in formation.',
    shield_fighting:    'Active shield use in combat: blocking, shoving, and shield-bashing.',
    crossbow:           'Mechanical ranged weapon. High power, slow reload. Favoured in fortifications.',
    blowgun_and_sling:  'Primitive ranged weapons. Favoured by Oakpeople and jungle hunters.',
    thievery:           'Picking pockets, sleight of hand, and theft. Core skill of Shadowblades.',
    stealth:            'Moving silently and avoiding detection. Essential for scouts and assassins.',
    lockpicking:        'Opening locks, bypassing mechanisms, and accessing secured spaces.',
    arcane_theory:      'Knowledge of magical principles, Materium schools, and channeling theory.',
    herbalism:          'Identifying plants, brewing poultices, and understanding natural healing.',
    alchemy:            'Combining materials into potions, acids, and explosive compounds.',
    monster_lore:       'Knowledge of Leonorian creatures — weaknesses, habitats, and behaviours.',
    survival:           'Finding food, water, and shelter in the wilderness. Hazard recognition.',
    navigation:         'Charting routes, reading maps and stars, and pathfinding.',
    tracking:           'Following the trail of creatures or people across varied terrain.',
    animal_handling:    'Calming, training, and working with animals — including mounts.',
    persuasion:         'Convincing others through charm, reason, and diplomacy.',
    intimidation:       'Influencing others through threat, force, or menacing presence.',
    deception:          'Lying, bluffing, and misleading others convincingly.',
    leadership:         'Commanding others in coordinated action — rallying troops, organizing groups.',
    weaponsmithing:     'Forging and repairing bladed weapons. A Stone Folk and Ironguard tradition.',
    armorsmithing:      'Crafting and repairing armour — leather to full plate.',
    potion_brewing:     'Advanced alchemy focused on magical consumables and restorative compounds.',
    enchanting:         'Imbuing objects with magical properties through ritual and Materium focus.',
    athletics:          'Climbing, jumping, swimming, and physical endurance feats.',
    acrobatics:         'Balance, tumbling, and precise movement in precarious situations.',
    lightwielding_skill:'Channeling and shaping Lightwielding (Benevolent Triad) magic.',
    materium_channeling:'Directing and focusing Materium (Focused Triad) magical energies.',
    shadow_weaving:     'Weaving and controlling Shadow Arts (Malevolent Triad) magic.',
};

// ─── Flavor blurbs ────────────────────────────────────────────────────────────
const RACE_BLURBS = {
    midlander:          'The most numerous people of Leonoria. Midlanders built the great kingdoms and trade routes. Adaptable, ambitious, and relentlessly practical.',
    northerner:         'Hardy folk of the cold northern borders. Short on words, long on endurance. The cold does not break a Northerner — it makes them.',
    step_folk:          'Nomadic wanderers of the outer steppes and gleam havens. Masters of horse, wind, and survival between civilizations.',
    ancients_secluded:  'The oldest forest people, living in deep woodland enclaves, remembering ages most have forgotten entirely.',
    ancients_greys:     'The scholar-elves. Grey Ancients built libraries and observatories before the Great Death. Some still maintain them.',
    ancients_dark_ones: 'Descended into the deep places after the War of the Well. Adapted to shadow, silence, and secrets.',
    ice_ancients:       'The frozen north\'s original inhabitants. Said to have made a pact with the eternal winds. They do not feel cold as others do.',
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
    wayfarer:           'Scouting the road ahead, hunting from shadow, surviving where others perish. Wayfarers are the eyes and blades of the wilderness.',
    shadowblade:        'Precision over power. The Shadowblade vanishes, strikes once with lethal intent, and is gone before the body falls.',
    warden:             'Bound by faith and duty to protect the innocent. Wardens are divine warriors — champions of a people, not servants of a god.',
    soulkindler:        'Healers, speakers, and spiritual fire. Soulkindlers work where medicine fails and morale breaks — they carry the light that cannot be put out.',
    elementalist:       'Bending the Materium of air, earth, fire, and water through scholarly discipline. A living formula applied to the battlefield.',
    pyrecrafter:        'Master of fire and heat magic. The Pyrecrafter does not merely burn — they craft fire as a sculptor crafts stone. Beautiful. Lethal.',
    stormcaller:        'Commanding wind, lightning, and tempest. Stormcallers call down the sky — storm-born warriors of terrifying range and power.',
    lifewhisperer:      'The great healers of Leonoria. Where the Soulkindler brings spiritual fire, the Lifewhisperer brings biological restoration.',
    voidweaver:         'Practitioners of the dark not through malice but mastery. Voidweavers understand shadow deeply enough to shape it without being consumed.',
    bloodsinger:        'Body as conduit. Blood as power. Bloodsingers burn their own vitality to fuel devastating magical effects. High risk. Absolute power.',
    scholar:            'No weapon sharper than a prepared mind. Scholars gather, analyze, and apply knowledge — often more dangerous than the warrior beside them.',
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
    aptitudeMethod: 'standard',
    aptitudes:      makeAptObj(BASE_APTITUDE),
    allocAptitudes: makeAptObj(BASE_APTITUDE),
    rollAptitudes:  makeNullAptObj(),
    rolledPool:  [],
    pendingRoll: null,
    birthSign:   null,
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
function findBackground(id) { return (DB.backgrounds?.profession_backgrounds || []).find(b => b.id === id) || null; }
function findSign(id)       { return (DB.birthmothersigns?.signs || []).find(s => s.id === id) || null; }
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
        position: 'fixed', maxWidth: '300px',
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
        const x = Math.min(e.clientX + 16, window.innerWidth  - 280);
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
    const x = Math.min(e.clientX + 16, window.innerWidth  - 280);
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
    const cls = findClass(S.cls);
    if (!cls) return;
    const bonuses = cls.aptitude_bonuses || {};
    APTITUDES.forEach(a => {
        const val = Math.min(ALLOC_MAX, Math.max(ALLOC_MIN, BASE_APTITUDE + (bonuses[a] || 0)));
        S.aptitudes[a]      = val;
        S.allocAptitudes[a] = val;
    });
    updateAptitudeDisplays();
    syncAptitudesToState();
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
        updateDerivedStats();
        updateFlavorText();
    });
}

// ─── Abilities tab ────────────────────────────────────────────────────────────
// Maps class IDs to their martial ability set ID in attacks_and_spells.json
const CLASS_MARTIAL_SET = {
    ironguard: 'vanguard_type', vanguard: 'vanguard_type',
    battlebrave: 'skirmisher_type', duelist: 'skirmisher_type',
    reaver: 'skirmisher_type', skirmisher: 'skirmisher_type',
    wayfarer: 'marksman_type', marksman: 'marksman_type', beastwarden: 'marksman_type',
    shadowblade: 'rogue_type', assassin: 'rogue_type', thief: 'rogue_type', saboteur: 'rogue_type',
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
    ironguard:'⚔', vanguard:'⚔', battlebrave:'⚔', reaver:'⚔', duelist:'⚔',
    warmaster:'✦', wayfarer:'🏹', marksman:'🏹', skirmisher:'🏹', beastwarden:'🏹',
    shadowblade:'🗡', assassin:'🗡', thief:'🗡', saboteur:'🗡',
    warden:'✦', aegisbearer:'✦', dawncaller:'✦', soulkindler:'✦',
};
const MAGIC_DOT_COLOR = {
    lightwielding: '#e8cc30',
    materium:      '#5fbcff',
    shadow:        '#9060d0',
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
        allAbilities.push({ ...a, type: 'attack', icon: BASE_CLASS_ICON[classId] || '⚔', costType: 'stamina' });
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
        S.cls      = id || null;
        S.subclass = null;
        applyDefaultAptitudes();
        buildSkillRows();
        applyDefaultSkills();
        updateDerivedStats();
        updateFlavorText();
        updateInventory();
        updateEquipGoldHint();
        buildAbilitiesTab();
    });
    $('chk-all-classes')?.addEventListener('change', populateClassSelect);
}

// ─── Background select ────────────────────────────────────────────────────────
function buildBackgroundSelect() {
    const sel = $('sel-background');
    sel.innerHTML = '<option value="">— Choose Background —</option>';
    (DB.backgrounds?.profession_backgrounds || []).forEach(bg => {
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
    const disp   = $('level-disp');
    slider.addEventListener('input', () => {
        S.level = +slider.value;
        disp.textContent = S.level;
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
    label.textContent = 'The sign of the month you were born under. 80% of people bear no sign (Childless).';
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

// ─── Aptitude scores ──────────────────────────────────────────────────────────
function buildAptitudeScores() {
    buildStdAptRows();
    buildAllocRows();
    buildRollAptRows();

    document.querySelectorAll('.mth-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mth-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.ab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            S.aptitudeMethod = btn.dataset.method;
            $(`ab-${S.aptitudeMethod}`).classList.add('active');
            syncAptitudesToState();
            updateDerivedStats();
        });
    });
}

function makeAptRow(apt) {
    const row    = el('div', 'ab-row');
    const abbrEl = el('span', 'ab-abbr'); abbrEl.textContent = aptShort(apt);
    const nameEl = el('span', 'ab-name'); nameEl.textContent = aptName(apt);
    const desc = APTITUDE_DESC[apt];
    if (desc) {
        nameEl.style.cursor = 'help';
        nameEl.addEventListener('mouseenter', e => showTip(e, desc));
        nameEl.addEventListener('mouseleave', hideTip);
    }
    row.append(abbrEl, nameEl);
    return row;
}

function buildStdAptRows() {
    const cont = $('std-rows');
    cont.innerHTML = '';
    APTITUDES.forEach(apt => {
        const row   = makeAptRow(apt);
        const valEl = el('span', 'ab-score'); valEl.id = `std-${apt}-val`; valEl.textContent = S.aptitudes[apt];
        const noteEl = el('span', 'ab-mod'); noteEl.id = `std-${apt}-note`; noteEl.style.fontSize = '0.7rem'; noteEl.style.color = 'var(--text-muted)';
        row.append(valEl, noteEl);
        cont.appendChild(row);
    });
    updateAptitudeDisplays();
}

function updateAptitudeDisplays() {
    // Standard rows: just show current value with class bonus note
    const cls = findClass(S.cls);
    const bonuses = cls?.aptitude_bonuses || {};
    APTITUDES.forEach(apt => {
        const v = $(`std-${apt}-val`);
        if (v) v.textContent = S.aptitudes[apt] ?? BASE_APTITUDE;
        const n = $(`std-${apt}-note`);
        if (n) {
            const b = bonuses[apt] || 0;
            n.textContent = b !== 0 ? (b > 0 ? `+${b}` : `${b}`) : '';
        }
    });
    // Alloc rows: show current value
    APTITUDES.forEach(apt => {
        const v = $(`alloc-${apt}-val`);
        if (v) v.textContent = S.allocAptitudes[apt] ?? BASE_APTITUDE;
        const m = $(`alloc-${apt}-mod`);
        if (m) {
            const val = S.allocAptitudes[apt] ?? BASE_APTITUDE;
            const tier = val >= 80 ? 'Legendary' : val >= 60 ? 'Expert' : val >= 40 ? 'Seasoned' : val >= 20 ? 'Novice' : 'Untrained';
            m.textContent = tier;
        }
    });
    const spent = APTITUDES.reduce((s, a) => s + Math.max(0, (S.allocAptitudes[a] ?? BASE_APTITUDE) - BASE_APTITUDE), 0);
    const remain = $('pb-remain');
    if (remain) remain.textContent = ALLOC_BUDGET - spent;
}

function buildAllocRows() {
    const cont = $('pb-rows');
    cont.innerHTML = '';
    APTITUDES.forEach(apt => {
        const row   = makeAptRow(apt);
        const ctrl  = el('div', 'ab-pb-ctrl');
        const minus = el('button', 'pb-adj'); minus.textContent = '−';
        const valEl = el('span', 'ab-score'); valEl.id = `alloc-${apt}-val`; valEl.textContent = S.allocAptitudes[apt];
        const plus  = el('button', 'pb-adj'); plus.textContent  = '+';
        minus.addEventListener('click', () => adjustAlloc(apt, -1));
        plus.addEventListener('click',  () => adjustAlloc(apt, +1));
        ctrl.append(minus, valEl, plus);
        const modEl = el('span', 'ab-mod'); modEl.id = `alloc-${apt}-mod`; modEl.textContent = '';
        row.append(ctrl, modEl);
        cont.appendChild(row);
    });
}

function adjustAlloc(apt, delta) {
    const cur  = S.allocAptitudes[apt];
    const next = Math.min(ALLOC_MAX, Math.max(ALLOC_MIN, cur + delta));
    if (next === cur) return;
    const spent = APTITUDES.reduce((s, a) => s + Math.max(0, S.allocAptitudes[a] - BASE_APTITUDE), 0)
                - Math.max(0, cur - BASE_APTITUDE) + Math.max(0, next - BASE_APTITUDE);
    if (spent > ALLOC_BUDGET) { toast('Not enough allocation points.'); return; }
    S.allocAptitudes[apt] = next;
    syncAptitudesToState();
    updateAptitudeDisplays();
    updateDerivedStats();
}

function buildRollAptRows() {
    const cont = $('roll-rows');
    cont.innerHTML = '';

    let pool = $('roll-pool');
    if (!pool) {
        pool = el('div'); pool.id = 'roll-pool';
        pool.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.8rem;min-height:2rem;align-items:center;';
        cont.parentElement.insertBefore(pool, cont);
    }

    APTITUDES.forEach(apt => {
        const row     = makeAptRow(apt);
        row.style.cursor = 'pointer';
        row.title = 'Click a rolled value above, then click here to assign it';
        const scoreEl = el('span', 'ab-score'); scoreEl.id = `roll-${apt}-val`; scoreEl.textContent = '—';
        const modEl   = el('span', 'ab-mod');   modEl.id   = `roll-${apt}-mod`; modEl.textContent   = '';
        row.append(scoreEl, modEl);
        row.addEventListener('click', () => {
            if (S.pendingRoll !== null && S.rollAptitudes[apt] === null) {
                assignRoll(apt, S.pendingRoll);
            } else if (S.rollAptitudes[apt] !== null) {
                S.rolledPool.push(S.rollAptitudes[apt]);
                S.rollAptitudes[apt] = null;
                scoreEl.textContent = '—';
                modEl.textContent   = '';
                S.pendingRoll = null;
                refreshRollPool();
                syncAptitudesToState();
                updateDerivedStats();
            }
        });
        cont.appendChild(row);
    });

    const rollBtn = $('btn-roll');
    if (rollBtn) {
        rollBtn.replaceWith(rollBtn.cloneNode(true)); // remove old listener
        const newBtn = $('btn-roll');
        newBtn.addEventListener('click', () => {
            S.rolledPool     = [];
            S.pendingRoll    = null;
            S.rollAptitudes  = makeNullAptObj();
            APTITUDES.forEach(apt => {
                const v = $(`roll-${apt}-val`); if (v) v.textContent = '—';
                const m = $(`roll-${apt}-mod`); if (m) m.textContent = '';
            });
            // Roll 6 values in range 25–55
            for (let i = 0; i < 6; i++) {
                S.rolledPool.push(25 + Math.floor(Math.random() * 31));
            }
            refreshRollPool();
            syncAptitudesToState();
            updateDerivedStats();
        });
    }
}

function refreshRollPool() {
    const pool = $('roll-pool');
    if (!pool) return;
    pool.innerHTML = '';
    if (!S.rolledPool.length && APTITUDES.every(a => S.rollAptitudes[a] === null)) {
        pool.innerHTML = '<span style="font-size:0.68rem;color:var(--text-muted);font-style:italic;">Click Roll to generate values, then assign each to an aptitude.</span>';
        return;
    }
    S.rolledPool.forEach(v => {
        const chip = el('span');
        chip.textContent = v;
        chip.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:2.2rem;height:2rem;border:1px solid var(--green-dim);background:var(--bg-card);color:var(--gold);font-size:0.88rem;cursor:pointer;transition:border-color 0.15s,background 0.15s;';
        chip.addEventListener('click', () => {
            pool.querySelectorAll('span').forEach(c => { c.style.borderColor='var(--green-dim)'; c.style.background='var(--bg-card)'; });
            S.pendingRoll = v;
            chip.style.borderColor = 'var(--gold)';
            chip.style.background  = 'rgba(201,168,76,0.12)';
        });
        pool.appendChild(chip);
    });
}

function assignRoll(apt, val) {
    const idx = S.rolledPool.indexOf(val);
    if (idx !== -1) S.rolledPool.splice(idx, 1);
    S.rollAptitudes[apt] = val;
    S.pendingRoll = null;
    const scoreEl = $(`roll-${apt}-val`); if (scoreEl) scoreEl.textContent = val;
    const modEl   = $(`roll-${apt}-mod`);
    if (modEl) {
        const tier = val >= 80 ? 'Legendary' : val >= 60 ? 'Expert' : val >= 40 ? 'Seasoned' : val >= 20 ? 'Novice' : 'Untrained';
        modEl.textContent = tier;
    }
    refreshRollPool();
    syncAptitudesToState();
    updateDerivedStats();
}

function syncAptitudesToState() {
    if (S.aptitudeMethod === 'standard') {
        APTITUDES.forEach(a => { S.aptitudes[a] = S.aptitudes[a] ?? BASE_APTITUDE; });
    } else if (S.aptitudeMethod === 'pointbuy') {
        APTITUDES.forEach(a => { S.aptitudes[a] = S.allocAptitudes[a]; });
    } else {
        APTITUDES.forEach(a => { S.aptitudes[a] = S.rollAptitudes[a] ?? BASE_APTITUDE; });
    }
}

// ─── Skills ───────────────────────────────────────────────────────────────────
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
        infoEl.textContent = `Fixed: ${fixedNames || '—'} · Choose ${choiceCount} additional skill${choiceCount > 1 ? 's' : ''} from class list.`;
    } else {
        infoEl.textContent = 'Select a class to see available skills.';
    }

    // Group skills by category — when a class is selected, skip skills not available to it
    (DB.skills?.categories || []).forEach(cat => {
        const catSkills = cat.skills || [];
        if (!catSkills.length) return;

        // Pre-filter: only show skills the class can use (fixed or in choices)
        const visibleSkills = cls
            ? catSkills.filter(sk => fixed.has(sk.id) || !choiceSet || choiceSet.has(sk.id))
            : catSkills;
        if (!visibleSkills.length) return;

        const header = el('div', 'sk-category-header');
        header.textContent = `${cat.category} [${aptShort(cat.aptitude_link)}]`;
        grid.appendChild(header);

        visibleSkills.forEach(sk => {
            const isFixed    = fixed.has(sk.id);

            const row = el('div', `skill-row${isFixed ? ' sk-fixed' : ''}`);
            row.dataset.name = sk.id;

            const check = el('span', 'sk-check'); row.appendChild(check);
            const name  = el('span', 'sk-name');  name.textContent = sk.name; row.appendChild(name);
            const ab    = el('span', 'sk-ab');    ab.textContent   = aptShort(cat.aptitude_link); row.appendChild(ab);

            const desc = SKILL_DESC[sk.id] || sk.description;
            if (desc) {
                row.addEventListener('mouseenter', e => showTip(e, desc));
                row.addEventListener('mouseleave', hideTip);
            }

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
function updateDerivedStats() {
    syncAptitudesToState();
    const cls  = findClass(S.cls);
    const race = findRace(S.race);

    // Vitality (HP) = 40 + Physiology * 0.6 (approximation)
    const physVal = S.aptitudes.physiology || BASE_APTITUDE;
    const baseVit = Math.round(40 + physVal * 0.6);
    $('d-hp').textContent = baseVit;

    // Materium pool
    const matPool = (cls?.materium_pool_start || 0) + (race?.materium_pool_bonus || 0);
    $('d-hd').textContent = cls?.materium_access ? `${matPool} MP` : '—';

    // Level display
    $('d-prof').textContent = `Lv ${S.level}`;

    // Class trait name
    $('d-speed').textContent = cls?.special_class_trait?.name || '—';

    // Aptitude focus (replaces saves-row): show class aptitude priorities
    const savesRow = $('saves-row');
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

    // Identity line
    const raceData  = race;
    const raceName  = raceData ? raceData.name : (S.race ? S.race.replace(/_/g, ' ') : null);
    const clsName   = cls ? cls.name : null;
    const parts = [];
    if (raceName) parts.push(raceName);
    if (clsName)  parts.push(clsName);
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
    const raceData = findRace(S.race);
    const raceName = raceData ? raceData.name : (S.race ? S.race.replace(/_/g, ' ') : '');
    const clsData  = findClass(S.cls);
    const clsName  = clsData ? clsData.name : (S.cls ? S.cls : '');

    const ownName    = raceData?.own_name || null;
    const ownMeaning = raceData?.own_name_meaning || null;
    const ownPrefix  = ownName ? ` Known among themselves as the <em>${ownName}</em>${ownMeaning ? ` — "${ownMeaning}"` : ''}.` : '';
    const raceBlurb  = S.race ? (RACE_BLURBS[S.race]  || (raceData?.description) || `The ${raceName} are a proud and storied people.`) : '';
    const classBlurb = S.cls  ? (CLASS_BLURBS[S.cls]  || (clsData?.description)  || `The ${clsName} follows a path of power and purpose.`) : '';

    let html = '';
    if (S.race) html += `<strong>${raceName}.</strong> ${raceBlurb}${ownPrefix}`;
    if (S.race && S.cls) html += '<br><br>';
    if (S.cls)  html += `<strong>${clsName}.</strong> ${classBlurb}`;
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
                d.appendChild(makeBgBullet(sk ? sk.name : id, `${sign}${v}`, v > 0 ? 'pos' : 'neg'));
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
    prev.addEventListener('click', () => { const idx = currentTabIdx(); if (idx > 0) goToTabIdx(idx - 1); });
    next.addEventListener('click', () => { const idx = currentTabIdx(); if (idx < TAB_ORDER.length - 1) goToTabIdx(idx + 1); });
    updateTabNav(0);
}

// ─── View sheet ───────────────────────────────────────────────────────────────
function showViewSheet(char, origin = 'create') {
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
    $('vs-sub').textContent        = [`Level ${char.level}`, raceName, clsName, signName !== 'No Sign (Childless)' ? signName : null].filter(Boolean).join(' · ');
    $('vs-race').textContent       = raceName  || '—';
    $('vs-gender').textContent     = char.gender || '—';
    $('vs-class').textContent      = clsName   || '—';
    $('vs-background').textContent = bgName;
    $('vs-alignment').textContent  = signName;

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

    const abGrid = $('vs-ab-grid');
    abGrid.innerHTML = '';
    APTITUDES.forEach(apt => {
        const score = (char.aptitudes && char.aptitudes[apt]) || BASE_APTITUDE;
        const aptData = DB.aptitudes?.aptitudes?.find(a => a.id === apt);
        let tooltip = aptName(apt);
        if (aptData) {
            const lines = [
                `${aptData.name}`,
                ``,
                aptData.function,
                ``,
                `"${aptData.flavor}"`,
                ``,
                `Starting range: ${Array.isArray(aptData.starting_range) ? aptData.starting_range.join('–') : aptData.starting_range}`,
                `Max: ${aptData.max}`
            ];
            if (aptData.breaking_points && aptData.breaking_points.length) {
                lines.push('', 'Breaking Points:');
                aptData.breaking_points.forEach(bp => {
                    lines.push(`  ${bp.threshold}: ${bp.unlock}`);
                });
            }
            tooltip = lines.join('\n');
        }
        const cell  = el('div', 'vs-apt-cell');
        cell.setAttribute('data-tooltip', tooltip);
        const abbr  = el('span', 'vs-apt-abbr');  abbr.textContent  = aptName(apt);
        const sc    = el('span', 'vs-apt-score');  sc.textContent    = score;
        const tier  = score >= 80 ? 'Legendary' : score >= 60 ? 'Expert' : score >= 40 ? 'Seasoned' : score >= 20 ? 'Novice' : 'Untrained';
        const t     = el('span', 'vs-apt-tier');   t.textContent     = tier;
        cell.append(abbr, sc, t);
        abGrid.appendChild(cell);
    });

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

    const equipEl = $('vs-equip');
    if (equipEl) {
        equipEl.textContent = char.equipment === 'gold' ? 'Starting Gold' : 'Starting Pack';
        equipEl.setAttribute('data-tooltip', 'Items and gear your character carries, starting equipment from class and background.');
    }
    const kitEl = $('vs-starter-kit');
    if (kitEl && clsData?.starter_kit?.length && char.equipment !== 'gold') {
        kitEl.textContent = clsData.starter_kit.join(' · ');
        kitEl.setAttribute('data-tooltip', 'Starting equipment from class and background.');
    } else if (kitEl) {
        kitEl.textContent = '';
        kitEl.removeAttribute('data-tooltip');
    }

    // Update left panel derived stats
    const physVal = ((char.aptitudes || {}).physiology) || BASE_APTITUDE;
    const convictionVal = ((char.aptitudes || {}).conviction) || BASE_APTITUDE;
    const vitality = Math.round(40 + physVal * 0.6);
    const conviction = convictionVal;
    const materiumPool = clsData?.materium_access ? `${clsData.materium_pool_start || 0}` : '—';
    const shadowConn   = clsData?.shadow_connection_start > 0 ? `${clsData.shadow_connection_start}` : '0';
    const staminaPool  = clsData?.stamina_pool_start != null ? `${clsData.stamina_pool_start}` : '—';
    const classTrait   = clsData?.special_class_trait?.name || '—';
    const classTraitDesc = clsData?.special_class_trait?.description || '';
    const focusPriorities = (clsData?.aptitude_priorities || []).slice(0, 3);
    const focusText = focusPriorities
        .map(ap => aptName(ap.toLowerCase().replace(/ /g, '_')))
        .join('\n') || '—';

    $('d-hp').textContent    = vitality;
    $('d-hd').textContent    = materiumPool;
    $('d-prof').textContent  = `Level ${char.level}`;
    $('d-speed').textContent = classTrait;
    $('identity-line').textContent = [raceName, char.subclass || clsName].filter(Boolean).join(' · ') || 'Choose race & class';
    if ($('vs-vitality')) {
        $('vs-vitality').textContent = vitality;
        $('vs-vitality').setAttribute('data-tooltip', 'Your health pool. When this reaches 0, you are defeated.');
    }
    if ($('vs-conviction')) {
        $('vs-conviction').textContent = conviction;
        $('vs-conviction').setAttribute('data-tooltip', 'Your willpower and mental strength. Controls initiative order, maximum dice roll outcomes, and resistance to fear and psychological effects.');
    }
    if ($('vs-stamina')) {
        $('vs-stamina').textContent = staminaPool;
        $('vs-stamina').setAttribute('data-tooltip', 'Your physical endurance pool. Powers attacks, dodge rolls, movement, and other physical exertion.');
    }
    if ($('vs-mpool')) {
        $('vs-mpool').textContent = materiumPool;
        $('vs-mpool').setAttribute('data-tooltip', 'Your pool of elemental magic energy. Powers spells from the five schools of Materium.');
    }
    if ($('vs-shadow')) {
        $('vs-shadow').textContent = shadowConn;
        $('vs-shadow').setAttribute('data-tooltip', 'Your connection to dark arts and shadow magic. Required to cast spells from shadow schools (Darkvoid, Chill, Darkmind, etc).');
    }
    if ($('vs-focus')) {
        $('vs-focus').textContent = focusText;
        $('vs-focus').setAttribute('data-tooltip', 'Your class\'s core strengths. These are the aptitudes where your class excels. Build your character by improving these for maximum effectiveness.');
        const focusRow = $('vs-focus').closest('.vs-focus-row');
        if (focusRow) {
            focusRow.dataset.tooltip = 'Your class\'s core strengths.\nThese are the aptitudes where your class excels. Build your character by improving these for maximum effectiveness.';
            focusRow.addEventListener('mouseenter', e => showTip(e, focusRow.dataset.tooltip));
            focusRow.addEventListener('mouseleave', hideTip);
        }
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

    const savesRow = $('saves-row');
    savesRow.innerHTML = '';
    (clsData?.aptitude_priorities || []).slice(0, 3).forEach(ap => {
        const id = ap.toLowerCase().replace(/ /g, '_');
        const p = el('span', 'save-pill'); p.textContent = aptName(id); savesRow.appendChild(p);
    });

    const vsBack = $('btn-vs-back');
    if (vsBack) vsBack.textContent = origin === 'party' ? '← Back to Party' : '← Back';
    const newBtn = $('btn-view-new');
    if (newBtn) newBtn.style.display = origin === 'party' ? 'none' : '';

    $('cc-tabs').style.display = 'none';
    const footerNav = $('tab-footer-nav');
    if (footerNav) footerNav.classList.add('hidden');
    $('party-sheet').classList.remove('active');
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
    const hp = Math.round(40 + physVal * 0.6);

    const card = el('div', 'ps-card');
    const port = el('div', 'ps-card-port');
    const img  = document.createElement('img');
    img.src = char.portrait || 'assets/images/characterportraits/ashenfemale.jpg';
    img.alt = char.name || 'Character';
    port.appendChild(img);

    const name = el('div', 'ps-card-name'); name.textContent = char.name || 'Unnamed';
    const sub  = el('div', 'ps-card-sub');
    sub.textContent = [`Lv${char.level}`, raceName, clsName].filter(Boolean).join(' · ');

    const stats = el('div', 'ps-card-stats');
    const rows = [
        ['Vitality',   hp],
        ['Materium Pool', clsData?.materium_access ? `${clsData.materium_pool_start || 0}` : '—'],
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
        aptitudes:  { ...S.aptitudes },
        birthSign:  S.birthSign,
        skills:     [...S.skills],
        background: S.background,
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
}

function loadChar(char) {
    S.name       = char.name;
    S.race       = char.race;       S.subrace  = char.subrace;
    S.gender     = char.gender;
    S.cls        = char.cls;        S.subclass = char.subclass;
    S.level      = char.level;
    S.aptitudes  = { ...makeAptObj(BASE_APTITUDE), ...(char.aptitudes || char.scores || {}) };
    S.birthSign  = char.birthSign || char.alignment || null;
    S.skills     = new Set(char.skills || []);
    S.background = char.background;
    S.equipment  = char.equipment || 'pack';
    const portrait = char.portrait || 'assets/images/characterportraits/ashenfemale.jpg';
    if ($('char-portrait-img')) $('char-portrait-img').src = portrait;
    showViewSheet({ ...char, portrait });
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
        sub.textContent = `Lv${char.level} ${raceData?.name || char.race || ''} ${clsData?.name || char.cls || ''}`.trim();
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
    S.aptitudeMethod = 'standard';
    S.aptitudes      = makeAptObj(BASE_APTITUDE);
    S.allocAptitudes = makeAptObj(BASE_APTITUDE);
    S.rollAptitudes  = makeNullAptObj();
    S.rolledPool = []; S.pendingRoll = null;
    S.birthSign  = null; S.skills = new Set();
    S.background = null; S.equipment = 'pack'; S.name = '';

    ['sel-race','sel-class','sel-background','sel-gender'].forEach(id => { const e = $(id); if (e) e.value = ''; });
    const signSel = $('sel-birth-sign'); if (signSel) signSel.value = '';

    $('char-name').value        = '';
    $('level-disp').textContent = 1;
    $('level-slider').value     = 1;

    document.querySelectorAll('.mth-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.ab-panel').forEach(p => p.classList.remove('active'));
    const stdBtn = document.querySelector('.mth-btn[data-method="standard"]');
    if (stdBtn) stdBtn.classList.add('active');
    const stdPanel = $('ab-standard');
    if (stdPanel) stdPanel.classList.add('active');

    updateAptitudeDisplays();
    const pool = $('roll-pool'); if (pool) pool.innerHTML = '';
    APTITUDES.forEach(apt => {
        const v = $(`roll-${apt}-val`); if (v) v.textContent = '—';
        const m = $(`roll-${apt}-mod`); if (m) m.textContent = '';
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
    $('btn-vs-back').addEventListener('click', hideViewSheet);
    $('btn-ps-back').addEventListener('click', hidePartySheet);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
    try {
        const [races, classes, skills, backgrounds, birthmothersigns, aptitudes, spells] = await Promise.all([
            loadJSON('data/heroes/races.json'),
            loadJSON('data/heroes/classes.json'),
            loadJSON('data/heroes/skills.json'),
            loadJSON('data/heroes/backgrounds.json'),
            loadJSON('data/mechanics/birthmothersigns.json'),
            loadJSON('data/heroes/aptitudes.json'),
            loadJSON('data/combat/attacks_and_spells.json'),
        ]);
        DB = { races, classes, skills, backgrounds, birthmothersigns, aptitudes, spells };

        initTooltip();
        buildRaceSelect();
        buildClassSelect();
        buildBackgroundSelect();
        wireGender();
        wireLevel();
        buildBirthSignSelect();
        buildAptitudeScores();
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
