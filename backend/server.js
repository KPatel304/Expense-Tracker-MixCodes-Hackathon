const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rate limiter: max 100 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// In-memory expense storage (data is not persisted across server restarts)
let expenses = [];
let recurringRules = [];

// Predefined categories
const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Health', 'Education', 'Other'];
const RECURRENCE_TYPES = ['none', 'daily', 'weekly', 'monthly'];

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
}

function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().split('T')[0] === value;
}

function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatISODate(date);
}

function addOneMonth(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetMonthIndex = month;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = (targetMonthIndex % 12) + 1;
  const lastDay = new Date(targetYear, targetMonth, 0).getDate();
  const nextDay = Math.min(day, lastDay);
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
}

function nextDateByRecurrence(dateStr, recurrence) {
  if (recurrence === 'daily') return addDays(dateStr, 1);
  if (recurrence === 'weekly') return addDays(dateStr, 7);
  if (recurrence === 'monthly') return addOneMonth(dateStr);
  return dateStr;
}

function createExpense({ amount, category, description, date, recurringRuleId = null, recurrence = 'none', isRecurringSeed = false }) {
  return {
    id: uuidv4(),
    amount: Math.round(parseFloat(amount) * 100) / 100,
    category,
    description: description.trim(),
    date,
    recurrence,
    recurringRuleId,
    isRecurringSeed,
    createdAt: new Date().toISOString(),
  };
}

function generateRecurringExpenses(referenceDate = todayISO()) {
  for (const rule of recurringRules) {
    if (rule.paused) {
      continue;
    }

    let safety = 0;

    while (rule.nextDate <= referenceDate && safety < 2000) {
      if (rule.endDate && rule.nextDate > rule.endDate) break;

      const alreadyExists = expenses.some(
        e => e.recurringRuleId === rule.id && e.date === rule.nextDate,
      );

      if (!alreadyExists) {
        expenses.push(createExpense({
          amount: rule.amount,
          category: rule.category,
          description: rule.description,
          date: rule.nextDate,
          recurringRuleId: rule.id,
          recurrence: rule.recurrence,
          isRecurringSeed: false,
        }));
      }

      rule.nextDate = nextDateByRecurrence(rule.nextDate, rule.recurrence);
      safety += 1;
    }
  }
}

// --- Routes ---

// GET /api/categories — list available categories
app.get('/api/categories', (req, res) => {
  res.json(CATEGORIES);
});

// GET /api/expenses — list all expenses (supports ?category= and ?month=YYYY-MM filters)
app.get('/api/expenses', (req, res) => {
  generateRecurringExpenses();
  let result = [...expenses];

  if (req.query.category) {
    result = result.filter(e => e.category === req.query.category);
  }

  if (req.query.month) {
    result = result.filter(e => e.date.startsWith(req.query.month));
  }

  // Return most-recent first
  result.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(result);
});

// GET /api/recurring-rules — list recurring schedules
app.get('/api/recurring-rules', (req, res) => {
  const rules = [...recurringRules]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(rule => ({
      id: rule.id,
      amount: rule.amount,
      category: rule.category,
      description: rule.description,
      recurrence: rule.recurrence,
      startDate: rule.startDate,
      nextDate: rule.nextDate,
      endDate: rule.endDate,
      paused: rule.paused,
      createdAt: rule.createdAt,
    }));

  res.json(rules);
});

