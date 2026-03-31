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

const TAB_ORDER = ['identity', 'attributes', 'skills', 'equipment'];

// ─── Aptitude descriptions (tooltip) ──────────────────────────────────────────
const APTITUDE_DESC = {
    conviction:
        'Mental and spiritual strength. Governs willpower, faith, resilience against dark forces, and the ability to sustain magical effort. Sub-traits: Tenacity, Resonance, Openness (fixed at creation).',
    physiology:
        'Physical body and durability. Governs Vitality (HP), physical Hardening (resistances), Vigor (raw strength), and Metabolism (stamina).',
    cognition:
        'Mental acuity and life experience. Governs Erudition, Ingenuity, Worldliness, Perception, and Intelligence (fixed). Grows with age indefinitely.',
    materium_affinity:
        'Attunement to the world\'s magical energy. Governs Conduit Grade, Shadow Connection, and magic Insulation. Distinct from the Materium pool resource which is depleted by spellcasting.',
    martial_experience:
        'Combat training, reflexes, and weapon mastery. Governs Agilities (dodge/reflex) and Weapon Affinities. Increases faster with use than other aptitudes.',
    presence:
        'Force of personality and social command. Governs Gravitas (authority) and Eloquence (persuasion). Filtered by the Openness sub-trait of Conviction.',
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
    ravager_class:      'Overwhelm. Destroy. Move on. The Ravager does not defend — they overwhelm before defense is needed.',
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
        position: 'fixed', maxWidth: '260px',
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
        const x = Math.min(e.clientX + 16, window.innerWidth  - 280);
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
            opt.textContent = race.name;
            og.appendChild(opt);
        });
        sel.appendChild(og);
    });

    sel.addEventListener('change', e => {
        S.race    = e.target.value || null;
        S.subrace = null;
        $('row-subrace').style.display = 'none';
        $('sel-subrace').innerHTML = '';
        updateDerivedStats();
        updateFlavorText();
    });
}

