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
