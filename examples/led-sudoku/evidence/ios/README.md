# iPhone 真机验证

2026-09-20，iPhone 15 Plus / iOS 18.7.3，应用 `org.haiyue.games.ledsudoku`。

- Xcode 26.2 SDK，Debug / arm64 自动开发签名构建、真机安装和启动成功。
- Haiyue Engine 通过 Canvas/wgpu/Metal 使用 Apple A16 GPU；首帧日志见 `smoke-host.jsonl`。
- 21 项真机自动检查通过：出题、唯一解、候选、笔记、填入、撤销、擦除、提示、完成与撤销完成、普通模式、规则组合、四种新规则、存档恢复。自动检查使用独立诊断存档。
- TypeScript 检查通过；6 项手机端测试通过，包括 iPhone 安全区布局，见 `typecheck.log` / `tests.log`。
- 实际安全区为顶部 59 pt、底部 34 pt；可用区域 430×839 pt，棋盘外框 410×410 pt，9 个候选按钮约 130.7×57.7 pt。`normal-relaunch-host.jsonl` 的 `settled-layout` 记录最终尺寸；初始化的首帧尺寸可能仍处于 UIKit 布局阶段。
- 已检查实际应用窗口截图：`screen.png` 为四种新规则的自动诊断棋局，`normal/screen.png` 为正常存档恢复后的棋局。截图由应用自己的 UIKit 窗口生成，包含真实 Metal 棋盘；`board.png` 为单独 GPU 帧读回，采集时刻可能早于窗口截图。
- 更新安装保留应用数据，正常模式恢复棋局；最后一次正常启动不启用诊断或截图参数。

以上验证包含程序化游戏操作及截图检查，不等同于全部规则组合的人工逐格触摸验收。构建输出和签名应用压缩包位于忽略目录 `../../artifacts/ios/`。

## 挑战难度更新

同日更新已重新签名安装。`challenge-host.jsonl` 中 24 项检查全部通过，新增 LED、常规、四种高级规则组合的挑战门槛检查。后三组出题阶段分别约 2.3、2.8、3.5 秒（包含原生界面更新，非纯算法基准）。`challenge/screen.png` 为四规则挑战真机窗口截图，2 个完整已知数、5 格部分亮灯，摩天大楼每侧 4 个线索。独立诊断完成后已正常启动恢复原棋局，见 `challenge-normal-host.jsonl`。

## 通用竖屏启动页

同日使用 `NativeEngineLaunchPage({ orientation: 'portrait' })` 重新构建并安装到同一台 iPhone。`splash/launch.png` 为首帧淡出前的原生品牌遮罩截图，覆盖完整 430×932 pt 屏幕；保留共享 Haiyue 月牙与载入文案。

- `splash/smoke-host.jsonl`：25 项真机检查通过，包含首帧呈现后品牌遮罩状态为 `hidden`。
- `splash/normal-host.jsonl` 和 `splash/normal/screen.png`：正常存档 seed `3190604827`、26 个已填格成功恢复；遮罩已隐藏，内容区域仍为 430×839 pt、顶部 59 pt，棋盘 410×410 pt，候选按钮约 130.7×57.7 pt。
- 数独 6 项测试、calendar-puzzle 54 项测试及两者 TypeScript 检查通过；共享组件测试包含横竖屏与小窗口布局、旋转重排、失败/淡出竞争和监听清理。日志位于 `splash/`。
- 更新安装保留应用数据，最后恢复无诊断参数的正常启动。此轮真机验证为 iOS；Android 沿用同一 NativeScript 页面实现，未在本轮重新安装验证。

## 生成性能优化

同日重新构建并安装共享规则优化版本。`generation/smoke-host.jsonl` 中 25 项检查通过。新增 `generation-timing` 测量 `newGame` 调用到完成界面更新，包含 Worker 通信、规则生成和 UI 更新，不包含之后的额外诊断求解：

| 配置 | seed | 实测等待 |
| --- | ---: | ---: |
| LED 挑战 | 39 | 337 ms |
| 常规挑战 | 39 | 340 ms |
| 温度计＋摩天大楼＋XV＋四数和挑战 | 20260921 | 2768 ms |

这些是固定顺序下的单次真机样本，不代表所有种子的最坏耗时。诊断使用独立存档；正常启动日志为 `generation/normal-host.jsonl`。源码与 Native 类型检查通过，数独 138 项专项测试、Native 6 项测试通过；桌面 18 题对比记录见 Games 中的 `generation-performance.md`。

## 连续升降规则修正

按用户确认，新题的紫线要求整条线每步差 1，可以全部升序或全部降序，不允许乱序、跳号或转向。新题保存 `lineRule: ordered`；缺省该字段的旧版无序 Renban 存档保留原语义，规则说明明确标为旧版。

共享生成器、候选和完整解校验均已接入，网页与原生设置/帮助同步更新。143 项数独专项检查、Native 6 项测试和 Native 类型检查通过。网页构建与实际页面文案检查通过；全仓检查另有 Boxbound 类型错误、MUGEN 断言失败及 Petra 超时，本轮未修改这些模块。

iPhone 已覆盖安装，`ordered/smoke-host.jsonl` 中 26 项真机检查通过，新增 `continuous lines ascend or descend by one` 验证生成路径。诊断使用独立存档；最后恢复不带诊断参数的正常启动，日志见 `ordered/normal-host.jsonl`。
