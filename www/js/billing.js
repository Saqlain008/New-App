/* ==========================================================================
   billing.js — the math: period totals + running (carry-forward) balances
   ========================================================================== */

const Billing = (() => {

  /** Sum of milk quantity + amount for a set of entries */
  function sumEntries(entries) {
    return entries.reduce((acc, e) => {
      acc.qty += Number(e.total || 0);
      acc.amount += Number(e.amount || 0);
      return acc;
    }, { qty: 0, amount: 0 });
  }

  function sumPayments(payments) {
    return payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  }

  /**
   * Outstanding balance for a customer as of a given date (inclusive) =
   * total billed up to that date minus total paid up to that date.
   * This is what naturally implements "carry forward forever until paid".
   */
  function outstandingAsOf(customerId, date) {
    const billed = sumEntries(Store.Entries.upTo(date, customerId)).amount;
    const paid = sumPayments(Store.Payments.upTo(date, customerId));
    return +(billed - paid).toFixed(2);
  }

  /** Lifetime totals (no date bound) */
  function lifetime(customerId) {
    const billed = sumEntries(Store.Entries.forCustomer(customerId)).amount;
    const qtyTotal = sumEntries(Store.Entries.forCustomer(customerId)).qty;
    const paid = sumPayments(Store.Payments.forCustomer(customerId));
    return { qty: qtyTotal, billed, paid, balance: +(billed - paid).toFixed(2) };
  }

  /**
   * Full period statement for a customer between start..end (inclusive):
   * previous balance (carried in), this period's bill, payments received
   * in period, total payable, remaining balance, status.
   */
  function periodStatement(customerId, start, end) {
    const periodEntries = Store.Entries.inRange(start, end, customerId);
    const periodPayments = Store.Payments.inRange(start, end, customerId);
    const { qty, amount: currentBill } = sumEntries(periodEntries);
    const paymentsReceived = sumPayments(periodPayments);
    const previousBalance = outstandingAsOf(customerId, Utils.addDays(start, -1));
    const totalPayable = +(previousBalance + currentBill).toFixed(2);
    const remaining = +(totalPayable - paymentsReceived).toFixed(2);
    let status = 'Unpaid';
    if (remaining <= 0) status = 'Paid';
    else if (paymentsReceived > 0) status = 'Partial';
    return {
      customerId, start, end, qty, currentBill, previousBalance,
      totalPayable, paymentsReceived, remaining, status,
      entries: periodEntries, payments: periodPayments
    };
  }

  /** Weekly report rows for a customer across a date range (defaults: all recorded weeks) */
  function weeklyReport(customerId, fromDate, toDate) {
    const rows = [];
    let cursor = Utils.weekBounds(fromDate).start;
    const lastWeekStart = Utils.weekBounds(toDate).start;
    while (cursor <= lastWeekStart) {
      const { start, end } = Utils.weekBounds(cursor);
      const stmt = periodStatement(customerId, start, end);
      if (stmt.qty > 0 || stmt.paymentsReceived > 0 || stmt.previousBalance !== 0) {
        rows.push({ ...stmt, weekNumber: Utils.weekNumber(start), carryForward: stmt.remaining });
      }
      cursor = Utils.addDays(cursor, 7);
    }
    return rows;
  }

  function monthlyReport(customerId, fromDate, toDate) {
    const rows = [];
    let cursor = Utils.monthBounds(fromDate).start;
    const lastMonthStart = Utils.monthBounds(toDate).start;
    while (cursor <= lastMonthStart) {
      const { start, end } = Utils.monthBounds(cursor);
      const stmt = periodStatement(customerId, start, end);
      const daysInMonth = (Utils.parseISO(end) - Utils.parseISO(start)) / 86400000 + 1;
      rows.push({
        ...stmt,
        label: Utils.monthName(start),
        avgQty: stmt.qty ? +(stmt.qty / daysInMonth).toFixed(2) : 0,
        rateUsed: Store.Rates.rateOn(end)
      });
      const next = new Date(Utils.parseISO(start));
      next.setMonth(next.getMonth() + 1);
      cursor = Utils.dateToISO(next);
    }
    return rows;
  }

  function yearlyReport(customerId, fromDate, toDate) {
    const rows = [];
    let cursor = Utils.yearBounds(fromDate).start;
    const lastYearStart = Utils.yearBounds(toDate).start;
    while (cursor <= lastYearStart) {
      const { start, end } = Utils.yearBounds(cursor);
      const stmt = periodStatement(customerId, start, end);
      rows.push({ ...stmt, year: start.slice(0, 4) });
      cursor = `${Number(start.slice(0, 4)) + 1}-01-01`;
    }
    return rows;
  }

  /** Aggregate (all customers) totals for a date range — used by dashboard/reports */
  function aggregateRange(start, end) {
    const entries = Store.Entries.inRange(start, end);
    const payments = Store.Payments.inRange(start, end);
    const { qty, amount } = sumEntries(entries);
    const paid = sumPayments(payments);
    return { qty, amount, paid, entriesCount: entries.length };
  }

  function totalOutstandingAll(date = Utils.todayISO()) {
    return Store.Customers.all().reduce((sum, c) => sum + Math.max(0, outstandingAsOf(c.id, date)), 0);
  }

  return {
    sumEntries, sumPayments, outstandingAsOf, lifetime, periodStatement,
    weeklyReport, monthlyReport, yearlyReport, aggregateRange, totalOutstandingAll
  };
})();
