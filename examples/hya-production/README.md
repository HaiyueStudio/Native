# HYA Native 组合场景候选

问题：G11 七部分场景需要真实字体、图像、G06 编辑器与采样帧音频宿主；浏览器通过不能替代 iPhone 资格。现有音效池及 @nativescript/audio-context@1.3.3 丢失定时参数／循环区间，不能用立即播放或 JS 定时器冒充。

方法：本私有 NativeScript 应用只消费 vendor/ 内三个公开评审包，SHA-256／SRI 固定在 qualified-candidate.json，安装版本由锁文件固定。src/assets/ 包含来源无关的七部分 HYA、真实中英文字体轮廓、PNG 和 WAV；字体是保留原 OFL／版权的改名字集，有限字集与简单 Latin／CJK 不代表完整字体资格。应用复用 NativeRenderHost 的 Engine update、原触摸输入和 G06 编辑器，不增加时间线、布局器或设备采样器。资源异步就绪期间保持同一帧请求，后台暂停不补墙钟时间，退出取消准备与离线探针并清理各 owner。

src/image-host.ts 负责位图租约与取消，ios-image-host.ts 使用 Canvas 2.1.18 的编码字节解码。native/HyaPcmMixer.hpp 执行固定容量的采样帧指令；HyaPcmBridge.hpp 用有界 SPSC 交接，PCM 强引用与释放只在控制线程。关闭先封闭渲染门禁、确认回调静止再清理；硬件暂停冻结时钟而保留其他声音相位。src/audio-host.ts 使用公开 HyaAudioHost；Objective-C++ 提供 AVAudioSourceNode、文件解码／SHA、真实离线输出及中断入口。完成通知只在有待完成声音时轮询，不采样 HYA 时间线。

字节预检检查 UTF-8、取消和已知 SHA 向量。运行时缺少 SHA-256 digest 时由应用显式安装；binary-string base64 还验证现有提供方的单字节语义、非法输入拒绝及非补齐输入，替换不合格实现并在最后一个异步任务退出后恢复原属性。合格提供方保持，不声称实现其他 WebCrypto 能力。带音频的负速率仍在变更前以 E_AUDIO_RUNTIME_PROFILE 拒绝。

首帧先用同一零时差请求等待必需资源与绘制帧就绪，再启用场景；统一清屏后让 GUI 加载已有颜色，避免擦掉 HYA 图层。场景明确声明原 G06 输入端口，左上对齐使横竖屏的文字／输入／语义矩形一致；Activate 从公开快照取得限定 ID，并提供同区域可见按钮与普通指针动作。字体二进制保持，调整场景可运行构建器的 --keep-font 模式。

