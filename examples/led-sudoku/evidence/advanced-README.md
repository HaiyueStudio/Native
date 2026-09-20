# 2026-09-20：清晰灯管与四种新规则

已构建并覆盖安装至 X4000（Android 14）。应用包名不变，升级保留旧存档。暗管为 `#162b33`，绘制不使用阴影，也不再提供辉光开关。

- `advanced-android.png`：真机四种规则组合，21 项检查通过后的棋盘。
- `advanced-smoke.jsonl`：原生 Worker、唯一解、候选、存档、旧新规则的运行记录。
- `advanced-outer-tap.xml` / `advanced-cell-tap.xml`：外围线索不误选格子，盘内选择 R1C2 正确。
- `advanced-filled.xml`：真实点击候选 4 后，进度为 26/81；随后撤销回到 25/81。
- `advanced-verification.json`：APK 哈希、构建、124 项共享数独测试、5 项移动端测试及浏览器交互结果。

网页互斥设置、取消、新局、常规模式、恢复存档等 9 类交互检查全部通过。新规则 38 项测试含 15 个非空组合 × LED 开关，另有原有规则的 86 项回归测试。

全 Games 仓库检查的范围限制：全量构建在无关的 2048 目标遇到现有 60 秒超时；全量测试有 HYMUGEN / Petra 失败。LED Sudoku 独立构建、全部专项测试、Games 与 Native 类型检查均通过。
