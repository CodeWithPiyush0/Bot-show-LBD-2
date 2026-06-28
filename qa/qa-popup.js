// QA comment popup — factory that builds a rich popup with:
//   • main comment (editable or read-only)
//   • status pill (read-only or dropdown for Owner/QA)
//   • delete button (when allowed)
//   • reply thread + reply input (when allowed)
//
// All behaviour is driven by params passed to open(); the caller decides
// what's allowed.

const POPUP_W = 320;

// Dev status (the developer's workflow).
const STATUS_LABELS = {
    open:         'Open',
    in_progress:  'In Progress',
    resolved:     'Resolved',
    wontfix:      "Won't Fix",
};
const STATUS_ORDER = ['open', 'in_progress', 'resolved', 'wontfix'];

// QA status (the tester's verdict — used on retest).
const QA_STATUS_LABELS = { fail: 'QA Fail', pass: 'QA Pass' };
const QA_STATUS_ORDER  = ['fail', 'pass'];

function fmtTime(ts) {
    return new Date(ts).toLocaleString();
}

export function createPopupModule() {
    let popupEl = null;
    let currentParams = null;
    let outsideClickHandler = null;

    function detachOutsideClick() {
        if (outsideClickHandler) {
            document.removeEventListener('click', outsideClickHandler);
            outsideClickHandler = null;
        }
    }
    function attachOutsideClick() {
        detachOutsideClick();
        outsideClickHandler = (e) => {
            if (!popupEl) return;
            if (popupEl.contains(e.target)) return;
            // Don't close on clicks landing on other QA UI (sidebar, pins, modals, toast, mute btn).
            if (e.target.closest?.('.qa-pin, .qa-sidebar, .qa-name-modal, .qa-toast, .mute-btn, .qa-pins')) return;
            close();
        };
        // Defer so the click that opened the popup doesn't immediately close it.
        setTimeout(() => {
            if (popupEl) document.addEventListener('click', outsideClickHandler);
        }, 30);
    }

    function close() {
        detachOutsideClick();
        if (popupEl?.parentElement) popupEl.parentElement.removeChild(popupEl);
        popupEl = null;
        currentParams = null;
    }

    function build(params) {
        const {
            selector,
            isNew = false,
            text = '',
            readOnly = false,
            canDelete = false,
            status = 'open',              // Dev status
            canChangeStatus = false,      // can change Dev status (owner)
            wontfixReason = '',
            // QA bug form
            bugForm = false,              // render the structured bug fields?
            steps = '',
            expected = '',
            actual = '',
            qaStatus = 'fail',            // QA status (Pass/Fail)
            canChangeQaStatus = false,    // can change QA status (owner/qa)
            byline = '',
            replies = [],
            canReply = false,
            canDeleteReply = () => false,
            onSave,
            onDelete,
            onStatusChange,               // Dev status change
            onQaStatusChange,             // QA status change
            onReply,
            onReplyDelete,
        } = params;

        const el = document.createElement('div');
        el.className = 'qa-popup'
            + (readOnly ? ' qa-popup--readonly' : '')
            + (isNew    ? ' qa-popup--new'      : '')
            + (bugForm  ? ' qa-popup--bug'      : '');

        // ── Header (label + status pills) ──────────────────────────
        const header = document.createElement('div');
        header.className = 'qa-popup__header';

        const label = document.createElement('div');
        label.className = 'qa-popup__label';
        label.innerHTML = (bugForm ? 'Bug on: <code></code>' : 'Comment on: <code></code>');
        label.querySelector('code').textContent = selector || '(unknown)';
        header.appendChild(label);

        // Existing comments show their status pills. QA bugs show BOTH the QA
        // status (tester's verdict) and the Dev status (developer's workflow);
        // plain comments show only the Dev status.
        if (!isNew) {
            const pills = document.createElement('div');
            pills.className = 'qa-popup__pills';
            if (bugForm) {
                pills.appendChild(buildQaStatusControl(qaStatus || 'fail', canChangeQaStatus, onQaStatusChange));
            }
            pills.appendChild(buildStatusPill(status, canChangeStatus, onStatusChange));
            header.appendChild(pills);
        }
        el.appendChild(header);

        // ── Byline (existing only) ─────────────────────────────────
        if (byline) {
            const b = document.createElement('div');
            b.className = 'qa-popup__byline';
            b.textContent = byline;
            el.appendChild(b);
        }

        // ── Won't Fix reason (Dev status, only if set) ─────────────
        if (!isNew && status === 'wontfix' && wontfixReason) {
            const box = document.createElement('div');
            box.className = 'qa-popup__wontfix';
            box.innerHTML = '<span class="qa-popup__wontfix-label">Reason</span><span class="qa-popup__wontfix-text"></span>';
            box.querySelector('.qa-popup__wontfix-text').textContent = wontfixReason;
            el.appendChild(box);
        }

        // ── Body fields ────────────────────────────────────────────
        // `fields` holds the <textarea>/<select> refs we read back on save.
        const fields = {};

        function fieldBox(labelText, value, placeholder, opts) {
            opts = opts || {};
            const wrap = document.createElement('label');
            wrap.className = 'qa-field';
            const lab = document.createElement('span');
            lab.className = 'qa-field__label';
            lab.textContent = labelText + (opts.required ? ' *' : '');
            const ta = document.createElement('textarea');
            ta.className = 'qa-field__input';
            ta.value = value || '';
            ta.placeholder = placeholder || '';
            if (opts.rows) ta.rows = opts.rows;
            if (readOnly) ta.readOnly = true;
            wrap.appendChild(lab);
            wrap.appendChild(ta);
            return { wrap, ta };
        }

        if (bugForm) {
            // QA structured bug: Description (required) + Steps + Expected + Actual.
            const desc = fieldBox('Bug description', text, 'What is the bug?', { required: true, rows: 2 });
            const stp  = fieldBox('Steps to reproduce', steps, '1.\n2.\n3.', { rows: 3 });
            const exp  = fieldBox('Expected result', expected, 'What should happen?', { rows: 2 });
            const act  = fieldBox('Actual result', actual, 'What happens instead?', { rows: 2 });
            fields.text = desc.ta; fields.steps = stp.ta; fields.expected = exp.ta; fields.actual = act.ta;
            el.appendChild(desc.wrap); el.appendChild(stp.wrap); el.appendChild(exp.wrap); el.appendChild(act.wrap);

            // NEW bug → choose QA status here (default Fail). Existing bug → header pill.
            if (isNew) {
                const qaWrap = document.createElement('label');
                qaWrap.className = 'qa-field qa-field--inline';
                const qaLab = document.createElement('span');
                qaLab.className = 'qa-field__label';
                qaLab.textContent = 'QA status';
                const sel = document.createElement('select');
                sel.className = `qa-qa-select qa-qa-pill--${qaStatus || 'fail'}`;
                QA_STATUS_ORDER.forEach((s) => {
                    const o = document.createElement('option');
                    o.value = s; o.textContent = QA_STATUS_LABELS[s];
                    sel.appendChild(o);
                });
                sel.value = qaStatus || 'fail';
                sel.addEventListener('change', () => { sel.className = `qa-qa-select qa-qa-pill--${sel.value}`; });
                qaWrap.appendChild(qaLab);
                qaWrap.appendChild(sel);
                fields.qaStatusSelect = sel;
                el.appendChild(qaWrap);
            }
        } else {
            // Plain comment — single textarea (Other / Owner quick note).
            const ta = document.createElement('textarea');
            ta.className = 'qa-popup__text';
            ta.placeholder = isNew ? 'Type your comment...' : '';
            ta.value = text;
            if (readOnly) ta.readOnly = true;
            fields.text = ta;
            el.appendChild(ta);
        }

        // ── Action buttons row ─────────────────────────────────────
        const actions = document.createElement('div');
        actions.className = 'qa-popup__actions';

        if (!isNew && canDelete) {
            const del = document.createElement('button');
            del.className = 'qa-btn qa-btn--del';
            del.type = 'button';
            del.textContent = 'Delete';
            del.addEventListener('click', () => onDelete?.());
            actions.appendChild(del);
        }
        const spacer = document.createElement('div');
        spacer.className = 'qa-popup__actions-spacer';
        actions.appendChild(spacer);

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'qa-btn qa-btn--cancel';
        cancelBtn.type = 'button';
        cancelBtn.textContent = readOnly && !isNew ? 'Close' : 'Cancel';
        cancelBtn.addEventListener('click', close);
        actions.appendChild(cancelBtn);

        if (!readOnly) {
            const saveBtn = document.createElement('button');
            saveBtn.className = 'qa-btn qa-btn--save';
            saveBtn.type = 'button';
            saveBtn.textContent = isNew ? 'Save' : 'Update';
            saveBtn.addEventListener('click', attemptSave);
            actions.appendChild(saveBtn);

            if (fields.text) {
                fields.text.addEventListener('keydown', (e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') attemptSave();
                });
            }
        }
        el.appendChild(actions);

        // ── Replies + reply input (existing only) ─────────────────
        if (!isNew && (replies.length > 0 || canReply)) {
            const section = buildRepliesSection({
                replies, canReply, canDeleteReply, onReply, onReplyDelete,
            });
            el.appendChild(section);
        }

        // Gather all field values and hand a payload object to onSave. The
        // "description" (or comment) is required; empty just closes.
        function attemptSave() {
            const desc = (fields.text && fields.text.value || '').trim();
            if (!desc) { close(); return; }
            const payload = { text: desc };
            if (bugForm) {
                payload.steps    = (fields.steps    && fields.steps.value    || '').trim();
                payload.expected = (fields.expected && fields.expected.value || '').trim();
                payload.actual   = (fields.actual   && fields.actual.value   || '').trim();
                if (fields.qaStatusSelect) payload.qaStatus = fields.qaStatusSelect.value;
            }
            onSave?.(payload);
            close();
        }

        return el;
    }

    function buildStatusPill(status, canChange, onStatusChange) {
        if (!canChange) {
            const pill = document.createElement('span');
            pill.className = `qa-status-pill qa-status-pill--${status}`;
            pill.textContent = STATUS_LABELS[status] || status;
            return pill;
        }
        const select = document.createElement('select');
        select.className = `qa-status-select qa-status-pill--${status}`;
        STATUS_ORDER.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = STATUS_LABELS[s];
            select.appendChild(opt);
        });
        select.value = status;
        select.addEventListener('change', () => {
            const next = select.value;
            // Update the visual class immediately for snappy feedback.
            select.className = `qa-status-select qa-status-pill--${next}`;
            onStatusChange?.(next);
        });
        return select;
    }

    // QA status control (Pass/Fail). Read-only pill, or a dropdown for owner/qa.
    function buildQaStatusControl(qaStatus, canChange, onChange) {
        if (!canChange) {
            const pill = document.createElement('span');
            pill.className = `qa-qa-pill qa-qa-pill--${qaStatus}`;
            pill.textContent = QA_STATUS_LABELS[qaStatus] || qaStatus;
            return pill;
        }
        const select = document.createElement('select');
        select.className = `qa-qa-select qa-qa-pill--${qaStatus}`;
        QA_STATUS_ORDER.forEach((s) => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = QA_STATUS_LABELS[s];
            select.appendChild(opt);
        });
        select.value = qaStatus;
        select.addEventListener('change', () => {
            select.className = `qa-qa-select qa-qa-pill--${select.value}`;
            onChange?.(select.value);
        });
        return select;
    }

    function buildRepliesSection({ replies, canReply, canDeleteReply, onReply, onReplyDelete }) {
        const wrap = document.createElement('div');
        wrap.className = 'qa-popup__replies';

        if (replies.length > 0) {
            const head = document.createElement('div');
            head.className = 'qa-popup__replies-head';
            head.textContent = `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`;
            wrap.appendChild(head);

            const list = document.createElement('div');
            list.className = 'qa-popup__reply-list';
            replies.forEach(r => list.appendChild(buildReply(r, canDeleteReply, onReplyDelete)));
            wrap.appendChild(list);
        }

        if (canReply) {
            const inputWrap = document.createElement('div');
            inputWrap.className = 'qa-popup__reply-input';
            inputWrap.innerHTML = `
                <textarea class="qa-popup__reply-textarea" placeholder="Write a reply..."></textarea>
                <button class="qa-btn qa-btn--reply" type="button">Send</button>
            `;
            const replyTa = inputWrap.querySelector('textarea');
            const sendBtn = inputWrap.querySelector('button');
            const send = () => {
                const t = replyTa.value.trim();
                if (!t) return;
                onReply?.(t);
                replyTa.value = '';
            };
            sendBtn.addEventListener('click', send);
            replyTa.addEventListener('keydown', (e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send();
            });
            wrap.appendChild(inputWrap);
        }

        return wrap;
    }

    function buildReply(r, canDeleteReply, onReplyDelete) {
        const item = document.createElement('div');
        item.className = 'qa-popup__reply';
        item.dataset.id = r.id;
        item.innerHTML = `
            <div class="qa-popup__reply-head">
                <span class="qa-popup__reply-meta"></span>
                <button class="qa-popup__reply-del" type="button" title="Delete">×</button>
            </div>
            <div class="qa-popup__reply-text"></div>
        `;
        item.querySelector('.qa-popup__reply-meta').textContent =
            `${r.author || 'Unknown'} · ${fmtTime(r.createdAt)}`;
        item.querySelector('.qa-popup__reply-text').textContent = r.text;

        const delBtn = item.querySelector('.qa-popup__reply-del');
        if (canDeleteReply(r)) {
            delBtn.addEventListener('click', () => onReplyDelete?.(r.id));
        } else {
            delBtn.style.display = 'none';
        }
        return item;
    }

    function position(x, y) {
        if (!popupEl) return;
        const w = popupEl.offsetWidth  || POPUP_W;
        const h = popupEl.offsetHeight || 220;
        let px = x + 12;
        let py = y + 12;
        if (px + w > window.innerWidth  - 8) px = x - w - 12;
        if (py + h > window.innerHeight - 8) py = Math.max(8, window.innerHeight - h - 8);
        if (px < 8) px = 8;
        if (py < 8) py = 8;
        popupEl.style.left = px + 'px';
        popupEl.style.top  = py + 'px';
    }

    function open(params) {
        close();
        currentParams = params;
        popupEl = build(params);
        document.body.appendChild(popupEl);
        position(params.x, params.y);
        attachOutsideClick();

        if (!params.readOnly) {
            popupEl.querySelector('.qa-popup__text')?.focus();
        } else if (params.canReply) {
            popupEl.querySelector('.qa-popup__reply-textarea')?.focus();
        }
    }

    // Rebuild only the replies section in-place (e.g., after a new reply
    // is added or deleted).
    function refreshReplies({ replies, canReply, canDeleteReply, onReply, onReplyDelete }) {
        if (!popupEl) return;
        const existing = popupEl.querySelector('.qa-popup__replies');
        if (existing) existing.remove();
        if (replies.length > 0 || canReply) {
            const section = buildRepliesSection({
                replies, canReply, canDeleteReply, onReply, onReplyDelete,
            });
            popupEl.appendChild(section);
        }
        position(currentParams?.x ?? 100, currentParams?.y ?? 100);
    }

    function isInside(el) {
        return !!(popupEl && el && popupEl.contains(el));
    }

    // Sync the status pill/select AND the Won't Fix reason block in place,
    // so the popup reflects the new state without a full rebuild.
    function refreshStatus(newStatus, newWontfixReason = '') {
        if (!popupEl) return;

        const pill = popupEl.querySelector('.qa-status-pill, .qa-status-select');
        if (pill) {
            if (pill.tagName === 'SELECT') {
                pill.value = newStatus;
                pill.className = `qa-status-select qa-status-pill--${newStatus}`;
            } else {
                pill.className = `qa-status-pill qa-status-pill--${newStatus}`;
                pill.textContent = STATUS_LABELS[newStatus] || newStatus;
            }
        }

        const existing = popupEl.querySelector('.qa-popup__wontfix');
        if (newStatus === 'wontfix' && newWontfixReason) {
            if (existing) {
                existing.querySelector('.qa-popup__wontfix-text').textContent = newWontfixReason;
            } else {
                const box = document.createElement('div');
                box.className = 'qa-popup__wontfix';
                box.innerHTML = '<span class="qa-popup__wontfix-label">Reason</span><span class="qa-popup__wontfix-text"></span>';
                box.querySelector('.qa-popup__wontfix-text').textContent = newWontfixReason;
                // Insert right after the byline (if any), otherwise before the textarea.
                const byline = popupEl.querySelector('.qa-popup__byline');
                const text   = popupEl.querySelector('.qa-popup__text');
                if (byline && byline.parentNode) byline.parentNode.insertBefore(box, byline.nextSibling);
                else if (text)                  text.parentNode.insertBefore(box, text);
                else                            popupEl.appendChild(box);
            }
        } else if (existing) {
            existing.remove();
        }
    }

    return { open, close, isInside, refreshReplies, refreshStatus };
}
