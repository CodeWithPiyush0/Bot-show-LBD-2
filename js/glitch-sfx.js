/* ===========================================================
   glitch-sfx.js
   Plays the `glitch` SFX in sync with the broken-bot "Spider-Verse"
   glitch. The glitch itself is a CSS animation (css/screen.css →
   @keyframes botGlitch) that briefly swaps a bot's `filter` to an SVG
   channel-split (url(#botRgb*)) during its burst, then back to clean.

   We can't get per-keyframe events from CSS, so each frame we read the
   FOCAL bot's *computed* filter and fire the sound on the rising edge
   (clean → split). Reading the rendered state is what keeps the audio
   locked to the visual burst — no separate timer to drift.

   Only the FOCAL bot drives the sound (the centred carousel bot, or the
   orange tutorial bot) — the row has many desynced bots, and sounding
   every one would just stack into noise. The sound is muted off-tab via
   SFX.play()'s document.hidden guard, and rAF is paused in background
   tabs anyway.
   =========================================================== */
(function (global) {
    "use strict";

    var lastSplit = false; // was the focal bot mid-split last frame?
    var lastEl = null;     // focal element we were tracking
    var lastPlay = 0;      // timestamp of last glitch sound (de-bounce)

    function focalImg() {
        var s1 = document.getElementById("screen-1");
        if (!s1 || !s1.classList.contains("is-active")) return null;
        // a bot is being picked / zoomed in — keep that transition clean
        if (s1.classList.contains("is-choosing")) return null;
        // Chooser mode is flagged by `level-2` on the #game element (NOT on
        // screen-1). In the chooser, sync to the centred coverflow bot; in the
        // L1 tutorial, sync to the focal (clickable) orange bot.
        var game = document.getElementById("game");
        if (game && game.classList.contains("level-2")) {
            return s1.querySelector(".carousel-bot.is-centered:not(.is-fixed) img");
        }
        return s1.querySelector(".bot--orange");
    }

    function isSplit(el) {
        return (getComputedStyle(el).filter || "").indexOf("url(") !== -1;
    }

    function tick(ts) {
        global.requestAnimationFrame(tick);
        var el = focalImg();
        if (!el) { lastSplit = false; lastEl = null; return; }
        // focal bot changed (scrolled to a new centre): re-sync without firing
        if (el !== lastEl) { lastEl = el; lastSplit = isSplit(el); return; }

        var now = isSplit(el);
        if (now && !lastSplit && (ts - lastPlay) > 140) {
            if (global.SFX) global.SFX.play("glitch");
            lastPlay = ts;
        }
        lastSplit = now;
    }

    global.requestAnimationFrame(tick);
})(window);
