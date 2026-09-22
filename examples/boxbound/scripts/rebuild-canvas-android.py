"""Rebuild Canvas 2.1.18's C++ binding only; keep its Rust renderer and ABI.
Usage: python3 scripts/rebuild-canvas-android.py --ndk PATH --headers PATH --abi arm64-v8a
Headers: NativeScript/canvas commit 970bde07f0b80bd3192b9197b506719d78580748,
packages/canvas/src-native/canvas-android/canvas/src/main/cpp/include.
"""
import argparse, concurrent.futures, hashlib, json, pathlib, shutil, subprocess, tempfile, zipfile
APP = pathlib.Path(__file__).resolve().parents[1]
CANVAS = APP / 'node_modules/@nativescript/canvas'
CALLBACK_HASHES = {'PromiseCallback':'b989fcd12c20038d0e471478278960d18edb0db4b6f83cb22191a19bfd7435ac','AsyncCallback':'05b6c26fcc304d207c3c6053d919b8b32daf1008a207ab33567ce9e43c68a315'}


def patch_callback(source, name):
    assert hashlib.sha256(source.encode()).hexdigest() == CALLBACK_HASHES[name], 'Re-audit changed Canvas callback source'
    # Only change Android. A one-shot callback has one owner, transferred to the
    # looper, which deletes it on completion. A second heap owner leaks the shared
    # Inner, V8 persistent promise and BOTH pipe descriptors after every mapAsync.
    marker = '#ifdef __ANDROID__\n\nstruct ' + name
    before, android = source.split(marker)
    old = 'auto data = new ' + name + '(this->inner_);'
    assert android.count(old) == 1
    android = android.replace(old, 'auto data = const_cast<' + name + '*>(this); // owned by the one-shot looper callback')
    assert android.count('close(fd_[0]);') == 2
    android = android.replace('close(fd_[0]);', 'close(fd_[0]);\n                close(fd_[1]);')
    android = android.replace('int fd_[2];', 'int fd_[2] = {-1, -1};')
    android = android.replace('ALooper *looper_;', 'ALooper *looper_ = nullptr;')
    android = android.replace('void* data;', 'void* data = nullptr;')
    return before + marker + android


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--ndk',required=True);parser.add_argument('--headers',required=True);parser.add_argument('--abi',choices=['arm64-v8a','armeabi-v7a','x86','x86_64'],required=True)
    args=parser.parse_args();abi=args.abi
    assert json.loads((CANVAS/'package.json').read_text())['version']=='2.1.18'
    header_spec=json.loads((APP/'vendor/canvas-android/headers.json').read_text())
    for item in header_spec['files']:
        data=(pathlib.Path(args.headers)/item['path']).read_bytes()
        assert hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()==item['gitBlobSha1'], 'Header integrity mismatch: '+item['path']
    build=pathlib.Path(tempfile.mkdtemp(prefix='boxbound-canvas-build-'))
    source=build/'src';shutil.copytree(CANVAS/'platforms/ios/src/cpp',source)
    headers=build/'include';shutil.copytree(args.headers,headers)
    # Use the C interface shipped with this exact npm package, not latest Rust.
    shutil.copyfile(CANVAS/'platforms/ios/CanvasNative.xcframework/ios-arm64/CanvasNative.framework/Headers/canvas_native.h',headers/'canvas_native.h')
    input_hashes={}
    for name in ['PromiseCallback','AsyncCallback']:
        file=source/(name+'.h');text=file.read_text();input_hashes[name]=hashlib.sha256(text.encode()).hexdigest();file.write_text(patch_callback(text,name))
    lib=build/'lib';lib.mkdir()
    with zipfile.ZipFile(CANVAS/'platforms/android/canvas-release.aar') as z:
        original=z.read(f'jni/{abi}/libcanvasnativev8.so');rust=z.read(f'jni/{abi}/libcanvasnative.so');(lib/'libcanvasnative.so').write_bytes(rust)
    runtime=next((APP/'node_modules/@nativescript/android').rglob('nativescript-optimized-with-inspector.aar'))
    with zipfile.ZipFile(runtime) as z:
        (lib/'libNativeScript.so').write_bytes(z.read(f'jni/{abi}/libNativeScript.so'))
    toolchain=pathlib.Path(args.ndk)/'toolchains/llvm/prebuilt/darwin-x86_64/bin'
    target={'arm64-v8a':'aarch64-linux-android','armeabi-v7a':'armv7a-linux-androideabi','x86':'i686-linux-android','x86_64':'x86_64-linux-android'}[abi]
    compiler=toolchain/(target+'27-clang++')
    flags=['-std=c++17','-O2','-fPIC','-pthread','-fexceptions','-fno-builtin-stpcpy','-DTARGET_OS_ANDROID','-DV8_31BIT_SMIS_ON_64BIT_ARCH','-Wno-unused-result','-Wno-deprecated-declarations','-Wno-vla-extension']
    if abi in ['arm64-v8a','x86_64']:flags+=['-DV8_COMPRESS_POINTERS']
    for folder in [build,source,headers,source/'canvas2d',source/'webgl',source/'webgl/extensions',source/'webgl2',source/'webgpu']:flags+=['-I'+str(folder)]
    def compile(file):
        obj=build/(str(file.relative_to(source)).replace('/','_')+'.o')
        run=subprocess.run([str(compiler),*flags,'-c',str(file),'-o',str(obj)],capture_output=True,text=True)
        if run.returncode:raise RuntimeError(run.stderr)
        return str(obj)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:objects=list(pool.map(compile,sorted(source.rglob('*.cpp'))))
    output=APP/'vendor/canvas-android'/abi/'libcanvasnativev8.so';output.parent.mkdir(parents=True,exist_ok=True)
    subprocess.run([str(compiler),'-shared','-static-libstdc++',*objects,'-L'+str(lib),'-lNativeScript','-lcanvasnative','-llog','-lz','-lEGL','-lGLESv2','-lGLESv3','-landroid','-Wl,-z,max-page-size=16384','-Wl,-soname,libcanvasnativev8.so','-Wl,--no-undefined','-o',str(output)],check=True)
    subprocess.run([str(toolchain/'llvm-strip'),'--strip-unneeded',str(output)],check=True)
    dependencies=subprocess.check_output([str(toolchain/'llvm-readelf'),'-d',str(output)],text=True)
    assert 'libc++_shared.so' not in dependencies, 'Use static C++ runtime, matching the original Canvas AAR'
    previous=output.with_suffix('.json')
    original_hash=hashlib.sha256(original).hexdigest();replaces=[]
    if previous.exists():
        old=json.loads(previous.read_text());replaces=[old['sha256'],*old.get('replacesSha256',[])]
        if original_hash==old['sha256']:original_hash=old['originalSha256']
    manifest={'canvasVersion':'2.1.18','abi':abi,'ndk':'27.2.12479018','headerCommit':'970bde07f0b80bd3192b9197b506719d78580748','sourceHashes':input_hashes,'replacesSha256':replaces,'originalSha256':original_hash,'rustSha256':hashlib.sha256(rust).hexdigest(),'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}
    output.with_suffix('.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest));shutil.rmtree(build)

if __name__=='__main__':main()
