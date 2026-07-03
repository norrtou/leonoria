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
        // Future: per-biome overworld themes, settlement, battle, dungeon…
    };

    const FADE_MS = 1500;

    const _ch = {
        music:    { audio: null, key: null },
        ambience: { audio: null, key: null },
    };
    let _unlocked = false;
    let _pending  = [];   // [channel, key] queued before the first user gesture
    let _muted    = false;

    // Autoplay unlock: first pointer/key gesture releases queued playback
    function _unlock() {
        if (_unlocked) return;
        _unlocked = true;
        for (const [channel, key] of _pending) _play(channel, key);
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
        _fade(audio, 0, _muted ? 0 : track.volume, FADE_MS);

        ch.audio = audio;
        ch.key   = key;
    }

    return {
        // Play a track on a channel, crossfading from the current one.
        play(channel, key) {
            if (!_unlocked) { _pending.push([channel, key]); return; }
            _play(channel, key);
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
            for (const ch of Object.values(_ch)) {
                if (ch.audio) ch.audio.volume = _muted ? 0 : (TRACKS[ch.key]?.volume ?? 0.3);
            }
        },
        get muted() { return _muted; },
    };
})();
