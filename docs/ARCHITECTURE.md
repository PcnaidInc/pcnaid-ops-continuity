# Architecture and Operating Boundaries — Continuity Tool

## Execution Paths

The CLI reads explicitly chosen files, validates their schema, executes graph-based rule evaluations, and writes an assessment packet to a chosen output directory.

1. **Validation & Normalization**: Inputs are loaded and validated against the schema defined in `src/continuity/model.mjs`. Unknown fields, prototype mutations, or corrupt structures fail immediately.
2. **Analysis Engine**: `src/continuity/analyze.mjs` runs rule checks across workflows, principals, connections, and sources. Relationships are modeled as a directed graph. Upstream risk propagation uses a breadth-first search with visited-edge tracking to guarantee termination without recursion overflow even on cyclical graphs.
3. **Artifact Generation**: `src/shared/reports.mjs` generates self-contained HTML summaries, CSV finding tables with formula injection defenses, Graphviz DOT visualizations, and an uncompressed ZIP STORE packet with a SHA-256 manifest.

## Data Lifecycle

- **Local-Only**: Analysis is completely offline and executes in-process on the local machine.
- **No Overwrite by Default**: CLI output refuses to overwrite existing directories or files unless `--force` is explicitly provided.
- **Non-Symlink Traversal**: Filesystem operations enforce regular non-symlink checks to prevent directory traversal and symlink-following attacks.

## Boundaries and Constraints

- **Read-Only**: The tool performs inspection only. It never connects to cloud APIs, runs remote webhooks, reassigns owners, or modifies external systems.
- **Uncertainty Propagation**: Missing data or unverified connections produce explicit `unknown` findings rather than guessed boolean values.
