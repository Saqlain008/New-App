# Milk Ledger — Collection & Billing Management System

A complete, offline-first milk collection and billing app for a milk collector (Gawala) to manage customers, daily entries, milk rates, payments, balances, invoices and reports — no backend, no database, no build step.

## Run it
Just open `index.html` in a browser, or deploy the whole folder to **GitHub Pages** (Settings → Pages → deploy from `main` branch, root folder). Everything is stored in your browser's `localStorage`, so your data stays on your device until you export/clear it yourself.

> Chart.js and jsPDF are loaded from a CDN for charts and PDF export. Every core feature (entries, billing, balances, invoices, CSV export, backup) works fully offline; only chart rendering and PDF download need an initial internet connection to fetch those libraries once (they are then cached by the browser).

## Structure
```
index.html
css/style.css
js/
  utils.js       shared helpers (dates, formatting, DOM, CSV, toasts)
  storage.js     localStorage data layer (customers, rates, entries, payments, invoices, settings)
  billing.js     balance & carry-forward math, weekly/monthly/yearly statements
  charts.js      Chart.js wrappers
  customers.js   customer list, profile, add/edit/delete
  rates.js       milk rate history
  entries.js     daily milk entry
  payments.js    payment recording
  invoices.js    invoice generation, print, PDF export
  reports.js     weekly/monthly/yearly reports + CSV export
  dashboard.js   dashboard cards & charts
  settings.js    business settings + backup/restore/clear
  app.js         router, modal, global search, theme, shortcuts
assets/icons/favicon.svg
```

## Data & backups
Use **Backup & Data** in the sidebar to export a full JSON backup, import one back, undo the last delete, or clear everything. CSV export is also available for customers, entries and payments.

## Keyboard shortcuts
`N` new daily entry · `P` new payment · `/` focus search · `Esc` close dialog
