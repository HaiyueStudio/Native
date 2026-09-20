# 日历拼图：免费每日挑战与一次性解锁发行方案

核对日期：2026-09-20。以先发行海外 App Store / Google Play 为工作假设；中国大陆单独列出。本文是发行准备方案，当前代码没有接入收费或限制已有玩家功能。商店实际价格、税费及地区条款以开发者后台为准。

## 商业判断

推荐尝试「每日免费 + US$1.99 一次性完整版」，适合没有持续内容服务器成本的轻量单机益智游戏。每日挑战给玩家回访理由，万年历和提示给付费用户明确的便利。它更适合作为低维护成本的小体量产品，通过自然搜索、解谜社区和口碑获客；不应预期仅凭低价就能盈利。

| 内容 | 免费 | 完整版（一次购买） |
| --- | --- | --- |
| 当天日期拼图、重试、旋转、翻转、打乱 | 开放 | 开放 |
| 已完成日期和无提示星星记录 | 可查看 | 可查看 |
| 选择任意历史或未来日期并游玩 | 点击后说明完整版权益 | 开放 |
| 提示拼块正确位置 | 点击后说明完整版权益 | 开放 |
| 中/英/日语言、音效设置、原有存档 | 开放 | 开放 |

付费页建议写「一次购买，永久解锁当前完整版：任意日期 + 拼图提示」，显示商店返回的本地化价格，提供“恢复购买”和“暂不”。不做订阅，不增加广告，不对免费的当天挑战限制尝试次数。不要笼统承诺所有未来独立产品都免费。

主要风险：只玩每日题的玩家可能一直不付费；完全没有提示时新手也可能卡住后流失。先按上述规则上线测试，观察首日完成率、次日/第七日回访、付费转化和退款，再决定是否给一次可选的新手提示试用。不要把付费提示包装成赢得星星的方式：使用提示的记录仍无星星。

收益示例仅用于预算：按符合优惠计划且合计商店费用 15% 的情况，1.99 × 85% ≈ US$1.69/笔（尚未扣当地税、退款、汇兑及其他成本）。10,000 次安装，若转化率假设为 1% / 3% / 5%，约为 US$169 / 507 / 846，**这些转化率是情景假设，不是市场预测**。3% 时每次安装的预计收入约 US$0.051，付费买量空间很小。Apple US$99 年费约需 59 笔此类购买才仅覆盖年费。

