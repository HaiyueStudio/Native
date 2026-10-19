# M24 G01 Native 基线

在 Native 根目录运行 `node desktop/experiments/m24-ui/baseline/verify.mjs`。它复用现有 package staging 过滤规则，在隔离临时目录中只安装 Native 文件，类型检查并执行真实 achievements/local API。结果见 `results/baseline.json` 和 `results/consumer.log`。

这个结果证明隔离入口不需要 UI/Engine，不是对全部系统功能和根兼容入口的概括，也没有引入新 UI 后端。

桌面继续使用 M23 固定宿主。G04 必须在 Windows x64 与 macOS arm64 验证中文 IME（输入/取消/确认/候选窗位置）、剪贴板与选区、Narrator/VoiceOver、modal 焦点、跨屏 DPI 以及 GPU 预览共存。Intel Mac 开发运行与交叉编译不能代替两端验收；Steam/Game Center 配置不构成 UI 前置条件。

G08 以同一平台/相同工程/同一组件规模复测性能。设备与输入服务尚未采集的项目显式 pending，不写成零耗时或通过。正式范围、资源所有权及入口见 [边界 ADR](../../../../docs/for-ai/adr/2026-10-16-m24-ui-boundaries.md)。
