# 奖励提示接入验证（2026-09-20）

- Games / Native TypeScript 检查通过。
- Native 50 项测试通过：每日额度、跨日及回拨、持久化、重复/过期奖励回调、取消、离线、无填充、付费/撤销、存储失败、异步原生界面暂停与恢复、求解失败/过期结果不扣次数。
- Games 全量构建通过（包含所有 manifest 游戏及 worker，27 个产物完成标记）；最终 Calendar Puzzle 定向构建通过。
- Games 全量测试：716 项，686 通过、20 跳过、2 失败、8 取消。失败仍位于未修改的 MUGEN byte-exact 和 viewer/UI 测试，关联 Petra 测试取消；不属于本次奖励提示改动。摘要见 games-tests-summary.log。
- Android API 36 调试包已构建并更新到 X4000。隔离存档的 13 项 UI/广告失败恢复检查通过：每天 1 次免费提示、成功扣次、重复提示免费、额外提示选择、返回、六语言面板。
- 六语言截图已人工检查。德语按钮截断已修复；按钮文本按可用宽度调整，提示面板关闭后不再残留“正在求解”的状态。
- 真实 Google 测试广告请求：UMP 在该测试机网络上连接超时，返回 unavailable；没有绕过同意流程或伪造奖励。视频播放、真实 earned 回调未在设备上完成验证。游戏无扣次、广告余量仍为 2，原生返回后恢复渲染与输入。
- 广告/同意流程期间 GPU 游戏帧数保持不变，待调度渲染回调为 0（android-ad-final.jsonl），音频已暂停。
- iOS 真机包成功编译、链接和导出；iPhone 当前 unavailable，未安装本次更新、未完成 iOS 真机广告验证。
- 正式 AdMob App ID / Rewarded Unit ID 未提供。当前采用官方测试 ID，Debug 强制使用官方 demo 单元；Release 包存在测试 ID 时有构建校验，运行时也拒绝请求 demo 单元。

测试使用独立 puzzle namespace / reward wallet，不消耗玩家正式存档的提示额度，不触发真实购买。最终安装后恢复正常启动方式。
