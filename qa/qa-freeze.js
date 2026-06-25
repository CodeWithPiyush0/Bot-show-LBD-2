/* ===========================================================
   qa-freeze.js  — QA tool (part of the reusable /qa folder)
   Extends the game's pause mechanism (js/pause.js → window.GamePause)
   so the game also FREEZES while the QA comment tool is open. The QA
   tool flags "comment mode" by adding `qa-intercept-on` to <body>;
   without this, a reviewer who opened the comment box would watch the
   timer-driven sequence keep playing underneath them.

   It registers two hooks on GamePause:
     • a CONDITION  — pause whenever `qa-intercept-on` is set, so the
       reviewer gets a still frame; the game resumes on close.
     • an EXEMPTION — the QA tool's OWN timers (scheduled from files
       under /qa/) are never frozen, so the comment box focus, toasts,
       and background sync keep working while you comment.

   Requires js/pause.js. If GamePause is absent (e.g. pause.js not
   loaded), this is a no-op. Call initQaFreeze() from qa-mode's init so
   it only runs when QA mode is active (?qa=true) — no per-timer cost
   otherwise.
   =========================================================== */

export function initQaFreeze() {
    const GamePause = window.GamePause;
    if (!GamePause) return; // pause.js not present → nothing to extend

    // Pause the game while the QA comment box is open.
    GamePause.addCondition(function () {
        return document.body.classList.contains("qa-intercept-on");
    });

    // Never freeze the QA tool's own timers (detected by call origin /qa/).
    GamePause.addExemption(function () {
        let stack = "";
        try { throw new Error(); } catch (e) { stack = e.stack || ""; }
        return stack.indexOf("/qa/") !== -1;
    });

    // Re-evaluate the pause state whenever the comment-mode class toggles.
    const observer = new MutationObserver(function () { GamePause.refresh(); });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
}
