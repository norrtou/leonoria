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

    // Kingdom price profiles from economy.json (kingdom_economies). Kingdoms
    // only exist on Midlands maps — everywhere else falls back to neutral 1.0.
    let _econData = null;
    fetch('data/cultures/economy.json')
        .then(r => r.json())
        .then(d => { _econData = d.kingdom_economies ?? []; })
        .catch(() => { _econData = []; });

    function _econFor(kingdomId) {
        const e = (_econData ?? []).find(x => x.kingdom === kingdomId);
        return {
            inn:    e?.mult?.inn    ?? 1,
            goods:  e?.mult?.goods  ?? 1,
            temple: e?.mult?.temple ?? 1,
            sell:   e?.sell_rate    ?? 1,
            note:   e?.market_note  ?? '',
        };
    }

    function _findSettlement(name) {
        const list = window.MapSaveStore?.lastSaved?.jsonData?.settlements ?? [];
        return list.find(s => s.name === name) ?? null;
    }

    // Scene art for the panel header — picks from the landmarkimages set by
    // culture, biome and settlement type (same art pool as map.html's popup).
    function _artFor(info, biomeId) {
        const type = info?.type ?? 'village';
        const cult = String(info?.culture ?? '');
        const ctx  = String(info?.terrain_context ?? '');
        const art  = f => `assets/images/landmarkimages/${f}`;

        if (biomeId === 'the_forgotten_kingdom')
            return art(/orc|ravager|wildmen/.test(cult) ? 'orcunderdarktown.jpg' : 'humanunderdarktown.jpg');
        if (/orc|ravager|wildmen/.test(cult))            return art('orctown.jpg');
        if (/archon|ancient|secluded|grey/.test(cult))   return art('wizardtown.jpg');
        if (/mountain|hill/.test(ctx))                   return art('humanmountaintown.jpg');
        if (['capital', 'city', 'port_city', 'fortress'].includes(type)) return art('humancapital.jpg');
        if (type === 'market_town')                      return art('humanlargetown.jpg');
        if (['town', 'port'].includes(type))             return art('humansmalltown.jpg');
        if (type === 'fishing_village')                  return art('humansmalltown2.jpg');
        if (/forest/.test(ctx))                          return art('humancottage.jpg');
        return art('humancountryside.jpg');
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
        const amen  = window.FantasyMap?._settlementAmenities?.(type) ?? {};

        // Kingdom reputation: every 2 points of standing = 4% discount, cap 20%
        const kingdom = window.Quests?.kingdomOf?.(name) ?? null;
        const rep     = kingdom ? (s.reputation[kingdom.id] ?? 0) : 0;
        const mult    = 1 - Math.min(0.20, rep * 0.02);
        const econ    = _econFor(kingdom?.id);
        const base    = PRICES[size];
        const price   = {
            rest:       Math.max(1, Math.round(base.rest * econ.inn * mult)),
            foodPerDay: Math.max(1, Math.round(base.foodPerDay * econ.inn * mult)),
            temple:     base.temple > 0 ? Math.max(1, Math.round(base.temple * econ.temple * mult)) : 0,
            mult,
        };

        $('sp-name').textContent = name;
        $('sp-type').textContent = type.replace(/_/g, ' ') +
            (kingdom ? ` · ${kingdom.name}${rep > 0 ? ` (standing +${rep})` : ''}` : '');

        const img = $('sp-img');
        if (img) {
            img.src    = _artFor(info, GameState.get().world?.params?.biome);
            img.hidden = false;
            img.onerror = () => { img.hidden = true; };
        }

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

        // Trader — sell loot, buy party upgrades. Kingdom economy modulates
        // buy prices (goods) and what the trader pays for loot (sell_rate).
        if ((amen.traders ?? 0) > 0) {
            rows.push(`<div class="sp-rumor">⚖ At the trader:${econ.note ? ` <em>${econ.note}</em>` : ''}</div>`);

            // Equipped weapons stay with their wielders — only loose loot sells
            const sellable  = (s.party.inventory ?? []).filter(it => !it.equippedBy);
            const kept      = (s.party.inventory ?? []).length - sellable.length;
            const lootValue = Math.round(sellable.reduce((sum, it) => sum + (it.value ?? 0), 0) * econ.sell);
            price.sellValue = lootValue;
            rows.push(_action('sell',
                `🎒 Sell loot — earn ${lootValue} gold`,
                sellable.length
                    ? `${sellable.length} item${sellable.length !== 1 ? 's' : ''} in the pack.` +
                      (kept ? ` Equipped weapons (${kept}) stay.` : '')
                    : 'Nothing to sell.',
                sellable.length > 0));

            const g = s.party.gear;
            price.upgrade = {};
            const upgrades = [
                ['armor', `🛡 Reinforced armor (+8 max HP each)`,  60, g.armor, 8],
                ['oil',   `🗡 Weapon oils (+1 damage)`,            50, g.oil,   5],
                ['charm', `🧿 Warding charms (+2 dodge)`,          40, g.charm, 5],
            ];
            for (const [act, label, base, lvl, cap] of upgrades) {
                const cost = Math.max(1, Math.round(base * (lvl + 1) * econ.goods));
                price.upgrade[act] = cost;
                const capped = lvl >= cap;
                rows.push(_action(act,
                    capped ? `${label} — best available` : `${label} — ${cost} gold`,
                    `Level ${lvl}${capped ? ' (max)' : ` → ${lvl + 1}`}`,
                    !capped && s.party.gold >= cost));
            }
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
        } else if (act === 'sell') {
            s.party.gold += price.sellValue ?? 0;
            s.party.inventory = (s.party.inventory ?? []).filter(it => it.equippedBy);
        } else if (act === 'armor' || act === 'oil' || act === 'charm') {
            s.party.gold -= price.upgrade?.[act] ?? 0;
            s.party.gear[act] += 1;
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
