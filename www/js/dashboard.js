/* ==========================================================================
   dashboard.js — main dashboard with stat cards, charts and quick lists
   ========================================================================== */

const DashboardView = (() => {

  function render(container) {
    container.innerHTML = '';
    const today = Utils.todayISO();
    const week = Utils.weekBounds(today);
    const month = Utils.monthBounds(today);

    const todayAgg = Billing.aggregateRange(today, today);
    const weekAgg = Billing.aggregateRange(week.start, week.end);
    const monthAgg = Billing.aggregateRange(month.start, month.end);
    const customers = Store.Customers.all();
    const activeCustomers = customers.filter(c => c.status === 'active');
    const inactiveCustomers = customers.filter(c => c.status === 'inactive');
    const outstandingTotal = Billing.totalOutstandingAll(today);
    const pendingCustomers = customers.filter(c => Billing.outstandingAsOf(c.id, today) > 0);

    // Calculate average milk per active customer today
    const avgMilk = activeCustomers.length ? (todayAgg.qty / activeCustomers.length) : 0;

    // Latest payment
    const allPayments = Store.Payments.all().sort((a, b) => b.createdAt - a.createdAt);
    const latestPayment = allPayments.length ? allPayments[0] : null;
    const latestPaymentCust = latestPayment ? Store.Customers.get(latestPayment.customerId) : null;

    // Latest entry
    const allEntries = Store.Entries.all().sort((a, b) => b.createdAt - a.createdAt);
    const latestEntry = allEntries.length ? allEntries[0] : null;
    const latestEntryCust = latestEntry ? Store.Customers.get(latestEntry.customerId) : null;

    container.appendChild(Utils.el('div', { class: 'view-head' }, [
      Utils.el('div', {}, [
        Utils.el('h1', {}, `Welcome back${Store.getSettings().ownerName ? ', ' + Store.getSettings().ownerName : ''} 👋`),
        Utils.el('div', { class: 'sub' }, `${Utils.formatDate(today, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}`)
      ]),
      Utils.el('div', { class: 'view-actions' }, [
        Utils.el('button', { class: 'btn btn--primary', onclick: () => EntriesView.openForm() }, '+ Daily Entry'),
        Utils.el('button', { class: 'btn', onclick: () => PaymentsView.openForm() }, '+ Payment')
      ])
    ]));

    // Stats cards
    container.appendChild(Utils.el('div', { class: 'grid grid-cards' }, [
      stat('Total Customers', customers.length, '☺', 'forest'),
      stat('Active Customers', activeCustomers.length, '✅', 'forest'),
      stat('Inactive Customers', inactiveCustomers.length, '⏸', 'muted'),
      stat("Today's Milk", Utils.qty(todayAgg.qty), '🥛', 'forest'),
      stat("Today's Collection", Utils.money(todayAgg.amount), '📈', 'gold'),
      stat('Weekly Collection', Utils.money(weekAgg.amount), '📅', 'gold'),
      stat('Monthly Collection', Utils.money(monthAgg.amount), '🗓', 'gold'),
      stat('Avg Milk/Customer', Utils.qty(avgMilk), '📊', 'forest'),
      stat('Pending Payments', pendingCustomers.length, '⏳', 'danger'),
      stat('Outstanding Balance', Utils.money(outstandingTotal), '⚠', 'danger')
    ]));

    // Latest activity cards
    const activityRow = Utils.el('div', { class: 'two-col' });
    activityRow.appendChild(Utils.el('div', { class: 'panel' }, [
      Utils.el('h3', {}, 'Latest Payment'),
      latestPayment && latestPaymentCust
        ? Utils.el('div', { style: 'font-size:13px' }, [
            Utils.el('div', { style: 'font-weight:700' }, `${Utils.money(latestPayment.amount)} from ${latestPaymentCust.name}`),
            Utils.el('div', { style: 'color:var(--muted);font-size:12px' }, `${Utils.formatDate(latestPayment.date)} • ${latestPayment.method}`)
          ])
        : Utils.el('p', { style: 'color:var(--muted)' }, 'No payments recorded yet.')
    ]));
    activityRow.appendChild(Utils.el('div', { class: 'panel' }, [
      Utils.el('h3', {}, 'Latest Milk Entry'),
      latestEntry && latestEntryCust
        ? Utils.el('div', { style: 'font-size:13px' }, [
            Utils.el('div', { style: 'font-weight:700' }, `${Utils.qty(latestEntry.total)} from ${latestEntryCust.name}`),
            Utils.el('div', { style: 'color:var(--muted);font-size:12px' }, `${Utils.formatDate(latestEntry.date)} • Amount: ${Utils.money(latestEntry.amount)}`)
          ])
        : Utils.el('p', { style: 'color:var(--muted)' }, 'No entries recorded yet.')
    ]));
    container.appendChild(activityRow);

    // Charts
    const two = Utils.el('div', { class: 'two-col' });
    two.appendChild(Utils.el('div', { class: 'panel' }, [
      Utils.el('h3', {}, 'Milk Collection — Last 14 Days'),
      Utils.el('div', { class: 'chart-box' }, Utils.el('canvas', { id: 'dashTrendChart' }))
    ]));
    two.appendChild(Utils.el('div', { class: 'panel' }, [
      Utils.el('h3', {}, 'Payment Methods (This Month)'),
      Utils.el('div', { class: 'chart-box' }, Utils.el('canvas', { id: 'dashPayChart' }))
    ]));
    container.appendChild(two);

    // Top outstanding customers
    const topDebt = customers
      .map(c => ({ c, bal: Billing.outstandingAsOf(c.id, today) }))
      .filter(x => x.bal > 0)
      .sort((a, b) => b.bal - a.bal)
      .slice(0, 8);

    const panel = Utils.el('div', { class: 'panel' }, [Utils.el('h3', {}, 'Customers With Outstanding Balance')]);
    if (!topDebt.length) {
      panel.appendChild(Utils.el('p', { style: 'color:var(--muted)' }, 'Everyone is settled up. Nice work! 🎉'));
    } else {
      const wrap = Utils.el('div', { class: 'table-wrap', style: 'box-shadow:none' });
      const table = Utils.el('table', {}, Utils.el('thead', {}, Utils.el('tr', {}, ['Customer', 'Village', 'Outstanding', ''].map((h, i) => Utils.el('th', { class: i === 2 ? 'num' : '' }, h)))));
      const tbody = Utils.el('tbody');
      topDebt.forEach(({ c, bal }) => tbody.appendChild(Utils.el('tr', {}, [
        Utils.el('td', { style: 'font-weight:600' }, c.name),
        Utils.el('td', {}, c.area || '—'),
        Utils.el('td', { class: 'num', style: 'color:var(--danger)' }, Utils.money(bal)),
        Utils.el('td', {}, Utils.el('div', { class: 'row-actions' }, [
          Utils.el('button', { class: 'btn btn--sm', onclick: () => PaymentsView.openForm(c.id) }, 'Record Payment'),
          Utils.el('button', { class: 'btn btn--sm', onclick: () => App.navigate('profile', { id: c.id }) }, 'View')
        ]))
      ])));
      table.appendChild(tbody);
      wrap.appendChild(table);
      panel.appendChild(wrap);
    }
    container.appendChild(panel);

    // Only draw charts if Chart.js library loaded successfully
    if (typeof Chart !== 'undefined') {
      setTimeout(() => drawCharts(today), 0);
    }
  }

  function stat(label, value, icon, accent) {
    return Utils.el('div', { class: `card stat-card accent-${accent}` }, [
      Utils.el('span', { class: 'stat-icon' }, icon),
      Utils.el('div', { class: 'stat-label' }, label),
      Utils.el('div', { class: 'stat-value' }, String(value))
    ]);
  }

  function drawCharts(today) {
    const labels = []; const qtyData = []; const amtData = [];
    for (let i = 13; i >= 0; i--) {
      const d = Utils.addDays(today, -i);
      const agg = Billing.aggregateRange(d, d);
      labels.push(Utils.formatDate(d, { day: '2-digit', month: 'short' }));
      qtyData.push(agg.qty);
      amtData.push(agg.amount);
    }
    Charts.lineChart('dashTrendChart', labels, [
      { label: 'Milk (L)', data: qtyData, yAxisID: 'y' }
    ]);

    const month = Utils.monthBounds(today);
    const payments = Store.Payments.inRange(month.start, month.end);
    const byMethod = {};
    payments.forEach(p => byMethod[p.method] = (byMethod[p.method] || 0) + p.amount);
    const methods = Object.keys(byMethod);
    if (methods.length) {
      Charts.doughnutChart('dashPayChart', methods, methods.map(m => byMethod[m]));
    } else {
      Charts.destroy('dashPayChart');
    }
  }

  return { render };
})();