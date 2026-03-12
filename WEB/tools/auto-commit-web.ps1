[CmdletBinding()]
param(
  [int]$DebounceMilliseconds = 4000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $PSCommandPath
$webRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
$repoRoot = (& git -C $webRoot rev-parse --show-toplevel).Trim()

if ([string]::IsNullOrWhiteSpace($repoRoot)) {
  throw "Unable to locate the git repository root."
}

$webRelativePath = "WEB"
$stateDir = Join-Path $webRoot ".auto-commit"
$logPath = Join-Path $stateDir "watcher.log"

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

function Write-Log {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $logPath -Value "[$timestamp] $Message"
}

function Should-IgnorePath {
  param(
    [string]$Path
  )

  if ([string]::IsNullOrWhiteSpace($Path)) {
    return $true
  }

  $normalizedPath = $Path.Replace("/", "\")
  $ignoredSegments = @(
    "\node_modules\",
    "\dist\",
    "\.auto-commit\"
  )

  foreach ($segment in $ignoredSegments) {
    if ($normalizedPath -like "*$segment*") {
      return $true
    }
  }

  return $false
}

function Get-WebStatusLines {
  $output = & git -C $repoRoot status --porcelain=v1 --untracked-files=all -- $webRelativePath 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to read WEB status. $($output -join ' ')"
  }

  return @($output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Invoke-WebCommit {
  if ($script:isCommitRunning) {
    return
  }

  $script:isCommitRunning = $true

  try {
    $statusLines = Get-WebStatusLines
    if ($statusLines.Count -eq 0) {
      return
    }

    & git -C $repoRoot add -A -- $webRelativePath 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Unable to stage WEB changes."
    }

    & git -C $repoRoot diff --cached --quiet -- $webRelativePath
    $diffExitCode = $LASTEXITCODE

    if ($diffExitCode -eq 0) {
      return
    }

    if ($diffExitCode -ne 1) {
      throw "Unable to diff staged WEB changes."
    }

    $commitMessage = "chore(web): auto-commit $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
    $commitOutput = & git -C $repoRoot commit --only -m $commitMessage -- $webRelativePath 2>&1

    if ($LASTEXITCODE -ne 0) {
      throw "WEB auto-commit failed. $($commitOutput -join ' ')"
    }

    Write-Log "Commit completed: $commitMessage"
  }
  catch {
    Write-Log "Error: $($_.Exception.Message)"
  }
  finally {
    $script:isCommitRunning = $false
  }
}

$sha256 = [System.Security.Cryptography.SHA256]::Create()
$mutexSeed = [System.Text.Encoding]::UTF8.GetBytes($repoRoot)
$mutexHash = ([System.BitConverter]::ToString($sha256.ComputeHash($mutexSeed))).Replace("-", "")
$mutex = [System.Threading.Mutex]::new($false, "Global\TOEIC_WEB_AUTOCOMMIT_$mutexHash")

if (-not $mutex.WaitOne(0, $false)) {
  Write-Log "Another WEB auto-commit watcher is already running."
  exit 0
}

$watcher = [System.IO.FileSystemWatcher]::new($webRoot)
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]::FileName `
  -bor [System.IO.NotifyFilters]::DirectoryName `
  -bor [System.IO.NotifyFilters]::LastWrite `
  -bor [System.IO.NotifyFilters]::CreationTime
$watcher.Filter = "*"

$subscriptions = @(
  (Register-ObjectEvent -InputObject $watcher -EventName Changed -SourceIdentifier "toeic.web.autocommit.changed"),
  (Register-ObjectEvent -InputObject $watcher -EventName Created -SourceIdentifier "toeic.web.autocommit.created"),
  (Register-ObjectEvent -InputObject $watcher -EventName Deleted -SourceIdentifier "toeic.web.autocommit.deleted"),
  (Register-ObjectEvent -InputObject $watcher -EventName Renamed -SourceIdentifier "toeic.web.autocommit.renamed")
)

$watcher.EnableRaisingEvents = $true
$script:isCommitRunning = $false
$script:hasPendingSignal = $false
$script:lastSignalAt = Get-Date

Write-Log "WEB auto-commit watcher started"
Invoke-WebCommit

try {
  while ($true) {
    $eventRecord = Wait-Event -Timeout 1

    if ($null -ne $eventRecord) {
      $candidatePaths = @()

      if ($null -ne $eventRecord.SourceEventArgs) {
        if ($eventRecord.SourceEventArgs.PSObject.Properties.Name -contains "FullPath") {
          $candidatePaths += $eventRecord.SourceEventArgs.FullPath
        }

        if ($eventRecord.SourceEventArgs.PSObject.Properties.Name -contains "OldFullPath") {
          $candidatePaths += $eventRecord.SourceEventArgs.OldFullPath
        }
      }

      Remove-Event -EventIdentifier $eventRecord.EventIdentifier

      $relevantEvent = $false
      foreach ($candidatePath in $candidatePaths) {
        if (-not (Should-IgnorePath -Path $candidatePath)) {
          $relevantEvent = $true
          break
        }
      }

      if ($relevantEvent) {
        $script:lastSignalAt = Get-Date
        $script:hasPendingSignal = $true
      }

      continue
    }

    if ($script:hasPendingSignal) {
      $elapsed = (Get-Date) - $script:lastSignalAt
      if ($elapsed.TotalMilliseconds -ge $DebounceMilliseconds) {
        Invoke-WebCommit
        $script:hasPendingSignal = $false
      }
    }
  }
}
finally {
  foreach ($subscription in $subscriptions) {
    Unregister-Event -SubscriptionId $subscription.Id -ErrorAction SilentlyContinue
  }

  $watcher.EnableRaisingEvents = $false
  $watcher.Dispose()

  $mutex.ReleaseMutex() | Out-Null
  $mutex.Dispose()

  Write-Log "WEB auto-commit watcher stopped"
}
