# 正式开发者会员与沙盒内购测试

核对日期：2026-09-20。账号注册、身份认证和会员付款需要账户持有人本人完成；不要把密码、验证码、证件或银行资料发到聊天中。

## 注册 Apple Developer Program

1. 准备启用双重认证的 Apple 账户，使用法定姓名和真实联系方式。进入 [苹果官方注册入口](https://developer.apple.com/cn/programs/enroll/)，或在 Apple Developer App 的账户页面开始注册。
2. 选择注册主体。个人/独资经营者使用 Individual，App Store 显示个人法定姓名。希望以公司名显示开发者，应选择 Organization，需符合资格的法人实体、D‑U‑N‑S 编号、组织域名邮箱、有效网站，以及代表公司签约的授权。工作室名称本身不等于法人实体。
3. 按页面要求完成身份或组织核验，同意许可协议，支付会员费。目前为每年 99 美元；具体以注册地区显示的当地货币价格为准。正式会员可用于 App Store 上架和 TestFlight 分发。当前项目的免费开发签名不等同于正式会员。
4. 开通后登录 [App Store Connect](https://appstoreconnect.apple.com/)，创建日历拼图应用记录，配置签名与 Bundle ID。当前 iOS Bundle ID 为 `org.haiyue.native.calendarpuzzle`。
5. 为内购签署 Paid Apps Agreement，按后台要求填写税务和收款银行资料，再创建非消耗型商品 `calendar_puzzle_full_unlock`，配置价格、本地化说明和审核资料。会员缴费不会自动创建商品或开通收款资料。

官方依据：[注册要求与费用](https://developer.apple.com/cn/programs/enroll/)、[协议管理](https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/)。

## 沙盒账号是什么

Sandbox Apple Account 是内购专用测试买家。它使用苹果的测试支付环境，能够验证购买、取消、恢复和失败等流程，不产生真实扣款。它不是开发者会员，也不是正式付费用户，不能用来正常购买 App Store 商品。测试买家免费创建，不需要再付一份开发者年费。

创建路径：App Store Connect → 用户和访问（Users and Access）→ Sandbox → 添加。填写测试姓名、未注册为 Apple 账户的专用邮箱、密码和测试地区。可以为不同地区创建测试账号，以核对商店返回的货币与本地化价格。

在 iPhone 上启用开发者模式，安装正式开发者团队签名的测试版本，通过系统设置中的 Sandbox 登录入口使用该测试账号。测试内购无需退出设备的 iCloud 主账号；不要把沙盒账号当作设备主 Apple 账户登录。商品需先在 App Store Connect 中配置，单独创建沙盒账号不能解决“商品不可用”。

本游戏建议先验证：首次解锁 → 取消购买 → 重启后已购权益 → 重装恢复 → 断网与重新联网 → 退款撤销 → 不同地区价格。测试前确认结算属于 Sandbox/TestFlight 测试环境。已完成的本地状态机和界面测试不能代替真实 StoreKit 沙盒交易测试。

官方说明：[沙盒概览](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/overview-of-testing-in-sandbox)、[创建沙盒账号](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/create-a-sandbox-apple-account)。
