// ═══════════════════════════════════════════════════════════════════════════════
// quests.js — Leonoria procedural quests (game.html only)
//
// Quest grammar v1 (see GAMEPLAN.md phase 4). Three independent axes:
//   skeleton (quest type) × place (real landmarks/settlements from the
//   generated map) × opposition (biome bestiary via Encounter.pools).
//
// Types: hunt (slay a rare beast at a landmark), clear (drive uncommon foes
// from a landmark), delivery (bring goods to another settlement).
// Quests live in GameState.quests.active / .completed.
// ═══════════════════════════════════════════════════════════════════════════════

window.Quests = (() => {
    'use strict';

    let _nextId = 1;
    const _offerCache = {};   // `${settlement}:${day}` → offers (stable per visit day)

    function _mapData() { return window.MapSaveStore?.lastSaved?.jsonData ?? null; }

    // ── Campaign flavor (data/campaigns/leonoria_campaigns.json) ─────────────
    // Campaign seeds keyed by primary_biome color quest text with the biome's
    // factions/loot, and give the main quest its hook. Purely cosmetic —
    // biomes without a campaign seed keep the plain descriptions.

    let _campaigns = null;   // biome_id → [campaign seeds]
    async function loadCampaigns() {
        if (_campaigns) return;
        _campaigns = {};
        try {
            const data = await fetch('data/campaigns/leonoria_campaigns.json').then(r => r.json());
            for (const list of Object.values(data.campaigns ?? {}))
                for (const c of list)
                    (_campaigns[c.primary_biome] ??= []).push(c);
        } catch (_) { /* flavor is optional */ }
    }

    function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    function _campaign() {
        const list = _campaigns?.[GameState.get()?.world.params.biome];
        return list?.length ? _pick(list) : null;
    }

    // One flavor sentence in the biome campaign's voice, appended to the desc.
    function _flavor(type) {
        const c = _campaign();
        if (!c) return '';
        const faction = _pick(c.key_factions ?? ['locals']).replace(/\s*\(.*\)$/, '');
        const loot    = (c.loot_profile ?? []).length ? _pick(c.loot_profile).toLowerCase() : null;
        const lines = {
            hunt: [
                `The ${faction} have already lost hunters to it.`,
                `The ${faction} pay well for proof of its death.`,
                ...(loot ? [`They say its lair is littered with ${loot}.`] : []),
            ],
            clear: [
                `The ${faction} want the place back.`,
                `Even the ${faction} refuse to go near it now.`,
                ...(loot ? [`Whoever holds it controls the ${loot} trade.`] : []),
            ],
            delivery: [
                `The crate bears the seal of the ${faction}. Do not open it.`,
                `The ${faction} ask no questions, and expect none in return.`,
            ],
            delve: [
                `The ${faction} sealed the lower halls long ago. The seal has not held.`,
                `Whatever the ${faction} left down there, it is waking.`,
                ...(loot ? [`Old records speak of ${loot} in the depths.`] : []),
            ],
        };
        const pool = lines[type];
        return pool?.length ? ' ' + _pick(pool) : '';
    }

    // Straight-line hex distance approximation — good enough for HUD display
    // and offer filtering (path cost varies with terrain anyway).
    function _dist(q1, r1, q2, r2) {
        return Math.round(Math.hypot(q2 - q1, r2 - r1));
    }

    function _dirArrow(dq, dr) {
        const a = Math.atan2(dr, dq);   // screen coords: +r is down/south
        const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
        return arrows[Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8];
    }

    // ── Offer generation ─────────────────────────────────────────────────────
    function offers(originName, count = 2) {
        const s   = GameState.get();
        const map = _mapData();
        if (!s || !map) return [];

        _currentOrigin = originName;
        const key = `${originName}:${s.world.day}`;
        if (_offerCache[key]) return _offerCache[key].filter(o => !_isActive(o));

        const pos     = s.world.position ?? { q: 0, r: 0 };
        const pool    = Encounter.pools(s.world.params.biome);
        const activeTargets = new Set(s.quests.active.map(q => q.target.name));

        // Candidate landmarks at a worthwhile-journey distance
        const allLandmarks = (map.landmarks ?? [])
            .filter(lm => !activeTargets.has(lm.name))
            .map(lm => ({ ...lm, dist: _dist(pos.q, pos.r, lm.q, lm.r) }))
            .filter(lm => lm.dist >= 5 && lm.dist <= 45)
            .sort(() => Math.random() - 0.5);
        const ruins     = allLandmarks.filter(lm => lm.category === 'ruin');
        const landmarks = allLandmarks.filter(lm => lm.category !== 'ruin');

        const settlements = (map.settlements ?? [])
            .filter(st => st.name !== originName && !activeTargets.has(st.name))
            .map(st => ({ ...st, dist: _dist(pos.q, pos.r, st.q, st.r) }))
            .filter(st => st.dist >= 5 && st.dist <= 45)
            .sort(() => Math.random() - 0.5);

        const out = [];

        // Delve — something stirs beneath a ruin (fought in dungeon mode)
        if (ruins.length && Math.random() < 0.5) {
            const lm  = ruins.shift();
            const foe = pool.uncommon[Math.floor(Math.random() * pool.uncommon.length)]
                     ?? pool.common[0] ?? 'Restless Dead';
            out.push({
                ..._quest('delve', lm, foe, [
                    { name: `Keeper of ${lm.name}`, role: 'melee', boss: true },
                    { name: foe, role: 'melee' },
                    { name: foe, role: 'melee' },
                    { name: foe, role: 'ranged' },
                ], 1.3),
                dungeon: true,
            });
        }

        // Hunt — a rare beast lairs at a landmark
        if (pool.rare.length && landmarks.length) {
            const lm    = landmarks.shift();
            const beast = pool.rare[Math.floor(Math.random() * pool.rare.length)];
            out.push(_quest('hunt', lm, beast, [
                { name: beast, role: 'melee', boss: true },
                { name: 'Spawn of ' + beast, role: 'melee' },
                { name: 'Spawn of ' + beast, role: 'ranged' },
            ], 1.6));
        }

        // Clear — uncommon foes infest a landmark
        if (out.length < count && pool.uncommon.length && landmarks.length) {
            const lm  = landmarks.shift();
            const foe = pool.uncommon[Math.floor(Math.random() * pool.uncommon.length)];
            const n   = 4 + Math.floor(Math.random() * 3);
            const roster = [];
            for (let i = 0; i < n; i++)
                roster.push({ name: foe, role: i % 3 === 2 ? 'ranged' : 'melee' });
            out.push(_quest('clear', lm, foe, roster, 1.0));
        }

        // Delivery — goods to another settlement
        if (out.length < count && settlements.length) {
            const st = settlements.shift();
            out.push(_quest('delivery', st, null, null, 0.7));
        }

        _offerCache[key] = out;
        return out;
    }

    function _quest(type, place, foe, roster, rewardScale) {
        const gold = Math.round((30 + place.dist * 2.5) * rewardScale);
        const xp   = Math.round((50 + place.dist * 3)   * rewardScale);
        const titles = {
            hunt:     `Slay ${foe}`,
            clear:    `Clear ${place.name}`,
            delivery: `Delivery to ${place.name}`,
            delve:    `Descend into ${place.name}`,
        };
        const descs = {
            hunt:     `${foe} lairs at ${place.name}. Put an end to it.`,
            clear:    `${place.name} is overrun by ${foe}. Drive them out.`,
            delivery: `Bring a sealed crate safely to ${place.name}.`,
            delve:    `Something below ${place.name} sends ${foe} to the surface. Go down and end it.`,
        };
        const desc = descs[type] + _flavor(type);
        return {
            id:     `q${Date.now()}_${_nextId++}`,
            type,
            title:  titles[type],
            desc,
            target: { name: place.name, q: place.q, r: place.r },
            roster: roster ?? null,
            label:  foe ?? place.name,
            reward: { gold, xp },
            origin: _currentOrigin,
        };
    }

    let _currentOrigin = null;   // settlement whose inn is offering, set by offers()

    // Kingdom owning a settlement, from the map export's kingdoms lists
    function kingdomOf(settlementName) {
        const kingdoms = _mapData()?.kingdoms ?? [];
        return kingdoms.find(k => (k.settlements ?? []).includes(settlementName)) ?? null;
    }

    function _addReputation(settlementName, amount) {
        const k = kingdomOf(settlementName);
        if (!k) return;
        const rep = GameState.get().reputation;
        rep[k.id] = (rep[k.id] ?? 0) + amount;
    }

    function _isActive(offer) {
        return GameState.get().quests.active.some(q => q.id === offer.id);
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────
    function accept(quest) {
        const s = GameState.get();
        if (s.quests.active.length >= 5) return false;
        if (s.quests.active.some(q => q.id === quest.id)) return false;
        s.quests.active.push(quest);
        GameState.save();
        return true;
    }

    // A combat quest whose target lies at/next to the given hex, if any
    function combatQuestAt(q, r) {
        return GameState.get().quests.active.find(qu =>
            qu.roster && _dist(q, r, qu.target.q, qu.target.r) <= 1) ?? null;
    }

    // A delivery quest whose destination settlement matches this name, if any
    function deliveryQuestFor(settlementName) {
        return GameState.get().quests.active.find(qu =>
            qu.type === 'delivery' && qu.target.name === settlementName) ?? null;
    }

    function complete(quest) {
        const s = GameState.get();
        const i = s.quests.active.findIndex(q => q.id === quest.id);
        if (i < 0) return;
        s.quests.active.splice(i, 1);
        s.quests.completed.push({ id: quest.id, title: quest.title, day: s.world.day });
        s.party.gold += quest.reward.gold;
        s.party.xp   += quest.reward.xp;
        if (quest.origin) _addReputation(quest.origin, 2);
        if (quest.type === 'delivery') _addReputation(quest.target.name, 1);
        while (s.party.xp >= s.party.level * 100) {
            s.party.xp -= s.party.level * 100;
            s.party.level += 1;
        }
        GameState.save();
    }

    // ── Main quest (see GAMEPLAN.md phase 6) ─────────────────────────────────
    // Seeded at world creation: a legendary boss lairs at the farthest
    // landmark, gated behind three shard trials at landmarks across the map.

    let _legendary = null;
    async function loadLegendary() {
        if (_legendary) return;
        try {
            _legendary = await fetch('data/monsters/legendarybestiary.json').then(r => r.json());
        } catch (_) { _legendary = []; }
    }

    function initMainQuest() {
        const s   = GameState.get();
        const map = _mapData();
        if (!s || s.quests.main || !map || !_legendary?.length) return;

        const pos = s.world.position ?? { q: 0, r: 0 };
        const lms = (map.landmarks ?? [])
            .map(lm => ({ name: lm.name, q: lm.q, r: lm.r,
                          dist: _dist(pos.q, pos.r, lm.q, lm.r) }))
            .filter((lm, i, arr) => arr.findIndex(o => o.name === lm.name) === i)
            .sort((a, b) => b.dist - a.dist);
        if (lms.length < 2) return;

        const boss = _legendary[s.world.seed % _legendary.length];
        const lair = lms[0];
        const rest = lms.slice(1);
        const shards = [rest[0], rest[Math.floor(rest.length / 2)], rest[rest.length - 1]]
            .filter(Boolean)
            .filter((lm, i, arr) => arr.findIndex(o => o.name === lm.name) === i)
            .map(lm => ({ name: lm.name, q: lm.q, r: lm.r, done: false }));

        const camp = _campaign();
        s.quests.main = {
            title:  `Destroy ${boss.name}`,
            boss:   { name: boss.name, title: boss.title ?? '' },
            lair:   { name: lair.name, q: lair.q, r: lair.r },
            shards,
            done:   false,
            campaign: camp ? { title: camp.title, hook: camp.starting_hook } : null,
        };
        GameState.save();
    }

    function _shardsDone(main) { return main.shards.every(sh => sh.done); }

    // Main-quest fight at this hex, if any: a shard trial or (once all shards
    // are done) the boss lair itself. Returns a quest-like object for
    // triggerBattle/applyBattleResult with `kind` set.
    function mainQuestAt(q, r) {
        const s    = GameState.get();
        const main = s?.quests.main;
        if (!main || main.done) return null;
        const pool = Encounter.pools(s.world.params.biome);
        const foe  = pool.uncommon[0] ?? pool.common[0] ?? 'Guardian';

        for (const sh of main.shards) {
            if (!sh.done && _dist(q, r, sh.q, sh.r) <= 1) {
                return {
                    kind: 'shard', shard: sh,
                    title: `Shard trial at ${sh.name}`,
                    label: `Guardian of ${sh.name}`,
                    roster: [
                        { name: `Guardian of ${sh.name}`, role: 'melee', boss: true },
                        { name: foe, role: 'melee' },
                        { name: foe, role: 'ranged' },
                        { name: foe, role: 'ranged' },
                    ],
                    reward: { gold: 120, xp: 150 },
                };
            }
        }

        if (_shardsDone(main) && _dist(q, r, main.lair.q, main.lair.r) <= 1) {
            return {
                kind: 'boss',
                title: main.title,
                label: main.boss.name,
                roster: [
                    { name: main.boss.name, role: 'melee', boss: true },
                    { name: 'Thrall of ' + main.boss.name, role: 'melee' },
                    { name: 'Thrall of ' + main.boss.name, role: 'melee' },
                    { name: 'Thrall of ' + main.boss.name, role: 'ranged' },
                    { name: 'Thrall of ' + main.boss.name, role: 'ranged' },
                ],
                reward: { gold: 500, xp: 500 },
            };
        }
        return null;
    }

    // Returns 'shards' | 'lair-unlocked' | 'won' after a main-quest victory
    function mainQuestWon(questLike) {
        const s    = GameState.get();
        const main = s.quests.main;
        if (!main) return null;
        s.party.gold += questLike.reward.gold;
        s.party.xp   += questLike.reward.xp;
        if (questLike.kind === 'shard') {
            const sh = main.shards.find(x => x.name === questLike.shard.name);
            if (sh) sh.done = true;
            GameState.save();
            return _shardsDone(main) ? 'lair-unlocked' : 'shards';
        }
        main.done = true;
        GameState.save();
        return 'won';
    }

    // ── Quest log lines for the HUD ──────────────────────────────────────────
    function logLines() {
        const s = GameState.get();
        if (!s) return [];
        const pos   = s.world.position ?? { q: 0, r: 0 };
        const lines = [];

        const main = s.quests.main;
        if (main && !main.done) {
            const next = main.shards.find(sh => !sh.done) ?? main.lair;
            const d    = _dist(pos.q, pos.r, next.q, next.r);
            const dir  = _dirArrow(next.q - pos.q, next.r - pos.r);
            const left = main.shards.filter(sh => !sh.done).length;
            lines.push({
                main: true,
                title: main.title,
                camp:  main.campaign?.title ?? null,
                place: left > 0 ? `Shard trial: ${next.name} (${left} left)` : `Lair: ${next.name}`,
                dist: d, dir,
            });
        }

        for (const qu of s.quests.active) {
            const d   = _dist(pos.q, pos.r, qu.target.q, qu.target.r);
            const dir = _dirArrow(qu.target.q - pos.q, qu.target.r - pos.r);
            lines.push({ title: qu.title, place: qu.target.name, dist: d, dir });
        }
        return lines;
    }

    return { offers, accept, complete, combatQuestAt, deliveryQuestFor, logLines,
             loadLegendary, loadCampaigns, initMainQuest, mainQuestAt, mainQuestWon,
             kingdomOf };
})();
