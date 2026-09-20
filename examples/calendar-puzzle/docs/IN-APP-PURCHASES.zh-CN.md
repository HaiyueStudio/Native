# 日历拼图：非消耗型内购

## 本次实现

- 免费：当地日期的当日拼图、旋转/翻转/打乱、浏览历史和星星、三种语言。
- 一次性解锁：提示，以及选择任意日期开始游戏。
- 商品 ID：`calendar_puzzle_full_unlock`。iOS 为 Non-Consumable；Google Play 为一次性商品（永久购买选项），不可调用 consume。
- 建议在商店后台设置美国基础价 USD 1.99，其他地区由商店定价。客户端不硬编码金额，也不自行换算；使用 StoreKit `displayPrice` 和 Play `formattedPrice`。价格由平台字体绘制，保留本地化货币、空格和文字，避免固定字形表把货币显示成问号。
- 设置里可进入“解锁完整版”，提示/非今日日期会打开同一个面板。恢复购买、重新连接、返回、玩今天都有独立入口。忙碌和待付款时不可重复购买。
- 取消、验证失败和退款不清空历史或拼图。退款关闭提示/任意日期权限；当前非今日局面保留但冻结，用户明确选择“玩今天”才切换。

## 原生与服务端

客户端入口 `src/purchases`，纯状态机 `Native/bridge/purchases`，游戏权限和面板 `Games/games/calendar-puzzle/purchases.ts` / `purchase-ui.ts`。

**iOS：** StoreKit 2 在原生 Swift 内验证 transaction，仅 `.verified` 的非消耗型交易授予权限；启动/回到前台读 `currentEntitlements`，监听 `Transaction.updates`，正确结束已验证交易并恢复未完成交易。只有用户点击“恢复购买”才调用可能弹登录框的 `AppStore.sync()`。撤销交易后重新读取权益。断网时由 StoreKit 的已验证本地交易提供已购权益；完全离线无法立即知道远端退款。

**Android：** Play Billing 8.3.0，先 queryPurchases 再交给自有服务端验证 Google `purchases.productsv2`；校验商品、数量、非租赁/未消耗状态。付款完成后服务端 acknowledge，成功后签发权益，不消费。重复通知合并处理；断网/失败不会把 pending 当成功。已验证签名权益可离线使用最多七天，超过期限需要联网重新验证，不重新收费。退款/撤销查询成功立即覆盖旧权益；完全离线不保证即时撤销。

启动、回前台、恢复网络、手动恢复/重试会重查。没有常驻轮询，不会为了内购恢复持续渲染。Google 验证服务没有部署、URL/公钥为空时不能发起安卓购买，避免收款后无法交付。

服务代码与部署说明见 `Native/services/calendar-entitlements/README.md`。私钥、Google service-account JSON 不进入 App、仓库或聊天。签名验证服务需要 HTTPS、限流和密钥保护。此版无游戏账号；仅支持各自商店账户内恢复，不做苹果/安卓跨平台共享。

## 商店配置（需要开发者账号）

1. **App Store Connect**：应用 Bundle ID `org.haiyue.native.calendarpuzzle`，添加相同 ID 的非消耗型内购，填写中/英/日本地化名称和说明、价格与销售地区、审核截图。完成付费协议、税务和收款资料。首次内购和应用一起提交审核。使用正式 Apple Developer 账号签名，当前免费开发签名不等于可上架/可测真实内购。
2. **Play Console**：包名 `org.haiyue.games.calendarpuzzle`，一次性商品 ID 同上；单个永久 buy 选项，数量 1，先不配置租赁、预购、批量购买或复杂优惠。激活商品/地区，配置支付资料，上传签名 AAB 到内部测试，加入许可测试人员，从 Play 安装测试版本。侧载调试包和没有 Google Play 服务的设备不能代替正式测试渠道验证。
3. 部署 Google 验证服务。把 HTTPS 完整端点和 RSA 公钥放入 `src/purchases/config.ts` 后重新构建。商店密钥只在服务端。保持现有商品 ID；如需改 ID，先同步原生配置、服务端与后台。
4. 使用 Apple Sandbox/TestFlight、Google license tester 测试支付。开发中不要使用真实银行卡做自动化付款。Debug `CALENDAR_SMOKE` 仅隔离玩法回归且不触碰生产存档；Release 的原生构建检测会禁用此入口，不能用 Intent 参数绕过付费。

