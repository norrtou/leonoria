// ═══════════════════════════════════════════════════════════════════════════════
// audio-director.js — Leonoria music & ambience channels (game.html only)
//
// Two looping channels (music, ambience) with crossfade; battle SFX stay in
// battle-map.js's own WebAudio pipeline. Tracks are local files in
// assets/sounds/ — free CC0/CC-BY additions go there and get a line in
// CREDITS.md (see GAMEPLAN.md phase 5).
//
// Browser autoplay policy: playback is queued until the first user gesture.
// ═══════════════════════════════════════════════════════════════════════════════

window.AudioDirector = (() => {
    'use strict';

    const TRACKS = {
        theme: { src: 'assets/sounds/leonoriatheme.mp3', volume: 0.35 },

        // Music — Kevin MacLeod (incompetech.com), CC-BY 4.0. See CREDITS.md.
        ow_heartland: { src: 'assets/sounds/music/teller-of-the-tales.mp3', volume: 0.30 },
        ow_coast:     { src: 'assets/sounds/music/suonatore-di-liuto.mp3',  volume: 0.30 },
        ow_darkwood:  { src: 'assets/sounds/music/skye-cuillin.mp3',        volume: 0.30 },
        ow_mystic:    { src: 'assets/sounds/music/achaidh-cheide.mp3',      volume: 0.30 },
        ow_cold:      { src: 'assets/sounds/music/frost-waltz.mp3',         volume: 0.30 },
        ow_arid:      { src: 'assets/sounds/music/desert-city.mp3',         volume: 0.30 },
        ow_swamp:     { src: 'assets/sounds/music/dark-fog.mp3',            volume: 0.28 },
        ow_underdark: { src: 'assets/sounds/music/penumbra.mp3',            volume: 0.28 },
        battle:       { src: 'assets/sounds/music/five-armies.mp3',         volume: 0.38 },
        dungeon:      { src: 'assets/sounds/music/ossuary-6-air.mp3',       volume: 0.30 },
        tavern:       { src: 'assets/sounds/music/master-of-the-feast.mp3', volume: 0.30 },

        // Ambience loops — OpenGameArt (CC0 / CC-BY). See CREDITS.md.
        amb_forest: { src: 'assets/sounds/ambience/forest.ogg',     volume: 0.20 },
        amb_wind:   { src: 'assets/sounds/ambience/wind.ogg',       volume: 0.18 },
        amb_cave:   { src: 'assets/sounds/ambience/cave-drips.ogg', volume: 0.22 },
    };

    // Overworld biome → music / ambience track keys
    const BIOME_MUSIC = {
        the_midlands:          'ow_heartland',
        the_gleam_havens:      'ow_coast',
        the_dark_forests:      'ow_darkwood',
        the_sanctuary_lands:   'ow_mystic',
        the_eternal_winds:     'ow_cold',
        the_badlands:          'ow_arid',
        the_outer_steppes:     'ow_arid',
        the_blinding_lands:    'ow_arid',
        the_boglands:          'ow_swamp',
        the_forgotten_kingdom: 'ow_underdark',
    };
    const BIOME_AMBIENCE = {
        the_midlands:          'amb_forest',
        the_gleam_havens:      'amb_forest',
        the_dark_forests:      'amb_forest',
        the_sanctuary_lands:   'amb_forest',
        the_boglands:          'amb_forest',
        the_eternal_winds:     'amb_wind',
        the_badlands:          'amb_wind',
        the_outer_steppes:     'amb_wind',
        the_blinding_lands:    'amb_wind',
        the_forgotten_kingdom: 'amb_cave',
    };

    const FADE_MS = 1500;

    const _ch = {
        music:    { audio: null, key: null },
        ambience: { audio: null, key: null },
    };
    let _unlocked = false;
    let _pending  = [];   // [channel, key] queued before the first user gesture
    let _muted    = false;

    // Per-channel volume multipliers (0–1) on top of each track's base volume.
    // 'sfx' is read by battle-map.js's playSound. Persisted across sessions.
    const PREFS_KEY = 'leonoria_audio_prefs';
    const _vol = { music: 1, ambience: 1, sfx: 1 };
    try {
        const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
        for (const c of ['music', 'ambience', 'sfx'])
            if (typeof p[c] === 'number') _vol[c] = Math.max(0, Math.min(1, p[c]));
        if (p.muted) _muted = true;
    } catch (_) {}
    function _savePrefs() {
        try { localStorage.setItem(PREFS_KEY, JSON.stringify({ ..._vol, muted: _muted })); }
        catch (_) {}
    }
    function _target(channel, key) {
        return _muted ? 0 : (TRACKS[key]?.volume ?? 0.3) * _vol[channel];
    }

    // Autoplay unlock: first pointer/key gesture releases queued playback
    function _unlock() {
        if (_unlocked) return;
        _unlocked = true;
        // Only the last queued track per channel — earlier ones were superseded
        const last = {};
        for (const [channel, key] of _pending) last[channel] = key;
        for (const [channel, key] of Object.entries(last)) _play(channel, key);
        _pending = [];
    }
    document.addEventListener('pointerdown', _unlock, { once: true });
    document.addEventListener('keydown',     _unlock, { once: true });

    function _fade(audio, from, to, ms, onDone) {
        const steps = 20;
        const dt    = ms / steps;
        let i = 0;
        const timer = setInterval(() => {
            i++;
            audio.volume = Math.max(0, Math.min(1, from + (to - from) * (i / steps)));
            if (i >= steps) { clearInterval(timer); if (onDone) onDone(); }
        }, dt);
    }

    function _play(channel, key) {
        const ch    = _ch[channel];
        const track = TRACKS[key];
        if (!track || ch.key === key) return;

        // Fade out whatever is playing
        if (ch.audio) {
            const old = ch.audio;
            _fade(old, old.volume, 0, FADE_MS, () => { old.pause(); old.src = ''; });
        }

        const audio = new Audio(track.src);
        audio.loop   = true;
        audio.volume = 0;
        audio.play().catch(() => {});   // rejected before gesture — harmless
        _fade(audio, 0, _target(channel, key), FADE_MS);

        ch.audio = audio;
        ch.key   = key;
    }

    return {
        // Play a track on a channel, crossfading from the current one.
        play(channel, key) {
            if (!_unlocked) { _pending.push([channel, key]); return; }
            _play(channel, key);
        },

        // One entry point for scene transitions. `scene` is a Scenes name
        // (or 'settlement' for the hub panel); `biomeId` picks the overworld
        // tracks. Repeat calls with the same track are no-ops (_play guards).
        playScene(scene, biomeId) {
            switch (scene) {
                case 'overworld': {
                    this.play('music', BIOME_MUSIC[biomeId] ?? 'ow_heartland');
                    const amb = BIOME_AMBIENCE[biomeId];
                    if (amb) this.play('ambience', amb); else this.stop('ambience');
                    break;
                }
                case 'settlement':
                    this.play('music', 'tavern');           // ambience keeps running
                    break;
                case 'battle':
                    this.play('music', 'battle');           // ambience keeps running
                    break;
                case 'dungeon':
                    this.play('music', 'dungeon');
                    this.play('ambience', 'amb_cave');
                    break;
                case 'title': case 'party': case 'world':
                    this.play('music', 'theme');
                    this.stop('ambience');
                    break;
            }
        },

        stop(channel) {
            const ch = _ch[channel];
            if (!ch?.audio) return;
            const old = ch.audio;
            _fade(old, old.volume, 0, FADE_MS, () => { old.pause(); old.src = ''; });
            ch.audio = null;
            ch.key   = null;
        },

        setMuted(m) {
            _muted = !!m;
            for (const [name, ch] of Object.entries(_ch)) {
                if (ch.audio) ch.audio.volume = _target(name, ch.key);
            }
            _savePrefs();
        },
        get muted() { return _muted; },

        // Per-channel volume multiplier 0–1 ('music' | 'ambience' | 'sfx')
        setVolume(channel, v) {
            if (!(channel in _vol)) return;
            _vol[channel] = Math.max(0, Math.min(1, v));
            const ch = _ch[channel];
            if (ch?.audio) ch.audio.volume = _target(channel, ch.key);
            _savePrefs();
        },
        getVolume(channel) { return _vol[channel] ?? 1; },
    };
})();
