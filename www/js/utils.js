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

  /** Currency formatter — settings-aware (symbol + decimals) */
  function money(n) {
    const settings = Store.getSettings();
    const symbol = settings.currencySymbol || 'Rs.';
    const val = Number(n || 0);
    const formatted = val.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return `${symbol} ${formatted}`;
  }

  function qty(n) {
    const val = Number(n || 0);
    return `${val.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} L`;
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
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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

  return {
    uid, todayISO, dateToISO, parseISO, addDays, formatDate, money, qty,
    weekBounds, weekNumber, monthBounds, yearBounds, monthName,
    el, escapeHtml, debounce, downloadFile, toCSV, toast, confirmDialog
  };
})();
