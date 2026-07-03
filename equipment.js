// ═══════════════════════════════════════════════════════════════════════════════
// equipment.js — Leonoria per-member weapon equipping (game.html only)
//
// Panel: party members on top (click to select), looted weapons below (click
// to equip on the selected member). Equipped weapons override the member's
// default physical attack in battle (see LeonoriaBattle.start) and are kept
// when selling loot at traders.
//
// Weapon icons: game-icons.net (CC BY 3.0) — see CREDITS.md.
// ═══════════════════════════════════════════════════════════════════════════════

window.Equipment = (() => {
    'use strict';

    const $ = id => document.getElementById(id);

    // tooltip_category → assets/images/weaponicons/<key>.svg
    const ICON_KEYS = {
        'Axe': 'axe', 'Blade': 'blade', 'Bow': 'bow', 'Chain': 'chain',
        'Club': 'club', 'Fist Weapon': 'fist', 'Flail': 'flail',
        'Hammer': 'hammer', 'Improvised': 'improvised', 'Mace': 'mace',
        'Mounted': 'mounted', 'Pick': 'pick', 'Polearm': 'polearm',
        'Spear': 'spear', 'Staff': 'staff', 'Sword': 'sword',
        'Thrown': 'thrown', 'Whip': 'whip',
    };

    function iconFor(item) {
        const key = item?.kind === 'weapon' ? (ICON_KEYS[item.category] ?? 'sword') : 'trophy';
        return `assets/images/weaponicons/${key}.svg`;
    }

    // charId → equipped weapon item (from the party inventory)
    function equippedFor(state) {
        const map = {};
        for (const it of state?.party?.inventory ?? []) {
            if (it.kind === 'weapon' && it.equippedBy) map[it.equippedBy] = it;
        }
        return map;
    }

    // ── Panel ────────────────────────────────────────────────────────────────
    let _onChange = null;
    let _selected = null;   // selected member charId

    function open(onChange, selectId = null) {
        _onChange = onChange ?? _onChange;
        const s = GameState.get();
        if (!s) return;
        if (selectId && s.party.members.some(m => m.id === selectId)) _selected = selectId;
        if (!_selected || !s.party.members.some(m => m.id === _selected)) {
            _selected = s.party.members[0]?.id ?? null;
        }
        render(s);
        $('equip-panel').hidden = false;
    }

    function close() { $('equip-panel').hidden = true; }

    function render(s) {
        const equipped = equippedFor(s);

        // Member cards
        const members = s.party.members.map(m => {
            const eq = equipped[m.id];
            const sel = m.id === _selected;
            return `<button class="eq-member ${sel ? 'eq-selected' : ''}" data-member="${m.id}">
                <img class="eq-portrait" src="${m.portrait || 'assets/images/characterportraits/ashenfemale.jpg'}" alt="">
                <span class="eq-mname">${m.name || '—'}</span>
                <span class="eq-mclass">${(m.cls || '').replace(/_/g, ' ')}</span>
                <span class="eq-mweapon">
                    ${eq ? `<img class="eq-icon" src="${iconFor(eq)}" alt=""> ${eq.name}
                            <span class="eq-dmg">${eq.dmg[0]}–${eq.dmg[1]}</span>`
                         : '<em>skill training only</em>'}
                </span>
                ${eq ? `<span class="eq-unequip" data-unequip="${m.id}" title="Unequip">✕</span>` : ''}
            </button>`;
        }).join('');
        $('eq-members').innerHTML = members;

        // Armory: weapons in the pack (equipped ones marked), trophies greyed
        const weapons  = (s.party.inventory ?? []).filter(it => it.kind === 'weapon');
        const trophies = (s.party.inventory ?? []).filter(it => it.kind !== 'weapon');
        const holder = id => s.party.members.find(m => m.id === id)?.name ?? '';

        let rows = weapons.map(it => `
            <button class="eq-weapon ${it.equippedBy ? 'eq-inuse' : ''}" data-item="${it.id}">
                <img class="eq-icon" src="${iconFor(it)}" alt="">
                <span class="eq-wname">${it.name}</span>
                <span class="eq-wstats">${it.dmg[0]}–${it.dmg[1]} ${it.damageType}${it.ranged ? ' · ranged' : ''}</span>
                <span class="eq-wsub">${it.equippedBy
                    ? `wielded by ${holder(it.equippedBy)}`
                    : `⛁ ${it.value} · click to equip`}</span>
            </button>`).join('');

        if (!weapons.length) {
            rows += '<div class="eq-note"><em>No weapons in the pack — victories sometimes yield them.</em></div>';
        }
        if (trophies.length) {
            const tv = trophies.reduce((sum, t) => sum + (t.value ?? 0), 0);
            rows += `<div class="eq-note"><img class="eq-icon" src="assets/images/weaponicons/trophy.svg" alt="">
                ${trophies.length} trophy lot${trophies.length !== 1 ? 's' : ''} worth ⛁ ${tv} — sell at a trader</div>`;
        }
        $('eq-armory').innerHTML = rows;
    }

    function _equip(itemId) {
        const s  = GameState.get();
        const it = (s.party.inventory ?? []).find(i => i.id === itemId);
        if (!it || it.kind !== 'weapon' || !_selected) return;

        if (it.equippedBy === _selected) {
            it.equippedBy = null;                       // toggle off
        } else {
            for (const other of s.party.inventory) {    // one weapon per member
                if (other.kind === 'weapon' && other.equippedBy === _selected) other.equippedBy = null;
            }
            it.equippedBy = _selected;                  // steals from previous holder
        }
        GameState.save();
        render(s);
        if (_onChange) _onChange();
    }

    function _unequip(charId) {
        const s = GameState.get();
        for (const it of s.party.inventory ?? []) {
            if (it.kind === 'weapon' && it.equippedBy === charId) it.equippedBy = null;
        }
        GameState.save();
        render(s);
        if (_onChange) _onChange();
    }

    function init() {
        $('eq-close').addEventListener('click', close);
        $('eq-members').addEventListener('click', e => {
            const un = e.target.closest('[data-unequip]');
            if (un) { _unequip(un.dataset.unequip); return; }
            const card = e.target.closest('[data-member]');
            if (card) { _selected = card.dataset.member; render(GameState.get()); }
        });
        $('eq-armory').addEventListener('click', e => {
            const row = e.target.closest('[data-item]');
            if (row) _equip(row.dataset.item);
        });
    }

    return { open, close, init, iconFor, equippedFor };
})();
