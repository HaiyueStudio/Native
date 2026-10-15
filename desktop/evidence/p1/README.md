# P1 开发候选验证 · 2026-10-13

**状态：validating，不是已通过全部门禁的 0.2.0 发布版。** 用户确认没有 Steamworks SDK/App ID 和 Game Center 成就后台配置；Steam C++ 尚未针对实际 SDK 编译或冻结，GameKit 本地编译/模拟不等于真实账号验收。

## 本机结果

| 检查 | 结果与范围 |
| --- | --- |
| Native 自动化 | 统一 [development 报告](development-report.json) 及 [测试日志](native-tests.log)。含提供者单调进度/账号隔离/隐藏项、迟到回调、GameKit FFI 复用、四种魔方手动完成与辅助还原排除。 |
| 无 Engine 与打包接口 | 同一报告中的 engine-free-consumer、packed-extension-consumer、npm-typecheck。实际打包 Native + Engine + extension 在独立目录装配，纯系统路径没有 Engine/NativeScript SDK。 |
| Engine 扩展 | 全仓 typecheck/test/build、boundaries/API/docs 与 Chrome WebGPU 示例通过。详见 [Engine 评审](../../../../Engine/review/achievements/README.md)。不包含真实平台 SDK。 |
| 共享 Web 魔方 | [浏览器结果](web-rubik.json)：四种魔方真实 GPU GUI 的打乱、旋转、历史还原与清理验证通过。测试工具借用 Engine Chrome runner；被测文件是 Native 独立打包的 build/web，无相邻源码运行依赖。 |
| Intel Mac GPU | [最终 GPU 门禁](desktop-validation.jsonl)：420 帧、四类魔方、20 次 resize、图像读回、Worker/存档/音频 API。截图 [成就面板](desktop-achievements.png) 来自原生 GPU，不是浏览器；只是自动化展示，不代替人手交互。 |
| 干净目录与独立应用 | [构建日志](fresh-build.log)：空 npm 缓存、重新下载并验哈希、无相邻 Engine/Games 源码、编译/打包；包含独立程序 420 帧验证，测试 PATH 无 Node/Deno。制品身份见 [package.json](package.json) 和 [standalone-summary.json](standalone-summary.json)。不是未安装开发工具的干净系统验收。 |
| GameKit 编译 | [编译记录](gamekit-compile.json)：共享 Swift 的 macOS 动态库与 arm64 iOS 对象文件成功编译。未启用平台账号、未修改后台配置。 |
| 移动候选构建 | [构建摘要](mobile-builds.json)：iOS 真机目标与 Android APK 构建通过。最终面板修复版尚未重新安装到手机。 |
| iPhone 修复过程 | [初始化日志](iphone-initialization.jsonl)：补 Intl 后 Apple A16/Metal 初始化并呈现 18 帧，随后后台暂停。用户表示暂不方便，明确保留界面/触摸/旋转/恢复验收。没有把旧截图当成新候选成功证据。 |

源代码与依赖身份见 [source-files.json](source-files.json)。Engine 固定 0.2.1；extension 为 SHA-256 标识的 `0.2.1-p1` 开发归档，不能当成 registry 0.2.1 或直接覆盖发布。

## 本轮发现并修复

- macOS 后台启动会遇到 `Invalid Surface Status`，初始焦点曾错误假定为前台。初始化改为读取实际焦点，测试显式聚焦自己的窗口并串行运行；保留持续前台失败的错误门槛。早期失败日志 [surface-before-focus.log](surface-before-focus.log) 保留，不宣称驱动/surface 问题已全面消除。
- NativeScript iOS 没有 `Intl`。宿主增加固定版本的 locale polyfill，并用无 Intl 的独立进程回归中英切换。初次真机失败见 [iphone-before-intl.jsonl](iphone-before-intl.jsonl)。该兼容层仅提供 locale 规范化，不虚称包含所有 Intl 能力。
- 成就面板的底层 HUD 文字曾叠在列表上；现在打开面板同时隐藏底层绘制/命中，关闭恢复。
- Steam stat 达到 target 不能替代 `GetAchievement` 的解锁位；测试覆盖“stat 完成但成就未解锁”时仍保留上报意图。Game Center 部分进度也不会被浮点舍入为 100%。

iPhone 宿主日志中 `host-created.engine: 0.1.0` 是旧公共宿主的硬编码诊断标签，不是本次实际依赖；以移动锁文件、vendor/P1 哈希和构建身份为准。

## 发布前仍需完成

1. Steam SDK 版本/运行库冻结及 Windows/macOS 真账号矩阵；Game Center iPhone/独立 macOS 各自签名配置和真实认证/上报/读回/UI。
2. Windows x64 与 Apple Silicon Mac 最终制品安装、物理键鼠/手柄/DPI/音频、最终候选 30 分钟持续运行。
3. 同设备、同画质、预热后三轮 Web / 新原生 TS 宿主 / Rust 性能对比；本记录中的限帧正确性检查不是性能结论。
4. iPhone 与 Android 最终候选交互和既有系统功能回归；Android 本轮无 ADB 设备。既有 ATT restricted 真机记录保持未完成。
5. 发布版号、兼容范围与签名/公证、完整 Deno/V8/Skia 传递许可/SBOM。现有 ad-hoc 开发签名不支持直接发行或 Game Center 验收。

重跑入口和平台准备见 [开发说明](../../../examples/achievements-validation/README.md) 与 [Windows 接续](../../WINDOWS-HANDOFF.md)。旧 0.1.4 冻结记录保持不变；本轮未执行发布、推送或标签操作。
