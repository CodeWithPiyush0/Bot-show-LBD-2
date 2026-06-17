/* ===========================================================
   qa-freeze.js
   Lets the QA comment tool truly FREEZE the game.

   The QA tool flags "comment mode" by adding `qa-intercept-on` to
   <body>. This game's screens and intros advance with JS timers
   (setTimeout / setInterval), which CSS pausing can't stop — so a
   reviewer who opened the comment box would watch the sequence keep
   playing underneath them.

   This wraps the global timer functions so that while comment mode is
   on, no GAME callback runs: timeouts that come due are HELD and
   replayed (in order) the moment comment mode ends, and game interval
   ticks are skipped while frozen. The result is a still frame to
   comment on, and the game picks up exactly where it left off.

   The QA tool's OWN timers are exempt (detected by call origin) so its
   popup focus, toasts, and background sync keep working normally while
   you comment.

   Loaded FIRST (before the other game scripts) so every later
   setTimeout/setInterval call is the wrapped version. clearTimeout/
   clearInterval keep working — the ids returned are the native ones.
   =========================================================== */

(function () {
    "use strict";

    const nativeSetTimeout = window.setTimeout;
    const nativeSetInterval = window.setInterval;

    let paused = false;
    let heldTimeouts = []; // game callbacks that came due while frozen

    // Was this timer scheduled by the QA tool (files under /qa/)? Those must
    // never be frozen, or the comment box couldn't focus / toasts would stick.
    function scheduledByQA() {
        let stack = "";
        try {
            throw new Error();
        } catch (e) {
            stack = e.stack || "";
        }
        return stack.indexOf("/qa/") !== -1;
    }

    window.setTimeout = function (fn, delay) {
        if (typeof fn !== "function" || scheduledByQA()) {
            return nativeSetTimeout.apply(window, arguments);
        }
        const args = Array.prototype.slice.call(arguments, 2);
        return nativeSetTimeout.call(
            window,
            function fire() {
                if (paused) {
                    // Hold until comment mode ends, then run in due order.
                    heldTimeouts.push(function () {
                        fn.apply(null, args);
                    });
                    return;
                }
                fn.apply(null, args);
            },
            delay
        );
    };

    window.setInterval = function (fn, delay) {
        if (typeof fn !== "function" || scheduledByQA()) {
            return nativeSetInterval.apply(window, arguments);
        }
        const args = Array.prototype.slice.call(arguments, 2);
        return nativeSetInterval.call(
            window,
            function tick() {
                if (paused) return; // skip game ticks while frozen; resume after
                fn.apply(null, args);
            },
            delay
        );
    };

    function setPaused(on) {
        if (on === paused) return;
        paused = on;
        if (!paused && heldTimeouts.length) {
            // Replay everything that came due during the freeze, in order.
            const due = heldTimeouts;
            heldTimeouts = [];
            due.forEach(function (run) {
                run();
            });
        }
    }

    // The game freezes while EITHER the QA comment box is open OR the tab is
    // hidden / the window is minimized (Page Visibility). Held timeouts replay
    // in order on resume, so the game continues exactly where it left off; no
    // SFX fire while hidden (audio.js guards play() on document.hidden, and the
    // AudioContext is suspended on visibilitychange).
    function shouldPause() {
        return document.hidden || document.body.classList.contains("qa-intercept-on");
    }

    function watch() {
        setPaused(shouldPause());
        const observer = new MutationObserver(function () {
            setPaused(shouldPause());
        });
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ["class"],
        });
        document.addEventListener("visibilitychange", function () {
            setPaused(shouldPause());
        });
    }

    if (document.body) {
        watch();
    } else {
        document.addEventListener("DOMContentLoaded", watch);
    }
})();
