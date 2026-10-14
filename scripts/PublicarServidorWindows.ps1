param([string]$ServerDirectory, [switch]$PublishMain, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repository = Split-Path -Parent $PSScriptRoot
if (-not $ServerDirectory) { $ServerDirectory = Join-Path $repository 'Servidor' }
$ServerDirectory = (Resolve-Path -LiteralPath $ServerDirectory).Path
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) { throw 'Execute IniciarServidorWindows.cmd -Public para preparar o Cloudflare.' }
if ($PublishMain) {
    $branch = & git -C $repository branch --show-current
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') { throw 'A publicacao exige o repositorio Quest na branch main.' }
    $remote = & git -C $repository remote get-url origin
    if ($LASTEXITCODE -ne 0 -or $remote -notmatch 'github\.com[:/]empresaexemplo9-gif/Quest(\.git)?$') { throw 'O origin deve apontar para o mesmo repositorio empresaexemplo9-gif/Quest.' }
}
$environment = Join-Path $ServerDirectory '.env'
$original = [IO.File]::ReadAllBytes($environment)
$privatePort = ((Get-Content -LiteralPath $environment | Where-Object { $_.StartsWith('QUEST_PRIVATE_PORT=') }) -split '=',2)[1]
if ($privatePort -notmatch '^\d+$' -or [int]$privatePort -lt 1024 -or [int]$privatePort -gt 65535) { throw 'A porta privada do servidor nao esta configurada.' }
$gateway = 'http://127.0.0.1:' + $privatePort
$health = Invoke-RestMethod -Uri ($gateway + '/api/readiness') -TimeoutSec 15
if ($health.engine -ne 'rAthena' -or -not $health.nativeReady -or -not $health.assetsReady) { throw 'Inicie o servidor nativo antes de publica-lo.' }
$run = Join-Path $ServerDirectory '.tunnel'
New-Item -ItemType Directory -Force -Path $run | Out-Null
$stamp = [Guid]::NewGuid().ToString('N')
$stdout = Join-Path $run ($stamp + '.stdout.log')
$stderr = Join-Path $run ($stamp + '.stderr.log')
$tunnel = Start-Process -FilePath $cloudflared.Source -ArgumentList @('tunnel','--no-autoupdate','--protocol','http2','--url',$gateway) -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
$changed = $false
$location = Get-Location
try {
    $deadline = (Get-Date).AddMinutes(2)
    $publicURL = $null
    while ((Get-Date) -lt $deadline) {
        $tunnel.Refresh()
        if ($tunnel.HasExited) { throw ('O tunel encerrou. Consulte ' + $stderr) }
        $logs = ((Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue) + (Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue))
        $match = [regex]::Match($logs,'https://[a-z0-9-]+\.trycloudflare\.com')
        if ($match.Success) { $publicURL = $match.Value; break }
        Start-Sleep -Seconds 1
    }
    if (-not $publicURL) { throw 'O Cloudflare nao forneceu um endereco publico. Verifique a rede e o log do tunel.' }
    Set-Location $ServerDirectory
    $pythonImage = 'python:3.12-slim-bookworm@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258'
    & docker run --rm --mount "type=bind,source=$ServerDirectory,target=/work" --workdir /work $pythonImage python configure_server.py --tunnel-origin $publicURL
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel configurar a origem publica.' }
    $changed = $true
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    & icacls $environment /inheritance:r /grant:r ('*{0}:(F)' -f $identity.User.Value) '*S-1-5-18:(F)' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel proteger o arquivo privado .env.' }
    & docker compose up -d --no-build game
    if ($LASTEXITCODE -ne 0) { throw 'O gateway nativo nao reiniciou.' }
    $deadline = (Get-Date).AddMinutes(2)
    $ready = $false
    while ((Get-Date) -lt $deadline) {
        try {
            $health = Invoke-RestMethod -Uri ($publicURL + '/api/readiness') -TimeoutSec 10
            if ($health.engine -eq 'rAthena' -and $health.packetver -eq 20211103 -and $health.nativeReady -and $health.assetsReady) { $ready = $true; break }
        } catch { }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) { throw 'O endereco publico ainda nao responde com o mundo Ragnarok. Verifique a rede do tunel.' }
    # Probe and clean only the randomly generated native test account. Passwords never leave the checker.
    $probeOutput = & docker compose exec -T game node client/ragnarok/check-public.mjs $publicURL
    $probeCode = $LASTEXITCODE
    $probe = $probeOutput | ConvertFrom-Json
    if ($probe.userid -notmatch '^probe_[a-f0-9]{12}$') { throw 'O verificador nativo retornou dados invalidos.' }
    $cleanup = "DELETE FROM login WHERE userid='$($probe.userid)' AND sex='M';"
    $cleanup | & docker compose exec -T database bash -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot --batch --skip-column-names ragnarok'
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel limpar a conta temporaria do teste nativo.' }
    if ($probeCode -ne 0 -or -not $probe.ready) { throw ('O login publico HTTPS/WSS falhou: ' + $probe.message) }
} catch {
    if ($changed) {
        [IO.File]::WriteAllBytes($environment,$original)
        Set-Location $ServerDirectory
        & docker compose up -d --no-build game | Out-Host
    }
    $tunnel.Refresh()
    if (-not $tunnel.HasExited) { $tunnel.Kill() }
    throw
} finally { Set-Location $location }

$manifestPath = Join-Path $repository 'public\releases\ragnarok-server.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$manifest.server = $publicURL
$manifest.status = 'public-native-login-verified'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($manifestPath,($manifest | ConvertTo-Json -Depth 10) + "`n",$utf8)
[IO.File]::WriteAllText((Join-Path $run 'active.json'),(@{pid=$tunnel.Id;server=$publicURL;gateway=$gateway} | ConvertTo-Json),$utf8)
Write-Host "Mundo Ragnarok publico, com login HTTPS/WSS verificado: $publicURL"
Write-Host 'Este endereco de tunel e temporario. Mantenha o PC, Docker e Cloudflare ligados.'
if ($PublishMain) {
    & git -C $repository diff HEAD --quiet -- public/releases/ragnarok-server.json
    $difference = $LASTEXITCODE
    if ($difference -gt 1) { throw 'Nao foi possivel comparar o manifesto com a main.' }
    if ($difference -eq 1) {
        & git -C $repository add -- public/releases/ragnarok-server.json
        if ($LASTEXITCODE -ne 0) { throw 'O manifesto nao foi preparado para publicacao.' }
        & git -C $repository commit --only -m 'Connect the verified public Ragnarok server' -- public/releases/ragnarok-server.json
        if ($LASTEXITCODE -ne 0) { throw 'O servidor esta disponivel, mas o commit do manifesto falhou.' }
    }
    & git -C $repository push origin main
    if ($LASTEXITCODE -ne 0) { throw 'O servidor esta disponivel, mas a publicacao na main falhou. Verifique a autenticacao Git local.' }
    Write-Host 'A integracao Git da Vercel publicara o mesmo endereco no portal e nos instaladores.'
} else { Write-Host 'Para conectar o portal, publique apenas public/releases/ragnarok-server.json na mesma main.' }
if (-not $NoBrowser) { Start-Process $publicURL }