// ─── Class select ─────────────────────────────────────────────────────────────
function buildClassSelect() {
    const sel = $('sel-class');
    sel.innerHTML = '<option value="">— Choose Class —</option>';

    const archetypeOrder = ['Physical', 'Scout', 'Faith', 'Elemental', 'Dark', 'Social', 'Craft'];
    const groups = {};
    (DB.classes?.classes || []).forEach(cls => {
        const arch = cls.archetype || 'Other';
        if (!groups[arch]) groups[arch] = [];
        groups[arch].push(cls);
    });

    // Sort by archetype order, then alphabetically for unlisted
    const sortedArchetypes = [
        ...archetypeOrder.filter(a => groups[a]),
        ...Object.keys(groups).filter(a => !archetypeOrder.includes(a)).sort(),
    ];

    sortedArchetypes.forEach(arch => {
        const og = document.createElement('optgroup');
        og.label = arch;
        groups[arch].forEach(cls => {
            const opt = document.createElement('option');
            opt.value = cls.id;
            opt.textContent = cls.name;
            og.appendChild(opt);
        });
        sel.appendChild(og);
    });

    sel.addEventListener('change', e => {
        const id = e.target.value;
        S.cls      = id || null;
        S.subclass = null;
        $('row-subclass').style.display = 'none';
        $('sel-subclass').innerHTML = '';
        applyDefaultAptitudes();
        buildSkillRows();
        applyDefaultSkills();
        updateDerivedStats();
        updateFlavorText();
        updateInventory();
        updateEquipGoldHint();
    });
    $('sel-subclass').addEventListener('change', e => { S.subclass = e.target.value || null; });
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

    // Group skills by category
    (DB.skills?.categories || []).forEach(cat => {
        const catSkills = cat.skills || [];
        if (!catSkills.length) return;

        const header = el('div', 'sk-category-header');
        header.textContent = `${cat.category} [${aptShort(cat.aptitude_link)}]`;
        grid.appendChild(header);

        catSkills.forEach(sk => {
            const isFixed    = fixed.has(sk.id);
            const inChoices  = !choiceSet || choiceSet.has(sk.id);
            const disabled   = cls && !isFixed && !inChoices;

            const row = el('div', `skill-row${disabled ? ' sk-disabled' : ''}${isFixed ? ' sk-fixed' : ''}`);
            row.dataset.name = sk.id;

            const check = el('span', 'sk-check'); row.appendChild(check);
            const name  = el('span', 'sk-name');  name.textContent = sk.name; row.appendChild(name);
            const ab    = el('span', 'sk-ab');    ab.textContent   = aptShort(cat.aptitude_link); row.appendChild(ab);

            const desc = SKILL_DESC[sk.id] || sk.description;
            if (desc) {
                row.addEventListener('mouseenter', e => showTip(e, desc));
                row.addEventListener('mouseleave', hideTip);
            }

            if (!disabled) {
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
            }
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
            p.textContent = aptShort(id);
            p.title = aptName(id);
            savesRow.appendChild(p);
        });
    }

    // Identity line
    const raceData  = race;
    const raceName  = raceData ? raceData.name : (S.race ? S.race.replace(/_/g, ' ') : null);
    const clsName   = cls ? cls.name : null;
    const parts = [];
    if (raceName) parts.push(raceName);
    if (clsName)  parts.push(S.subclass || clsName);
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

    const raceBlurb  = S.race ? (RACE_BLURBS[S.race]  || (raceData?.description) || `The ${raceName} are a proud and storied people.`) : '';
    const classBlurb = S.cls  ? (CLASS_BLURBS[S.cls]  || (clsData?.description)  || `The ${clsName} follows a path of power and purpose.`) : '';

    let html = '';
    if (S.race) html += `<strong>${raceName}.</strong> ${raceBlurb}`;
    if (S.race && S.cls) html += '<br><br>';
    if (S.cls)  html += `<strong>${clsName}.</strong> ${classBlurb}`;
    ft.innerHTML = html;
}

// ─── Background detail ────────────────────────────────────────────────────────
function updateBgDetail(bg) {
    const d = $('bg-detail-text');
    if (!bg) { d.textContent = 'Select a background to see its perks.'; return; }
    const parts = [];
    if (bg.flavor_trait) parts.push(`"${bg.flavor_trait}"`);
    if (bg.aptitude_modifier) {
        const mods = Object.entries(bg.aptitude_modifier)
            .map(([k, v]) => `${aptName(k)} ${v > 0 ? '+' : ''}${v}`).join(', ');
        if (mods) parts.push(`Aptitudes: ${mods}`);
    }
    if (bg.starting_skill_bonuses) {
        const allSk = getAllSkills();
        const skBonuses = Object.entries(bg.starting_skill_bonuses)
            .map(([id, v]) => {
                const sk = allSk.find(s => s.id === id);
                return `${sk ? sk.name : id} +${v}`;
            }).join(', ');
        if (skBonuses) parts.push(`Skills: ${skBonuses}`);
    }
    if (bg.starting_wealth_modifier) parts.push(`Wealth: ${bg.starting_wealth_modifier}`);
    if (bg.equipment_bonus?.length)  parts.push(`Gear: ${bg.equipment_bonus.join(', ')}`);
    d.textContent = parts.length ? parts.join(' · ') : bg.name;
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

    $('vs-name').textContent       = char.name || 'Unnamed Hero';
    $('vs-sub').textContent        = [`Lv${char.level}`, raceName, clsName, char.birthSign].filter(Boolean).join(' · ');
    $('vs-race').textContent       = raceName  || '—';
    $('vs-subrace').textContent    = char.subrace    || '—';
    $('vs-gender').textContent     = char.gender     || '—';
    $('vs-class').textContent      = clsName   || '—';
    $('vs-subclass').textContent   = char.subclass   || '—';
    $('vs-background').textContent = char.background || '—';
    $('vs-alignment').textContent  = char.birthSign  || 'No Sign (Childless)';
    $('vs-level').textContent      = char.level      || 1;
    const vsPortrait = $('vs-portrait-img');
    if (vsPortrait) {
        vsPortrait.src = portraitSrc;
        vsPortrait.alt = `${char.name || 'Character'} portrait`;
    }

    const abGrid = $('vs-ab-grid');
    abGrid.innerHTML = '';
    APTITUDES.forEach(apt => {
        const score = (char.aptitudes && char.aptitudes[apt]) || BASE_APTITUDE;
        const cell  = el('div', 'vs-ab-cell');
        const abbr  = el('span', 'vs-ab-abbr');  abbr.textContent  = aptShort(apt);
        const sc    = el('span', 'vs-ab-score');  sc.textContent    = score;
        const tier  = score >= 80 ? 'Leg' : score >= 60 ? 'Exp' : score >= 40 ? 'Sea' : score >= 20 ? 'Nov' : 'Unt';
        const t     = el('span', 'vs-ab-mod');    t.textContent     = tier;
        cell.append(abbr, sc, t);
        abGrid.appendChild(cell);
    });

    const allSk = getAllSkills();
    const skillNames = (char.skills && char.skills.length)
        ? char.skills.map(id => allSk.find(s => s.id === id)?.name || id).join(', ')
        : '—';
    $('vs-skills').textContent = skillNames;
    $('vs-equip').textContent  = char.equipment === 'gold' ? 'Starting Gold' : 'Starting Pack';

    // Update left panel derived stats
    const physVal = ((char.aptitudes || {}).physiology) || BASE_APTITUDE;
    const vitality = Math.round(40 + physVal * 0.6);
    const materiumPool = clsData?.materium_access ? `${clsData.materium_pool_start || 0} MP` : '—';
    const classTrait = clsData?.special_class_trait?.name || '—';
    const focusText = (clsData?.aptitude_priorities || [])
        .slice(0, 3)
        .map(ap => aptShort(ap.toLowerCase().replace(/ /g, '_')))
        .join(' · ') || '—';

    $('d-hp').textContent    = vitality;
    $('d-hd').textContent    = materiumPool;
    $('d-prof').textContent  = `Lv ${char.level}`;
    $('d-speed').textContent = classTrait;
    $('identity-line').textContent = [raceName, char.subclass || clsName].filter(Boolean).join(' · ') || 'Choose race & class';
    if ($('vs-vitality')) $('vs-vitality').textContent = vitality;
    if ($('vs-mpool')) $('vs-mpool').textContent = materiumPool;
    if ($('vs-focus')) $('vs-focus').textContent = focusText;
    if ($('vs-trait')) $('vs-trait').textContent = classTrait;

    const savesRow = $('saves-row');
    savesRow.innerHTML = '';
    (clsData?.aptitude_priorities || []).slice(0, 3).forEach(ap => {
        const id = ap.toLowerCase().replace(/ /g, '_');
        const p = el('span', 'save-pill'); p.textContent = aptShort(id); savesRow.appendChild(p);
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
        ['Mat. Pool',  clsData?.materium_access ? `${clsData.materium_pool_start || 0} MP` : '—'],
        ['Sign',       char.birthSign || 'No Sign'],
        ['Background', char.background || '—'],
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
    $('sel-subrace').innerHTML  = '';
    $('sel-subclass').innerHTML = '';
    $('row-subrace').style.display  = 'none';
    $('row-subclass').style.display = 'none';

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
        const [races, classes, skills, backgrounds, birthmothersigns, aptitudes] = await Promise.all([
            loadJSON('data/heroes/races.json'),
            loadJSON('data/heroes/classes.json'),
            loadJSON('data/heroes/skills.json'),
            loadJSON('data/heroes/backgrounds.json'),
            loadJSON('data/mechanics/birthmothersigns.json'),
            loadJSON('data/heroes/aptitudes.json'),
        ]);
        DB = { races, classes, skills, backgrounds, birthmothersigns, aptitudes };

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
