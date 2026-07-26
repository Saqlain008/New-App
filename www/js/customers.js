/* ==========================================================================
   customers.js — customer list, add/edit/delete, profile with per-customer rate
   ========================================================================== */

const CustomersView = (() => {

  var currentPage = 1;

  function render(container) {
    var customers = Store.Customers.all();
    container.innerHTML = '';

    container.appendChild(Utils.el('div', { class: 'view-head' }, [
      Utils.el('div', {}, [
        Utils.el('h1', {}, 'Customers'),
        Utils.el('div', { class: 'sub' }, customers.length + ' total | ' +
          customers.filter(function(c) { return c.status === 'active'; }).length + ' active | ' +
          customers.filter(function(c) { return c.status === 'inactive'; }).length + ' inactive')
      ]),
      Utils.el('div', { class: 'view-actions' }, [
        Utils.el('button', { class: 'btn btn--primary', onclick: function() { openForm(); } }, '+ Add Customer')
      ])
    ]));

    container.appendChild(Utils.el('div', { class: 'filters' }, [
      Utils.el('input', { type: 'text', placeholder: 'Search name, phone, village...', id: 'custFilterInput' }),
      Utils.el('select', { id: 'custStatusFilter' }, [
        Utils.el('option', { value: 'all' }, 'All statuses'),
        Utils.el('option', { value: 'active' }, 'Active'),
        Utils.el('option', { value: 'inactive' }, 'Inactive')
      ])
    ]));

    var tableWrap = Utils.el('div', { class: 'table-wrap' });
    container.appendChild(tableWrap);

    function draw() {
      var q = document.getElementById('custFilterInput').value;
      var status = document.getElementById('custStatusFilter').value;
      var list = Store.Customers.search(q);
      if (status !== 'all') list = list.filter(function(c) { return c.status === status; });

      var paginated = Utils.paginate(list, currentPage, 20);
      currentPage = paginated.page;

      tableWrap.innerHTML = '';
      if (!list.length) {
        tableWrap.appendChild(Utils.el('div', { class: 'table-empty' }, 'No customers found.'));
        return;
      }
      var table = Utils.el('table', {}, [
        Utils.el('thead', {}, Utils.el('tr', {}, [
          Utils.el('th', {}, 'Name'), Utils.el('th', {}, 'Phone'), Utils.el('th', {}, 'Village'),
          Utils.el('th', { class: 'num' }, 'Rate'), Utils.el('th', { class: 'num' }, 'Outstanding'),
          Utils.el('th', {}, 'Status'), Utils.el('th', {}, '')
        ]))
      ]);
      var tbody = Utils.el('tbody');
      paginated.items.forEach(function(c) {
        var bal = Billing.outstandingAsOf(c.id, Utils.todayISO());
        var rate = c.rate || Store.Rates.current();
        tbody.appendChild(Utils.el('tr', {}, [
          Utils.el('td', {}, Utils.el('a', { href: '#', style: 'font-weight:700;text-decoration:none;color:var(--forest)',
            onclick: function(e) { e.preventDefault(); App.navigate('profile', { id: c.id }); } }, c.name)),
          Utils.el('td', {}, c.phone || '--'),
          Utils.el('td', {}, c.area || '--'),
          Utils.el('td', { class: 'num' }, Utils.money(rate)),
          Utils.el('td', { class: 'num', style: bal > 0 ? 'color:var(--danger)' : 'color:var(--success)' }, Utils.money(bal)),
          Utils.el('td', {}, Utils.el('span', { class: 'badge badge--' + c.status }, c.status)),
          Utils.el('td', {}, Utils.el('div', { class: 'row-actions' }, [
            Utils.el('button', { class: 'btn btn--sm', onclick: function() { App.navigate('profile', { id: c.id }); } }, 'View'),
            Utils.el('button', { class: 'btn btn--sm', onclick: function() { openForm(c); } }, 'Edit'),
            Utils.el('button', { class: 'btn btn--sm btn--danger', onclick: function() { onDelete(c); } }, 'Delete')
          ]))
        ]));
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      tableWrap.appendChild(Utils.paginationControls(paginated, function(p) { currentPage = p; draw(); }));
    }

    document.getElementById('custFilterInput').addEventListener('input', Utils.debounce(function() { currentPage = 1; draw(); }, 150));
    document.getElementById('custStatusFilter').addEventListener('change', function() { currentPage = 1; draw(); });
    draw();
  }

  function onDelete(c) {
    if (!Utils.confirmDialog('Delete customer "' + c.name + '"? Their entries/payments remain but customer is removed from lists.')) return;
    Store.Customers.remove(c.id);
    Utils.toast('Customer deleted.', 'success');
    App.rerender();
  }

  function openForm(existing) {
    var isEdit = !!existing;
    var body = Utils.el('form', { class: 'form-grid', id: 'custForm' }, [
      field('Customer Name *', 'name', existing ? existing.name : '', 'text', true),
      field('Father Name', 'fatherName', existing ? existing.fatherName : ''),
      field('Phone Number', 'phone', existing ? existing.phone : '', 'tel'),
      field('Area / Village', 'area', existing ? existing.area : ''),
      field('Address', 'address', existing ? existing.address : ''),
      field('Milk Rate (per L) *', 'rate', existing ? (existing.rate || '') : '', 'number', false, '0.01'),
      selectField('Status', 'status', existing ? existing.status : 'active', [['active', 'Active'], ['inactive', 'Inactive']]),
      Utils.el('div', { class: 'field field--full' }, [
        Utils.el('label', {}, 'Notes'),
        Utils.el('textarea', { name: 'notes' }, existing ? existing.notes : '')
      ]),
      Utils.el('div', { class: 'form-actions field--full' }, [
        Utils.el('button', { type: 'button', class: 'btn', onclick: function() { App.closeModal(); } }, 'Cancel'),
        Utils.el('button', { type: 'submit', class: 'btn btn--primary' }, isEdit ? 'Save Changes' : 'Add Customer')
      ])
    ]);

    App.openModal(isEdit ? 'Edit Customer' : 'Add Customer', body);

    document.getElementById('custForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var data = Object.fromEntries(fd.entries());
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

  function field(label, name, value, type, required, step) {
    if (!type) type = 'text';
    var attrs = { type: type, name: name, value: value || '' };
    if (required) attrs.required = 'required';
    if (step) attrs.step = step;
    return Utils.el('div', { class: 'field' }, [
      Utils.el('label', {}, label),
      Utils.el('input', attrs)
    ]);
  }

  function selectField(label, name, value, options) {
    return Utils.el('div', { class: 'field' }, [
      Utils.el('label', {}, label),
      Utils.el('select', { name: name },
        options.map(function(o) {
          return Utils.el('option', { value: o[0], selected: o[0] === value ? 'selected' : undefined }, o[1]);
        }))
    ]);
  }

  /* ---------------- Profile page ---------------- */
  function renderProfile(container, customerId) {
    var c = Store.Customers.get(customerId);
    container.innerHTML = '';
    if (!c) {
      container.appendChild(Utils.el('div', { class: 'empty-state' }, [
        Utils.el('div', { class: 'emoji' }, 'Not found'),
        Utils.el('button', { class: 'btn btn--primary', onclick: function() { App.navigate('customers'); } }, 'Back to Customers')
      ]));
      return;
    }

    var today = Utils.todayISO();
    var week = Utils.weekBounds(today);
    var month = Utils.monthBounds(today);
    var life = Billing.lifetime(c.id);
    var outstanding = Billing.outstandingAsOf(c.id, today);
    var todayAgg = Billing.sumEntries(Store.Entries.inRange(today, today, c.id));
    var weekAgg = Billing.sumEntries(Store.Entries.inRange(week.start, week.end, c.id));
    var monthAgg = Billing.sumEntries(Store.Entries.inRange(month.start, month.end, c.id));
    var custRate = c.rate || Store.Rates.current();

    container.appendChild(Utils.el('button', { class: 'btn btn--sm', style: 'margin-bottom:14px',
      onclick: function() { App.navigate('customers'); } }, 'Back to Customers'));

    container.appendChild(Utils.el('div', { class: 'profile-head' }, [
      Utils.el('div', { class: 'avatar' }, c.name.charAt(0).toUpperCase()),
      Utils.el('div', { style: 'flex:1' }, [
        Utils.el('h1', {}, c.name),
        Utils.el('div', { class: 'sub' }, [
          c.fatherName ? 'S/O ' + Utils.escapeHtml(c.fatherName) + ' | ' : '',
          c.phone || 'No phone', ' | ', c.area || 'No area'
        ].join('')),
        c.address ? Utils.el('div', { style: 'font-size:12px;color:var(--muted)' }, c.address) : null
      ]),
      Utils.el('span', { class: 'badge badge--' + c.status }, c.status),
      Utils.el('button', { class: 'btn btn--sm', onclick: function() { openForm(c); } }, 'Edit')
    ]));

    container.appendChild(Utils.el('div', { class: 'grid grid-cards' }, [
      statCard('Milk Rate', Utils.money(custRate), 'Rate', 'gold'),
      statCard('Outstanding', Utils.money(outstanding), outstanding > 0 ? 'Due' : 'Clear', outstanding > 0 ? 'danger' : 'forest'),
      statCard("Today's Milk", Utils.qty(todayAgg.qty), 'Today', 'forest'),
      statCard("Today's Amount", Utils.money(todayAgg.amount), 'Today', 'gold'),
      statCard('Weekly Milk', Utils.qty(weekAgg.qty), 'Week', 'forest'),
      statCard('Weekly Amount', Utils.money(weekAgg.amount), 'Week', 'gold'),
      statCard('Monthly Milk', Utils.qty(monthAgg.qty), 'Month', 'forest'),
      statCard('Monthly Amount', Utils.money(monthAgg.amount), 'Month', 'gold'),
      statCard('Lifetime Milk', Utils.qty(life.qty), 'Total', 'forest'),
      statCard('Lifetime Paid', Utils.money(life.paid), 'Total', 'gold')
    ]));

    var tabs = ['Entries', 'Payments', 'Invoices', 'Weekly', 'Monthly', 'Graph', 'Activity'];
    var tabBar = Utils.el('div', { class: 'profile-tabs' });
    var body = Utils.el('div', { id: 'profileTabBody' });
    var active = 0;
    tabs.forEach(function(t, i) {
      tabBar.appendChild(Utils.el('button', {
        class: 'profile-tab' + (i === 0 ? ' is-active' : ''),
        onclick: function() { active = i; renderTabs(); }
      }, t));
    });
    container.appendChild(tabBar);
    container.appendChild(body);

    function renderTabs() {
      [].slice.call(tabBar.children).forEach(function(b, i) { b.classList.toggle('is-active', i === active); });
      body.innerHTML = '';
      if (active === 0) body.appendChild(entriesTable(c.id));
      if (active === 1) body.appendChild(paymentsTable(c.id));
      if (active === 2) body.appendChild(invoicesTable(c.id));
      if (active === 3) body.appendChild(weeklyTable(c.id));
      if (active === 4) body.appendChild(monthlyTable(c.id));
      if (active === 5) {
        body.appendChild(Utils.el('div', { class: 'panel' }, Utils.el('div', { class: 'chart-box' }, Utils.el('canvas', { id: 'profileChart' }))));
        setTimeout(function() { drawProfileChart(c.id); }, 0);
      }
      if (active === 6) body.appendChild(activityFeed(c.id));
    }
    renderTabs();
  }

  function statCard(label, value, sub, accent) {
    return Utils.el('div', { class: 'card stat-card accent-' + accent }, [
      Utils.el('div', { class: 'stat-label' }, label),
      Utils.el('div', { class: 'stat-value' }, value),
      Utils.el('div', { style: 'font-size:11px;color:var(--muted);margin-top:2px' }, sub)
    ]);
  }

  function entriesTable(customerId) {
    var rows = Store.Entries.forCustomer(customerId).sort(function(a, b) { return b.date.localeCompare(a.date); });
    var wrap = Utils.el('div', { class: 'table-wrap' });
    if (!rows.length) { wrap.appendChild(Utils.el('div', { class: 'table-empty' }, 'No entries yet.')); return wrap; }
    var paginated = Utils.paginate(rows, 1, 15);
    var table = Utils.el('table', {}, Utils.el('thead', {}, Utils.el('tr', {},
      ['Date', 'Morning', 'Evening', 'Total', 'Rate', 'Amount', 'Notes', ''].map(function(h, i) {
        return Utils.el('th', { class: i > 0 && i < 6 ? 'num' : '' }, h);
      }))));
    var tbody = Utils.el('tbody');
    paginated.items.forEach(function(e) {
      tbody.appendChild(Utils.el('tr', {}, [
        Utils.el('td', {}, Utils.formatDate(e.date)),
        Utils.el('td', { class: 'num' }, e.morning || 0),
        Utils.el('td', { class: 'num' }, e.evening || 0),
        Utils.el('td', { class: 'num' }, Utils.qty(e.total)),
        Utils.el('td', { class: 'num' }, Utils.money(e.rate)),
        Utils.el('td', { class: 'num' }, Utils.money(e.amount)),
        Utils.el('td', {}, e.notes || '--'),
        Utils.el('td', {}, Utils.el('div', { class: 'row-actions' }, [
          Utils.el('button', { class: 'btn btn--sm', onclick: function() { EntriesView.openForm(e); } }, 'Edit'),
          Utils.el('button', { class: 'btn btn--sm btn--danger', onclick: function() {
            if (Utils.confirmDialog('Delete this entry?')) { Store.Entries.remove(e.id); App.rerender(); }
          } }, 'Del')
        ]))
      ]));
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    wrap.appendChild(Utils.paginationControls(paginated, function(p) {
      var np = Utils.paginate(rows, p, 15);
      var nt = Utils.el('tbody');
      np.items.forEach(function(e) {
        nt.appendChild(Utils.el('tr', {}, [
          Utils.el('td', {}, Utils.formatDate(e.date)),
          Utils.el('td', { class: 'num' }, e.morning || 0),
          Utils.el('td', { class: 'num' }, e.evening || 0),
          Utils.el('td', { class: 'num' }, Utils.qty(e.total)),
          Utils.el('td', { class: 'num' }, Utils.money(e.rate)),
          Utils.el('td', { class: 'num' }, Utils.money(e.amount)),
          Utils.el('td', {}, e.notes || '--'),
          Utils.el('td', {}, Utils.el('div', { class: 'row-actions' }, [
            Utils.el('button', { class: 'btn btn--sm', onclick: function() { EntriesView.openForm(e); } }, 'Edit'),
            Utils.el('button', { class: 'btn btn--sm btn--danger', onclick: function() {
              if (Utils.confirmDialog('Delete this entry?')) { Store.Entries.remove(e.id); App.rerender(); }
            } }, 'Del')
          ]))
        ]));
      });
      table.replaceChild(nt, table.querySelector('tbody'));
      wrap.replaceChild(Utils.paginationControls(np, arguments.callee), wrap.querySelector('.pagination'));
    }));
    return wrap;
  }

  function paymentsTable(customerId) {
    var rows = Store.Payments.forCustomer(customerId).sort(function(a, b) { return b.date.localeCompare(a.date); });
    var wrap = Utils.el('div', { class: 'table-wrap' });
    if (!rows.length) { wrap.appendChild(Utils.el('div', { class: 'table-empty' }, 'No payments yet.')); return wrap; }
    var paginated = Utils.paginate(rows, 1, 15);
    var table = Utils.el('table', {}, Utils.el('thead', {}, Utils.el('tr', {},
      ['Date', 'Amount', 'Method', 'Notes', ''].map(function(h, i) { return Utils.el('th', { class: i === 1 ? 'num' : '' }, h); }))));
    var tbody = Utils.el('tbody');
    paginated.items.forEach(function(p) {
      tbody.appendChild(Utils.el('tr', {}, [
        Utils.el('td', {}, Utils.formatDate(p.date)),
        Utils.el('td', { class: 'num' }, Utils.money(p.amount)),
        Utils.el('td', {}, Utils.el('span', { class: 'badge badge--active' }, p.method)),
        Utils.el('td', {}, p.notes || '--'),
        Utils.el('td', {}, Utils.el('div', { class: 'row-actions' }, [
          Utils.el('button', { class: 'btn btn--sm btn--danger', onclick: function() {
            if (Utils.confirmDialog('Delete this payment?')) { Store.Payments.remove(p.id); App.rerender(); }
          } }, 'Del')
        ]))
      ]));
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    wrap.appendChild(Utils.paginationControls(paginated, function(p) {
      var np = Utils.paginate(rows, p, 15);
      var nt = Utils.el('tbody');
      np.items.forEach(function(pay) {
        nt.appendChild(Utils.el('tr', {}, [
          Utils.el('td', {}, Utils.formatDate(pay.date)),
          Utils.el('td', { class: 'num' }, Utils.money(pay.amount)),
          Utils.el('td', {}, Utils.el('span', { class: 'badge badge--active' }, pay.method)),
          Utils.el('td', {}, pay.notes || '--'),
          Utils.el('td', {}, Utils.el('div', { class: 'row-actions' }, [
            Utils.el('button', { class: 'btn btn--sm btn--danger', onclick: function() {
              if (Utils.confirmDialog('Delete this payment?')) { Store.Payments.remove(p.id); App.rerender(); }
            } }, 'Del')
          ]))
        ]));
      });
      table.replaceChild(nt, table.querySelector('tbody'));
      wrap.replaceChild(Utils.paginationControls(np, arguments.callee), wrap.querySelector('.pagination'));
    }));
    return wrap;
  }

  function invoicesTable(customerId) {
    var rows = Store.Invoices.forCustomer(customerId).sort(function(a, b) { return b.createdAt - a.createdAt; });
    var wrap = Utils.el('div', { class: 'table-wrap' });
    if (!rows.length) { wrap.appendChild(Utils.el('div', { class: 'table-empty' }, 'No invoices yet.')); return wrap; }
    var paginated = Utils.paginate(rows, 1, 10);
    var table = Utils.el('table', {}, Utils.el('thead', {}, Utils.el('tr', {},
      ['Invoice #', 'Period', 'Total', 'Status', ''].map(function(h, i) { return Utils.el('th', { class: i === 2 ? 'num' : '' }, h); }))));
    var tbody = Utils.el('tbody');
    paginated.items.forEach(function(inv) {
      tbody.appendChild(Utils.el('tr', {}, [
        Utils.el('td', { class: 'mono' }, inv.invoiceNumber),
        Utils.el('td', {}, Utils.formatDate(inv.periodStart) + ' - ' + Utils.formatDate(inv.periodEnd)),
        Utils.el('td', { class: 'num' }, Utils.money(inv.totalPayable)),
        Utils.el('td', {}, Utils.el('span', { class: 'badge badge--' + inv.status.toLowerCase() }, inv.status)),
        Utils.el('td', {}, Utils.el('div', { class: 'row-actions' }, [
          Utils.el('button', { class: 'btn btn--sm', onclick: function() { InvoicesView.viewInvoice(inv.id); } }, 'View')
        ]))
      ]));
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    wrap.appendChild(Utils.paginationControls(paginated, function(p) {
      var np = Utils.paginate(rows, p, 10);
      var nt = Utils.el('tbody');
      np.items.forEach(function(inv) {
        nt.appendChild(Utils.el('tr', {}, [
          Utils.el('td', { class: 'mono' }, inv.invoiceNumber),
          Utils.el('td', {}, Utils.formatDate(inv.periodStart) + ' - ' + Utils.formatDate(inv.periodEnd)),
          Utils.el('td', { class: 'num' }, Utils.money(inv.totalPayable)),
          Utils.el('td', {}, Utils.el('span', { class: 'badge badge--' + inv.status.toLowerCase() }, inv.status)),
          Utils.el('td', {}, Utils.el('div', { class: 'row-actions' }, [
            Utils.el('button', { class: 'btn btn--sm', onclick: function() { InvoicesView.viewInvoice(inv.id); } }, 'View')
          ]))
        ]));
      });
      table.replaceChild(nt, table.querySelector('tbody'));
      wrap.replaceChild(Utils.paginationControls(np, arguments.callee), wrap.querySelector('.pagination'));
    }));
    return wrap;
  }

  function weeklyTable(customerId) {
    var entries = Store.Entries.forCustomer(customerId);
    if (!entries.length) return Utils.el('div', { class: 'table-wrap' }, Utils.el('div', { class: 'table-empty' }, 'No data yet.'));
    var dates = entries.map(function(e) { return e.date; }).sort();
    var rows = Billing.weeklyReport(customerId, dates[0], Utils.todayISO()).reverse();
    return Reports.statementTable(rows, 'week');
  }

  function monthlyTable(customerId) {
    var entries = Store.Entries.forCustomer(customerId);
    if (!entries.length) return Utils.el('div', { class: 'table-wrap' }, Utils.el('div', { class: 'table-empty' }, 'No data yet.'));
    var dates = entries.map(function(e) { return e.date; }).sort();
    var rows = Billing.monthlyReport(customerId, dates[0], Utils.todayISO()).reverse();
    return Reports.statementTable(rows, 'month');
  }

  function drawProfileChart(customerId) {
    if (typeof Chart === 'undefined') return;
    var entries = Store.Entries.forCustomer(customerId).sort(function(a, b) { return a.date.localeCompare(b.date); }).slice(-30);
    Charts.lineChart('profileChart', entries.map(function(e) { return Utils.formatDate(e.date, { day: '2-digit', month: 'short' }); }), [
      { label: 'Milk (L)', data: entries.map(function(e) { return e.total; }) }
    ]);
  }

  function activityFeed(customerId) {
    var activities = [];
    Store.Entries.forCustomer(customerId).forEach(function(e) {
      activities.push({ type: 'entry', date: e.date, title: 'Milk: ' + Utils.qty(e.total), meta: 'Rate: ' + Utils.money(e.rate), amount: Utils.money(e.amount), icon: 'M' });
    });
    Store.Payments.forCustomer(customerId).forEach(function(p) {
      activities.push({ type: 'payment', date: p.date, title: 'Payment: ' + Utils.money(p.amount), meta: p.method, amount: Utils.money(p.amount), icon: 'P' });
    });
    Store.Invoices.forCustomer(customerId).forEach(function(inv) {
      activities.push({ type: 'invoice', date: inv.date, title: 'Invoice ' + inv.invoiceNumber, meta: inv.status, amount: Utils.money(inv.totalPayable), icon: 'I' });
    });
    activities.sort(function(a, b) { return b.date.localeCompare(a.date); });
    var paginated = Utils.paginate(activities, 1, 20);
    var wrap = Utils.el('div', { class: 'panel' });
    if (!activities.length) { wrap.appendChild(Utils.el('p', { style: 'color:var(--muted);text-align:center' }, 'No activity yet.')); return wrap; }
    var feed = Utils.el('div', { class: 'activity-feed' });
    paginated.items.forEach(function(a) {
      feed.appendChild(Utils.el('div', { class: 'activity-item' }, [
        Utils.el('div', { class: 'act-icon ' + a.type }, a.icon),
        Utils.el('div', { class: 'act-body' }, [
          Utils.el('div', { class: 'act-title' }, a.title),
          Utils.el('div', { class: 'act-meta' }, Utils.formatDate(a.date) + ' | ' + a.meta)
        ]),
        Utils.el('div', { class: 'act-amount' }, a.amount)
      ]));
    });
    wrap.appendChild(feed);
    wrap.appendChild(Utils.paginationControls(paginated, function(p) {
      var np = Utils.paginate(activities, p, 20);
      feed.innerHTML = '';
      np.items.forEach(function(a) {
        feed.appendChild(Utils.el('div', { class: 'activity-item' }, [
          Utils.el('div', { class: 'act-icon ' + a.type }, a.icon),
          Utils.el('div', { class: 'act-body' }, [
            Utils.el('div', { class: 'act-title' }, a.title),
            Utils.el('div', { class: 'act-meta' }, Utils.formatDate(a.date) + ' | ' + a.meta)
          ]),
          Utils.el('div', { class: 'act-amount' }, a.amount)
        ]));
      });
      wrap.replaceChild(Utils.paginationControls(np, arguments.callee), wrap.querySelector('.pagination'));
    }));
    return wrap;
  }

  return { render: render, renderProfile: renderProfile, openForm: openForm };
})();