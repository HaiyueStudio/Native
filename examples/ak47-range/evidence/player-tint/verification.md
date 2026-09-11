# 玩家蓝灰色材质 — 2026-09-11

仅在玩家 ren42 模型实例加载后，将各 PBR 材质的基础颜色设为 sRGB `[0.45, 0.65, 1, 1]`，与原贴图叠乘形成蓝灰色迷彩。敌人使用独立材质实例，保留原始沙色迷彩；步枪在调色后才挂载。原始 GLB、贴图和玩法规则未改动。

- Games 与 Native 类型检查通过。
- `GAME_FILTER=ak47-range GAME_BUILD_TIMEOUT_MS=180000 npm run build` 通过。第一次采用默认 60 秒时限超时，重试耗时约 106 秒；本轮仅构建受影响游戏。
- Chrome 原生 WebGPU：横屏 44 项、竖屏 3 项检查通过，无未分类浏览器或 GPU 错误，横屏截图已目视检查。玩家与站立/倒地敌人的颜色可清楚区分。
- iOS 构建和签名通过，21 个模型/贴图资源逐字节检查通过。已更新 iPhone 15 Plus。
- 真机 47 项检查通过，原生截图已目视检查，运行日志无 error/failure。随后关闭验证与截图开关，恢复普通游玩模式。

`browser-*.json/png` 与 `iphone-verification.json`、`iphone.png` 保存结果和截图；`iphone-host.jsonl` 保存原生运行记录；`build-proof.json` 保存当前源码、网页包和原生包 SHA-256。工作区候选未发布，不宣称完成多机型或人工手感验收。

全仓 npm test 已运行完成但未通过：现存 HYMUGEN 固定哈希与 MUGEN Viewer 虚拟列表断言失败，另有 Petra 大型资源测试超时。未修改这些模块或放宽测试时限。本游戏的规则测试通过，完整原始结果见 `games-all-tests.log`。
