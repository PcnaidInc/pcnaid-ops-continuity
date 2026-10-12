# Agent Guidelines for @pcnaid/ops-continuity

This file provides architectural context and operational constraints for AI agents and automation working in this repository.

## Architecture

- `bin/pcnaid-continuity.mjs`: CLI binary entry point.
- `src/cli.mjs`: CLI argument parsing, execution routing, and output saving.
- `src/continuity/analyze.mjs`: Core graph analysis, rule evaluation, and impact propagation.
- `src/continuity/importers.mjs`: Importers for Zapier CSV and Power Automate admin exports.
- `src/continuity/model.mjs`: Data schema validation, normalization, merging, and annotations.
- `src/shared/data.mjs`: Universal data utilities (JSON/CSV parsing, hashing, canonical sorting, redaction).
- `src/shared/io.mjs`: Filesystem utilities with non-symlink verification and atomic file writing.
- `src/shared/reports.mjs`: HTML report rendering, CSV table export, DOT dependency graph generation, and ZIP packet packing.
- `src/shared/zip.mjs`: Single-disk ZIP STORE generator and validator.

## Operating Principles

1. **Zero External Dependencies**: Do not introduce dependencies from npm. Use only Node.js standard modules.
2. **Strict Validation**: All data crossing module boundaries must be validated via `validateInventory` or data utility assertions.
3. **No Credential Logging**: Never print or persist tokens, secrets, or raw private keys.
4. **Preserve Unknowns**: Incomplete coverage must be recorded as `unknown`, never defaulted to falsy or true values.
