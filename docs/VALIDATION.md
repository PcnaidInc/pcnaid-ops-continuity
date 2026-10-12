# Validation Record — Continuity Tool v0.1.0

This record describes the automated and functional checks for the continuity tool.

## Execution Environment

- Node.js >= 22.16.0
- Linux x86_64
- Zero third-party runtime npm dependencies

## Automated Checks

| Check | Result | Exit Code |
|---|---|---|
| Unit & Integration Tests (`node scripts/test.mjs`) | **57 passed; 0 failed** | **0** |
| Syntax Verification (`node scripts/check.mjs`) | **17 files passed** | **0** |
| Fictional Demo Generation (`node scripts/demo.mjs`) | **Generated reports/continuity** | **0** |

## Test Scope

Tests exercise:
- Normalization and schema validation of workflow inventories
- Departed or unavailable principal detection and edge-case propagation
- Single human owner alerts and missing business-owner documentation
- Connection expiry calculations and person-bound credential flags
- Transfer-sensitive endpoint identification (Zapier Catch Hooks)
- Stale and future source timestamps
- Upstream risk propagation across cycles
- Safe file I/O, symlink rejection, and formula escaping
