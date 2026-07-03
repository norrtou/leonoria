// ═══════════════════════════════════════════════════════════════════════════════
// game-main.js — Leonoria game shell (game.html only)
//
// Scene flow:  TITLE → PARTY SELECT → WORLD SETUP → OVERWORLD
//              (Continue on the title screen jumps straight to OVERWORLD)
//
// Reuses from game.js: MapScreen, HeroParty, ZoomController, Game.buildParams,
// Game.MAP_TYPE_PRESETS. Session state lives in GameState (game-state.js).
// See GAMEPLAN.md for the roadmap. Desktop only.
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
'use strict';

const $ = id => document.getElementById(id);

// ─── Scene manager ────────────────────────────────────────────────────────────
const Scenes = {
    names: ['title', 'party', 'world', 'overworld', 'battle'],
    current: null,
    show(name) {
        for (const n of this.names) {
            const el = $(`screen-${n}`);
            if (el) el.hidden = (n !== name);
        }
        this.current = name;
    },
};

// ─── Title screen ─────────────────────────────────────────────────────────────
let _pendingParty = null;   // party chosen on the party screen, until newGame()

function initTitle() {
    $('btn-new-journey').addEventListener('click', () => {
        if (GameState.hasSave() &&
            !confirm('Starting a new journey will replace your saved one. Continue?')) return;
        renderPartyList();
        Scenes.show('party');
    });

    $('btn-continue').addEventListener('click', () => {
        if (!GameState.load()) {
            alert('Could not load the saved journey.');
            $('btn-continue').disabled = true;
            return;
        }
        startOverworld(false);
    });
}

// ─── Party select screen ──────────────────────────────────────────────────────
function loadSavedParties() {
    try {
        const raw = localStorage.getItem('leonoria_parties') || localStorage.getItem('leonoria_teams') || '[]';
        return JSON.parse(raw);
    } catch (_) { return []; }
}

function renderPartyList() {
    const list    = $('party-list');
    const parties = loadSavedParties();
    list.innerHTML = '';

    if (!parties.length) {
        list.innerHTML = `<p class="empty-note">No saved parties yet.<br>
            Create characters and assemble a party in the
            <a href="characters.html" target="_blank" rel="noopener">Character Creator</a>,
            then press ⟳ Refresh.</p>`;
        return;
    }

    parties.forEach(party => {
        const card = document.createElement('button');
        card.className = 'party-card';

        const members = party.members ?? [];
        const ports = members.map(m =>
            `<span class="pc-member">
                <img src="${m.portrait || 'assets/images/characterportraits/ashenfemale.jpg'}" alt="">
                <span class="pc-mname">${m.name || '—'}</span>
                <span class="pc-msub">${(m.race || '').replace(/_/g, ' ')} · ${(m.cls || '').replace(/_/g, ' ')}</span>
            </span>`).join('');

        card.innerHTML = `
            <span class="pc-name">${party.name || 'Unnamed Party'}</span>
            <span class="pc-count">${members.length} member${members.length !== 1 ? 's' : ''}</span>
            <span class="pc-members">${ports}</span>`;

        card.addEventListener('click', () => {
            _pendingParty = party;
            updateTypeDesc();
            Scenes.show('world');
        });
        list.appendChild(card);
    });
}

function initParty() {
    $('btn-party-back').addEventListener('click', () => Scenes.show('title'));
    $('btn-party-refresh').addEventListener('click', renderPartyList);
}

// ─── World setup screen ───────────────────────────────────────────────────────
function updateTypeDesc() {
    const preset = Game.MAP_TYPE_PRESETS[$('gw-map-type').value];
    $('gw-type-desc').textContent = preset?.desc ?? '';
}

function initWorld() {
    $('gw-map-type').addEventListener('change', updateTypeDesc);
    updateTypeDesc();

    $('btn-world-back').addEventListener('click', () => Scenes.show('party'));

    $('btn-create-world').addEventListener('click', () => {
        if (!_pendingParty) { Scenes.show('party'); return; }

        const params = Game.buildParams({
            mapType: $('gw-map-type').value,
            biome:   $('gw-biome').value,
            scale:   1,
        });

        GameState.newGame({ party: _pendingParty, worldParams: params });

        const seedInput = $('gw-seed').value.trim?.() ?? $('gw-seed').value;
        const seed = seedInput === '' ? null : (+seedInput >>> 0);
        if (seed !== null) GameState.setWorldSeed(seed);

        $('gw-status').textContent = 'Shaping the world…';
        // Let the status text paint before the (heavy, synchronous) generation
        setTimeout(() => startOverworld(true), 30);
    });
}

