"""Exercise real HTTP downloads, ZIP assembly, retries and preservation on disposable files."""
import functools,hashlib,http.server,io,json,subprocess,sys,tempfile,threading,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
remote='https://github.com/empresaexemplo9-gif/Quest/releases/download/quest-arquivos-2.0.4/'
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
with tempfile.TemporaryDirectory(prefix='quest-central-test-') as temporary:
    folder=Path(temporary);serve=folder/'http';serve.mkdir();target=folder/'resultado'
    buffer=io.BytesIO()
    with zipfile.ZipFile(buffer,'w') as archive:archive.writestr('DESENVOLVEDOR/LEIA-ME.txt','Pacote de teste descartavel.\n')
    content=buffer.getvalue();server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(serve)))
    base=f'http://127.0.0.1:{server.server_port}/';thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    parts=[];width=len(content)//3
    for index in range(1,4):
        data=content[(index-1)*width:index*width] if index<3 else content[2*width:]
        name=f'Quest-Desenvolvedor-2.0.4.zip.parte{index:02d}';(serve/name).write_bytes(data)
        parts.append({'name':name,'url':base+name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    manifest={'filename':'DESENVOLVEDOR.zip','sha256':hashlib.sha256(content).hexdigest(),'bytes':len(content),'parts':parts}
    (serve/'Quest-GM-Pacote.json').write_text(json.dumps(manifest),encoding='utf-8')
    source=(root/'public/central/Baixar-Quest-GM.cmd').read_text(encoding='utf-8').rsplit('# QUEST POWERSHELL',1)[1]
    source=source.replace(remote,base).replace("Join-Path ([Environment]::GetFolderPath('Desktop')) 'Quest - Arquivos Compartilhados'","'"+str(target).replace("'","''")+"'")
    source=source.replace("Start-Process explorer.exe -ArgumentList ('/select,\"'+$zip+'\"')", "Write-Host 'Teste concluido'")
    script=folder/'teste.ps1';script.write_text(source,encoding='utf-8-sig')
    command=['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(script)]
    try:
        first=subprocess.run(command,capture_output=True,text=True);assert first.returncode==0,first.stderr
        assert (target/'DESENVOLVEDOR.zip').read_bytes()==content
        again=subprocess.run(command,capture_output=True,text=True);assert again.returncode==0,again.stderr
        damaged=target/parts[0]['name'];damaged.write_bytes(b'arquivo preexistente diferente')
        rejected=subprocess.run(command,capture_output=True,text=True);assert rejected.returncode!=0 and damaged.read_bytes()==b'arquivo preexistente diferente'
        pyfolder=folder/'python';pyfolder.mkdir()
        for part in parts:(pyfolder/part['name']).write_bytes((serve/part['name']).read_bytes())
        py=folder/'montar.py';py.write_text((root/'public/central/Montar-Quest-GM.py').read_text(encoding='utf-8').replace(remote,base),encoding='utf-8')
        result=subprocess.run([sys.executable,str(py),str(pyfolder)],capture_output=True,text=True);assert result.returncode==0,result.stderr
        assert (pyfolder/'DESENVOLVEDOR.zip').read_bytes()==content
        print('PASS: HTTP download, three-part SHA-256, Windows/Python ZIP assembly, repeat run and preservation of existing files.')
    finally:server.shutdown();server.server_close()
