# Sources and Scope Decisions — Continuity Tool

## Technical Scope Decisions

1. **Read-Only Inspection**: The tool evaluates exported platform metadata without writing to or reconfiguring platform environments.
2. **Explicit Unknowns**: Missing relationships or unverified connection activity are recorded as `unknown` rather than assumed healthy or absent.
3. **No Automatic Entity Resolution**: Display names are never silently fuzzy-matched across systems. Cross-platform identifiers must be explicitly correlated.

## Primary Technical References Consulted

- Microsoft Power Platform PowerShell overview and read cmdlets: https://learn.microsoft.com/en-us/power-platform/admin/powerapps-powershell
- Microsoft flow-owner role command: https://learn.microsoft.com/en-us/powershell/module/microsoft.powerapps.administration.powershell/get-adminflowownerrole?view=pa-ps-latest
- Microsoft orphaned-flow guidance: https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/flow-management/manage-orphan-flow-when-owner-leaves-org
- Microsoft cloud-flow sharing/ownership guidance: https://learn.microsoft.com/en-us/power-automate/create-team-flows
- Zapier member-removal and asset-transfer documentation: https://help.zapier.com/hc/en-us/articles/8496281082253-Remove-members-from-your-Team-or-Enterprise-account
