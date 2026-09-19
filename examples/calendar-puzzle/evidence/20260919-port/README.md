# 日历拼图 iPhone 移植验证 · 2026-09-19

## 已完成

- Games TypeScript 检查通过。
- 日历规则、存档数据格式、等比视口和坐标映射：8 项测试通过。
- Native TypeScript 检查通过；纹理上传、方向策略和 UIKit 坐标桥接：4 项测试通过。
- `npm run build:target -- game:calendar-puzzle` 通过。
- Xcode iPhone Debug 签名构建通过。
- 浏览器共享渲染检查：棋盘/中文/GUI 显示，四格拼块拖拽吸附后显示 1/10，日期下拉正常显示。

## 安装状态

经用户明确选择，已先完整备份蜘蛛纸牌的 44 个本地文件（2,818,824 字节，包含可解析的 Preferences 和存档键），生成逐文件 SHA-256 清单，再卸载蜘蛛纸牌并安装日历拼图。备份位于 `examples/spider-solitaire/artifacts/backups/20260919-before-calendar-puzzle/`，被 git 忽略。

iPhone 15 Plus / Apple A16 GPU，Canvas/wgpu/Metal，1628×818 渲染尺寸。`iphone.png` 是原生 WebGPU 画面读回，已目视检查中文、棋盘、日期选择与旋转/翻转按钮。

`CALENDAR_SMOKE=1` 在独立测试存档中执行的 9 项检查全部通过：

- 原生指针拾取、取消后恢复位置、拖拽坐标映射。
- Engine GUI 旋转、翻转、日期选择。
- 四格拼块吸附，取消已放置拼块的拖动后恢复占用关系。
- 原生持久化存档读回。

随后终止并重新启动 App，`scene-ready` 确认恢复到 4 月、1 个已放置拼块、4 个占用格。第二轮检查也全部通过，日志未出现 GPU/宿主错误。证据为 `smoke-host.jsonl` 和 `restart-host.jsonl`。

最后以不带测试环境变量的正常模式启动，确认测试与截图开关均关闭、正式存档独立、画面持续呈现，无宿主错误（`normal-host.jsonl`）。手机停留在正常游戏界面。

## 全仓库验证边界

Games 全量测试：642 项，618 通过、20 跳过、2 失败、2 取消。异常均在 MUGEN 包/查看器测试，未修改这些文件。全量 build 在 2048 构建阶段触发 60 秒监督超时；本次日历拼图的目标构建单独通过。
