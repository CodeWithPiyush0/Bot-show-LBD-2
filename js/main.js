/* ===========================================================
   main.js
   Entry point for the Bot Show activity game.
   Wires up screen interactions.
   =========================================================== */

(function () {
    "use strict";

    window.currentLevel = 1;
    // Which half of the game we're in:
    //   1 = CHARGE (Part 1): tutorial teaches charging, then 4 charge levels.
    //   2 = SPLIT  (Part 2): tutorial teaches splitting, then 4 split levels.
    window.gamePart = 1;

    // ---- Per-stage puzzle config -----------------------------------------
    // 6 stages: Tutorial, then Levels 1-5. One unified "fix with codes" puzzle
    // (`{ whole, parts:[a, b] }`, a + b === whole). The kid drags the three
    // codes into the three slots in ANY order (top/whole or bottom/parts first).
    window.STAGES = [
        { key: "tutorial", part1: { whole: 8,  parts: [5, 3]  } },
        { key: "level1",   part1: { whole: 12, parts: [6, 6]  } },
        { key: "level2",   part1: { whole: 15, parts: [8, 7]  } },
        { key: "level3",   part1: { whole: 16, parts: [7, 9]  } },
        { key: "level4",   part1: { whole: 20, parts: [9, 11] } },
        { key: "level5",   part1: { whole: 20, parts: [8, 12] } },
    ];
    window.gameStage = 0; // index into STAGES (0 = Tutorial)
    window.getCodes = function (part) {
        const s = window.STAGES[window.gameStage] || window.STAGES[0];
        return (part === 2 && s.part2) ? s.part2 : s.part1; // part2 dropped; falls back
    };

    // Each bot has its own interior-panel colour scheme (per the Figma):
    // orange / purple (Part 1 L1/L2) and white / blue (Part 2 L1/L2). The
    // filled colour boards are pre-rendered images (panel_<scheme>.webp), so we
    // just swap the src of every panel layer in the given screens.
    // Per-scheme interior config: board `fill` (sampled from panel_<scheme>.webp,
    // used by the .slot-cover patch), `slot` art (slot_<scheme>.webp), and the
    // connector `hue` shift (recolours connector.webp's orange toward the bot).
    // Part 1: orange/gold/blue/purple/pink. Part 2: white + red/green/teal/yellow.
    const SCHEME = {
        orange: { fill: "#ffcc99", slot: "orange", hue: 0 },
        gold:   { fill: "#e9e292", slot: "gold",   hue: 12 },
        blue:   { fill: "#5985d4", slot: "blue",   hue: 188 },
        purple: { fill: "#cf9fe8", slot: "purple", hue: 250 },
        pink:   { fill: "#fa89bd", slot: "pink",   hue: 300 },
        white:  { fill: "#fcf6ef", slot: "orange", hue: 0 },
        red:    { fill: "#fec2ad", slot: "red",    hue: -24 },
        green:  { fill: "#0199a8", slot: "green",  hue: 88 },
        teal:   { fill: "#00c5be", slot: "teal",   hue: 155 },
        yellow: { fill: "#dba454", slot: "yellow", hue: 13 },
    };
    function setPanelScheme(screenIds, scheme) {
        const src = "assets/images/panel_" + scheme + ".webp";
        const cfg = SCHEME[scheme];
        const slotSrc = cfg ? "assets/images/slot_" + cfg.slot + ".webp" : null;
        screenIds.forEach(function (id) {
            const root = document.getElementById(id);
            if (!root) return;
            root.querySelectorAll("img.panel").forEach(function (img) {
                img.src = src;
                img.removeAttribute("data-src");
            });
            if (slotSrc) {
                root.querySelectorAll("img.socket").forEach(function (img) {
                    img.src = slotSrc;
                    img.removeAttribute("data-src");
                });
            }
            if (cfg) {
                root.style.setProperty("--board-fill", cfg.fill);
                root.style.setProperty("--conn-hue", cfg.hue + "deg");
            }
        });
    }
    window.setPanelScheme = setPanelScheme;

    function setupLevel(level) {
        window.currentLevel = level;
        // Bridge to the stage table: L1 = Tutorial, L2 = first chooser stage.
        // (Stages 2-4 activate as the chooser progression is built out.)
        window.gameStage = level === 2 ? 1 : 0;
        const game = document.getElementById("game");
        const orangeBot = document.querySelector(".bot--orange");
        const purpleBot = document.querySelector(".bot--purple");
        const screen3Bot = document.querySelector("#screen-3 .charged-bot img");

        if (level === 2) {
            if (game) game.classList.add("level-2");
            if (orangeBot) orangeBot.src = "assets/images/orange_bot_charged.webp";
            if (purpleBot) purpleBot.src = "assets/images/purple_bot_low.webp";
            if (screen3Bot) screen3Bot.src = "assets/images/purple_bot_charged.webp";
        } else {
            if (game) game.classList.remove("level-2");
            if (orangeBot) orangeBot.src = "assets/images/orange_bot.webp";
            if (purpleBot) purpleBot.src = "assets/images/purple_bot_low.webp";
            if (screen3Bot) screen3Bot.src = "assets/images/orange_bot_charged.webp";
        }

        // Panel colour scheme per bot/level.
        setPanelScheme(["screen-2", "screen-4"], level === 2 ? "purple" : "orange");
        setPanelScheme(["screen-6", "screen-8"], level === 2 ? "blue" : "white");
    }
    window.setupLevel = setupLevel;

    // Theatre-curtain transition: close the curtains over the message, run
    // `onSwap` behind them, then part to reveal the next screen.
    // openAt (optional): when the curtains start re-opening — default 2600ms
    // holds the message; pass ~1500 for a quick textless close-and-part.
    function playCurtain(title, sub, onSwap, openAt) {
        const OPEN = openAt || 2600;
        const curtains = document.getElementById("curtains");
        const titleEl = document.getElementById("curtain-title");
        const subEl = document.getElementById("curtain-sub");
        if (titleEl) titleEl.textContent = title;
        if (subEl) subEl.textContent = sub;

        // Play the curtain swish on every transition. Cut off the (long)
        // celebrate cheer the moment the curtain begins to close.
        if (window.SFX) { window.SFX.stop("celebrate"); window.SFX.play("curtain"); }

        if (!curtains) {
            onSwap();
            return;
        }
        curtains.classList.add("is-active");
        window.requestAnimationFrame(function () {
            curtains.classList.add("is-closed");
        });
        window.setTimeout(onSwap, 950); // swap behind the closed curtains
        window.setTimeout(function () {
            curtains.classList.remove("is-closed");
        }, OPEN); // hold the message, then open
        window.setTimeout(function () {
            curtains.classList.remove("is-active");
        }, OPEN + 1000);
    }
    window.playCurtain = playCurtain;

    // Tutorial → levels handoff: a TEXTLESS curtain closes over the dancing
    // bot, parts on the bare stage, then the "your turn" CLIP plays IN FULL —
    // Bite FLIES in, does a superhero LANDING, says the line (speech bubble),
    // then TAPS HIS WRIST, which summons the NEXT SCREEN'S BOTS to slide IN from
    // the right along the floor — on the SAME stage (not a screen-panel swap,
    // which felt abrupt). Once they settle, a gentle opacity crossfade hands off
    // to the live chooser.
    //
    // The choreography is driven by the CLIP'S OWN playback time (timeupdate),
    // NOT wall-clock timers — playback has start latency, and timing it by
    // wall-clock fired cues out of sync. We only hand off when the clip ENDS.
    const TURN_VIDEO_AT = 2200; // when the clip starts (after curtains part)
    const TURN_PULL_AT = 7.6;   // clip time (s) Bite turns to walk OUT → start sliding the
                                // chooser screen in from the right (after the wrist tap)
    const TURN_SLIDE_MS = 3400; // slow element slide-in (elemSlideIn 3.4s), paced to Bite's exit
    // The bots that get pulled in match the part: charge = low bots, split =
    // overcharged bots (same sprites the chooser then shows).
    const TURN_BOTS = {
        1: ["gold_bot_low", "blue_bot_low", "purple_bot_low", "pink_bot_low"],
        2: ["red_bot_overcharged", "green_bot_overcharged", "teal_bot_overcharged", "yellow_bot_overcharged"],
    };

    function fillTurnBots(part) {
        const wrap = document.getElementById("turn-bots");
        if (!wrap) return;
        wrap.innerHTML = "";
        (TURN_BOTS[part] || TURN_BOTS[1]).forEach(function (name) {
            const img = document.createElement("img");
            img.src = "assets/images/" + name + ".webp";
            img.alt = "";
            img.draggable = false;
            wrap.appendChild(img);
        });
    }

    function showYourTurn(part) {
        const video = document.getElementById("turn-video");
        const bubble = document.getElementById("turn-bubble");
        const screen1 = document.getElementById("screen-1");
        if (bubble) bubble.classList.remove("is-shown", "is-hidden");
        if (screen1) screen1.classList.remove("is-elements-in"); // reset the element-slide for replay
        if (video) { try { video.pause(); video.currentTime = 0; } catch (e) {} }

        playCurtain("", "", function () {
            window.GameNav.show("screen-turn");
        }, 1500);

        // Curtains parted → play the full clip and wire the time-driven cues.
        window.setTimeout(function () {
            if (video) {
                try { video.currentTime = 0; } catch (e) {}
                const p = video.play();
                if (p && p.catch) p.catch(function () {});
            }
            wireTurnTimeline(part, video, bubble);
        }, TURN_VIDEO_AT);
    }
    window.showYourTurn = showYourTurn;

    // The bubble text reveals via a CSS typewriter (steps, 1.4s after a 0.5s
    // delay). Fire one `type` tick per character, synced to that reveal.
    function typeBubbleSfx(bubble) {
        if (!bubble || !window.SFX) return;
        const span = bubble.querySelector(".turn-bubble__text");
        const len = (span && span.textContent) ? span.textContent.length : 20;
        const DELAY = 500, DUR = 1400, step = DUR / Math.max(1, len);
        for (let k = 0; k < len; k++) {
            window.setTimeout(function () { window.SFX.play("type"); }, DELAY + k * step);
        }
    }

    // Fire each cue off the clip's real currentTime, with wall-clock fallbacks
    // in case playback never advances (e.g. autoplay blocked).
    function wireTurnTimeline(part, video, bubble) {
        let bubbleShown = false, bubbleHidden = false, wristTapped = false, pulling = false, done = false;
        let flyStarted = false;

        // The flying whoosh must line up with Bite actually flying on screen, so
        // start it on the video's `playing` event (real playback start, after any
        // buffering) — NOT a wall-clock timer, which would drift from the frames.
        function startFly() {
            if (flyStarted) return;
            flyStarted = true;
            if (window.SFX) window.SFX.play("flying");
        }
        function stopFly() { if (window.SFX) window.SFX.stop("flying"); }
        if (video) video.addEventListener("playing", startFly, { once: true });

        function doPull() {
            if (pulling) return;
            pulling = true;
            startBotsPull(part);
            // Hand off only AFTER the bots have finished sliding in (not on the
            // clip's `ended` — that fired while the slide was still running and
            // looked abrupt). Bite has already walked out by now.
            window.setTimeout(doFinish, TURN_SLIDE_MS + 350);
        }
        function doFinish() {
            if (done) return;
            done = true;
            stopFly(); // safety: never let the whoosh linger past the clip
            if (video) video.removeEventListener("timeupdate", onTime);
            finalizeTurn(part);
        }
        function onTime() {
            const t = (video && video.currentTime) || 0;
            if (!flyStarted && t > 0) startFly(); // fallback if `playing` didn't fire
            // bubble after the landing + stand-up; hide before the wrist tap
            if (!bubbleShown && t >= 3.0) {
                bubbleShown = true;
                stopFly(); // Bite has landed and starts talking — end the flying whoosh
                if (bubble) bubble.classList.add("is-shown");
                typeBubbleSfx(bubble); // type ticks synced to the CSS reveal
            }
            if (!bubbleHidden && t >= 6.0) {
                bubbleHidden = true;
                if (bubble) { bubble.classList.remove("is-shown"); bubble.classList.add("is-hidden"); }
            }
            // Bite taps his wrist-watch (~6.7s) → a tap click
            if (!wristTapped && t >= 6.7) { wristTapped = true; if (window.SFX) window.SFX.play("uiTap"); }
            if (!pulling && t >= TURN_PULL_AT) doPull();
        }

        if (video) {
            video.addEventListener("timeupdate", onTime);
            // If the clip ends before the pull somehow started, start it then.
            video.addEventListener("ended", function () { if (!pulling) doPull(); });
        }
        // Fallbacks (clip-relative, from NOW): start the bots and hand off even
        // if the clip never reports time, so the game can't get stuck here.
        window.setTimeout(function () { if (!pulling) doPull(); }, 8200);
        window.setTimeout(doFinish, 13500);
    }

    // Bite walks out → build the chooser, then slide its ELEMENTS (banner +
    // carousel/arrows) in from the right over the turn screen, which stays as the
    // (shared room) backdrop so the two screens merge. (Replaces the bots-row rig.)
    function startBotsPull(part) {
        window.gamePart = part;
        setupLevel(2);
        if (window.BotChooser) {
            window.BotChooser.reset();
            window.BotChooser.enterChooser(false); // populate + centre (still behind)
        }
        const screen1 = document.getElementById("screen-1");
        if (screen1) {
            screen1.classList.remove("is-elements-in");
            void screen1.offsetWidth;                 // restart the element-slide animations
            screen1.classList.add("is-elements-in");  // transparent overlay; elements slide in
        }
        if (window.SFX) window.SFX.play("fullScroll"); // whoosh as the elements sweep in
    }

    // Elements have slid fully in → make Screen 1 the real active screen and drop
    // the transparent-overlay class (room bg returns; elements are already at x=0,
    // so no jump). We do NOT call Screen1Intro.play() (its banner-unroll re-reads as
    // a reset); the carousel is already built + wired.
    function finalizeTurn(part) {
        const video = document.getElementById("turn-video");
        const screen1 = document.getElementById("screen-1");
        if (video) { try { video.pause(); } catch (e) {} }
        window.GameNav.show("screen-1");                        // becomes active (deactivates turn screen)
        if (screen1) screen1.classList.remove("is-elements-in"); // restore bg + clear element transforms
        if (window.BotChooser) window.BotChooser.enterChooser(false); // re-centre, fully shown
    }
    window.startBotsPull = startBotsPull;
    window.finalizeTurn = finalizeTurn;


    // ---- Game flow --------------------------------------------------------
    // Two separated halves, each = a guided TUTORIAL then 4 chooser LEVELS:
    //   Part 1: charge tutorial → charge 4 bots → Part 2: split tutorial →
    //   split 4 overcharged bots → done.

    // Part 1 — the charging tutorial (guided 3-bot Screen 1 → charge → concept).
    function startGame() {
        window.gamePart = 1;
        setupLevel(1); // tutorial mode (guided, gameStage 0)
        window.GameNav.show("screen-1");
        if (window.Screen1Intro) window.Screen1Intro.play();
    }
    window.startGame = startGame;

    // Enter the LEVELS (bot chooser) for a part: 1 = charge the low bots,
    // 2 = split the overcharged bots. Four levels, one bot each.
    function startLevels(part) {
        window.gamePart = part;
        setupLevel(2); // chooser mode (.level-2, gameStage 1)
        if (window.BotChooser) window.BotChooser.reset(); // fresh bots for this part
        window.GameNav.show("screen-1");
        if (window.Screen1Intro) window.Screen1Intro.play();
    }
    window.startLevels = startLevels;

    // Part 2 — the splitting tutorial (Screen 5 intro → split → concept).
    function startPart2Tutorial() {
        window.gamePart = 2;
        setupLevel(1); // tutorial mode (guided, gameStage 0)
        window.GameNav.show("screen-5");
        if (window.Part2) window.Part2.startIntro();
    }
    window.startPart2Tutorial = startPart2Tutorial;

    // Tutorial finished — kept for back-compat / dev menu. In the new flow the
    // tutorials hand off directly (Part 1 concept → startLevels(1), Part 2
    // concept → startLevels(2)), so this just enters the current part's levels.
    function showLevelTransition() {
        playCurtain("Tutorial Complete!", "Get ready for Level 1…", function () {
            startLevels(window.gamePart || 1);
        });
    }
    window.showLevelTransition = showLevelTransition;

    function init() {
        const stage = document.getElementById("stage");
        if (!stage) {
            console.warn("Game stage element not found.");
            return;
        }

        // Play button on Start Screen begins Part 1 (the charging tutorial).
        const playBtn = document.getElementById("play-btn");
        if (playBtn) {
            playBtn.addEventListener("click", function () {
                if (window.SFX) {
                    window.SFX.play("uiTap");
                    window.SFX.play("bgMusic", { loop: true }); // quiet looping music bed
                }
                startGame();
            });
        }

        // Next level / Restart button on transition screen → back to start.
        const nextLevelBtn = document.getElementById("next-level-btn");
        if (nextLevelBtn) {
            nextLevelBtn.addEventListener("click", function () {
                if (window.SFX) window.SFX.play("uiTap");
                window.gamePart = 1;
                setupLevel(1);
                window.GameNav.show("screen-pre");
            });
        }

        // Screen 1: tapping the active center bot zooms into it, then Screen 2
        // emerges from inside the bot.
        const orangeBot = document.querySelector(".bot--orange");
        const purpleBot = document.querySelector(".bot--purple");
        const screen1 = document.getElementById("screen-1");
        const screen2 = document.getElementById("screen-2");

        // Zoom Screen 1 into the (centred) bot, then hand off to `targetId`
        // which emerges from inside the chest.
        function enterBotTo(targetId, onSettled) {
            if (!screen1 || screen1.classList.contains("is-zooming")) return;
            screen1.classList.add("is-zooming");
            if (window.SFX) window.SFX.play("zoom");
            const target = document.getElementById(targetId);

            // Hand off when Screen 1 has zoomed to ~2x, which is exactly the
            // target's starting scale, so the crossfade is seamless.
            window.setTimeout(function () {
                window.GameNav.show(targetId);
                if (target) target.classList.add("is-entering");
            }, 380);

            // Clean up once the target has fully settled, then run its intro.
            window.setTimeout(function () {
                if (target) target.classList.remove("is-entering");
                screen1.classList.remove("is-zooming");
                if (onSettled) onSettled();
            }, 1200);
        }

        function enterBot() {
            enterBotTo("screen-2", function () {
                if (window.Screen2Intro) window.Screen2Intro.play();
            });
        }

        // L2+ chooser: enter the chosen bot to fix it — Part 1 (charge) for the
        // low bots, Part 2 (split) for the overcharged one — using that bot's
        // panel colour scheme.
        function chooseBotEnter(scheme, part) {
            window.currentScheme = scheme;
            if (part === "2") {
                if (window.setPanelScheme) window.setPanelScheme(["screen-6", "screen-8"], scheme);
                // Reset the split board to its fresh state NOW — before the zoom
                // reveals screen-6 — so the previous level's batteries don't flash
                // in the slots for a moment (full setup re-runs on settle).
                if (window.Part2 && window.Part2.resetSplit) window.Part2.resetSplit();
                enterBotTo("screen-6", function () {
                    if (window.Part2) window.Part2.startSplit();
                });
            } else {
                if (window.setPanelScheme) window.setPanelScheme(["screen-2", "screen-4"], scheme);
                // Same for the charge board (screen-2): clear it before it's shown.
                if (window.Batteries && window.Batteries.setup) window.Batteries.setup();
                enterBot();
            }
        }
        window.chooseBotEnter = chooseBotEnter;

        // Return to the chooser after a level's bot is fixed. onFixed() marks
        // the bot done (charged + dancing) and advances gameStage. Each level
        // is ONE bot now, so every fix completes a level.
        function returnToChooser() {
            if (window.BotChooser) window.BotChooser.onFixed(window.currentScheme);

            if ((window.gameStage || 1) > 5) {
                // All 5 level bots are fixed → the game is complete.
                if (window.SFX) window.SFX.play("win");
                playCurtain("All Bots Fixed!", "Fantastic work — you fixed every bot!", function () {
                    setupLevel(1);
                    window.GameNav.show("screen-pre");
                });
            } else {
                // Next level — TEXTLESS curtain (no level text).
                playCurtain("", "", function () {
                    window.GameNav.show("screen-1");
                    if (window.BotChooser) window.BotChooser.enterChooser(false);
                }, 1500);
            }
        }
        window.returnToChooser = returnToChooser;

        if (orangeBot) {
            orangeBot.addEventListener("click", function () {
                if (window.currentLevel === 1) enterBot();
            });
        }
        if (purpleBot) {
            purpleBot.addEventListener("click", function () {
                if (window.currentLevel === 2) enterBot();
            });
        }

        // Screen 2 -> 3: the reverse of enterBot. We pull back OUT of the
        // bot's chest to reveal the whole (charged) bot on Screen 3.
        const screen3 = document.getElementById("screen-3");

        function exitBot() {
            if (!screen2 || screen2.classList.contains("is-zooming-out")) return;
            screen2.classList.add("is-zooming-out");
            if (window.SFX) window.SFX.play("zoom");

            window.setTimeout(function () {
                window.GameNav.show("screen-3");
                if (screen3) screen3.classList.add("is-revealing");
                if (window.SFX) window.SFX.play("celebrate");
            }, 150);

            window.setTimeout(function () {
                if (screen3) screen3.classList.remove("is-revealing");
                screen2.classList.remove("is-zooming-out");
                // announce once the reveal has settled, so the banner is SEEN
                // unrolling while the bot dances
                if (window.Screen3Intro) window.Screen3Intro.showMessage();
            }, 1300);
        }

        window.GameFx = { exitBot: exitBot };

        // Dev convenience: press Escape to return to Screen 1.
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                window.GameNav.show("screen-1");
            }
        });

        // Deep-link: "#2" / "#screen-2" opens Screen 2 directly.
        const hash = window.location.hash.replace("#", "");
        if (hash === "2" || hash === "screen-2") {
            window.GameNav.show("screen-2");
            if (window.Screen2Intro) window.Screen2Intro.play();
        }
        if (hash === "4" || hash === "screen-4") {
            window.GameNav.show("screen-4");
            if (window.ConceptScreen) window.ConceptScreen.play();
        }
        if (hash === "5") {
            window.GameNav.show("screen-5");
            if (window.Part2) window.Part2.startIntro();
        }
        if (hash === "6") {
            window.GameNav.show("screen-6");
            if (window.Part2) window.Part2.startSplit();
        }
        if (hash === "7") {
            window.GameNav.show("screen-7");
        }
        if (hash === "8") {
            window.GameNav.show("screen-8");
            if (window.Part2) window.Part2.playConcept2();
        }
        console.log("Bot Show: ready.");
    }

    document.addEventListener("DOMContentLoaded", init);

    // Load the deferred (non-Screen-1) images right after the first paint,
    // so Screen 1 shows fast while the rest streams in the background.
    function loadDeferred() {
        document.querySelectorAll("img[data-src]").forEach(function (img) {
            img.src = img.getAttribute("data-src");
            img.removeAttribute("data-src");
        });
    }
    if (document.readyState === "complete") {
        loadDeferred();
    } else {
        window.addEventListener("load", function () {
            window.setTimeout(loadDeferred, 150);
        });
    }
})();

