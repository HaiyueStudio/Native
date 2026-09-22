# Canvas 2.1.18 Android callback lifetime fix

The 2026-09-22 Boxbound ANR exhausted the process file-descriptor limit. Each
`GPUBuffer.mapAsync` left a `PromiseCallback` owner alive, retaining its pipe and
V8 promise. `prepare()` allocated a second callback sharing the same `Inner`,
while completion deleted only that second callback. Cleanup also omitted the
pipe's write end. `AsyncCallback` has the same ownership pattern.

The patch transfers the original one-shot callback to the looper (no second
owner), closes both pipe ends, and initializes Android callback data/handles.
iOS is unchanged. GPU completion still uses a real mapped GPU fence; no timers,
forced garbage collection, arbitrary FD closing, or disabled synchronization.

These four libraries replace only `libcanvasnativev8.so`. The Rust renderer,
NativeScript runtime and game Engine remain unchanged. Each ABI manifest records
original, replacement and Rust-library SHA-256 hashes. `patch-canvas-native.py`
checks hashes before replacing AAR members and is invoked by `patch-canvas.mjs`.
Canvas source and binaries are covered by the adjacent upstream LICENSE.

To reproduce on macOS with official Android NDK 27.2.12479018:

```sh
python3 scripts/fetch-canvas-headers.py /tmp/canvas-android-headers
python3 scripts/rebuild-canvas-android.py --ndk /path/to/android-ndk-r27c --headers /tmp/canvas-android-headers --abi arm64-v8a
```

Repeat the rebuild for `armeabi-v7a`, `x86`, `x86_64`. Public Android headers are
pinned to NativeScript/canvas commit `970bde07f0b80bd3192b9197b506719d78580748`
and checked against Git blob hashes; the Rust C interface and all C++ sources
come from the installed, version-checked npm package. Rebuilds link the C++
runtime statically, matching Canvas's standalone Android packaging.

`node --test test/canvas-callbacks.test.mjs` exercises the original and patched
Android callback headers with real POSIX pipes and fake V8/looper bindings: the
original fails ownership checks; 4,000 patched completions release all handles.
`node scripts/device.mjs launch stress` runs debug-only isolated save tests,
20,000 real GPU readbacks, and three passes through all eight mirror puzzles.
Only arm64 has been tested on a physical device; other ABIs are cross-compiled.
