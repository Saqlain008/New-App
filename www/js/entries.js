/* ==========================================================================
   entries.js — daily milk entry recording
   ========================================================================== */

const EntriesView = (() => {

  let currentFilter = 'today';

  function render(container) {
    container.innerHTML = '';
    const customers = Store.Customers.all().filter(c => c.status === 'active');

    container.appendChild(Utils.el('div', { class: 'view-head' }, [
      Utils.el('div', {}, [
        Utils.el('h1', {}, 'Daily Milk Entry'),
        Utils.el('div', { class: 'sub' }, 'Record morning and evening collection for each customer')
      ]),
      Utils.el('div', { class: 'view-actions' }, [
        Utils.el('button', { class: 'btn btn--primary', onclick: () => openForm() }, '+ New Entry')
      ])
    ]));

    if (!Store.Rates.all().length) {
      container.appendChild(Utils.el('div', { class: 'panel', style: 'border-left:4px solid var(--warn)' },
        Utils.el('p', { style: 'margin:0' }, '⚠ No milk rate has been set yet. Please add a rate in "Milk Rates" before recording entries — amounts will be calculated as Rs. 0 until then.')));
    }
    if (!customers.length) {
      container.appendChild(Utils.el('div', { class: 'panel', style: 'border-left:4px solid var(--warn)' },
        Utils.el('p', { style: 'margin:0' }, '⚠ No active customers yet. Add a customer first from the Customers page.')));
    }

    const filters = Utils.el('div', { class: 'filters' }, [
      Utils.el('div', { class: 'chip-group', id: 'entryChips' },
        [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This Week'], ['lastweek', 'Last Week'], ['month', 'This Month'], ['all', 'All Time']]
          .map(([k, l]) => Utils.el('button', { class: `chip${currentFilter === k ? ' is-active' : ''}`, onclick: () => { currentFilter = k; render(container); } }, l))
      ),
      Utils.el('input', { type: 'text', placeholder: 'Filter by customer name…', id: 'entrySearch' })
    ]);
    container.appendChild(filters);

    const tableWrap = Utils.el('div', { class: 'table-wrap' });
    container.appendChild(tableWrap);
    drawTable(tableWrap);

    document.getElementById('entrySearch').addEventListener('input', Utils.debounce(() => drawTable(tableWrap), 150));
  }

  function rangeForFilter() {
    const t = Utils.todayISO();
    if (currentFilter === 'today') return { start: t, end: t };
    if (currentFilter === 'yesterday') { const y = Utils.addDays(t, -1); return { start: y, end: y }; }
    if (currentFilter === 'week') return Utils.weekBounds(t);
    if (currentFilter === 'lastweek') { const w = Utils.weekBounds(Utils.addDays(t, -7)); return w; }
    if (currentFilter === 'month') return Utils.monthBounds(t);
    return { start: '0000-01-01', end: '9999-12-31' };
  }

  function drawTable(tableWrap) {
    const { start, end } = rangeForFilter();
    const q = (document.getElementById('entrySearch')?.value || '').toLowerCase();
    const custMap = Object.fromEntries(Store.Customers.all().map(c => [c.id, c]));
    let rows = Store.Entries.inRange(start, end).sort((a, b) => b.date.localeCompare(a.date) || (custMap[b.customerId]?.name || '').localeCompare(custMap[a.customerId]?.name || ''));
    if (q) rows = rows.filter(e => (custMap[e.customerId]?.name || '').toLowerCase().includes(q));

    tableWrap.innerHTML = '';
    if (!rows.length) {
      tableWrap.appendChild(Utils.el('div', { class: 'table-empty' }, 'No entries in this period.'));
      return;
    }
    const totals = rows.reduce((a, e) => { a.qty += e.total; a.amount += e.amount; return a; }, { qty: 0, amount: 0 });

    const table = Utils.el('table', {}, Utils.el('thead', {}, Utils.el('tr', {}, [
      'Date', 'Customer', 'Morning', 'Evening', 'Total', 'Rate', 'Amount', 'Notes', ''
    ].map((h, i) => Utils.el('th', { class: (i >= 2 && i <= 6) ? 'num' : '' }, h)))));
    const tbody = Utils.el('tbody');
    rows.forEach(e => {
      const cust = custMap[e.customerId];
      tbody.appendChild(Utils.el('tr', {}, [
        Utils.el('td', {}, Utils.formatDate(e.date)),
        Utils.el('td', { style: 'font-weight:600' }, cust ? cust.name : '(deleted customer)'),
        Utils.el('td', { class: 'num' }, e.morning || 0),
        Utils.el('td', { class: 'num' }, e.evening || 0),
        Utils.el('td', { class: 'num' }, Utils.qty(e.total)),
        Utils.el('td', { class: 'num' }, Utils.money(e.rate)),
        Utils.el('td', { class: 'num' }, Utils.money(e.amount)),
        Utils.el('td', {}, e.notes || '—'),
        Utils.el('td', {}, Utils.el('div', { class: 'row-actions' }, [
          Utils.el('button', { class: 'btn btn--sm', onclick: () => openForm(e) }, 'Edit'),
          Utils.el('button', { class: 'btn btn--sm btn--danger', onclick: () => { if (Utils.confirmDialog('Delete this entry?')) { Store.Entries.remove(e.id); App.rerender(); } } }, 'Del')
        ]))
      ]));
    });
    const tfoot = Utils.el('tfoot', {}, Utils.el('tr', { style: 'font-weight:800;background:var(--forest-dim)' }, [
      Utils.el('td', { colspan: '4' }, 'Total'),
      Utils.el('td', { class: 'num' }, Utils.qty(totals.qty)),
      Utils.el('td', {}),
      Utils.el('td', { class: 'num' }, Utils.money(totals.amount)),
      Utils.el('td', { colspan: '2' })
    ]));
    table.appendChild(tbody);
    table.appendChild(tfoot);
    tableWrap.appendChild(table);
  }

  function openForm(existing) {
    const isEdit = !!existing;
    const customers = Store.Customers.all().filter(c => c.status === 'active' || (existing && c.id === existing.customerId));
    if (!customers.length) { Utils.toast('Add a customer first.', 'error'); return; }

    const body = Utils.el('form', { class: 'form-grid', id: 'entryForm' }, [
      Utils.el('div', { class: 'field field--full' }, [
        Utils.el('label', {}, 'Customer *'),
        Utils.el('select', { name: 'customerId', required: 'required' },
          customers.map(c => Utils.el('option', { value: c.id, ...(existing?.customerId === c.id ? { selected: 'selected' } : {}) }, c.name)))
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'Date *'),
        Utils.el('input', { type: 'date', name: 'date', value: existing?.date || Utils.todayISO(), max: Utils.todayISO(), required: 'required' })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, `Rate on this date`),
        Utils.el('input', { type: 'text', disabled: 'disabled', id: 'rateHint', value: '—' })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'Morning Milk (L)'),
        Utils.el('input', { type: 'number', name: 'morning', min: '0', step: '0.01', value: existing?.morning ?? '' })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'Evening Milk (L)'),
        Utils.el('input', { type: 'number', name: 'evening', min: '0', step: '0.01', value: existing?.evening ?? '' })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'OR Total Milk (L)'),
        Utils.el('input', { type: 'number', name: 'total', min: '0', step: '0.01', placeholder: 'Overrides morning+evening', value: (existing && existing.total !== existing.morning + existing.evening) ? existing.total : '' })
      ]),
      Utils.el('div', { class: 'field field--full' }, [
        Utils.el('label', {}, 'Notes'),
        Utils.el('input', { type: 'text', name: 'notes', value: existing?.notes || '' })
      ]),
      Utils.el('div', { class: 'form-actions field--full' }, [
        Utils.el('button', { type: 'button', class: 'btn', onclick: () => App.closeModal() }, 'Cancel'),
        Utils.el('button', { type: 'submit', class: 'btn btn--primary' }, isEdit ? 'Save Changes' : 'Add Entry')
      ])
    ]);

    App.openModal(isEdit ? 'Edit Daily Entry' : 'New Daily Entry', body);

    const dateInput = body.querySelector('[name="date"]');
    const rateHint = () => { document.getElementById('rateHint').value = Utils.money(Store.Rates.rateOn(dateInput.value)); };
    dateInput.addEventListener('change', rateHint);
    rateHint();

    document.getElementById('entryForm').addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      const morning = Number(data.morning || 0);
      const evening = Number(data.evening || 0);
      const total = data.total !== '' ? Number(data.total) : null;
      if (morning < 0 || evening < 0 || (total !== null && total < 0)) { Utils.toast('Milk quantity cannot be negative.', 'error'); return; }
      if (!data.date) { Utils.toast('Please choose a valid date.', 'error'); return; }
      if (total === null && morning === 0 && evening === 0) { Utils.toast('Enter morning/evening or a total quantity.', 'error'); return; }
      const payload = { customerId: data.customerId, date: data.date, morning, evening, total: total === null ? '' : total, notes: data.notes };
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

  return { render, openForm };
})();
