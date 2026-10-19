# G06 NativeScript adapter and private package identity

The M24 integration owner adds `@haiyue/native/ui` without re-exporting it from the root. The adapter consumes protocol 1 / schema 1.1 from the independent `@haiyue/ui/core` and `/portable` entry points. No shared protocol or completed G03/G05 evidence changes.

UI's published 0.2.0 does not contain the current portable API. G06 therefore consumes the G05 npm-pack artifact with SHA-256 `5408bc4048919435e624a2a760a4d80194ec386173cb0e3e3ca3a76ccae8a794`, then repacks its unchanged runtime as **private** `0.2.0-m24.0`. Native's new optional peer is this exact private prerelease, not a claim of compatibility with registry 0.2.0. The isolated Native package is `0.1.4-m24.0`, also private. `packages.json` records both input and output hashes. G10 must assign and test publishable versions. No frozen Native release manifest/tag is updated.

The adapter uses NativeScript 9.1.1 controls and lifecycle properties. UIKit notifications and Android text/composition-span observers supplement NativeScript's pre-edit text events. Native objects are accessed only inside loaded platform hooks; no private NativeScript field or delegate is overwritten. Shared state never receives native handles. Synchronous page commits assert the main thread; callers from a worker must explicitly schedule their application action on the host UI thread.

The NativeScript Page owns system safe areas. The renderer adds only the keyboard overlap on iOS; Android's host uses adjustResize. A custom already-inset host explicitly chooses `safeArea: 'host'`. Page rotation/split-screen relayout does not rebuild application state. PlatformView owns its native subtree and resources, and receives logical bounds plus pixel scale.

The standalone controls app is a consumer fixture, not the ShaderLab migration (G07). Its preview/editor slots deliberately show port lifecycle placeholders; this is not a GPU preview or a production code editor claim. Hardware Chinese IME, selection/clipboard, VoiceOver/TalkBack, iPad split-screen and native memory/performance evidence remain required before G06 can be complete.
