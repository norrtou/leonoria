// ═══════════════════════════════════════════════════════════════════════════════
// dungeon-scene.js — Leonoria dungeon exploration scene (game.html only)
//
// Delve quests descend into a procedural dungeon (dungeon.js via
// window.LeonoriaDungeon). The party marker moves hex-by-hex (5 ft/hex,
// click within the lit movement range). Wandering monsters and the boss
// chamber trigger battle-map battles in dungeon mode — the caller
// (game-main.js) supplies the battle hooks.
//
// The layout is deterministic per quest target: seed = world seed ⊕ target
// hex, so re-entering the same ruin rebuilds the same dungeon.
// ═══════════════════════════════════════════════════════════════════════════════

window.DungeonScene = (() => {
    'use strict';

    const $ = id => document.getElementById(id);

    const ENCOUNTER_RISK = 0.12;   // wandering-monster chance per move

    let _st = null;   // { quest, gen, hgm, svgEl, party, lastType, cb }

    function _seedFor(quest) {
        const ws = GameState.get()?.world?.seed ?? 1;
        return (ws ^ Math.imul(quest.target.q, 73856093) ^ Math.imul(quest.target.r, 19349663)) >>> 0;
    }

    function _showReachable() {
        const { hgm, svgEl, party } = _st;
        hgm.clearOverlay();
        const reachable = hgm.getMovementRange(party.q, party.r, LeonoriaDungeon.MOVE_BUDGET);
        hgm.highlightCells(reachable, {
            fill:        'rgba(50, 100, 220, 0.02)',
            stroke:      'rgba(120, 165, 255, 0.10)',
            strokeWidth: 0.9,
        });
        LeonoriaDungeon.placePartyMarker(svgEl, party.q, party.r);
        _st.reachable = reachable;
    }

    function _onClick({ q, r, cell }) {
        if (!_st || window.LeonoriaBattle?.active) return;
        const T = LeonoriaDungeon.T;

        if (cell.terrain_type === T.WALL) { _info('Solid rock.'); return; }
        if (!_st.reachable?.has(`${q}_${r}`)) { _info('Too far — move in shorter steps.'); return; }

        const cameFrom = _st.lastType;
        _st.party.q = q; _st.party.r = r;
        _st.lastType = cell.terrain_type;
        _showReachable();
        _info(LeonoriaDungeon.typeLabel(cell.terrain_type));

        // Boss chamber: the quest fight, armed when entering from outside it
        if (cell.terrain_type === T.BOSS && cameFrom !== T.BOSS) {
            _info('Something large stirs in the dark…');
            setTimeout(() => _st?.cb.onBoss?.(), 500);
            return;
        }

        // Wandering monsters in corridors and chambers
        if (cell.terrain_type !== T.ENTRY && Math.random() < ENCOUNTER_RISK) {
            setTimeout(() => _st?.cb.onEncounter?.(), 400);
        }
    }

    function _info(msg) { const el = $('ds-info'); if (el) el.textContent = msg; }

    // ── Public API ───────────────────────────────────────────────────────────
    function enter(quest, cb) {
        const holder = $('ds-map');
        holder.innerHTML = '';                        // fresh svg → no stale click handlers
        const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.id = 'ds-svg';
        holder.appendChild(svgEl);

        const { gen, hgm } = LeonoriaDungeon.build(_seedFor(quest), 'small', svgEl);
        _st = {
            quest, gen, hgm, svgEl,
            party:    { q: gen.entrancePos.q, r: gen.entrancePos.r },
            lastType: LeonoriaDungeon.T.ENTRY,
            cb:       cb ?? {},
        };
        $('ds-title').textContent = quest.title;
        _info('Click a lit hex to move. The threat waits in the deepest chamber.');
        hgm.onClick(_onClick);
        _showReachable();
    }

    // Re-arm the scene after a battle (marker + range may need a redraw)
    function refresh() {
        if (!_st) return;
        _showReachable();
        _info(_st.lastType === LeonoriaDungeon.T.BOSS
            ? 'The chamber falls silent.' : 'The dark presses in around you.');
    }

    function exit() { _st = null; }

    return {
        enter, refresh, exit,
        get active() { return !!_st; },
    };
})();
