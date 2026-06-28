/* ===========================================================
   pause.js  — GAME pause (tab / minimize freeze)
   Freezes the whole game when the player isn't looking: when the tab
   is hidden or the window is minimized (Page Visibility), no SFX fire
   and no timer-driven sequence advances; it resumes exactly where it
   left off.

   The game advances with JS timers (setTimeout / setInterval), which
   CSS pausing can't stop — so this WRAPS those globals: while paused,
   game callbacks that come due are HELD and replayed (in order) on
   resume; interval ticks are skipped. clearTimeout / clearInterval
   keep working (the ids returned are the native ones).

   Loaded FIRST (before the other game scripts) so every later
   setTimeout / setInterval call is the wrapped version.

   Extensible via window.GamePause so optional tools (e.g. a QA comment
   tool) can contribute extra pause conditions:
     • addCondition(fn)  — fn() → true means "the game should be paused"
                           (document.hidden is built in).
     • addExemption(fn)  — fn() → true means "never freeze THIS timer"
                           (so a tool's own UI timers keep running while
                           the game is frozen).
     • refresh()         — re-evaluate the pause state after a condition
                           changes.
   =========================================================== */

(function (window) {
    "use strict";

    const nativeSetTimeout = window.setTimeout;
    const nativeSetInterval = window.setInterval;

    let paused = false;
    let heldTimeouts = [];        // game callbacks that came due while frozen
    const conditions = [];        // each returns true when the game should pause
    const exemptions = [];        // each returns true if a timer must NOT be frozen

    function shouldPause() {
        if (document.hidden) return true;
        for (let i = 0; i < conditions.length; i++) {
            try { if (conditions[i]()) return true; } catch (e) { /* ignore */ }
        }
        return false;
    }
    function isExempt() {
        for (let i = 0; i < exemptions.length; i++) {
            try { if (exemptions[i]()) return true; } catch (e) { /* ignore */ }
        }
        return false;
    }

    window.setTimeout = function (fn, delay) {
        if (typeof fn !== "function" || isExempt()) {
            return nativeSetTimeout.apply(window, arguments);
        }
        const args = Array.prototype.slice.call(arguments, 2);
        return nativeSetTimeout.call(window, function fire() {
            if (paused) {
                // Hold until the game resumes, then run in due order.
                heldTimeouts.push(function () { fn.apply(null, args); });
                return;
            }
            fn.apply(null, args);
        }, delay);
    };

    window.setInterval = function (fn, delay) {
        if (typeof fn !== "function" || isExempt()) {
            return nativeSetInterval.apply(window, arguments);
        }
        const args = Array.prototype.slice.call(arguments, 2);
        return nativeSetInterval.call(window, function tick() {
            if (paused) return; // skip game ticks while frozen; resume after
            fn.apply(null, args);
        }, delay);
    };

    function setPaused(on) {
        if (on === paused) return;
        paused = on;
        if (!paused && heldTimeouts.length) {
            // Replay everything that came due during the freeze, in order.
            const due = heldTimeouts;
            heldTimeouts = [];
            due.forEach(function (run) { run(); });
        }
    }
    function refresh() { setPaused(shouldPause()); }

    // Pause when the tab is hidden / window minimized; resume on return.
    function watch() {
        refresh();
        document.addEventListener("visibilitychange", refresh);
    }
    if (document.body) watch();
    else document.addEventListener("DOMContentLoaded", watch);

    window.GamePause = {
        addCondition: function (fn) { if (typeof fn === "function") { conditions.push(fn); refresh(); } },
        addExemption: function (fn) { if (typeof fn === "function") exemptions.push(fn); },
        refresh: refresh,
        isPaused: function () { return paused; },
    };
})(window);
