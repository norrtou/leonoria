// ═══════════════════════════════════════════════════════════════════════════════
// loot.js — Leonoria battle loot (game.html only)
//
// Rolls drops after victories: trophies (always, sellable) and occasionally a
// weapon named from the real weapon system (weapons × materials × quality,
// data/items/*). v1: loot items are treasure to sell at traders — per-member
// weapon equipping comes later (see GAMEPLAN.md).
// ═══════════════════════════════════════════════════════════════════════════════

window.Loot = (() => {
    'use strict';

    let _weapons = null, _materials = null, _qualities = null, _nameFmt = null;

    async function load() {
        if (_weapons) return;
        try {
            const [w1, w2, wr, mat, qual] = await Promise.all([
                fetch('data/items/weapons_melee_1h.json').then(r => r.json()),
                fetch('data/items/weapons_melee_2h.json').then(r => r.json()),
                fetch('data/items/weapons_ranged.json').then(r => r.json()),
                fetch('data/items/weapon_materials.json').then(r => r.json()),
                fetch('data/items/weapon_quality_system.json').then(r => r.json()),
            ]);
            _weapons   = [ ...(w1.weapons ?? []), ...(w2.weapons ?? []), ...(wr.bows ?? []) ];
            _materials = mat.materials ?? [];
            _qualities = qual.quality_classes ?? [];
            _nameFmt   = qual.display_name_format ?? null;
        } catch (e) {
            console.warn('[Loot] weapon data unavailable', e);
            _weapons = []; _materials = []; _qualities = [];
        }
    }

    function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    // Quality weights: mostly plain, rarely fine/rare
    function _rollQuality() {
        const r = Math.random();
        const id = r < 0.35 ? 'simple' : r < 0.75 ? 'normal' : r < 0.92 ? 'fine' : 'rare';
        return _qualities.find(q => q.id === id) ?? _qualities[0];
    }

    function _weaponName(weapon, material, quality) {
        const fmt = _nameFmt?.[quality.id] ?? '{material} {weapon_name}';
        return fmt
            .replace('{quality}',     quality.name ?? '')
            .replace('{material}',    material.name ?? '')
            .replace('{weapon_name}', weapon.name ?? 'Weapon')
            .trim();
    }

    function _rollWeapon() {
        if (!_weapons.length || !_materials.length || !_qualities.length) return null;
        const weapon   = _pick(_weapons);
        const material = _pick(_materials);
        const quality  = _rollQuality();
        const dmgAvg   = ((weapon.base_dmg_range?.[0] ?? 2) + (weapon.base_dmg_range?.[1] ?? 8)) / 2;
        const value    = Math.max(3, Math.round(
            8 * dmgAvg * (material.cost_multiplier ?? 1) * (quality.cost_multiplier ?? 1)));
        return { kind: 'weapon', name: _weaponName(weapon, material, quality), value };
    }

    // Drops for one victory. `enc` is the encounter object ({label, tier}).
    function roll(enc, slainEnemies) {
        const drops = [];
        const tierMult = enc.tier === 'boss' ? 4 : enc.tier === 'uncommon' ? 2 : 1;

        drops.push({
            kind:  'trophy',
            name:  `${enc.label} trophies`,
            value: (4 + Math.floor(Math.random() * 8)) * tierMult
                   + Math.max(0, slainEnemies - 1) * 2,
        });

        const weaponChance = enc.tier === 'boss' ? 1.0 : enc.tier === 'uncommon' ? 0.4 : 0.2;
        if (Math.random() < weaponChance) {
            const w = _rollWeapon();
            if (w) drops.push(w);
        }
        return drops;
    }

    return { load, roll };
})();
