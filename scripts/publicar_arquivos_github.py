"""Upload reviewed distribution files to a draft release, verify digests, then publish."""
import argparse,concurrent.futures,hashlib,http.client,json,subprocess,time
from pathlib import Path
from urllib.parse import quote,urlsplit

REPO='empresaexemplo9-gif/Quest'
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--directory',type=Path)
parser.add_argument('--check',action='store_true')
parser.add_argument('--publish',action='store_true')
args=parser.parse_args()
# Use the existing Git sign-in in memory; never save or print its credential.
credential=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',cwd=ROOT,text=True,capture_output=True,check=True)
fields=dict(line.split('=',1) for line in credential.stdout.splitlines() if '=' in line)
token=fields.get('password')
if not token:raise SystemExit('A autenticacao Git existente nao esta disponivel.')
headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','User-Agent':'Quest-file-central','X-GitHub-Api-Version':'2022-11-28'}
def api(method,path,body=None):
    conn=http.client.HTTPSConnection('api.github.com',timeout=90)
    data=json.dumps(body).encode() if body is not None else None
    conn.request(method,path,body=data,headers={**headers,'Content-Type':'application/json'})
    response=conn.getresponse();payload=response.read();conn.close()
    if response.status>=400:raise RuntimeError(f'GitHub API {response.status}: '+json.loads(payload).get('message','Request failed'))
    return json.loads(payload) if payload else None
repo=api('GET','/repos/'+REPO)
if repo['full_name']!=REPO or not repo.get('permissions',{}).get('push'):raise SystemExit('O projeto correto nao tem permissao de escrita.')
if args.check:
    print(json.dumps({'repository':repo['full_name'],'public':not repo['private'],'canPublish':True}));raise SystemExit()
if not args.directory or not args.publish:raise SystemExit('Use --directory e --publish para publicar arquivos revisados.')
directory=args.directory.resolve()
manifest=json.loads((directory/'release-assets.json').read_text(encoding='utf-8'))
tag=manifest['tag'];revision=manifest['revision'];version=tag.removeprefix('quest-arquivos-')
existing=api('GET','/repos/'+REPO+'/releases?per_page=100')
release=next((r for r in existing if r['tag_name']==tag),None)
if release is None:
    release=api('POST','/repos/'+REPO+'/releases',{'tag_name':tag,'target_commitish':revision,'name':'Quest '+version+' — arquivos compartilhados','draft':True,'prerelease':False,'body':'Central de arquivos do Quest: pacotes para jogadores e GMs, com verificacao SHA-256. O pacote completo do desenvolvedor tem tres partes; Baixar-Quest-GM.cmd baixa, verifica e monta o ZIP automaticamente. Contas, senhas e bancos de jogadores nao acompanham a distribuicao. A central esta em https://quest-game-plum.vercel.app/arquivos.html.'})
assets={a['name']:a for a in release['assets']}
def upload(record):
    name=record['name'];file=directory/name
    assert file.parent==directory and file.is_file()
    with file.open('rb') as stream:local=hashlib.file_digest(stream,'sha256').hexdigest()
    assert local==record['sha256'] and file.stat().st_size==record['bytes'] and record['bytes']<2*1024**3
    old=assets.get(name)
    if old:
        if old.get('digest')=='sha256:'+local and old['size']==record['bytes']:
            print(name+': existente e verificado',flush=True);return old
        raise RuntimeError('Arquivo existente diferente preservado: '+name)
    address=urlsplit(release['upload_url'].split('{')[0]+'?name='+quote(name))
    assert address.hostname=='uploads.github.com'
    conn=http.client.HTTPSConnection(address.hostname,timeout=600)
    conn.putrequest('POST',address.path+'?'+address.query)
    for key,value in {**headers,'Content-Type':'application/octet-stream','Content-Length':str(record['bytes'])}.items():conn.putheader(key,value)
    conn.endheaders();sent=0;last=time.monotonic()
    with file.open('rb') as stream:
        while block:=stream.read(1024*1024):
            conn.send(block);sent+=len(block)
            if time.monotonic()-last>20:
                print(f'{name}: {sent*100//record["bytes"]}%',flush=True);last=time.monotonic()
    response=conn.getresponse();payload=response.read();conn.close()
    result=json.loads(payload)
    if response.status!=201:raise RuntimeError(f'Upload {name}: HTTP {response.status} '+result.get('message',''))
    if result.get('digest')!='sha256:'+local or result['size']!=record['bytes']:raise RuntimeError('Checksum remoto divergente: '+name)
    print(name+': enviado e SHA-256 confirmado',flush=True);return result
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(upload,manifest['assets']))
current=api('GET','/repos/'+REPO+'/releases/'+str(release['id']))
for record in manifest['assets']:
    found=next(a for a in current['assets'] if a['name']==record['name'])
    assert found.get('digest')=='sha256:'+record['sha256'] and found['size']==record['bytes']
if current['draft']:current=api('PATCH','/repos/'+REPO+'/releases/'+str(release['id']),{'draft':False})
print(json.dumps({'published':current['html_url'],'files':len(results),'verified':True}),flush=True)
