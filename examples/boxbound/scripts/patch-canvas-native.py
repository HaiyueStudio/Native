"""Install only audited ABI-matched C++ callback fixes into the Canvas AAR."""
import hashlib,json,pathlib,os,zipfile
app=pathlib.Path(__file__).resolve().parents[1]
aar=app/'node_modules/@nativescript/canvas/platforms/android/canvas-release.aar'
replacements={}
assert {p.parent.name for p in (app/'vendor/canvas-android').glob('*/libcanvasnativev8.json')}=={'arm64-v8a','armeabi-v7a','x86','x86_64'}, 'Missing audited Canvas ABI patch'
with zipfile.ZipFile(aar) as z:
 for manifest in sorted((app/'vendor/canvas-android').glob('*/libcanvasnativev8.json')):
  meta=json.loads(manifest.read_text());abi=meta['abi'];member=f'jni/{abi}/libcanvasnativev8.so';fixed=manifest.with_suffix('.so').read_bytes()
  assert hashlib.sha256(fixed).hexdigest()==meta['sha256'],'Changed native patch binary'
  assert hashlib.sha256(z.read(f'jni/{abi}/libcanvasnative.so')).hexdigest()==meta['rustSha256'],'Canvas Rust ABI changed; rebuild callback fix'
  current=hashlib.sha256(z.read(member)).hexdigest()
  assert current in [meta['originalSha256'],meta['sha256'],*meta.get('replacesSha256',[])],'Canvas native binding changed; re-audit patch'
  if current!=meta['sha256']:replacements[member]=fixed
 if replacements:
  temporary=aar.with_suffix('.patched.aar')
  with zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED) as output:
   for info in z.infolist():output.writestr(info,replacements.get(info.filename,z.read(info.filename)))
if replacements:os.replace(temporary,aar)
print('Canvas Android callback ownership patch:', ', '.join(replacements) or 'already installed')
