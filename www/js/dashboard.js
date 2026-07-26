/* ==========================================================================
   dashboard.js — main dashboard with stat cards, charts and quick lists
   ========================================================================== */

const DashboardView = (() => {

  function render(container) {
    container.innerHTML = '';
    var today = Utils.todayISO();
    var week = Utils.weekBounds(today);
    var month = Utils.monthBounds(today);

    var todayAgg = Billing.aggregateRange(today, today);
    var weekAgg = Billing.aggregateRange(week.start, week.end);
    var monthAgg = Billing.aggregateRange(month.start, month.end);
    var customers = Store.Customers.all();
    var activeCustomers = customers.filter(function(c) { return c.status === 'active'; });
    var inactiveCustomers = customers.filter(function(c) { return c.status === 'inactive'; });
    var outstandingTotal = Billing.totalOutstandingAll(today);
    var pendingCustomers = customers.filter(function(c) { return Billing.outstandingAsOf(c.id, today) > 0; });
    var avgMilk = activeCustomers.length ? (todayAgg.qty / activeCustomers.length) : 0;

    var allPayments = Store.Payments.all().sort(function(a, b) { return b.createdAt - a.createdAt; });
    var latestPayment = allPayments.length ? allPayments[0] : null;
    var latestPaymentCust = latestPayment ? Store.Customers.get(latestPayment.customerId) : null;

    var allEntries = Store.Entries.all().sort(function(a, b) { return b.createdAt - a.createdAt; });
    var latestEntry = allEntries.length ? allEntries[0] : null;
    var latestEntryCust = latestEntry ? Store.Customers.get(latestEntry.customerId) : null;

    container.appendChild(Utils.el('div', { class: 'view-head' }, [
      Utils.el('div', {}, [
        Utils.el('h1', {}, 'Dashboard'),
        Utils.el('div', { class: 'sub' }, Utils.formatDate(today, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }))
      ]),
      Utils.el('div', { class: 'view-actions' }, [
        Utils.el('button', { class: 'btn btn--primary', onclick: function() { EntriesView.openForm(); } }, '+ Daily Entry'),
        Utils.el('button', { class: 'btn', onclick: function() { PaymentsView.openForm(); } }, '+ Payment')
      ])
    ]));

    container.appendChild(Utils.el('div', { class: 'grid grid-cards' }, [
      statCard('Total Customers', customers.length, '👥', 'forest'),
      statCard('Active', activeCustomers.length, '✓', 'forest'),
      statCard('Inactive', inactiveCustomers.length, '○', 'muted'),
      statCard("Today's Milk", Utils.qty(todayAgg.qty), '🥛', 'forest'),
      statCard("Today's Collection", Utils.money(todayAgg.amount), '💰', 'gold'),
      statCard('Weekly Collection', Utils.money(weekAgg.amount), '📊', 'gold'),
      statCard('Monthly Collection', Utils.money(monthAgg.amount), '📈', 'gold'),
      statCard('Avg Milk/Customer', Utils.qty(avgMilk), '📊', 'forest'),
      statCard('Pending Payments', pendingCustomers.length, '⏱', 'danger'),
      statCard('Outstanding Balance', Utils.money(outstandingTotal), '⚠', 'danger')
    ]));

    var activityRow = Utils.el('div', { class: 'two-col' });
    activityRow.appendChild(Utils.el('div', { class: 'panel' }, [
      Utils.el('h3', {}, 'Latest Payment'),
      latestPayment && latestPaymentCust
        ? Utils.el('div', { style: 'font-size:13px' }, [
            Utils.el('div', { style: 'font-weight:700' }, Utils.money(latestPayment.amount) + ' from ' + latestPaymentCust.name),
            Utils.el('div', { style: 'color:var(--muted);font-size:12px' }, Utils.formatDate(latestPayment.date) + ' | ' + latestPayment.method)
          ])
        : Utils.el('p', { style: 'color:var(--muted)' }, 'No payments yet.')
    ]));
    activityRow.appendChild(Utils.el('div', { class: 'panel' }, [
      Utils.el('h3', {}, 'Latest Entry'),
      latestEntry && latestEntryCust
        ? Utils.el('div', { style: 'font-size:13px' }, [
            Utils.el('div', { style: 'font-weight:700' }, Utils.qty(latestEntry.total) + ' from ' + latestEntryCust.name),
            Utils.el('div', { style: 'color:var(--muted);font-size:12px' }, Utils.formatDate(latestEntry.date) + ' | Amount: ' + Utils.money(latestEntry.amount))
          ])
        : Utils.el('p', { style: 'color:var(--muted)' }, 'No entries yet.')
    ]));
    container.appendChild(activityRow);

    var two = Utils.el('div', { class: 'two-col' });
    two.appendChild(Utils.el('div', { class: 'panel' }, [
      Utils.el('h3', {}, 'Milk Collection - Last 14 Days'),
      Utils.el('div', { class: 'chart-box' }, Utils.el('canvas', { id: 'dashTrendChart' }))
    ]));
    two.appendChild(Utils.el('div', { class: 'panel' }, [
      Utils.el('h3', {}, 'Payment Methods (This Month)'),
      Utils.el('div', { class: 'chart-box' }, Utils.el('canvas', { id: 'dashPayChart' }))
    ]));
    container.appendChild(two);

    var topDebt = customers
      .map(function(c) { return { c: c, bal: Billing.outstandingAsOf(c.id, today) }; })
      .filter(function(x) { return x.bal > 0; })
      .sort(function(a, b) { return b.bal - a.bal; })
      .slice(0, 8);

    var panel = Utils.el('div', { class: 'panel' }, [Utils.el('h3', {}, 'Top Outstanding Customers')]);
    if (!topDebt.length) {
      panel.appendChild(Utils.el('p', { style: 'color:var(--muted)' }, 'Everyone is settled up!'));
    } else {
      var wrap = Utils.el('div', { class: 'table-wrap', style: 'box-shadow:none' });
      var table = Utils.el('table', {}, Utils.el('thead', {}, Utils.el('tr', {},
        ['Customer', 'Village', 'Outstanding', ''].map(function(h, i) { return Utils.el('th', { class: i === 2 ? 'num' : '' }, h); }))));
      var tbody = Utils.el('tbody');
      topDebt.forEach(function(item) {
        tbody.appendChild(Utils.el('tr', {}, [
          Utils.el('td', { style: 'font-weight:600' }, item.c.name),
          Utils.el('td', {}, item.c.area || '--'),
          Utils.el('td', { class: 'num', style: 'color:var(--danger)' }, Utils.money(item.bal)),
          Utils.el('td', {}, Utils.el('div', { class: 'row-actions' }, [
            Utils.el('button', { class: 'btn btn--sm', onclick: function() { PaymentsView.openForm(item.c.id); } }, 'Pay'),
            Utils.el('button', { class: 'btn btn--sm', onclick: function() { App.navigate('profile', { id: item.c.id }); } }, 'View')
          ]))
        ]));
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      panel.appendChild(wrap);
    }
    container.appendChild(panel);

    if (typeof Chart !== 'undefined') {
      setTimeout(function() { drawCharts(today); }, 0);
    }
  }

  function statCard(label, value, icon, accent) {
    return Utils.el('div', { class: 'card stat-card accent-' + accent }, [
      Utils.el('div', { class: 'stat-icon' }, icon),
      Utils.el('div', { class: 'stat-label' }, label),
      Utils.el('div', { class: 'stat-value' }, String(value))
    ]);
  }

  function drawCharts(today) {
    var labels = [], qtyData = [], amtData = [];
    for (var i = 13; i >= 0; i--) {
      var d = Utils.addDays(today, -i);
      var agg = Billing.aggregateRange(d, d);
      labels.push(Utils.formatDate(d, { day: '2-digit', month: 'short' }));
      qtyData.push(agg.qty);
      amtData.push(agg.amount);
    }
    Charts.lineChart('dashTrendChart', labels, [
      { label: 'Milk (L)', data: qtyData }
    ]);

    var month = Utils.monthBounds(today);
    var payments = Store.Payments.inRange(month.start, month.end);
    var byMethod = {};
    payments.forEach(function(p) { byMethod[p.method] = (byMethod[p.method] || 0) + p.amount; });
    var methods = Object.keys(byMethod);
    if (methods.length) {
      Charts.doughnutChart('dashPayChart', methods, methods.map(function(m) { return byMethod[m]; }));
    } else {
      Charts.destroy('dashPayChart');
    }
  }

  return { render: render };
})();