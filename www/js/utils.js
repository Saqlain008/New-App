/* ==========================================================================
   utils.js — shared helper functions used across the app
   ========================================================================== */

const Utils = (() => {

  /** Generate a reasonably unique id: prefix + timestamp + random chars */
  function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Today as YYYY-MM-DD (local, not UTC) */
  function todayISO() {
    const d = new Date();
    return dateToISO(d);
  }

  function dateToISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Parse 'YYYY-MM-DD' into a local Date at midnight */
  function parseISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(iso, days) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + days);
    return dateToISO(d);
  }

  function formatDate(iso, opts) {
    if (!iso) return '—';
    const d = parseISO(iso);
    return d.toLocaleDateString('en-GB', opts || { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** Safe locale formatting — falls back to en-US if en-PK unavailable */
  function formatNum(val, opts = {}) {
    const n = Number(val || 0);
    try {
      new Intl.NumberFormat('en-PK');
      return n.toLocaleString('en-PK', opts);
    } catch (_) {
      return n.toLocaleString('en-US', opts);
    }
  }

  /** Currency formatter — settings-aware (symbol + decimals) */
  function money(n) {
    const settings = Store.getSettings();
    const symbol = settings.currencySymbol || 'Rs.';
    const val = Number(n || 0);
    const formatted = formatNum(val, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `${symbol} ${formatted}`;
  }

  function qty(n) {
    const val = Number(n || 0);
    return `${formatNum(val, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} L`;
  }

  /** ISO week number + week start/end (Monday–Sunday) for a given date */
  function weekBounds(iso) {
    const d = parseISO(iso);
    const day = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: dateToISO(start), end: dateToISO(end) };
  }

  function weekNumber(iso) {
    const d = parseISO(iso);
    const target = new Date(d.getFullYear(), 0, 1);
    const diff = (d - target) / 86400000;
    return Math.ceil((diff + target.getDay() + 1) / 7);
  }

  function monthBounds(iso) {
    const d = parseISO(iso);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { start: dateToISO(start), end: dateToISO(end) };
  }

  function yearBounds(iso) {
    const d = parseISO(iso);
    return { start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear()}-12-31` };
  }

  function monthName(iso) {
    return parseISO(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    var s = String(str);
    s = s.replace(/[&]/g, '&' + 'amp;');
    s = s.replace(/[<]/g, '&' + 'lt;');
    s = s.replace(/[>]/g, '&' + 'gt;');
    s = s.replace(/["]/g, '&' + 'quot;');
    s = s.replace(/[']/g, '&#' + '039;');
    return s;
  }

  function debounce(fn, wait = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function downloadFile(filename, content, mime = 'application/json') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function toCSV(rows, headers) {
    const esc = v => {
      const s = String(v === undefined || v === null ? '' : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.map(esc).join(',')];
    rows.forEach(r => lines.push(r.map(esc).join(',')));
    return lines.join('\n');
  }

  function toast(message, type = 'info') {
    const wrap = document.getElementById('toastWrap');
    if (!wrap) return alert(message);
    const t = el('div', { class: `toast toast--${type}` }, message);
    wrap.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 3200);
  }

  function confirmDialog(message) {
    return window.confirm(message);
  }

  /** Paginate an array */
  function paginate(arr, page = 1, perPage = 20) {
    const total = arr.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const p = Math.min(Math.max(1, page), totalPages);
    const start = (p - 1) * perPage;
    return { items: arr.slice(start, start + perPage), page: p, totalPages, total, perPage };
  }

  /** Render pagination controls */
  function paginationControls(pagination, onPage) {
    const wrap = el('div', { class: 'pagination' });
    if (pagination.totalPages <= 1) return wrap;
    wrap.appendChild(el('button', {
      class: `btn btn--sm${pagination.page <= 1 ? ' btn--disabled' : ''}`,
      onclick: () => { if (pagination.page > 1) onPage(pagination.page - 1); }
    }, '‹ Prev'));
    wrap.appendChild(el('span', { class: 'pagination__info' }, `Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} items)`));
    wrap.appendChild(el('button', {
      class: `btn btn--sm${pagination.page >= pagination.totalPages ? ' btn--disabled' : ''}`,
      onclick: () => { if (pagination.page < pagination.totalPages) onPage(pagination.page + 1); }
    }, 'Next ›'));
    return wrap;
  }

  /** Sort an array of objects by a key */
  function sortBy(arr, key, desc = false) {
    const sorted = [...arr].sort((a, b) => {
      const va = a[key] ?? '';
      const vb = b[key] ?? '';
      if (typeof va === 'number' && typeof vb === 'number') return desc ? vb - va : va - vb;
      return desc ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb));
    });
    return sorted;
  }

  /** Group entries by date */
  function groupByDate(entries, desc = true) {
    const groups = {};
    entries.forEach(e => {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    });
    const dates = Object.keys(groups).sort();
    if (desc) dates.reverse();
    return dates.map(d => ({ date: d, entries: groups[d] }));
  }

  /** Format a date for display as heading (e.g. "26 Jul 2026") */
  function formatDateHeading(iso) {
    return parseISO(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** Get day name */
  function dayName(iso) {
    return parseISO(iso).toLocaleDateString('en-GB', { weekday: 'long' });
  }

  return {
    uid, todayISO, dateToISO, parseISO, addDays, formatDate, formatNum, money, qty,
    weekBounds, weekNumber, monthBounds, yearBounds, monthName,
    el, escapeHtml, debounce, downloadFile, toCSV, toast, confirmDialog,
    paginate, paginationControls, sortBy, groupByDate, formatDateHeading, dayName
  };
})();