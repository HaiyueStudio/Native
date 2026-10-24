# HYA Native 组合场景候选

问题：G11 七部分场景需要真实字体、图像、G06 编辑器与采样帧音频宿主；浏览器通过不能替代 iPhone 资格。现有音效池及 @nativescript/audio-context@1.3.3 丢失定时参数／循环区间，不能用立即播放或 JS 定时器冒充。

方法：本私有 NativeScript 应用只消费 vendor/ 内三个公开评审包，SHA-256／SRI 固定在 qualified-candidate.json，安装版本由锁文件固定。src/assets/ 包含来源无关的七部分 HYA、真实中英文字体轮廓、PNG 和 WAV；字体是保留原 OFL／版权的改名字集，有限字集与简单 Latin／CJK 不代表完整字体资格。应用复用 NativeRenderHost 的 Engine update、原触摸输入和 G06 编辑器，不增加时间线、布局器或设备采样器。资源异步就绪期间保持同一帧请求，后台暂停不补墙钟时间，退出取消准备与离线探针并清理各 owner。

src/image-host.ts 负责位图租约与取消，ios-image-host.ts 使用 Canvas 2.1.18 的编码字节解码。native/HyaPcmMixer.hpp 执行固定容量的采样帧指令；HyaPcmBridge.hpp 用有界 SPSC 交接，PCM 强引用与释放只在控制线程。关闭先封闭渲染门禁、确认回调静止再清理；硬件暂停冻结时钟而保留其他声音相位。src/audio-host.ts 使用公开 HyaAudioHost；Objective-C++ 提供 AVAudioSourceNode、文件解码／SHA、真实离线输出及中断入口。完成通知只在有待完成声音时轮询，不采样 HYA 时间线。

字节预检检查 UTF-8、取消和已知 SHA 向量。仅在运行时缺少能力时，由应用显式安装 SHA-256 digest／binary-string base64，并在最后一个异步任务退出后恢复原属性；不覆盖已有提供方，不声称实现其他 WebCrypto 能力。带音频的负速率仍在变更前以 E_AUDIO_RUNTIME_PROFILE 拒绝。

首帧先用同一零时差请求等待必需资源与绘制帧就绪，再启用场景；统一清屏后让 GUI 加载已有颜色，避免擦掉 HYA 图层。场景明确声明原 G06 输入端口，左上对齐使横竖屏的文字／输入／语义矩形一致；Activate 从公开快照取得限定 ID，并提供同区域可见按钮与普通指针动作。字体二进制保持，调整场景可运行构建器的 --keep-font 模式。

ios-semantics-host.ts 通过借用画布的独立子容器投影系统语义，保留原 G06 UIKit responder 和其他子视图。矩形直接使用公开快照及 [UIKit 容器坐标接口](https://developer.apple.com/documentation/uikit/uiaccessibilityelement/accessibilityframeincontainerspace)，稳定节点保留原生身份。焦点／激活／增减回到原 HYA 队列；VoiceOver 激活先在真实系统动作中进入音频解锁，迟到结果重新检查存活身份。隐藏、禁用、后台与销毁阻止动作；相同快照不反复替换原生集合，播报按修订去重。这里尚无物理 VoiceOver 资格。

结论：33 项实际 Windows C++ 检查通过，包含 10,000 次内核循环、20,000 个真实双线程声音和控制线程 PCM 释放；3,584 个样本与独立公式及浏览器参考一致。另有公开端口／模拟 ObjC 边界检查。当前应用通过真实 NativeScript SDK 声明的严格类型检查、28 项公开包／CPU／模拟文件及 UIKit 边界检查和 iOS JavaScript 打包。同一场景资产另在实际浏览器 GPU 验证 320×480、390×844、844×390：真实中英文字、PNG／按钮标题、原 G06 几何、可信指针、一次性数据／事件／WAV 及最终资源清理通过。浏览器和模拟 UIKit 均不代替物理 Native；自定义 ObjC 声明仍是头文件边界描述，**尚未经过 Apple SDK 编译、NativeScript 元数据生成、签名安装或设备 PCM／画质验收**。共享准入、GUI/font 包体和全局门禁仍待完成。

当前候选锁定 extensions `9a11987eae13`（压缩包 508,411 字节），包含字体位图按租约栅格化与有界配方缓存；engine／animation-spec 的既有字节不变。锁文件只更新这份候选并移除一个无引用的旧 webpack 项，其余依赖版本与 SRI 保持。OpenType 的 `fs:false` 仅在其解析模块生效，与该版本自身的 browser 声明一致；字体仍经原资源端口提供字节，不提供 Node 字体文件导出。更新后严格类型、28 项测试、iOS JavaScript 打包及三种视口的实际浏览器场景均已复核；旧设备构建不能替代这份候选的 Apple／物理设备验收。

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

开启 VoiceOver 后检查两项 HYA 节点的阅读顺序、框选边界和按钮激活；双击文本应交给原 G06 原生键盘，检查编辑、后台恢复和退出后没有残留节点。系统激活按钮也必须只提交一次事务和声音。

导出应用 Documents 中的 g11-hya-scene.jsonl、g11-host.jsonl，并保留设备截图、Xcode 构建输出和 artifacts/native-source-check-*/result.json。后续仍需 Apple 编译／元数据、物理 iPhone 的真实 PCM、实时解锁／时钟／中断、像素与输入、VoiceOver 编辑转交／播报及完整验收。原音频 SDK 的负例复现器保留在 diagnostics/，不进入应用依赖。
