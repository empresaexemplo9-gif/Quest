param([string]$Origin = '', [switch]$SkipDownload, [switch]$PrepareTunnel, [switch]$Public, [switch]$PublishMain)
$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repository 'engine\rathena\LICENSE'))) {
    throw 'Execute este arquivo dentro do repositorio Quest que ja esta no seu computador.'
}
& (Join-Path $PSScriptRoot 'PrepararWindows.ps1') -IncludeTunnel:($PrepareTunnel -or $Public)
$destination = $repository
$server = Join-Path $repository 'Servidor'
if (-not (Test-Path (Join-Path $server 'IniciarServidor.ps1'))) {
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    # Download from the same canonical repository, independently of the portal deployment.
    $baseURL = 'https://raw.githubusercontent.com/empresaexemplo9-gif/Quest/main/public/downloads/'
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
# Upgrade only the known original launcher. Preserve manually edited scripts and all game/database files.
$installedLauncher = Join-Path $server 'IniciarServidor.ps1'
$reviewedLauncher = Join-Path $repository 'deploy\ragnarok\IniciarServidor.ps1'
if ((Get-FileHash -Algorithm SHA256 $installedLauncher).Hash.ToLowerInvariant() -eq '81f112afeb1008e43e2161f80c30960fd944d45a43bcbe578893a35321d7f36b') {
    Copy-Item -LiteralPath $reviewedLauncher -Destination $installedLauncher
}
$installedConfig = Join-Path $server 'configure_server.py'
if ((Get-FileHash -Algorithm SHA256 $installedConfig).Hash.ToLowerInvariant() -eq 'bb60016d739a3f99c70826b8ec46759afee95f23f5adc7b795c3fd028eb3dfb3') {
    Copy-Item -LiteralPath (Join-Path $repository 'deploy\ragnarok\configure_local.py') -Destination $installedConfig
}
# This new checker is separate from existing custom runtime files.
$checker = Join-Path $server 'context\client\ragnarok\check-public.mjs'
$reviewedChecker = Join-Path $repository 'client\ragnarok\check-public.mjs'
if (Test-Path $checker) {
    if ([IO.File]::ReadAllText($checker).Replace("`r`n","`n") -cne [IO.File]::ReadAllText($reviewedChecker).Replace("`r`n","`n")) {
        throw 'O verificador instalado foi personalizado e foi preservado. Revise o arquivo check-public.mjs antes de publicar.'
    }
} else { Copy-Item -LiteralPath $reviewedChecker -Destination $checker }
$parameters = @{}
if ($Origin) { $parameters.Origin = $Origin }
if ($SkipDownload) { $parameters.SkipDownload = $true }
if ($Public) { $parameters.NoBrowser = $true }
& (Join-Path $server 'IniciarServidor.ps1') @parameters

if ($Public) { & (Join-Path $PSScriptRoot 'PublicarServidorWindows.ps1') -ServerDirectory $server -PublishMain:$PublishMain }
