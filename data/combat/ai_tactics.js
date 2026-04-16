// ═══════════════════════════════════════════════════════════════════════════════
// AI Combat Tactics — Leonoria Battle Map
//
// Each entry in AI_TACTICS describes how a monster type thinks and moves.
// The battle-map engine reads this at runtime; add new monster types here
// without touching engine code.
//
// Fields
// ──────
// role              : 'melee' | 'ranged' | 'caster'
//                     Governs default target selection and attack-vs-advance logic.
//
// seekCover         : bool
//                     True → monster scores candidate hexes by how many ranged
//                     heroes lose clear LOS to it from there.  It actively hunts
//                     for positions behind obstacles or in the monster's own shadow.
//
// coverWeight       : number (0–1)
//                     Blended weight of cover benefit vs pure distance-to-target.
//                     0 = pure charge, 1 = pure cover-seeking.
//
// fearRanged        : bool
//                     When true the monster checks if it is already in clear LOS
//                     of any ranged hero.  If yes it will spend movement trying to
//                     break that LOS rather than closing distance, unless a melee
//                     hero is adjacent (ZoC override).
//
// zcOverride        : bool
//                     When a hero is within 1 hex (Zone of Control), tactical
//                     cover logic is suspended and the monster fights back.
//
// preferClosest     : bool
//                     True → always attack the hero with the lowest hex-distance.
//                     False → attack the lowest-HP hero in range.
//
// flankAngle        : bool
//                     True → if multiple hexes are equally good for cover, prefer
//                     the one that is not in a direct line between monster and target
//                     (approaches from the side rather than straight ahead).
//
// retreatBelowHpPct : number (0–1) | null
//                     If the monster's HP falls below this fraction it will try to
//                     move away from all heroes instead of closing.  null = never.
//
// notes             : string — designer notes, not read by the engine.
// ═══════════════════════════════════════════════════════════════════════════════

const AI_TACTICS = {

    // ── Goblin ─────────────────────────────────────────────────────────────────
    // Big melee grunt. Ignores ranged fire entirely — charges the most fragile
    // hero it can reach without hesitation.  High HP means it can take a beating.
    goblin: {
        role             : 'melee',
        seekCover        : false,
        coverWeight      : 0.05,
        fearRanged       : false,
        zcOverride       : true,
        preferClosest    : false,   // targets most vulnerable hero
        flankAngle       : false,
        retreatBelowHpPct: null,
        notes            : 'Aggressive charger. No cover-seeking. Hunts weakest hero.',
    },

    // ── Goblin Archer ─────────────────────────────────────────────────────────
    // Fragile ranged unit. Strongly prefers to hide behind obstacles before
    // shooting.  If cornered it will resort to a desperate weak claw attack.
    goblin_archer: {
        role             : 'ranged',
        seekCover        : true,
        coverWeight      : 0.80,
        fearRanged       : true,
        zcOverride       : true,
        preferClosest    : false,   // targets most vulnerable hero
        flankAngle       : true,
        retreatBelowHpPct: 0.30,   // flees when below 30% HP
        notes            : 'Cover-seeking ranged. Retreats early. Weak melee fallback.',
    },

    // ── Orc Warrior ────────────────────────────────────────────────────────────
    // Slow, armoured bruiser.  Ignores arrow fire (high armour) and charges
    // straight at the weakest target it can reach.
    orc: {
        role             : 'melee',
        seekCover        : false,
        coverWeight      : 0.10,
        fearRanged       : false,
        zcOverride       : true,
        preferClosest    : false,   // targets lowest HP
        flankAngle       : false,
        retreatBelowHpPct: null,
        notes            : 'Fearless melee. Ignores cover, hunts wounded heroes.',
    },

    // ── Orc Archer ─────────────────────────────────────────────────────────────
    // Ranged monster.  Tries to keep distance from melee heroes while maintaining
    // LOS on its chosen target.  Retreats when a warrior closes in.
    orc_archer: {
        role             : 'ranged',
        seekCover        : false,
        coverWeight      : 0.15,
        fearRanged       : false,
        zcOverride       : true,
        preferClosest    : false,
        flankAngle       : true,
        retreatBelowHpPct: 0.35,
        notes            : 'Ranged monster. Keeps distance, retreats when low HP.',
    },

    // ── Skeleton ───────────────────────────────────────────────────────────────
    // Mindless undead.  Charges the nearest target, ignores cover entirely.
    skeleton: {
        role             : 'melee',
        seekCover        : false,
        coverWeight      : 0.0,
        fearRanged       : false,
        zcOverride       : false,
        preferClosest    : true,
        flankAngle       : false,
        retreatBelowHpPct: null,
        notes            : 'No intelligence, pure aggression.',
    },

    // ── Troll ──────────────────────────────────────────────────────────────────
    // Massive and dumb.  Charges the closest hero but is frightened by magic.
    // Retreats at low HP.
    troll: {
        role             : 'melee',
        seekCover        : false,
        coverWeight      : 0.20,
        fearRanged       : false,
        zcOverride       : true,
        preferClosest    : true,
        flankAngle       : false,
        retreatBelowHpPct: 0.25,
        notes            : 'Large brute, retreats when badly hurt.',
    },

    // ── Dark Mage ──────────────────────────────────────────────────────────────
    // Spellcaster.  Stays at range, ducks behind cover from ranged heroes, and
    // targets the most dangerous (lowest dodge) enemy.
    dark_mage: {
        role             : 'caster',
        seekCover        : true,
        coverWeight      : 0.65,
        fearRanged       : true,
        zcOverride       : true,
        preferClosest    : false,
        flankAngle       : true,
        retreatBelowHpPct: 0.50,
        notes            : 'Caster AI: cover-seeking, avoids melee, retreats early.',
    },

    // ── Wolf ───────────────────────────────────────────────────────────────────
    // Fast flanker.  Ignores cover, moves to an angle on its target, pack animal
    // so flank preference is strong.
    wolf: {
        role             : 'melee',
        seekCover        : false,
        coverWeight      : 0.0,
        fearRanged       : false,
        zcOverride       : false,
        preferClosest    : true,
        flankAngle       : true,
        retreatBelowHpPct: null,
        notes            : 'Fast flanker, no cover, charges from the side.',
    },

};

// Make accessible globally (this file is loaded before battle-map.js)
if (typeof window !== 'undefined') window.AI_TACTICS = AI_TACTICS;