// ─── Overworld ────────────────────────────────────────────────────────────────
let mapScreen = null;
let zoom      = null;

function startOverworld(isNew) {
    const state = GameState.get();
    if (!state?.world?.params) { Scenes.show('title'); return; }

    Scenes.show('overworld');

    if (!zoom) zoom = new ZoomController($('map-viewport'), $('map-container'));
    zoom.reset();
    zoom.configure(state.world.params.scale);

    buildOverworld(state);

    if (isNew) {
        // Record what generation actually produced: the chosen seed and the
        // hero's starting cell.
        GameState.setWorldSeed(mapScreen.currentSeed);
        GameState.setPosition(mapScreen.hero.q, mapScreen.hero.r);
        Quests.initMainQuest();   // seed the boss lair + shard trials
        GameState.save();
        $('gw-status').textContent = '';
    }
    Fog.rebuild();
    updateHUD();
}

function buildOverworld(state) {
    mapScreen = new MapScreen($('map-container'));
    mapScreen.show(state.world.seed, state.world.params, {
        startQ: state.world.position?.q,
        startR: state.world.position?.r,
        onMove: ({ q, r, cell, cost, path }) => {
            for (const pc of path ?? []) GameState.markExplored(pc.q, pc.r);
            GameState.setPosition(q, r);
            GameState.advanceTravel(cost);
            GameState.save();
            updateHUD();
            Fog.rebuild();

            if (cell.terrain_type === 'Settlement') {
                const dq = cell.settlement_name && Quests.deliveryQuestFor(cell.settlement_name);
                if (dq) {
                    Quests.complete(dq);
                    showEvent(`✓ ${dq.title} — ${dq.reward.gold} gold, ${dq.reward.xp} xp`);
                    updateHUD();
                }
                Settlement.open(cell, updateHUD);
                return;                          // safe ground — no encounters
            }
            Settlement.close();

            // Main quest fight (shard trial / boss lair) takes precedence
            const mq = Quests.mainQuestAt(q, r);
            if (mq) {
                setTimeout(() => triggerBattle(
                    { label: mq.label, tier: 'boss', roster: mq.roster }, mq), 650);
                return;
            }

            // Quest target reached? Its fight replaces any random encounter.
            const quest = Quests.combatQuestAt(q, r);
            if (quest) {
                setTimeout(() => triggerBattle(
                    { label: quest.label, tier: 'uncommon', roster: quest.roster },
                    quest), 650);
                return;
            }

            const s = GameState.get();
            const enc = Encounter.roll({
                cell,
                biomeId:   s.world.params.biome,
                timeOfDay: GameState.timeOfDay(),
                partySize: s.party.members.length,
            });
            if (enc) setTimeout(() => triggerBattle(enc), 650);
        },
    });
}

// Regenerating on resize keeps SVG pixel math correct (same approach as
// map.html). Position is preserved through GameState.
let _resizeTimer = null;
window.addEventListener('resize', () => {
    if (Scenes.current !== 'overworld') return;
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
        buildOverworld(GameState.get());
        Fog.rebuild();
    }, 250);
});

