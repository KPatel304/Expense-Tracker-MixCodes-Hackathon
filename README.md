# Expense Tracker (MixCodes Hackathon)

A full-stack expense tracker web app with a Node.js + Express backend and a vanilla JavaScript frontend.

The app lets you:
- Add expenses with amount, category, description, and date
- View monthly total, all-time total, and total expense count
- Visualize spending with category and monthly trend charts
- Filter expense history by category and month
- Delete expenses from the history list

## Tech Stack

- Backend: Node.js, Express, CORS, express-rate-limit
- Frontend: HTML, CSS, vanilla JavaScript
- Charts: Chart.js (local vendor file)
- Testing: Jest, Supertest

## Project Structure

```text
Expense-Tracker-MixCodes-Hackathon/
|-- README.md
|-- backend/
|   |-- package.json
|   |-- server.js
|   `-- server.test.js
`-- frontend/
		|-- index.html
		|-- css/
		|   `-- styles.css
		|-- js/
		|   `-- app.js
		`-- vendor/
				`-- chart.umd.js
```

## Prerequisites

- Node.js 18+ (recommended)
- npm 9+ (comes with Node.js)

## Getting Started

1. Go to the backend folder:

```bash
cd backend
```

2. Install dependencies:

```bash
npm install
```

3. Start the app:

```bash
npm run start
```

4. Open in browser:

```text
http://localhost:3000
```

The Express server serves both API routes and the static frontend.

## Available Scripts

Run these from `backend/`:

- `npm run start`: Starts the server with Node.js
- `npm run dev`: Starts the server with nodemon (auto-reload)
- `npm test`: Runs Jest tests with coverage

## Core Features

- Expense form with required fields and validations
- Category dropdown loaded from API
- Date picker capped at today (no future date selection)
- Server-side validation to reject invalid or future dates
- Summary cards for:
	- Current month total
	- All-time total
	- Number of expenses
- Chart tabs:
	- Doughnut chart: spending by category
	- Bar chart: spending trend over last 6 months
- Expense history sorted most-recent first
- Filtering by category and month (`YYYY-MM`)
- Delete expense action per row

## Data Model

Each expense object:

```json
{
	"id": "uuid",
	"amount": 12.5,
	"category": "Food",
	"description": "Lunch",
	"date": "2026-03-06",
	"createdAt": "2026-03-06T10:30:00.000Z"
}
```

## Validation Rules

- `amount`: must be a positive number
- `category`: must be one of:
	- `Food`
	- `Transport`
	- `Entertainment`
	- `Shopping`
	- `Bills`
	- `Health`
	- `Education`
	- `Other`
- `description`: required, non-empty text
- `date`:
	- must be in `YYYY-MM-DD` format
	- cannot be in the future
	- defaults to today if omitted

## API Reference

Base URL:

```text
http://localhost:3000/api
```

### `GET /api/categories`

Returns available categories.

Response example:

```json
["Food", "Transport", "Entertainment", "Shopping", "Bills", "Health", "Education", "Other"]
```

### `GET /api/expenses`

Returns expense list sorted by most recent date first.

Optional query params:
- `category=<CategoryName>`
- `month=YYYY-MM`

Examples:

```text
GET /api/expenses
GET /api/expenses?category=Food
GET /api/expenses?month=2026-03
GET /api/expenses?category=Food&month=2026-03
```

### `POST /api/expenses`

Creates a new expense.

Request body:

```json
{
	"amount": 25.99,
	"category": "Food",
	"description": "Groceries",
	"date": "2026-03-06"
}
```

Successful response: `201 Created` with created expense object.

Validation errors: `400 Bad Request` with:

```json
{ "error": "..." }
```

### `DELETE /api/expenses/:id`

Deletes an expense by ID.

- Success: `200 OK` with deleted object
- Not found: `404 Not Found`

### `GET /api/summary`

Returns dashboard summary values.

Response shape:

```json
{
	"currentMonth": "2026-03",
	"monthlyTotal": 0,
	"byCategory": {
		"Food": 0,
		"Transport": 0,
		"Entertainment": 0,
		"Shopping": 0,
		"Bills": 0,
		"Health": 0,
		"Education": 0,
		"Other": 0
	},
	"monthlyBreakdown": {
		"2025-10": 0,
		"2025-11": 0,
		"2025-12": 0,
		"2026-01": 0,
		"2026-02": 0,
		"2026-03": 0
	},
	"totalExpenses": 0,
	"allTimeTotal": 0
}
```

## Rate Limiting

The server applies a global request limiter:
- Window: 1 minute
- Max requests per IP: 100

If exceeded, clients will receive standard rate-limit responses from `express-rate-limit`.

## Testing

Run backend tests:

```bash
cd backend
npm test
```

Test coverage includes:
- Categories endpoint
- Expense creation and validation
- Future-date rejection
- Filtering and sorting
- Deletion behavior
- Summary endpoint behavior

## Notes and Limitations

- Data storage is in-memory only (`expenses` array in server process)
- Restarting the server clears all stored expenses
- No authentication/authorization is implemented

## Quick Troubleshooting

- App not opening: verify backend server is running on `http://localhost:3000`
- Empty category dropdown: check `GET /api/categories` in browser dev tools network tab
- Cannot add expense: inspect error message below the form and API response message
- Future date blocked: expected behavior by design on both frontend and backend

## Prompts Used

### Repository setup prompt

When creating the repo, we entered the requirements from the Challenge page README, copying everything up to Quick Start Tips.

### Agent mode prompts used in VS Code

After setup completed, we cloned the repo and used VS Code agent mode with these prompts:

- `Provide the running instructions and then run it`
- `Format the date picker to prevent selecting future dates. Add this to the expense date selector validation.`
- `Add full documentation to the README file`

### Outcome

- Running instructions were provided and the app was run.
- A bug was identified allowing future expense dates.
- The date picker and expense date validation were updated to block future dates.
- Full README documentation was added.

## License

No license file is currently defined in this repository.