/* ==========================================================================
   customers.js — customer list, add/edit/delete/archive, profile page
   ========================================================================== */

const CustomersView = (() => {

  function render(container) {
    const customers = Store.Customers.all();
    container.innerHTML = '';

    const head = Utils.el('div', { class: 'view-head' }, [
      Utils.el('div', {}, [
        Utils.el('h1', {}, 'Customers'),
        Utils.el('div', { class: 'sub' }, `${customers.length} total • ${customers.filter(c => c.status === 'active').length} active`)
      ]),
      Utils.el('div', { class: 'view-actions' }, [
        Utils.el('button', { class: 'btn btn--primary', onclick: () => openForm() }, '+ Add Customer')
      ])
    ]);
    container.appendChild(head);

    const filters = Utils.el('div', { class: 'filters' }, [
      Utils.el('input', { type: 'text', placeholder: 'Search name, phone, village…', id: 'custFilterInput' }),
      Utils.el('select', { id: 'custStatusFilter' }, [
        Utils.el('option', { value: 'all' }, 'All statuses'),
        Utils.el('option', { value: 'active' }, 'Active'),
        Utils.el('option', { value: 'inactive' }, 'Inactive')
      ])
    ]);
    container.appendChild(filters);

    const tableWrap = Utils.el('div', { class: 'table-wrap' });
    container.appendChild(tableWrap);

    function draw() {
      const q = document.getElementById('custFilterInput').value;
      const status = document.getElementById('custStatusFilter').value;
      let list = Store.Customers.search(q);
      if (status !== 'all') list = list.filter(c => c.status === status);
      tableWrap.innerHTML = '';
      if (!list.length) {
        tableWrap.appendChild(Utils.el('div', { class: 'table-empty' }, 'No customers found. Add your first customer to get started.'));
        return;
      }
      const table = Utils.el('table', {}, [
        Utils.el('thead', {}, Utils.el('tr', {}, [
          Utils.el('th', {}, 'Name'), Utils.el('th', {}, 'Phone'), Utils.el('th', {}, 'Village/Area'),
          Utils.el('th', { class: 'num' }, 'Outstanding'), Utils.el('th', {}, 'Status'), Utils.el('th', {}, '')
        ])),
      ]);
      const tbody = Utils.el('tbody');
      list.forEach(c => {
        const bal = Billing.outstandingAsOf(c.id, Utils.todayISO());
        const tr = Utils.el('tr', {}, [
          Utils.el('td', {}, Utils.el('a', { href: '#', style: 'font-weight:700;text-decoration:none;color:var(--forest)', onclick: (e) => { e.preventDefault(); App.navigate('profile', { id: c.id }); } }, c.name)),
          Utils.el('td', {}, c.phone || '—'),
          Utils.el('td', {}, c.area || '—'),
          Utils.el('td', { class: 'num', style: bal > 0 ? 'color:var(--danger)' : 'color:var(--success)' }, Utils.money(bal)),
          Utils.el('td', {}, Utils.el('span', { class: `badge badge--${c.status}` }, c.status)),
          Utils.el('td', {}, Utils.el('div', { class: 'row-actions' }, [
            Utils.el('button', { class: 'btn btn--sm', onclick: () => App.navigate('profile', { id: c.id }) }, 'View'),
            Utils.el('button', { class: 'btn btn--sm', onclick: () => openForm(c) }, 'Edit'),
            Utils.el('button', { class: 'btn btn--sm btn--danger', onclick: () => onDelete(c) }, 'Delete')
          ]))
        ]);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);
    }

    document.getElementById('custFilterInput').addEventListener('input', Utils.debounce(draw, 150));
    document.getElementById('custStatusFilter').addEventListener('change', draw);
    draw();
  }

  function onDelete(c) {
    if (!Utils.confirmDialog(`Delete customer "${c.name}"? This will not delete their recorded entries/payments, but they will be lost from lists. This can be undone once via Backup > Undo.`)) return;
    Store.Customers.remove(c.id);
    Utils.toast('Customer deleted. Use Backup page to undo.', 'success');
    App.rerender();
  }

  function openForm(existing) {
    const isEdit = !!existing;
    const body = Utils.el('form', { class: 'form-grid', id: 'custForm' }, [
      field('Customer Name *', 'name', existing?.name, 'text', true),
      field('Father Name', 'fatherName', existing?.fatherName),
      field('Phone Number', 'phone', existing?.phone, 'tel'),
      field('Area / Village', 'area', existing?.area),
      field('Address', 'address', existing?.address),
      selectField('Status', 'status', existing?.status || 'active', [['active', 'Active'], ['inactive', 'Inactive']]),
      Utils.el('div', { class: 'field field--full' }, [
        Utils.el('label', {}, 'Notes'),
        Utils.el('textarea', { name: 'notes' }, existing?.notes || '')
      ]),
      Utils.el('div', { class: 'form-actions field--full' }, [
        Utils.el('button', { type: 'button', class: 'btn', onclick: () => App.closeModal() }, 'Cancel'),
        Utils.el('button', { type: 'submit', class: 'btn btn--primary' }, isEdit ? 'Save Changes' : 'Add Customer')
      ])
    ]);

    App.openModal(isEdit ? 'Edit Customer' : 'Add Customer', body);

    document.getElementById('custForm').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = Object.fromEntries(fd.entries());
      if (!data.name || !data.name.trim()) { Utils.toast('Customer name is required.', 'error'); return; }
      if (isEdit) {
        Store.Customers.update(existing.id, data);
        Utils.toast('Customer updated.', 'success');
      } else {
        Store.Customers.add(data);
        Utils.toast('Customer added.', 'success');
      }
      App.closeModal();
      App.rerender();
    });
  }

  function field(label, name, value = '', type = 'text', required = false) {
    return Utils.el('div', { class: 'field' }, [
      Utils.el('label', {}, label),
      Utils.el('input', { type, name, value: value || '', ...(required ? { required: 'required' } : {}) })
    ]);
  }

  function selectField(label, name, value, options) {
    return Utils.el('div', { class: 'field' }, [
      Utils.el('label', {}, label),
      Utils.el('select', { name }, options.map(([v, l]) => Utils.el('option', { value: v, ...(v === value ? { selected: 'selected' } : {}) }, l)))
    ]);
  }

  /* ---------------- Profile page ---------------- */
  function renderProfile(container, customerId) {
    const c = Store.Customers.get(customerId);
    container.innerHTML = '';
    if (!c) {
      container.appendChild(Utils.el('div', { class: 'empty-state' }, [
        Utils.el('div', { class: 'emoji' }, '🔍'),
        Utils.el('p', {}, 'Customer not found.'),
        Utils.el('button', { class: 'btn btn--primary', onclick: () => App.navigate('customers') }, 'Back to Customers')
      ]));
      return;
    }

    const life = Billing.lifetime(c.id);
    const outstanding = Billing.outstandingAsOf(c.id, Utils.todayISO());

    container.appendChild(Utils.el('button', { class: 'btn btn--sm', style: 'margin-bottom:14px', onclick: () => App.navigate('customers') }, '← Back to Customers'));

    container.appendChild(Utils.el('div', { class: 'profile-head' }, [
      Utils.el('div', { class: 'avatar' }, c.photo ? Utils.el('img', { src: c.photo }) : c.name.charAt(0).toUpperCase()),
      Utils.el('div', { style: 'flex:1' }, [
        Utils.el('h1', {}, c.name),
        Utils.el('div', { class: 'sub' }, `${c.fatherName ? 'S/O ' + Utils.escapeHtml(c.fatherName) + ' • ' : ''}${c.phone || 'No phone'} • ${c.area || 'No area set'}`)
      ]),
      Utils.el('span', { class: `badge badge--${c.status}` }, c.status),
      Utils.el('button', { class: 'btn btn--sm', onclick: () => openForm(c) }, 'Edit')
    ]));

    container.appendChild(Utils.el('div', { class: 'grid grid-cards' }, [
      statCard('Lifetime Milk', Utils.qty(life.qty), '🥛', 'forest'),
      statCard('Lifetime Billed', Utils.money(life.billed), '📒', 'forest'),
      statCard('Lifetime Paid', Utils.money(life.paid), '💵', 'gold'),
      statCard('Outstanding Balance', Utils.money(outstanding), '⚠', outstanding > 0 ? 'danger' : 'forest')
    ]));

    const tabs = ['Daily Entries', 'Payments', 'Weekly Bills', 'Monthly Bills', 'Graph'];
    const tabBar = Utils.el('div', { class: 'profile-tabs' });
    const body = Utils.el('div', { id: 'profileTabBody' });
    let active = 0;
    tabs.forEach((t, i) => {
      const btn = Utils.el('button', { class: `profile-tab${i === 0 ? ' is-active' : ''}`, onclick: () => { active = i; renderTabs(); } }, t);
      tabBar.appendChild(btn);
    });
    container.appendChild(tabBar);
    container.appendChild(body);

    function renderTabs() {
      [...tabBar.children].forEach((b, i) => b.classList.toggle('is-active', i === active));
      body.innerHTML = '';
      if (active === 0) body.appendChild(entriesTable(c.id));
      if (active === 1) body.appendChild(paymentsTable(c.id));
      if (active === 2) body.appendChild(weeklyTable(c.id));
      if (active === 3) body.appendChild(monthlyTable(c.id));
      if (active === 4) {
        body.appendChild(Utils.el('div', { class: 'panel' }, Utils.el('div', { class: 'chart-box' }, Utils.el('canvas', { id: 'profileChart' }))));
        setTimeout(() => drawProfileChart(c.id), 0);
      }
    }
    renderTabs();
  }

  function statCard(label, value, icon, accent) {
    return Utils.el('div', { class: `card stat-card accent-${accent}` }, [
      Utils.el('span', { class: 'stat-icon' }, icon),
      Utils.el('div', { class: 'stat-label' }, label),
      Utils.el('div', { class: 'stat-value' }, value)
    ]);
  }

  function entriesTable(customerId) {
    const rows = Store.Entries.forCustomer(customerId).sort((a, b) => b.date.localeCompare(a.date));
    const wrap = Utils.el('div', { class: 'table-wrap' });
    if (!rows.length) { wrap.appendChild(Utils.el('div', { class: 'table-empty' }, 'No daily entries yet.')); return wrap; }
    const table = Utils.el('table', {}, Utils.el('thead', {}, Utils.el('tr', {}, [
      'Date', 'Morning', 'Evening', 'Total', 'Rate', 'Amount', 'Notes', ''
    ].map((h, i) => Utils.el('th', { class: i > 0 && i < 6 ? 'num' : '' }, h)))));
    const tbody = Utils.el('tbody');
    rows.forEach(e => tbody.appendChild(Utils.el('tr', {}, [
      Utils.el('td', {}, Utils.formatDate(e.date)),
      Utils.el('td', { class: 'num' }, e.morning || 0),
      Utils.el('td', { class: 'num' }, e.evening || 0),
      Utils.el('td', { class: 'num' }, Utils.qty(e.total)),
      Utils.el('td', { class: 'num' }, Utils.money(e.rate)),
      Utils.el('td', { class: 'num' }, Utils.money(e.amount)),
      Utils.el('td', {}, e.notes || '—'),
      Utils.el('td', {}, Utils.el('div', { class: 'row-actions' }, [
        Utils.el('button', { class: 'btn btn--sm', onclick: () => EntriesView.openForm(e) }, 'Edit'),
        Utils.el('button', { class: 'btn btn--sm btn--danger', onclick: () => { if (Utils.confirmDialog('Delete this entry?')) { Store.Entries.remove(e.id); App.rerender(); } } }, 'Del')
      ]))
    ])));
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function paymentsTable(customerId) {
    const rows = Store.Payments.forCustomer(customerId).sort((a, b) => b.date.localeCompare(a.date));
    const wrap = Utils.el('div', { class: 'table-wrap' });
    if (!rows.length) { wrap.appendChild(Utils.el('div', { class: 'table-empty' }, 'No payments recorded yet.')); return wrap; }
    const table = Utils.el('table', {}, Utils.el('thead', {}, Utils.el('tr', {}, ['Date', 'Amount', 'Method', 'Notes', ''].map((h, i) => Utils.el('th', { class: i === 1 ? 'num' : '' }, h)))));
    const tbody = Utils.el('tbody');
    rows.forEach(p => tbody.appendChild(Utils.el('tr', {}, [
      Utils.el('td', {}, Utils.formatDate(p.date)),
      Utils.el('td', { class: 'num' }, Utils.money(p.amount)),
      Utils.el('td', {}, p.method),
      Utils.el('td', {}, p.notes || '—'),
      Utils.el('td', {}, Utils.el('div', { class: 'row-actions' }, [
        Utils.el('button', { class: 'btn btn--sm btn--danger', onclick: () => { if (Utils.confirmDialog('Delete this payment?')) { Store.Payments.remove(p.id); App.rerender(); } } }, 'Del')
      ]))
    ])));
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function weeklyTable(customerId) {
    const entries = Store.Entries.forCustomer(customerId);
    if (!entries.length) return Utils.el('div', { class: 'table-wrap' }, Utils.el('div', { class: 'table-empty' }, 'No data yet.'));
    const dates = entries.map(e => e.date).sort();
    const rows = Billing.weeklyReport(customerId, dates[0], Utils.todayISO()).reverse();
    return Reports.statementTable(rows, 'week');
  }

  function monthlyTable(customerId) {
    const entries = Store.Entries.forCustomer(customerId);
    if (!entries.length) return Utils.el('div', { class: 'table-wrap' }, Utils.el('div', { class: 'table-empty' }, 'No data yet.'));
    const dates = entries.map(e => e.date).sort();
    const rows = Billing.monthlyReport(customerId, dates[0], Utils.todayISO()).reverse();
    return Reports.statementTable(rows, 'month');
  }

  function drawProfileChart(customerId) {
    const entries = Store.Entries.forCustomer(customerId).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
    Charts.lineChart('profileChart', entries.map(e => Utils.formatDate(e.date, { day: '2-digit', month: 'short' })), [
      { label: 'Milk (L)', data: entries.map(e => e.total) }
    ]);
  }

  return { render, renderProfile, openForm };
})();
