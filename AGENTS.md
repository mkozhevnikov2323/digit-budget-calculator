# Budget Calculator

## Development principles

- Do not rewrite the application from scratch.
- Prefer small, reviewable changes.
- Do not change public APIs unless necessary.
- Discuss significant refactoring before implementation.
- New functionality must include tests.
- Financial data is critical.

## Architecture

Frontend:
React, Vite, TypeScript, Redux, MUI,
React Hook Form, Yup, Jest, ESLint.

Backend:
Node.js, Express, TypeScript.

Database:
MongoDB.

## Database rules

Do not change MongoDB document structure without
explicit approval and a migration plan.

## AI features

AI/OCR must never automatically persist a recognized
financial transaction

Required flow:

image
→ recognition
→ parsed draft
→ user review
→ explicit confirmation
→ persistence

Prefer local processing where quality is acceptable.

## Frontend

Before finishing a change:

npm test
npm run lint
npm run build

## Communication

- Always respond to the user in Russian.
- Use English for code, identifiers, filenames, API names, commands, and commit messages.
- Technical explanations should be concise and in Russian.
