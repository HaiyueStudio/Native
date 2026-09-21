# 不等号去冗余与出题优化真机验证

2026-09-20，已连接 iPhone，应用 `org.haiyue.games.ledsudoku`。

- 数独专项 164 项、Native 6 项测试通过，双方限定范围类型检查通过；未修改引擎或执行全仓检查。
- 网页主包/生成 Worker 构建、iOS 签名构建通过（`ios-build.log`）。
- 安装后通过独立诊断存档执行 39 项检查（`smoke-host.jsonl`），包含生成后不等号的局部有效性、唯一解、挑战门槛、规则组合及设置界面。
- 单次请求到界面更新：LED 挑战 seed 39 为 267 ms，经典挑战 seed 39 为 288 ms，四高级规则挑战 seed 20260921 为 4359 ms。包含 Worker/UI 开销；不直接等同于 Node 纯生成基准。
- 测试结束后恢复普通启动。安装前后玩家棋局 seed 3201254713、已填 26 格、标准/关闭 LED/开启数比的规则配置保留，见 `before-host.jsonl` 与 `restored-host.jsonl`。
- 没有自动删改旧存档的符号；新算法在新数独生效。相同玩家种子在新生成器下已知数不变，符号从 15 个减少到 10 个，R2C5 下方冗余符号消失且仍唯一。模型回归及基准在 Games 的 `games/led-sudoku/evidence/clue-pruning/`。

更新后的签名应用归档：`artifacts/ios/led-sudoku-iphone.zip`。
