// ═══════════════════════════════════════════════════════════════════════════════
// settlement.js — Leonoria settlement hub panel (game.html only)
//
// Opens when the party enters a Settlement hex on the overworld. Services
// scale with settlement type via FantasyMap._settlementAmenities. Acts
// directly on GameState; the caller passes an onChange callback for HUD
// refresh + save. See GAMEPLAN.md phase 3.
// ═══════════════════════════════════════════════════════════════════════════════

window.Settlement = (() => {
    'use strict';

    const $ = id => document.getElementById(id);

    // Rest / provision prices by settlement weight class
    const PRICES = {
        small:  { rest: 4,  foodPerDay: 2, temple: 0  },   // village, camp…
        medium: { rest: 8,  foodPerDay: 2, temple: 12 },   // town, market town
        large:  { rest: 15, foodPerDay: 3, temple: 18 },   // city, capital, port city
    };

    function _sizeClass(type) {
        if (['capital', 'city', 'port_city', 'fortress'].includes(type)) return 'large';
        if (['town', 'market_town', 'port'].includes(type))              return 'medium';
        return 'small';
    }

    function _findSettlement(name) {
        const list = window.MapSaveStore?.lastSaved?.jsonData?.settlements ?? [];
        return list.find(s => s.name === name) ?? null;
    }

    // ── Panel rendering ──────────────────────────────────────────────────────
    let _onChange = null;

    function open(cell, onChange) {
        _onChange = onChange ?? null;
        const s     = GameState.get();
        const name  = cell.settlement_name ?? 'Settlement';
        const info  = _findSettlement(name);
        const type  = info?.type ?? 'village';
        const size  = _sizeClass(type);
        const price = PRICES[size];
        const amen  = window.FantasyMap?._settlementAmenities?.(type) ?? {};

        $('sp-name').textContent = name;
        $('sp-type').textContent = type.replace(/_/g, ' ');

        const wounded = Object.keys(s.party.hp ?? {}).length > 0;

        const rows = [];
        rows.push(_action('rest',
            `🛏 Rest at the inn — ${price.rest} gold`,
            `Sleep until morning. Heals all wounds.`,
            s.party.gold >= price.rest));

        rows.push(_action('food',
            `🍞 Buy provisions (7 days) — ${price.foodPerDay * 7} gold`,
            `Rations for the road. You have ${s.party.food} days left.`,
            s.party.gold >= price.foodPerDay * 7));

        if (amen.temple && price.temple > 0) {
            rows.push(_action('temple',
                `⛪ Temple healing — ${price.temple} gold`,
                wounded ? 'The priests tend your wounds at once.' : 'Your party is unhurt.',
                s.party.gold >= price.temple && wounded));
        }

        // Rumors at the inn — quest offers from the procedural generator
        _offers = {};
        const offers = window.Quests ? Quests.offers(name, 2) : [];
        if (offers.length) {
            rows.push('<div class="sp-rumor">🍺 Rumors at the inn:</div>');
            for (const o of offers) {
                _offers[o.id] = o;
                rows.push(`<button data-offer="${o.id}">
                    <span class="sp-act-label">◈ ${o.title} — ${o.reward.gold} gold</span>
                    <span class="sp-act-sub">${o.desc}</span>
                </button>`);
            }
        } else {
            rows.push('<div class="sp-rumor">🍺 <em>A quiet night — no rumors worth chasing.</em></div>');
        }

        $('sp-actions').innerHTML = rows.join('');
        $('settlement-panel').hidden = false;

        $('sp-actions').onclick = e => {
            const btn = e.target.closest('button[data-act], button[data-offer]');
            if (!btn || btn.disabled) return;
            if (btn.dataset.offer) {
                const o = _offers[btn.dataset.offer];
                if (o && Quests.accept(o)) {
                    if (_onChange) _onChange();
                    open({ settlement_name: $('sp-name').textContent }, _onChange);
                }
                return;
            }
            _act(btn.dataset.act, price);
        };
    }

    let _offers = {};   // offer id → offer object for the open panel

    function _action(act, label, sub, enabled) {
        return `<button data-act="${act}" ${enabled ? '' : 'disabled'}>
            <span class="sp-act-label">${label}</span>
            <span class="sp-act-sub">${sub}</span>
        </button>`;
    }

    // ── Service actions ──────────────────────────────────────────────────────
    function _act(act, price) {
        const s = GameState.get();

        if (act === 'rest') {
            s.party.gold -= price.rest;
            s.party.hp    = {};                 // all wounds healed
            s.world.day  += 1;
            s.world.hour  = 7;                  // wake at dawn
        } else if (act === 'food') {
            s.party.gold -= price.foodPerDay * 7;
            s.party.food += 7;
        } else if (act === 'temple') {
            s.party.gold -= price.temple;
            s.party.hp    = {};
        }

        GameState.save();
        if (_onChange) _onChange();
        // Re-render with updated gold/food/wounds — reuse the open cell header
        const cellStub = { settlement_name: $('sp-name').textContent };
        open(cellStub, _onChange);
    }

    function close() {
        $('settlement-panel').hidden = true;
    }

    return { open, close };
})();
