# 日历拼图上架清单

核对日期：2026-09-22。依据当前源码、本机验证记录与官方资料；没有登录商店后台核实的项目均列为待确认，不能视为未办理。此清单取代早期发行方案中的“尚未接入内购/不接广告”等旧状态。

## 已完成

- [x] Apple 正式团队 `22T5YFVY2B` 设备开发签名、真机安装和启动；旧 App 已按用户要求卸载，存档迁移验证通过，电脑备份保留。
- [x] 正式候选包名统一为 `org.haiyue.games.calendarpuzzle`。
- [x] 每日免费玩法、每日一次免费提示、可选奖励广告、非消耗型完整版的客户端与通用基础层已实现。
- [x] 完整版无限提示、任意日期、无广告；未用提示通关显示星星。
- [x] 六语言、按需渲染、求解缓存/剪枝等已实现；Android target/compile API 36 已构建和部分实测。

以上不代表真实商店付款、广告收入或正式发布已验收。

## 1. 账号与发行地区（需要账户持有人参与）

- [ ] 确定首发地区、发行主体、商店显示名称和支持邮箱。
- [ ] Apple Business 中确认 Paid Apps Agreement、生效的税务与银行资料；Google Play 完成账户身份核验、付款与税务资料。
- [ ] Apple 在新团队创建/核对显式 App ID `org.haiyue.games.calendarpuzzle`，配置 In-App Purchase，创建对应 App Store Connect 应用记录；当前设备签名描述文件是通配符，不能把它当成商店配置完成。
- [ ] Google Play 创建同包名应用记录。妥善保存上传密钥，启用 Play App Signing。
- [ ] 若包含中国大陆发行，先核实游戏审批号及支持文件、适用备案要求；不默认普通个人海外上架资料足够。[Apple 地区资料](https://developer.apple.com/cn/help/app-store-connect/reference/app-information/app-information)

## 2. 内购（目前主要阻塞）

- [ ] 两平台创建 `calendar_puzzle_full_unlock`：Apple Non-Consumable、Google 永久一次性商品。美国基础价拟为 USD 1.99，其他地区确认商店价格；App 持续使用商店返回的本地化金额。
- [ ] 填商品名称、说明、可售地区、审核截图；iOS 当前查询仍是 unavailable。
- [ ] 部署 `Native/services/calendar-entitlements`，配置 HTTPS、服务账号权限、限流和密钥保护；填写 `src/purchases/config.ts` 的验证 URL 与公钥（当前两项为空，Android 购买受阻）。
- [ ] Sandbox/TestFlight 与 Play 许可测试验收：成功、取消、pending、断网、重复回调、付款后杀进程、重装恢复、账号切换、退款撤销、不同货币。不要用真实付款替代测试。
- [ ] 第一笔该类型 Apple 内购与新 App 版本同批送审。[Apple 内购提交](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase)

## 3. 奖励广告

- [ ] AdMob 分别创建 iOS/Android 应用与奖励广告单元，替换原生资源的 App ID 和 `src/rewards-config.ts` 的单元 ID；目前都是官方测试 ID，Release 构建会主动拦截。
- [ ] 配置适用地区的 UMP 隐私消息、隐私选项入口；如实际进行跨 App/网站追踪，按 Apple 要求处理 ATT。
- [ ] 建立开发者网站与 app-ads.txt，完成 AdMob 应用验证、审核和收款资料。[AdMob 验证](https://support.google.com/admob/answer/14538460?hl=en)
- [ ] 用测试广告/登记测试设备验收：完整观看只奖励一次、提前关闭/加载失败不扣次数、无库存可返回游戏、完整版不显示广告。开发阶段不点击自己的正式广告。

## 4. 正式构建与设备验证

- [ ] iOS Release Archive、分发签名、上传校验；核对当前 SDK 要求、版本号/build number、图标与隐私清单。
- [ ] Android 签名 Release AAB，验证最终拆分包体、原生库/ZIP 对齐，保管上传密钥。
- [ ] Android 16 KB 环境实测：现有静态检查未证明兼容，NativeScript/Canvas 部分 RELRO 对齐仍需排查；API 36 不等于 16 KB 通过。[Android 16 KB 指南](https://developer.android.com/guide/practices/page-sizes)
- [ ] 发布包回归：冷启动、离线、低内存、跨午夜/闰年、恢复前台、音频中断、存档升级、提示压力、连续游玩能耗、不同屏幕和 GPU。确认 Release 禁用测试入口与诊断数据。
- [ ] TestFlight 测试；Play 内测/封测。若是 2023-11-13 后创建的个人 Play 账号，至少 12 人连续加入封测 14 天，再申请生产权限，非自动获批。[Google 测试要求](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB)

## 5. 商店素材与隐私

- [ ] 游戏图标、真实截图、Google 宣传图、名称/简介/描述；按计划准备六种语言文案。明确免费每日题、每天一次提示、可选奖励广告、一次性完整版，不暗示全部免费。
- [ ] 公开可访问的支持页和隐私政策 URL，游戏内可访问；核对字体、音乐、图片和第三方库的商用许可/开源声明。
- [ ] App Store App Privacy、Google Data safety/含广告声明、年龄分级、目标受众、出口合规、销售地区；按实际广告/支付 SDK 数据行为填写，不能因单机就勾选完全不收集。[Apple 隐私](https://developer.apple.com/app-store/user-privacy-and-data-use/)
- [ ] 审核备注说明每日免费、如何购买/恢复、如何看广告换提示、提示与星星规则；如审核需特殊环境，提供可复现说明。

## 6. 提交与运营

- [ ] 确认所有必测项通过后提交；首版建议手动控制发布时间，处理审核反馈。
- [ ] 发布后检查崩溃/ANR、购买恢复、退款、广告填充、支持反馈和收入；确保 Android 验证服务持续可用。

优先顺序：账户收款/应用商品记录 → 正式广告配置及网站 → Android 验证服务 → 发布包与沙盒验收 → 素材/隐私表 → 测试轨道 → 审核发布。账号和素材准备可以并行；若 Play 账号受 14 天门槛约束，尽早组织真实测试。
