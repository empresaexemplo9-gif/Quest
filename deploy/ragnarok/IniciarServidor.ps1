param([string]$Origin = '', [switch]$SkipDownload, [switch]$NoBrowser, [switch]$Rebuild)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Instale Docker Desktop com WSL2: https://docs.docker.com/desktop/setup/install/windows-install/ . Depois reinicie e execute este arquivo novamente.'
}
$dockerOS = & docker info --format '{{.OSType}}' 2>$null
if ($LASTEXITCODE -ne 0 -or $dockerOS -ne 'linux') {
    throw 'Abra Docker Desktop e selecione containers Linux com WSL2 antes de iniciar o servidor.'
}
$pythonImage = 'python:3.12-slim-bookworm@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258'
function Run-PythonContainer([string[]]$PythonArguments) {
    & docker run --rm --mount "type=bind,source=$(Split-Path -Parent $PSScriptRoot),target=/quest" --env QUEST_CLIENT_DIRECTORY=/quest/Dados --workdir /quest/Servidor $pythonImage python @PythonArguments
    if ($LASTEXITCODE -ne 0) { throw 'A preparacao falhou; os dados existentes foram preservados. Veja a mensagem acima.' }
}
$configure = @('configure_server.py')
if ($Origin) { $configure += @('--origin', $Origin) }
Run-PythonContainer $configure
function Protect-Environment {
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    & icacls (Join-Path $PSScriptRoot '.env') /inheritance:r /grant:r ('*{0}:(F)' -f $identity.User.Value) '*S-1-5-18:(F)' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel restringir o acesso ao arquivo privado .env.' }
}
Protect-Environment
if (-not $SkipDownload) {
    Write-Host 'Baixando/verificando o cliente Ragnarok completo (aproximadamente 4 GB).'
    Run-PythonContainer @('context/scripts/download_kro.py')
}
Run-PythonContainer @('configure_server.py','--verify-client')
Protect-Environment
# Reuse the prepared image on ordinary starts; a build is needed only once or
# when an updated server package is explicitly installed.
$existingGameImage = & docker compose images -q game
if ($Rebuild -or -not $existingGameImage) {
    & docker compose build game
    if ($LASTEXITCODE -ne 0) { throw 'A imagem do servidor nao foi preparada. Os dados existentes foram preservados.' }
}
& docker compose up --no-build -d
if ($LASTEXITCODE -ne 0) { throw 'O servidor nao iniciou corretamente. Consulte: docker compose logs --tail 40' }
$serverOrigin = ((Get-Content '.env' | Where-Object { $_.StartsWith('QUEST_RO_PUBLIC_URL=') }) -split '=',2)[1]
$privatePort = ((Get-Content '.env' | Where-Object { $_.StartsWith('QUEST_PRIVATE_PORT=') }) -split '=',2)[1]
$healthOrigin = 'http://127.0.0.1:' + $privatePort
$deadline = (Get-Date).AddMinutes(2)
$ready = $false
while ((Get-Date) -lt $deadline) {
    try {
        $health = Invoke-RestMethod -Uri ($healthOrigin + '/api/readiness') -TimeoutSec 10
        if ($health.engine -eq 'rAthena' -and $health.packetver -eq 20211103 -and $health.nativeReady -and $health.assetsReady) { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
}
if (-not $ready) { throw 'O servidor ainda nao esta pronto. Consulte docker compose logs --tail 40; seus dados foram preservados.' }
Write-Host "Servidor Ragnarok pronto: $serverOrigin"
Write-Host 'O computador e o Docker precisam permanecer ligados. Para parar sem apagar dados: docker compose stop'
if (-not $NoBrowser) { Start-Process $serverOrigin }
