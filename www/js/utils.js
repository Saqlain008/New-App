/* ==========================================================================
   utils.js — shared helper functions used across the app
   ========================================================================== */

const Utils = (() => {

  function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

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
    if (!iso) return '\u2014';
    const d = parseISO(iso);
    return d.toLocaleDateString('en-GB', opts || { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatNum(val, opts = {}) {
    const n = Number(val || 0);
    try {
      new Intl.NumberFormat('en-PK');
      return n.toLocaleString('en-PK', opts);
    } catch (_) {
      return n.toLocaleString('en-US', opts);
    }
  }

  function money(n) {
    const settings = Store.getSettings();
    const symbol = settings.currencySymbol || 'Rs.';
    const val = Number(n || 0);
    const formatted = formatNum(val, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return symbol + ' ' + formatted;
  }

  function qty(n) {
    const val = Number(n || 0);
    return formatNum(val, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' L';
  }

  function weekBounds(iso) {
    const d = parseISO(iso);
    const day = (d.getDay() + 6) % 7;
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
    return { start: d.getFullYear() + '-01-01', end: d.getFullYear() + '-12-31' };
  }

  function monthName(iso) {
    return parseISO(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  function el(tag, attrs, children) {
    if (!attrs) attrs = {};
    if (!children) children = [];
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(function(c) {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    var s = String(str);
    var a = String.fromCharCode(38);
    s = s.replace(/[&]/g, a + 'amp;');
    s = s.replace(/[<]/g, a + 'lt;');
    s = s.replace(/[>]/g, a + 'gt;');
    s = s.replace(/["]/g, a + 'quot;');
    s = s.replace(/[']/g, a + '#039;');
    return s;
  }

  function debounce(fn, wait) {
    if (!wait) wait = 250;
    var t;
    return function() {
      var args = arguments;
      var ctx = this;
      clearTimeout(t);
      t = setTimeout(function() { fn.apply(ctx, args); }, wait);
    };
  }

  function downloadFile(filename, content, mime) {
    if (!mime) mime = 'application/json';
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
    const esc = function(v) {
      const s = String(v === undefined || v === null ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.map(esc).join(',')];
    rows.forEach(function(r) { lines.push(r.map(esc).join(',')); });
    return lines.join('\n');
  }

  function toast(message, type) {
    if (!type) type = 'info';
    const wrap = document.getElementById('toastWrap');
    if (!wrap) return alert(message);
    const t = el('div', { class: 'toast toast--' + type }, message);
    wrap.appendChild(t);
    requestAnimationFrame(function() { t.classList.add('show'); });
    setTimeout(function() {
      t.classList.remove('show');
      setTimeout(function() { t.remove(); }, 300);
    }, 3200);
  }

  function confirmDialog(message) {
    return window.confirm(message);
  }

  function paginate(arr, page, perPage) {
    if (!page) page = 1;
    if (!perPage) perPage = 20;
    const total = arr.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const p = Math.min(Math.max(1, page), totalPages);
    const start = (p - 1) * perPage;
    return { items: arr.slice(start, start + perPage), page: p, totalPages: totalPages, total: total, perPage: perPage };
  }

  function paginationControls(pagination, onPage) {
    const wrap = el('div', { class: 'pagination' });
    if (pagination.totalPages <= 1) return wrap;
    wrap.appendChild(el('button', {
      class: 'btn btn--sm' + (pagination.page <= 1 ? ' btn--disabled' : ''),
      onclick: function() { if (pagination.page > 1) onPage(pagination.page - 1); }
    }, '\u2039 Prev'));
    wrap.appendChild(el('span', { class: 'pagination__info' },
      'Page ' + pagination.page + ' of ' + pagination.totalPages + ' (' + pagination.total + ' items)'));
    wrap.appendChild(el('button', {
      class: 'btn btn--sm' + (pagination.page >= pagination.totalPages ? ' btn--disabled' : ''),
      onclick: function() { if (pagination.page < pagination.totalPages) onPage(pagination.page + 1); }
    }, 'Next \u203a'));
    return wrap;
  }

  function groupByDate(entries, desc) {
    if (desc === undefined) desc = true;
    const groups = {};
    entries.forEach(function(e) {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    });
    const dates = Object.keys(groups).sort();
    if (desc) dates.reverse();
    return dates.map(function(d) { return { date: d, entries: groups[d] }; });
  }

  function formatDateHeading(iso) {
    return parseISO(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function dayName(iso) {
    return parseISO(iso).toLocaleDateString('en-GB', { weekday: 'long' });
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    return days + 'd ago';
  }

  return {
    uid: uid,
    todayISO: todayISO,
    dateToISO: dateToISO,
    parseISO: parseISO,
    addDays: addDays,
    formatDate: formatDate,
    formatNum: formatNum,
    money: money,
    qty: qty,
    weekBounds: weekBounds,
    weekNumber: weekNumber,
    monthBounds: monthBounds,
    yearBounds: yearBounds,
    monthName: monthName,
    el: el,
    escapeHtml: escapeHtml,
    debounce: debounce,
    downloadFile: downloadFile,
    toCSV: toCSV,
    toast: toast,
    confirmDialog: confirmDialog,
    paginate: paginate,
    paginationControls: paginationControls,
    groupByDate: groupByDate,
    formatDateHeading: formatDateHeading,
    dayName: dayName,
    formatTime: formatTime,
    timeAgo: timeAgo
  };
})();