/* ===========================================================
   navigation.js
   Simple screen switcher. Screens are <section class="screen">
   inside the stage; only the one with `.is-active` is shown.
   Also sets the letterbox fill (the area outside the 16:9 stage)
   to match each screen's background edges.
   =========================================================== */

(function (global) {
    "use strict";

    // Letterbox colour per screen, sampled from each screen's bg edges.
    const LETTERBOX = {
        "screen-pre": "#0a0130", // Pre-LBD purple theatre
        "screen-1": "#a294a3", // room (BG.webp) lavender wall
        "screen-3": "#a294a3",
        "screen-5": "#a294a3",
        "screen-7": "#a294a3",
        // Interior screens (2/4/6/8): fixed cream letterbox that matches the
        // background outside the panel, the same for every bot/level.
        "screen-2": "#fbe7cb",
        "screen-4": "#fbe7cb",
        "screen-6": "#fbe7cb",
        "screen-8": "#fbe7cb",
        "screen-transition": "#05010a",
    };
    const DEFAULT_LETTERBOX = "#a294a3";

    function applyLetterbox(screenId) {
        const game = document.getElementById("game");
        if (game) game.style.backgroundColor = LETTERBOX[screenId] || DEFAULT_LETTERBOX;
    }

    function doShow(screenId) {
        // Stop any in-flight banner typer so it can't keep appending characters
        // after we clear/hide its banner below.
        if (window.cancelTyping) window.cancelTyping();
        const screens = document.querySelectorAll(".screen");
        screens.forEach((screen) => {
            const on = screen.id === screenId;
            screen.classList.toggle("is-active", on);
            // Reset the banner on every screen being HIDDEN (it rolls shut
            // invisibly while the screen fades out): close it AND clear its
            // text. Otherwise the left-open banner — or its leftover text (a
            // separate <p>, NOT clipped by the template) — flashes on the next
            // show before that screen's intro reopens/retypes it. (Fixes the
            // screen-3 "banner appears twice" + "text shows while closed".)
            if (!on) {
                const q = screen.querySelector(".question");
                if (q) {
                    q.classList.remove("is-open");
                    const txt = q.querySelector(".question__text");
                    if (txt) txt.textContent = "";
                }
            }
        });
        applyLetterbox(screenId);
    }

    // The QA comment tool freezes the frame so a reviewer can place a comment;
    // it flags this by adding `qa-intercept-on` to <body>. This game advances
    // screens with JS timers (setTimeout -> GameNav.show), which the QA freeze
    // can't stop on its own, so honour the flag here: while comment mode is on,
    // hold the current screen and remember the latest requested target, then
    // jump there once the reviewer closes the comment box.
    let pendingScreen = null;
    function qaCommentMode() {
        return document.body.classList.contains("qa-intercept-on");
    }

    const GameNav = {
        /**
         * Show a screen by its element id (e.g. "screen-2").
         * Adds `.is-active` to the target and removes it from the rest,
         * and matches the letterbox fill to that screen.
         */
        show(screenId) {
            if (qaCommentMode()) {
                pendingScreen = screenId; // defer until comment mode ends
                return;
            }
            doShow(screenId);
        },
    };

    global.GameNav = GameNav;

    // Match the letterbox to whichever screen is active on load.
    document.addEventListener("DOMContentLoaded", function () {
        const active = document.querySelector(".screen.is-active");
        applyLetterbox(active ? active.id : "screen-pre");

        // When QA comment mode turns off, resume to wherever the game was
        // headed while it was frozen.
        const bodyObserver = new MutationObserver(function () {
            if (!qaCommentMode() && pendingScreen) {
                const target = pendingScreen;
                pendingScreen = null;
                doShow(target);
            }
        });
        bodyObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ["class"],
        });
    });
})(window);
