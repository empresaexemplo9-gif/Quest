param([switch]$Aplicar,[switch]$Preparar)
$ErrorActionPreference='Stop'
$questRepo=Split-Path $PSScriptRoot -Parent
$env:PATH=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
$questNode=Join-Path $env:ProgramFiles 'nodejs\node.exe'
if (!(Test-Path -LiteralPath $questNode)) {$questNode=(Get-Command node -ErrorAction Stop).Source}
$questRuntime=Join-Path $questRepo '.local\ragnarok\windows-server\Quest-Servidor'
if ($Aplicar) {
    & $questNode (Join-Path $questRepo 'client\ragnarok\prepare-city.mjs') $questRepo --validate
    if ($LASTEXITCODE -ne 0) {throw 'O mapa tem caminhos bloqueados ou arquivos incompativeis. Corrija antes de aplicar.'}
    if (!(Test-Path -LiteralPath (Join-Path $questRuntime 'compose.yaml'))) {throw 'Inicie o servidor Windows antes de aplicar a vila.'}
    $questBackup=Join-Path $questRepo ('.local\ragnarok\map-backups\'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Force -Path $questBackup | Out-Null
    $questLiveCity=Join-Path $questRuntime 'context\content\eridan'
    if (Test-Path -LiteralPath $questLiveCity) {Copy-Item -LiteralPath $questLiveCity -Destination $questBackup -Recurse}
    foreach ($questFolder in @('content\eridan','content\ragnarok','public\art\ragnarok','rathena')) {
        $questSource=Join-Path $questRepo $questFolder
        foreach ($questFile in Get-ChildItem -LiteralPath $questSource -Recurse -File) {
            $questRelative=$questFile.FullName.Substring($questRepo.Length+1)
            $questDestination=Join-Path (Join-Path $questRuntime 'context') $questRelative
            New-Item -ItemType Directory -Force -Path (Split-Path $questDestination -Parent) | Out-Null
            Copy-Item -LiteralPath $questFile.FullName -Destination $questDestination -Force
        }
    }
    foreach ($questFile in @('deploy\ragnarok\supervisor.mjs','client\ragnarok\serve.mjs','client\ragnarok\prepare-city.mjs')) {
        Copy-Item -LiteralPath (Join-Path $questRepo $questFile) -Destination (Join-Path (Join-Path $questRuntime 'context') $questFile) -Force
    }
    $questCompose=[IO.File]::ReadAllText((Join-Path $questRepo 'deploy\ragnarok\compose.yaml')).Replace('name: quest-ragnarok','name: quest-ragnarok-pc')
    [IO.File]::WriteAllText((Join-Path $questRuntime 'compose.yaml'),$questCompose,[Text.UTF8Encoding]::new($false))
    $env:PATH=(Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin')+';'+$env:PATH
    Push-Location $questRuntime
    try {docker compose up --build -d game;if ($LASTEXITCODE -ne 0) {throw 'A aplicacao falhou. O backup foi preservado.'}}
    finally {Pop-Location}
    $questPrivatePort=13005
    $questPortLine=Get-Content -LiteralPath (Join-Path $questRuntime '.env') | Where-Object { $_.StartsWith('QUEST_PRIVATE_PORT=') } | Select-Object -First 1
    if ($questPortLine) {$questPrivatePort=[int]($questPortLine -split '=',2)[1]}
    if ($questPrivatePort -lt 1 -or $questPrivatePort -gt 65535) {throw 'Porta privada invalida no servidor.'}
    $questReady=$false
    for ($questAttempt=0;$questAttempt -lt 45;$questAttempt++) {
        try {$questHealth=Invoke-RestMethod ('http://127.0.0.1:'+$questPrivatePort+'/api/readiness') -TimeoutSec 5;if ($questHealth.nativeReady -and $questHealth.assetsReady) {$questReady=$true;break}}catch {}
        Start-Sleep -Seconds 2
    }
    if (!$questReady) {throw 'A vila foi copiada, mas o servidor ainda nao confirmou disponibilidade. Verifique os logs do game.'}
    Write-Host 'Vila aplicada e servidor disponivel. Saia e entre no jogo para carregar os recursos novos.'
    Write-Host "Backup anterior: $questBackup"
    exit 0
}
$questTool=(Get-Content -LiteralPath (Join-Path $questRepo 'client\ragnarok\components.lock.json') -Raw | ConvertFrom-Json).components | Where-Object name -eq 'BrowEdit3-Windows'
$questEditorDir=Join-Path (Join-Path $questRepo '.local\ragnarok') $questTool.destination
$questEditor=Join-Path $questEditorDir 'BrowEdit3.exe'
if (!(Test-Path -LiteralPath $questEditor)) {
    $questArchive=Join-Path $questRepo ('.local\ragnarok\archives\'+$questTool.archive)
    New-Item -ItemType Directory -Force -Path (Split-Path $questArchive -Parent) | Out-Null
    if (!(Test-Path -LiteralPath $questArchive)) {Invoke-WebRequest $questTool.url -OutFile $questArchive -UseBasicParsing}
    if ((Get-Item -LiteralPath $questArchive).Length -ne $questTool.bytes -or (Get-FileHash -LiteralPath $questArchive -Algorithm SHA256).Hash.ToLower() -ne $questTool.sha256) {throw 'O pacote do BrowEdit não corresponde à versão verificada.'}
    Expand-Archive -LiteralPath $questArchive -DestinationPath $questEditorDir
}
$questClient=Join-Path $questRuntime 'context\.local\ragnarok\client'
$questGrfs=@();foreach ($questName in @('rdata.grf','data.grf')) {if (Test-Path -LiteralPath (Join-Path $questClient $questName)) {$questGrfs+=Join-Path $questClient $questName}}
$questConfigFile=Join-Path $questEditorDir 'config.json'
$questConfig=@{};if (Test-Path -LiteralPath $questConfigFile) {Copy-Item -LiteralPath $questConfigFile -Destination ($questConfigFile+'.previous') -Force;(Get-Content -LiteralPath $questConfigFile -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object {$questConfig[$_.Name]=$_.Value}}
$questConfig['ropath']=(Join-Path $questRepo 'content\eridan')+'\'
$questConfig['grfs']=$questGrfs
$questConfig['recentFiles']=@('data\er_chama0.rsw','data\er_chama1.rsw','data\er_chama2.rsw','data\er_chama3.rsw')
if (Test-Path -LiteralPath (Join-Path $questRepo 'content\eridan\world.json')) { $questWorld=Get-Content -LiteralPath (Join-Path $questRepo 'content\eridan\world.json') -Raw | ConvertFrom-Json; $questConfig['recentFiles']+=@($questWorld.regions | ForEach-Object {'data\'+$_.id+'.rsw'}) }
$questConfig['backup']=$true;$questConfig['recalculateQuadtreeOnSave']=$true
[IO.File]::WriteAllText($questConfigFile,($questConfig | ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
Write-Host "Editor: $questEditor"
Write-Host ('Abra em File > Open: '+(Join-Path $questRepo 'content\eridan\data\er_chama0.rsw'))
Write-Host 'Depois de salvar RSW, GND e GAT, execute scripts\EditarVilaWindows.cmd -Aplicar.'
if (!$Preparar) {Start-Process -FilePath $questEditor -WorkingDirectory $questEditorDir -WindowStyle Normal}
