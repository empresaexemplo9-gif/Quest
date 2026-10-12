param([switch]$IncludeTunnel)
$ErrorActionPreference = 'Stop'
$env:PATH = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User') + ';' + $env:PATH

function Install-WindowsPackage([string]$Id) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw 'Instale o Instalador de Aplicativos da Microsoft Store (winget) e execute este comando novamente.'
    }
    & winget install --id $Id --exact --source winget --accept-source-agreements --accept-package-agreements --silent
    if ($LASTEXITCODE -eq 3010 -or $LASTEXITCODE -eq 1641) {
        Write-Host 'A instalacao exige reiniciar o Windows. Reinicie e abra IniciarServidorWindows.cmd novamente.'
        exit 3010
    }
    if ($LASTEXITCODE -ne 0) { throw ('Falha ao instalar ' + $Id + '. Veja a mensagem do winget acima.') }
}

$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
if (-not $wsl) { throw 'Atualize o Windows 10/11: o comando WSL nao esta disponivel.' }
$previousPreference = $ErrorActionPreference
try { $ErrorActionPreference = 'Continue'; & wsl.exe --status *> $null; $wslExit = $LASTEXITCODE } finally { $ErrorActionPreference = $previousPreference }
if ($wslExit -eq 0) {
    try { $ErrorActionPreference = 'Continue'; & wsl.exe --set-default-version 2 *> $null; $wslExit = $LASTEXITCODE } finally { $ErrorActionPreference = $previousPreference }
}
if ($wslExit -ne 0) {
    Write-Host 'Habilitando WSL2. O Windows pode solicitar permissao de administrador.'
    $setup = Start-Process -FilePath $wsl.Source -Verb RunAs -ArgumentList @('--install','--no-distribution') -Wait -PassThru
    if ($setup.ExitCode -notin @(0,3010,1641)) { throw 'Nao foi possivel habilitar WSL2. Veja a janela de instalacao do Windows.' }
    Write-Host 'WSL2 preparado. Reinicie o Windows e execute IniciarServidorWindows.cmd novamente.'
    exit 3010
}

function Get-DockerEngine {
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $result = & docker info --format '{{.OSType}}' 2>$null
        if ($LASTEXITCODE -eq 0) { return $result }
        return $null
    } finally { $ErrorActionPreference = $previousPreference }
}
$dockerDesktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
if (-not (Test-Path $dockerDesktop) -and -not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Install-WindowsPackage 'Docker.DockerDesktop'
}
$dockerFolder = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin'
if (Test-Path $dockerFolder) { $env:PATH = $dockerFolder + ';' + $env:PATH }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'O Docker ainda nao esta disponivel. Reinicie o Windows e execute novamente.' }
$engine = Get-DockerEngine
if (-not $engine) {
    if (Test-Path $dockerDesktop) { Start-Process -FilePath $dockerDesktop }
    Write-Host 'Aguardando o Docker Desktop. Conclua a configuracao inicial e habilite o backend WSL2 na janela do Docker.'
    $deadline = (Get-Date).AddMinutes(3)
    do {
        Start-Sleep -Seconds 2
        $engine = Get-DockerEngine
        if ($engine) { break }
    } while ((Get-Date) -lt $deadline)
    if (-not $engine) {
        throw 'O Docker Desktop nao iniciou. Verifique virtualizacao/WSL2, reinicie se solicitado e execute este comando novamente.'
    }
}
if ($engine -ne 'linux') { throw 'Selecione containers Linux no Docker Desktop para executar rAthena.' }
if ($IncludeTunnel -and -not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Install-WindowsPackage 'Cloudflare.cloudflared'
    $env:PATH = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User') + ';' + $env:PATH
    if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) { throw 'Cloudflare instalado; abra um novo terminal e execute o comando novamente.' }
}
Write-Host 'Docker com containers Linux pronto para o servidor Quest.'
