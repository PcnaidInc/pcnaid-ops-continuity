# @pcnaid/ops-continuity

Local-first automation continuity assessment tool for inspecting workflow and connection ownership before an owner, credentials, or service account changes.

## What and why

When automation owners leave an organization or hand over projects, scheduled and webhook-driven automations in platforms like Microsoft Power Automate and Zapier frequently fail due to orphaned accounts, person-bound connections, expiring credentials, or unmanaged webhook endpoints.

`pcnaid-continuity` provides read-only, local-first inspection of exported workflow metadata. It identifies:
- Single human owners and unrecorded business ownership
- Person-bound or expired connections
- Departing technical owners and downstream impact propagation
- Transfer-sensitive endpoints (such as Zapier Catch Hooks)
- Missing dependency relationships and explicit coverage gaps

All analyses are local, offline, and deterministic. No cloud resources are created, transferred, or revoked.

## Install-free quickstart

Requires **Node.js >= 22.16.0**. Zero third-party npm dependencies.

```sh
# Verify syntax and run tests
npm run check
npm test

# Generate a fictional demonstration report
npm run demo
```

## Commands

### Run continuity assessment
```sh
node bin/pcnaid-continuity.mjs continuity \
  --input examples/continuity/inventory.json \
  --out reports/continuity \
  --departing person:alex \
  --as-of 2026-10-05T12:00:00Z
```

Outputs:
- `report.json`: Machine-readable assessment with findings and dependency graph
- `report.html`: Self-contained, printable summary
- `findings.csv`: Actionable handoff items with formulas escaped
- `packet.zip`: Unsigned ZIP STORE packet with SHA-256 manifest
- `dependency-graph.dot`: Graphviz DOT representation of relationships

### Import Zapier assets CSV
```sh
node bin/pcnaid-continuity.mjs import-zapier \
  --input examples/continuity/zapier-assets.csv \
  --org-id example-org \
  --org-name "Example Org" \
  --owner-id example-user \
  --owner-name "Alex Smith" \
  --captured-at 2026-10-05T12:00:00Z \
  --out local-output/zapier-inventory.json
```

### Import Power Automate admin export
```sh
node bin/pcnaid-continuity.mjs import-powerautomate \
  --input examples/continuity/powerautomate-admin.json \
  --out local-output/powerautomate-inventory.json
```
Use `scripts/export-powerautomate.ps1` in Windows PowerShell 5.1 with the official Microsoft PowerApps administration module to extract metadata.

### Merge inventories
```sh
node bin/pcnaid-continuity.mjs merge \
  --input local-output/zapier-inventory.json \
  --input local-output/powerautomate-inventory.json \
  --out local-output/merged-inventory.json
```

### Compare snapshots (diff)
```sh
node bin/pcnaid-continuity.mjs compare \
  --before examples/continuity/inventory.json \
  --after examples/continuity/after-handoff.json \
  --as-of 2026-10-05T12:00:00Z \
  --out local-output/comparison.json
```

Use `--force` to permit overwriting existing files in destination folders.

## Data handling and security model

- **Read-only**: The tool parses exported metadata. It does not contact external cloud APIs, execute workflow runs, transfer assets, or revoke access.
- **Local computation**: Analyses run entirely on the local machine with no telemetry or network transmission.
- **Redaction and safe I/O**: Common credential keys, authorization headers, private keys, and query parameters are redacted. File output rejects symlinks and prevents accidental overwrites without `--force`.
- **Integrity**: Generated packets include a SHA-256 manifest over all emitted artifacts.

## Operating limits

1. **Metadata-only**: The assessment analyzes provided exports. It cannot inspect third-party execution logs or live credentials.
2. **Conservative unknowns**: Missing relationships, unknown statuses, and unverified owners remain explicit unknowns rather than guessed positives.
3. **No automatic remediation**: Resolving findings requires platform-approved administrative actions in Power Automate or Zapier.
