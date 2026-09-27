# @haiyue/native 0.1.1 — 待发布

本次保持已有原生适配入口，补充可配置的非消耗型内购、已验证权益、AdMob/UMP 和奖励额度模块。UI、文案、解锁规则、商品/广告 ID 和隐私声明由应用负责。日历拼图及其已提交审核版本不修改。

新增入口：`purchases`、`purchases/native`、`rewards/native`、`rewards/policy`、`monetization/build`。这些商业化入口标记为实验性；后续新游戏须完成真实商店和广告验收。支持边界、平台 SDK 固定版本及构建接线见 [接入说明](../bridge/monetization/README.md)。不支持订阅、消耗型商品或跨平台账号权益。Android 验证服务模板单独部署，不进入移动 npm 包。

奖励钱包迁移为 v2 通用 results，兼容读取旧 hints 数据；每日免费额度当天有效，广告奖励持续累积。升级前应备份持久化数据，迁移后不承诺旧版本回退兼容。内购操作合并并发请求，恢复失败仅在当前权益验证通过时恢复访问；广告策略按进程统一，冲突配置拒绝执行。此次冻结也覆盖自 0.1.0 后的共享触摸输入及 Sky Strike 输入修正。

发布门禁新增 root/npm 干净依赖安装、冻结 npm 制包工具及元数据、私有候选制包、包类型检查和真实 tarball 的 iOS/Android 入口解析。正式制包仍校验 `native-v0.1.1` 标签；历史 `v0.1.1` 标签属于原项目，不重用。

验收记录位于 `release/evidence/native-0.1.1/`，逐项说明实际通过范围和未验收项。源码/编译测试及本地 StoreKit 测试不能代替 Sandbox、TestFlight、Play Billing 或真实 UMP/广告验收。通过门禁不代表已发布 npm，也不代表应用商店发布。
