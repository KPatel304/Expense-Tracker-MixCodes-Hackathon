/* ============================================================
   Expense Tracker — Frontend Application Logic
   ============================================================ */

const API = '/api';

// Category emoji map
const CATEGORY_ICONS = {
  Food: '🍔',
  Transport: '🚗',
  Entertainment: '🎬',
  Shopping: '🛍️',
  Bills: '📄',
  Health: '💊',
  Education: '📚',
  Other: '💼',
};

// Chart.js colour palette
const CHART_COLORS = [
  '#6c63ff', '#ff6584', '#43e97b', '#f9a825',
  '#00bcd4', '#e91e63', '#9c27b0', '#607d8b',
];

let categoryChart = null;
let monthlyChart = null;
let allCategories = [];

// ─── Utility ──────────────────────────────────────────────────────────────────

function fmt(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function showToast(message, type = 'default') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

function getTodayIsoDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── Categories ───────────────────────────────────────────────────────────────

async function loadCategories() {
  try {
    allCategories = await apiFetch('/categories');

    const select = document.getElementById('category');
    const filterSelect = document.getElementById('filter-category');

    allCategories.forEach(cat => {
      const opt = new Option(cat, cat);
      select.appendChild(opt);

      const filterOpt = new Option(cat, cat);
      filterSelect.appendChild(filterOpt);
    });
  } catch (e) {
    console.error('Failed to load categories', e);
  }
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

async function loadSummary() {
  try {
    const summary = await apiFetch('/summary');

    document.getElementById('monthly-total').textContent = fmt(summary.monthlyTotal);
    document.getElementById('alltime-total').textContent = fmt(summary.allTimeTotal);
    document.getElementById('total-count').textContent = summary.totalExpenses;

    // Update month label in header
    const [year, month] = summary.currentMonth.split('-');
    const label = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    document.getElementById('current-month-label').textContent = label;

    renderCategoryChart(summary.byCategory);
    renderMonthlyChart(summary.monthlyBreakdown);
  } catch (e) {
    console.error('Failed to load summary', e);
  }
}

// ─── Charts ───────────────────────────────────────────────────────────────────

function renderCategoryChart(byCategory) {
  const labels = Object.keys(byCategory).filter(k => byCategory[k] > 0);
  const data = labels.map(k => byCategory[k]);

  const noData = document.getElementById('category-no-data');
  const canvas = document.getElementById('categoryChart');

  if (labels.length === 0) {
    canvas.style.display = 'none';
    noData.style.display = 'block';
    return;
  }
  canvas.style.display = '';
  noData.style.display = 'none';

  if (categoryChart) categoryChart.destroy();

  categoryChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 12 }, padding: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)}`,
          },
        },
      },
    },
  });
}

function renderMonthlyChart(monthlyBreakdown) {
  const labels = Object.keys(monthlyBreakdown).map(m => {
    const [year, mo] = m.split('-');
    return new Date(year, mo - 1).toLocaleString('en-US', { month: 'short', year: '2-digit' });
  });
  const data = Object.values(monthlyBreakdown);

  const noData = document.getElementById('monthly-no-data');
  const canvas = document.getElementById('monthlyChart');

  const hasData = data.some(v => v > 0);
  if (!hasData) {
    canvas.style.display = 'none';
    noData.style.display = 'block';
    return;
  }
  canvas.style.display = '';
  noData.style.display = 'none';

  if (monthlyChart) monthlyChart.destroy();

  monthlyChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Total Spending',
        data,
        backgroundColor: 'rgba(108, 99, 255, 0.7)',
        borderColor: '#6c63ff',
        borderWidth: 1.5,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${fmt(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => fmt(v) },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

// ─── Expense List ─────────────────────────────────────────────────────────────

async function loadExpenses() {
  const category = document.getElementById('filter-category').value;
  const month = document.getElementById('filter-month').value;

  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (month) params.set('month', month);

  try {
    const expenses = await apiFetch(`/expenses?${params.toString()}`);
    renderExpenseList(expenses);
  } catch (e) {
    console.error('Failed to load expenses', e);
  }
}

function renderExpenseList(expenses) {
  const container = document.getElementById('expense-list');
  if (expenses.length === 0) {
    container.innerHTML = '<p class="empty-state">No expenses found. Add your first expense above!</p>';
    return;
  }

  container.innerHTML = expenses.map(expense => {
    const icon = CATEGORY_ICONS[expense.category] || '💼';
    const date = new Date(expense.date + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    return `
      <div class="expense-item" data-id="${expense.id}">
        <div class="expense-icon cat-${expense.category}">${icon}</div>
        <div class="expense-info">
          <div class="expense-description">${escapeHtml(expense.description)}</div>
          <div class="expense-meta">
            <span class="expense-category-badge cat-${expense.category}">${expense.category}</span>
            &nbsp;${date}
          </div>
        </div>
        <div class="expense-right">
          <span class="expense-amount">${fmt(expense.amount)}</span>
          <button class="btn-delete" data-id="${expense.id}" title="Delete expense">🗑️</button>
        </div>
      </div>`;
  }).join('');

  // Wire delete buttons
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteExpense(btn.dataset.id));
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Add Expense ──────────────────────────────────────────────────────────────

async function addExpense(e) {
  e.preventDefault();
  const errorEl = document.getElementById('form-error');
  errorEl.textContent = '';

  const today = getTodayIsoDate();
  const selectedDate = document.getElementById('date').value;
  if (selectedDate > today) {
    const msg = 'Expense date cannot be in the future';
    errorEl.textContent = msg;
    showToast(msg, 'error');
    return;
  }

  const payload = {
    amount: parseFloat(document.getElementById('amount').value),
    category: document.getElementById('category').value,
    description: document.getElementById('description').value.trim(),
    date: selectedDate,
  };

  try {
    await apiFetch('/expenses', { method: 'POST', body: JSON.stringify(payload) });
    document.getElementById('expense-form').reset();
    // Reset date to today
    document.getElementById('date').value = today;
    showToast('Expense added!', 'success');
    await refresh();
  } catch (err) {
    errorEl.textContent = err.message;
    showToast(err.message, 'error');
  }
}

// ─── Delete Expense ───────────────────────────────────────────────────────────

async function deleteExpense(id) {
  try {
    await apiFetch(`/expenses/${id}`, { method: 'DELETE' });
    showToast('Expense deleted.', 'default');
    await refresh();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Refresh All ──────────────────────────────────────────────────────────────

async function refresh() {
  await Promise.all([loadSummary(), loadExpenses()]);
}

// ─── Chart Tab Switching ──────────────────────────────────────────────────────

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const tab = btn.dataset.tab;
      document.getElementById('chart-category').classList.toggle('hidden', tab !== 'category');
      document.getElementById('chart-monthly').classList.toggle('hidden', tab !== 'monthly');
    });
  });
}

// ─── Filters ──────────────────────────────────────────────────────────────────

function initFilters() {
  document.getElementById('filter-category').addEventListener('change', loadExpenses);
  document.getElementById('filter-month').addEventListener('change', loadExpenses);
  document.getElementById('clear-filters').addEventListener('click', () => {
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-month').value = '';
    loadExpenses();
  });
}

// ─── Boot ──────────────────────────────────────────────────────────────────────

async function init() {
  const dateInput = document.getElementById('date');
  const today = getTodayIsoDate();

  // Prevent selecting dates after today
  dateInput.max = today;
  dateInput.value = today;

  document.getElementById('expense-form').addEventListener('submit', addExpense);
  initTabs();
  initFilters();

  await loadCategories();
  await refresh();
}

document.addEventListener('DOMContentLoaded', init);
