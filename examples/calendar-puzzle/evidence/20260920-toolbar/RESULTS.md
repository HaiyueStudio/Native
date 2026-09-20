# 工具栏防误触布局

日期：2026-09-20。

- 顺序改为旋转、翻转、提示、打乱。
- 普通按钮间隔维持 14 设计像素；提示与打乱间隔扩大为 52 设计像素。
- 分组之间添加 2 × 32 设计像素的浅绿色竖线，禁用交互。
- 打乱右侧保持原工具栏右边界；标题宽度同步预留，避免挤入按钮区。
- Android 与 iPhone 均成功构建、安装并采集最新画面；人工核对按钮顺序、独立间距、竖线及标题，显示正常。
- 两端均以正常存档启动，截图后退出诊断标记重新正常启动，没有执行打乱或改变玩家拼图。
- Games TypeScript 检查通过。日历拼图 Web 构建首次遇到 180 秒超时，随后目标构建成功（30.5 秒）；两端 Native 构建成功。

- Games 全量回归：643 通过、20 跳过、2 失败、8 超时取消。失败和超时均位于未修改的 MUGEN 测试；详见 games-tests.log。

## 触摸反馈与边框恢复

- 根因：GuiSystem 在 pointerup/pointercancel 后保留 hovered；按钮同时保留 focused，导致背景变色和边框加深。
- 修复：触摸结束/取消清除 hover；普通按钮触摸结束后清除仍属于该按钮的焦点。保留鼠标正常悬停，以及文本输入框和点击回调主动设置的输入焦点。
- Native 内嵌 Engine 包与完整性哈希已更新，Web 本地 Engine 依赖也已同步。
- 回归测试分别复现了背景残留和焦点边框残留；最终 GUI 专项 14/14 通过。Native 单元测试 32/32 通过。
- 最终 Android 与 iPhone 均安装成功，各 32/32 项交互检查通过，包括连续点击旋转/翻转/打乱、按住反馈、取消后清除 hovered/pressed/focused。
- 人工检查 `android-focus-released.png`、`iphone-focus-released.png`：背景白色，边框与相邻未点击按钮一致。`*-focus-pressed.png` 保留按下时的反馈。
- 最终诊断使用隔离存档，两台设备验证后均重新正常启动；未发起购买。
- Engine 仓库类型检查、测试、构建（示例限定 gui-runtime）、模块边界、职责边界、renderer prepare 检查通过。最终焦点改动另通过 GUI 专项和双端真机验证。
- API 总检查在未修改的 `@haiyue/ui` 能力入口与 package exports 不一致处失败；本次未改变公共导出。详见 engine-api-check.log。
