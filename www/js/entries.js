/* ==========================================================================
   entries.js — daily milk entry recording with date-wise grouping
   ========================================================================== */

const EntriesView = (() => {

  var currentFilter = 'today';
  var sortOrder = 'newest';
  var currentPage = 1;

  function render(container) {
    container.innerHTML = '';
    var customers = Store.Customers.all().filter(function(c) { return c.status === 'active'; });

    container.appendChild(Utils.el('div', { class: 'view-head' }, [
      Utils.el('div', {}, [
        Utils.el('h1', {}, 'Daily Milk Entry'),
        Utils.el('div', { class: 'sub' }, 'Record morning and evening collection for each customer')
      ]),
      Utils.el('div', { class: 'view-actions' }, [
        Utils.el('button', { class: 'btn btn--primary', onclick: function() { openForm(); } }, '+ New Entry')
      ])
    ]));

    if (!Store.Rates.all().length) {
      container.appendChild(Utils.el('div', { class: 'panel', style: 'border-left:4px solid var(--warn)' },
        Utils.el('p', { style: 'margin:0' }, 'No milk rate set yet. Add a rate first.')));
    }
    if (!customers.length) {
      container.appendChild(Utils.el('div', { class: 'panel', style: 'border-left:4px solid var(--warn)' },
        Utils.el('p', { style: 'margin:0' }, 'No active customers yet. Add a customer first.')));
    }

    var filters = Utils.el('div', { class: 'filters' }, [
      Utils.el('div', { class: 'chip-group', id: 'entryChips' },
        [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This Week'], ['lastweek', 'Last Week'], ['month', 'This Month'], ['all', 'All Time']]
          .map(function(pair) {
            return Utils.el('button', {
              class: 'chip' + (currentFilter === pair[0] ? ' is-active' : ''),
              onclick: function() { currentFilter = pair[0]; currentPage = 1; render(container); }
            }, pair[1]);
          })
      ),
      Utils.el('input', { type: 'text', placeholder: 'Filter by customer name...', id: 'entrySearch' }),
      Utils.el('select', { id: 'entrySort', style: 'margin-left:auto' }, [
        Utils.el('option', { value: 'newest' }, 'Newest First'),
        Utils.el('option', { value: 'oldest' }, 'Oldest First')
      ])
    ]);
    container.appendChild(filters);

    var contentArea = Utils.el('div', { id: 'entryContent' });
    container.appendChild(contentArea);
    drawContent(contentArea);

    document.getElementById('entrySearch').addEventListener('input', Utils.debounce(function() { currentPage = 1; drawContent(contentArea); }, 150));
    document.getElementById('entrySort').addEventListener('change', function() {
      sortOrder = document.getElementById('entrySort').value;
      currentPage = 1;
      drawContent(contentArea);
    });
  }

  function rangeForFilter() {
    var t = Utils.todayISO();
    if (currentFilter === 'today') return { start: t, end: t };
    if (currentFilter === 'yesterday') { var y = Utils.addDays(t, -1); return { start: y, end: y }; }
    if (currentFilter === 'week') return Utils.weekBounds(t);
    if (currentFilter === 'lastweek') { var w = Utils.weekBounds(Utils.addDays(t, -7)); return w; }
    if (currentFilter === 'month') return Utils.monthBounds(t);
    return { start: '0000-01-01', end: '9999-12-31' };
  }

  function drawContent(contentArea) {
    var range = rangeForFilter();
    var start = range.start, end = range.end;
    var searchInput = document.getElementById('entrySearch');
    var q = searchInput ? searchInput.value.toLowerCase() : '';
    var custMap = {};
    Store.Customers.all().forEach(function(c) { custMap[c.id] = c; });
    var rows = Store.Entries.inRange(start, end);
    if (q) {
      rows = rows.filter(function(e) {
        var name = custMap[e.customerId] ? custMap[e.customerId].name : '';
        return name.toLowerCase().includes(q);
      });
    }

    contentArea.innerHTML = '';
    if (!rows.length) {
      contentArea.appendChild(Utils.el('div', { class: 'table-empty' }, 'No entries in this period.'));
      return;
    }

    var desc = sortOrder === 'newest';
    var dateGroups = Utils.groupByDate(rows, desc);
    var paginated = Utils.paginate(dateGroups, currentPage, 10);
    currentPage = paginated.page;

    paginated.items.forEach(function(group) {
      var totalQty = 0, totalAmt = 0;
      group.entries.forEach(function(e) { totalQty += (e.total || 0); totalAmt += (e.amount || 0); });

      var entryRows = group.entries.map(function(e) {
        var cust = custMap[e.customerId];
        return Utils.el('div', { class: 'date-group__row' }, [
          Utils.el('span', { class: 'cust-name' }, cust ? cust.name : '(deleted)'),
          Utils.el('div', { class: 'entry-detail' }, [
            Utils.el('span', {}, ['Morning: ', Utils.el('span', { class: 'val' }, (e.morning || 0) + ' L')]),
            Utils.el('span', {}, ['Evening: ', Utils.el('span', { class: 'val' }, (e.evening || 0) + ' L')]),
            Utils.el('span', {}, ['Total: ', Utils.el('span', { class: 'val' }, Utils.qty(e.total))]),
            e.notes ? Utils.el('span', { style: 'color:var(--muted);font-size:11px' }, e.notes) : null
          ]),
          Utils.el('span', { class: 'entry-amount' }, [
            Utils.el('div', { style: 'font-size:11px;color:var(--muted)' }, 'Rate: ' + Utils.money(e.rate)),
            Utils.el('div', {}, Utils.money(e.amount))
          ]),
          Utils.el('div', { class: 'row-actions' }, [
            Utils.el('button', { class: 'btn btn--sm', onclick: function() { openForm(e); } }, 'Edit'),
            Utils.el('button', { class: 'btn btn--sm btn--danger', onclick: function() {
              if (Utils.confirmDialog('Delete this entry?')) { Store.Entries.remove(e.id); App.rerender(); }
            } }, 'Del')
          ])
        ]);
      });

      var groupEl = Utils.el('div', { class: 'date-group' }, [
        Utils.el('div', { class: 'date-group__head' }, [
          Utils.el('div', {}, [
            Utils.el('h3', {}, Utils.formatDateHeading(group.date)),
            Utils.el('span', { class: 'day-name' }, Utils.dayName(group.date))
          ]),
          Utils.el('div', { style: 'text-align:right;font-size:12px;color:var(--muted)' },
            group.entries.length + ' customer' + (group.entries.length > 1 ? 's' : ''))
        ]),
        Utils.el('div', { class: 'date-group__body' }, entryRows),
        Utils.el('div', { class: 'date-group__total' }, [
          Utils.el('span', {}, 'Total Milk: ' + Utils.qty(totalQty)),
          Utils.el('span', {}, 'Total Amount: ' + Utils.money(totalAmt))
        ])
      ]);
      contentArea.appendChild(groupEl);
    });

    contentArea.appendChild(Utils.paginationControls(paginated, function(p) {
      currentPage = p;
      drawContent(contentArea);
      contentArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function openForm(existing) {
    var isEdit = !!existing;
    var allCusts = Store.Customers.all();
    var customers = allCusts.filter(function(c) { return c.status === 'active' || (existing && c.id === existing.customerId); });
    if (!customers.length) { Utils.toast('Add a customer first.', 'error'); return; }

    var body = Utils.el('form', { class: 'form-grid', id: 'entryForm' }, [
      Utils.el('div', { class: 'field field--full' }, [
        Utils.el('label', {}, 'Customer *'),
        Utils.el('select', { name: 'customerId', required: 'required' },
          customers.map(function(c) {
            return Utils.el('option', {
              value: c.id,
              selected: existing && existing.customerId === c.id ? 'selected' : undefined
            }, c.name + ' (Rate: ' + Utils.money(c.rate || Store.Rates.current()) + ')');
          }))
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'Date *'),
        Utils.el('input', { type: 'date', name: 'date', value: existing ? existing.date : Utils.todayISO(), required: 'required' })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'Rate'),
        Utils.el('input', { type: 'text', disabled: 'disabled', id: 'rateHint', value: '--' })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'Morning (L)'),
        Utils.el('input', { type: 'number', name: 'morning', min: '0', step: '0.01', value: existing ? existing.morning : '' })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'Evening (L)'),
        Utils.el('input', { type: 'number', name: 'evening', min: '0', step: '0.01', value: existing ? existing.evening : '' })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'OR Total (L)'),
        Utils.el('input', { type: 'number', name: 'total', min: '0', step: '0.01', placeholder: 'Overrides morning+evening',
          value: existing && existing.total !== existing.morning + existing.evening ? existing.total : '' })
      ]),
      Utils.el('div', { class: 'field field--full' }, [
        Utils.el('label', {}, 'Notes'),
        Utils.el('input', { type: 'text', name: 'notes', value: existing ? existing.notes : '' })
      ]),
      Utils.el('div', { class: 'form-actions field--full' }, [
        Utils.el('button', { type: 'button', class: 'btn', onclick: function() { App.closeModal(); } }, 'Cancel'),
        Utils.el('button', { type: 'submit', class: 'btn btn--primary' }, isEdit ? 'Save Changes' : 'Add Entry')
      ])
    ]);

    App.openModal(isEdit ? 'Edit Daily Entry' : 'New Daily Entry', body);

    var dateInput = body.querySelector('[name="date"]');
    var custSelect = body.querySelector('[name="customerId"]');
    var rateHint = function() {
      var cid = custSelect.value;
      var date = dateInput.value;
      var cust = Store.Customers.get(cid);
      var rate = cust && cust.rate ? cust.rate : Store.Rates.rateOn(date);
      document.getElementById('rateHint').value = Utils.money(rate);
    };
    dateInput.addEventListener('change', rateHint);
    custSelect.addEventListener('change', rateHint);
    rateHint();

    document.getElementById('entryForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(e.target).entries());
      var morning = Number(data.morning || 0);
      var evening = Number(data.evening || 0);
      var total = data.total !== '' ? Number(data.total) : null;
      if (morning < 0 || evening < 0 || (total !== null && total < 0)) { Utils.toast('Quantity cannot be negative.', 'error'); return; }
      if (!data.date) { Utils.toast('Please choose a valid date.', 'error'); return; }
      if (total === null && morning === 0 && evening === 0) { Utils.toast('Enter morning/evening or a total quantity.', 'error'); return; }
      var payload = { customerId: data.customerId, date: data.date, morning: morning, evening: evening, total: total === null ? '' : total, notes: data.notes };
      if (isEdit) {
        Store.Entries.update(existing.id, payload);
        Utils.toast('Entry updated.', 'success');
      } else {
        Store.Entries.add(payload);
        Utils.toast('Daily entry saved.', 'success');
      }
      App.closeModal();
      App.rerender();
    });
  }

  return { render: render, openForm: openForm };
})();