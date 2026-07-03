// ═══════════════════════════════════════════════════════════════════════════════
// encounter.js — Leonoria overworld encounter rolls (game.html only)
//
// After each completed overworld move, Encounter.roll() decides whether the
// party is ambushed and, if so, builds an enemy roster from the biome's
// bestiary (data/monsters/biomebestiary.json, keyed by biome_id).
//
// v1 scope (see GAMEPLAN.md phase 2): encounter names come from the bestiary,
// combat archetypes map onto the battle map's existing melee/ranged unit types.
// Rare bosses are reserved for quests (phase 4).
// ═══════════════════════════════════════════════════════════════════════════════

window.Encounter = (() => {
    'use strict';

    let _bestiary = null;   // biome_id → native_bestiary

    async function load() {
        if (_bestiary) return;
        try {
            const data = await fetch('data/monsters/biomebestiary.json').then(r => r.json());
            _bestiary = {};
            for (const b of data) _bestiary[b.biome_id] = b.native_bestiary ?? {};
        } catch (e) {
            console.warn('[Encounter] bestiary unavailable', e);
            _bestiary = {};
        }
    }

    // ── Risk model ───────────────────────────────────────────────────────────
    // Returns the encounter chance (0..1) for one completed move ending on `cell`.
    function _risk(cell, timeOfDay) {
        // Safe ground: settlements, and anything on a real road
        if (cell.terrain_type === 'Settlement') return 0;
        const feats = cell.features ?? [];
        if (feats.includes('Major Road')) return 0.02;
        if (feats.includes('Road'))       return 0.04;

        let risk = 0.10;                                   // open wilderness baseline
        if (feats.includes('Trail'))              risk = 0.07;
        if (cell.terrain_type === 'Forest' ||
            cell.terrain_type === 'Wetland')      risk += 0.04;
        if (cell.terrain_type === 'Mountain' ||
            cell.terrain_type === 'Hills')        risk += 0.03;
        if (timeOfDay === 'night')                risk += 0.08;
        else if (timeOfDay === 'dusk' ||
                 timeOfDay === 'dawn')            risk += 0.03;
        return Math.min(risk, 0.30);
    }

    // ── Roster building ──────────────────────────────────────────────────────
    // Ranged-flavored names get the ranged archetype; roughly 1 in 3 otherwise.
    function _role(name, i) {
        if (/archer|bow|hunter|stalker|sniper/i.test(name)) return 'ranged';
        return (i % 3 === 2) ? 'ranged' : 'melee';
    }

    function _buildRoster(biomeId, partySize) {
        const b = _bestiary?.[biomeId] ?? {};
        const common   = b.common   ?? [];
        const uncommon = b.uncommon ?? [];
        if (!common.length && !uncommon.length) return null;

        // 20% of encounters draw from the uncommon tier
        const uncommonFight = uncommon.length > 0 && Math.random() < 0.20;
        const pool  = uncommonFight ? uncommon : (common.length ? common : uncommon);
        const label = pool[Math.floor(Math.random() * pool.length)];

        // Group size: scaled to party, uncommon foes come in smaller numbers
        const base  = Math.max(2, Math.min(partySize, 6));
        const count = uncommonFight
            ? Math.max(2, base - 1 + Math.floor(Math.random() * 2))   // base-1 .. base
            : base + Math.floor(Math.random() * 3);                    // base .. base+2

        const roster = [];
        for (let i = 0; i < Math.min(count, 9); i++)
            roster.push({ name: label, role: _role(label, i) });

        return { label, tier: uncommonFight ? 'uncommon' : 'common', roster };
    }

    // ── Public roll ──────────────────────────────────────────────────────────
    // cell: hex cell the party just entered; returns encounter or null.
    function roll({ cell, biomeId, timeOfDay, partySize }) {
        if (!cell || !_bestiary) return null;
        if (Math.random() >= _risk(cell, timeOfDay)) return null;
        return _buildRoster(biomeId, partySize ?? 3);
    }

    // Monster pools for a biome — used by the quest generator (quests.js)
    function pools(biomeId) {
        const b = _bestiary?.[biomeId] ?? {};
        return {
            common:   b.common      ?? [],
            uncommon: b.uncommon    ?? [],
            rare:     b.rare_bosses ?? [],
        };
    }

    return { load, roll, pools };
})();
