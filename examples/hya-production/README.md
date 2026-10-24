# HYA Native 组合播放准备

问题：G11 公开 Player 的图片、字体位图与音频需要显式平台宿主。现有音效池及 `@nativescript/audio-context@1.3.3` 不能直接满足完整采样帧调度合同，不能用立即播放或 JavaScript 定时器冒充。

方法：`src/image-host.ts` 管理平台返回位图的租约、取消与字节视图隔离，`src/ios-image-host.ts` 接 Canvas 2.1.18。`src/audio-timing-probe.ts` 提供七项离线 PCM 验收，`diagnostics/ios-audio-sdk-timing-probe.ts` 用于检查实际 SDK；已知 1.3.3 的调度／循环缺口应产生失败。通用模块与 iOS 入口使用不同名称，避免平台解析产生自身循环导入。

`native/HyaPcmMixer.hpp` 是已实现的固定容量、单渲染线程混音内核，执行已经提交的音频帧指令，不采样 HYA 时间线。PCM 由调用方持有，直到取走完成记录才能释放；已完成但未取走的 slot 保留容量。当前支持单声道／立体声，其他映射明确拒绝。`native/HyaPcmBridge.hpp` 已实现有界 SPSC 指令／完成交接和渲染入口门禁：强引用只由控制线程保存，取消不占队列槽位，完成记录被领取后才释放 PCM。关闭先 `sealRender()`，等待 `renderQuiescent()`，再完成内核清理；平台仍须停止回调后才能销毁桥对象。硬件暂停使用可恢复门禁，静止后 `serviceSuspended()` 可处理取消／完成而不推进采样；`resumeRender()` 保留其他声音原相位。不能从主线程同时调用裸混音内核。

结论：图像通用适配器通过严格公开类型、十项 CPU 生命周期及双 DPR 的实际浏览器 GPU 检查。混音内核通过 Windows 原生 C++ 的 18 项检查，包含分块不变性、定时参数与 10,000 次完整循环；3,584 个 PCM 样本与独立公式及浏览器参考一致。当前总计 33 项实际 C++ 检查通过（原内核 18 项、线程桥及硬件暂停 15 项）；真实双线程完成 20,000 个声音实例，PCM owner 全部在控制线程销毁，C++ 渲染段 `operator new/delete` 观察均为 0。`src/audio-host.ts` 已用公开 HyaAudioHost 类型接入；`src/ios-audio-host.ts` 转发原生解码、输出、暂停和关闭，27 项类型／模拟边界检查通过，完成通知轮询只在待完成声音存在时运行。`App_Resources/iOS/src/HYANativeAudio.mm` 已准备 AVAudioSourceNode 输出、SHA／Float32 文件解码、离线引擎采样及中断处理；尚未经过 Apple SDK 编译、元数据生成或设备验证，独立 NativeScript 应用也尚未装配。

在带 Xcode 编译工具的 Mac 上，可先运行同一可移植内核检查：

```sh
node test/run-pcm-bridge.mjs
node scripts/prepare-ios-native.mjs
```

默认使用 `clang++`；也可通过 `HYA_CXX` 指定编译器，`HYA_CXX_KIND=zig` 使用 `zig c++`。结果写入忽略的 `artifacts/`，不进入发布包。测试拦截 C++ `operator new/new[]`，不等于对完整平台分配器或 iOS 回调做过测量。

剩余：装配七部分场景及匹配的公开评审包，Apple SDK 构建／链接与原生模块元数据，真实 iOS 的 PCM／解码／SHA／时钟／中断测试、字节能力预检，以及物理 iPhone 完整场景验收。原音频 SDK 的负例复现器留在 diagnostics/，不作为应用源码依赖。Engine 共享准入和包体门禁仍独立保留。
