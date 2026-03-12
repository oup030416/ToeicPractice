[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$taskName = "TOEIC-WEB-AutoCommit"
$scriptDir = Split-Path -Parent $PSCommandPath
$webRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
$repoRoot = (& git -C $webRoot rev-parse --show-toplevel).Trim()
$watcherScript = Join-Path $scriptDir "auto-commit-web.ps1"
$userId = "$env:USERDOMAIN\$env:USERNAME"
$taskDescription = "Watch WEB changes and auto-commit only that path"
$startupLauncher = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\TOEIC-WEB-AutoCommit.cmd"

if (-not (Test-Path $watcherScript)) {
  throw "Watcher script not found: $watcherScript"
}

$registrationMode = "startup-folder"

try {
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watcherScript`""
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew

  $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if ($null -ne $existingTask) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  }

  Register-ScheduledTask `
    -TaskName $taskName `
    -Description $taskDescription `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    | Out-Null

  $registrationMode = "scheduled-task"
}
catch {
  $launcherContent = @(
    "@echo off",
    "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watcherScript`""
  )
  Set-Content -Path $startupLauncher -Value $launcherContent -Encoding ASCII
}

$runningProcess = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -match "^powershell(\.exe)?$" -and
    $_.CommandLine -like "*auto-commit-web.ps1*"
  }

if ($null -eq $runningProcess) {
  Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", $watcherScript) `
    -WorkingDirectory $repoRoot `
    -WindowStyle Hidden
}

Write-Output "Registered: $taskName"
Write-Output "Mode: $registrationMode"
Write-Output "Watch path: $webRoot"
Write-Output "Commit scope: WEB only"
