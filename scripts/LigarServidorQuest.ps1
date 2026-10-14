param([switch]$NoBrowser, [switch]$NoPause)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Host.UI.RawUI.WindowTitle = 'LIGAR SERVIDOR QUEST'
$repository = Split-Path -Parent $PSScriptRoot
$server = Join-Path $repository '.local\ragnarok\windows-server\Quest-Servidor'
$env:PATH = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User') + ';' + $env:PATH
$dockerBin = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin'
$env:PATH = $dockerBin + ';' + $env:PATH
$mutex = New-Object System.Threading.Mutex($false, 'Local\QuestStartServer')
$locked = $false
$exitCode = 0

function Test-QuestReady([string]$Url) {
    try {
        $health = Invoke-RestMethod -Uri ($Url.TrimEnd('/') + '/api/readiness') -TimeoutSec 10
        return ($health.engine -eq 'rAthena' -and $health.packetver -eq 20211103 -and $health.nativeReady -and $health.assetsReady)
    } catch { return $false }
}

try {
    try { $locked = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $locked = $true }
    if (-not $locked) { throw 'O servidor ja esta sendo ligado em outra janela. Aguarde essa janela terminar.' }
    Write-Host 'QUEST - LIGAR SERVIDOR' -ForegroundColor Cyan
    if ($NoBrowser) { Write-Host 'Aguarde. Quando estiver pronto, use o atalho JOGAR QUEST.' }
    else { Write-Host 'Aguarde. O jogo abre automaticamente quando estiver pronto.' }
    if (-not (Test-Path -LiteralPath (Join-Path $server 'compose.yaml'))) {
        & (Join-Path $PSScriptRoot 'IniciarServidorWindows.ps1') -Public -PublishMain
    } else {
        $engine = $null
        if (Get-Command docker -ErrorAction SilentlyContinue) {
            $oldPreference = $ErrorActionPreference
            try { $ErrorActionPreference = 'Continue'; $engine = & docker info --format '{{.OSType}}' 2>$null } finally { $ErrorActionPreference = $oldPreference }
        }
        if (-not $engine) {
            $desktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
            if (-not (Test-Path -LiteralPath $desktop)) { throw 'Docker Desktop nao encontrado. Execute scripts\IniciarServidorWindows.cmd -Public -PublishMain para preparar este PC.' }
            Write-Host 'Iniciando o Docker Desktop...'
            Start-Process -FilePath $desktop -WindowStyle Hidden
            $deadline = (Get-Date).AddMinutes(3)
            $questSocketRepairAttempted = $false
            $questDockerStarted = Get-Date
            do {
                Start-Sleep -Seconds 2
                $oldPreference = $ErrorActionPreference
                try { $ErrorActionPreference = 'Continue'; $engine = & docker info --format '{{.OSType}}' 2>$null } finally { $ErrorActionPreference = $oldPreference }
                if (-not $engine -and -not $questSocketRepairAttempted -and ((Get-Date)-$questDockerStarted).TotalSeconds -gt 12) {
                    $questSocketRepairAttempted = $true
                    & (Join-Path $PSScriptRoot 'RepararDockerQuest.ps1') | Out-Null
                }
            } while (-not $engine -and (Get-Date) -lt $deadline)
        }
        if ($engine -ne 'linux') { throw 'O Docker nao iniciou com containers Linux. Abra o Docker Desktop e confira o estado do WSL2.' }
        $port = ((Get-Content -LiteralPath (Join-Path $server '.env') | Where-Object { $_.StartsWith('QUEST_PRIVATE_PORT=') }) -split '=',2)[1]
        if ($port -notmatch '^\d+$') { throw 'A porta do servidor nao esta configurada.' }
        $localUrl = 'http://127.0.0.1:' + $port
        if (-not (Test-QuestReady $localUrl)) {
            Write-Host 'Ligando o mundo de Eridan...'
            Push-Location $server
            try {
                # Fix only the existing native configuration/log volumes. This
                # preserves accounts and makes prior root-owned copies writable.
                & docker compose stop game
                if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel parar a tentativa anterior de inicializacao.' }
                & docker compose run --rm --no-deps --user root --entrypoint sh game -c 'chown -R node:node /app/engine/rathena/conf/import /app/engine/rathena/log'
                if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel reparar as permissoes da configuracao do servidor.' }
                & docker compose up -d --no-build database game
                if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel iniciar os containers. Veja a mensagem acima.' }
            } finally { Pop-Location }
            $deadline = (Get-Date).AddMinutes(2)
            while (-not (Test-QuestReady $localUrl)) {
                if ((Get-Date) -ge $deadline) {
                    Push-Location $server
                    try { & docker compose logs --tail 30 game } finally { Pop-Location }
                    throw 'O mundo ainda nao ficou pronto. Os logs da falha aparecem acima.'
                }
                Start-Sleep -Seconds 2
            }
        }
        $activePath = Join-Path $server '.tunnel\active.json'
        $publicUrl = $null
        if (Test-Path -LiteralPath $activePath) {
            $active = Get-Content -LiteralPath $activePath -Raw | ConvertFrom-Json
            if ($active.server -match '^https://[a-z0-9-]+\.trycloudflare\.com$' -and (Test-QuestReady $active.server)) { $publicUrl = $active.server }
        }
        if (-not $publicUrl) {
            Write-Host 'Conectando o acesso publico ao jogo...'
            & (Join-Path $PSScriptRoot 'PublicarServidorWindows.ps1') -ServerDirectory $server -PublishMain -NoBrowser
            $active = Get-Content -LiteralPath $activePath -Raw | ConvertFrom-Json
            $publicUrl = $active.server
        }
        Write-Host ''
        Write-Host 'SERVIDOR LIGADO - PODE JOGAR!' -ForegroundColor Green
        Write-Host ('Endereco do jogo: ' + $publicUrl)
        Write-Host 'Mantenha o PC e o Docker ligados. Pode fechar esta janela.'
        if (-not $NoBrowser) { Start-Process $publicUrl }
    }
} catch {
    $exitCode = 1
    Write-Host ''
    Write-Host ('Nao foi possivel ligar: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Esta janela fica aberta para voce conseguir ler o problema.'
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
if (-not $NoPause) { Read-Host 'Pressione Enter para fechar' | Out-Null }
exit $exitCode
