/* ==========================================================================
   app.js — router, modal manager, global search, theme, boot
   ========================================================================== */

const App = (() => {
  var currentView = 'dashboard';
  var currentParams = {};

  var content = function() { return document.getElementById('content'); };

  var VIEWS = {
    dashboard: function(c) { DashboardView.render(c); },
    customers: function(c) { CustomersView.render(c); },
    profile: function(c, p) { CustomersView.renderProfile(c, p.id); },
    entry: function(c) { EntriesView.render(c); },
    rates: function(c) { RatesView.render(c); },
    payments: function(c) { PaymentsView.render(c); },
    invoices: function(c) { InvoicesView.render(c); },
    weekly: function(c) { Reports.renderWeekly(c); },
    monthly: function(c) { Reports.renderMonthly(c); },
    yearly: function(c) { Reports.renderYearly(c); },
    backup: function(c) { BackupView.render(c); },
    settings: function(c) { SettingsView.render(c); }
  };

  function navigate(view, params) {
    if (!params) params = {};
    if (!VIEWS[view]) view = 'dashboard';
    currentView = view;
    currentParams = params;
    document.querySelectorAll('.nav__item').forEach(function(btn) {
      btn.classList.toggle('is-active', btn.dataset.view === view);
    });
    closeSidebarMobile();
    var searchResults = document.getElementById('searchResults');
    if (searchResults) searchResults.hidden = true;
    var searchInput = document.getElementById('globalSearch');
    if (searchInput) searchInput.value = '';
    VIEWS[view](content(), params);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function rerender() { VIEWS[currentView](content(), currentParams); }

  function openModal(title, bodyNode, size) {
    var backdrop = document.getElementById('modalBackdrop');
    var modal = document.getElementById('modal');
    modal.style.maxWidth = size === 'wide' ? '760px' : '640px';
    modal.innerHTML = '';
    modal.appendChild(Utils.el('div', { class: 'modal__head' }, [
      Utils.el('h3', {}, title),
      Utils.el('button', { class: 'modal__close', onclick: closeModal, 'aria-label': 'Close' }, 'X')
    ]));
    modal.appendChild(Utils.el('div', { class: 'modal__body' }, bodyNode));
    backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    document.getElementById('modalBackdrop').hidden = true;
    document.body.style.overflow = '';
  }

  function closeSidebarMobile() { document.getElementById('sidebar').classList.remove('is-open'); }

  function setupSearch() {
    var input = document.getElementById('globalSearch');
    var resultsBox = document.getElementById('searchResults');

    var run = Utils.debounce(function() {
      var q = input.value.trim().toLowerCase();
      resultsBox.innerHTML = '';
      if (!q) { resultsBox.hidden = true; return; }
      var results = [];

      Store.Customers.search(q).slice(0, 6).forEach(function(c) {
        results.push({
          label: c.name,
          meta: 'Customer | ' + (c.phone || 'no phone') + ' | ' + (c.area || ''),
          action: function() { navigate('profile', { id: c.id }); }
        });
      });
      Store.Invoices.all().filter(function(i) { return i.invoiceNumber.toLowerCase().includes(q); }).slice(0, 4).forEach(function(inv) {
        var cust = Store.Customers.get(inv.customerId);
        results.push({
          label: inv.invoiceNumber,
          meta: 'Invoice | ' + (cust ? cust.name : ''),
          action: function() { navigate('invoices'); setTimeout(function() { InvoicesView.viewInvoice(inv.id); }, 0); }
        });
      });
      if (/^\d{4}-\d{2}-\d{2}$/.test(q)) {
        results.push({ label: 'Entries on ' + q, meta: 'Date search', action: function() { navigate('entry'); } });
      }
      var qNum = parseFloat(q);
      if (!isNaN(qNum)) {
        results.push({ label: 'Entries with ' + qNum + ' L', meta: 'Quantity search', action: function() { navigate('entry'); } });
        results.push({ label: 'Payments of ' + Utils.money(qNum), meta: 'Amount search', action: function() { navigate('payments'); } });
      }

      if (!results.length) {
        resultsBox.appendChild(Utils.el('div', { style: 'padding:14px;color:var(--muted);font-size:13px' }, 'No matches found.'));
      } else {
        results.forEach(function(r) {
          var a = Utils.el('a', { href: '#' }, [
            Utils.el('div', {}, r.label),
            Utils.el('div', { class: 'sr-meta' }, r.meta)
          ]);
          a.addEventListener('click', function(e) { e.preventDefault(); r.action(); resultsBox.hidden = true; input.value = ''; });
          resultsBox.appendChild(a);
        });
      }
      resultsBox.hidden = false;
    }, 180);

    input.addEventListener('input', run);
    input.addEventListener('focus', function() { if (input.value.trim()) resultsBox.hidden = false; });
    document.addEventListener('click', function(e) { if (!e.target.closest('.topbar__search')) resultsBox.hidden = true; });
  }

  function setupTheme() {
    var btn = document.getElementById('themeToggle');
    var saved = Store.getSettings().theme || 'light';
    applyTheme(saved);
    btn.addEventListener('click', function() {
      var next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      Store.saveSettings({ theme: next });
      rerender();
    });
  }

  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    document.getElementById('themeToggle').textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  }

  function setupNav() {
    document.getElementById('mainNav').addEventListener('click', function(e) {
      var btn = e.target.closest('.nav__item');
      if (!btn) return;
      navigate(btn.dataset.view);
    });
    document.getElementById('menuToggle').addEventListener('click', function() {
      document.getElementById('sidebar').classList.toggle('is-open');
    });
    document.getElementById('quickEntryBtn').addEventListener('click', function() { EntriesView.openForm(); });
  }

  function setupShortcuts() {
    document.addEventListener('keydown', function(e) {
      var tag = (document.activeElement.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (e.key === 'Escape') { closeModal(); return; }
      if (typing) return;
      if (e.key === '/') { e.preventDefault(); document.getElementById('globalSearch').focus(); }
      if (e.key.toLowerCase() === 'n') EntriesView.openForm();
      if (e.key.toLowerCase() === 'p') PaymentsView.openForm();
    });
    document.getElementById('modalBackdrop').addEventListener('click', function(e) {
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

  return { navigate: navigate, rerender: rerender, openModal: openModal, closeModal: closeModal };
})();