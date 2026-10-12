param([string]$Origin = '', [switch]$SkipDownload)
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
    & docker run --rm --mount "type=bind,source=$PSScriptRoot,target=/work" --workdir /work $pythonImage python @PythonArguments
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
& docker compose up --build -d
if ($LASTEXITCODE -ne 0) { throw 'O servidor nao iniciou corretamente. Consulte: docker compose logs --tail 40' }
$serverOrigin = ((Get-Content '.env' | Where-Object { $_.StartsWith('QUEST_RO_PUBLIC_URL=') }) -split '=',2)[1]
$health = Invoke-RestMethod -Uri ($serverOrigin + '/api/readiness') -TimeoutSec 20
if (-not $health.nativeReady -or -not $health.assetsReady) { throw 'O servidor iniciou, mas o jogo ainda nao esta pronto.' }
Write-Host "Servidor Ragnarok pronto: $serverOrigin"
Write-Host 'O computador e o Docker precisam permanecer ligados. Para parar sem apagar dados: docker compose stop'
Start-Process $serverOrigin
