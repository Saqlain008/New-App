/* ==========================================================================
   invoices.js — invoice generation, listing, print & PDF export
   ========================================================================== */

const InvoicesView = (() => {

  function render(container) {
    container.innerHTML = '';
    container.appendChild(Utils.el('div', { class: 'view-head' }, [
      Utils.el('div', {}, [
        Utils.el('h1', {}, 'Invoices'),
        Utils.el('div', { class: 'sub' }, 'Generate and manage customer bills')
      ]),
      Utils.el('div', { class: 'view-actions' }, [
        Utils.el('button', { class: 'btn btn--primary', onclick: openGenerateForm }, '+ Generate Invoice')
      ])
    ]));

    const custMap = Object.fromEntries(Store.Customers.all().map(c => [c.id, c]));
    const invoices = Store.Invoices.all().sort((a, b) => b.createdAt - a.createdAt);
    const wrap = Utils.el('div', { class: 'table-wrap' });
    if (!invoices.length) {
      wrap.appendChild(Utils.el('div', { class: 'table-empty' }, 'No invoices generated yet. Click "Generate Invoice" to create your first bill.'));
    } else {
      const table = Utils.el('table', {}, Utils.el('thead', {}, Utils.el('tr', {}, [
        'Invoice #', 'Customer', 'Period', 'Total Payable', 'Status', ''
      ].map((h, i) => Utils.el('th', { class: i === 3 ? 'num' : '' }, h)))));
      const tbody = Utils.el('tbody');
      invoices.forEach(inv => {
        tbody.appendChild(Utils.el('tr', {}, [
          Utils.el('td', { class: 'mono' }, inv.invoiceNumber),
          Utils.el('td', { style: 'font-weight:600' }, custMap[inv.customerId]?.name || '—'),
          Utils.el('td', {}, `${Utils.formatDate(inv.periodStart)} – ${Utils.formatDate(inv.periodEnd)}`),
          Utils.el('td', { class: 'num' }, Utils.money(inv.totalPayable)),
          Utils.el('td', {}, Utils.el('span', { class: `badge badge--${inv.status.toLowerCase()}` }, inv.status)),
          Utils.el('td', {}, Utils.el('div', { class: 'row-actions' }, [
            Utils.el('button', { class: 'btn btn--sm', onclick: () => viewInvoice(inv.id) }, 'View'),
            Utils.el('button', { class: 'btn btn--sm btn--danger', onclick: () => { if (Utils.confirmDialog('Delete this invoice record?')) { Store.Invoices.remove(inv.id); App.rerender(); } } }, 'Del')
          ]))
        ]));
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }
    container.appendChild(wrap);
  }

  function openGenerateForm() {
    const customers = Store.Customers.all();
    if (!customers.length) { Utils.toast('Add a customer first.', 'error'); return; }
    const today = Utils.todayISO();
    const weekStart = Utils.weekBounds(today).start;

    const body = Utils.el('form', { class: 'form-grid', id: 'invForm' }, [
      Utils.el('div', { class: 'field field--full' }, [
        Utils.el('label', {}, 'Customer *'),
        Utils.el('select', { name: 'customerId', required: 'required' }, customers.map(c => Utils.el('option', { value: c.id }, c.name)))
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'Period Start *'),
        Utils.el('input', { type: 'date', name: 'periodStart', value: weekStart, required: 'required' })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'Period End *'),
        Utils.el('input', { type: 'date', name: 'periodEnd', value: today, required: 'required' })
      ]),
      Utils.el('div', { class: 'form-actions field--full' }, [
        Utils.el('button', { type: 'button', class: 'btn', onclick: () => App.closeModal() }, 'Cancel'),
        Utils.el('button', { type: 'submit', class: 'btn btn--primary' }, 'Generate')
      ])
    ]);
    App.openModal('Generate Invoice', body);
    document.getElementById('invForm').addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      if (data.periodStart > data.periodEnd) { Utils.toast('Period start must be before period end.', 'error'); return; }
      const stmt = Billing.periodStatement(data.customerId, data.periodStart, data.periodEnd);
      const inv = Store.Invoices.add({
        customerId: data.customerId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        qty: stmt.qty,
        rate: stmt.qty ? +(stmt.currentBill / stmt.qty).toFixed(2) : Store.Rates.rateOn(data.periodEnd),
        grossAmount: stmt.currentBill,
        previousBalance: stmt.previousBalance,
        paymentsReceived: stmt.paymentsReceived,
        remaining: stmt.remaining,
        totalPayable: stmt.totalPayable,
        status: stmt.status,
        date: today
      });
      Utils.toast(`Invoice ${inv.invoiceNumber} generated.`, 'success');
      App.closeModal();
      viewInvoice(inv.id);
    });
  }

  function viewInvoice(invoiceId) {
    const inv = Store.Invoices.get(invoiceId);
    if (!inv) return;
    const cust = Store.Customers.get(inv.customerId);
    const settings = Store.getSettings();

    const body = Utils.el('div', {}, [
      Utils.el('div', { class: 'invoice', id: 'invoicePrintArea' }, [
        Utils.el('div', { class: 'invoice__top' }, [
          Utils.el('div', { style: 'display:flex;gap:12px;align-items:center' }, [
            Utils.el('div', { class: 'invoice__logo' }, '🥛'),
            Utils.el('div', { class: 'invoice__biz' }, [
              Utils.el('strong', {}, settings.businessName),
              Utils.el('span', { style: 'font-size:12px;color:#666' }, [settings.phone, settings.address].filter(Boolean).join(' • '))
            ])
          ]),
          Utils.el('div', { class: 'invoice__meta' }, [
            Utils.el('div', {}, [Utils.el('b', {}, 'Invoice #: '), inv.invoiceNumber]),
            Utils.el('div', {}, [Utils.el('b', {}, 'Date: '), Utils.formatDate(inv.date)]),
            Utils.el('div', {}, [Utils.el('b', {}, 'Period: '), `${Utils.formatDate(inv.periodStart)} – ${Utils.formatDate(inv.periodEnd)}`])
          ])
        ]),
        Utils.el('div', { class: 'invoice__parties' }, [
          Utils.el('div', {}, [Utils.el('h4', {}, 'Billed To'), Utils.el('div', { style: 'font-weight:700' }, cust?.name || '—'), Utils.el('div', {}, cust?.phone || ''), Utils.el('div', {}, cust?.address || cust?.area || '')]),
          Utils.el('div', {}, [Utils.el('h4', {}, 'Status'), Utils.el('span', { class: `badge badge--${inv.status.toLowerCase()}` }, inv.status)])
        ]),
        Utils.el('div', { class: 'table-wrap', style: 'box-shadow:none' }, Utils.el('table', {}, [
          Utils.el('thead', {}, Utils.el('tr', {}, ['Description', 'Quantity', 'Rate', 'Amount'].map((h, i) => Utils.el('th', { class: i > 0 ? 'num' : '' }, h)))),
          Utils.el('tbody', {}, Utils.el('tr', {}, [
            Utils.el('td', {}, `Milk collected (${Utils.formatDate(inv.periodStart)} – ${Utils.formatDate(inv.periodEnd)})`),
            Utils.el('td', { class: 'num' }, Utils.qty(inv.qty)),
            Utils.el('td', { class: 'num' }, Utils.money(inv.rate)),
            Utils.el('td', { class: 'num' }, Utils.money(inv.grossAmount))
          ]))
        ])),
        Utils.el('div', { class: 'invoice__totals' }, [
          Utils.el('div', {}, [Utils.el('span', {}, 'Gross Amount'), Utils.el('span', { class: 'mono' }, Utils.money(inv.grossAmount))]),
          Utils.el('div', {}, [Utils.el('span', {}, 'Previous Balance'), Utils.el('span', { class: 'mono' }, Utils.money(inv.previousBalance))]),
          Utils.el('div', {}, [Utils.el('span', {}, 'Payments Received'), Utils.el('span', { class: 'mono' }, `– ${Utils.money(inv.paymentsReceived)}`)]),
          Utils.el('div', { class: 'grand' }, [Utils.el('span', {}, 'Grand Total Payable'), Utils.el('span', { class: 'mono' }, Utils.money(inv.remaining))])
        ])
      ]),
      Utils.el('div', { class: 'form-actions' }, [
        Utils.el('button', { class: 'btn', onclick: () => App.closeModal() }, 'Close'),
        Utils.el('button', { class: 'btn', onclick: () => window.print() }, '🖨 Print'),
        Utils.el('button', { class: 'btn btn--primary', onclick: () => downloadInvoicePDF(inv, cust, settings) }, '⬇ Download PDF')
      ])
    ]);
    App.openModal(`Invoice ${inv.invoiceNumber}`, body, 'wide');
  }

  function downloadInvoicePDF(inv, cust, settings) {
    if (typeof window.jspdf === 'undefined') { Utils.toast('PDF library not loaded (check internet connection).', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const left = 48; let y = 60;
    doc.setFontSize(18); doc.text(settings.businessName, left, y);
    doc.setFontSize(10); y += 16;
    doc.text([settings.phone, settings.address].filter(Boolean).join('  •  '), left, y);
    y += 30;
    doc.setFontSize(12);
    doc.text(`Invoice #: ${inv.invoiceNumber}`, left, y);
    doc.text(`Date: ${Utils.formatDate(inv.date)}`, 360, y); y += 18;
    doc.text(`Period: ${Utils.formatDate(inv.periodStart)} - ${Utils.formatDate(inv.periodEnd)}`, left, y); y += 18;
    doc.text(`Billed To: ${cust?.name || '—'}  (${cust?.phone || ''})`, left, y); y += 30;

    doc.setDrawColor(27, 67, 50); doc.line(left, y, 548, y); y += 20;
    doc.setFontSize(11);
    doc.text('Description', left, y); doc.text('Qty', 320, y); doc.text('Rate', 400, y); doc.text('Amount', 480, y);
    y += 6; doc.line(left, y, 548, y); y += 18;
    doc.text(`Milk collected`, left, y);
    doc.text(String(inv.qty), 320, y);
    doc.text(Utils.money(inv.rate), 400, y);
    doc.text(Utils.money(inv.grossAmount), 480, y);
    y += 30; doc.line(left, y, 548, y); y += 24;

    const totalsX = 360;
    doc.text('Gross Amount:', totalsX, y); doc.text(Utils.money(inv.grossAmount), 480, y); y += 18;
    doc.text('Previous Balance:', totalsX, y); doc.text(Utils.money(inv.previousBalance), 480, y); y += 18;
    doc.text('Payments Received:', totalsX, y); doc.text(`- ${Utils.money(inv.paymentsReceived)}`, 480, y); y += 18;
    doc.setFontSize(13);
    doc.text('Grand Total Payable:', totalsX, y); doc.text(Utils.money(inv.remaining), 480, y); y += 24;
    doc.setFontSize(11);
    doc.text(`Status: ${inv.status}`, left, y);

    doc.save(`${inv.invoiceNumber}.pdf`);
  }

  return { render, viewInvoice };
})();
