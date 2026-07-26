/* ==========================================================================
   payments.js — payment recording & history
   ========================================================================== */

const PaymentsView = (() => {

  var currentPage = 1;

  function render(container) {
    container.innerHTML = '';
    container.appendChild(Utils.el('div', { class: 'view-head' }, [
      Utils.el('div', {}, [
        Utils.el('h1', {}, '💳 Payments'),
        Utils.el('div', { class: 'sub' }, 'Record cash, bank or mobile-wallet payments from customers')
      ]),
      Utils.el('div', { class: 'view-actions' }, [
        Utils.el('button', { class: 'btn btn--primary', onclick: function() { openForm(); } }, '+ Record Payment')
      ])
    ]));

    var customers = Store.Customers.all();
    var custMap = {};
    customers.forEach(function(c) { custMap[c.id] = c; });

    container.appendChild(Utils.el('div', { class: 'filters' }, [
      Utils.el('select', { id: 'payMethodFilter' }, [
        Utils.el('option', { value: 'all' }, 'All methods'),
        Utils.el('option', { value: 'Cash' }, 'Cash'),
        Utils.el('option', { value: 'Bank' }, 'Bank'),
        Utils.el('option', { value: 'EasyPaisa' }, 'EasyPaisa'),
        Utils.el('option', { value: 'JazzCash' }, 'JazzCash'),
        Utils.el('option', { value: 'Other' }, 'Other')
      ]),
      Utils.el('input', { type: 'text', placeholder: 'Filter by customer...', id: 'paySearch' })
    ]));

    var tableWrap = Utils.el('div', { class: 'table-wrap' });
    container.appendChild(tableWrap);

    function draw() {
      var method = document.getElementById('payMethodFilter').value;
      var q = document.getElementById('paySearch').value.toLowerCase();
      var rows = Store.Payments.all().sort(function(a, b) { return b.date.localeCompare(a.date) || b.createdAt - a.createdAt; });
      if (method !== 'all') rows = rows.filter(function(p) { return p.method === method; });
      if (q) rows = rows.filter(function(p) { return (custMap[p.customerId] ? custMap[p.customerId].name : '').toLowerCase().includes(q); });

      var paginated = Utils.paginate(rows, currentPage, 20);
      currentPage = paginated.page;

      tableWrap.innerHTML = '';
      if (!rows.length) { tableWrap.appendChild(Utils.el('div', { class: 'table-empty' }, 'No payments recorded yet.')); return; }
      var total = rows.reduce(function(s, p) { return s + p.amount; }, 0);
      var table = Utils.el('table', {}, Utils.el('thead', {}, Utils.el('tr', {},
        ['Date', 'Customer', 'Amount', 'Method', 'Notes', ''].map(function(h, i) { return Utils.el('th', { class: i === 2 ? 'num' : '' }, h); }))));
      var tbody = Utils.el('tbody');
      paginated.items.forEach(function(p) {
        var cust = custMap[p.customerId];
        tbody.appendChild(Utils.el('tr', {}, [
          Utils.el('td', {}, Utils.formatDate(p.date)),
          Utils.el('td', { style: 'font-weight:600' }, cust ? cust.name : '(deleted)'),
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
      var tfoot = Utils.el('tfoot', {}, Utils.el('tr', { style: 'font-weight:800;background:var(--forest-dim)' }, [
        Utils.el('td', { colspan: '2' }, 'Total'),
        Utils.el('td', { class: 'num' }, Utils.money(total)),
        Utils.el('td', { colspan: '3' })
      ]));
      table.appendChild(tbody);
      table.appendChild(tfoot);
      tableWrap.appendChild(table);
      tableWrap.appendChild(Utils.paginationControls(paginated, function(p) { currentPage = p; draw(); }));
    }

    document.getElementById('payMethodFilter').addEventListener('change', function() { currentPage = 1; draw(); });
    document.getElementById('paySearch').addEventListener('input', Utils.debounce(function() { currentPage = 1; draw(); }, 150));
    draw();
  }

  function openForm(prefillCustomerId) {
    var customers = Store.Customers.all();
    if (!customers.length) { Utils.toast('Add a customer first.', 'error'); return; }
    var body = Utils.el('form', { class: 'form-grid', id: 'payForm' }, [
      Utils.el('div', { class: 'field field--full' }, [
        Utils.el('label', {}, 'Customer *'),
        Utils.el('select', { name: 'customerId', required: 'required' },
          customers.map(function(c) {
            return Utils.el('option', {
              value: c.id,
              selected: prefillCustomerId === c.id ? 'selected' : undefined
            }, c.name + ' | Balance: ' + Utils.money(Billing.outstandingAsOf(c.id, Utils.todayISO())));
          }))
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'Payment Date *'),
        Utils.el('input', { type: 'date', name: 'date', value: Utils.todayISO(), required: 'required' })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'Amount Paid *'),
        Utils.el('input', { type: 'number', name: 'amount', min: '0.01', step: '0.01', required: 'required' })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'Payment Method'),
        Utils.el('select', { name: 'method' },
          ['Cash', 'Bank', 'EasyPaisa', 'JazzCash', 'Other'].map(function(m) { return Utils.el('option', { value: m }, m); }))
      ]),
      Utils.el('div', { class: 'field field--full' }, [
        Utils.el('label', {}, 'Notes'),
        Utils.el('input', { type: 'text', name: 'notes' })
      ]),
      Utils.el('div', { class: 'form-actions field--full' }, [
        Utils.el('button', { type: 'button', class: 'btn', onclick: function() { App.closeModal(); } }, 'Cancel'),
        Utils.el('button', { type: 'submit', class: 'btn btn--primary' }, 'Save Payment')
      ])
    ]);
    App.openModal('Record Payment', body);
    document.getElementById('payForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(e.target).entries());
      if (Number(data.amount) <= 0) { Utils.toast('Amount must be greater than zero.', 'error'); return; }
      Store.Payments.add(data);
      Utils.toast('Payment recorded.', 'success');
      App.closeModal();
      App.rerender();
    });
  }

  return { render: render, openForm: openForm };
})();