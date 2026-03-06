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

// Predefined categories
const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Health', 'Education', 'Other'];

function getTodayIsoDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
}

function isValidIsoDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// --- Routes ---

// GET /api/categories — list available categories
app.get('/api/categories', (req, res) => {
  res.json(CATEGORIES);
});

// GET /api/expenses — list all expenses (supports ?category= and ?month=YYYY-MM filters)
app.get('/api/expenses', (req, res) => {
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

// POST /api/expenses — add a new expense
app.post('/api/expenses', (req, res) => {
  const { amount, category, description, date } = req.body;
  const finalDate = date || getTodayIsoDate();

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  if (!category || !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  }

  if (!description || description.trim() === '') {
    return res.status(400).json({ error: 'description is required' });
  }

  if (!isValidIsoDateString(finalDate)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
  }

  if (finalDate > getTodayIsoDate()) {
    return res.status(400).json({ error: 'date cannot be in the future' });
  }

  const expense = {
    id: uuidv4(),
    amount: Math.round(parseFloat(amount) * 100) / 100,
    category,
    description: description.trim(),
    date: finalDate,
    createdAt: new Date().toISOString(),
  };

  expenses.push(expense);
  res.status(201).json(expense);
});

// DELETE /api/expenses/:id — remove an expense
app.delete('/api/expenses/:id', (req, res) => {
  const index = expenses.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Expense not found' });
  }
  const deleted = expenses.splice(index, 1)[0];
  res.json(deleted);
});

// GET /api/summary — spending summary (monthly total + category breakdown)
app.get('/api/summary', (req, res) => {
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

module.exports = { app, expenses: () => expenses, resetExpenses: () => { expenses = []; } };
