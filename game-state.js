// ═══════════════════════════════════════════════════════════════════════════════
// game-state.js — Leonoria session state
//
// The single owner of a running game session: party snapshot, world seed/params,
// position, clock, exploration. Persists under ONE localStorage key
// ('leonoria_save'). The world itself is never stored — only {seed, params},
// since map generation is deterministic.
//
// No DOM access in this file. See GAMEPLAN.md for the schema and roadmap.
// ═══════════════════════════════════════════════════════════════════════════════

window.GameState = (() => {
    'use strict';

    const KEY     = 'leonoria_save';
    const VERSION = 1;

    let S = null;   // the live session object, null until newGame() or load()

    // ── Session skeleton ─────────────────────────────────────────────────────
    function _blank() {
        const now = new Date().toISOString();
        return {
            version:   VERSION,
            createdAt: now,
            updatedAt: now,
            party: {
                name:      '',
                members:   [],      // char objects snapshotted from leonoria_parties
                gold:      100,
                food:      14,      // days of provisions (consumed from phase 3)
                xp:        0,
                level:     1,
                inventory: [],
                hp:        {},      // charId → current hp; absent = unhurt

            },
            world: {
                seed:          null,   // set after first generation
                params:        null,   // FantasyMap params (Game.buildParams output)
                position:      null,   // {q, r}
                day:           1,
                hour:          8,      // travel days start in the morning
                milesTraveled: 0,
                explored:      [],     // ["q,r", ...] — fog of war source (phase 5)
            },
            quests:     { active: [], completed: [], main: null },
            reputation: {},
            flags:      {},
        };
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────
    function newGame({ party, worldParams }) {
        S = _blank();
        S.party.name    = party?.name ?? 'Unnamed Party';
        S.party.members = (party?.members ?? []).map(m => ({ ...m }));
        S.world.params  = worldParams ?? null;
        return S;
    }

    function hasSave() {
        return localStorage.getItem(KEY) !== null;
    }

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (data?.version !== VERSION) {
                console.warn('[GameState] save version mismatch — ignoring save');
                return false;
            }
            S = data;
            return true;
        } catch (e) {
            console.warn('[GameState] failed to load save', e);
            return false;
        }
    }

    function save() {
        if (!S) return;
        S.updatedAt = new Date().toISOString();
        localStorage.setItem(KEY, JSON.stringify(S));
    }

    function clear() {
        S = null;
        localStorage.removeItem(KEY);
    }

    function get() { return S; }

    // ── World / travel ───────────────────────────────────────────────────────
    function setWorldSeed(seed) {
        if (S) S.world.seed = seed >>> 0;
    }

    function setPosition(q, r) {
        if (!S) return;
        S.world.position = { q, r };
        markExplored(q, r);
    }

    function markExplored(q, r) {
        if (!S) return;
        const key = `${q},${r}`;
        if (!S.world.explored.includes(key)) S.world.explored.push(key);
    }

    // Advance the in-game clock by a completed move.
    // `cost` is HexGridManager.calcPathCost() output ({miles, hours, ...}) or null.
    function advanceTravel(cost) {
        if (!S || !cost || cost.unit !== 'miles') return;
        S.world.milesTraveled = +(S.world.milesTraveled + cost.miles).toFixed(2);
        let h = S.world.hour + cost.hours;
        while (h >= 24) {
            h -= 24;
            S.world.day += 1;
            S.party.food = Math.max(0, S.party.food - 1);   // one ration per travel day
        }
        S.world.hour = +h.toFixed(2);
    }

    // ── Clock helpers ────────────────────────────────────────────────────────
    function timeOfDay() {
        const h = S?.world.hour ?? 12;
        if (h >= 5  && h < 7)  return 'dawn';
        if (h >= 7  && h < 18) return 'day';
        if (h >= 18 && h < 21) return 'dusk';
        return 'night';
    }

    function clockLabel() {
        if (!S) return '';
        const h = Math.floor(S.world.hour);
        const m = Math.floor((S.world.hour - h) * 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    return {
        newGame, hasSave, load, save, clear, get,
        setWorldSeed, setPosition, markExplored, advanceTravel,
        timeOfDay, clockLabel,
    };
})();
