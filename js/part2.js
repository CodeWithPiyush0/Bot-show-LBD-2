/* ===========================================================
   part2.js
   Part Two — fixing overcharged bots with the SAME code-sorting
   puzzle as Part One, but placed TOP-DOWN: the WHOLE goes into the
   big (top) slot first, then the two PARTS into the small (bottom)
   slots. Reuses createCodePuzzle / createConcept (batteries.js,
   concept.js).
     Screen 5: overcharged bots intro -> tap centre bot -> zoom in
     Screen 6: code puzzle (whole -> big first, then parts -> small)
     Screen 8: concept "This whole is made of these two parts"
     Screen 7: the fixed bot celebrates
   =========================================================== */

(function (global) {
    "use strict";

    const DESIGN_W = 1920;
    const DESIGN_H = 1080;
    const TYPE = 45;
    const byId = (id) => document.getElementById(id);

    /* ---------- shared helpers ---------- */
    function typewriter(el, text, speed, onDone) {
        el.textContent = "";
        let i = 0;
        (function tick() {
            if (i >= text.length) { if (onDone) onDone(); return; }
            el.textContent += text.charAt(i);
            if (global.SFX) global.SFX.play("type");
            i += 1;
            global.setTimeout(tick, speed);
        })();
    }

    function openBanner(q, msg1, msg2, onDone) {
        const textEl = q.querySelector(".question__text");
        q.classList.remove("is-open");
        textEl.textContent = "";
        global.setTimeout(function () {
            q.classList.add("is-open");
            if (global.SFX) global.SFX.play("bannerOpen");
            global.setTimeout(function () {
                typewriter(textEl, msg1, TYPE, function () {
                    if (msg2) {
                        global.setTimeout(function () { typewriter(textEl, msg2, TYPE, onDone); }, 1600);
                    } else if (onDone) { onDone(); }
                });
            }, 650);
        }, 150);
    }

    function zoomOutTo(fromId, toId, onDone) {
        const from = byId(fromId);
        const to = byId(toId);
        from.classList.add("is-zooming-out");
        if (global.SFX) global.SFX.play("zoom");
        global.setTimeout(function () {
            global.GameNav.show(toId);
            to.classList.add("is-revealing");
            if (toId === "screen-7" && global.SFX) global.SFX.play("celebrate");
        }, 150);
        global.setTimeout(function () {
            to.classList.remove("is-revealing");
            from.classList.remove("is-zooming-out");
            if (onDone) onDone();
        }, 1300);
    }

    /* ---------- Screen 5: overcharged intro ---------- */
    let centerTapEnabled = false;

    function sideBots() {
        return Array.prototype.slice.call(
            document.querySelectorAll(".bot--oc-left, .bot--oc-right")
        );
    }

    function startIntro() {
        const screen5 = byId("screen-5");
        const stage5 = byId("s5-stage");
        const q = byId("question-5");
        if (!q || !screen5) return;
        const textEl = q.querySelector(".question__text");
        const msg1 = textEl.getAttribute("data-text");
        const msg2 = textEl.getAttribute("data-text2");
        const msg3 = textEl.getAttribute("data-text3");

        const ocLeft = document.querySelector(".bot--oc-left");
        if (ocLeft) ocLeft.src = "assets/images/Sahdow_Purple_Bot.webp";

        centerTapEnabled = false;
        screen5.classList.remove("is-spotlit");
        if (stage5) stage5.classList.remove("is-focusing");
        sideBots().forEach(function (b) { b.classList.remove("is-gone"); });
        q.classList.remove("is-open");
        textEl.textContent = "";

        global.setTimeout(function () {
            q.classList.add("is-open");
            if (global.SFX) global.SFX.play("bannerOpen");
            global.setTimeout(function () {
                typewriter(textEl, msg1, TYPE, function () { global.setTimeout(phaseB, 1400); });
            }, 650);
        }, 150);

        function phaseB() {
            screen5.classList.add("is-spotlit");
            if (global.SFX) global.SFX.play("spotlight");
            typewriter(textEl, msg2, TYPE, function () { global.setTimeout(phaseC, 1400); });
        }
        function phaseC() {
            sideBots().forEach(function (b) { b.classList.add("is-gone"); });
            if (stage5) stage5.classList.add("is-focusing");
            typewriter(textEl, msg3, TYPE, function () { centerTapEnabled = true; });
        }

        const center = document.querySelector(".bot--oc-center");
        if (center && !center.dataset.wired) {
            center.dataset.wired = "1";
            center.addEventListener("click", function () {
                if (!centerTapEnabled) return;
                centerTapEnabled = false;
                enterFromFocus();
            });
        }
    }

    // Continue the little zoom all the way into the bot, then Screen 6.
    function enterFromFocus() {
        const stage5 = byId("s5-stage");
        const s6 = byId("screen-6");
        stage5.style.transition = "transform 0.6s cubic-bezier(0.42, 0, 1, 1)";
        stage5.style.transform = "scale(4.5)";
        if (global.SFX) global.SFX.play("zoom");
        global.setTimeout(function () {
            global.GameNav.show("screen-6");
            s6.classList.add("is-entering");
            startSplit();
        }, 300);
        global.setTimeout(function () {
            s6.classList.remove("is-entering");
            stage5.style.transition = "";
            stage5.style.transform = "";
            stage5.classList.remove("is-focusing");
            byId("screen-5").classList.remove("is-spotlit");
            sideBots().forEach(function (b) { b.classList.remove("is-gone"); });
        }, 1100);
    }

    /* ---------- Screen 6: the code puzzle (TOP-DOWN) ---------- */
    function part2Solved(isLevel) {
        const s7Bot = document.querySelector("#screen-7 .charged-bot img");
        if (isLevel) {
            if (s7Bot && window.currentScheme) {
                s7Bot.classList.remove("hue-blue");
                s7Bot.src = "assets/images/" + window.currentScheme + "_bot_charged.webp";
            }
            zoomOutTo("screen-6", "screen-7", function () {
                global.setTimeout(function () {
                    if (window.returnToChooser) window.returnToChooser();
                }, 3000);
            });
        } else {
            if (s7Bot) {
                s7Bot.classList.remove("hue-blue");
                s7Bot.src = "assets/images/White_purple_bot_charged.webp";
            }
            if (global.GameNav) global.GameNav.show("screen-8");
            conceptP2.play();
        }
    }

    const puzzle = global.createCodePuzzle({
        screenId: "screen-6",
        contentId: "s6-content",
        connectorsId: "connectors-6",
        getCodes: function () { return window.getCodes(2); },
        guideWholeFirst: true, // top-down: whole into the big slot first
        onSolved: part2Solved,
    });

    const conceptP2 = global.createConcept({
        contentId: "s8-content",
        screenId: "screen-8",
        questionId: "question-8",
        getCodes: function () { return window.getCodes(2); },
        wholeFirst: true, // "This whole is made of these two parts."
        fromScreenId: "screen-8",
        toScreenId: "screen-7",
        onDone: function () {
            if (global.showYourTurn) global.showYourTurn(2);
            else if (global.startLevels) global.startLevels(2);
        },
    });

    // Reset the board to its fresh state (called early by chooseBotEnter so the
    // previous level's codes don't flash, and again on entry by startSplit).
    function resetSplit() { puzzle.setup(); }

    // Screen-6 intro: type the prompt, close the banner, then enable + guide.
    function startSplit() {
        const q = byId("question-6");
        if (!q) return;
        const content = byId("s6-content");
        const textEl = q.querySelector(".question__text");
        const full = textEl.getAttribute("data-text2") || "Drag the codes in the correct slots.";

        puzzle.setup();
        puzzle.setEnabled(false);
        if (content) content.classList.add("is-compact");
        q.classList.remove("is-open");
        textEl.textContent = "";

        global.setTimeout(function () {
            q.classList.add("is-open");
            if (global.SFX) global.SFX.play("bannerOpen");
            global.setTimeout(function () {
                typewriter(textEl, full, TYPE, function () {
                    global.setTimeout(closeIntro, 600);
                });
            }, 650);
        }, 150);

        function closeIntro() {
            q.classList.remove("is-open");
            textEl.textContent = "";
            if (content) content.classList.remove("is-compact");
            global.setTimeout(function () { puzzle.playHint(); }, 600);
        }
    }

    function playConcept2() { conceptP2.play(); }

    global.Part2 = {
        startIntro: startIntro,
        startSplit: startSplit,
        resetSplit: resetSplit,
        playConcept2: playConcept2,
    };

    document.addEventListener("DOMContentLoaded", puzzle.init);
})(window);
