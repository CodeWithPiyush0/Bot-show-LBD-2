/* ===========================================================
   concept.js
   Screen 4 — "These two parts make this one whole."
   Shows the three CODES in their sockets — the two PARTS in the
   small slots, the WHOLE in the big slot — then runs a two-phase
   teaching animation synced to the prompt:
     Phase A ("These two parts"): the whole dims; the part SOCKETS
       light up one after another.
     Phase B ("make this one whole."): the parts dim; the whole
       lights up and its socket glows green.
   Timings are placeholders for the eventual voice-over.
   =========================================================== */

(function (global) {
    "use strict";

    const DESIGN_W = 1920;
    const DESIGN_H = 1080;

    // Match the code-tile sizing in batteries.js.
    const BIG_SCALE = 1.6;
    const SMALL_SCALE = 1;

    const pctX = (px) => (px / DESIGN_W) * 100 + "%";
    const pctY = (px) => (px / DESIGN_H) * 100 + "%";

    // Code positions (design px centres) = the socket centres.
    const LAYOUT = [
        { role: "part", cx: 629, cy: 622, where: "small" }, // small-left  = parts[0]
        { role: "part", cx: 1302, cy: 621, where: "small" }, // small-right = parts[1]
        { role: "whole", cx: 965, cy: 268, where: "big" }, // big = whole
    ];

    const TYPE_SPEED = 45;
    const SLOT_GLOW_STAGGER = 600;
    const PHASE_GAP = 1800;

    let contentEl = null;
    let bigSocket = null;
    let socketLeft = null;
    let socketRight = null;
    const smallTiles = [];
    let bigTile = null;
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
            if (global.SFX) global.SFX.play("type");
            i += 1;
            later(tick, speed);
        })();
    }

    function makeTile(value, role, scale, cx, cy) {
        const el = document.createElement("div");
        // Concept tiles always sit IN a slot → number-only (light cream).
        el.className = "code-tile code-tile--" + role + " in-slot";
        el.style.left = pctX(cx);
        el.style.top = pctY(cy);
        el.style.transform = "translate(-50%, -50%) scale(" + scale + ")";
        el.style.pointerEvents = "none";
        const face = document.createElement("div");
        face.className = "code-tile__face";
        const num = document.createElement("span");
        num.className = "code-tile__num";
        num.textContent = value;
        face.appendChild(num);
        el.appendChild(face);
        return el;
    }

    function build() {
        contentEl = document.getElementById("s4-content");
        if (!contentEl) return;
        bigSocket = document.querySelector("#screen-4 .socket--big");
        socketLeft = document.querySelector("#screen-4 .socket--small-left");
        socketRight = document.querySelector("#screen-4 .socket--small-right");

        contentEl.querySelectorAll(".code-tile").forEach(function (el) { el.remove(); });
        smallTiles.length = 0;
        bigTile = null;

        const codes = window.getCodes ? window.getCodes() : { whole: 8, parts: [5, 3] };
        const values = { 0: codes.parts[0], 1: codes.parts[1], 2: codes.whole };

        LAYOUT.forEach(function (g, i) {
            const scale = g.where === "big" ? BIG_SCALE : SMALL_SCALE;
            const el = makeTile(values[i], g.role, scale, g.cx, g.cy);
            contentEl.appendChild(el);
            if (g.where === "big") bigTile = el;
            else smallTiles.push(el);
        });
    }

    function resetState() {
        smallTiles.forEach(function (t) { t.classList.remove("is-dim"); });
        if (bigTile) bigTile.classList.add("is-dim");
        if (bigSocket) bigSocket.classList.remove("is-charged");
        if (socketLeft) socketLeft.classList.remove("is-charged");
        if (socketRight) socketRight.classList.remove("is-charged");
    }

    function phaseParts() {
        // "These two parts": the whole dims; the part sockets glow one by one.
        if (bigTile) bigTile.classList.add("is-dim");
        smallTiles.forEach(function (t) { t.classList.remove("is-dim"); });
        if (bigSocket) bigSocket.classList.remove("is-charged");
        if (socketLeft) {
            later(function () {
                socketLeft.classList.add("is-charged");
                if (global.SFX) global.SFX.play("ready");
            }, 0);
        }
        if (socketRight) {
            later(function () {
                socketRight.classList.add("is-charged");
                if (global.SFX) global.SFX.play("ready");
            }, SLOT_GLOW_STAGGER);
        }
    }

    function phaseWhole() {
        // "make this one whole.": the parts dim; the whole lights up + glows.
        if (socketLeft) socketLeft.classList.remove("is-charged");
        if (socketRight) socketRight.classList.remove("is-charged");
        smallTiles.forEach(function (t) { t.classList.add("is-dim"); });
        if (bigTile) bigTile.classList.remove("is-dim");
        if (bigSocket) bigSocket.classList.add("is-charged");
        if (global.SFX) global.SFX.play("ready");
    }

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
            if (global.Screen3Intro) global.Screen3Intro.showMessage();
            later(onDanced, 3800);
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

        later(function () {
            if (q) q.classList.add("is-open");
            if (global.SFX) global.SFX.play("bannerOpen");
            later(function () {
                if (textEl) typewriter(textEl, full, TYPE_SPEED);

                phaseParts();

                const phaseBAt = SLOT_GLOW_STAGGER + PHASE_GAP;
                later(phaseWhole, phaseBAt);

                later(function () {
                    revealDancingBot(function () {
                        if (global.showYourTurn) global.showYourTurn(1);
                        else if (global.startLevels) global.startLevels(1);
                    });
                }, phaseBAt + 3000);
            }, 650);
        }, 150);
    }

    global.ConceptScreen = { play: play };
})(window);
