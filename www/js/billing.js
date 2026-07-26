/* ==========================================================================
   billing.js — the math: period totals + running (carry-forward) balances
   ========================================================================== */

const Billing = (() => {

  /** Sum of milk quantity + amount for a set of entries */
  function sumEntries(entries) {
    return entries.reduce(function(acc, e) {
      acc.qty += Number(e.total || 0);
      acc.amount += Number(e.amount || 0);
      return acc;
    }, { qty: 0, amount: 0 });
  }

  function sumPayments(payments) {
    return payments.reduce(function(acc, p) { return acc + Number(p.amount || 0); }, 0);
  }

  /**
   * Outstanding balance for a customer as of a given date (inclusive)
   * Uses each entry's own rate which is already per-customer
   */
  function outstandingAsOf(customerId, date) {
    var billed = sumEntries(Store.Entries.upTo(date, customerId)).amount;
    var paid = sumPayments(Store.Payments.upTo(date, customerId));
    return +(billed - paid).toFixed(2);
  }

  /** Lifetime totals (no date bound) */
  function lifetime(customerId) {
    var custEntries = Store.Entries.forCustomer(customerId);
    var billed = sumEntries(custEntries).amount;
    var qtyTotal = sumEntries(custEntries).qty;
    var paid = sumPayments(Store.Payments.forCustomer(customerId));
    return { qty: qtyTotal, billed: billed, paid: paid, balance: +(billed - paid).toFixed(2) };
  }

  /**
   * Full period statement for a customer between start..end (inclusive)
   * Each entry uses its own stored rate (per-customer rate captured at entry time)
   */
  function periodStatement(customerId, start, end) {
    var periodEntries = Store.Entries.inRange(start, end, customerId);
    var periodPayments = Store.Payments.inRange(start, end, customerId);
    var s = sumEntries(periodEntries);
    var qty = s.qty, currentBill = s.amount;
    var paymentsReceived = sumPayments(periodPayments);
    var previousBalance = outstandingAsOf(customerId, Utils.addDays(start, -1));
    var totalPayable = +(previousBalance + currentBill).toFixed(2);
    var remaining = +(totalPayable - paymentsReceived).toFixed(2);
    var status = 'Unpaid';
    if (remaining <= 0) status = 'Paid';
    else if (paymentsReceived > 0) status = 'Partial';
    return {
      customerId: customerId, start: start, end: end,
      qty: qty, currentBill: currentBill, previousBalance: previousBalance,
      totalPayable: totalPayable, paymentsReceived: paymentsReceived,
      remaining: remaining, status: status,
      entries: periodEntries, payments: periodPayments
    };
  }

  /** Weekly report rows for a customer across a date range */
  function weeklyReport(customerId, fromDate, toDate) {
    var rows = [];
    var cursor = Utils.weekBounds(fromDate).start;
    var lastWeekStart = Utils.weekBounds(toDate).start;
    while (cursor <= lastWeekStart) {
      var b = Utils.weekBounds(cursor);
      var stmt = periodStatement(customerId, b.start, b.end);
      if (stmt.qty > 0 || stmt.paymentsReceived > 0 || stmt.previousBalance !== 0) {
        rows.push({ ...stmt, weekNumber: Utils.weekNumber(b.start), carryForward: stmt.remaining });
      }
      cursor = Utils.addDays(cursor, 7);
    }
    return rows;
  }

  function monthlyReport(customerId, fromDate, toDate) {
    var rows = [];
    var cursor = Utils.monthBounds(fromDate).start;
    var lastMonthStart = Utils.monthBounds(toDate).start;
    while (cursor <= lastMonthStart) {
      var b = Utils.monthBounds(cursor);
      var stmt = periodStatement(customerId, b.start, b.end);
      var daysInMonth = (Utils.parseISO(b.end) - Utils.parseISO(b.start)) / 86400000 + 1;
      rows.push({
        ...stmt,
        label: Utils.monthName(b.start),
        avgQty: stmt.qty ? +(stmt.qty / daysInMonth).toFixed(2) : 0,
        rateUsed: Store.Rates.rateOn(b.end)
      });
      var next = new Date(Utils.parseISO(b.start));
      next.setMonth(next.getMonth() + 1);
      cursor = Utils.dateToISO(next);
    }
    return rows;
  }

  function yearlyReport(customerId, fromDate, toDate) {
    var rows = [];
    var cursor = Utils.yearBounds(fromDate).start;
    var lastYearStart = Utils.yearBounds(toDate).start;
    while (cursor <= lastYearStart) {
      var b = Utils.yearBounds(cursor);
      var stmt = periodStatement(customerId, b.start, b.end);
      rows.push({ ...stmt, year: b.start.slice(0, 4) });
      cursor = (Number(b.start.slice(0, 4)) + 1) + '-01-01';
    }
    return rows;
  }

  /** Aggregate (all customers) totals for a date range */
  function aggregateRange(start, end) {
    var entries = Store.Entries.inRange(start, end);
    var payments = Store.Payments.inRange(start, end);
    var s = sumEntries(entries);
    return { qty: s.qty, amount: s.amount, paid: sumPayments(payments), entriesCount: entries.length };
  }

  function totalOutstandingAll(date) {
    if (!date) date = Utils.todayISO();
    return Store.Customers.all().reduce(function(sum, c) {
      return sum + Math.max(0, outstandingAsOf(c.id, date));
    }, 0);
  }

  return {
    sumEntries: sumEntries,
    sumPayments: sumPayments,
    outstandingAsOf: outstandingAsOf,
    lifetime: lifetime,
    periodStatement: periodStatement,
    weeklyReport: weeklyReport,
    monthlyReport: monthlyReport,
    yearlyReport: yearlyReport,
    aggregateRange: aggregateRange,
    totalOutstandingAll: totalOutstandingAll
  };
})();