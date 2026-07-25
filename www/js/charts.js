/* ==========================================================================
   charts.js — thin wrapper around Chart.js so views stay simple
   ========================================================================== */

const Charts = (() => {
  const instances = {};

  function themeColors() {
    const dark = document.body.getAttribute('data-theme') === 'dark';
    return {
      grid: dark ? '#2A3438' : '#E7E0CE',
      text: dark ? '#9BA69C' : '#6E7566',
      forest: dark ? '#63C99A' : '#1B4332',
      gold: dark ? '#E3B94E' : '#C99A2E'
    };
  }

  function destroy(id) {
    if (instances[id]) { instances[id].destroy(); delete instances[id]; }
  }

  function lineChart(canvasId, labels, datasets) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === 'undefined') return;
    const c = themeColors();
    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((d, i) => ({
          tension: .35, fill: true, pointRadius: 2,
          borderColor: i === 0 ? c.forest : c.gold,
          backgroundColor: i === 0 ? (document.body.getAttribute('data-theme') === 'dark' ? 'rgba(99,201,154,.12)' : 'rgba(27,67,50,.08)') : 'rgba(201,154,46,.1)',
          ...d
        }))
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: datasets.length > 1, labels: { color: c.text, font: { family: 'Manrope' } } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: c.text, font: { size: 11 } } },
          y: { grid: { color: c.grid }, ticks: { color: c.text, font: { size: 11 } } }
        }
      }
    });
  }

  function barChart(canvasId, labels, data, label = '') {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === 'undefined') return;
    const c = themeColors();
    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label, data, backgroundColor: c.forest, borderRadius: 5, maxBarThickness: 34 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: c.text, font: { size: 11 } } },
          y: { grid: { color: c.grid }, ticks: { color: c.text, font: { size: 11 } } }
        }
      }
    });
  }

  function doughnutChart(canvasId, labels, data) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === 'undefined') return;
    const c = themeColors();
    instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: [c.forest, c.gold, '#B3261E', '#8a8f80'], borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: { legend: { position: 'bottom', labels: { color: c.text, boxWidth: 10, font: { size: 11 } } } }
      }
    });
  }

  function refreshAllThemes() {
    // charts re-render on view change anyway; nothing persistent needed
  }

  return { lineChart, barChart, doughnutChart, destroy, refreshAllThemes };
})();
