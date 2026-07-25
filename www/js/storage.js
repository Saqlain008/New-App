/* ==========================================================================
   storage.js — single source of truth for persisted data (localStorage)
   ========================================================================== */

const Store = (() => {

  const KEYS = {
    customers: 'mcbs_customers',
    rates: 'mcbs_rates',
    entries: 'mcbs_entries',
    payments: 'mcbs_payments',
    invoices: 'mcbs_invoices',
    settings: 'mcbs_settings',
    trash: 'mcbs_trash' // for undo-delete
  };

  const DEFAULT_SETTINGS = {
    businessName: 'Al-Barkat Milk Collection',
    ownerName: '',
    phone: '',
    address: '',
    currencySymbol: 'Rs.',
    unit: 'Liter',
    theme: 'light',
    invoiceCounter: 1000,
    lastBackup: null
  };

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Storage read error', key, e);
      return null;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage write error', key, e);
      Utils.toast('Storage full or unavailable — could not save.', 'error');
      return false;
    }
  }

  function ensureInit() {
    if (!read(KEYS.customers)) write(KEYS.customers, []);
    if (!read(KEYS.rates)) write(KEYS.rates, []);
    if (!read(KEYS.entries)) write(KEYS.entries, []);
    if (!read(KEYS.payments)) write(KEYS.payments, []);
    if (!read(KEYS.invoices)) write(KEYS.invoices, []);
    if (!read(KEYS.trash)) write(KEYS.trash, []);
    if (!read(KEYS.settings)) write(KEYS.settings, DEFAULT_SETTINGS);
    else write(KEYS.settings, { ...DEFAULT_SETTINGS, ...read(KEYS.settings) });
  }

  /* ---------- generic collection helpers ---------- */
  function getAll(key) { return read(key) || []; }
  function saveAll(key, arr) { return write(key, arr); }

  function insert(key, obj) {
    const arr = getAll(key);
    arr.push(obj);
    saveAll(key, arr);
    return obj;
  }

  function update(key, id, patch) {
    const arr = getAll(key);
    const idx = arr.findIndex(x => x.id === id);
    if (idx === -1) return null;
    arr[idx] = { ...arr[idx], ...patch };
    saveAll(key, arr);
    return arr[idx];
  }

  function remove(key, id, keepTrash = true) {
    const arr = getAll(key);
    const idx = arr.findIndex(x => x.id === id);
    if (idx === -1) return false;
    const [removed] = arr.splice(idx, 1);
    saveAll(key, arr);
    if (keepTrash) {
      const trash = getAll(KEYS.trash);
      trash.push({ key, item: removed, deletedAt: Date.now() });
      saveAll(KEYS.trash, trash.slice(-30)); // keep last 30
    }
    return removed;
  }

  function undoLastDelete() {
    const trash = getAll(KEYS.trash);
    const last = trash.pop();
    if (!last) return false;
    saveAll(KEYS.trash, trash);
    insert(last.key, last.item);
    return last;
  }

  /* ---------- Customers ---------- */
  const Customers = {
    all: () => getAll(KEYS.customers),
    get: id => Customers.all().find(c => c.id === id),
    add: data => insert(KEYS.customers, {
      id: Utils.uid('cust'),
      name: data.name.trim(),
      fatherName: data.fatherName || '',
      phone: data.phone || '',
      address: data.address || '',
      area: data.area || '',
      notes: data.notes || '',
      status: data.status || 'active',
      photo: data.photo || '',
      createdAt: Date.now()
    }),
    update: (id, patch) => update(KEYS.customers, id, patch),
    remove: id => remove(KEYS.customers, id),
    search: q => {
      q = (q || '').toLowerCase().trim();
      if (!q) return Customers.all();
      return Customers.all().filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.area || '').toLowerCase().includes(q) ||
        (c.fatherName || '').toLowerCase().includes(q)
      );
    }
  };

  /* ---------- Milk Rates ---------- */
  const Rates = {
    all: () => getAll(KEYS.rates).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)),
    add: data => insert(KEYS.rates, {
      id: Utils.uid('rate'),
      rate: Number(data.rate),
      effectiveDate: data.effectiveDate,
      note: data.note || '',
      createdAt: Date.now()
    }),
    remove: id => remove(KEYS.rates, id),
    /** rate that is active on a given date = latest rate with effectiveDate <= date */
    rateOn: date => {
      const rates = Rates.all().filter(r => r.effectiveDate <= date);
      if (!rates.length) return 0;
      return rates[rates.length - 1].rate;
    },
    current: () => {
      const rates = Rates.all();
      return rates.length ? rates[rates.length - 1].rate : 0;
    }
  };

  /* ---------- Daily Milk Entries ---------- */
  const Entries = {
    all: () => getAll(KEYS.entries),
    forCustomer: id => Entries.all().filter(e => e.customerId === id),
    inRange: (start, end, customerId = null) => Entries.all().filter(e =>
      e.date >= start && e.date <= end && (!customerId || e.customerId === customerId)
    ),
    upTo: (date, customerId = null) => Entries.all().filter(e =>
      e.date <= date && (!customerId || e.customerId === customerId)
    ),
    add: data => {
      const morning = Number(data.morning || 0);
      const evening = Number(data.evening || 0);
      const total = data.total !== undefined && data.total !== '' ? Number(data.total) : (morning + evening);
      const rate = Rates.rateOn(data.date);
      return insert(KEYS.entries, {
        id: Utils.uid('entry'),
        customerId: data.customerId,
        date: data.date,
        morning, evening, total,
        rate,
        amount: +(total * rate).toFixed(2),
        notes: data.notes || '',
        createdAt: Date.now()
      });
    },
    update: (id, patch) => {
      const arr = getAll(KEYS.entries);
      const idx = arr.findIndex(x => x.id === id);
      if (idx === -1) return null;
      const merged = { ...arr[idx], ...patch };
      const morning = Number(merged.morning || 0);
      const evening = Number(merged.evening || 0);
      merged.total = patch.total !== undefined && patch.total !== '' ? Number(patch.total) : (morning + evening);
      merged.rate = Rates.rateOn(merged.date);
      merged.amount = +(merged.total * merged.rate).toFixed(2);
      arr[idx] = merged;
      saveAll(KEYS.entries, arr);
      return merged;
    },
    remove: id => remove(KEYS.entries, id)
  };

  /* ---------- Payments ---------- */
  const Payments = {
    all: () => getAll(KEYS.payments),
    forCustomer: id => Payments.all().filter(p => p.customerId === id),
    inRange: (start, end, customerId = null) => Payments.all().filter(p =>
      p.date >= start && p.date <= end && (!customerId || p.customerId === customerId)
    ),
    upTo: (date, customerId = null) => Payments.all().filter(p =>
      p.date <= date && (!customerId || p.customerId === customerId)
    ),
    add: data => insert(KEYS.payments, {
      id: Utils.uid('pay'),
      customerId: data.customerId,
      date: data.date,
      amount: Number(data.amount),
      method: data.method || 'Cash',
      notes: data.notes || '',
      createdAt: Date.now()
    }),
    update: (id, patch) => update(KEYS.payments, id, patch),
    remove: id => remove(KEYS.payments, id)
  };

  /* ---------- Invoices ---------- */
  const Invoices = {
    all: () => getAll(KEYS.invoices),
    forCustomer: id => Invoices.all().filter(i => i.customerId === id),
    get: id => Invoices.all().find(i => i.id === id),
    add: data => {
      const settings = getSettings();
      const number = settings.invoiceCounter;
      write(KEYS.settings, { ...settings, invoiceCounter: number + 1 });
      return insert(KEYS.invoices, {
        id: Utils.uid('inv'),
        invoiceNumber: `INV-${number}`,
        ...data,
        createdAt: Date.now()
      });
    },
    remove: id => remove(KEYS.invoices, id)
  };

  /* ---------- Settings ---------- */
  function getSettings() { return read(KEYS.settings) || DEFAULT_SETTINGS; }
  function saveSettings(patch) {
    const merged = { ...getSettings(), ...patch };
    write(KEYS.settings, merged);
    return merged;
  }

  /* ---------- Backup / Restore ---------- */
  function exportBackup() {
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        customers: getAll(KEYS.customers),
        rates: getAll(KEYS.rates),
        entries: getAll(KEYS.entries),
        payments: getAll(KEYS.payments),
        invoices: getAll(KEYS.invoices),
        settings: getSettings()
      }
    }, null, 2);
  }

  function importBackup(jsonStr) {
    const parsed = JSON.parse(jsonStr);
    const data = parsed.data || parsed; // tolerate raw dumps
    if (data.customers) saveAll(KEYS.customers, data.customers);
    if (data.rates) saveAll(KEYS.rates, data.rates);
    if (data.entries) saveAll(KEYS.entries, data.entries);
    if (data.payments) saveAll(KEYS.payments, data.payments);
    if (data.invoices) saveAll(KEYS.invoices, data.invoices);
    if (data.settings) saveAll(KEYS.settings, { ...DEFAULT_SETTINGS, ...data.settings });
    saveSettings({ lastBackup: new Date().toISOString() });
    return true;
  }

  function clearAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    ensureInit();
  }

  ensureInit();

  return {
    KEYS, Customers, Rates, Entries, Payments, Invoices,
    getSettings, saveSettings, exportBackup, importBackup, clearAll, undoLastDelete
  };
})();
