/* ==========================================================================
   reports.js — weekly / monthly / yearly reports + export
   ========================================================================== */

const Reports = (() => {

  function statementTable(rows, kind) {
    var wrap = Utils.el('div', { class: 'table-wrap' });
    if (!rows.length) { wrap.appendChild(Utils.el('div', { class: 'table-empty' }, 'No data for this period.')); return wrap; }
    var periodLabel = kind === 'week' ? 'Week' : kind === 'month' ? 'Month' : 'Year';
    var paginated = Utils.paginate(rows, 1, 20);
    var table = Utils.el('table', {}, Utils.el('thead', {}, Utils.el('tr', {},
      [periodLabel, 'Milk Qty', 'Bill Amount', 'Prev Balance', 'Payments', 'Total Payable', 'Balance', 'Status']
        .map(function(h, i) { return Utils.el('th', { class: i > 0 && i < 7 ? 'num' : '' }, h); }))));
    var tbody = Utils.el('tbody');

    function renderRows(items) {
      tbody.innerHTML = '';
      items.forEach(function(r) {
        var label = kind === 'week' ? 'Week ' + r.weekNumber + ' (' + Utils.formatDate(r.start) + '-' + Utils.formatDate(r.end) + ')'
          : kind === 'month' ? r.label : r.year;
        tbody.appendChild(Utils.el('tr', {}, [
          Utils.el('td', {}, label),
          Utils.el('td', { class: 'num' }, Utils.qty(r.qty)),
          Utils.el('td', { class: 'num' }, Utils.money(r.currentBill)),
          Utils.el('td', { class: 'num' }, Utils.money(r.previousBalance)),
          Utils.el('td', { class: 'num' }, Utils.money(r.paymentsReceived)),
          Utils.el('td', { class: 'num' }, Utils.money(r.totalPayable)),
          Utils.el('td', { class: 'num', style: r.remaining > 0 ? 'color:var(--danger)' : 'color:var(--success)' }, Utils.money(r.remaining)),
          Utils.el('td', {}, Utils.el('span', { class: 'badge badge--' + r.status.toLowerCase() }, r.status))
        ]));
      });
    }

    renderRows(paginated.items);
    table.appendChild(tbody);
    wrap.appendChild(table);
    wrap.appendChild(Utils.paginationControls(paginated, function(p) {
      var np = Utils.paginate(rows, p, 20);
      renderRows(np.items);
      wrap.replaceChild(Utils.paginationControls(np, arguments.callee), wrap.querySelector('.pagination'));
    }));
    return wrap;
  }

  function customerSelector(onChange, currentId) {
    var customers = Store.Customers.all();
    var sel = Utils.el('select', { id: 'reportCustSelect' }, [
      Utils.el('option', { value: '' }, 'All Customers (business totals)')
    ]);
    customers.forEach(function(c) {
      sel.appendChild(Utils.el('option', { value: c.id, selected: currentId === c.id ? 'selected' : undefined }, c.name));
    });
    sel.addEventListener('change', function() { onChange(sel.value); });
    return sel;
  }

  function earliestDate() {
    var dates = Store.Entries.all().map(function(e) { return e.date; });
    return dates.length ? dates.sort()[0] : Utils.todayISO();
  }

  function buildReportView(container, kind, title) {
    container.innerHTML = '';
    var selectedCustomer = '';

    var icon = kind === 'week' ? '📊' : kind === 'month' ? '📈' : '📅';
    container.appendChild(Utils.el('div', { class: 'view-head' }, [
      Utils.el('div', {}, [Utils.el('h1', {}, icon + ' ' + title), Utils.el('div', { class: 'sub' }, 'From recorded entries and payments')]),
      Utils.el('div', { class: 'view-actions', id: 'reportActions' })
    ]));

    var summary = Utils.el('div', { id: 'reportSummary', class: 'grid grid-cards' });
    container.appendChild(summary);

    container.appendChild(Utils.el('div', { class: 'filters' }));
    var body = Utils.el('div', { id: 'reportBody' });
    container.appendChild(body);

    function draw() {
      var filters = container.querySelector('.filters');
      filters.innerHTML = '';
      filters.appendChild(customerSelector(function(v) { selectedCustomer = v; draw(); }, selectedCustomer));
      document.getElementById('reportActions').innerHTML = '';
      document.getElementById('reportActions').appendChild(
        Utils.el('button', { class: 'btn btn--sm', onclick: function() { exportCurrent(kind, selectedCustomer); } }, 'Export CSV')
      );

      body.innerHTML = '';
      if (!Store.Customers.all().length) { body.appendChild(Utils.el('div', { class: 'table-empty' }, 'No customers yet.')); return; }
      var from = earliestDate();
      var to = Utils.todayISO();

      var totalEntries = Store.Entries.inRange(from, to);
      var totalPayments = Store.Payments.inRange(from, to);
      var entriesSum = Billing.sumEntries(totalEntries);
      var paymentsSum = Billing.sumPayments(totalPayments);
      var avgRate = totalEntries.length ? totalEntries.reduce(function(s, e) { return s + e.rate; }, 0) / totalEntries.length : 0;

      var topCustomer = null;
      if (!selectedCustomer) {
        var custBalances = Store.Customers.all().map(function(c) {
          return { name: c.name, bal: Billing.outstandingAsOf(c.id, to) };
        }).filter(function(x) { return x.bal > 0; }).sort(function(a, b) { return b.bal - a.bal; });
        topCustomer = custBalances.length ? custBalances[0] : null;
      }

      summary.innerHTML = '';
      summary.appendChild(Utils.el('div', { class: 'card stat-card accent-forest' }, [
        Utils.el('div', { class: 'stat-label' }, 'Total Milk'),
        Utils.el('div', { class: 'stat-value' }, Utils.qty(entriesSum.qty))
      ]));
      summary.appendChild(Utils.el('div', { class: 'card stat-card accent-gold' }, [
        Utils.el('div', { class: 'stat-label' }, 'Total Revenue'),
        Utils.el('div', { class: 'stat-value' }, Utils.money(entriesSum.amount))
      ]));
      summary.appendChild(Utils.el('div', { class: 'card stat-card accent-gold' }, [
        Utils.el('div', { class: 'stat-label' }, 'Total Payments'),
        Utils.el('div', { class: 'stat-value' }, Utils.money(paymentsSum))
      ]));
      summary.appendChild(Utils.el('div', { class: 'card stat-card accent-forest' }, [
        Utils.el('div', { class: 'stat-label' }, 'Avg Rate'),
        Utils.el('div', { class: 'stat-value' }, Utils.money(avgRate))
      ]));
      if (topCustomer) {
        summary.appendChild(Utils.el('div', { class: 'card stat-card accent-danger' }, [
          Utils.el('div', { class: 'stat-label' }, 'Top Defaulter'),
          Utils.el('div', { class: 'stat-value' }, topCustomer.name + ': ' + Utils.money(topCustomer.bal))
        ]));
      }

      if (selectedCustomer) {
        var rows = (kind === 'week' ? Billing.weeklyReport(selectedCustomer, from, to)
          : kind === 'month' ? Billing.monthlyReport(selectedCustomer, from, to)
          : Billing.yearlyReport(selectedCustomer, from, to)).reverse();
        body.appendChild(statementTable(rows, kind));
      } else {
        body.appendChild(businessWideTable(kind, from, to));
      }
    }
    draw();
  }

  function periodsBetween(kind, from, to) {
    var periods = [];
    if (kind === 'week') {
      var cursor = Utils.weekBounds(from).start;
      var last = Utils.weekBounds(to).start;
      while (cursor <= last) {
        var b = Utils.weekBounds(cursor);
        periods.push({ start: b.start, end: b.end, label: 'Week ' + Utils.weekNumber(b.start) + ' (' + Utils.formatDate(b.start) + '-' + Utils.formatDate(b.end) + ')' });
        cursor = Utils.addDays(cursor, 7);
      }
    } else if (kind === 'month') {
      var cursor = Utils.monthBounds(from).start;
      var last = Utils.monthBounds(to).start;
      while (cursor <= last) {
        var b = Utils.monthBounds(cursor);
        periods.push({ start: b.start, end: b.end, label: Utils.monthName(b.start) });
        var n = new Date(Utils.parseISO(b.start));
        n.setMonth(n.getMonth() + 1);
        cursor = Utils.dateToISO(n);
      }
    } else {
      var cursor = Utils.yearBounds(from).start;
      var last = Utils.yearBounds(to).start;
      while (cursor <= last) {
        var b = Utils.yearBounds(cursor);
        periods.push({ start: b.start, end: b.end, label: b.start.slice(0, 4) });
        cursor = (Number(b.start.slice(0, 4)) + 1) + '-01-01';
      }
    }
    return periods.reverse();
  }

  function businessWideTable(kind, from, to) {
    var periods = periodsBetween(kind, from, to);
    var paginated = Utils.paginate(periods, 1, 20);
    var wrap = Utils.el('div', { class: 'table-wrap' });
    if (!periods.length) { wrap.appendChild(Utils.el('div', { class: 'table-empty' }, 'No data yet.')); return wrap; }
    var table = Utils.el('table', {}, Utils.el('thead', {}, Utils.el('tr', {},
      [kind === 'week' ? 'Week' : kind === 'month' ? 'Month' : 'Year', 'Total Milk', 'Total Billed', 'Payments', 'Entries']
        .map(function(h, i) { return Utils.el('th', { class: i > 0 ? 'num' : '' }, h); }))));
    var tbody = Utils.el('tbody');

    function renderRows(items) {
      tbody.innerHTML = '';
      items.forEach(function(p) {
        var agg = Billing.aggregateRange(p.start, p.end);
        tbody.appendChild(Utils.el('tr', {}, [
          Utils.el('td', {}, p.label),
          Utils.el('td', { class: 'num' }, Utils.qty(agg.qty)),
          Utils.el('td', { class: 'num' }, Utils.money(agg.amount)),
          Utils.el('td', { class: 'num' }, Utils.money(agg.paid)),
          Utils.el('td', { class: 'num' }, agg.entriesCount)
        ]));
      });
    }

    renderRows(paginated.items);
    table.appendChild(tbody);
    wrap.appendChild(table);
    wrap.appendChild(Utils.paginationControls(paginated, function(p) {
      var np = Utils.paginate(periods, p, 20);
      renderRows(np.items);
      wrap.replaceChild(Utils.paginationControls(np, arguments.callee), wrap.querySelector('.pagination'));
    }));
    return wrap;
  }

  function exportCurrent(kind, customerId) {
    var from = earliestDate();
    var to = Utils.todayISO();
    if (customerId) {
      var cust = Store.Customers.get(customerId);
      var rows = (kind === 'week' ? Billing.weeklyReport(customerId, from, to) : kind === 'month' ? Billing.monthlyReport(customerId, from, to) : Billing.yearlyReport(customerId, from, to));
      var headers = ['Period', 'Milk Qty', 'Bill Amount', 'Previous Balance', 'Payments', 'Total Payable', 'Balance', 'Status'];
      var csvRows = rows.map(function(r) { return [r.label || r.year || 'Week ' + r.weekNumber, r.qty, r.currentBill, r.previousBalance, r.paymentsReceived, r.totalPayable, r.remaining, r.status]; });
      Utils.downloadFile(cust.name + '_' + kind + 'ly_report.csv', Utils.toCSV(csvRows, headers), 'text/csv');
    } else {
      var periods = periodsBetween(kind, from, to);
      var headers = ['Period', 'Total Milk', 'Total Billed', 'Payments Received', 'Entries'];
      var csvRows = periods.map(function(p) { var agg = Billing.aggregateRange(p.start, p.end); return [p.label, agg.qty, agg.amount, agg.paid, agg.entriesCount]; });
      Utils.downloadFile('business_' + kind + 'ly_report.csv', Utils.toCSV(csvRows, headers), 'text/csv');
    }
    Utils.toast('Report exported as CSV.', 'success');
  }

  var renderWeekly = function(c) { buildReportView(c, 'week', 'Weekly Report'); };
  var renderMonthly = function(c) { buildReportView(c, 'month', 'Monthly Report'); };
  var renderYearly = function(c) { buildReportView(c, 'year', 'Yearly Report'); };

  return { statementTable: statementTable, renderWeekly: renderWeekly, renderMonthly: renderMonthly, renderYearly: renderYearly };
})();