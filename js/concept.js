/* ===========================================================
   concept.js
   Screen 4 — "These 2 parts make this whole."
   Fills the two small slots (the parts) and the big slot (the
   whole) with batteries, then runs a two-phase teaching animation
   synced to the prompt:
     Phase A ("These 2 parts"): the whole dims; the parts light up
       one battery at a time.
     Phase B ("make this whole."): the parts dim; the whole lights
       up at full opacity and the big slot glows green.
   Timings are placeholders for the eventual voice-over.
   =========================================================== */

(function (global) {
    "use strict";

    const DESIGN_W = 1920;
    const DESIGN_H = 1080;
    const SCALE = 0.82; // matches the placed-battery size used elsewhere

    const pctX = (px) => (px / DESIGN_W) * 100 + "%";
    const pctY = (px) => (px / DESIGN_H) * 100 + "%";

    // Battery groups (design px centres). Small slots = the parts;
    // big slot = the whole (blue row on top, yellow row below).
    const LAYOUT = [
        { color: "blue", count: 4, cx: 629, cy: 622, where: "small" }, // small-left
        { color: "yellow", count: 6, cx: 1302, cy: 621, where: "small" }, // small-right
        { color: "blue", count: 4, cx: 965.5, cy: 217, where: "big" }, // big top row
        { color: "yellow", count: 6, cx: 965.5, cy: 319, where: "big" }, // big bottom row
    ];

    const TYPE_SPEED = 45;
    const SLOT_GLOW_STAGGER = 600; // ms between the two part slots lighting up
    const PHASE_GAP = 1800; // pause after the parts before the whole

    let built = false;
    let contentEl = null;
    let bigGlow = null;
    let glowSmallLeft = null;
    let glowSmallRight = null;
    const smallBats = [];
    const bigBats = [];
    const timers = [];

    function clearTimers() {
        timers.forEach(global.clearTimeout);
        timers.length = 0;
    }
    function later(fn, ms) {
        timers.push(global.setTimeout(fn, ms));
    }

    function typewriter(el, text, speed) {
        el.textContent = "";
        let i = 0;
        (function tick() {
            if (i >= text.length) return;
            el.textContent += text.charAt(i);
            if (global.SFX) global.SFX.play("type"); // one tick per character
            i += 1;
            later(tick, speed);
        })();
    }

    function makeGroup(g) {
        // Small slots shrink wide groups further so 7+ batteries never overflow.
        const scale = (g.where === "small" && window.batteryFitScale)
            ? window.batteryFitScale(g.count)
            : SCALE;
        const el = document.createElement("div");
        el.className = "battery-group battery-group--" + g.color;
        el.style.left = pctX(g.cx);
        el.style.top = pctY(g.cy);
        el.style.transform = "translate(-50%, -50%) scale(" + scale + ")";
        el.style.pointerEvents = "none";
        const bats = [];
        for (let i = 0; i < g.count; i++) {
            const b = document.createElement("img");
            b.className = "battery battery--" + g.color;
            b.src = "assets/images/" + g.color + "_battery.svg";
            b.alt = "";
            b.draggable = false;
            el.appendChild(b);
            bats.push(b);
        }
        return { el: el, bats: bats };
    }

    function build() {
        contentEl = document.getElementById("s4-content");
        if (!contentEl) return;
        bigGlow = document.querySelector("#screen-4 .slot-glow--big");
        glowSmallLeft = document.querySelector("#screen-4 .slot-glow--small-left");
        glowSmallRight = document.querySelector("#screen-4 .slot-glow--small-right");

        // Clear existing groups
        const oldGroups = contentEl.querySelectorAll(".battery-group");
        oldGroups.forEach(el => el.remove());
        smallBats.length = 0;
        bigBats.length = 0;

        // Counts from the current stage's Part 1 config (blue + yellow).
        const c = window.getCounts ? window.getCounts(1) : { blue: 4, yellow: 6 };
        LAYOUT[0].count = c.blue; // small-left (part 1)
        LAYOUT[2].count = c.blue; // big top row
        LAYOUT[1].count = c.yellow; // small-right (part 2)
        LAYOUT[3].count = c.yellow; // big bottom row

        LAYOUT.forEach(function (g) {
            const made = makeGroup(g);
            contentEl.appendChild(made.el);
            (g.where === "big" ? bigBats : smallBats).push.apply(
                g.where === "big" ? bigBats : smallBats,
                made.bats
            );
        });
        built = true;
    }

    function resetState() {
        smallBats.forEach(function (b) {
            b.classList.remove("is-dim");
        });
        bigBats.forEach(function (b) {
            b.classList.add("is-dim");
        });
        if (bigGlow) bigGlow.classList.remove("is-charged");
        if (glowSmallLeft) glowSmallLeft.classList.remove("is-charged");
        if (glowSmallRight) glowSmallRight.classList.remove("is-charged");
    }

    function phaseParts() {
        // The whole dims; the part SLOTS glow one after another.
        bigBats.forEach(function (b) {
            b.classList.add("is-dim");
        });
        smallBats.forEach(function (b) {
            b.classList.remove("is-dim");
        });
        if (bigGlow) bigGlow.classList.remove("is-charged");
        if (glowSmallLeft) {
            later(function () {
                glowSmallLeft.classList.add("is-charged");
                if (global.SFX) global.SFX.play("ready");
            }, 0);
        }
        if (glowSmallRight) {
            later(function () {
                glowSmallRight.classList.add("is-charged");
                if (global.SFX) global.SFX.play("ready");
            }, SLOT_GLOW_STAGGER);
        }
    }

    function phaseWhole() {
        // The parts dim (slot glow off); the whole lights up and glows.
        if (glowSmallLeft) glowSmallLeft.classList.remove("is-charged");
        if (glowSmallRight) glowSmallRight.classList.remove("is-charged");
        smallBats.forEach(function (b) {
            b.classList.add("is-dim");
        });
        bigBats.forEach(function (b) {
            b.classList.remove("is-dim");
        });
        if (bigGlow) bigGlow.classList.add("is-charged");
        if (global.SFX) global.SFX.play("ready");
    }

    // Zoom OUT of the concept board to reveal the whole charged bot
    // celebrating on Screen 3 (mirror of the enter-zoom), let it dance,
    // then run `onDanced`. Reuses the zoomOutOfBot / revealBot keyframes.
    function revealDancingBot(onDanced) {
        const from = document.getElementById("screen-4");
        const screen3 = document.getElementById("screen-3");
        if (from) from.classList.add("is-zooming-out");
        if (global.SFX) global.SFX.play("zoom");
        later(function () {
            if (global.GameNav) global.GameNav.show("screen-3");
            if (screen3) screen3.classList.add("is-revealing");
            if (global.SFX) global.SFX.play("celebrate");
        }, 150);
        later(function () {
            if (screen3) screen3.classList.remove("is-revealing");
            if (from) from.classList.remove("is-zooming-out");
            // announce once the reveal has settled, so the banner is SEEN
            // unrolling while the bot dances
            if (global.Screen3Intro) global.Screen3Intro.showMessage();
            later(onDanced, 3800); // banner opens + types (~2.2s), then a beat
        }, 1300);
    }

    function play() {
        build();
        if (!contentEl) return;
        clearTimers();

        const q = document.getElementById("question-4");
        const textEl = q ? q.querySelector(".question__text") : null;
        const full = textEl ? textEl.getAttribute("data-text") || "" : "";

        resetState();
        if (q) q.classList.remove("is-open");
        if (textEl) textEl.textContent = "";

        // Open the banner, then type the prompt. The phases start when
        // the text begins, so the glow lines up with "These 2 parts".
        later(function () {
            if (q) q.classList.add("is-open");
            if (global.SFX) global.SFX.play("bannerOpen");
            later(function () {
                if (textEl) typewriter(textEl, full, TYPE_SPEED);

                // Phase A — "These 2 parts": part slots glow one by one.
                phaseParts();

                // Phase B — "make this whole.": the whole lights up.
                const phaseBAt = SLOT_GLOW_STAGGER + PHASE_GAP;
                later(phaseWhole, phaseBAt);

                // Part 1 concept taught -> zoom OUT to the celebrating bot
                // (Screen 3), let it dance, then the "your turn" interstitial
                // leads into the Part 1 charge LEVELS.
                later(function () {
                    revealDancingBot(function () {
                        if (global.showYourTurn) global.showYourTurn(1);
                        else if (global.startLevels) global.startLevels(1);
                    });
                }, phaseBAt + 3000);
            }, 650); // after the banner unrolls
        }, 150);
    }

    global.ConceptScreen = { play: play };
})(window);
