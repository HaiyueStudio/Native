"""Fetch only pinned public Android headers for the optional native rebuild."""
import concurrent.futures,hashlib,json,pathlib,subprocess,sys
spec=json.loads((pathlib.Path(__file__).resolve().parents[1]/'vendor/canvas-android/headers.json').read_text())
root=pathlib.Path(sys.argv[1])
def fetch(item):
 target=root/item['path'];target.parent.mkdir(parents=True,exist_ok=True)
 if not target.exists():subprocess.run(['curl','-fsSL','--retry','2','--connect-timeout','10','--max-time','45',f"https://raw.githubusercontent.com/NativeScript/canvas/{spec['commit']}/{spec['root']}{item['path']}",'-o',str(target)],check=True)
 data=target.read_bytes();digest=hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()
 assert digest==item['gitBlobSha1'],f'Header integrity mismatch: {target}'
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(fetch,spec['files']))
print('Verified',len(spec['files']),'Canvas Android headers')