ios-semantics-host.ts 通过借用画布的独立子容器投影系统语义，保留原 G06 UIKit responder 和其他子视图。矩形直接使用公开快照及 [UIKit 容器坐标接口](https://developer.apple.com/documentation/uikit/uiaccessibilityelement/accessibilityframeincontainerspace)，稳定节点保留原生身份。焦点／激活／增减回到原 HYA 队列；VoiceOver 激活先在真实系统动作中进入音频解锁，迟到结果重新检查存活身份。隐藏、禁用、后台与销毁阻止动作；相同快照不反复替换原生集合，播报按修订去重。这里尚无物理 VoiceOver 资格。

结论：33 项实际 Windows C++ 检查通过，包含 10,000 次内核循环、20,000 个真实双线程声音和控制线程 PCM 释放；3,584 个样本与独立公式及浏览器参考一致。另有公开端口／模拟 ObjC 边界检查。当前应用通过真实 NativeScript SDK 声明的严格类型检查、28 项公开包／CPU／模拟文件及 UIKit 边界检查和 iOS JavaScript 打包。同一场景资产另在实际浏览器 GPU 验证 320×480、390×844、844×390：真实中英文字、PNG／按钮标题、原 G06 几何、可信指针、一次性数据／事件／WAV 及最终资源清理通过。浏览器和模拟 UIKit 均不代替物理 Native；自定义 ObjC 声明仍是头文件边界描述，**尚未经过 Apple SDK 编译、NativeScript 元数据生成、签名安装或设备 PCM／画质验收**。共享准入、GUI/font 包体和全局门禁仍待完成。

当前候选锁定 extensions `d80554655911`（压缩包 508,543 字节），包含字体位图按租约栅格化、有界配方缓存，以及缓存淘汰后保持稳定的字体 owner／配方身份；engine／animation-spec 的既有字节不变。本轮锁文件只更新这份候选，其余依赖版本与 SRI 保持。OpenType 的 `fs:false` 仅在其解析模块生效，与该版本自身的 browser 声明一致；字体仍经原资源端口提供字节，不提供 Node 字体文件导出。更新后严格类型、28 项测试、iOS JavaScript 打包及三种视口的实际浏览器场景均已复核；旧设备构建不能替代这份候选的 Apple／物理设备验收。

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

Mac 构建修复（2026-10-30）：NativeScript 关闭 Clang 自动链接，因此显式链接 AVFoundation；固定 iOS 运行时不能解析 Unicode 属性正则，Webpack 在宿主打包边界展开字符集合，原始 tarball 不变。转换插件与字符数据由锁文件固定。源码检查使用正常 ESM 入口，去掉会被视为真值的字符串 `hmr=false`，并检查 Unicode 转换和无热更新状态。Canvas 的文本导入边界使用固定 `text-encoding-utf-8@1.0.2`，覆盖所消费的 UTF-8 严格解码、BOM、字节视图与分段输入合同，不提供其他编码。应用在 `Application.run` 前安装已有取消控制器兼容实现。检查点补充音频状态、采样帧与采样率。这些修复的 G13 验证在独立传输包工作副本中执行，不将本目录历史候选自动升级或授予真机资格。

设备上先点 **Unlock**，再点 **Activate**：应听到 WAV，数据更新为“你好世界”并触发原状态通道。点击文字使用真实中文软键盘，检查预编辑、提交、旋转和后台恢复；测试 Pause／Run、Seek 0、Rate .5／2 和 Replace PNG。后台恢复后须再次手势 Unlock。**Native PCM probe** 单独检查七种定时输出，原始实际／参考 Float32 和逐项结果写入日志；探针运行时等待结束。它不代表实时漂移、中断或完整设备资格。Save 仅记录人工检查点，End 记录清理；两者不会自动宣称验收通过。

开启 VoiceOver 后检查两项 HYA 节点的阅读顺序、框选边界和按钮激活；双击文本应交给原 G06 原生键盘，检查编辑、后台恢复和退出后没有残留节点。系统激活按钮也必须只提交一次事务和声音。

导出应用 Documents 中的 g11-hya-scene.jsonl、g11-host.jsonl，并保留设备截图、Xcode 构建输出和 artifacts/native-source-check-*/result.json。后续仍需 Apple 编译／元数据、物理 iPhone 的真实 PCM、实时解锁／时钟／中断、像素与输入、VoiceOver 编辑转交／播报及完整验收。原音频 SDK 的负例复现器保留在 diagnostics/，不进入应用依赖。

HYA 解析所需的 structuredClone 通过现有共享 Native 启动适配器补齐，直接锁定已使用的 core-js-pure@3.51.0；仅在系统缺少该能力时安装。缺少能力的七部分解析失败、修复后解析、循环引用、Map／Set、独立字节缓冲及不可克隆值拒绝均有回归检查。

Canvas 2.1.18 的 iOS 图片异步解码声明与 C++ 实现不一致：底层要求 ArrayBuffer。图片适配器复制准确的字节视图区间，再传入独立 ArrayBuffer，避免直接传视图导致 V8 原生崩溃；相应的边界、失败及迟到取消释放测试不代替物理图片验证。

设备发现 Canvas 小位图外部拷贝的行跨度越界；场景以独立的队列作用域仅处理自己持有的 HYA 位图，通过可复用 CPU Canvas 读 RGBA，再按 width×4 行跨度写入原 AssetManager 创建的纹理。保留 alpha 预乘和 RGBA/BGRA 排列；不支持的裁剪、翻转、色域和格式显式拒绝，其他来源仍走原队列，退出恢复属性。图片解码使用同版本受检的同步 ArrayBuffer 路径，避免其异步包装器强引用计数不递减造成的滞留。

PCM 结束后按钮直接显示通过数量，场景保持暂停；再次真实点击 Unlock 才恢复之前运行的播放。后台返回同样等待新手势，原本手动暂停的场景保持暂停。暂停／关闭后迟到的 unlock 不得自动恢复播放。第 9 轮七项 iPhone AVAudioEngine 原始 PCM 的 7,168 个 Float32 值经独立公式复核误差为 0；结果提示和后台流程另行复验，不等同完整资格。

PCM 异步状态通过 GuiButton.setText() 更新，使文字和绘制缓存一起失效；只写 text 字段再请求一帧会保留旧绘制结果。回归检查执行真实页面回调，在 Running 已呈现、场景暂停后分别完成／拒绝探针 Promise，检查公共 GuiRoot 的失效通知与重绘状态。第 10 轮用户报告的 Running 停留及原始成功 PCM 日志同时保留，不能以计算通过代替结果可见性。

HYA 编辑期间显示独立的原生顶部工具条，Done 通过现有 GUI 焦点 owner 完成输入并收起键盘，Cancel 先取消未提交的预编辑再退出；已提交内容保留。单行键盘 Done 同样结束编辑，若提交回调主动转移了焦点则不关闭新字段。控件在文本 session 关闭后隐藏，避免依赖被软键盘遮挡的底部操作区；场景释放时清空操作回调。

编辑工具条显式设置文字／背景颜色，避免 iOS 默认白字落在浅色页面上。仅在 `G13_INPUT_DIAGNOSTIC=1` 的诊断启动中自动聚焦示例字段，记录工具条真实矩形和原生命中结果，并生成 `g13-text-toolbar.png`；正常启动不自动聚焦或采集原生界面。该诊断不替代用户的中文输入与 Done／Cancel 验收。