// POST /api/expenses — add a new expense
app.post('/api/expenses', (req, res) => {
  const { amount, category, description, date, recurrence = 'none', recurrenceEndDate } = req.body;

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  if (!category || !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  }

  if (!description || description.trim() === '') {
    return res.status(400).json({ error: 'description is required' });
  }

  if (!RECURRENCE_TYPES.includes(recurrence)) {
    return res.status(400).json({ error: `recurrence must be one of: ${RECURRENCE_TYPES.join(', ')}` });
  }

  const expenseDate = date || todayISO();
  if (!isValidISODate(expenseDate)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
  }

  if (expenseDate > todayISO()) {
    return res.status(400).json({ error: 'date cannot be in the future' });
  }

  if (recurrenceEndDate && !isValidISODate(recurrenceEndDate)) {
    return res.status(400).json({ error: 'recurrenceEndDate must be in YYYY-MM-DD format' });
  }

  if (recurrence !== 'none' && recurrenceEndDate && recurrenceEndDate < expenseDate) {
    return res.status(400).json({ error: 'recurrenceEndDate must be on or after date' });
  }

  let recurringRuleId = null;
  if (recurrence !== 'none') {
    recurringRuleId = uuidv4();
    recurringRules.push({
      id: recurringRuleId,
      amount: Number(amount),
      category,
      description: description.trim(),
      recurrence,
      startDate: expenseDate,
      nextDate: nextDateByRecurrence(expenseDate, recurrence),
      endDate: recurrenceEndDate || null,
      paused: false,
      createdAt: new Date().toISOString(),
    });
  }

  const expense = createExpense({
    amount,
    category,
    description,
    date: expenseDate,
    recurrence,
    recurringRuleId,
    isRecurringSeed: recurrence !== 'none',
  });

  expenses.push(expense);
  res.status(201).json(expense);
});

// PATCH /api/recurring-rules/:id — pause/resume a schedule
app.patch('/api/recurring-rules/:id', (req, res) => {
  const rule = recurringRules.find(r => r.id === req.params.id);
  if (!rule) {
    return res.status(404).json({ error: 'Recurring rule not found' });
  }

  if (typeof req.body.paused !== 'boolean') {
    return res.status(400).json({ error: 'paused must be a boolean' });
  }

  rule.paused = req.body.paused;
  res.json(rule);
});

// DELETE /api/recurring-rules/:id — remove a recurring schedule
app.delete('/api/recurring-rules/:id', (req, res) => {
  const index = recurringRules.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Recurring rule not found' });
  }

  const deleted = recurringRules.splice(index, 1)[0];
  res.json(deleted);
});

// DELETE /api/expenses/:id — remove an expense
app.delete('/api/expenses/:id', (req, res) => {
  const index = expenses.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Expense not found' });
  }
  const deleted = expenses.splice(index, 1)[0];

  if (deleted.isRecurringSeed && deleted.recurringRuleId) {
    recurringRules = recurringRules.filter(rule => rule.id !== deleted.recurringRuleId);
  }

  res.json(deleted);
});

// GET /api/summary — spending summary (monthly total + category breakdown)
app.get('/api/summary', (req, res) => {
  generateRecurringExpenses();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthlyExpenses = expenses.filter(e => e.date.startsWith(currentMonth));

  const monthlyTotal = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Category breakdown for all time
  const byCategory = {};
  CATEGORIES.forEach(cat => { byCategory[cat] = 0; });
  expenses.forEach(e => {
    byCategory[e.category] = parseFloat(((byCategory[e.category] || 0) + e.amount).toFixed(2));
  });

  // Monthly breakdown (last 6 months)
  const monthlyBreakdown = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyBreakdown[key] = 0;
  }
  expenses.forEach(e => {
    const month = e.date.substring(0, 7);
    if (month in monthlyBreakdown) {
      monthlyBreakdown[month] = parseFloat((monthlyBreakdown[month] + e.amount).toFixed(2));
    }
  });

  res.json({
    currentMonth,
    monthlyTotal: parseFloat(monthlyTotal.toFixed(2)),
    byCategory,
    monthlyBreakdown,
    totalExpenses: expenses.length,
    allTimeTotal: parseFloat(expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)),
  });
});

// Catch-all: serve index.html for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Only start server when run directly (not during tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Expense Tracker server running on http://localhost:${PORT}`);
  });
}

module.exports = {
  app,
  expenses: () => expenses,
  resetExpenses: () => {
    expenses = [];
    recurringRules = [];
  },
};
