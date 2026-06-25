/* ===========================================================
   intro.js
   Screen 1 intro: after the question template unrolls open,
   the question text is typed out one character at a time.
   (The template-open + mascot-pop animations are CSS-driven.)
   =========================================================== */

(function () {
    "use strict";

    const TYPE_SPEED = 45; // ms per character

    // A shared token cancels any in-flight typer: starting a new one (or calling
    // cancelTyping on navigation) bumps it, so a running loop can't keep
    // appending characters after its banner was reset/hidden.
    let typeToken = 0;
    function cancelTyping() { typeToken += 1; }

    function typewriter(el, text, speed, onDone) {
        const token = ++typeToken;
        el.textContent = "";
        let i = 0;
        (function tick() {
            if (token !== typeToken) return; // superseded / cancelled
            if (i >= text.length) {
                if (onDone) onDone();
                return;
            }
            el.textContent += text.charAt(i);
            if (window.SFX) window.SFX.play("type"); // one tick per character
            i += 1;
            window.setTimeout(tick, speed);
        })();
    }

    // Cancellable typewriter for the Screen 1 banner: shares the same token, so
    // a new call (or cancelTyping on navigation) supersedes any in-flight run.
    function typeScreen1(el, text) {
        const token = ++typeToken;
        el.textContent = "";
        let i = 0;
        (function tick() {
            if (token !== typeToken || i >= text.length) return;
            el.textContent += text.charAt(i);
            if (window.SFX) window.SFX.play("type"); // one tick per character
            i += 1;
            window.setTimeout(tick, TYPE_SPEED);
        })();
    }

    // Plays the Screen 1 intro on demand (called when "Let's Play" is
    // tapped), so the mascot-unroll + typing run when the screen appears.
    function playScreen1Intro() {
        const screen1 = document.getElementById("screen-1");
        if (!screen1) return;
        const template = screen1.querySelector(".question__template");
        const textEl = screen1.querySelector(".question__text");
        if (!textEl) return;

        const isChooser = window.currentLevel === 2; // L2+ = scrollable bot chooser

        // (re)start the CSS intro animations
        screen1.classList.remove("is-intro");
        screen1.classList.remove("is-lit"); // start with all bots normally lit
        void screen1.offsetWidth; // reflow so the animation can restart
        screen1.classList.add("is-intro");

        if (isChooser) {
            // Chooser mode: no auto-spotlight — it falls when the player taps a
            // bot (handled in carousel.js). Reset/centre the chooser row.
            // enterChooser() OWNS the banner text (it sets a per-part message),
            // so we don't auto-type here — that would clobber it.
            if (window.BotChooser) window.BotChooser.enterChooser();
        } else {
            // L1 tutorial: bring the spotlight up onto the centre bot after a beat.
            window.setTimeout(function () {
                screen1.classList.add("is-lit");
                if (window.SFX) window.SFX.play("spotlight");
            }, 1000);
        }

        // In chooser mode the text is set by enterChooser(); skip local typing.
        const full = isChooser ? null : (textEl.getAttribute("data-text") || "");
        if (!isChooser) textEl.textContent = "";

        let started = false;
        const startTyping = function () {
            if (started || !full) return;
            started = true;
            if (window.SFX) window.SFX.play("bannerOpen");
            typeScreen1(textEl, full);
        };

        if (template) {
            template.addEventListener("animationend", startTyping, { once: true });
            window.setTimeout(startTyping, 1200); // fallback
        } else {
            startTyping();
        }
    }

    // Type a message into the Screen 1 banner, cancelling any running typer
    // (used by the chooser to swap to the overcharged-phase message).
    function setScreen1Text(message) {
        const el = document.querySelector("#screen-1 .question__text");
        if (el) typeScreen1(el, message);
    }

    window.Screen1Intro = { play: playScreen1Intro, setText: setScreen1Text };

    /* ---- Screen 2 intro ----
       Opens the banner, types the prompt, holds (placeholder for the
       VO), then closes back to just the mascot face. The gameplay
       content is kept compact while the banner is open. */
    const HOLD_AFTER_TEXT = 600; // brief beat after typing, then close so dragging is available

    function playScreen2Intro() {
        const content = document.getElementById("s2-content");
        const q = document.getElementById("question-2");
        if (!q) return;
        const textEl = q.querySelector(".question__text");
        const full = textEl.getAttribute("data-text") || "";

        // Initialize/reset batteries configuration for current level
        if (window.Batteries && window.Batteries.setup) window.Batteries.setup();

        // LEVELS: the kid already learned the mechanic in the tutorial, so skip
        // the instruction banner entirely — keep it closed, board at full size,
        // and just make the puzzle playable after a short settle beat. (The
        // banner still opens for the dance + chooser, just not while fixing.)
        if (window.currentLevel === 2) {
            if (content) content.classList.remove("is-compact");
            q.classList.remove("is-open");
            textEl.textContent = "";
            if (window.Batteries) window.Batteries.setEnabled(false);
            window.setTimeout(function () {
                if (window.Batteries && window.Batteries.playHint) window.Batteries.playHint();
                else if (window.Batteries) window.Batteries.setEnabled(true);
            }, 450);
            return;
        }

        // TUTORIAL: lock dragging and start compact + closed.
        if (window.Batteries) window.Batteries.setEnabled(false);
        if (content) content.classList.add("is-compact");
        q.classList.remove("is-open");
        textEl.textContent = "";

        // Open the banner, then type once it has unrolled.
        window.setTimeout(function () {
            q.classList.add("is-open");
            if (window.SFX) window.SFX.play("bannerOpen");
            window.setTimeout(function () {
                typewriter(textEl, full, TYPE_SPEED, function () {
                    window.setTimeout(closeScreen2Intro, HOLD_AFTER_TEXT);
                });
            }, 650); // after the unroll transition
        }, 150);

        function closeScreen2Intro() {
            q.classList.remove("is-open"); // collapse to the mascot face
            textEl.textContent = "";
            if (content) content.classList.remove("is-compact"); // grow to normal
            // After it has grown back, demonstrate the drag with a ghost
            // (3 times), then enable dragging.
            window.setTimeout(function () {
                if (window.Batteries && window.Batteries.playHint) {
                    window.Batteries.playHint();
                } else if (window.Batteries) {
                    window.Batteries.setEnabled(true);
                }
            }, 600);
        }
    }

    /* Open the Screen 2 banner and type an arbitrary message, leaving
       it open (used for the "fully charged" finale). */
    function showScreen2Message(text) {
        const q = document.getElementById("question-2");
        if (!q) return;
        const textEl = q.querySelector(".question__text");
        textEl.textContent = "";
        q.classList.add("is-open");
        if (window.SFX) window.SFX.play("bannerOpen");
        window.setTimeout(function () {
            typewriter(textEl, text, TYPE_SPEED);
        }, 650); // after the unroll transition
    }

    window.Screen2Intro = {
        play: playScreen2Intro,
        showMessage: showScreen2Message,
    };

    /* ---- Screen 3 banner ----
       Opens and types "The bot is fully charged." while the bot dances
       (the message moved here from the Screen 2 charge finale). */
    function showScreen3Message() {
        const q = document.getElementById("question-3");
        if (!q) return;
        const textEl = q.querySelector(".question__text");
        const text = textEl.getAttribute("data-text") || "The bot is fully charged.";
        q.classList.remove("is-open");
        textEl.textContent = "";
        window.setTimeout(function () {
            q.classList.add("is-open");
            if (window.SFX) window.SFX.play("bannerOpen");
            window.setTimeout(function () {
                typewriter(textEl, text, TYPE_SPEED);
            }, 650); // after the unroll transition
        }, 150);
    }

    window.Screen3Intro = { showMessage: showScreen3Message };
    window.cancelTyping = cancelTyping; // stop any in-flight banner typer (used on navigation)
})();
