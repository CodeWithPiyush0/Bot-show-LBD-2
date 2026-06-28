/* ===========================================================
   devmenu.js  — TEMPORARY development tool
   A hamburger menu to jump straight to any screen while building,
   so you don't have to play through the whole game to test one bit.

   Self-contained: injects its own styles + DOM. To remove for
   production, delete this file and its <script> tag in index.html.
   =========================================================== */

(function (global) {
    "use strict";

    // Each entry: label + the action that shows/sets up that screen.
    // Matches the CURRENT single flow: one guided TUTORIAL, then 5 chooser
    // LEVELS (no separate Part 2). Every jump first hardReset()s, so an
    // in-flight animation from the previous screen can't bleed through.
    const SCREENS = [
        { label: "▶  Play from the start", go: function () { call(global, "startGame"); } },
        { label: "0 · Start screen", go: function () { nav("screen-pre"); } },

        { label: "—  tutorial  —", go: null },
        { label: "1 · Pick the bot (3 bots)", go: function () { tut(); nav("screen-1"); call(global.Screen1Intro, "play"); } },
        { label: "2 · Puzzle — sort the codes", go: function () { tut(); puzzle(); } },
        { label: "4 · Concept — parts ↔ whole", go: function () { tut(); nav("screen-4"); call(global.ConceptScreen, "play"); } },
        { label: "3 · Bot fixed — dances", go: function () { tut(); danceBot("orange"); } },
        { label: "★  \"Your turn\" → levels", go: function () { tut(); if (global.showYourTurn) global.showYourTurn(1); } },

        { label: "—  levels (bot chooser)  —", go: null },
        { label: "Chooser · level 1", go: function () { chooser(1); } },
        { label: "Chooser · level 5", go: function () { chooser(5); } },
        { label: "Puzzle · level 1 (blue)", go: function () { chooserPuzzle(1, "blue"); } },
        { label: "Bot dances · level 1 (blue)", go: function () { chooserDance(1, "blue"); } },

        { label: "—  transitions  —", go: null },
        { label: "Next-level curtain", go: function () { if (global.playCurtain) global.playCurtain("", "", function () { chooser(2); }, 1500); } },
        { label: "All Bots Fixed! (game end)", go: function () { if (global.playCurtain) global.playCurtain("All Bots Fixed!", "Fantastic work — you fixed every bot!", function () { setLvl(1); nav("screen-pre"); }); } },
    ];

    /* ---- hard reset: the fix for overlapping / doubled screens ----
       Jumping mid-animation used to leave the previous screen's timers
       (zoom hand-offs, intros, finales, returnToChooser) pending — they'd
       fire AFTER the jump and yank a screen back in. Cancel every pending
       timer, silence SFX, and strip the transient transition classes an
       interrupted animation leaves behind, so the target screen is clean. */
    function hardReset() {
        try {
            const maxId = global.setTimeout(function () {}, 0);
            for (let i = 1; i <= maxId; i++) global.clearTimeout(i);
        } catch (e) { /* ignore */ }
        if (global.SFX && global.SFX.stopAll) global.SFX.stopAll();

        const TRANSIENT = ["is-zooming", "is-zooming-out", "is-entering", "is-revealing",
            "is-choosing", "is-lit", "is-elements-in", "is-compact", "is-open", "is-spotlit",
            "is-focusing", "is-gone", "is-hidden", "is-intro", "is-shown", "is-closed",
            "no-snap", "is-selected"];
        document.querySelectorAll(
            ".screen, #s2-content, #s6-content, .question, .carousel-bot, #bot-carousel, #curtains, .turn-bubble"
        ).forEach(function (el) {
            TRANSIENT.forEach(function (c) { el.classList.remove(c); });
        });
        const tv = document.getElementById("turn-video");
        if (tv) { try { tv.pause(); tv.currentTime = 0; } catch (e) { /* ignore */ } }
    }

    // Tutorial = guided level 1 (3-bot Screen 1, gameStage 0). setupLevel(1)
    // also sets the tutorial panel scheme (orange) + screen-3 dance gif.
    function tut() { setLvl(1); global.currentScheme = "orange"; }

    // Jump to the code puzzle (screen-2). `scheme` overrides the panel for a
    // level; omitted = keep the scheme setupLevel already applied (tutorial).
    function puzzle(scheme) {
        if (scheme) {
            global.currentScheme = scheme;
            if (global.setPanelScheme) global.setPanelScheme(["screen-2", "screen-4"], scheme);
        }
        nav("screen-2");
        call(global.Screen2Intro, "play");
    }

    // Show the celebrating (dancing) bot on screen-3 for a scheme (uses the gif,
    // via the shared preload + decode-gated swap).
    function danceBot(scheme) {
        if (global.setDanceBot) global.setDanceBot(scheme);
        nav("screen-3");
    }

    // Enter the bot chooser at a given level (1-5).
    function chooser(stage) {
        setLvl(2);
        global.gameStage = stage;
        if (global.BotChooser && global.BotChooser.reset) global.BotChooser.reset();
        nav("screen-1");
        call(global.Screen1Intro, "play");
    }

    // Jump straight into a level's puzzle / dance with a chosen bot scheme.
    function chooserPuzzle(stage, scheme) {
        setLvl(2);
        global.gameStage = stage;
        puzzle(scheme);
    }
    function chooserDance(stage, scheme) {
        setLvl(2);
        global.gameStage = stage;
        global.currentScheme = scheme;
        danceBot(scheme);
    }

    function setLvl(lvl) {
        if (global.setupLevel) global.setupLevel(lvl);
    }

    function nav(id) {
        if (global.GameNav) global.GameNav.show(id);
    }
    function call(obj, method) {
        try {
            if (obj && typeof obj[method] === "function") obj[method]();
        } catch (e) {
            console.warn("[devmenu]", e);
        }
    }

    const CSS = [
        ".devmenu__toggle{position:fixed;top:10px;left:10px;z-index:99999;width:42px;height:42px;",
        "border-radius:9px;border:1px solid rgba(255,255,255,.25);background:rgba(20,20,24,.82);",
        "color:#fff;font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;",
        "justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.4);}",
        ".devmenu__toggle:hover{background:rgba(40,40,48,.92);}",
        ".devmenu__panel{position:fixed;top:60px;left:10px;z-index:99999;width:230px;",
        "background:rgba(20,20,24,.94);border:1px solid rgba(255,255,255,.18);border-radius:10px;",
        "padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.5);display:none;font-family:system-ui,Arial,sans-serif;",
        "max-height:calc(100vh - 72px);overflow-y:auto;overscroll-behavior:contain;}",
        ".devmenu__panel{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.3) transparent;}",
        ".devmenu__panel::-webkit-scrollbar{width:8px;}",
        ".devmenu__panel::-webkit-scrollbar-thumb{background:rgba(255,255,255,.25);border-radius:4px;}",
        ".devmenu__panel.is-open{display:block;}",
        ".devmenu__title{color:#9aa;font-size:11px;letter-spacing:.5px;text-transform:uppercase;",
        "padding:4px 8px 8px;}",
        ".devmenu__panel button{display:block;width:100%;text-align:left;background:transparent;",
        "border:none;color:#eee;font-size:13px;padding:8px 10px;border-radius:7px;cursor:pointer;}",
        ".devmenu__panel button:hover{background:rgba(255,255,255,.10);}",
        ".devmenu__sep{color:#667;font-size:11px;padding:8px 10px 2px;pointer-events:none;}",
        ".devmenu__hint{color:#778;font-size:10px;padding:8px 10px 2px;border-top:1px solid rgba(255,255,255,.1);margin-top:6px;}",
        ".devmenu__tip{position:fixed;top:18px;left:62px;z-index:99999;background:rgba(20,20,24,.92);",
        "color:#eee;font-family:system-ui,Arial,sans-serif;font-size:12px;padding:6px 10px;border-radius:7px;",
        "white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .18s ease;box-shadow:0 2px 8px rgba(0,0,0,.4);}",
        ".devmenu__tip::after{content:'';position:absolute;top:11px;left:-5px;width:10px;height:10px;",
        "background:rgba(20,20,24,.92);transform:rotate(45deg);}",
        ".devmenu__toggle:hover + .devmenu__tip,.devmenu__tip.is-show{opacity:1;}",
    ].join("");

    function build() {
        const style = document.createElement("style");
        style.textContent = CSS;
        document.head.appendChild(style);

        const toggle = document.createElement("button");
        toggle.className = "devmenu__toggle";
        toggle.type = "button";
        toggle.title = "Use this to jump to any screen";
        toggle.textContent = "☰"; // ☰

        const tip = document.createElement("div");
        tip.className = "devmenu__tip";
        tip.textContent = "Use this to jump to any screen";

        const panel = document.createElement("div");
        panel.className = "devmenu__panel";

        const title = document.createElement("div");
        title.className = "devmenu__title";
        title.textContent = "Dev · go to screen";
        panel.appendChild(title);

        SCREENS.forEach(function (s) {
            if (!s.go) {
                const sep = document.createElement("div");
                sep.className = "devmenu__sep";
                sep.textContent = s.label;
                panel.appendChild(sep);
                return;
            }
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = s.label;
            b.addEventListener("click", function () {
                hardReset();   // cancel in-flight timers/animations from the current screen
                s.go();
                panel.classList.remove("is-open");
            });
            panel.appendChild(b);
        });

        const hint = document.createElement("div");
        hint.className = "devmenu__hint";
        hint.textContent = "Reload (F5) for a clean state.";
        panel.appendChild(hint);

        toggle.addEventListener("click", function () {
            panel.classList.toggle("is-open");
        });

        document.body.appendChild(toggle);
        document.body.appendChild(tip);
        document.body.appendChild(panel);

        // Briefly reveal the tooltip on load so it's discoverable.
        tip.classList.add("is-show");
        window.setTimeout(function () {
            tip.classList.remove("is-show");
        }, 3000);
    }

    document.addEventListener("DOMContentLoaded", build);
})(window);
