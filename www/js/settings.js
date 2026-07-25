/* ==========================================================================
   settings.js — business settings + backup/restore/clear-data views
   ========================================================================== */

const SettingsView = (() => {

  function render(container) {
    container.innerHTML = '';
    const s = Store.getSettings();
    container.appendChild(Utils.el('div', { class: 'view-head' }, Utils.el('div', {}, [
      Utils.el('h1', {}, 'Settings'), Utils.el('div', { class: 'sub' }, 'Business details used on invoices and the dashboard')
    ])));

    const form = Utils.el('form', { class: 'panel form-grid', id: 'settingsForm' }, [
      f('Business Name', 'businessName', s.businessName),
      f('Owner Name', 'ownerName', s.ownerName),
      f('Phone Number', 'phone', s.phone),
      f('Currency Symbol', 'currencySymbol', s.currencySymbol),
      f('Milk Unit Label', 'unit', s.unit),
      Utils.el('div', { class: 'field field--full' }, [Utils.el('label', {}, 'Business Address'), Utils.el('textarea', { name: 'address' }, s.address)]),
      Utils.el('div', { class: 'form-actions field--full' }, Utils.el('button', { type: 'submit', class: 'btn btn--primary' }, 'Save Settings'))
    ]);
    container.appendChild(form);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      Store.saveSettings(data);
      document.getElementById('brandName').textContent = data.businessName || 'Milk Ledger';
      Utils.toast('Settings saved.', 'success');
    });

    container.appendChild(Utils.el('div', { class: 'panel' }, [
      Utils.el('h3', {}, 'Keyboard Shortcuts'),
      Utils.el('div', { class: 'ledger-line' }, [Utils.el('span', { class: 'lbl' }, 'New daily entry'), Utils.el('span', { class: 'fill' }), Utils.el('span', { class: 'val' }, 'N')]),
      Utils.el('div', { class: 'ledger-line' }, [Utils.el('span', { class: 'lbl' }, 'New payment'), Utils.el('span', { class: 'fill' }), Utils.el('span', { class: 'val' }, 'P')]),
      Utils.el('div', { class: 'ledger-line' }, [Utils.el('span', { class: 'lbl' }, 'Focus search'), Utils.el('span', { class: 'fill' }), Utils.el('span', { class: 'val' }, '/')]),
      Utils.el('div', { class: 'ledger-line' }, [Utils.el('span', { class: 'lbl' }, 'Close dialog'), Utils.el('span', { class: 'fill' }), Utils.el('span', { class: 'val' }, 'Esc')])
    ]));
  }

  function f(label, name, value) {
    return Utils.el('div', { class: 'field' }, [Utils.el('label', {}, label), Utils.el('input', { type: 'text', name, value: value || '' })]);
  }

  return { render };
})();

