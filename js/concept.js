/* ===========================================================
   concept.js — the "parts/whole" teaching screen (both parts).
   `createConcept(opts)` builds the concept for a screen: the three
   CODES sit in their sockets (parts in the small slots, whole in
   the big slot) and a two-phase glow plays, synced to the prompt:
     Part 1 (Screen 4) "These two parts make this one whole."
       Phase A: parts glow; Phase B: whole glows.
     Part 2 (Screen 8) "This whole is made of these two parts."
       Phase A: whole glows; Phase B: parts glow.  (wholeFirst)
   Then it zooms out to reveal the dancing bot and runs onDone.

   Part 1 instance = `window.ConceptScreen`; factory = `window.createConcept`.
   =========================================================== */

(function (global) {
    "use strict";

    const DESIGN_W = 1920;
    const DESIGN_H = 1080;
    const BIG_SCALE = 1.6;
    const SMALL_SCALE = 1;
    const TYPE_SPEED = 45;
    const SLOT_GLOW_STAGGER = 600;
    const PHASE_GAP = 1800;

    const pctX = (px) => (px / DESIGN_W) * 100 + "%";
    const pctY = (px) => (px / DESIGN_H) * 100 + "%";

    // Code positions (design px centres) = the socket centres.
    const LAYOUT = [
        { role: "part", cx: 629, cy: 622, where: "small" },
        { role: "part", cx: 1302, cy: 621, where: "small" },
        { role: "whole", cx: 965, cy: 268, where: "big" },
    ];

    function makeTile(value, role, scale, cx, cy) {
        const el = document.createElement("div");
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

    function createConcept(opts) {
        // opts: { contentId, screenId, questionId, getCodes, wholeFirst,
        //         fromScreenId, toScreenId, onReveal, onDone }
        let contentEl = null, bigSocket = null, socketLeft = null, socketRight = null;
        const smallTiles = [];
        let bigTile = null;
        const timers = [];

        function clearTimers() { timers.forEach(global.clearTimeout); timers.length = 0; }
        function later(fn, ms) { timers.push(global.setTimeout(fn, ms)); }

        function escapeHtml(s) {
            return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }

        // Split text into runs, wrapping each highlighted word in its colour
        // class (highlights = [{word, cls}], first occurrence of each word).
        function buildRuns(text, highlights) {
            if (!highlights || !highlights.length) return [{ t: text }];
            const ranges = [];
            highlights.forEach(function (h) {
                const idx = text.toLowerCase().indexOf(h.word.toLowerCase());
                if (idx >= 0) ranges.push({ start: idx, end: idx + h.word.length, cls: h.cls });
            });
            ranges.sort(function (a, b) { return a.start - b.start; });
            const runs = [];
            let pos = 0;
            ranges.forEach(function (r) {
                if (r.start < pos) return;           // skip overlaps
                if (r.start > pos) runs.push({ t: text.slice(pos, r.start) });
                runs.push({ t: text.slice(r.start, r.end), cls: r.cls });
                pos = r.end;
            });
            if (pos < text.length) runs.push({ t: text.slice(pos) });
            return runs;
        }

        // Render the first `count` characters across the runs as HTML (so a
        // half-typed highlighted word still shows in its colour).
        function renderRuns(runs, count) {
            let out = "", used = 0;
            for (let k = 0; k < runs.length && used < count; k++) {
                const r = runs[k];
                const take = Math.min(r.t.length, count - used);
                const chunk = escapeHtml(r.t.slice(0, take));
                out += r.cls ? '<span class="' + r.cls + '">' + chunk + "</span>" : chunk;
                used += take;
            }
            return out;
        }

        function typewriter(el, runs, speed) {
            const total = runs.reduce(function (s, r) { return s + r.t.length; }, 0);
            el.innerHTML = "";
            let i = 0;
            (function tick() {
                if (i >= total) return;
                i += 1;
                el.innerHTML = renderRuns(runs, i);
                if (global.SFX) global.SFX.play("type");
                later(tick, speed);
            })();
        }

        function build() {
            contentEl = document.getElementById(opts.contentId);
            if (!contentEl) return;
            const sel = "#" + opts.screenId + " ";
            bigSocket = document.querySelector(sel + ".socket--big");
            socketLeft = document.querySelector(sel + ".socket--small-left");
            socketRight = document.querySelector(sel + ".socket--small-right");

            contentEl.querySelectorAll(".code-tile").forEach(function (el) { el.remove(); });
            smallTiles.length = 0;
            bigTile = null;

            const codes = opts.getCodes() || { whole: 8, parts: [5, 3] };
            const values = { 0: codes.parts[0], 1: codes.parts[1], 2: codes.whole };
            LAYOUT.forEach(function (g, i) {
                const scale = g.where === "big" ? BIG_SCALE : SMALL_SCALE;
                const el = makeTile(values[i], g.role, scale, g.cx, g.cy);
                contentEl.appendChild(el);
                if (g.where === "big") bigTile = el;
                else smallTiles.push(el);
            });
        }

        // Pre-Phase-A dim state for a lesson (the side that lights up first
        // stays bright). wholeFirst = the "split" lesson (whole glows first).
        function setInitial(wholeFirst) {
            if (bigSocket) bigSocket.classList.remove("is-charged");
            if (socketLeft) socketLeft.classList.remove("is-charged");
            if (socketRight) socketRight.classList.remove("is-charged");
            if (wholeFirst) {
                if (bigTile) bigTile.classList.remove("is-dim");
                smallTiles.forEach(function (t) { t.classList.add("is-dim"); });
            } else {
                smallTiles.forEach(function (t) { t.classList.remove("is-dim"); });
                if (bigTile) bigTile.classList.add("is-dim");
            }
        }

        function phaseParts() {
            if (bigTile) bigTile.classList.add("is-dim");
            smallTiles.forEach(function (t) { t.classList.remove("is-dim"); });
            if (bigSocket) bigSocket.classList.remove("is-charged");
            if (socketLeft) later(function () { socketLeft.classList.add("is-charged"); if (global.SFX) global.SFX.play("ready"); }, 0);
            if (socketRight) later(function () { socketRight.classList.add("is-charged"); if (global.SFX) global.SFX.play("ready"); }, SLOT_GLOW_STAGGER);
        }

        function phaseWhole() {
            if (socketLeft) socketLeft.classList.remove("is-charged");
            if (socketRight) socketRight.classList.remove("is-charged");
            smallTiles.forEach(function (t) { t.classList.add("is-dim"); });
            if (bigTile) bigTile.classList.remove("is-dim");
            if (bigSocket) bigSocket.classList.add("is-charged");
            if (global.SFX) global.SFX.play("ready");
        }

        function reveal(onDanced) {
            const from = document.getElementById(opts.fromScreenId);
            const to = document.getElementById(opts.toScreenId);
            if (from) from.classList.add("is-zooming-out");
            if (global.SFX) global.SFX.play("zoom");
            later(function () {
                if (global.GameNav) global.GameNav.show(opts.toScreenId);
                if (to) to.classList.add("is-revealing");
                if (global.SFX) global.SFX.play("celebrate");
            }, 150);
            later(function () {
                if (to) to.classList.remove("is-revealing");
                if (from) from.classList.remove("is-zooming-out");
                if (opts.onReveal) opts.onReveal();
                later(onDanced, 3800);
            }, 1300);
        }

        function play() {
            build();
            if (!contentEl) return;
            clearTimers();

            const q = document.getElementById(opts.questionId);
            const textEl = q ? q.querySelector(".question__text") : null;
            // One or more LESSONS taught in sequence in the same banner. Each:
            // { text, wholeFirst }. Default = a single lesson from data-text.
            const lessons = opts.lessons || [{
                text: textEl ? textEl.getAttribute("data-text") || "" : "",
                wholeFirst: opts.wholeFirst,
            }];

            if (q) q.classList.remove("is-open");
            if (textEl) textEl.innerHTML = "";
            setInitial(lessons[0].wholeFirst);

            const PHASE_AT = SLOT_GLOW_STAGGER + PHASE_GAP; // phase B start
            const LESSON_MS = PHASE_AT + 1800;              // phases + read beat

            let t = 150;
            later(function () {
                if (q) q.classList.add("is-open");
                if (global.SFX) global.SFX.play("bannerOpen");
            }, t);
            t += 650;

            lessons.forEach(function (lesson) {
                later(function () {
                    setInitial(lesson.wholeFirst);
                    if (textEl) typewriter(textEl, buildRuns(lesson.text, lesson.highlight), TYPE_SPEED);
                    var phaseA = lesson.wholeFirst ? phaseWhole : phaseParts;
                    var phaseB = lesson.wholeFirst ? phaseParts : phaseWhole;
                    phaseA();
                    later(phaseB, PHASE_AT);
                }, t);
                t += LESSON_MS;
            });

            later(function () { reveal(opts.onDone); }, t + 400);
        }

        return { play: play };
    }

    global.createConcept = createConcept;

    /* The concept (Screen 4 → Screen 3) teaches BOTH directions in one go:
       first "two parts make a whole" (combine), then "a whole splits into two
       parts" (split). */
    global.ConceptScreen = createConcept({
        contentId: "s4-content",
        screenId: "screen-4",
        questionId: "question-4",
        getCodes: function () { return window.getCodes(1); },
        lessons: [
            {
                text: "These two parts make this one whole.", wholeFirst: false,
                highlight: [{ word: "parts", cls: "hl-part" }, { word: "whole", cls: "hl-whole" }],
            },
            {
                text: "This whole can be split into these two parts.", wholeFirst: true,
                highlight: [{ word: "whole", cls: "hl-whole" }, { word: "parts", cls: "hl-part" }],
            },
        ],
        fromScreenId: "screen-4",
        toScreenId: "screen-3",
        onReveal: function () { if (window.Screen3Intro) window.Screen3Intro.showMessage(); },
        onDone: function () {
            if (window.showYourTurn) window.showYourTurn(1);
            else if (window.startLevels) window.startLevels(1);
        },
    });
})(window);
