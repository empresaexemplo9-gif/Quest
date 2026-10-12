param([string]$Origin = '', [switch]$SkipDownload)
$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repository 'engine\rathena\LICENSE'))) {
    throw 'Execute este arquivo dentro do repositorio Quest que ja esta no seu computador.'
}
$destination = Join-Path $repository '.local\ragnarok\windows-server'
$server = Join-Path $destination 'Quest-Servidor'
if (-not (Test-Path (Join-Path $server 'IniciarServidor.ps1'))) {
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $baseURL = 'https://quest-game-plum.vercel.app/downloads/'
    $checksumFile = Join-Path $destination 'Quest-Servidor-Windows.sha256'
    Invoke-WebRequest -UseBasicParsing -Uri ($baseURL + 'Quest-Servidor-Windows.sha256') -OutFile $checksumFile
    $checksum = Get-Content -Raw $checksumFile
    $expected = ($checksum -split '\s+')[0].ToLowerInvariant()
    if ($expected -notmatch '^[a-f0-9]{64}$') { throw 'O checksum publicado do pacote nao e valido.' }
    $package = Join-Path $destination 'Quest-Servidor-Windows.zip'
    Invoke-WebRequest -UseBasicParsing -Uri ($baseURL + 'Quest-Servidor-Windows.zip') -OutFile $package
    if ((Get-FileHash -Algorithm SHA256 $package).Hash.ToLowerInvariant() -ne $expected) {
        throw 'O pacote falhou na verificacao SHA-256; nenhum servidor foi iniciado.'
    }
    Expand-Archive -LiteralPath $package -DestinationPath $destination
}
$parameters = @{}
if ($Origin) { $parameters.Origin = $Origin }
if ($SkipDownload) { $parameters.SkipDownload = $true }
& (Join-Path $server 'IniciarServidor.ps1') @parameters
