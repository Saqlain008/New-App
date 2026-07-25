/* ==========================================================================
   app.js — router, modal manager, global search, theme, boot
   ========================================================================== */

const App = (() => {
  let currentView = 'dashboard';
  let currentParams = {};

  const content = () => document.getElementById('content');

  const VIEWS = {
    dashboard: c => DashboardView.render(c),
    customers: c => CustomersView.render(c),
    profile: (c, p) => CustomersView.renderProfile(c, p.id),
    entry: c => EntriesView.render(c),
    rates: c => RatesView.render(c),
    payments: c => PaymentsView.render(c),
    invoices: c => InvoicesView.render(c),
    weekly: c => Reports.renderWeekly(c),
    monthly: c => Reports.renderMonthly(c),
    yearly: c => Reports.renderYearly(c),
    backup: c => BackupView.render(c),
    settings: c => SettingsView.render(c)
  };

  function navigate(view, params = {}) {
    if (!VIEWS[view]) view = 'dashboard';
    currentView = view;
    currentParams = params;
    document.querySelectorAll('.nav__item').forEach(btn => btn.classList.toggle('is-active', btn.dataset.view === view));
    closeSidebarMobile();
    VIEWS[view](content(), params);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function rerender() { VIEWS[currentView](content(), currentParams); }

  /* ---------------- Modal ---------------- */
  function openModal(title, bodyNode, size) {
    const backdrop = document.getElementById('modalBackdrop');
    const modal = document.getElementById('modal');
    modal.style.maxWidth = size === 'wide' ? '760px' : '640px';
    modal.innerHTML = '';
    modal.appendChild(Utils.el('div', { class: 'modal__head' }, [
      Utils.el('h3', {}, title),
      Utils.el('button', { class: 'modal__close', onclick: closeModal, 'aria-label': 'Close' }, '✕')
    ]));
    const body = Utils.el('div', { class: 'modal__body' }, bodyNode);
    modal.appendChild(body);
    backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    document.getElementById('modalBackdrop').hidden = true;
    document.body.style.overflow = '';
  }

  /* ---------------- Sidebar (mobile) ---------------- */
  function closeSidebarMobile() { document.getElementById('sidebar').classList.remove('is-open'); }

  /* ---------------- Global search ---------------- */
  function setupSearch() {
    const input = document.getElementById('globalSearch');
    const resultsBox = document.getElementById('searchResults');

    const run = Utils.debounce(() => {
      const q = input.value.trim().toLowerCase();
      resultsBox.innerHTML = '';
      if (!q) { resultsBox.hidden = true; return; }
      const results = [];

      Store.Customers.search(q).slice(0, 6).forEach(c => results.push({
        label: c.name, meta: `Customer • ${c.phone || 'no phone'} • ${c.area || ''}`,
        action: () => navigate('profile', { id: c.id })
      }));
      Store.Invoices.all().filter(i => i.invoiceNumber.toLowerCase().includes(q)).slice(0, 4).forEach(inv => {
        const cust = Store.Customers.get(inv.customerId);
        results.push({ label: inv.invoiceNumber, meta: `Invoice • ${cust ? cust.name : ''}`, action: () => { navigate('invoices'); setTimeout(() => InvoicesView.viewInvoice(inv.id), 0); } });
      });
      if (/^\d{4}-\d{2}-\d{2}$/.test(q)) {
        results.push({ label: `Entries on ${q}`, meta: 'Date search', action: () => navigate('entry') });
      }

      if (!results.length) {
        resultsBox.appendChild(Utils.el('div', { style: 'padding:14px;color:var(--muted);font-size:13px' }, 'No matches found.'));
      } else {
        results.forEach(r => {
          const a = Utils.el('a', { href: '#' }, [
            Utils.el('div', {}, r.label),
            Utils.el('div', { class: 'sr-meta' }, r.meta)
          ]);
          a.addEventListener('click', e => { e.preventDefault(); r.action(); resultsBox.hidden = true; input.value = ''; });
          resultsBox.appendChild(a);
        });
      }
      resultsBox.hidden = false;
    }, 180);

    input.addEventListener('input', run);
    input.addEventListener('focus', () => { if (input.value.trim()) resultsBox.hidden = false; });
    document.addEventListener('click', e => { if (!e.target.closest('.topbar__search')) resultsBox.hidden = true; });
  }

  /* ---------------- Theme ---------------- */
  function setupTheme() {
    const btn = document.getElementById('themeToggle');
    const saved = Store.getSettings().theme || 'light';
    applyTheme(saved);
    btn.addEventListener('click', () => {
      const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      Store.saveSettings({ theme: next });
      rerender(); // redraw charts with new theme colors
    });
  }
  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    document.getElementById('themeToggle').textContent = theme === 'dark' ? '☀ Light Mode' : '🌙 Dark Mode';
  }

  /* ---------------- Nav wiring ---------------- */
  function setupNav() {
    document.getElementById('mainNav').addEventListener('click', e => {
      const btn = e.target.closest('.nav__item');
      if (!btn) return;
      navigate(btn.dataset.view);
    });
    document.getElementById('menuToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('is-open');
    });
    document.getElementById('quickEntryBtn').addEventListener('click', () => EntriesView.openForm());
  }

  /* ---------------- Keyboard shortcuts ---------------- */
  function setupShortcuts() {
    document.addEventListener('keydown', e => {
      const tag = (document.activeElement.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (e.key === 'Escape') { closeModal(); return; }
      if (typing) return;
      if (e.key === '/') { e.preventDefault(); document.getElementById('globalSearch').focus(); }
      if (e.key.toLowerCase() === 'n') EntriesView.openForm();
      if (e.key.toLowerCase() === 'p') PaymentsView.openForm();
    });
    document.getElementById('modalBackdrop').addEventListener('click', e => {
      if (e.target.id === 'modalBackdrop') closeModal();
    });
  }

  function setupClock() {
    document.getElementById('todayPill').textContent = Utils.formatDate(Utils.todayISO(), { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }

  function init() {
    document.getElementById('brandName').textContent = Store.getSettings().businessName || 'Milk Ledger';
    setupNav();
    setupSearch();
    setupTheme();
    setupShortcuts();
    setupClock();
    navigate('dashboard');
  }

  document.addEventListener('DOMContentLoaded', init);

  return { navigate, rerender, openModal, closeModal };
})();
