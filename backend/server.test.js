const request = require('supertest');
const { app, resetExpenses } = require('./server');

beforeEach(() => {
  resetExpenses();
});

describe('GET /api/categories', () => {
  it('returns the list of categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain('Food');
    expect(res.body).toContain('Transport');
  });
});

describe('POST /api/expenses', () => {
  it('creates a new expense', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .send({ amount: 12.5, category: 'Food', description: 'Lunch', date: '2025-03-01' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      amount: 12.5,
      category: 'Food',
      description: 'Lunch',
      date: '2025-03-01',
    });
    expect(res.body.id).toBeDefined();
  });

  it('rejects invalid amount', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .send({ amount: -5, category: 'Food', description: 'Bad', date: '2025-03-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/amount/);
  });

  it('rejects invalid category', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .send({ amount: 10, category: 'Gadgets', description: 'Phone', date: '2025-03-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/category/);
  });

  it('rejects missing description', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .send({ amount: 10, category: 'Food', description: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/description/);
  });

  it('defaults to today when date is omitted', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await request(app)
      .post('/api/expenses')
      .send({ amount: 5, category: 'Food', description: 'Coffee' });
    expect(res.status).toBe(201);
    expect(res.body.date).toBe(today);
  });

  it('rejects future dates', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const res = await request(app)
      .post('/api/expenses')
      .send({ amount: 10, category: 'Food', description: 'Planned meal', date: futureDate });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/future/);
  });

  it('creates a recurring expense seed when recurrence is set', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .send({
        amount: 100,
        category: 'Bills',
        description: 'Internet',
        date: '2025-03-01',
        recurrence: 'monthly',
      });

    expect(res.status).toBe(201);
    expect(res.body.recurrence).toBe('monthly');
    expect(res.body.recurringRuleId).toBeDefined();
    expect(res.body.isRecurringSeed).toBe(true);
  });

  it('rejects invalid recurrence value', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .send({
        amount: 40,
        category: 'Bills',
        description: 'Water',
        date: '2025-03-01',
        recurrence: 'yearly',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/recurrence/);
  });
});

describe('GET /api/expenses', () => {
  beforeEach(async () => {
    await request(app).post('/api/expenses').send({ amount: 20, category: 'Food', description: 'Dinner', date: '2025-03-01' });
    await request(app).post('/api/expenses').send({ amount: 15, category: 'Transport', description: 'Bus', date: '2025-03-02' });
    await request(app).post('/api/expenses').send({ amount: 50, category: 'Shopping', description: 'Shirt', date: '2025-02-15' });
  });

  it('returns all expenses', async () => {
    const res = await request(app).get('/api/expenses');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
  });

  it('filters by category', async () => {
    const res = await request(app).get('/api/expenses?category=Food');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].category).toBe('Food');
  });

  it('filters by month', async () => {
    const res = await request(app).get('/api/expenses?month=2025-03');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('returns expenses sorted most-recent first', async () => {
    const res = await request(app).get('/api/expenses');
    const dates = res.body.map(e => e.date);
    expect(dates[0] >= dates[1]).toBe(true);
  });

  it('auto-generates due recurring expenses up to today', async () => {
    const now = new Date();
    const day2 = new Date(now);
    day2.setDate(now.getDate() - 2);
    const twoDaysAgo = day2.toISOString().split('T')[0];

    await request(app)
      .post('/api/expenses')
      .send({
        amount: 8,
        category: 'Food',
        description: 'Daily snack',
        date: twoDaysAgo,
        recurrence: 'daily',
      });

    const res = await request(app).get('/api/expenses');
    const recurringEntries = res.body.filter(e => e.description === 'Daily snack');

    expect(res.status).toBe(200);
    expect(recurringEntries.length).toBeGreaterThanOrEqual(3);
  });
});

describe('DELETE /api/expenses/:id', () => {
  it('deletes an expense by id', async () => {
    const createRes = await request(app)
      .post('/api/expenses')
      .send({ amount: 10, category: 'Food', description: 'Snack', date: '2025-03-01' });
    const id = createRes.body.id;

    const delRes = await request(app).delete(`/api/expenses/${id}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.id).toBe(id);

    const listRes = await request(app).get('/api/expenses');
    expect(listRes.body.find(e => e.id === id)).toBeUndefined();
  });

  it('returns 404 for non-existent id', async () => {
    const res = await request(app).delete('/api/expenses/nonexistent-id');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/summary', () => {
  it('returns summary with monthly total and category breakdown', async () => {
    const today = new Date().toISOString().split('T')[0];
    await request(app).post('/api/expenses').send({ amount: 30, category: 'Food', description: 'Groceries', date: today });
    await request(app).post('/api/expenses').send({ amount: 20, category: 'Transport', description: 'Taxi', date: today });

    const res = await request(app).get('/api/summary');
    expect(res.status).toBe(200);
    expect(res.body.monthlyTotal).toBe(50);
    expect(res.body.byCategory['Food']).toBe(30);
    expect(res.body.byCategory['Transport']).toBe(20);
    expect(res.body.totalExpenses).toBe(2);
    expect(res.body.allTimeTotal).toBe(50);
    expect(res.body.monthlyBreakdown).toBeDefined();
  });

  it('returns zero total when no expenses', async () => {
    const res = await request(app).get('/api/summary');
    expect(res.status).toBe(200);
    expect(res.body.monthlyTotal).toBe(0);
    expect(res.body.totalExpenses).toBe(0);
  });
});

describe('Recurring rules API', () => {
  it('lists recurring rules after creating a recurring expense', async () => {
    await request(app)
      .post('/api/expenses')
      .send({
        amount: 25,
        category: 'Bills',
        description: 'Subscription',
        date: '2025-03-01',
        recurrence: 'monthly',
      });

    const res = await request(app).get('/api/recurring-rules');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].recurrence).toBe('monthly');
    expect(res.body[0].paused).toBe(false);
  });

  it('pauses a recurring rule', async () => {
    const createRes = await request(app)
      .post('/api/expenses')
      .send({
        amount: 10,
        category: 'Food',
        description: 'Lunch plan',
        date: '2025-03-01',
        recurrence: 'weekly',
      });

    const ruleId = createRes.body.recurringRuleId;

    const patchRes = await request(app)
      .patch(`/api/recurring-rules/${ruleId}`)
      .send({ paused: true });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.paused).toBe(true);
  });
});
