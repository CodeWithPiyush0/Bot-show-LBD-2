/* ===========================================================
   batteries.js  (Part 1 — FIX with codes)
   Screen 2 mechanic:
   - Three draggable number "codes" sit in the bottom dock:
     the WHOLE and its two PARTS (parts[0] + parts[1] === whole).
   - Drag each code into its correct slot:
       * the WHOLE -> the big (top) slot
       * each PART -> either small (bottom) slot
   - A correct drop snaps the tile into the socket; a wrong drop
     bounces the tile home and the slot flashes red ("no").
   - When all three slots are filled, the connectors light up green
     (the bot is fixed) and the finale plays.

   Geometry is in the 1920 x 1080 design space, mapped to % of the
   stage (which renders at real pixel size, so 1 viewport px ==
   1 stage px while dragging).

   NOTE: the public global is still `window.Batteries` (init/setup/
   setEnabled/playHint) so intro.js / main.js need no changes.
   `window.batteryFitScale` is kept here for part2.js (still batteries).
   =========================================================== */

(function (global) {
    "use strict";

    const DESIGN_W = 1920;
    const DESIGN_H = 1080;

    // Slot centres (absolute design px) — must match the .slot / .socket CSS.
    const SLOTS = {
        big: { x: 815, y: 160.5, w: 300, h: 215 },        // centre (965, 268)
        "small-left": { x: 534, y: 547, w: 190, h: 150 }, // centre (629, 622)
        "small-right": { x: 1207, y: 546, w: 190, h: 150 }, // centre (1302, 621)
    };
    // All three slots are drop targets.
    const DROPPABLE = ["big", "small-left", "small-right"];

    // Code-tile scaling. Native size lives in the dock + small slots; it
    // grows in the (bigger) whole slot, so the number scales with it.
    const BIG_SCALE = 1.6;
    const SMALL_SCALE = 1;

    // Number-tray home centres (design px) = the tray's three cream pads.
    const DOCK_Y = 950;
    const DOCK_X = [816, 960, 1103];

    const pctX = (px) => (px / DESIGN_W) * 100 + "%";
    const pctY = (px) => (px / DESIGN_H) * 100 + "%";

    let stage = null;
    let connectorsEl = null;
    let solved = false;
    let enabled = true; // dragging is gated off during the Screen 2 intro
    let contentEl = null;
    const slotEls = {};
    const socketEls = {};
    const slotOccupant = {}; // slotId -> tile element
    const tiles = []; // the three draggable code tiles

    // Part 2 still uses batteries — keep the fit-scale helper available.
    const SMALL_SLOT_W = 407;
    const BAT_W = 62, GROUP_GAP = 12, PLACED_SCALE = 0.82;
    function fitScale(count) {
        const groupWidth = count * BAT_W + (count - 1) * GROUP_GAP;
        return Math.min(PLACED_SCALE, (SMALL_SLOT_W * 0.96) / groupWidth);
    }
    window.batteryFitScale = fitScale;

    function slotScale(id) {
        return id === "big" ? BIG_SCALE : SMALL_SCALE;
    }

    function setTransform(el, scale) {
        el.dataset.scale = scale;
        el.style.transform = "translate(-50%, -50%) scale(" + scale + ")";
    }

    // role: "whole" goes to the big slot; "part" goes to either small slot.
    function slotAccepts(id, tile) {
        return id === "big" ? tile.dataset.role === "whole"
                            : tile.dataset.role === "part";
    }

    function makeTile(value, role, ghost) {
        const t = document.createElement("div");
        t.className = "code-tile code-tile--" + role + (ghost ? " dock-ghost" : "");
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

    // Shuffle the dock order so the codes aren't shown sorted (which would
    // telegraph which one is the whole). Re-roll if it lands fully ascending
    // OR descending, so the row never looks ordered.
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

    function createTiles() {
        const codes = window.getCodes ? window.getCodes() : { whole: 8, parts: [5, 3] };
        const spec = shuffleDock([
            { value: codes.whole, role: "whole" },
            { value: codes.parts[0], role: "part" },
            { value: codes.parts[1], role: "part" },
        ]);

        spec.forEach(function (s, i) {
            const homeX = DOCK_X[i];
            const homeY = DOCK_Y;

            // No CSS ghost: the tray art's cream pads ARE the home slots.
            const tile = makeTile(s.value, s.role, false);
            tile.dataset.homeX = homeX;
            tile.dataset.homeY = homeY;
            tile.dataset.location = "dock";
            tile.style.left = pctX(homeX);
            tile.style.top = pctY(homeY);
            setTransform(tile, 1);
            contentEl.appendChild(tile);
            tiles.push(tile);
            attachDrag(tile);
        });
    }

    function freeSlotOf(tile) {
        const prev = tile.dataset.location;
        if (prev && prev !== "dock" && slotOccupant[prev] === tile) {
            slotOccupant[prev] = null;
        }
    }

    function sendHome(tile) {
        freeSlotOf(tile);
        tile.dataset.location = "dock";
        tile.classList.remove("in-slot"); // restore the full code block in the dock
        tile.style.left = pctX(parseFloat(tile.dataset.homeX));
        tile.style.top = pctY(parseFloat(tile.dataset.homeY));
        setTransform(tile, 1);
    }

    function placeInSlot(tile, id) {
        freeSlotOf(tile);
        if (slotOccupant[id] && slotOccupant[id] !== tile) {
            sendHome(slotOccupant[id]);
        }
        slotOccupant[id] = tile;
        tile.dataset.location = id;
        tile.classList.add("in-slot"); // drop the box; only the number stays
        const r = SLOTS[id];
        tile.style.left = pctX(r.x + r.w / 2);
        tile.style.top = pctY(r.y + r.h / 2);
        setTransform(tile, slotScale(id));
        if (global.SFX) global.SFX.play("place");
    }

    function allFilled() {
        return DROPPABLE.every(function (id) { return slotOccupant[id]; });
    }

    /* ---- the bot is fixed: light the circuit green ---- */
    function startSolve() {
        solved = true;
        abortHint();
        cancelIdle();
        clearReject();

        if (connectorsEl) connectorsEl.classList.add("is-flowing");
        if (global.SFX) global.SFX.play("electricity", { loop: true });

        global.setTimeout(function () {
            if (connectorsEl) connectorsEl.classList.add("is-green");
            DROPPABLE.forEach(function (id) {
                if (socketEls[id]) socketEls[id].classList.add("is-charged");
            });
            if (global.SFX) { global.SFX.stop("electricity"); global.SFX.play("powerUp"); }
        }, 1200);

        global.setTimeout(fullyCharged, 2700);
    }

    /* ---- finale: bot fixed ---- */
    function fullyCharged() {
        const fadeOut = document.querySelectorAll("#s2-content .code-dock");
        fadeOut.forEach(function (el) {
            el.style.transition = "opacity 0.5s ease";
            el.style.opacity = "0";
            el.style.pointerEvents = "none";
        });
        global.setTimeout(function () {
            fadeOut.forEach(function (el) { el.style.display = "none"; });
        }, 550);

        global.setTimeout(function () {
            if (contentEl) contentEl.classList.add("is-charged-final");
        }, 250);

        global.setTimeout(function () {
            if (window.currentLevel === 2) {
                const s3Bot = document.querySelector("#screen-3 .charged-bot img");
                if (s3Bot && window.currentScheme) {
                    s3Bot.src = "assets/images/" + window.currentScheme + "_bot_charged.webp";
                }
                if (window.GameFx) window.GameFx.exitBot();
                global.setTimeout(function () {
                    if (window.returnToChooser) window.returnToChooser();
                }, 5100);
            } else {
                if (window.GameNav) window.GameNav.show("screen-4");
                if (window.ConceptScreen) window.ConceptScreen.play();
            }
        }, 1600);
    }

    /* ---- ghost hint: demonstrate a drag ---- */
    let hintActive = false;
    let hintGhost = null;

    function abortHint() {
        hintActive = false;
        if (hintGhost) { hintGhost.remove(); hintGhost = null; }
    }

    function pickDemoMove() {
        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            if (tile.dataset.location !== "dock") continue;
            const targets = tile.dataset.role === "whole"
                ? ["big"]
                : ["small-left", "small-right"];
            const dst = targets.filter(function (id) { return !slotOccupant[id]; })[0];
            if (dst) return { tile: tile, dst: dst };
        }
        return null;
    }

    const MOVE = 1000, HOLD = 250, FADE = 300, GAP = 250;
    const CYCLE = MOVE + HOLD + FADE + GAP;

    function ghostRun(cycles) {
        if (hintActive || solved || !contentEl) return;
        hintActive = true;
        let n = 0;

        function cycle() {
            if (!hintActive) return;
            if (n >= cycles || solved || !enabled) { abortHint(); return; }
            n += 1;

            const move = pickDemoMove();
            if (!move) { abortHint(); return; }
            const slot = SLOTS[move.dst];

            if (hintGhost) hintGhost.remove();
            hintGhost = makeTile(move.tile.dataset.value, move.tile.dataset.role, false);
            hintGhost.classList.add("is-ghost");
            hintGhost.style.left = move.tile.style.left;
            hintGhost.style.top = move.tile.style.top;
            setTransform(hintGhost, 1);
            hintGhost.style.opacity = "0";
            contentEl.appendChild(hintGhost);
            void hintGhost.offsetWidth;

            hintGhost.style.transition =
                "left " + MOVE + "ms ease, top " + MOVE + "ms ease, transform " +
                MOVE + "ms ease, opacity 250ms ease";
            window.setTimeout(function () {
                if (!hintActive || !hintGhost) return;
                hintGhost.style.opacity = "0.5";
                hintGhost.style.left = pctX(slot.x + slot.w / 2);
                hintGhost.style.top = pctY(slot.y + slot.h / 2);
                setTransform(hintGhost, slotScale(move.dst));
            }, 30);

            window.setTimeout(function () {
                if (!hintActive || !hintGhost) return;
                hintGhost.style.transition = "opacity " + FADE + "ms ease";
                hintGhost.style.opacity = "0";
            }, MOVE + HOLD);

            window.setTimeout(cycle, CYCLE);
        }
        cycle();
    }

    /* ---- inactivity nudge (chooser levels only) ---- */
    const IDLE_MS = 12000;
    let idleTimer = null;

    function cancelIdle() {
        if (idleTimer) { global.clearTimeout(idleTimer); idleTimer = null; }
    }

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

    function playHint() {
        if (!contentEl || solved) { enabled = true; return; }
        enabled = true;
        if (window.currentLevel === 2) { scheduleIdle(); return; }
        ghostRun(3); // tutorial: demonstrate the drag 3x
    }

    function slotAtPoint(clientX, clientY) {
        for (let i = 0; i < DROPPABLE.length; i++) {
            const id = DROPPABLE[i];
            const el = slotEls[id];
            if (!el) continue;
            const r = el.getBoundingClientRect();
            if (clientX >= r.left && clientX <= r.right &&
                clientY >= r.top && clientY <= r.bottom) {
                return id;
            }
        }
        return null;
    }

    function clearHover() {
        DROPPABLE.forEach(function (id) {
            if (slotEls[id]) slotEls[id].classList.remove("is-hover");
        });
    }

    /* ---- wrong drop: bounce home + flash the slot red ("no") ---- */
    const rejectTimers = {};
    function clearReject() {
        DROPPABLE.forEach(function (id) {
            if (rejectTimers[id]) { global.clearTimeout(rejectTimers[id]); rejectTimers[id] = null; }
            if (slotEls[id]) slotEls[id].classList.remove("is-reject");
        });
    }

    function rejectSlot(id, tile) {
        sendHome(tile); // animated bounce back
        if (solved) return;
        if (global.SFX) global.SFX.play("reject");
        const el = slotEls[id];
        if (el) {
            el.classList.remove("is-reject");
            void el.offsetWidth; // restart the shake on rapid re-drops
            el.classList.add("is-reject");
        }
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
            if (hintActive) abortHint();
            if (solved || !enabled) return;
            e.preventDefault();
            dragging = true;
            if (global.SFX) global.SFX.play("pickup");
            stageRect = stage.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            baseLeftPct = parseFloat(tile.style.left);
            baseTopPct = parseFloat(tile.style.top);
            tile.classList.remove("in-slot"); // drag the WHOLE code block
            tile.classList.add("is-dragging");
            setTransform(tile, 1); // native size while dragging
            tile.setPointerCapture(e.pointerId);
        });

        tile.addEventListener("pointermove", (e) => {
            if (!dragging) return;
            const dxPct = ((e.clientX - startX) / stageRect.width) * 100;
            const dyPct = ((e.clientY - startY) / stageRect.height) * 100;
            tile.style.left = baseLeftPct + dxPct + "%";
            tile.style.top = baseTopPct + dyPct + "%";

            clearHover();
            const id = slotAtPoint(e.clientX, e.clientY);
            if (id) slotEls[id].classList.add("is-hover");
        });

        function endDrag(e) {
            if (!dragging) return;
            dragging = false;
            tile.classList.remove("is-dragging");
            clearHover();
            const id = slotAtPoint(e.clientX, e.clientY);
            if (id && slotAccepts(id, tile)) {
                placeInSlot(tile, id);
                if (allFilled() && !solved) startSolve();
            } else if (id) {
                rejectSlot(id, tile); // wrong slot: shake "no" + bounce home
            } else {
                sendHome(tile);
            }
        }

        tile.addEventListener("pointerup", endDrag);
        tile.addEventListener("pointercancel", endDrag);
    }

    function setupBatteries() {
        if (!contentEl) return;

        contentEl.querySelectorAll(".code-tile").forEach(function (el) { el.remove(); });
        tiles.length = 0;

        DROPPABLE.forEach(function (id) { slotOccupant[id] = null; });

        createTiles();

        solved = false;
        enabled = false;
        abortHint();
        cancelIdle();
        clearReject();
        if (global.SFX) global.SFX.stop("electricity");

        contentEl.classList.remove("is-charged-final");
        if (connectorsEl) connectorsEl.classList.remove("is-flowing", "is-green");
        DROPPABLE.forEach(function (id) {
            if (socketEls[id]) socketEls[id].classList.remove("is-charged");
        });

        const dock = contentEl.querySelector(".code-dock");
        if (dock) {
            dock.style.opacity = "";
            dock.style.display = "";
            dock.style.pointerEvents = "";
            dock.style.transition = "";
        }
    }

    function init() {
        stage = document.getElementById("stage");
        const screen = document.getElementById("screen-2");
        if (!stage || !screen) return;

        connectorsEl = document.getElementById("connectors-2");
        contentEl = document.getElementById("s2-content");

        document.querySelectorAll("#screen-2 .slot").forEach((el) => {
            const id = el.dataset.slot;
            slotEls[id] = el;
            slotOccupant[id] = null;
        });
        socketEls.big = screen.querySelector(".socket--big");
        socketEls["small-left"] = screen.querySelector(".socket--small-left");
        socketEls["small-right"] = screen.querySelector(".socket--small-right");

        ["pointerdown", "pointermove"].forEach(function (ev) {
            screen.addEventListener(ev, onActivity, { passive: true });
        });

        setupBatteries();
    }

    global.Batteries = {
        init: init,
        setup: setupBatteries,
        setEnabled: function (v) {
            enabled = !!v;
            if (!enabled) { abortHint(); cancelIdle(); }
        },
        playHint: playHint,
    };
    document.addEventListener("DOMContentLoaded", init);
})(window);
