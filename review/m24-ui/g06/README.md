# G06 NativeScript 原生控件适配

2026-10-19：G07 增加属性结构比较、叶节点布局调度和无障碍字段增量更新，公共入口与事件契约不变。私有 `0.1.4-m24.10` 候选和真机状态见 [ShaderLab 验收](../../../../ShaderLab/review/m24-ui/g07/optimization/apple-jitter/README.md)。原生适配器测试通过，最新包的真机结果仍待补，不覆盖本页历史证据。

日期：2026-10-17。状态：**validating**。实现、自动化和独立 consumer 已交付；移动端物理专项及性能预算尚未全部验收，不作为正式发布通过记录。

## 交付

- 可选入口 `@haiyue/native/ui`，将 18 种共享组件映射到 NativeScript 原生控件，包含布局、输入、选择、Dialog、FormGroup 和 PlatformView。
- 复用 UI 的受控值、合成输入、提交和取消控制器；增量更新保留稳定节点，屏蔽程序设值回调，生命周期释放监听器和资源。
- 平台钩子处理 UIKit 编辑后通知、Android 合成 span、键盘、安全区、焦点与返回键。原生实例在 loaded 后使用，不写 NativeScript 私有字段。
- 独立演示应用 Haiyue UI（`org.haiyue.uivalidation`）、单元测试、iOS XCTest 场景及 `verify:ui` 统一入口。

[API 与组件能力矩阵](../../../bridge/ui/README.md) · [独立应用与继续验收步骤](../../../examples/ui-validation/mobile/README.md) · [包边界 ADR](../../../docs/for-ai/adr/2026-10-16-g06-nativescript-adapter.md)

本次只有原生控件及端口演示。preview/editor 用原生 Label 检验资源所有权，真实 GPU 预览、代码编辑器和 ShaderLab 页面迁移属于 G07。

## 构建身份与复现

[packages.json](packages.json) 记录已审计 G05 输入包、私有预览包、适配器及演示应用的逐文件哈希；[verification.json](verification.json) 记录源码、工具链、命令和结果。UI 预览是 `0.2.0-m24.0`，Native 预览是 `0.1.4-m24.0`，都未发布。已发布 UI 0.2.0 不含 core/portable，不能用其替换本次预览包。

包由 tarball 消费，无相邻 UI/Native 源码导入。设备构建复用本机 NativeScript 工具链和 SDK；全新 consumer 验证独立 npm 安装、类型检查和打包，不声称清空 SDK 缓存后从零下载工具链。

```sh
npm run verify:ui -- --profile core
npm run verify:ui -- --profile fresh
npm run verify:ui -- --profile mobile
```

core 检查当前源文件、应用输入和 tarball 身份，再执行语义回归及两平台类型检查。fresh 在新目录安装依赖，运行无 UI/Engine/NativeScript 的系统 consumer，编译无 Engine/Web 适配器的移动 consumer。mobile 要求 iPhone/iPad/Android 全部通过且匹配两包及应用哈希；存在待验收项时退出 2。desktop 返回 unsupported，由 G08 负责。

## 验证边界

自动化通过 16 项新增测试与 153 项既有回归。新增测试覆盖程序设值反馈抑制、合成草稿、异步弹窗关闭后重开、选择取消/过期结果、稳定 key、错误诊断、资源清理和依赖隔离。模拟中文事件证明控制器映射，不替代物理输入法。

实际设备的已测操作、构建身份和剩余项目以 [devices.json](devices.json) 为准。截图与应用诊断分别位于本目录的 screenshots / logs。完整本机构建输出与 xcresult 留在 `artifacts/ui-validation/`，不进入 npm 包。

尚待验收：三类设备的真实中文候选选择、emoji/组合字符、选区、复制粘贴、撤销重做及只读输入；VoiceOver/TalkBack、焦点恢复和系统字号；iPad 分屏/浮动键盘；原生堆观测、同机交互 p95 预算。50 次清理的计数归零不等于原生堆泄漏验收通过。未测平台特性不得因 capability 声明而视为通过。

Android 曾按用户要求暂缓，避免干扰 ShaderLab；随后用户明确表示安卓可以进行验收，已恢复 G06 设备检查。

## 验收发现与修复

