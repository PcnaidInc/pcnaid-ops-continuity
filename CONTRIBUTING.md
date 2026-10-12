# Contributing to @pcnaid/ops-continuity

Thank you for contributing to the continuity assessment tool.

## Development Workflow

This codebase has **zero third-party dependencies**. It relies strictly on Node.js built-in APIs (`node:fs`, `node:path`, `node:crypto`, `node:child_process`).

### Prerequisites
- Node.js >= 22.16.0
- npm >= 10.0.0

### Running Checks and Tests
Before opening a pull request, run the test and check suites:

```sh
npm run check
npm test
npm run demo
```

All commands must exit cleanly with exit code 0.

## Coding Guidelines

1. **Security-First**: Maintain all security assertions. Do not weaken input validation, prototype pollution guards, symlink checks, or secret redaction.
2. **Explicit Unknowns**: When platform relationships or metadata fields are absent or ambiguous, preserve them as `unknown`. Do not guess booleans or identities.
3. **Deterministic Output**: Reports and packet contents must sort keys canonically where applicable to ensure reproducibility.
4. **Code Quality**: Keep code clean, modern ESM, and accompanied by automated tests.

## Pull Request Process

1. Create a descriptive branch for your changes.
2. Ensure existing tests pass and add new tests covering your modifications.
3. Submit a pull request following the repository's pull request template.