// ─── Fog of war ───────────────────────────────────────────────────────────────
// Unexplored hexes are covered by a dark layer; explored ones are punched out
// with soft edges. Per the rendering rules: one offscreen canvas → one <image>
// in the SVG (all punches accumulated in a single path, single fill).
const Fog = {
    _img: null,

    rebuild() {
        const s     = GameState.get();
        const grid  = mapScreen?.hero?.hexGrid;
        const svgEl = $('map-container').querySelector('svg');
        if (!s || !grid || !svgEl) return;

        const vb = svgEl.viewBox.baseVal;
        const cv = document.createElement('canvas');
        cv.width  = Math.max(1, Math.round(vb.width));
        cv.height = Math.max(1, Math.round(vb.height));
        const ctx = cv.getContext('2d');

        ctx.fillStyle = 'rgba(16, 12, 5, 0.87)';
        ctx.fillRect(0, 0, cv.width, cv.height);

        ctx.globalCompositeOperation = 'destination-out';
        ctx.filter = 'blur(12px)';
        const R = grid.hexSize * 2.6;   // reveal ~2 hexes around each visited cell
        ctx.beginPath();
        for (const key of s.world.explored) {
            const [q, r] = key.split(',').map(Number);
            const { x, y } = grid.hexToPixel(q, r);
            ctx.moveTo(x + R, y);
            ctx.arc(x, y, R, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.filter = 'none';

        if (this._img?.parentNode) this._img.remove();
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('id', 'fog-layer');
        img.setAttribute('href', cv.toDataURL('image/png'));
        img.setAttribute('x', vb.x);
        img.setAttribute('y', vb.y);
        img.setAttribute('width', vb.width);
        img.setAttribute('height', vb.height);
        img.setAttribute('pointer-events', 'none');
        svgEl.appendChild(img);
        this._img = img;
    },
};

// ─── Battle bridge ────────────────────────────────────────────────────────────
function triggerBattle(enc, quest = null) {
    if (LeonoriaBattle.active || Scenes.current !== 'overworld') return;
    const s = GameState.get();

    $('battle-encounter-title').textContent = `⚔ ${enc.label}`;
    Scenes.show('battle');   // must be visible before start() sizes its canvases

    LeonoriaBattle.start({
        party:       s.party,
        enemyRoster: enc.roster,
        biome:       s.world.params.biome,
        timeOfDay:   GameState.timeOfDay(),
        isDungeon:   false,
        hpByCharId:  s.party.hp,
    }, result => applyBattleResult(result, enc, quest));
}

function applyBattleResult(result, enc, quest = null) {
    const s = GameState.get();

    // Wounds persist between fights (hero unit ids are `cchar_<charId>`).
    // Downed members are not dead — they crawl back up at 30% after the fight.
    for (const h of result.heroes ?? []) {
        const charId = h.id.replace(/^cchar_/, '');
        const hp = h.hp > 0 ? h.hp : Math.max(1, Math.round(h.maxHp * 0.3));
        if (hp >= h.maxHp) delete s.party.hp[charId];
        else s.party.hp[charId] = hp;
    }

    if (result.victory) {
        const perKill = enc.tier === 'boss' ? 60 : enc.tier === 'uncommon' ? 35 : 20;
        s.party.xp   += result.slainEnemies * perKill + 10;
        s.party.gold += 5 + Math.floor(Math.random() * 10) * result.slainEnemies;
        // Simple curve for now — phase 6 balances this properly
        while (s.party.xp >= s.party.level * 100) {
            s.party.xp -= s.party.level * 100;
            s.party.level += 1;
        }
    } else {
        // Defeat: the party wakes at dawn, battered and robbed — no permadeath
        s.party.gold = Math.floor(s.party.gold / 2);
        s.world.day += 1;
        s.world.hour = 7;
    }

    if (result.victory && quest?.kind) {
        // Main quest progress (shard trial or the boss itself)
        const stage = Quests.mainQuestWon(quest);
        if (stage === 'won') {
            GameState.save();
            showVictory();
            return;
        }
        showEvent(stage === 'lair-unlocked'
            ? `✓ ${quest.title} — the lair is revealed! Face the final foe.`
            : `✓ ${quest.title} — ${quest.reward.gold} gold, ${quest.reward.xp} xp`);
    } else if (result.victory && quest) {
        Quests.complete(quest);
        showEvent(`✓ ${quest.title} — ${quest.reward.gold} gold, ${quest.reward.xp} xp`);
    } else if (result.victory) {
        showEvent(`⚔ ${enc.label} defeated`);
    } else {
        showEvent('☠ The party wakes at dawn, battered and robbed…');
    }

    GameState.save();
    Scenes.show('overworld');
    updateHUD();
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
const TOD_ICON = { dawn: '🌅', day: '☀️', dusk: '🌇', night: '🌙' };

function updateHUD() {
    const s = GameState.get();
    if (!s) return;

    $('hud-party-name').textContent = s.party.name;
    $('hud-gold').textContent  = `⛁ ${s.party.gold}`;
    $('hud-food').textContent  = `🍞 ${s.party.food}`;
    $('hud-level').textContent = `⚜ Lv ${s.party.level}`;
    $('hud-xp').textContent    = `✦ ${s.party.xp} xp`;

    const ports = $('hud-portraits');
    ports.innerHTML = '';
    for (const m of s.party.members) {
        const img = document.createElement('img');
        img.src = m.portrait || 'assets/images/characterportraits/ashenfemale.jpg';
        img.title = `${m.name} — ${(m.race || '').replace(/_/g, ' ')} ${(m.cls || '').replace(/_/g, ' ')}`;
        img.alt = m.name || '';
        ports.appendChild(img);
    }

    const tod = GameState.timeOfDay();
    $('hud-day').textContent  = `Day ${s.world.day}`;
    $('hud-time').textContent = GameState.clockLabel();
    $('hud-tod').textContent  = `${TOD_ICON[tod]} ${tod}`;

    // Day/night tint on the world map
    const vp = $('map-viewport');
    vp.classList.remove('tod-dawn', 'tod-day', 'tod-dusk', 'tod-night');
    vp.classList.add(`tod-${tod}`);

    // Quest log
    const lines = Quests.logLines();
    const log   = $('quest-log');
    if (!lines.length) {
        log.hidden = true;
    } else {
        log.hidden = false;
        log.innerHTML = '<div class="ql-title">Quests</div>' + lines.map(l =>
            `<div class="ql-line${l.main ? ' ql-main' : ''}">${l.main ? '⚜' : '◈'} ${l.title}
                <span class="ql-where">${l.place} · ${l.dir} ${l.dist} hexes</span>
            </div>`).join('');
    }
}

// ─── Victory ──────────────────────────────────────────────────────────────────
function showVictory() {
    const s = GameState.get();
    Scenes.show('overworld');
    $('victory-boss').textContent  = s.quests.main?.boss?.name ?? '';
    $('victory-stats').innerHTML =
        `${s.party.name} · Level ${s.party.level}<br>` +
        `${s.world.day} days · ${Math.round(s.world.milesTraveled)} miles traveled<br>` +
        `${s.quests.completed.length} quests completed`;
    $('victory-overlay').hidden = false;
    updateHUD();
}

// Transient event line (quest completed, battle outcome, …)
let _eventTimer = null;
function showEvent(msg) {
    const el = $('event-ticker');
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(_eventTimer);
    _eventTimer = setTimeout(() => el.classList.remove('visible'), 5000);
}

// ─── In-game menu ─────────────────────────────────────────────────────────────
function initMenu() {
    const overlay = $('menu-overlay');
    const toggle  = show => { overlay.hidden = !show; };

    $('hud-menu-btn').addEventListener('click', () => toggle(true));
    $('btn-resume').addEventListener('click', () => toggle(false));

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && Scenes.current === 'overworld') toggle(overlay.hidden);
    });

    $('btn-save-quit').addEventListener('click', () => {
        GameState.save();
        toggle(false);
        $('btn-continue').disabled = false;
        Scenes.show('title');
    });

    $('btn-abandon').addEventListener('click', () => {
        if (!confirm('Abandon this journey? The save will be deleted.')) return;
        GameState.clear();
        toggle(false);
        $('btn-continue').disabled = true;
        Scenes.show('title');
    });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    Scenes.show('title');
    initTitle();
    initParty();
    initWorld();
    initMenu();
    $('sp-close').addEventListener('click', () => Settlement.close());
    $('btn-victory-title').addEventListener('click', () => {
        $('victory-overlay').hidden = true;
        $('btn-continue').disabled = false;
        Scenes.show('title');
    });
    AudioDirector.play('music', 'theme');   // starts on first user gesture

    // Keep world entry locked until the map JSON data is in — generating
    // without it would silently fall back to built-in defaults.
    $('btn-new-journey').disabled = true;
    $('btn-continue').disabled    = true;
    await Promise.all([LeonoriaData.loadAll(), Encounter.load(), Quests.loadLegendary()]);
    $('btn-new-journey').disabled = false;
    $('btn-continue').disabled    = !GameState.hasSave();
});

})();
