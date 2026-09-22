# 安卓阶梯数独验证 · 2026-09-21

APK 构建、覆盖安装成功，应用 ID `org.haiyue.games.ledsudoku`。`LED_STAIRCASE_SMOKE=true` 使用独立诊断存档，正常玩家棋局不参与自动填数。

- `android-journal.jsonl`：15 项专项检查全部通过；规则面板与按住帮助、Native Worker 生成 108 格、唯一解、挑战难度、缺口命中与最后一格、下方行笔记/填写/撤销、解释、完成后答案禁用与撤销、LED+奇偶组合、存档加载。
- 本机此次 seed 39、挑战、关闭 LED 的 Worker 新局耗时 198 ms，仅为单次实测，不代表所有种子上限。
- `android-led.png`：360 DIP 竖屏，浅蓝主题、LED+奇偶阶梯和盘面候选；完整盘面、工具栏、九宫格输入及底部操作均在屏内。红色 60 为测试机已有的帧率浮层。
- `android-normal-journal.jsonl`：结束诊断后已正常重启应用、恢复玩家存档。
- Native 类型检查、13 项测试通过；共享 Sudoku 范围 308 项测试通过。

## iPhone 更新

同日构建并签名成功，覆盖安装至已连接 iPhone 15 Plus。`ios/build.log` 保留构建记录；安装脚本兼容 Xcode 归档输出，避免直接 `.app` 符号链接失效时无法安装。

- `ios/smoke-host.jsonl`：15 项阶梯专项检查通过；seed 39 普通数字挑战题生成耗时 204 ms（含 Worker 通信和界面更新的单次测量）。
- `ios/dark.png`、`light.png`、`led.png`、`help.png`：深浅皮肤、LED 与奇偶组合、候选笔记和按住规则说明的实际应用窗口截图，竖屏棋盘与输入操作完整可见。
- `ios/before-host.jsonl` 最后一次 `suspend` 与 `normal-host.jsonl` 核对：原有杀手＋数比棋局 seed `3289726670`、15 格进度一致；`ios/normal/screen.png` 保存正常恢复画面。检查使用独立诊断存档，最后已无诊断参数正常启动。

本次仅 iOS 构建、安装及专项真机验证，没有修改引擎或重复执行全仓检查。
