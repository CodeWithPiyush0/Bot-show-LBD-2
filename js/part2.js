/* ===========================================================
   part2.js
   Part Two — fixing overcharged bots by SPLITTING the whole into
   two parts (the inverse of Part One).
     Screen 5: overcharged bots intro -> tap centre bot -> zoom in
     Screen 6: big slot starts full; drag the two groups OUT into
               the small slots; when both are filled the bot is fixed
     Screen 7: the fixed bot celebrates
     Screen 8: concept "This whole is made of these 2 parts"
   Reuses the shared geometry/components from Part One.
   =========================================================== */

(function (global) {
    "use strict";

    const DESIGN_W = 1920;
    const DESIGN_H = 1080;
    const PLACED_SCALE = 0.82;
    const TYPE = 45;

    // The two groups start as the two rows of the (full) big slot.
    const BIG_CX = 965.5;
    const GROUPS = [
        { color: "blue", count: 4, cx: 965.5, cy: 217 },
        { color: "yellow", count: 6, cx: 965.5, cy: 319 },
    ];

    // Inner recesses for placing groups when dropped.
    const SLOTS = {
        "small-left": { x: 425.5, y: 552.5, w: 407, h: 139 }, // centre (629, 622)
        "small-right": { x: 1098.5, y: 551.5, w: 407, h: 139 }, // centre (1302, 621)
    };
    const DROPPABLE = ["small-left", "small-right"];

    const pctX = (px) => (px / DESIGN_W) * 100 + "%";
    const pctY = (px) => (px / DESIGN_H) * 100 + "%";
    const byId = (id) => document.getElementById(id);

    // Scale a group down when it's too wide for a small slot (7+ batteries).
    // Shared impl lives in batteries.js (window.batteryFitScale).
    function fitScale(count) {
        if (window.batteryFitScale) return window.batteryFitScale(count);
        return Math.min(PLACED_SCALE, (407 * 0.96) / (count * 62 + (count - 1) * 12));
    }

    let stage = null;
    let s6 = null;
    let centerTapEnabled = false;
    let splitEnabled = false;
    let fixed = false;
    const slotOccupant = {};
    const slotEls = {};

    /* ---------- shared helpers ---------- */
    function typewriter(el, text, speed, onDone) {
        el.textContent = "";
        let i = 0;
        (function tick() {
            if (i >= text.length) {
                if (onDone) onDone();
                return;
            }
            el.textContent += text.charAt(i);
            if (global.SFX) global.SFX.play("type"); // one tick per character
            i += 1;
            global.setTimeout(tick, speed);
        })();
    }

    function setTransform(el, scale) {
        el.style.transform = "translate(-50%, -50%) scale(" + scale + ")";
    }

    // Open a banner and type a message (optionally a 2nd one), leaving it open.
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
                        global.setTimeout(function () {
                            typewriter(textEl, msg2, TYPE, onDone);
                        }, 1600);
                    } else if (onDone) {
                        onDone();
                    }
                });
            }, 650);
        }, 150);
    }

    /* ---------- generic zoom transitions (reuse main.css keyframes) ---------- */
    function zoomInto(fromId, toId, onDone) {
        const from = byId(fromId);
        const to = byId(toId);
        from.classList.add("is-zooming");
        if (global.SFX) global.SFX.play("zoom");
        global.setTimeout(function () {
            global.GameNav.show(toId);
            to.classList.add("is-entering");
        }, 380);
        global.setTimeout(function () {
            to.classList.remove("is-entering");
            from.classList.remove("is-zooming");
            if (onDone) onDone();
        }, 1200);
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
    function startIntro() {
        const screen5 = byId("screen-5");
        const stage5 = byId("s5-stage");
        const q = byId("question-5");
        if (!q || !screen5) return;
        const textEl = q.querySelector(".question__text");
        const msg1 = textEl.getAttribute("data-text");
        const msg2 = textEl.getAttribute("data-text2");
        const msg3 = textEl.getAttribute("data-text3");

        // Set center bot blue color filter for Level 2
        const centerBot = document.querySelector(".bot--oc-center");
        if (centerBot) {
            if (window.currentLevel === 2) {
                centerBot.classList.add("hue-blue");
            } else {
                centerBot.classList.remove("hue-blue");
            }
        }

        // Set left side bot to charged/fixed purple bot
        const ocLeft = document.querySelector(".bot--oc-left");
        if (ocLeft) {
            if (window.currentLevel === 2) {
                ocLeft.src = "assets/images/purple_bot_charged.webp";
            } else {
                ocLeft.src = "assets/images/Sahdow_Purple_Bot.webp";
            }
        }

        centerTapEnabled = false;
        // reset to Phase A state
        screen5.classList.remove("is-spotlit");
        if (stage5) stage5.classList.remove("is-focusing");
        sideBots().forEach(function (b) {
            b.classList.remove("is-gone");
        });
        q.classList.remove("is-open");
        textEl.textContent = "";

        // Phase A: all bots equally lit; type "Oh no! ..."
        global.setTimeout(function () {
            q.classList.add("is-open");
            if (global.SFX) global.SFX.play("bannerOpen");
            global.setTimeout(function () {
                typewriter(textEl, msg1, TYPE, function () {
                    global.setTimeout(phaseB, 1400);
                });
            }, 650);
        }, 150);

        // Phase B: spotlight on the centre, sides darken; "Let's start fixing this bot."
        function phaseB() {
            screen5.classList.add("is-spotlit");
            if (global.SFX) global.SFX.play("spotlight");
            typewriter(textEl, msg2, TYPE, function () {
                global.setTimeout(phaseC, 1400);
            });
        }

        // Phase C: remove the side bots, zoom in a little; "Let us split its batteries."
        function phaseC() {
            sideBots().forEach(function (b) {
                b.classList.add("is-gone");
            });
            if (stage5) stage5.classList.add("is-focusing");
            typewriter(textEl, msg3, TYPE, function () {
                centerTapEnabled = true; // now the bot can be tapped
            });
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

    function sideBots() {
        return Array.prototype.slice.call(
            document.querySelectorAll(".bot--oc-left, .bot--oc-right")
        );
    }

    // Continue the little zoom all the way into the bot, then Screen 6.
    function enterFromFocus() {
        const stage5 = byId("s5-stage");
        const s6 = byId("screen-6");
        stage5.style.transition = "transform 0.6s cubic-bezier(0.42, 0, 1, 1)";
        stage5.style.transform = "scale(4.5)";
        if (global.SFX) global.SFX.play("zoom");
        global.setTimeout(function () {
            global.GameNav.show("screen-6"); // screen-5 fades out
            s6.classList.add("is-entering");
            startSplit();
        }, 300);
        global.setTimeout(function () {
            s6.classList.remove("is-entering");
            // reset screen-5 for a possible replay
            stage5.style.transition = "";
            stage5.style.transform = "";
            stage5.classList.remove("is-focusing");
            byId("screen-5").classList.remove("is-spotlit");
            sideBots().forEach(function (b) {
                b.classList.remove("is-gone");
            });
        }, 1100);
    }

    /* ---------- Screen 6: split the batteries ---------- */
    function makeGroup(g) {
        const el = document.createElement("div");
        el.className = "battery-group battery-group--" + g.color;
        el.dataset.color = g.color;
        el.dataset.homeX = g.cx;
        el.dataset.homeY = g.cy;
        el.dataset.location = "big";
        for (let i = 0; i < g.count; i++) {
            const b = document.createElement("img");
            b.className = "battery battery--" + g.color;
            b.src = "assets/images/" + g.color + "_battery.svg";
            b.alt = "";
            b.draggable = false;
            el.appendChild(b);
        }
        el.style.left = pctX(g.cx);
        el.style.top = pctY(g.cy);
        setTransform(el, PLACED_SCALE);
        return el;
    }

    /* ---- ghost hint: demonstrate dragging a group OUT of the big slot ----
       Mirror of the Part 1 hint (batteries.js): a translucent copy of a group
       still in the big slot glides down into an empty small slot. cycles = 3
       for the tutorial demo; Infinity for the levels' inactivity nudge
       (loops until the player does something). */
    let hintActive = false;
    let hintGhost = null;
    const HINT_MOVE = 1000;
    const HINT_HOLD = 250;
    const HINT_FADE = 300;
    const HINT_GAP = 250;
    const HINT_CYCLE = HINT_MOVE + HINT_HOLD + HINT_FADE + HINT_GAP;

    function abortHint() {
        hintActive = false;
        if (hintGhost) {
            hintGhost.remove();
            hintGhost = null;
        }
    }

    function buildGhost(color, count) {
        const g = document.createElement("div");
        g.className = "battery-group battery-group--" + color + " is-ghost";
        for (let i = 0; i < count; i++) {
            const b = document.createElement("img");
            b.className = "battery battery--" + color;
            b.src = "assets/images/" + color + "_battery.svg";
            b.alt = "";
            b.draggable = false;
            g.appendChild(b);
        }
        return g;
    }

    function ghostRun(cycles) {
        if (hintActive || fixed || !s6) return;
        hintActive = true;
        let n = 0;

        function cycle() {
            if (!hintActive) return;
            if (n >= cycles || fixed || !splitEnabled) {
                abortHint();
                return;
            }
            n += 1;

            // a group still in the big slot → the first empty small slot
            const group = s6.querySelector(
                '.battery-group[data-location="big"]:not(.is-ghost)'
            );
            const dstId = DROPPABLE.filter(function (id) {
                return !slotOccupant[id];
            })[0];
            if (!group || !dstId) {
                abortHint();
                return;
            }
            const r = SLOTS[dstId];

            if (hintGhost) hintGhost.remove();
            hintGhost = buildGhost(group.dataset.color, group.children.length);
            hintGhost.style.left = group.style.left;
            hintGhost.style.top = group.style.top;
            setTransform(hintGhost, PLACED_SCALE);
            hintGhost.style.opacity = "0";
            s6.appendChild(hintGhost);
            void hintGhost.offsetWidth; // settle the start position

            // setTimeout, not rAF — reliable under headless virtual-time
            hintGhost.style.transition =
                "left " + HINT_MOVE + "ms ease, top " + HINT_MOVE + "ms ease, transform " +
                HINT_MOVE + "ms ease, opacity 250ms ease";
            global.setTimeout(function () {
                if (!hintActive || !hintGhost) return;
                hintGhost.style.opacity = "0.3";
                hintGhost.style.left = pctX(r.x + r.w / 2);
                hintGhost.style.top = pctY(r.y + r.h / 2);
                setTransform(hintGhost, fitScale(hintGhost.children.length));
            }, 30);

            global.setTimeout(function () {
                if (!hintActive || !hintGhost) return;
                hintGhost.style.transition = "opacity " + HINT_FADE + "ms ease";
                hintGhost.style.opacity = "0";
            }, HINT_MOVE + HINT_HOLD);

            global.setTimeout(cycle, HINT_CYCLE);
        }
        cycle();
    }

    /* ---- inactivity nudge (chooser levels only) ---- */
    const IDLE_MS = 12000;
    let idleTimer = null;

    function cancelIdle() {
        if (idleTimer) {
            global.clearTimeout(idleTimer);
            idleTimer = null;
        }
    }

    function scheduleIdle() {
        cancelIdle();
        if (window.currentLevel !== 2 || fixed || !splitEnabled) return;
        idleTimer = global.setTimeout(function () {
            ghostRun(Infinity);
        }, IDLE_MS);
    }

    // Levels only — the tutorial's 3× demo must survive stray mouse moves
    // (it's aborted by an actual drag start in attachDrag).
    function onActivity() {
        if (window.currentLevel !== 2) return;
        if (hintActive) abortHint();
        scheduleIdle();
    }

    // Reset the split board to its fresh state (groups full in the big slot,
    // small slots empty). Called BOTH on entry (startSplit) and EARLY — before
    // the zoom reveals screen-6 — so the previous level's batteries never flash.
    function resetSplit() {
        stage = byId("stage");
        s6 = byId("s6-content");
        if (!s6) return;
        fixed = false;
        splitEnabled = false;
        abortHint();
        cancelIdle();

        DROPPABLE.forEach(function (id) {
            slotOccupant[id] = null;
            slotEls[id] = s6.querySelector(".slot--" + id);
        });

        // Clear existing groups first to handle level switching / replays
        const oldGroups = s6.querySelectorAll(".battery-group");
        oldGroups.forEach(el => el.remove());

        // Set counts from the current stage's Part 2 (split) config.
        const c = window.getCounts ? window.getCounts(2) : { blue: 4, yellow: 6 };
        GROUPS[0].count = c.blue;
        GROUPS[1].count = c.yellow;

        // Rebuild the battery groups (all in the big slot)
        GROUPS.forEach(function (g) {
            const el = makeGroup(g);
            s6.appendChild(el);
            attachDrag(el);
        });

        updateBigSlotState();
    }

    function startSplit() {
        resetSplit();
        if (!s6) return;

        // Inactivity tracking for the levels' looping ghost nudge (wired once).
        const screen6 = byId("screen-6");
        if (screen6 && !screen6.dataset.idleWired) {
            screen6.dataset.idleWired = "1";
            ["pointerdown", "pointermove"].forEach(function (ev) {
                screen6.addEventListener(ev, onActivity, { passive: true });
            });
        }

        // Keep the board at full size the whole time.
        const q = byId("question-6");
        const textEl = q.querySelector(".question__text");
        // Show only the actionable instruction so dragging starts soon.
        // ("Let us split its batteries." is the zoom-in/VO line.)
        openBanner(
            q,
            textEl.getAttribute("data-text2"),
            null,
            function () {
                splitEnabled = true; // dragging available
                if (window.currentLevel === 2) {
                    // Levels: no upfront demo — nudge after 12s of inactivity.
                    scheduleIdle();
                } else {
                    // Tutorial: demonstrate the big→small drag 3×.
                    ghostRun(3);
                }
            }
        );
    }

    function slotAtPoint(x, y) {
        for (let i = 0; i < DROPPABLE.length; i++) {
            const el = slotEls[DROPPABLE[i]];
            if (!el) continue;
            const r = el.getBoundingClientRect();
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
                return DROPPABLE[i];
            }
        }
        return null;
    }

    function clearHover() {
        DROPPABLE.forEach(function (id) {
            if (slotEls[id]) slotEls[id].classList.remove("is-hover");
        });
    }

    function updateBigSlotState() {
        const bigGlow = document.querySelector(".screen--6 .slot-glow--big");
        const panelBig = document.querySelector(".screen--6 .panel--big");
        if (!bigGlow || !panelBig) return;
        
        let removedCount = 0;
        if (slotOccupant["small-left"]) removedCount++;
        if (slotOccupant["small-right"]) removedCount++;

        bigGlow.classList.remove("is-red", "is-yellow", "is-green");
        panelBig.classList.remove("is-red", "is-yellow", "is-green");

        if (removedCount === 0) {
            bigGlow.classList.add("is-red");
            panelBig.classList.add("is-red");
            bigGlow.src = "assets/images/Bigger_Slot_Red.svg";
        } else if (removedCount === 1) {
            bigGlow.classList.add("is-yellow");
            panelBig.classList.add("is-yellow");
            bigGlow.src = "assets/images/Bigger_Slot_Red.svg";
        } else if (removedCount === 2) {
            bigGlow.classList.add("is-normal");
            panelBig.classList.add("is-normal");
            bigGlow.src = "assets/images/Bigger_Slot_White.svg";
        }
    }

    function freeSlotOf(group) {
        const prev = group.dataset.location;
        if (prev && slotOccupant[prev] === group) slotOccupant[prev] = null;
    }

    function sendHome(group) {
        freeSlotOf(group);
        group.dataset.location = "big";
        group.style.left = pctX(parseFloat(group.dataset.homeX));
        group.style.top = pctY(parseFloat(group.dataset.homeY));
        setTransform(group, PLACED_SCALE);
        updateBigSlotState();
    }

    function placeInSlot(group, id) {
        freeSlotOf(group);
        if (slotOccupant[id] && slotOccupant[id] !== group) sendHome(slotOccupant[id]);
        slotOccupant[id] = group;
        group.dataset.location = id;
        const r = SLOTS[id];
        group.style.left = pctX(r.x + r.w / 2);
        group.style.top = pctY(r.y + r.h / 2);
        setTransform(group, fitScale(group.children.length));
        updateBigSlotState();
        if (global.SFX) global.SFX.play("place");

        if (slotOccupant["small-left"] && slotOccupant["small-right"] && !fixed) {
            onFixed();
        }
    }

    function attachDrag(group) {
        let startX = 0;
        let startY = 0;
        let baseLeft = 0;
        let baseTop = 0;
        let rect = null;
        let dragging = false;

        group.addEventListener("pointerdown", function (e) {
            if (hintActive) abortHint(); // kid takes over from the demo
            if (!splitEnabled || fixed) return;
            e.preventDefault();
            dragging = true;
            if (global.SFX) global.SFX.play("pickup");
            rect = stage.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            baseLeft = parseFloat(group.style.left);
            baseTop = parseFloat(group.style.top);
            group.classList.add("is-dragging");
            group.setPointerCapture(e.pointerId);
        });
        group.addEventListener("pointermove", function (e) {
            if (!dragging) return;
            group.style.left = baseLeft + ((e.clientX - startX) / rect.width) * 100 + "%";
            group.style.top = baseTop + ((e.clientY - startY) / rect.height) * 100 + "%";
            clearHover();
            const id = slotAtPoint(e.clientX, e.clientY);
            if (id) slotEls[id].classList.add("is-hover");
        });
        function end(e) {
            if (!dragging) return;
            dragging = false;
            group.classList.remove("is-dragging");
            clearHover();
            const id = slotAtPoint(e.clientX, e.clientY);
            if (id) placeInSlot(group, id);
            else sendHome(group);
        }
        group.addEventListener("pointerup", end);
        group.addEventListener("pointercancel", end);
    }

    function onFixed() {
        fixed = true;
        splitEnabled = false;
        abortHint();
        cancelIdle();
        if (global.SFX) global.SFX.play("success");

        // The Screen 7 celebrating bot: in chooser levels it's the chosen
        // bot's charged art; in the tutorial it's the white/purple bot.
        const s7Bot = document.querySelector("#screen-7 .charged-bot img");
        if (s7Bot) {
            s7Bot.classList.remove("hue-blue");
            s7Bot.src = (window.currentLevel === 2 && window.currentScheme)
                ? "assets/images/" + window.currentScheme + "_bot_charged.webp"
                : "assets/images/White_purple_bot_charged.webp";
        }

        const q = byId("question-6");
        // announce, then stay inside the bot to teach the concept (Screen 8).
        // The celebrating dance now comes AFTER the concept (playConcept2
        // zooms out to reveal it).
        openBanner(q, "This bot is fixed.", null, null);
        global.setTimeout(function () {
            if (window.currentLevel === 2) {
                // Chooser level: zoom out to the bot dancing full-screen
                // (Screen 7), let it celebrate, then end the level.
                zoomOutTo("screen-6", "screen-7", function () {
                    global.setTimeout(function () {
                        if (window.returnToChooser) window.returnToChooser();
                    }, 3000); // dance ~3s
                });
            } else {
                // Tutorial: teach the concept (Screen 8), which then
                // zooms out to reveal the dance.
                global.GameNav.show("screen-8");
                playConcept2();
            }
        }, 2200);
    }

    /* ---------- Screen 8: concept "a whole is made of 2 parts" ---------- */
    const C_LAYOUT = [
        { color: "blue", count: 4, cx: 629, cy: 622, where: "small" },
        { color: "yellow", count: 6, cx: 1302, cy: 621, where: "small" },
        { color: "blue", count: 4, cx: 965.5, cy: 217, where: "big" },
        { color: "yellow", count: 6, cx: 965.5, cy: 319, where: "big" },
    ];
    let c2Built = false;
    const c2Small = [];
    const c2Big = [];
    let c2BigGlow = null;
    let c2GlowL = null;
    let c2GlowR = null;

    function buildConcept2() {
        const content = byId("s8-content");
        if (!content) return;
        c2BigGlow = document.querySelector("#screen-8 .slot-glow--big");
        c2GlowL = document.querySelector("#screen-8 .slot-glow--small-left");
        c2GlowR = document.querySelector("#screen-8 .slot-glow--small-right");

        // Clear existing groups
        const oldGroups = content.querySelectorAll(".battery-group");
        oldGroups.forEach(el => el.remove());
        c2Small.length = 0;
        c2Big.length = 0;

        // Counts mirror the split puzzle just completed (current stage, Part 2).
        const cc = window.getCounts ? window.getCounts(2) : { blue: 4, yellow: 6 };
        C_LAYOUT[0].count = cc.blue; // small-left
        C_LAYOUT[2].count = cc.blue; // big top row
        C_LAYOUT[1].count = cc.yellow; // small-right
        C_LAYOUT[3].count = cc.yellow; // big bottom row

        C_LAYOUT.forEach(function (g) {
            const el = makeGroup({ color: g.color, count: g.count, cx: g.cx, cy: g.cy });
            el.dataset.location = "";
            if (g.where === "small") setTransform(el, fitScale(g.count));
            content.appendChild(el);
            const arr = g.where === "big" ? c2Big : c2Small;
            for (let i = 0; i < el.children.length; i++) arr.push(el.children[i]);
        });
        c2Built = true;
    }

    function playConcept2() {
        buildConcept2();
        const q = byId("question-8");
        const textEl = q ? q.querySelector(".question__text") : null;
        const full = textEl ? textEl.getAttribute("data-text") || "" : "";

        // reset: parts dim, whole full (inverse of Part One)
        c2Small.forEach(function (b) {
            b.classList.add("is-dim");
        });
        c2Big.forEach(function (b) {
            b.classList.remove("is-dim");
        });
        if (c2BigGlow) c2BigGlow.classList.remove("is-charged");
        if (c2GlowL) c2GlowL.classList.remove("is-charged");
        if (c2GlowR) c2GlowR.classList.remove("is-charged");

        if (q) q.classList.remove("is-open");
        if (textEl) textEl.textContent = "";

        global.setTimeout(function () {
            if (q) q.classList.add("is-open");
            if (global.SFX) global.SFX.play("bannerOpen");
            global.setTimeout(function () {
                if (textEl) typewriter(textEl, full, TYPE);

                // Phase A — "This whole": the whole (big slot) glows.
                if (c2BigGlow) c2BigGlow.classList.add("is-charged");
                if (global.SFX) global.SFX.play("ready");

                // Phase B — "...is made of these 2 parts": parts light up one by one.
                global.setTimeout(function () {
                    if (c2BigGlow) c2BigGlow.classList.remove("is-charged");
                    c2Big.forEach(function (b) {
                        b.classList.add("is-dim");
                    });
                    c2Small.forEach(function (b) {
                        b.classList.remove("is-dim");
                    });
                    if (c2GlowL) c2GlowL.classList.add("is-charged");
                    if (global.SFX) global.SFX.play("ready");
                    global.setTimeout(function () {
                        if (c2GlowR) c2GlowR.classList.add("is-charged");
                        if (global.SFX) global.SFX.play("ready");
                    }, 600);
                }, 2400);

                // Part 2 concept taught -> zoom OUT to reveal the bot
                // celebrating (Screen 7), let it dance, then the "your turn"
                // interstitial leads into the Part 2 split LEVELS.
                global.setTimeout(function () {
                    zoomOutTo("screen-8", "screen-7", function () {
                        global.setTimeout(function () {
                            if (global.showYourTurn) global.showYourTurn(2);
                            else if (global.startLevels) global.startLevels(2);
                        }, 3000);
                    });
                }, 6500);
            }, 650);
        }, 150);
    }

    global.Part2 = {
        startIntro: startIntro,
        startSplit: startSplit,
        resetSplit: resetSplit,
        playConcept2: playConcept2,
    };
    document.addEventListener("DOMContentLoaded", function () {
        // Run any deferred init
    });
})(window);