## 上架前必测矩阵（目前真实交易尚未执行）

| 场景 | 预期 |
| --- | --- |
| 新用户、今日/非今日、提示 | 今日可玩；其他日期和提示需解锁；历史免费可看 |
| 沙盒购买成功 | 本地化价格；付款后解锁；重启仍可使用 |
| 付款页面取消 | 不扣款/不解锁；局面保留；可再次发起 |
| 家长批准/延迟付款 | pending 不解锁；完成后回调或下次启动恢复 |
| 确认付款后杀进程 | 下次启动重查、验证、确认，恢复权益，不重复收费 |
| 连点购买/重复通知 | 一次结算；幂等验证，不消费、不反复加权益 |
| 新装恢复、换商店账号 | 当前账户可恢复；无购买账户不能继承旧在线权益 |
| 首购断网/服务器断网 | 不虚构成功、不显示伪造价格；恢复网络后可重查 |
| 已购离线/租约过期 | 已验证缓存宽限；Android 七天过期后锁付费功能 |
| 沙盒退款/撤销/拒付 | 联网重查后锁付费功能；保留日期、拼图、星星 |
| 三语言、不同货币 | 面板正常；金额来自商店，货币/小数格式完整 |
| Release Intent 注入 smoke | 不触发免费全功能测试入口 |

## 已执行验证（2026-09-20）

- Android API 36 原生构建通过；X4000 Android 14 更新安装并正常启动。无商店连接情况下“提示→解锁面板”显示错误状态，购买禁用，局面保留；截图在 `evidence/20260920-iap`。
- iOS StoreKit 2 Swift、通用 iOS arm64 和连接设备签名构建均通过。已更新安装到 iPhone 15 Plus，解锁后 11/11 真机检查通过：真实 StoreKit 初次查询、当天免费、提示/其他日期限制、返回保留局面、免费历史浏览及中英日面板。当前商品返回 unavailable，价格为空，购买不可用。已恢复正常存档启动；真实购买仍未执行。
- Native 32 项测试通过，其中 16 项覆盖购买状态/日期权限/本地权益缓存；服务端 5 项测试通过，覆盖签名、防篡改、幂等、pending/refund、错误商品、确认失败及重试。
- Games/Native 类型检查、Games 全量构建及日历拼图目标构建通过。
- Games 全量测试：672 项，650 通过、20 跳过、2 个既有 MUGEN 测试失败（HYMUGEN byte-exact / viewer manifest）。与本次内购无关，未修改这些模块。

还缺：商店商品实际创建/激活、Android 验证服务部署和配置、沙盒购买/恢复/退款的端到端验收。**当前不是可以直接收费上架的完成状态。**

官方依据：[Apple StoreKit](https://developer.apple.com/documentation/storekit)、[Play Billing 集成](https://developer.android.com/google/play/billing/integrate)、[Play 验证安全](https://developer.android.com/google/play/billing/security)。

## iPhone 免费版界面诊断

Debug 构建可使用 `CALENDAR_PURCHASE_SMOKE=1` 启动：保留真实 StoreKit 适配器，使用独立的 `calendar-purchase-smoke` 存档，检查当天免费、提示限制、任意日期限制、关闭后保留局面，以及三语言设置入口。此诊断不会调用购买或恢复认证。结果记录为 `purchase-smoke-check` / `purchase-smoke-complete`，截图 `iphone-iap-*.png` 写入应用 Documents。完成后不带环境变量重新启动应用即可恢复正常存档。Release 构建会忽略此标记。
