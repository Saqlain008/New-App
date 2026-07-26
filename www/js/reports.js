/* ==========================================================================
   reports.js — weekly / monthly / yearly reports + export
   ========================================================================== */

const Reports = (() => {

  function statementTable(rows, kind) {
    const wrap = Utils.el('div', { class: 'table-wrap' });
    if (!rows.length) { wrap.appendChild(Utils.el('div', { class: 'table-empty' }, 'No data for this period.')); return wrap; }
    const periodLabel = kind === 'week' ? 'Week' : kind === 'month' ? 'Month' : 'Year';
    const paginated = Utils.paginate(rows, 1, 20);
    const table = Utils.el('table', {}, Utils.el('thead', {}, Utils.el('tr', {}, [
      periodLabel, 'Milk Qty', 'Bill Amount', 'Previous Balance', 'Payments', 'Total Payable', 'Balance', 'Status'
    ].map((h, i) => Utils.el('th', { class: i > 0 && i < 7 ? 'num' : '' }, h)))));
    const tbody = Utils.el('tbody');

    function renderRows(items) {
      tbody.innerHTML = '';
      items.forEach(r => {
        const label = kind === 'week' ? `Week ${r.weekNumber} (${Utils.formatDate(r.start)}–${Utils.formatDate(r.end)})`
          : kind === 'month' ? r.label : r.year;
        tbody.appendChild(Utils.el('tr', {}, [
          Utils.el('td', {}, label),
          Utils.el('td', { class: 'num' }, Utils.qty(r.qty)),
          Utils.el('td', { class: 'num' }, Utils.money(r.currentBill)),
          Utils.el('td', { class: 'num' }, Utils.money(r.previousBalance)),
          Utils.el('td', { class: 'num' }, Utils.money(r.paymentsReceived)),
          Utils.el('td', { class: 'num' }, Utils.money(r.totalPayable)),
          Utils.el('td', { class: 'num', style: r.remaining > 0 ? 'color:var(--danger)' : 'color:var(--success)' }, Utils.money(r.remaining)),
          Utils.el('td', {}, Utils.el('span', { class: `badge badge--${r.status.toLowerCase()}` }, r.status))
        ]));
      });
    }

    renderRows(paginated.items);
    table.appendChild(tbody);
    wrap.appendChild(table);
    wrap.appendChild(Utils.paginationControls(paginated, (p) => {
      const np = Utils.paginate(rows, p, 20);
      renderRows(np.items);
      wrap.replaceChild(Utils.paginationControls(np, arguments.callee), wrap.querySelector('.pagination'));
    }));
    return wrap;
  }

  function customerSelector(onChange, currentId) {
    const customers = Store.Customers.all();
    const sel = Utils.el('select', { id: 'reportCustSelect' }, [
      Utils.el('option', { value: '' }, 'All Customers (business totals)'),
      ...customers.map(c => Utils.el('option', { value: c.id, ...(currentId === c.id ? { selected: 'selected' } : {}) }, c.name))
    ]);
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }

  function earliestDate() {
    const dates = Store.Entries.all().map(e => e.date);
    return dates.length ? dates.sort()[0] : Utils.todayISO();
  }

  function buildReportView(container, kind, title) {
    container.innerHTML = '';
    let selectedCustomer = '';

    container.appendChild(Utils.el('div', { class: 'view-head' }, [
      Utils.el('div', {}, [Utils.el('h1', {}, title), Utils.el('div', { class: 'sub' }, 'Automatically generated from recorded entries and payments')]),
      Utils.el('div', { class: 'view-actions', id: 'reportActions' })
    ]));

    const summary = Utils.el('div', { id: 'reportSummary', class: 'grid grid-cards' });
    container.appendChild(summary);

    const filters = Utils.el('div', { class: 'filters' });
    container.appendChild(filters);
    const body = Utils.el('div', { id: 'reportBody' });
    container.appendChild(body);

    function draw() {
      filters.innerHTML = '';
      filters.appendChild(customerSelector(v => { selectedCustomer = v; draw(); }, selectedCustomer));
      document.getElementById('reportActions').innerHTML = '';
      document.getElementById('reportActions').appendChild(
        Utils.el('button', { class: 'btn btn--sm', onclick: () => exportCurrent(kind, selectedCustomer) }, '⬇ Export CSV')
      );

      body.innerHTML = '';
      if (!Store.Customers.all().length) { body.appendChild(Utils.el('div', { class: 'table-empty' }, 'No customers yet.')); return; }
      const from = earliestDate();
      const to = Utils.todayISO();

      // Summary stats
      const totalEntries = Store.Entries.inRange(from, to);
      const totalPayments = Store.Payments.inRange(from, to);
      const entriesSum = Billing.sumEntries(totalEntries);
      const paymentsSum = Billing.sumPayments(totalPayments);
      const avgRate = totalEntries.length ? totalEntries.reduce((s, e) => s + e.rate, 0) / totalEntries.length : 0;

      let topCustomer = null;
      if (!selectedCustomer) {
        const custBalances = Store.Customers.all().map(c => ({
          name: c.name,
          bal: Billing.outstandingAsOf(c.id, to)
        })).filter(x => x.bal > 0).sort((a, b) => b.bal - a.bal);
        topCustomer = custBalances.length ? custBalances[0] : null;
      }

      summary.innerHTML = '';
      summary.appendChild(Utils.el('div', { class: 'card stat-card accent-forest' }, [
        Utils.el('span', { class: 'stat-label' }, 'Total Milk'),
        Utils.el('div', { class: 'stat-value' }, Utils.qty(entriesSum.qty))
      ]));
      summary.appendChild(Utils.el('div', { class: 'card stat-card accent-gold' }, [
        Utils.el('span', { class: 'stat-label' }, 'Total Revenue'),
        Utils.el('div', { class: 'stat-value' }, Utils.money(entriesSum.amount))
      ]));
      summary.appendChild(Utils.el('div', { class: 'card stat-card accent-gold' }, [
        Utils.el('span', { class: 'stat-label' }, 'Total Payments'),
        Utils.el('div', { class: 'stat-value' }, Utils.money(paymentsSum))
      ]));
      summary.appendChild(Utils.el('div', { class: 'card stat-card accent-forest' }, [
        Utils.el('span', { class: 'stat-label' }, 'Avg Rate'),
        Utils.el('div', { class: 'stat-value' }, Utils.money(avgRate))
      ]));
      if (topCustomer) {
        summary.appendChild(Utils.el('div', { class: 'card stat-card accent-danger' }, [
          Utils.el('span', { class: 'stat-label' }, 'Top Defaulter'),
          Utils.el('div', { class: 'stat-value' }, `${topCustomer.name}: ${Utils.money(topCustomer.bal)}`)
        ]));
      }

      if (selectedCustomer) {
        const rows = (kind === 'week' ? Billing.weeklyReport(selectedCustomer, from, to)
          : kind === 'month' ? Billing.monthlyReport(selectedCustomer, from, to)
          : Billing.yearlyReport(selectedCustomer, from, to)).reverse();
        body.appendChild(statementTable(rows, kind));
      } else {
        // business-wide totals grouped by period
        body.appendChild(businessWideTable(kind, from, to));
      }
    }
    draw();
  }

  function periodsBetween(kind, from, to) {
    const periods = [];
    if (kind === 'week') {
      let cursor = Utils.weekBounds(from).start;
      const last = Utils.weekBounds(to).start;
      while (cursor <= last) { const { start, end } = Utils.weekBounds(cursor); periods.push({ start, end, label: `Week ${Utils.weekNumber(start)} (${Utils.formatDate(start)}–${Utils.formatDate(end)})` }); cursor = Utils.addDays(cursor, 7); }
    } else if (kind === 'month') {
      let cursor = Utils.monthBounds(from).start;
      const last = Utils.monthBounds(to).start;
      while (cursor <= last) { const { start, end } = Utils.monthBounds(cursor); periods.push({ start, end, label: Utils.monthName(start) }); const n = new Date(Utils.parseISO(start)); n.setMonth(n.getMonth() + 1); cursor = Utils.dateToISO(n); }
    } else {
      let cursor = Utils.yearBounds(from).start;
      const last = Utils.yearBounds(to).start;
      while (cursor <= last) { const { start, end } = Utils.yearBounds(cursor); periods.push({ start, end, label: start.slice(0, 4) }); cursor = `${Number(start.slice(0, 4)) + 1}-01-01`; }
    }
    return periods.reverse();
  }

  function businessWideTable(kind, from, to) {
    const periods = periodsBetween(kind, from, to);
    const paginated = Utils.paginate(periods, 1, 20);
    const wrap = Utils.el('div', { class: 'table-wrap' });
    if (!periods.length) { wrap.appendChild(Utils.el('div', { class: 'table-empty' }, 'No data yet.')); return wrap; }
    const table = Utils.el('table', {}, Utils.el('thead', {}, Utils.el('tr', {}, [
      kind === 'week' ? 'Week' : kind === 'month' ? 'Month' : 'Year', 'Total Milk', 'Total Billed', 'Payments Received', 'Entries'
    ].map((h, i) => Utils.el('th', { class: i > 0 ? 'num' : '' }, h)))));
    const tbody = Utils.el('tbody');

    function renderRows(items) {
      tbody.innerHTML = '';
      items.forEach(p => {
        const agg = Billing.aggregateRange(p.start, p.end);
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
    wrap.appendChild(Utils.paginationControls(paginated, (p) => {
      const np = Utils.paginate(periods, p, 20);
      renderRows(np.items);
      wrap.replaceChild(Utils.paginationControls(np, arguments.callee), wrap.querySelector('.pagination'));
    }));
    return wrap;
  }

  function exportCurrent(kind, customerId) {
    const from = earliestDate(); const to = Utils.todayISO();
    let rows, headers, csvRows;
    if (customerId) {
      const cust = Store.Customers.get(customerId);
      rows = (kind === 'week' ? Billing.weeklyReport(customerId, from, to) : kind === 'month' ? Billing.monthlyReport(customerId, from, to) : Billing.yearlyReport(customerId, from, to));
      headers = ['Period', 'Milk Qty', 'Bill Amount', 'Previous Balance', 'Payments', 'Total Payable', 'Balance', 'Status'];
      csvRows = rows.map(r => [r.label || r.year || `Week ${r.weekNumber}`, r.qty, r.currentBill, r.previousBalance, r.paymentsReceived, r.totalPayable, r.remaining, r.status]);
      Utils.downloadFile(`${cust.name}_${kind}ly_report.csv`, Utils.toCSV(csvRows, headers), 'text/csv');
    } else {
      const periods = periodsBetween(kind, from, to);
      headers = ['Period', 'Total Milk', 'Total Billed', 'Payments Received', 'Entries'];
      csvRows = periods.map(p => { const agg = Billing.aggregateRange(p.start, p.end); return [p.label, agg.qty, agg.amount, agg.paid, agg.entriesCount]; });
      Utils.downloadFile(`business_${kind}ly_report.csv`, Utils.toCSV(csvRows, headers), 'text/csv');
    }
    Utils.toast('Report exported as CSV.', 'success');
  }

  const renderWeekly = c => buildReportView(c, 'week', 'Weekly Report');
  const renderMonthly = c => buildReportView(c, 'month', 'Monthly Report');
  const renderYearly = c => buildReportView(c, 'year', 'Yearly Report');

  return { statementTable, renderWeekly, renderMonthly, renderYearly };
})();