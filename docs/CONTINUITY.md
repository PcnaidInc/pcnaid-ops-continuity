# Continuity Inputs and Operating Guide

## Normalized Contract

`version` must equal `"1"`. The executable validator is `src/continuity/model.mjs`; `examples/continuity/inventory.json` is a complete reference example.

Top-level fields:
- `organization`: `{id, name}`
- `capturedAt`: ISO 8601 timestamp with explicit timezone
- `sources`: Source records (`id`, `type`, `label`, `collectedAt`, optional `sha256`, `coverage`)
- `principals`: Identity records (`id`, `name`, `kind`, `status`, `sourceId`)
- `connections`: Credential and connector records (`id`, `platform`, `name`, nullable `ownerId`, `binding`, `status`, nullable `expiresAt`, `sourceId`)
- `workflows`: Workflow records (`id`, `platform`, `name`, `ownerIds`, nullable `businessOwner`, nullable `purpose`, `connectionIds`, `dependsOnWorkflowIds`, `endpoints`, `state`, `coverage`, nullable `solutionAware`, `sourceId`)
- `warnings`: Array of operational warning strings

Graph IDs across principals, connections, and workflows must be globally unique within the inventory.

## Zapier CSV Import

```sh
node bin/pcnaid-continuity.mjs import-zapier \
  --input examples/continuity/zapier-assets.csv \
  --org-id example-org \
  --org-name "Example Org" \
  --owner-id member-id \
  --owner-name "Exporting Member" \
  --captured-at 2026-10-05T12:00:00Z \
  --out local-output/zapier.json
```

The importer expects standard Zapier CSV export columns (`Type`, `ID`, `Name`), recognizes Zap and Auth/connection rows, and ignores other rows with warnings. The caller identifies the exporting member whose assets are being imported. Because the export does not record workflow-to-connection edges, those remain marked `unknown`.

## Power Automate Export

Run `scripts/export-powerautomate.ps1` in Windows PowerShell 5.1 with the official Microsoft administration module installed:

```powershell
Add-PowerAppsAccount

.\scripts\export-powerautomate.ps1 `
  -EnvironmentName 'YOUR-ENVIRONMENT-ID' `
  -OrganizationId 'org-id' `
  -OrganizationName 'Organization name' `
  -OutputPath '.\local-output\powerautomate-admin.json'
```

Then normalize into the continuity schema:

```sh
node bin/pcnaid-continuity.mjs import-powerautomate \
  --input local-output/powerautomate-admin.json \
  --out local-output/powerautomate.json
```

The importer accepts the `pcnaid-powerautomate-admin-v1` format emitted by the script.

## Annotations, Scenarios, and Comparisons

```sh
node bin/pcnaid-continuity.mjs continuity \
  --input examples/continuity/inventory.json \
  --annotations examples/continuity/annotations.json \
  --departing person:alex \
  --as-of 2026-10-05T12:00:00Z \
  --out local-output/annotated

node bin/pcnaid-continuity.mjs compare \
  --before examples/continuity/inventory.json \
  --after examples/continuity/after-handoff.json \
  --as-of 2026-10-05T12:00:00Z \
  --out local-output/comparison.json
```

Annotation files supply human business owner or purpose annotations without modifying original technical exports. Departing scenarios simulate access changes without affecting underlying systems.
