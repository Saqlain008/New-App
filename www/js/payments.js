/* ==========================================================================
   payments.js — payment recording & history
   ========================================================================== */

const PaymentsView = (() => {

  function render(container) {
    container.innerHTML = '';
    container.appendChild(Utils.el('div', { class: 'view-head' }, [
      Utils.el('div', {}, [
        Utils.el('h1', {}, 'Payments'),
        Utils.el('div', { class: 'sub' }, 'Record cash, bank or mobile-wallet payments from customers')
      ]),
      Utils.el('div', { class: 'view-actions' }, [
        Utils.el('button', { class: 'btn btn--primary', onclick: () => openForm() }, '+ Record Payment')
      ])
    ]));

    const customers = Store.Customers.all();
    const custMap = Object.fromEntries(customers.map(c => [c.id, c]));

    const filters = Utils.el('div', { class: 'filters' }, [
      Utils.el('select', { id: 'payMethodFilter' }, [
        Utils.el('option', { value: 'all' }, 'All methods'),
        ...['Cash', 'Bank', 'EasyPaisa', 'JazzCash', 'Other'].map(m => Utils.el('option', { value: m }, m))
      ]),
      Utils.el('input', { type: 'text', placeholder: 'Filter by customer…', id: 'paySearch' })
    ]);
    container.appendChild(filters);

    const tableWrap = Utils.el('div', { class: 'table-wrap' });
    container.appendChild(tableWrap);

    function draw() {
      const method = document.getElementById('payMethodFilter').value;
      const q = document.getElementById('paySearch').value.toLowerCase();
      let rows = Store.Payments.all().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
      if (method !== 'all') rows = rows.filter(p => p.method === method);
      if (q) rows = rows.filter(p => (custMap[p.customerId]?.name || '').toLowerCase().includes(q));

      tableWrap.innerHTML = '';
      if (!rows.length) { tableWrap.appendChild(Utils.el('div', { class: 'table-empty' }, 'No payments recorded yet.')); return; }
      const total = rows.reduce((s, p) => s + p.amount, 0);
      const table = Utils.el('table', {}, Utils.el('thead', {}, Utils.el('tr', {}, [
        'Date', 'Customer', 'Amount', 'Method', 'Notes', ''
      ].map((h, i) => Utils.el('th', { class: i === 2 ? 'num' : '' }, h)))));
      const tbody = Utils.el('tbody');
      rows.forEach(p => {
        const cust = custMap[p.customerId];
        tbody.appendChild(Utils.el('tr', {}, [
          Utils.el('td', {}, Utils.formatDate(p.date)),
          Utils.el('td', { style: 'font-weight:600' }, cust ? cust.name : '(deleted customer)'),
          Utils.el('td', { class: 'num' }, Utils.money(p.amount)),
          Utils.el('td', {}, Utils.el('span', { class: 'badge badge--active' }, p.method)),
          Utils.el('td', {}, p.notes || '—'),
          Utils.el('td', {}, Utils.el('div', { class: 'row-actions' }, [
            Utils.el('button', { class: 'btn btn--sm btn--danger', onclick: () => { if (Utils.confirmDialog('Delete this payment?')) { Store.Payments.remove(p.id); App.rerender(); } } }, 'Del')
          ]))
        ]));
      });
      const tfoot = Utils.el('tfoot', {}, Utils.el('tr', { style: 'font-weight:800;background:var(--forest-dim)' }, [
        Utils.el('td', { colspan: '2' }, 'Total'),
        Utils.el('td', { class: 'num' }, Utils.money(total)),
        Utils.el('td', { colspan: '3' })
      ]));
      table.appendChild(tbody);
      table.appendChild(tfoot);
      tableWrap.appendChild(table);
    }

    document.getElementById('payMethodFilter').addEventListener('change', draw);
    document.getElementById('paySearch').addEventListener('input', Utils.debounce(draw, 150));
    draw();
  }

  function openForm(prefillCustomerId) {
    const customers = Store.Customers.all();
    if (!customers.length) { Utils.toast('Add a customer first.', 'error'); return; }
    const body = Utils.el('form', { class: 'form-grid', id: 'payForm' }, [
      Utils.el('div', { class: 'field field--full' }, [
        Utils.el('label', {}, 'Customer *'),
        Utils.el('select', { name: 'customerId', required: 'required' },
          customers.map(c => Utils.el('option', { value: c.id, ...(prefillCustomerId === c.id ? { selected: 'selected' } : {}) }, `${c.name} — Balance: ${Utils.money(Billing.outstandingAsOf(c.id, Utils.todayISO()))}`)))
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'Payment Date *'),
        Utils.el('input', { type: 'date', name: 'date', value: Utils.todayISO(), max: Utils.todayISO(), required: 'required' })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'Amount Paid *'),
        Utils.el('input', { type: 'number', name: 'amount', min: '0.01', step: '0.01', required: 'required' })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'Payment Method'),
        Utils.el('select', { name: 'method' }, ['Cash', 'Bank', 'EasyPaisa', 'JazzCash', 'Other'].map(m => Utils.el('option', { value: m }, m)))
      ]),
      Utils.el('div', { class: 'field field--full' }, [
        Utils.el('label', {}, 'Notes'),
        Utils.el('input', { type: 'text', name: 'notes' })
      ]),
      Utils.el('div', { class: 'form-actions field--full' }, [
        Utils.el('button', { type: 'button', class: 'btn', onclick: () => App.closeModal() }, 'Cancel'),
        Utils.el('button', { type: 'submit', class: 'btn btn--primary' }, 'Save Payment')
      ])
    ]);
    App.openModal('Record Payment', body);
    document.getElementById('payForm').addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      if (Number(data.amount) <= 0) { Utils.toast('Payment amount must be greater than zero.', 'error'); return; }
      Store.Payments.add(data);
      Utils.toast('Payment recorded.', 'success');
      App.closeModal();
      App.rerender();
    });
  }

  return { render, openForm };
})();
