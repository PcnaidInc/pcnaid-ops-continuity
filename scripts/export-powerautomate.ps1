#requires -Version 5.1
<#
Read-only, one-environment export for Pcnaid Continuity Tool.
Requires Microsoft.PowerApps.Administration.PowerShell installed by the administrator.
Sign in separately with Add-PowerAppsAccount. No password is accepted by this script.
This helper has NOT been run against a production tenant in the delivered validation.
Only explicitly selected metadata fields are written. No flow definitions or secrets are exported.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$EnvironmentName,
  [Parameter(Mandatory=$true)][string]$OrganizationId,
  [Parameter(Mandatory=$true)][string]$OrganizationName,
  [Parameter(Mandatory=$true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSEdition -ne 'Desktop') { throw 'Use Windows PowerShell 5.1, not PowerShell 7, for the Microsoft admin module.' }
if (Test-Path -LiteralPath $OutputPath) { throw 'Output already exists. Choose a new file; this exporter never overwrites.' }
Import-Module Microsoft.PowerApps.Administration.PowerShell -ErrorAction Stop
function Value-At($Object, [string]$Path) {
  $value = $Object
  foreach ($part in $Path.Split('.')) {
    if ($null -eq $value) { return $null }
    if ($value -is [System.Collections.IDictionary]) {
      if (-not $value.Contains($part)) { return $null }; $value = $value[$part]
    } else {
      $property = $value.PSObject.Properties[$part]
      if ($null -eq $property) { return $null }; $value = $property.Value
    }
  }
  return $value
}
function First-Text($Object, [string[]]$Paths) {
  foreach ($path in $Paths) { $value = Value-At $Object $path; if ($null -ne $value -and [string]$value -ne '') { return [string]$value } }
  return $null
}
function Members($Object) {
  if ($Object -is [System.Collections.IDictionary]) { return @($Object.Values) }
  if ($null -eq $Object) { return @() }
  return @($Object.PSObject.Properties | ForEach-Object { $_.Value })
}
$warnings = New-Object 'System.Collections.Generic.List[string]'
$warnings.Add('One environment only. Inventory visibility depends on the signed-in account and Microsoft module behavior. Validate counts in the native admin center.')
$warnings.Add('Principal activity, auth binding, health, expiry, business ownership, endpoint transfer behavior, and complete connection coverage require administrator confirmation.')
$flowsOut = New-Object 'System.Collections.Generic.List[object]'
$connectionsOut = New-Object 'System.Collections.Generic.List[object]'
# Get-AdminFlow, Get-AdminFlowOwnerRole, and Get-AdminPowerAppConnection are read operations.
$flows = @(Get-AdminFlow -EnvironmentName $EnvironmentName -ErrorAction Stop)
foreach ($flow in $flows) {
  $flowId = First-Text $flow @('FlowName','Internal.name')
  if (-not $flowId) { $warnings.Add('A flow without a recognized ID was omitted; inventory is incomplete.'); continue }
  $name = First-Text $flow @('DisplayName','Internal.properties.displayName')
  if (-not $name) { $name = $flowId }
  $ownersOut = New-Object 'System.Collections.Generic.List[object]'
  $ownersComplete = $false
  try {
    $roles = @(Get-AdminFlowOwnerRole -EnvironmentName $EnvironmentName -FlowName $flowId -ErrorAction Stop)
    $unparsed = $false
    foreach ($role in $roles) {
      $principalId = First-Text $role @('PrincipalObjectId','PrincipalId','Internal.properties.principal.id')
      if (-not $principalId) { $unparsed=$true; continue }
      $ownerName = First-Text $role @('PrincipalDisplayName','Internal.properties.principal.displayName')
      if (-not $ownerName) { $ownerName=$principalId }
      $ownersOut.Add([ordered]@{ id=$principalId; name=$ownerName; kind='unknown' })
    }
    # Even a successful read is conservatively partial until administrator reconciles native counts.
    if ($unparsed) { $warnings.Add("Some owner records for $flowId could not be normalized.") }
  } catch { $warnings.Add("Owner lookup failed for $flowId. No raw error response or credential was exported.") }
  $connectionIds = New-Object 'System.Collections.Generic.List[string]'
  $references = Value-At $flow 'Internal.properties.connectionReferences'
  foreach ($reference in @(Members $references)) {
    $connectionName = First-Text $reference @('connectionName')
    if ($connectionName) { $connectionIds.Add(($connectionName.TrimEnd('/').Split('/')[-1])) }
  }
  $state = First-Text $flow @('State','Internal.properties.state')
  if (-not $state) { $state='unknown' }
  $flowsOut.Add([ordered]@{
    id=$flowId; name=$name; environmentId=$EnvironmentName
    owners=@($ownersOut.ToArray() | Sort-Object id -Unique); ownersComplete=$ownersComplete
    connectionIds=@($connectionIds.ToArray() | Select-Object -Unique); connectionsComplete=$false
    endpoints=@(); state=$state; solutionAware=$null
  })
}
try {
  $connections = @(Get-AdminPowerAppConnection -EnvironmentName $EnvironmentName -ErrorAction Stop)
  foreach ($connection in $connections) {
    $id = First-Text $connection @('ConnectionName','Internal.name')
    if (-not $id) { $warnings.Add('A connection without a recognized ID was omitted.'); continue }
    $id=$id.TrimEnd('/').Split('/')[-1]
    $name=First-Text $connection @('DisplayName','Internal.properties.displayName')
    if (-not $name) { $name=$id }
    # createdBy is deliberately NOT treated as the current authentication owner.
    $connectionsOut.Add([ordered]@{ id=$id; environmentId=$EnvironmentName; name=$name; owner=$null; status='unknown'; expiresAt=$null })
  }
} catch { $warnings.Add('Connection inventory lookup failed. Referenced connections remain unresolved; the output is incomplete.') }
$output=[ordered]@{
  format='pcnaid-powerautomate-admin-v1'
  organization=[ordered]@{ id=$OrganizationId; name=$OrganizationName }
  capturedAt=[DateTime]::UtcNow.ToString('o')
  flows=@($flowsOut.ToArray()); connections=@($connectionsOut.ToArray())
  warnings=@($warnings.ToArray())
}
# Node's importer accepts millisecond timestamps; truncate .NET's seven fractional digits.
$output.capturedAt=[DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
$fullPath=[IO.Path]::GetFullPath($OutputPath)
$parent=[IO.Path]::GetDirectoryName($fullPath)
if (-not (Test-Path -LiteralPath $parent -PathType Container)) { throw 'Create the destination directory first.' }
$json=$output | ConvertTo-Json -Depth 20
$stream=[IO.File]::Open($fullPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try { $bytes=(New-Object Text.UTF8Encoding($false)).GetBytes($json); $stream.Write($bytes,0,$bytes.Length) } finally { $stream.Dispose() }
Write-Host "Wrote $($flowsOut.Count) flow records and $($connectionsOut.Count) connection records."
Write-Host 'Review metadata and warnings locally, then run import-powerautomate. No cloud resources were changed.'