const BackupView = (() => {

  function render(container) {
    container.innerHTML = '';
    const s = Store.getSettings();
    container.appendChild(Utils.el('div', { class: 'view-head' }, Utils.el('div', {}, [
      Utils.el('h1', {}, 'Backup & Data'), Utils.el('div', { class: 'sub' }, `Last backup: ${s.lastBackup ? Utils.formatDate(s.lastBackup.slice(0, 10)) : 'never'}`)
    ])));

    container.appendChild(Utils.el('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(260px,1fr))' }, [
      panel('⇩ Export Backup', 'Download all your data (customers, entries, rates, payments, invoices, settings) as a single JSON file. Keep it safe.', [
        Utils.el('button', { class: 'btn btn--primary btn--block', onclick: exportBackup }, 'Export Backup (JSON)')
      ]),
      panel('⇧ Import Backup', 'Restore data from a previously exported JSON backup file. This will overwrite current data.', [
        Utils.el('input', { type: 'file', accept: 'application/json', id: 'importFile', style: 'margin-bottom:10px' }),
        Utils.el('button', { class: 'btn btn--block', onclick: importBackup }, 'Import Backup')
      ]),
      panel('↺ Undo Last Delete', 'Restore the most recently deleted customer, entry, or payment.', [
        Utils.el('button', { class: 'btn btn--block', onclick: () => { const r = Store.undoLastDelete(); if (r) { Utils.toast('Restored.', 'success'); App.rerender(); } else Utils.toast('Nothing to undo.', 'info'); } }, 'Undo Last Delete')
      ]),
      panel('🗑 Clear All Data', 'Permanently delete everything from this device. This cannot be undone — export a backup first!', [
        Utils.el('button', { class: 'btn btn--danger btn--block', onclick: clearAll }, 'Clear All Data')
      ])
    ]));

    container.appendChild(Utils.el('div', { class: 'panel' }, [
      Utils.el('h3', {}, 'Export Reports'),
      Utils.el('p', { style: 'color:var(--muted);font-size:13px' }, 'Export all daily entries or all payments as a spreadsheet-compatible CSV file.'),
      Utils.el('div', { class: 'view-actions' }, [
        Utils.el('button', { class: 'btn', onclick: exportEntriesCSV }, '⬇ All Entries (CSV)'),
        Utils.el('button', { class: 'btn', onclick: exportPaymentsCSV }, '⬇ All Payments (CSV)'),
        Utils.el('button', { class: 'btn', onclick: exportCustomersCSV }, '⬇ All Customers (CSV)')
      ])
    ]));
  }

  function panel(title, desc, children) {
    return Utils.el('div', { class: 'panel' }, [
      Utils.el('h3', {}, title),
      Utils.el('p', { style: 'color:var(--muted);font-size:12.5px' }, desc),
      ...children
    ]);
  }

  function exportBackup() {
    Utils.downloadFile(`milk-ledger-backup-${Utils.todayISO()}.json`, Store.exportBackup(), 'application/json');
    Store.saveSettings({ lastBackup: new Date().toISOString() });
    Utils.toast('Backup exported.', 'success');
  }

  function importBackup() {
    const input = document.getElementById('importFile');
    if (!input.files.length) { Utils.toast('Choose a backup JSON file first.', 'error'); return; }
    if (!Utils.confirmDialog('This will overwrite your current data with the backup file. Continue?')) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Store.importBackup(reader.result);
        Utils.toast('Backup imported successfully.', 'success');
        App.rerender();
      } catch (e) {
        Utils.toast('Invalid backup file.', 'error');
      }
    };
    reader.readAsText(input.files[0]);
  }

  function clearAll() {
    if (!Utils.confirmDialog('This will permanently erase ALL data on this device. Type OK to confirm you understand this cannot be undone.')) return;
    if (!Utils.confirmDialog('Are you absolutely sure? This is your last chance to cancel.')) return;
    Store.clearAll();
    Utils.toast('All data cleared.', 'success');
    App.navigate('dashboard');
  }

  function exportEntriesCSV() {
    const custMap = Object.fromEntries(Store.Customers.all().map(c => [c.id, c.name]));
    const rows = Store.Entries.all().sort((a, b) => a.date.localeCompare(b.date))
      .map(e => [e.date, custMap[e.customerId] || '', e.morning, e.evening, e.total, e.rate, e.amount, e.notes]);
    Utils.downloadFile('all_entries.csv', Utils.toCSV(rows, ['Date', 'Customer', 'Morning', 'Evening', 'Total', 'Rate', 'Amount', 'Notes']), 'text/csv');
  }
  function exportPaymentsCSV() {
    const custMap = Object.fromEntries(Store.Customers.all().map(c => [c.id, c.name]));
    const rows = Store.Payments.all().sort((a, b) => a.date.localeCompare(b.date))
      .map(p => [p.date, custMap[p.customerId] || '', p.amount, p.method, p.notes]);
    Utils.downloadFile('all_payments.csv', Utils.toCSV(rows, ['Date', 'Customer', 'Amount', 'Method', 'Notes']), 'text/csv');
  }
  function exportCustomersCSV() {
    const rows = Store.Customers.all().map(c => [c.name, c.fatherName, c.phone, c.area, c.address, c.status, Billing.outstandingAsOf(c.id, Utils.todayISO())]);
    Utils.downloadFile('all_customers.csv', Utils.toCSV(rows, ['Name', 'Father Name', 'Phone', 'Area', 'Address', 'Status', 'Outstanding Balance']), 'text/csv');
  }

  return { render };
})();
