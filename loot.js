// ═══════════════════════════════════════════════════════════════════════════════
// loot.js — Leonoria battle loot (game.html only)
//
// Rolls drops after victories: trophies (always, sellable) and occasionally a
// weapon from the real weapon system (weapons × materials × quality,
// data/items/*). Weapon items carry combat stats (dmg range after material ×
// quality multipliers, dominant damage type from damage_distribution) so they
// can be equipped per party member (equipment.js).
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

    // Which materials fit a weapon's material_group (weapon_materials.json
    // allowed_weapon_categories uses a different taxonomy, so map explicitly)
    function _materialsFor(weapon) {
        const group = weapon.material_group;
        const fits = m => {
            const cats = m.allowed_weapon_categories ?? [];
            if (group === 'all_metals')       return cats.includes('all_metals');
            if (group === 'wooden_only')      return m.id === 'wooden';
            if (group === 'bone_only')        return m.id === 'bone';
            if (group === 'stone_only')       return m.id === 'stone';
            if (group === 'clubs_and_staves') return ['wooden', 'bone', 'stone'].includes(m.id);
            return true;
        };
        const list = _materials.filter(fits);
        return list.length ? list : _materials;
    }

    let _itemSeq = 0;
    const _itemId = () => `it_${Date.now().toString(36)}_${_itemSeq++}`;

    function _rollWeapon() {
        if (!_weapons.length || !_materials.length || !_qualities.length) return null;
        const weapon  = _pick(_weapons);
        const quality = _rollQuality();
        const isBow   = weapon.tooltip_category === 'Bow';
        // Bows come as fixed wood types (ash, yew…) — no material roll
        const material = isBow ? null : _pick(_materialsFor(weapon));

        // Damage: base range × material damage_multiplier × quality roll
        // multipliers. Bows add damage_bonus_range on top of an arrow baseline.
        const base = isBow
            ? [3 + (weapon.damage_bonus_range?.[0] ?? 0), 9 + (weapon.damage_bonus_range?.[1] ?? 2)]
            : [weapon.base_dmg_range?.[0] ?? 2, weapon.base_dmg_range?.[1] ?? 8];
        const matMult = material?.damage_multiplier ?? 1;
        const qMin = quality.damage_roll_multiplier?.min ?? 1;
        const qMax = quality.damage_roll_multiplier?.max ?? 1;
        const dmgMin = Math.max(1, Math.round(base[0] * matMult * qMin));
        const dmgMax = Math.max(dmgMin + 1, Math.round(base[1] * matMult * qMax));

        // Dominant damage type from the weapon's damage_distribution
        const dist = weapon.damage_distribution ?? [];
        const damageType = dist.length
            ? dist.reduce((a, b) => (b.percent ?? 0) > (a.percent ?? 0) ? b : a).type
            : 'Physical';

        // Value from the BASE damage average — material/quality rarity is
        // already priced in via the cost multipliers (using the multiplied
        // damage here would double-count and explode rare-drop prices)
        const baseAvg = (base[0] + base[1]) / 2;
        const value   = Math.max(3, Math.round(
            8 * baseAvg * (material?.cost_multiplier ?? 1) * (quality.cost_multiplier ?? 1)));

        const name = isBow
            ? `${quality.id === 'normal' ? '' : (quality.name ?? '') + ' '}${weapon.name}`.trim()
            : _weaponName(weapon, material, quality);

        return {
            kind: 'weapon', id: _itemId(), name, value,
            weaponId: weapon.id, category: weapon.tooltip_category ?? 'Blade',
            material: material?.id ?? weapon.material ?? null, quality: quality.id,
            dmg: [dmgMin, dmgMax], damageType,
            ranged: isBow, reach: isBow ? 12 : (Number(weapon.reach_hex) || 1),
            hands: weapon.hands ?? 1,
            equippedBy: null,
        };
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
