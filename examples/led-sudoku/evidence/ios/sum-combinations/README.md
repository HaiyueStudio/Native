# iPhone 更新验证

2026-09-21，iPhone 15 Plus，应用 org.haiyue.games.ledsudoku。

- 最新 iOS 签名构建通过，77.370 秒；见 ios-build.log。
- 从签名 IPA 提取 Payload/ledsudoku.app 后覆盖安装，未卸载应用。
- 独立诊断存档 119 项检查全部通过；见 smoke-host.jsonl。
- 新 45 法则与求和联立提示 49 ms，七步解释、应用候选、继续提示和撤销检查通过。
- 测试完成后返回普通游戏，核对更新前后玩家存档全部 data 字段一致：seed 3211962978，25 格已填；原设置亦一致。
- screen.png、board.png 为恢复原棋局后的实际截图，已检查竖屏布局与九宫格候选按键，无溢出遮挡。
- 未修改引擎，没有运行全仓检查。
