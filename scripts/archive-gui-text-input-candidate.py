"""Export only the checked native dependency closure and verify every ZIP member.

Does not remove originals, publish, sign, build, or change version metadata.
"""
from pathlib import Path
import argparse
import base64
import datetime
import hashlib
import json
import os
import tarfile
import zipfile

parser=argparse.ArgumentParser()
parser.add_argument('--static-report',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
native=Path(__file__).resolve().parents[1]
workspace=native.parent
app=native/'examples/ios-gui-text-input'
engine=workspace/'Engine/engine'
sha=lambda data:hashlib.sha256(data).hexdigest()
report=json.loads(args.static_report.read_text(encoding='utf8'))
assert report['status']=='passed' and not report['diagnostics'],'Current example static check must pass first.'
package=json.loads((app/'package.json').read_text(encoding='utf8'))
lock=json.loads((app/'package-lock.json').read_text(encoding='utf8'))
spec=package['dependencies']['@haiyue/engine']
assert spec.startswith('file:vendor/')
pack=(app/spec.removeprefix('file:')).resolve()
assert pack.is_relative_to(app/'vendor')
raw=pack.read_bytes()
sri='sha512-'+base64.b64encode(hashlib.sha512(raw).digest()).decode()
assert lock['packages']['node_modules/@haiyue/engine']['integrity']==sri,'Lock does not describe this Engine tarball.'
members=0
with tarfile.open(pack) as tar:
    for item in tar:
        if not item.isfile():continue
        assert item.name.startswith('package/')
        target=(engine/item.name.removeprefix('package/')).resolve()
        assert target.is_relative_to(engine)
        assert tar.extractfile(item).read()==target.read_bytes(),f'Pack differs from current Engine file: {item.name}'
        members+=1
selected=set()
for name,expected in report['inputFingerprints'].items():
    file=Path(name).resolve()
    assert sha(file.read_bytes())==expected,f'Static check input changed: {file}'
    if file.is_relative_to(native/'bridge'):selected.add(file)
excluded={'node_modules','platforms','artifacts','.ns-profile','vendor'}
for directory,subdirs,names in os.walk(app):
    subdirs[:]=[name for name in subdirs if name not in excluded and name!='.git']
    assert all(not (Path(directory)/name).is_symlink() for name in subdirs),'Unexpected directory symlink'
    for name in names:
        file=Path(directory)/name
        if file.name=='qualified-candidate.json':continue
        assert not file.is_symlink(),f'Unexpected symlink: {file}'
        assert not file.name.startswith('.env') and 'signing.local' not in file.name,'Local configuration must not enter candidate.'
        assert file.suffix.lower() not in {'.p12','.pfx','.key','.mobileprovision'}
        selected.add(file.resolve())
selected.add(pack)
for name in ['examples/gui-runtime/index.html','examples/gui-runtime/bundle.js','examples/shared/engine.js']:
    selected.add((workspace/'Engine'/name).resolve())
files=[{'path':file.relative_to(workspace).as_posix(),'bytes':file.stat().st_size,'sha256':sha(file.read_bytes())} for file in sorted(selected)]
candidate_id=sha(json.dumps(files,sort_keys=True,separators=(',',':')).encode())
manifest={'schemaVersion':1,'goal':'g06-text-input','candidateId':candidate_id,'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'pending-mac-build-and-physical-iphone-acceptance','enginePackage':{'baseVersion':'0.2.1','targetMilestone':'0.2.2','path':pack.relative_to(workspace).as_posix(),'sha256':sha(raw),'integrity':sri,'verifiedMembers':members},'files':files,'published':False,'goalComplete':False}
manifest_file=app/'qualified-candidate.json'
manifest_file.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
output=args.output.resolve()
assert not output.exists(),'Refusing to overwrite an existing candidate archive.'
output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(output,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for row in files:archive.write(workspace/row['path'],row['path'])
    archive.write(manifest_file,manifest_file.relative_to(workspace).as_posix())
with zipfile.ZipFile(output) as archive:
    assert len(archive.infolist())==len(files)+1
    for row in files:
        data=archive.read(row['path']);assert len(data)==row['bytes'] and sha(data)==row['sha256'],row['path']
    assert archive.read(manifest_file.relative_to(workspace).as_posix())==manifest_file.read_bytes()
result={'status':'zip-members-readback-verified','path':str(output),'bytes':output.stat().st_size,'sha256':sha(output.read_bytes()),'filesVerified':len(files)+1,'candidateId':candidate_id,'engineMembersVerified':members,'originalsRetained':True,'deviceAcceptance':'pending'}
output.with_suffix('.verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
print(json.dumps(result,ensure_ascii=False))