1. iPad 首次弹窗正常，关闭后重开出现空白。改用 NativeScript Page 承载 Dialog，避免旧 UIViewController 保留已拆卸视图；等待原生关闭回调后才允许重新展示。Select 同样串行处理关闭与后续选择。回归测试覆盖异步关闭竞争。
2. 早期 Android 演示初始化失败：共享 Icon 请求了仅 iOS 支持的 `icons.system`。演示现按能力显式选择系统图标或图片资源；新增 Android 能力回归。用户恢复验收后继续测试修复版，早期失败不计通过。
3. 根据 iPad 截图调整 Tabs 内容布局、Dialog 内容内边距及按钮最小触控高度；iOS 可访问性焦点将 Page 的控制器转换为实际 UIView。
4. Android 严格解码暴露演示内嵌 PNG 的压缩校验和/分块 CRC 损坏，iOS 容错解码没有报错。修复编码并增加 PNG 完整性回归，避免演示图标阻断初始化。
5. Android 文案更新时，可访问描述曾拼入上一轮文字。将语义属性写入移到 text 更新之后，自动化检查控件树的描述与当前文字一致。
6. UIKit 文本框显式设空 accessibilityValue 会隐藏系统实际输入值。改为不覆盖原生文本/安全输入值，并通过保留内容的 XCTest 断言验证。Android 搜狗输入法会缓冲 ADB 注入的硬件按键，Enter 确认候选后失焦提交正常；不能将第一次 Enter 没有提交认定为故障，也不能将 ADB 英文注入计作真实中文或系统 IME Done 通过。
7. 用户在 iPhone 人工检查时确认其他交互正常，但输入后没有收起键盘入口。为 UIKit TextField/TextView 增加键盘附件中的原生“完成”按钮，结束编辑走既有失焦提交，卸载时移除控件及 action；未替换 NativeScript delegate。标签由 `keyboardDismissLabel` 接受应用的国际化文案，默认 `Done`。新增真机自动化检查单行/多行关闭、重开，以及不按回车直接完成后重建 50 次仍保留文字。新修复的设备结果单独记录，不沿用用户对旧构建的通过反馈。
8. Android 连续装卸触发 `onGlobalLayout` 访问已释放 GridLayout 的崩溃。视图加入窗口时，Android 会把最初的 ViewTreeObserver 监听迁移到窗口，旧 observer 变为 dead；原清理仅处理旧 observer，导致监听遗留。改为从仍存活的 observer 注销，并让已排队回调在释放后直接返回。新增回归模拟 observer 迁移和迟到回调；以真机连续装卸复测作为修复证据。
9. 第一版系统 Done 工具栏在 iPad XCTest 通过，但用户在 iPhone 的苹果系统键盘上仍看不到按钮。第二版给工具栏显式宽度后，iPhone 记录为 430 × 44 且已挂载到窗口，用户仍确认按钮不可见；因此“挂载/尺寸正常”不等于可见。最终改为普通 UIView 中的 UIButton，明确绘制按钮文字，避免依赖系统 UIBarButtonItem 的 Done 呈现。演示只截取自己的附件区域，不采集键盘按键或候选内容。前两版失败及最终结果分别记录，不用 iPad 推断 iPhone。
10. 10 月 17 日用户确认已看到“完成”，但附件的全宽黑色背景与系统圆角键盘不协调。改为透明附件，只在右侧按钮后绘制系统材质的圆角背景，保留 44 pt 点击高度及原有编辑提交路径。新版附件截图的空白区域已为透明；用户随后确认“样式正常，也能收起键盘”。附件截图只能证明自己的绘制结果，整体样式与点击结论来自这次真机人工确认。iPad 当日离线，保留上一版按钮的自动化结果及对应哈希，未标记为本次新包通过。
11. 安卓本次复查首次页签点击没有产生选择事件；重新读取当时的界面位置后切换正常。保留首次失败日志、界面树、截图和应用事件，不将其直接定性为产品缺陷。验收脚本增加连续两次控件边界一致的检查及点击坐标日志，之后重新执行；每一步仍断言实际应用状态，没有用重复点击绕过失败。

后续验收使用此处的应用入口和固定包；如任何运行代码、应用输入或包变化，重新生成身份并复测。G06 完成前保持 validating；没有推送、发包、标签或修改既有发布基线。

## 2026-10-18 ShaderLab 集成发现的 Apple 生命周期修复

G07 真机堆快照发现 iOS 通知/UIAction 持有的 JS 回调上下文可间接保留整个共享控件树。输入、完成按钮和键盘观察器现在使用可清空的模块级回调中继，dispose 时先解除业务回调，再注销原生观察器/action。另为 Native 渲染宿主的全局帧错误处理注册增加释放，避免持有最后一个已销毁宿主。

两项 jitless 真 GC 回归已纳入 `verify:ui -- --profile core`，连同原适配器用例共 22 项通过。ShaderLab 私有 Native `0.1.4-m24.6` 的 iPhone/iPad 页面释放和系统交互证据见 [G07 Apple 报告](../../../../ShaderLab/review/m24-ui/g07/optimization/apple-final/README.md)。这不代表独立 G06 演示的所有设备专项重验通过，不修改 G06 的 validating 状态或公开包版本。
