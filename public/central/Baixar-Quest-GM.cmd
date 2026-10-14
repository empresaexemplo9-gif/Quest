@echo off
set "QUEST_DOWNLOAD_SCRIPT=%~f0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$text=[IO.File]::ReadAllText($env:QUEST_DOWNLOAD_SCRIPT); & ([scriptblock]::Create($text.Substring($text.LastIndexOf('# QUEST POWERSHELL'))))"
if errorlevel 1 pause
exit /b
# QUEST POWERSHELL
$env:PSModulePath=[IO.Path]::Combine($env:SystemRoot,'System32','WindowsPowerShell','v1.0','Modules')+';'+[IO.Path]::Combine($env:ProgramFiles,'WindowsPowerShell','Modules')
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$base='https://github.com/empresaexemplo9-gif/Quest/releases/download/quest-arquivos-2.0.5/'
$bundle=Invoke-RestMethod -Uri ($base+'Quest-GM-Pacote.json')
if ($bundle.filename -cne 'DESENVOLVEDOR.zip' -or $bundle.sha256 -notmatch '^[a-f0-9]{64}$' -or $bundle.parts.Count -ne 3) { throw 'Manifesto do pacote invalido.' }
$destination=Join-Path ([Environment]::GetFolderPath('Desktop')) 'Quest - Arquivos Compartilhados - 2.0.5'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$client=New-Object Net.WebClient
foreach($part in $bundle.parts){
    if ($part.name -notmatch '^Quest-Desenvolvedor-2\.0\.5\.zip\.parte0[1-3]$' -or $part.sha256 -notmatch '^[a-f0-9]{64}$' -or $part.url -cne ($base+$part.name)) { throw 'Parte do pacote invalida.' }
    $target=Join-Path $destination $part.name
    if(Test-Path -LiteralPath $target){
        if((Get-Item -LiteralPath $target).Length -ne $part.bytes -or (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $part.sha256){ throw ('Arquivo existente diferente preservado: '+$part.name) }
        Write-Host ('Ja conferido: '+$part.name)
    }else{
        Write-Host ('Baixando '+$part.name+'... mantenha esta janela aberta.')
        $temporary=$target+'.baixando'
        $client.DownloadFile($part.url,$temporary)
        if((Get-Item -LiteralPath $temporary).Length -ne $part.bytes -or (Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash.ToLowerInvariant() -ne $part.sha256){throw 'Download incompleto ou incorreto. Execute novamente.'}
        Move-Item -LiteralPath $temporary -Destination $target
    }
}
$zip=Join-Path $destination 'DESENVOLVEDOR.zip'
if(Test-Path -LiteralPath $zip){
    if((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $bundle.sha256){throw 'ZIP existente diferente preservado.'}
}else{
    Write-Host 'Montando o ZIP completo...'
    $output=[IO.File]::Open($zip,[IO.FileMode]::CreateNew)
    try{foreach($part in $bundle.parts){$inputStream=[IO.File]::OpenRead((Join-Path $destination $part.name));try{$inputStream.CopyTo($output)}finally{$inputStream.Dispose()}}}finally{$output.Dispose()}
    if((Get-Item -LiteralPath $zip).Length -ne $bundle.bytes -or (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $bundle.sha256){throw 'O ZIP completo nao passou na verificacao.'}
}
Write-Host ('PRONTO. Abra DESENVOLVEDOR.zip em '+$destination) -ForegroundColor Green
Start-Process explorer.exe -ArgumentList ('/select,"'+$zip+'"')
