// QA export — download the comment list as a CSV "bug sheet".
//
// Reusable across projects: columns come from the generic comment shape and the
// filename uses APP_NAME, so dropping this folder into another game just works.
//
// Two modes:
//   'qa'    → the tester's OWN bugs (top-level), bug-sheet columns (no Author/Type/Reply-To).
//   'owner' → the FULL list (all authors + replies), with Author/Type/Reply-To/Won't-Fix.

import { APP_NAME } from './qa-supabase.js';

const STATUS_LABEL = {
    open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', wontfix: "Won't Fix",
};
const QA_STATUS_LABEL = { pass: 'QA Pass', fail: 'QA Fail' };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// "19 Jun 14:32" (viewer's local timezone)
function fmtDateTime(ts) {
    const d = new Date(ts);
    const p = (n) => (n < 10 ? '0' + n : '' + n);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Escape one cell for CSV: wrap in quotes (doubling inner quotes) only when it
// contains a comma, quote, or newline.
function csvCell(v) {
    const s = (v == null ? '' : String(v));
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const devStatus = (r) => STATUS_LABEL[r.status || 'open'] || r.status || '';
const qaStatus  = (r) => (r.qaStatus ? (QA_STATUS_LABEL[r.qaStatus] || r.qaStatus) : '');
const created   = (r) => (r.createdAt ? fmtDateTime(r.createdAt) : '');

// Column definitions per mode. Each column = { header, get(row, ctx) }.
function columnsFor(mode) {
    const base = [
        { header: '#',                  get: (r, ctx) => ctx.num },
        { header: 'Screen',             get: (r) => r.screen || '' },
        { header: mode === 'owner' ? 'Description' : 'Bug description', get: (r) => r.text || '' },
        { header: 'Steps to reproduce', get: (r) => r.steps || '' },
        { header: 'Expected result',    get: (r) => r.expected || '' },
        { header: 'Actual result',      get: (r) => r.actual || '' },
        { header: 'QA status',          get: qaStatus },
        { header: 'Dev status',         get: devStatus },
    ];
    if (mode === 'owner') {
        base.push(
            { header: 'Author',           get: (r) => r.author || '' },
            { header: 'Created',          get: created },
            { header: 'Type',             get: (r) => (r.parentId ? 'Reply' : 'Comment') },
            { header: 'Reply To',         get: (r, ctx) => (r.parentId ? (ctx.numById.get(r.parentId) || '') : '') },
            { header: "Won't-Fix Reason", get: (r) => (r.status === 'wontfix' ? (r.wontfixReason || '') : '') },
        );
    } else {
        base.push({ header: 'Created', get: created });
    }
    return base;
}

// Build the CSV text from the comment list.
export function buildCsv(comments, mode) {
    const rows = comments.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const numById = new Map();
    rows.forEach((c, i) => numById.set(c.id, i + 1));

    const cols = columnsFor(mode);
    const lines = [cols.map((c) => csvCell(c.header)).join(',')];
    rows.forEach((c, i) => {
        const ctx = { num: i + 1, numById };
        lines.push(cols.map((col) => csvCell(col.get(c, ctx))).join(','));
    });
    return lines.join('\r\n');
}

function todayStamp() {
    const d = new Date();
    const p = (n) => (n < 10 ? '0' + n : '' + n);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Build the CSV and trigger a browser download. mode = 'qa' | 'owner'.
// Returns the number of rows exported.
export function exportCommentsToCsv(comments, mode) {
    const csv = buildCsv(comments, mode || 'owner');
    // Prepend a UTF-8 BOM (U+FEFF) so Excel reads em-dashes / accents / emoji correctly.
    const BOM = String.fromCharCode(0xFEFF);
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qa-comments_${APP_NAME}_${todayStamp()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return comments.length;
}
