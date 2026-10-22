# 组件实验室与 ShaderLab 图标修复 · 2026-10-20

## 实现

独立应用 **Haiyue UI**，Bundle ID `org.haiyue.uivalidation`，复用 `examples/ui-validation/mobile`，不依赖 Engine。首页“更多组件”打开表单、展示和组合目录；可返回原有基础验收页。

共享节点从 18 增至 23：Checkbox、RadioGroup、Rate、Badge、Divider，Web 和 Native 使用相同数据契约。单选、复选和评分维持受控值及一次操作一组 valueChange/commit 事件；禁用、只读、重置和销毁均有测试。评分目前仅支持整数 0–count，count 为 1–10；徽标为独立文字；分隔线为水平线及标题。

折叠内容、步骤导航、按钮组是基础节点组合示例。日期/时间、级联、树、虚拟列表、表格、抽屉、通知、引导及拖拽/悬停仍待单独适配，不能视为 Web 全组件已完成原生化。VoiceOver/TalkBack 的完整人工验收也未完成。

Web 的徽标新增 opt-in `literal` 模式，保留 `0`、前导零和大数字；既有计数、圆点、状态模式不变。输入框绘制尺寸测试以其实际外框 `.control` 为准，覆盖内部可输入区域。原生新增子按钮显式声明 accessible、role、disabled/selected 状态，避免 NativeScript 重建 UIKit traits 后丢失禁用标记。

## 验证

- UI：typecheck、build、104 项 Node 测试及 43 个导出入口检查通过。
- Web：Chromium/WebKit 46 项回归通过；后续徽标/单选隔离调整的两项同机型定向复测通过；既有 Badge 及新增文字模式 4 项浏览器测试通过。
- Native：30 项自动化测试及移动消费者类型检查通过，包括组件更新、拒绝变更、动态移除监听和 50 次生命周期清理。
- 全新消费者目录：系统模块不安装 UI/Engine；移动 UI 消费者不打包 Web/Engine，通过。
- iPad：最终 IPA 真机通过复选、单选、评分/清空、禁用和只读状态、分类切换、折叠与步骤、横竖屏、后台恢复和 50 次页面释放。设备 JSON 确认 50 个旧 renderer 的节点/监听/资源/定时器全部归零；禁用选项的 NativeScript enabled 与 UIKit enabled 均为 false。
- iPhone：已连接状态下多次安装及设备信息读取超时，**未确认安装成功，真机待验收**。
- Android：安装包构建成功，ADB 当前无设备，**真机待验收**。

本次 50 次清理指 renderer 节点、监听、资源和定时器归零，不等于进程 RSS 或性能稳定性验收。

`packages.json` 固定本次私有开发包与应用输入 SHA；未发布 npm。设备报告为 `ipad-device.json`，包哈希为 `bundles.json`。完整截图在 `artifacts/ui-validation/catalog-20261020/ipad-attachments`，XCTest 结果在 `/private/tmp/ui-gallery-ipad-accepted.xcresult`；本目录保留 `ipad-test.log` 与三张目录截图。

## ShaderLab 图标

素材原本存在，但 iOS 未指定 AppIcon 编译入口，旧安装包没有 `Assets.car` 和图标声明。已在 `mobile/App_Resources/iOS/build.xcconfig` 设置 `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon`，并增加 `mobile/scripts/verify-ios-icons.mjs`，真机构建完成后检查 iPhone/iPad 图标声明与非空编译资源。

修复 IPA SHA-256：`01c36ab97ef72aa527f729575791d7ef2065949eab06c1bcbfb129d2815e23e1`。iPad 已覆盖安装；iPhone 传输超时，保留待同步。Android 原有 mipmap 图标路径有效，本次未修改。
