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
        "screen-1": "#5a3624", // room (BG.webp) brown
        "screen-3": "#5a3624",
        "screen-5": "#5a3624",
        "screen-7": "#5a3624",
        // Interior screens (2/4/6/8): fixed cream letterbox that matches the
        // background outside the panel, the same for every bot/level.
        "screen-2": "#fbe7cb",
        "screen-4": "#fbe7cb",
        "screen-6": "#fbe7cb",
        "screen-8": "#fbe7cb",
        "screen-transition": "#05010a",
    };
    const DEFAULT_LETTERBOX = "#5a3624";

    function applyLetterbox(screenId) {
        const game = document.getElementById("game");
        if (game) game.style.backgroundColor = LETTERBOX[screenId] || DEFAULT_LETTERBOX;
    }

    function doShow(screenId) {
        const screens = document.querySelectorAll(".screen");
        screens.forEach((screen) => {
            screen.classList.toggle("is-active", screen.id === screenId);
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
