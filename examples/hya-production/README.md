# HYA Native 组合场景候选

问题：G11 七部分场景需要真实字体、图像、G06 编辑器与采样帧音频宿主；浏览器通过不能替代 iPhone 资格。现有音效池及 @nativescript/audio-context@1.3.3 丢失定时参数／循环区间，不能用立即播放或 JS 定时器冒充。

方法：本私有 NativeScript 应用只消费 vendor/ 内三个公开评审包，SHA-256／SRI 固定在 qualified-candidate.json，安装版本由锁文件固定。src/assets/ 包含来源无关的七部分 HYA、真实中英文字体轮廓、PNG 和 WAV；字体是保留原 OFL／版权的改名字集，有限字集与简单 Latin／CJK 不代表完整字体资格。应用复用 NativeRenderHost 的 Engine update、原触摸输入和 G06 编辑器，不增加时间线、布局器或设备采样器。资源异步就绪期间保持同一帧请求，后台暂停不补墙钟时间，退出取消准备与离线探针并清理各 owner。

src/image-host.ts 负责位图租约与取消，ios-image-host.ts 使用 Canvas 2.1.18 的编码字节解码。native/HyaPcmMixer.hpp 执行固定容量的采样帧指令；HyaPcmBridge.hpp 用有界 SPSC 交接，PCM 强引用与释放只在控制线程。关闭先封闭渲染门禁、确认回调静止再清理；硬件暂停冻结时钟而保留其他声音相位。src/audio-host.ts 使用公开 HyaAudioHost；Objective-C++ 提供 AVAudioSourceNode、文件解码／SHA、真实离线输出及中断入口。完成通知只在有待完成声音时轮询，不采样 HYA 时间线。

字节预检检查 UTF-8、取消和已知 SHA 向量。仅在运行时缺少能力时，由应用显式安装 SHA-256 digest／binary-string base64，并在最后一个异步任务退出后恢复原属性；不覆盖已有提供方，不声称实现其他 WebCrypto 能力。带音频的负速率仍在变更前以 E_AUDIO_RUNTIME_PROFILE 拒绝。

结论：33 项实际 Windows C++ 检查通过，包含 10,000 次内核循环、20,000 个真实双线程声音和控制线程 PCM 释放；3,584 个样本与独立公式及浏览器参考一致。另有公开端口／模拟 ObjC 边界检查。当前应用已通过真实 NativeScript SDK 声明的严格类型检查、14 项实际公开包／CPU／模拟文件边界检查和 iOS 目标 JavaScript 打包。自定义 ObjC 声明仍是头文件边界描述，**尚未经过 Apple SDK 编译、NativeScript 元数据生成、签名安装或设备 PCM／画质验收**；共享 API 准入与包体失败也保持。

在 Mac 的此目录准备和检查：

```sh
npm ci
npm run verify:source
npm run test:pcm
bundle install
export IOS_TEAM_ID=你的开发团队ID
npm run build:device
npm run run:ios
```

Ruby／CocoaPods／Xcodeproj 与字体依赖沿用 G06 固定配置；签名也可写入忽略的 App_Resources/iOS/signing.local.xcconfig。构建入口先核对候选／资产、生成精确 C++ 头文件，再应用经版本及原字节哈希限制的 Canvas 动态偏移补丁。C++ 默认使用 clang++，可用 HYA_CXX 指定编译器；Zig 另设 HYA_CXX_KIND=zig。结果写入忽略的 artifacts/。

设备上先点 **Unlock**，再点 **Activate**：应听到 WAV，数据更新为“你好世界”并触发原状态通道。点击文字使用真实中文软键盘，检查预编辑、提交、旋转和后台恢复；测试 Pause／Run、Seek 0、Rate .5／2 和 Replace PNG。后台恢复后须再次手势 Unlock。**Native PCM probe** 单独检查七种定时输出，原始实际／参考 Float32 和逐项结果写入日志；探针运行时等待结束。它不代表实时漂移、中断或完整设备资格。Save 仅记录人工检查点，End 记录清理；两者不会自动宣称验收通过。

导出应用 Documents 中的 g11-hya-scene.jsonl、g11-host.jsonl，并保留设备截图、Xcode 构建输出和 artifacts/native-source-check-*/result.json。后续仍需 Apple 编译／元数据、物理 iPhone 的真实 PCM、实时解锁／时钟／中断、像素与输入、OS 无障碍接入及完整验收。原音频 SDK 的负例复现器保留在 diagnostics/，不进入应用依赖。
