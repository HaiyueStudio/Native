# HYA Native 组合场景验收

问题：七部分 HYA 的字体、图像、编辑器、音频与系统语义需要真实 iPhone 闭环，浏览器和模拟边界不能替代。

方法：此独立 NativeScript 应用只消费 `qualified-candidate.json` 锁定的公开 tarball，沿用原 NativeRenderHost、触摸／G06 编辑器、纹理和采样帧 PCM owner。资源异步就绪时重试同一帧请求；后台暂停、释放和 VoiceOver 回调继续走原生命周期。七部分场景、真实中英文字形、PNG、WAV 和完整字体许可均在 `src/assets/`。字体为有限 Latin／CJK 轮廓子集，不代表完整 shaping。

当前候选与校验结果以 `qualified-candidate.json` 及其绑定的公开包报告为准。旧评审包、旧失败和桌面 PCM 证据保留。Windows 严格类型、场景测试和 iOS JavaScript 打包仅证明准备就绪；Apple SDK 编译、NativeScript 元数据、签名安装、设备输出与 VoiceOver 仍须在 Mac／iPhone 完成，不提前记为通过。

Mac 使用 Node 24，在此目录执行：

```sh
npm ci
npm run verify:source
npm run test:pcm
bundle install
export IOS_TEAM_ID=自己的开发团队ID
npm run build:device
npm run run:ios
```

签名也可写入忽略的 `App_Resources/iOS/signing.local.xcconfig`。不要复制别人的签名配置。构建入口验证候选／资源、生成 C++ 头文件，按固定版本与原字节补正 Canvas 2.1.18 的动态偏移参数。C++ 默认使用 clang++，可通过 HYA_CXX 指定；Zig 同时设置 HYA_CXX_KIND=zig。原始 SDK 负例保留在 diagnostics，不进入应用依赖。

设备流程：

1. 点 Unlock，再点 Activate，确认一次 WAV、数据变为“你好世界”和状态变化；后台恢复后重新通过真实手势 Unlock。
2. 点击 HYA 文字，用真实中文／Latin／emoji 软键盘编辑，检查预编辑、提交／取消、选区、caret、键盘遮挡、安全区、横竖屏和后台恢复。
3. 检查 Pause／Run、Seek 0、Rate .5／2、Replace PNG 及反复进入／退出。音频负速率仍明确拒绝。
4. 单独运行 Native PCM probe，保留七种定时输出的实际／参考 Float32 数据；另检查实时解锁、时钟和系统中断。离线探针不替代实时输出。
5. 开启 VoiceOver，检查节点顺序、边界、激活、文字编辑转交、播报，以及隐藏／后台／销毁后无残留节点。激活只能提交一次事务和声音。
6. Save 记录人工检查点，End 记录清理；按钮本身不自动授予验收通过。

导出应用 Documents 的 `g11-hya-scene.jsonl`、`g11-host.jsonl`、实际／参考 PCM、设备截图和 Xcode 构建日志，同时保留 `artifacts/native-source-check-*/result.json`。这些证据必须与本次包哈希和实际安装构建对应。G13 记录单独追踪待验收项，未通过时阻止整版完成与发布。

Mac 宿主补充：iOS 原生 Base64 提供方需符合单字节 binary-string 语义；应用验证已有实现，不合格时使用本地字节转换并在释放时恢复原属性。中文文本必须先编码为 UTF-8，不能直接作为 btoa 的输入。

HYA 解析所需的 structuredClone 通过现有共享 Native 启动适配器补齐，直接锁定已使用的 core-js-pure@3.51.0；仅在系统缺少该能力时安装。缺少能力的七部分解析失败、修复后解析、循环引用、Map／Set、独立字节缓冲及不可克隆值拒绝均有回归检查。

Canvas 2.1.18 的 iOS 图片异步解码声明与 C++ 实现不一致：底层要求 ArrayBuffer。图片适配器复制准确的字节视图区间，再传入独立 ArrayBuffer，避免直接传视图导致 V8 原生崩溃；相应的边界、失败及迟到取消释放测试不代替物理图片验证。

设备发现 Canvas 小位图外部拷贝的行跨度越界；场景以独立的队列作用域仅处理自己持有的 HYA 位图，通过可复用 CPU Canvas 读 RGBA，再按 width×4 行跨度写入原 AssetManager 创建的纹理。保留 alpha 预乘和 RGBA/BGRA 排列；不支持的裁剪、翻转、色域和格式显式拒绝，其他来源仍走原队列，退出恢复属性。图片解码使用同版本受检的同步 ArrayBuffer 路径，避免其异步包装器强引用计数不递减造成的滞留。

PCM 结束后按钮直接显示通过数量，场景保持暂停；再次真实点击 Unlock 才恢复之前运行的播放。后台返回同样等待新手势，原本手动暂停的场景保持暂停。暂停／关闭后迟到的 unlock 不得自动恢复播放。第 9 轮七项 iPhone AVAudioEngine 原始 PCM 的 7,168 个 Float32 值经独立公式复核误差为 0；结果提示和后台流程另行复验，不等同完整资格。

PCM 异步状态通过 GuiButton.setText() 更新，使文字和绘制缓存一起失效；只写 text 字段再请求一帧会保留旧绘制结果。回归检查执行真实页面回调，在 Running 已呈现、场景暂停后分别完成／拒绝探针 Promise，检查公共 GuiRoot 的失效通知与重绘状态。第 10 轮用户报告的 Running 停留及原始成功 PCM 日志同时保留，不能以计算通过代替结果可见性。

HYA 编辑期间显示独立的原生顶部工具条，Done 通过现有 GUI 焦点 owner 完成输入并收起键盘，Cancel 先取消未提交的预编辑再退出；已提交内容保留。单行键盘 Done 同样结束编辑，若提交回调主动转移了焦点则不关闭新字段。控件在文本 session 关闭后隐藏，避免依赖被软键盘遮挡的底部操作区；场景释放时清空操作回调。

编辑工具条显式设置文字／背景颜色，避免 iOS 默认白字落在浅色页面上。仅在 `G13_INPUT_DIAGNOSTIC=1` 的诊断启动中自动聚焦示例字段，记录工具条真实矩形和原生命中结果，并生成 `g13-text-toolbar.png`；正常启动不自动聚焦或采集原生界面。该诊断不替代用户的中文输入与 Done／Cancel 验收。
