# Repository Guidelines

## Project Structure & Module Organization

This directory currently contains planning materials only:

- `PRD_Prototype_AgriData_Connect.md`: authoritative requirements, architecture, API contracts, and acceptance criteria.
- `AgriData_Connect_Charte_essentielle.pdf`: visual identity reference.
- `parcourt_utilisateur.png`: user journey illustration.

The planned prototype uses React, strict TypeScript, Vite, CSS, and Mock Service Worker (MSW). Follow PRD section 10: `src/app/` for routing and session setup, `components/` for shared UI, `features/` for business modules, `domain/` for rules, `services/` for API access, `mocks/` for handlers, seed data, and persistence, and `styles/` and `assets/` for presentation resources. Place the generated MSW worker in `public/`.

## Build, Test, and Development Commands

No `package.json`, dependency lockfile, or runnable scripts exist yet. When scaffolding, define and document these proposed commands:

- `npm install`: install dependencies; commit the resulting lockfile.
- `npm run dev`: start Vite locally.
- `npm run build`: check TypeScript and create the production build.
- `npm run preview`: serve that build for acceptance checks.
- `npm test`: run Vitest tests.

Serve the application over HTTP; do not open HTML files directly.

## Coding Style & Naming Conventions

Use strict TypeScript, reusable React components, and CSS brand variables. Proposed defaults are two-space indentation, PascalCase component filenames, camelCase functions and variables, and `use`-prefixed hooks. No formatter or linter is configured yet.

Keep interface text in French. Route data access through the API client, MSW handlers, domain rules, and shared repository. Components must not write directly to localStorage.

## Testing Guidelines

The PRD specifies Vitest for critical rules and browser journeys, optionally automated with Playwright. No coverage threshold or test suite currently exists. Use `*.test.ts` for colocated unit tests and `*.spec.ts` for browser scenarios.

Cover calculations, stock reservations, permissions, transitions, idempotence, and dispute resolutions. Verify AC01 through AC29 against the production build, including reload persistence, mobile layouts, and keyboard access.

## Commit & Pull Request Guidelines

No Git metadata is present, so commit conventions cannot be inferred. Use concise imperative subjects, such as `Add order reservation validation`. PR descriptions should identify scope, relevant PRD criteria, validation results, and screenshots for UI changes.

## Agent & Prototype Constraints

Reach at least 95% confidence before editing; ask follow-up questions when needed. Avoid em dash characters. Keep payments, identities, notifications, and transport integrations simulated. Never add real credentials or customer data.