Apple Small Business Program 为符合条件且加入计划的开发者提供 15% 费率；Google 费率已经按地区、安装日期和项目区分，不能统一称为所有情况固定 15%。目前首个 US$1M 优惠档在适用地区的官方表列为 10% 服务费 + 使用 Google Play Billing 时的 5% 支付费，其他市场仍列 15% 优惠档。上线时分别确认账户所属计划。[Apple 小型企业计划](https://developer.apple.com/app-store/small-business-program/)、[Google 现行费率](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)。

## 产品规则需要先定清楚

- 每日日期按设备本地日期；前后台恢复和跨午夜时重新检查。“今天”变了时提示切换，保存正在玩的局面，避免突然清空玩家进度。
- 离线单机无法可靠阻止用户修改系统日期。对 US$1.99 产品，建议接受有限绕过，不为防改时间引入强制联网或账号。
- 历史记录可免费查看；从记录进入任意日期才校验完整版权限。购买、取消购买和恢复购买都不清空局面。
- 提示按钮、万年历点击、设置快捷日期、存档恢复等入口应共享同一权限判断，不能只隐藏按钮。自动化诊断入口不应作为正式版绕过方式暴露给用户。
- 棋盘依赖月、日、星期，跨年会出现相同题型；宣传宜说“自由选择日期”，不要宣称每个年份每个日期都有独一无二的新题。
- 同一 Apple / Google 账号可在对应平台恢复非消耗品。两家商店之间**不会自动互通购买**；第一版可明确分别购买，跨平台权益同步需要另做账号和服务端。
- 存档云同步与恢复购买是两个不同功能；当前本地记录不等于已实现跨设备进度同步。

## 内购实现准备

一个商品即可，例如 `calendar_puzzle_full_unlock`。iOS 配置 Non-Consumable；Android 配置一次性非消耗商品，永久权益不调用 consume。优先直接使用商店内购，不增加外部支付路径。

实现 NativeScript 平台适配层，对游戏只暴露商品查询、购买、恢复、权益变化事件。iOS 可通过 StoreKit 2 原生桥接；Android 使用受支持版本的 Play Billing（当前应选 8 或更新版本，7 的常规提交期限已在 2026-08-31 到期）。不能用一个可编辑的本地布尔值作为唯一购买凭据。[Apple 内购说明](https://developer.apple.com/in-app-purchase/)、[Google Billing 版本周期](https://developer.android.com/google/play/billing/deprecation-faq.html)。

购买状态至少包含：未购买、加载商品、等待付款、已验证购买、取消、失败、退款/撤销。价格来自商品查询，不能在按钮里硬编码 `$1.99`。校验交易后才解锁；重复回调幂等；重启与恢复前台重新核对权益。缓存已验证权益支持离线，恢复联网后处理撤销。Google 成功购买需要及时 acknowledge（官方期限为三天），否则可能被自动退款；待处理付款不能提前解锁。[Google 集成文档](https://developer.android.com/google/play/billing/integrate)。

服务端验证有利于防篡改及退款同步，但会带来维护成本。第一版至少使用平台交易验证、持久化已验证状态和恢复机制；如果使用服务端，密钥只放服务端，明确网络失败和离线策略。不要将“客户端缓存”宣传为无法破解。

测试清单：购买成功、取消、付款待处理、断网、重复点击、进程中断、重装恢复、换同平台设备、退款撤销、账号切换、价格查询失败、跨午夜、闰年、已有记录升级兼容。iOS 用 StoreKit 测试 / Sandbox / TestFlight，Android 用许可测试账号和测试轨道；不能只靠本地模拟购买通过就提交。

## 开发者和商店资料

| 项目 | Apple | Google Play |
| --- | --- | --- |
| 开发者账户费用 | US$99/年或本地定价 | US$25 一次注册费 |
| 主体 | 个人或组织，组织通常需 D-U-N-S 等身份资料 | 个人或组织，身份核验；组织资料按后台要求 |
| 收款 | 付费应用协议、银行和税务资料 | 商家/付款资料、银行和税务资料 |
| 测试 | TestFlight，外部测试可能先经 Beta 审核 | 内部测试、封闭测试；符合新个人账号条件者需额外测试门槛 |
| 正式包 | Xcode Archive，App Store 分发上传 | 签名 Release AAB，启用 Play App Signing，备份上传密钥 |

费用来源：[Apple 会员](https://developer.apple.com/support/compare-memberships/)、[Google 注册步骤](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)。Google 对 2023-11-13 之后创建的个人账户，要求至少 12 名测试者连续加入封闭测试 14 天，再申请生产访问权限；完成天数不是自动获批，还需要真实测试反馈。[测试要求](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB)。

准备统一的名称、开发者品牌、客服邮箱、可公开访问的支持页和隐私政策 URL；中/英/日简介、关键词/描述、无占位文案的截图、图标、Google 商店宣传图。截图必须来自真实版本，明确“每日免费，任意日期与提示需一次性购买”，不要把引擎启动 Logo 当作游戏商店图标。

填写年龄分级、目标受众、广告声明、版权、出口合规及所选地区所需主体信息。App Store 隐私标签和 Google Data safety 要包括内购 SDK、分析/崩溃 SDK 的实际行为；不能因为是单机就直接填写“完全不收集”。建议首版不加广告和追踪 SDK，以降低包体与维护成本。[Apple 隐私说明](https://developer.apple.com/app-store/app-privacy-details/)、[Google 用户数据政策](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en-GB)。

核对字体、音乐音效、图案和第三方库的商用许可，保留来源记录及开源声明；新品牌 Logo 上线前做名称/图形近似检索。若选择儿童受众，应额外核查儿童政策，不能仅因益智玩法就默认满足。

## 目前项目的发行缺口

- iOS 已用 Xcode 26.3 构建，符合当前 Xcode 26+ / iOS 26 SDK 的最低上传工具版本方向；仍需正式账户、分发签名、Archive、隐私清单及实际上传验证。当前免费开发签名安装成功不等于可直接商店发行。[Apple 当前 SDK 要求](https://developer.apple.com/news/upcoming-requirements/)。
- Android 当前 `App_Resources/Android/app.gradle` 为 targetSdkVersion 35。新提交现应针对 API 36，需升级编译 SDK/目标 SDK 并验证 Android 16 的横屏、大屏、边到边行为，不能只改一个数字。[目标 API 要求](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)。
- 当前安卓调试 APK 约 193.3 MiB，包含原生运行时；应构建 Release AAB，检查按设备拆分后的实际下载大小，剥离调试内容，不能把调试 APK 大小直接当成最终商店下载量。
- 初查当前 APK 内 arm64 的 `libNativeScript.so`、`libcanvasnative.so`、`libcanvasnativev8.so` 的 ELF LOAD 对齐均为 16 KiB。这只是静态检查通过，仍需检查最终 AAB/APK ZIP 对齐并在 16 KiB 系统启动、提示求解和切后台实测。Google 官方文档历史公告和目前页面的期限表述不同，以上架后台提示为准；本项目直接将兼容性作为发布门槛。[16 KiB 官方指南](https://developer.android.com/guide/practices/page-sizes)。
- 当前没有内购适配层、恢复购买、权限控制、正式商店隐私/支持页。现有游戏能力完整不等于商业发行准备完成。
- 还应验证不同 GPU 的 Vulkan/Metal 支持、低内存设备、平板布局、连续操作、无网运行、字体回退和音频中断。GUI 依赖 GPU 绘制，对辅助功能支持应按真实能力填报。

## 提交顺序

1. 确定个人/公司发行主体、首发国家和名称；注册并验证开发者账户，填写收款资料和协议。
2. 在两家后台创建应用和非消耗商品；冻结正式 Bundle ID / Application ID、签名与商品 ID。
3. 实现内购、恢复购买、每日权限与异常状态；完成正式包、性能/稳定性与购买矩阵测试。
4. 准备三语商店页面、截图、隐私政策、客服入口、年龄分级；实际核对依赖和数据安全表。
5. TestFlight / Play 测试轨道验证。Google 新个人账号预留至少 14 天连续封闭测试及生产资格审批时间，不承诺固定审核周期。
6. iOS 将首个内购随对应 App 版本一并提交，审核备注说明免费当天题、如何触发付费功能、如何恢复；Android 选择正式 AAB 和商品可用地区，提交审核。
7. 首次发布使用可控地区/手动发布，观察崩溃、ANR、退款、玩家卡关和转化，后续版本再做分阶段更新。[Apple 提交流程](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app)、[Google 发布流程](https://support.google.com/googleplay/android-developer/answer/9859751?hl=en)。

## 中国大陆单列

Apple 明确要求中国大陆提供游戏审批号及对应支持文件，例如 ISBN 核发单或批复、营业执照；适用时还需 ICP 备案信息。不能因“先免费、以后内购”就假定豁免。正式选择大陆发行前，按发行主体和实际模式核实资质路径及成本；没有这些资质时先选择其他可发行地区。[Apple 中国大陆资料要求](https://developer.apple.com/cn/help/app-store-connect/reference/app-information/app-information)。

建议执行顺序：先把海外的无广告每日免费版 + US$1.99 完整版做成可测试版本，同时准备账户与商店资料；获得真实留存和付费数据，再决定扩大地区与内容投入。
