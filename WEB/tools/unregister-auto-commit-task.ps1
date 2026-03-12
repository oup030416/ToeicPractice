[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$taskName = "TOEIC-WEB-AutoCommit"
$startupLauncher = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\TOEIC-WEB-AutoCommit.cmd"

$processes = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -match "^powershell(\.exe)?$" -and
    $_.CommandLine -like "*auto-commit-web.ps1*"
  }

foreach ($process in $processes) {
  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}

$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($null -ne $existingTask) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

if (Test-Path $startupLauncher) {
  Remove-Item -Force $startupLauncher
}

Write-Output "Unregistered: $taskName"
