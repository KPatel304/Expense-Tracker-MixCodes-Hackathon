# Copilot Instructions for Expense Tracker

These instructions define coding standards for this repository.

## Project Context

- Full-stack JavaScript app.
- Backend: Express API in `backend/server.js`.
- Frontend: static HTML/CSS/JS in `frontend/`.
- Data storage is in-memory (`expenses` array), so overall behavior should remain simple and predictable; IDs and timestamps are expected to vary between runs.

## Core Principles

- Prefer small, focused changes over broad refactors.
- Keep behavior backward compatible unless the task explicitly requires a change.
- Validate on both client and server for all user inputs.
- Favor readability and maintainability over clever one-liners.

## Backend Guidelines

- Follow existing route conventions under `/api/*`.
- Use explicit validation for request payloads:
  - required fields
  - allowed value checks
  - date and number format checks
  - business rules (for example, no future expense dates)
- Return consistent JSON error responses in the shape `{ "error": "message" }`.
- Keep HTTP status codes correct:
  - `200` for successful reads/deletes
  - `201` for successful creation
  - `400` for validation errors
  - `404` for missing resources
- Avoid introducing persistent databases unless requested.
- Do not remove or bypass rate limiting middleware.

## Frontend Guidelines

- Keep logic in `frontend/js/app.js` modular and function-based.
- Always sanitize user-rendered text (use `escapeHtml` pattern for inserted strings).
- Preserve existing UX patterns:
  - toast messages for feedback
  - form error text for validation issues
  - chart tab behavior and empty states
- Date fields must enforce non-future constraints in UI (`max`) and submit validation.
- Keep API calls centralized through `apiFetch`.

## API and Data Contract

- Do not change field names without explicit request (`id`, `amount`, `category`, `description`, `date`, `createdAt`).
- Keep category values aligned with backend `CATEGORIES`.
- Preserve sort behavior (most recent expenses first).

## Testing Requirements

- Add or update Jest/Supertest tests in `backend/server.test.js` for any backend behavior change.
- New validations must include at least one negative test case.
- Do not lower test coverage intentionally.

## Code Style

- Use `const` by default, `let` only when reassignment is required.
- Use clear variable names (`selectedDate`, `monthlyBreakdown`) over abbreviations.
- Keep functions short; extract helpers when logic repeats.
- Match existing formatting and comment style.
- Keep comments meaningful and brief; avoid obvious comments.

## Security and Reliability

- Treat all request input as untrusted.
- Do not expose stack traces or internal details in API responses.
- Avoid `innerHTML` for unsanitized user content.
- Keep dependency additions minimal and justified.

## Documentation

- Update `README.md` when changing:
  - setup/run instructions
  - API behavior
  - validation rules
  - key features

## Non-Goals Unless Requested

- No framework migrations.
- No TypeScript conversion.
- No authentication system changes.
- No database integration.
