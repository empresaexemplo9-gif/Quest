$ErrorActionPreference = 'Stop'
# Recover only a failed Docker startup with orphaned, zero-byte local sockets.
# Preserve folders, settings, images, volumes and database; never factory-reset.
$questDocker = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe'
if (-not (Test-Path -LiteralPath $questDocker)) { return $false }
$questOldPreference = $ErrorActionPreference
try { $ErrorActionPreference='Continue'; $questApi = & $questDocker info --format '{{.OSType}}' 2>$null } finally { $ErrorActionPreference=$questOldPreference }
if ($LASTEXITCODE -eq 0 -and $questApi) { return $false }
$questLog = Join-Path $env:LOCALAPPDATA 'Docker\log\host\com.docker.backend.exe.log'
if (-not (Test-Path -LiteralPath $questLog)) { return $false }
$questErrors = @(Get-Content -LiteralPath $questLog -Tail 100 -ErrorAction Stop | Where-Object { $_ -match 'backend crashed.*initializing Secrets Engine.*engine.sock.*(rename|remove)' })
if (-not $questErrors) { return $false }
$questLatest = $questErrors[-1]
$questMatch = [regex]::Match($questLatest,'^\[([^\]]+)\]')
$questTime = [DateTimeOffset]::MinValue
$questTimestamp = $questMatch.Groups[1].Value -replace '(\.\d{7})\d+(Z)$','$1$2'
if (-not $questMatch.Success -or -not [DateTimeOffset]::TryParse($questTimestamp,[ref]$questTime) -or ([DateTimeOffset]::UtcNow-$questTime).TotalSeconds -gt 120) { return $false }
$questLocal = [IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd('\')
$questFolders = @((Join-Path $questLocal 'docker-secrets-engine'),(Join-Path $questLocal 'Docker\run'))
foreach ($questFolder in $questFolders) {
    $questResolved = [IO.Path]::GetFullPath($questFolder)
    if (-not $questResolved.StartsWith($questLocal+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Caminho de sockets do Docker inesperado.' }
    if (-not (Test-Path -LiteralPath $questResolved -PathType Container)) { return $false }
    foreach ($questFile in (Get-ChildItem -LiteralPath $questResolved -Force)) {
        if ($questFile.PSIsContainer -or $questFile.Length -ne 0 -or $questFile.Name -notmatch '^(engine\.sock|dockerInference|sailor-ingest\.sock|userAnalyticsOtlpHttp\.sock|dockerEthernetVfkit)(\.stale)?$') { return $false }
    }
}
$questProgramRoot = [IO.Path]::GetFullPath((Join-Path $env:ProgramFiles 'Docker\Docker')).TrimEnd('\')+'\'
$questProcesses = @(Get-Process -Name 'Docker Desktop','com.docker.backend' -ErrorAction SilentlyContinue)
foreach ($questProcess in $questProcesses) {
    if (-not $questProcess.Path -or -not $questProcess.Path.StartsWith($questProgramRoot,[StringComparison]::OrdinalIgnoreCase)) { return $false }
}
Write-Host 'Reparando a inicializacao do Docker. Seus mapas, contas e dados serao preservados.'
$questProcesses | Stop-Process -Force -ErrorAction Stop
$questStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
foreach ($questFolder in $questFolders) {
    $questTarget = [IO.Path]::GetFullPath($questFolder+'.quest-preservado-'+$questStamp)
    if ([IO.Path]::GetDirectoryName($questTarget) -ne [IO.Path]::GetDirectoryName($questFolder)) { throw 'Destino da preservacao do Docker inesperado.' }
    Move-Item -LiteralPath $questFolder -Destination $questTarget -ErrorAction Stop
}
Start-Process -FilePath (Join-Path $questProgramRoot 'Docker Desktop.exe') -WindowStyle Hidden
return $true
