/* ==========================================================================
   rates.js — milk rate history management
   ========================================================================== */

const RatesView = (() => {

  function render(container) {
    container.innerHTML = '';
    const current = Store.Rates.current();

    container.appendChild(Utils.el('div', { class: 'view-head' }, [
      Utils.el('div', {}, [
        Utils.el('h1', {}, 'Milk Rate Management'),
        Utils.el('div', { class: 'sub' }, `Current active rate: ${Utils.money(current)} per ${Store.getSettings().unit}`)
      ]),
      Utils.el('div', { class: 'view-actions' }, [
        Utils.el('button', { class: 'btn btn--primary', onclick: openForm }, '+ New Rate')
      ])
    ]));

    container.appendChild(Utils.el('div', { class: 'panel' }, [
      Utils.el('p', { style: 'color:var(--muted);font-size:13px;margin:0' },
        `Rates apply automatically from their effective date onward. Daily entries always use the rate that was active on that entry's date — older entries are never affected by a new rate.`)
    ]));

    const rates = Store.Rates.all().slice().reverse();
    const wrap = Utils.el('div', { class: 'table-wrap' });
    if (!rates.length) {
      wrap.appendChild(Utils.el('div', { class: 'table-empty' }, 'No rate set yet. Add your first milk rate to begin recording entries.'));
    } else {
      const table = Utils.el('table', {}, Utils.el('thead', {}, Utils.el('tr', {}, [
        Utils.el('th', {}, 'Effective From'), Utils.el('th', { class: 'num' }, 'Rate'), Utils.el('th', {}, 'Note'), Utils.el('th', {}, '')
      ])));
      const tbody = Utils.el('tbody');
      rates.forEach((r, idx) => {
        const isCurrent = idx === 0;
        tbody.appendChild(Utils.el('tr', {}, [
          Utils.el('td', {}, [Utils.formatDate(r.effectiveDate), isCurrent ? Utils.el('span', { class: 'badge badge--active', style: 'margin-left:8px' }, 'Current') : null]),
          Utils.el('td', { class: 'num' }, Utils.money(r.rate)),
          Utils.el('td', {}, r.note || '—'),
          Utils.el('td', {}, Utils.el('div', { class: 'row-actions' }, [
            Utils.el('button', { class: 'btn btn--sm btn--danger', onclick: () => onDelete(r) }, 'Delete')
          ]))
        ]));
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
    }
    container.appendChild(wrap);
  }

  function onDelete(r) {
    if (!Utils.confirmDialog(`Delete rate ${Utils.money(r.rate)} effective ${Utils.formatDate(r.effectiveDate)}? Existing entries keep their originally-calculated amounts.`)) return;
    Store.Rates.remove(r.id);
    Utils.toast('Rate deleted.', 'success');
    App.rerender();
  }

  function openForm() {
    const body = Utils.el('form', { class: 'form-grid', id: 'rateForm' }, [
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, `Rate (per ${Store.getSettings().unit}) *`),
        Utils.el('input', { type: 'number', name: 'rate', step: '0.01', min: '0.01', required: 'required' })
      ]),
      Utils.el('div', { class: 'field' }, [
        Utils.el('label', {}, 'Effective From *'),
        Utils.el('input', { type: 'date', name: 'effectiveDate', value: Utils.todayISO(), required: 'required' })
      ]),
      Utils.el('div', { class: 'field field--full' }, [
        Utils.el('label', {}, 'Note'),
        Utils.el('input', { type: 'text', name: 'note', placeholder: 'e.g. Winter rate increase' })
      ]),
      Utils.el('div', { class: 'form-actions field--full' }, [
        Utils.el('button', { type: 'button', class: 'btn', onclick: () => App.closeModal() }, 'Cancel'),
        Utils.el('button', { type: 'submit', class: 'btn btn--primary' }, 'Save Rate')
      ])
    ]);
    App.openModal('New Milk Rate', body);
    document.getElementById('rateForm').addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      if (Number(data.rate) <= 0) { Utils.toast('Rate must be a positive number.', 'error'); return; }
      Store.Rates.add(data);
      Utils.toast('Milk rate saved.', 'success');
      App.closeModal();
      App.rerender();
    });
  }

  return { render };
})();
