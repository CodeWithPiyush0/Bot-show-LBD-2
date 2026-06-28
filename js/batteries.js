/* ===========================================================
   batteries.js  — the code-sorting puzzle (used by BOTH parts).
   `createCodePuzzle(opts)` builds one self-contained puzzle for a
   screen: three draggable number "codes" (the WHOLE + two PARTS)
   are dragged into the three slots (WHOLE -> big/top, each PART ->
   either small/bottom). A correct drop snaps in; a wrong drop
   bounces home + flashes the slot red. When all three are filled
   the connectors light up green and the finale (opts.onSolved) runs.

   Part 1 (combine, bottom-up): the guide cues the PARTS first, then
   the WHOLE. Part 2 (split, top-down): WHOLE first, then the PARTS.
   Geometry is the 1920x1080 design space, mapped to % of the stage.

   Part 1's instance is exposed as `window.Batteries`; the factory is
   `window.createCodePuzzle` (part2.js builds the Screen-6 instance).
   =========================================================== */

(function (global) {
    "use strict";

    const DESIGN_W = 1920;
    const DESIGN_H = 1080;

    // Slot centres (absolute design px) — match the .slot / .socket CSS.
    const SLOTS = {
        big: { x: 815, y: 160.5, w: 300, h: 215 },        // centre (965, 268)
        "small-left": { x: 534, y: 547, w: 190, h: 150 }, // centre (629, 622)
        "small-right": { x: 1207, y: 546, w: 190, h: 150 }, // centre (1302, 621)
    };
    const DROPPABLE = ["big", "small-left", "small-right"];

    const BIG_SCALE = 1.6;  // code grows in the (bigger) whole slot
    const SMALL_SCALE = 1;
    const DOCK_Y = 950;
    const DOCK_X = [816, 960, 1103]; // number-tray home centres

    const pctX = (px) => (px / DESIGN_W) * 100 + "%";
    const pctY = (px) => (px / DESIGN_H) * 100 + "%";

    function makeTile(value, role, extra) {
        const t = document.createElement("div");
        t.className = "code-tile code-tile--" + role + (extra ? " " + extra : "");
        t.dataset.value = value;
        t.dataset.role = role;
        const face = document.createElement("div");
        face.className = "code-tile__face";
        const num = document.createElement("span");
        num.className = "code-tile__num";
        num.textContent = value;
        face.appendChild(num);
        t.appendChild(face);
        return t;
    }

    // Shuffle the dock order so the codes aren't shown sorted (no fully
    // ascending/descending row, which would telegraph the whole).
    function shuffleDock(arr) {
        const a = arr.slice();
        for (let tries = 0; tries < 20; tries++) {
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const t = a[i]; a[i] = a[j]; a[j] = t;
            }
            const v = a.map(function (s) { return s.value; });
            const asc = v[0] <= v[1] && v[1] <= v[2];
            const desc = v[0] >= v[1] && v[1] >= v[2];
            if (!asc && !desc) break;
        }
        return a;
    }

    /* =================== the factory =================== */
    function createCodePuzzle(opts) {
        // opts: { screenId, contentId, connectorsId, getCodes, guideWholeFirst, onSolved }
        let stage = null;
        let connectorsEl = null;
        let contentEl = null;
        let solved = false;
        let enabled = true;
        const slotEls = {};
        const socketEls = {};
        const slotOccupant = {};
        const tiles = [];

        function slotScale(id) { return id === "big" ? BIG_SCALE : SMALL_SCALE; }
        function setTransform(el, scale) {
            el.dataset.scale = scale;
            el.style.transform = "translate(-50%, -50%) scale(" + scale + ")";
        }
        function slotAccepts(id, tile) {
            return id === "big" ? tile.dataset.role === "whole"
                                : tile.dataset.role === "part";
        }

        function createTiles() {
            const codes = opts.getCodes() || { whole: 8, parts: [5, 3] };
            const spec = shuffleDock([
                { value: codes.whole, role: "whole" },
                { value: codes.parts[0], role: "part" },
                { value: codes.parts[1], role: "part" },
            ]);
            spec.forEach(function (s, i) {
                const tile = makeTile(s.value, s.role);
                tile.dataset.homeX = DOCK_X[i];
                tile.dataset.homeY = DOCK_Y;
                tile.dataset.location = "dock";
                tile.style.left = pctX(DOCK_X[i]);
                tile.style.top = pctY(DOCK_Y);
                setTransform(tile, 1);
                contentEl.appendChild(tile);
                tiles.push(tile);
                attachDrag(tile);
            });
        }

        function freeSlotOf(tile) {
            const prev = tile.dataset.location;
            if (prev && prev !== "dock" && slotOccupant[prev] === tile) slotOccupant[prev] = null;
        }

        // A faded WHOLE-block copy left in the tray once a code is placed.
        function addFade(tile) {
            if (tile._fade || !contentEl) return;
            const f = makeTile(tile.dataset.value, tile.dataset.role, "dock-faded");
            f.style.left = pctX(parseFloat(tile.dataset.homeX));
            f.style.top = pctY(parseFloat(tile.dataset.homeY));
            setTransform(f, 1);
            contentEl.appendChild(f);
            tile._fade = f;
        }
        function removeFade(tile) {
            if (tile._fade) { tile._fade.remove(); tile._fade = null; }
        }

        function sendHome(tile) {
            freeSlotOf(tile);
            tile.dataset.location = "dock";
            tile.classList.remove("in-slot");
            removeFade(tile);
            tile.style.left = pctX(parseFloat(tile.dataset.homeX));
            tile.style.top = pctY(parseFloat(tile.dataset.homeY));
            setTransform(tile, 1);
        }

        function placeInSlot(tile, id) {
            freeSlotOf(tile);
            if (slotOccupant[id] && slotOccupant[id] !== tile) sendHome(slotOccupant[id]);
            slotOccupant[id] = tile;
            tile.dataset.location = id;
            tile.classList.add("in-slot");
            const r = SLOTS[id];
            tile.style.left = pctX(r.x + r.w / 2);
            tile.style.top = pctY(r.y + r.h / 2);
            setTransform(tile, slotScale(id));
            addFade(tile);
            if (global.SFX) global.SFX.play("place");
        }

        function allFilled() {
            return DROPPABLE.every(function (id) { return slotOccupant[id]; });
        }

        /* ---- solved: light the circuit green, then finale ---- */
        function startSolve() {
            solved = true;
            abortHint(); cancelIdle(); stopGuide(); clearReject();
            // No travelling current-flow pulse — the connectors simply turn
            // green below to mark success.
            if (global.SFX) global.SFX.play("electricity", { loop: true });
            global.setTimeout(function () {
                if (connectorsEl) connectorsEl.classList.add("is-green");
                DROPPABLE.forEach(function (id) {
                    if (socketEls[id]) socketEls[id].classList.add("is-charged");
                });
                if (global.SFX) { global.SFX.stop("electricity"); global.SFX.play("powerUp"); }
            }, 1200);
            global.setTimeout(finale, 2700);
        }

        function finale() {
            const fadeOut = contentEl.querySelectorAll(".code-dock, .dock-faded");
            fadeOut.forEach(function (el) {
                el.style.transition = "opacity 0.5s ease";
                el.style.opacity = "0";
                el.style.pointerEvents = "none";
            });
            global.setTimeout(function () {
                fadeOut.forEach(function (el) { el.style.display = "none"; });
            }, 550);
            global.setTimeout(function () { contentEl.classList.add("is-charged-final"); }, 250);
            global.setTimeout(function () {
                opts.onSolved(window.currentLevel === 2);
            }, 1600);
        }

        /* ---- ghost hint ---- */
        let hintActive = false;
        let hintGhost = null;
        let ghostGen = 0;
        const MOVE = 1000, HOLD = 250, FADE = 300, GAP = 250;
        const CYCLE = MOVE + HOLD + FADE + GAP;

        function abortHint() {
            ghostGen++;
            hintActive = false;
            if (hintGhost) { hintGhost.remove(); hintGhost = null; }
        }

        // Pick a valid demo move, ROUND-ROBIN through the undropped codes so the
        // ghost shows BOTH the whole→big and parts→small moves (free order).
        let demoIdx = 0;
        function pickDemoMove() {
            const undropped = tiles.filter(function (t) { return t.dataset.location === "dock"; });
            if (!undropped.length) return null;
            for (let k = 0; k < undropped.length; k++) {
                const tile = undropped[(demoIdx + k) % undropped.length];
                const targets = tile.dataset.role === "whole" ? ["big"] : ["small-left", "small-right"];
                const dst = targets.filter(function (id) { return !slotOccupant[id]; })[0];
                if (dst) { demoIdx = (demoIdx + k + 1) % undropped.length; return { tile: tile, dst: dst }; }
            }
            return null;
        }

        // Glide a ghost of `tile` into `slotId`. If looping, re-runs each CYCLE.
        function ghostGlide(tile, slotId, gen) {
            const slot = SLOTS[slotId];
            if (hintGhost) hintGhost.remove();
            hintGhost = makeTile(tile.dataset.value, tile.dataset.role, "is-ghost");
            hintGhost.style.left = pctX(parseFloat(tile.dataset.homeX));
            hintGhost.style.top = pctY(parseFloat(tile.dataset.homeY));
            setTransform(hintGhost, 1);
            hintGhost.style.opacity = "0";
            contentEl.appendChild(hintGhost);
            void hintGhost.offsetWidth;
            hintGhost.style.transition =
                "left " + MOVE + "ms ease, top " + MOVE + "ms ease, transform " +
                MOVE + "ms ease, opacity 250ms ease";
            window.setTimeout(function () {
                if (gen !== ghostGen || !hintGhost) return;
                hintGhost.style.opacity = "0.55";
                hintGhost.style.left = pctX(slot.x + slot.w / 2);
                hintGhost.style.top = pctY(slot.y + slot.h / 2);
                setTransform(hintGhost, slotScale(slotId));
            }, 30);
            window.setTimeout(function () {
                if (gen !== ghostGen || !hintGhost) return;
                hintGhost.style.transition = "opacity " + FADE + "ms ease";
                hintGhost.style.opacity = "0";
            }, MOVE + HOLD);
        }

        function ghostRun(cycles) {
            if (hintActive || solved || !contentEl) return;
            hintActive = true;
            const gen = ++ghostGen;
            let n = 0;
            function cycle() {
                if (gen !== ghostGen || !hintActive) return;
                if (n >= cycles || solved || !enabled) { abortHint(); return; }
                n += 1;
                const move = pickDemoMove();
                if (!move) { abortHint(); return; }
                ghostGlide(move.tile, move.dst, gen);
                window.setTimeout(cycle, CYCLE);
            }
            cycle();
        }

        function ghostLoop(tile, slotId) {
            abortHint();
            const gen = ghostGen;
            if (!tile || solved || !contentEl) return;
            hintActive = true;
            function cycle() {
                if (gen !== ghostGen || !hintActive || !guideActive) return;
                ghostGlide(tile, slotId, gen);
                window.setTimeout(cycle, CYCLE);
            }
            cycle();
        }

        /* ---- inactivity nudge (chooser levels only) ---- */
        const IDLE_MS = 12000;
        let idleTimer = null;
        function cancelIdle() { if (idleTimer) { global.clearTimeout(idleTimer); idleTimer = null; } }
        function scheduleIdle() {
            cancelIdle();
            if (window.currentLevel !== 2 || solved || !enabled) return;
            idleTimer = global.setTimeout(function () { ghostRun(Infinity); }, IDLE_MS);
        }
        function onActivity() {
            if (window.currentLevel !== 2) return;
            if (hintActive) abortHint();
            scheduleIdle();
        }

        /* ---- guided tutorial (currentLevel === 1) ----
           Demo ONE code at a time: glow the next un-dropped code (left→right in
           the tray) + its target slot and loop a ghost of that single drag.
           When the kid places it, this re-runs for the NEXT code, so the hint
           walks the codes one by one. (Dragging itself is still free — nothing
           is locked — the kid just sees one demo at a time.) */
        let guideActive = false;

        function clearGuideCue() {
            tiles.forEach(function (t) { t.classList.remove("is-target"); });
            DROPPABLE.forEach(function (id) { if (socketEls[id]) socketEls[id].classList.remove("is-cue"); });
        }
        function cueTutorial() {
            if (!guideActive) return;
            clearGuideCue();
            abortHint();
            // the current code = the left-most code still in the tray
            const undropped = tiles
                .filter(function (t) { return t.dataset.location === "dock"; })
                .sort(function (a, b) { return parseFloat(a.dataset.homeX) - parseFloat(b.dataset.homeX); });
            if (!undropped.length) return;
            const tile = undropped[0];
            const targets = tile.dataset.role === "whole" ? ["big"] : ["small-left", "small-right"];
            const dst = targets.filter(function (id) { return !slotOccupant[id]; })[0];
            if (!dst) return;
            tile.classList.add("is-target");
            if (socketEls[dst]) socketEls[dst].classList.add("is-cue");
            ghostLoop(tile, dst); // loop the demo for THIS code until it's placed
        }
        function startGuide() { guideActive = true; cueTutorial(); }
        function stopGuide() { guideActive = false; clearGuideCue(); }

        function playHint() {
            if (!contentEl || solved) { enabled = true; return; }
            enabled = true;
            if (window.currentLevel === 2) { scheduleIdle(); return; }
            startGuide();
        }

        function slotAtPoint(cx, cy) {
            for (let i = 0; i < DROPPABLE.length; i++) {
                const el = slotEls[DROPPABLE[i]];
                if (!el) continue;
                const r = el.getBoundingClientRect();
                if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return DROPPABLE[i];
            }
            return null;
        }
        function clearHover() {
            DROPPABLE.forEach(function (id) { if (socketEls[id]) socketEls[id].classList.remove("is-hover"); });
        }

        /* ---- wrong drop: bounce home + flash the slot red ---- */
        const rejectTimers = {};
        function clearReject() {
            DROPPABLE.forEach(function (id) {
                if (rejectTimers[id]) { global.clearTimeout(rejectTimers[id]); rejectTimers[id] = null; }
                if (socketEls[id]) socketEls[id].classList.remove("is-reject");
            });
        }
        function rejectSlot(id, tile) {
            sendHome(tile);
            if (solved) return;
            if (global.SFX) global.SFX.play("reject");
            const el = socketEls[id]; // glow + shake the visible slot
            if (el) { el.classList.remove("is-reject"); void el.offsetWidth; el.classList.add("is-reject"); }
            if (rejectTimers[id]) global.clearTimeout(rejectTimers[id]);
            rejectTimers[id] = global.setTimeout(function () {
                if (el) el.classList.remove("is-reject");
                rejectTimers[id] = null;
            }, 550);
        }

        function attachDrag(tile) {
            let startX = 0, startY = 0, baseLeftPct = 0, baseTopPct = 0;
            let stageRect = null, dragging = false;

            tile.addEventListener("pointerdown", (e) => {
                if (hintActive) abortHint(); // grabbing a code stops the demo
                if (solved || !enabled) return;
                e.preventDefault();
                dragging = true;
                stageRect = stage.getBoundingClientRect();
                startX = e.clientX; startY = e.clientY;
                baseLeftPct = parseFloat(tile.style.left);
                baseTopPct = parseFloat(tile.style.top);
                tile.classList.remove("in-slot");
                tile.classList.add("is-dragging");
                setTransform(tile, 1);
                tile.setPointerCapture(e.pointerId);
            });

            tile.addEventListener("pointermove", (e) => {
                if (!dragging) return;
                tile.style.left = baseLeftPct + ((e.clientX - startX) / stageRect.width) * 100 + "%";
                tile.style.top = baseTopPct + ((e.clientY - startY) / stageRect.height) * 100 + "%";
                clearHover();
                const id = slotAtPoint(e.clientX, e.clientY);
                if (id && socketEls[id]) socketEls[id].classList.add("is-hover");
            });

            function endDrag(e) {
                if (!dragging) return;
                dragging = false;
                tile.classList.remove("is-dragging");
                clearHover();
                const id = slotAtPoint(e.clientX, e.clientY);
                if (id && slotAccepts(id, tile)) {
                    placeInSlot(tile, id);
                    if (guideActive) cueTutorial(); // re-glow remaining + re-demo
                    if (allFilled() && !solved) startSolve();
                } else if (id) {
                    rejectSlot(id, tile);
                    if (guideActive) cueTutorial();
                } else {
                    sendHome(tile);
                    if (guideActive) cueTutorial();
                }
            }
            tile.addEventListener("pointerup", endDrag);
            tile.addEventListener("pointercancel", endDrag);
        }

        function setup() {
            if (!contentEl) return;
            // Idempotent: if the board ALREADY shows exactly these codes,
            // untouched (all three in the dock, not solved), keep the existing
            // shuffle. setup() runs twice around the enter transition (once
            // backstage before the zoom, once from Screen2Intro on settle) — a
            // second re-shuffle would be VISIBLE as the codes flicking order.
            const want = opts.getCodes() || { whole: 8, parts: [5, 3] };
            const wantKey = [want.whole, want.parts[0], want.parts[1]].sort(function (a, b) { return a - b; }).join(",");
            const haveKey = tiles.map(function (t) { return Number(t.dataset.value); }).sort(function (a, b) { return a - b; }).join(",");
            const allInDock = tiles.length === 3 && tiles.every(function (t) { return t.dataset.location === "dock"; });
            if (!solved && allInDock && wantKey === haveKey) {
                enabled = false; // keep it locked like a fresh setup; no re-shuffle
                return;
            }
            contentEl.querySelectorAll(".code-tile").forEach(function (el) { el.remove(); });
            tiles.length = 0;
            DROPPABLE.forEach(function (id) { slotOccupant[id] = null; });
            createTiles();
            solved = false;
            enabled = false;
            abortHint(); cancelIdle(); stopGuide(); clearReject();
            if (global.SFX) global.SFX.stop("electricity");
            contentEl.classList.remove("is-charged-final");
            if (connectorsEl) connectorsEl.classList.remove("is-flowing", "is-green", "flow-down");
            DROPPABLE.forEach(function (id) { if (socketEls[id]) socketEls[id].classList.remove("is-charged"); });
            const dock = contentEl.querySelector(".code-dock");
            if (dock) { dock.style.opacity = ""; dock.style.display = ""; dock.style.pointerEvents = ""; dock.style.transition = ""; }
        }

        function init() {
            stage = document.getElementById("stage");
            const screen = document.getElementById(opts.screenId);
            if (!stage || !screen) return;
            connectorsEl = document.getElementById(opts.connectorsId);
            contentEl = document.getElementById(opts.contentId);
            screen.querySelectorAll(".slot").forEach(function (el) {
                slotEls[el.dataset.slot] = el;
                slotOccupant[el.dataset.slot] = null;
            });
            socketEls.big = screen.querySelector(".socket--big");
            socketEls["small-left"] = screen.querySelector(".socket--small-left");
            socketEls["small-right"] = screen.querySelector(".socket--small-right");
            ["pointerdown", "pointermove"].forEach(function (ev) {
                screen.addEventListener(ev, onActivity, { passive: true });
            });
            setup();
        }

        return {
            init: init,
            setup: setup,
            setEnabled: function (v) { enabled = !!v; if (!enabled) { abortHint(); cancelIdle(); } },
            playHint: playHint,
        };
    }

    global.createCodePuzzle = createCodePuzzle;

    /* =================== Part 1 instance (Screen 2) =================== */
    function part1Solved(isLevel) {
        if (isLevel) {
            // the fixed bot dances via its GIF; setDanceBot preloads + decode-
            // gates the swap so the right bot shows cleanly (no stale flash).
            if (window.setDanceBot && window.currentScheme) {
                window.setDanceBot(window.currentScheme);
            }
            if (window.GameFx) window.GameFx.exitBot();
            global.setTimeout(function () { if (window.returnToChooser) window.returnToChooser(); }, 5100);
        } else {
            if (window.GameNav) window.GameNav.show("screen-4");
            if (window.ConceptScreen) window.ConceptScreen.play();
        }
    }

    const part1 = createCodePuzzle({
        screenId: "screen-2",
        contentId: "s2-content",
        connectorsId: "connectors-2",
        getCodes: function () { return window.getCodes(1); },
        guideWholeFirst: false, // parts first (bottom-up)
        onSolved: part1Solved,
    });
    global.Batteries = part1;
    document.addEventListener("DOMContentLoaded", part1.init);
})(window);
