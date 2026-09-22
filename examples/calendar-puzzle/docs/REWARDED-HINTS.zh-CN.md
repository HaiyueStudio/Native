# 每日免费提示与奖励广告

## 产品规则

- 免费用户：仅玩当天日期，每天 1 次免费提示。
- 自愿看完奖励广告：获得 1 次提示；每天最多获得 2 次广告奖励，可通过 `src/rewards-config.ts` 修改。
- 已获提示不会因重启或跨日丢失；每日免费次数不累积。
- 完整版：无限提示、任意日期、无广告。价格仍使用商店返回的本地化价格。
- 提示求解成功且有可展示结果后才扣次数；重复展示同一结果不扣，失败/超时/取消不扣。
- 任何来源的提示都会使本局成为“使用过提示”；自行完成才获得星星。
- 没有强制广告、插屏广告或自动播放。额度面板可以返回游戏，也可以选择完整版。

## 通用层与接入

底层在 `Native/bridge/rewards`，只注入存储、广告适配器、购买状态和暂停接口。
`Native/bridge/lifecycle/presentation-pause.ts` 提供可嵌套的原生全屏界面暂停锁。
游戏只依赖 `Games/games/calendar-puzzle/rewards.ts` 的接口，浏览器版本不会引入移动广告 SDK。
详细接入方法见 `Native/bridge/rewards/README.md`。

## 正式发布前配置

1. 当前先发布 Apple App Store：只创建 iOS 应用与奖励广告单元，Android 留待后续。
2. 替换 `App_Resources/iOS/Info.plist` 的 `GADApplicationIdentifier`。
3. 替换 `src/rewards-config.ts` 的 `iosUnit`。当前为 Google 官方测试 ID；Release 构建只校验目标平台的正式 App ID、广告单元 ID 及发布商一致性，运行时也禁止请求测试广告。开发版仍强制使用 Google 测试广告位。
4. 在 AdMob 的“隐私和消息”中配置并发布适用地区的 UMP 消息。设置页在 SDK 要求时显示广告隐私选项。
5. 更新隐私政策、App Store 隐私标签和 Google Play 数据安全表/包含广告声明；按实际 SDK 数据处理填写。`npa=1` 并不免除隐私告知/同意义务。
6. 按 AdMob 控制台提示完成开发者网站和 app-ads.txt、应用审核及付款账户设置。通过正式商店测试渠道验证真实配置，但开发阶段只能使用测试广告或登记过的测试设备。
7. 如面向儿童，需另行完成适龄策略和广告配置；当前接入未将产品声明为儿童应用。

未配置正式广告 ID 前不会产生广告收益。广告库存/网络/同意状态都可能导致暂无广告，游戏会保留拼图且不扣额度。

### iOS 后台填写内容（2026-09-22，待账号创建）

目前尚未创建 AdMob 账号、正式应用或广告位，也没有发布隐私消息；以下是待配置内容，并非已完成状态。

| 项目 | 内容 |
| --- | --- |
| 应用名称 | Haiyue Calendar Puzzle（与商店名称保持一致） |
| 平台 | iOS |
| 是否已在支持的商店上架 | 否；App Store Connect 创建记录不等于公开上架 |
| Bundle ID（如要求） | org.haiyue.games.calendarpuzzle |
| 广告格式 | 激励广告 / Rewarded，不选激励插屏 |
| 广告位名称 | calendar_puzzle_ios_rewarded_hint |
| 奖励数量 / 名称 | 1 / Hint |

注册国家/地区按实际居住地填写，不按投放市场填写；Google 说明该项创建后不能修改。
账号注册、付款资料、身份核验和条款由账户所有者完成。此流程不要求先发布 Google Play。

“隐私和消息”中为此 iOS 应用创建并发布欧洲法规消息，覆盖 EEA、英国、瑞士，提供同意、不同意及管理选项。
默认英语，添加游戏支持的中文、日语、法语、德语、西班牙语中后台可选的语言；必须使用真实公开的隐私政策网址。
若投放美国适用州，同时配置美国州法规消息及隐私选项。消息需明确选中本 iOS 应用，保存草稿不等于发布。
当前原生请求指定 `npa=1`，不主动申请 ATT；这不能代替 UMP 同意流程或正式数据披露。

取得正式 App ID（含 `~`）与广告位 ID（含 `/`）后再接入；不要用示例 ID 冒充正式配置。
随后用测试设备验证同意、拒绝、重新管理选项、取消广告、奖励一次性发放、无填充和断网。
应用上线后关联真实 App Store 页面，完成 app-ads.txt 验证及 AdMob 应用审核；未发布应用可以先集成测试。

参考：
- https://support.google.com/admob/answer/7356219?hl=en
- https://support.google.com/admob/answer/9989980?hl=en
- https://support.google.com/admob/answer/7311747?hl=en
- https://support.google.com/admob/answer/10113207?hl=en

## 数据与限制

额度使用独立本地存储，不随打乱或关卡存档清除。没有账号跨设备同步；卸载/清数据可能重置免费额度。当前额度是低价值本地权益，若后续接入高价值货币，应增加服务端验证和账本。

## 参考

- https://developers.google.com/admob/ios/rewarded
- https://developers.google.com/admob/android/rewarded
- https://developers.google.com/admob/ios/privacy
- https://developers.google.com/admob/android/privacy
