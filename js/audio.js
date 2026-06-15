/* ===========================================================
   audio.js
   SFX + music manager built on the Web Audio API.

   WHY Web Audio (not <audio> elements): on real phones a pool of
   many <audio> elements is slow and unreliable — mobile browsers
   cap simultaneous media elements and each .play() is costly, which
   janked typing and dropped SFX. Web Audio decodes each file ONCE
   into a buffer; playing is a cheap BufferSourceNode, so dozens of
   overlapping / rapid sounds (e.g. per-character typing) cost almost
   nothing and behave identically on mobile / tablet / desktop.

   Fallback: if Web Audio is unavailable, or files can't be fetched
   (e.g. opened straight from file://, where fetch is blocked), each
   sound lazily falls back to a single <audio> element so dev still
   has sound. Served over http(s) — the deployed/mobile case — always
   uses Web Audio.

   API:
     SFX.play("uiTap")                    // one-shot
     SFX.play("place", {volume: 0.6})     // 0..1 (relative to master)
     SFX.play("electricity", {loop:true}) ... SFX.stop("electricity")
     SFX.toggleMute()                     // also the "M" key
   =========================================================== */

(function (global) {
    "use strict";

    var BASE = "assets/audios/";

    // logical event name -> filename in assets/audios/
    var FILES = {
        uiTap:       "tap.mp3",          // button / bot taps, Bite wrist-tap
        bannerOpen:  "pop.mp3",          // a speech banner unrolls open
        pickup:      "pickup.mp3",       // grab a battery group
        place:       "pop.mp3",          // battery group snaps into a slot
        spotlight:   "spotlight.mp3",    // stage spotlight falls on a bot
        electricity: "electricity.mp3",  // charge current crackle (loops)
        energy:      "energy.mp3",       // batteries travel up into the slot
        powerUp:     "power_up.mp3",     // slot turns green / charged
        ready:       "success.mp3",      // concept slot-glow highlight (same happy ping as success)
        success:     "success.mp3",      // a bot is fixed
        oneScroll:   "one_scroll.mp3",   // carousel crosses one bot (per bot)
        fullScroll:  "full_scroll.mp3",  // chooser elements slide in after the Bite clip
        zoom:        "zoom.mp3",         // diving INTO / OUT of a bot
        flying:      "flying.mp3",       // Bite flies in (your-turn clip)
        reject:      "reject.mp3",       // wrong-slot buzz (Part 1 big slot)
        celebrate:   "celebrate.mp3",    // cheer when a fixed bot dances
        type:        "one_type.mp3",     // per-character typewriter tick
        curtain:     "curtain.mp3",      // theatre-curtain swish on every transition
        bgMusic:     "bg_music.mp3",     // looping music bed (gapless)
        win:         "win.mp3"           // WANTED (optional) — fanfare on Part/Game complete
    };

    var MASTER = 0.85;                 // overall volume (the master gain node)
    var PER = {                        // per-sound trims (0..1, relative to master)
        type: 0.5, ready: 0.6, place: 0.7, energy: 0.7, electricity: 0.55,
        oneScroll: 0.85, fullScroll: 0.85,
        bgMusic: 0.26                  // quiet bed: 0.85 × 0.26 ≈ 22%
    };

    var AC = global.AudioContext || global.webkitAudioContext;
    var ctx = null;
    var masterGain = null;
    var buffers = {};                  // name -> decoded AudioBuffer (Web Audio path)
    var active = {};                   // name -> [{src, gain}] currently playing (so stop() works)
    var fallback = {};                 // name -> <audio> (only used when no buffer)
    var muted = false;
    var bgWanted = false;              // should the music bed be on?

    function url(name) { return BASE + encodeURI(FILES[name]); }

    function initCtx() {
        if (ctx || !AC) return ctx;
        try { ctx = new AC(); } catch (e) { ctx = null; return null; }
        masterGain = ctx.createGain();
        masterGain.gain.value = MASTER;
        masterGain.connect(ctx.destination);
        return ctx;
    }

    // Decode helper that supports both the promise and callback forms of
    // decodeAudioData (older iOS Safari only has the callback form).
    function decode(arrayBuf) {
        return new Promise(function (resolve, reject) {
            var p;
            try { p = ctx.decodeAudioData(arrayBuf, resolve, reject); } catch (e) { reject(e); return; }
            if (p && p.then) p.then(resolve, reject);
        });
    }

    function loadAll() {
        if (!initCtx()) return; // no Web Audio → lazy <audio> fallback per sound
        Object.keys(FILES).forEach(function (name) {
            fetch(url(name))
                .then(function (r) { return r.arrayBuffer(); })
                .then(function (buf) { return decode(buf); })
                .then(function (audioBuf) { buffers[name] = audioBuf; })
                .catch(function () { /* missing file or file:// → fallback handles it */ });
        });
    }

    // Autoplay policy: the AudioContext starts suspended on mobile and must be
    // resumed inside a user gesture. Resume on the first tap/key anywhere.
    function unlock() { if (ctx && ctx.state === "suspended") ctx.resume(); }
    ["pointerdown", "touchstart", "mousedown", "keydown"].forEach(function (ev) {
        global.addEventListener(ev, unlock, { passive: true });
    });

    function perVol(name, override) {
        var b = (override == null) ? (PER[name] == null ? 1 : PER[name]) : override;
        return Math.max(0, Math.min(1, b));
    }

    function playBuffer(name, opts) {
        if (ctx.state === "suspended") ctx.resume();
        var src = ctx.createBufferSource();
        src.buffer = buffers[name];
        src.loop = !!opts.loop;          // native loop = sample-accurate, gapless
        var g = ctx.createGain();
        g.gain.value = perVol(name, opts.volume);
        src.connect(g);
        g.connect(masterGain);
        var entry = { src: src, gain: g };
        (active[name] || (active[name] = [])).push(entry);
        src.onended = function () {
            var arr = active[name];
            if (arr) { var i = arr.indexOf(entry); if (i >= 0) arr.splice(i, 1); }
        };
        try { src.start(0); } catch (e) {}
        if (name === "bgMusic") bgWanted = true;
        return entry;
    }

    function playFallback(name, opts) {
        var a = fallback[name];
        if (!a) {
            a = fallback[name] = new Audio(url(name));
            a.preload = "auto";
        }
        a.loop = !!opts.loop;
        a.volume = Math.max(0, Math.min(1, MASTER * perVol(name, opts.volume)));
        try { a.currentTime = 0; } catch (e) {}
        var p = a.play();
        if (p && p.catch) p.catch(function () {});
        if (name === "bgMusic") bgWanted = true;
        return a;
    }

    function play(name, opts) {
        opts = opts || {};
        if (muted || !FILES[name]) return null;
        if (ctx && buffers[name]) return playBuffer(name, opts);
        return playFallback(name, opts); // buffer not ready yet / no Web Audio
    }

    function stop(name) {
        var arr = active[name];
        if (arr) {
            arr.slice().forEach(function (e) { try { e.src.stop(); } catch (_) {} });
            active[name] = [];
        }
        var a = fallback[name];
        if (a) { try { a.pause(); a.currentTime = 0; a.loop = false; } catch (_) {} }
        if (name === "bgMusic") bgWanted = false;
    }

    function stopAll() {
        Object.keys(active).forEach(stop);
        Object.keys(fallback).forEach(stop);
    }

    /* ---- Tab visibility: silence everything off-tab; resume on return ----
       ctx.suspend() freezes ALL Web Audio at once (cheap) and the looping music
       continues seamlessly on resume. SFX are transient, so nothing to restore. */
    function resumeBgFallback() {
        if (!bgWanted || muted) return;
        var a = fallback.bgMusic;
        if (a) { var p = a.play(); if (p && p.catch) p.catch(function () {}); }
    }
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            if (ctx) ctx.suspend();
            Object.keys(fallback).forEach(function (n) { try { fallback[n].pause(); } catch (e) {} });
        } else {
            if (ctx && !muted) ctx.resume();
            resumeBgFallback();
        }
    });
    global.addEventListener("pagehide", function () {
        if (ctx) ctx.suspend();
        Object.keys(fallback).forEach(function (n) { try { fallback[n].pause(); } catch (e) {} });
    });

    function setMuted(m) {
        muted = !!m;
        if (masterGain) masterGain.gain.value = muted ? 0 : MASTER; // keeps loops running silently
        Object.keys(fallback).forEach(function (n) { if (fallback[n]) fallback[n].muted = muted; });
        if (!muted) resumeBgFallback();
    }
    function toggleMute() { setMuted(!muted); return muted; }

    global.addEventListener("keydown", function (e) {
        if (e.key === "m" || e.key === "M") toggleMute();
    });

    // Start fetching/decoding as soon as possible so sounds are ready by the
    // time the player taps Play.
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", loadAll);
    } else {
        loadAll();
    }

    global.SFX = {
        play: play,
        stop: stop,
        stopAll: stopAll,
        setMuted: setMuted,
        toggleMute: toggleMute,
        isMuted: function () { return muted; },
        FILES: FILES
    };
})(window);
