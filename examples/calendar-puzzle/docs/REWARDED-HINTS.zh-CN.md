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

1. AdMob 为 iOS、Android 分别创建应用与奖励广告单元。
2. 替换 `App_Resources/iOS/Info.plist` 的 `GADApplicationIdentifier`、AndroidManifest.xml 的 `com.google.android.gms.ads.APPLICATION_ID`。
3. 替换 `src/rewards-config.ts` 两个平台的广告单元 ID。当前为 Google 官方测试 ID；Release 运行时禁止请求测试广告。
4. 在 AdMob 的“隐私和消息”中配置并发布适用地区的 UMP 消息。设置页在 SDK 要求时显示广告隐私选项。
5. 更新隐私政策、App Store 隐私标签和 Google Play 数据安全表/包含广告声明；按实际 SDK 数据处理填写。`npa=1` 并不免除隐私告知/同意义务。
6. 按 AdMob 控制台提示完成开发者网站和 app-ads.txt、应用审核及付款账户设置。通过正式商店测试渠道验证真实配置，但开发阶段只能使用测试广告或登记过的测试设备。
7. 如面向儿童，需另行完成适龄策略和广告配置；当前接入未将产品声明为儿童应用。

未配置正式广告 ID 前不会产生广告收益。广告库存/网络/同意状态都可能导致暂无广告，游戏会保留拼图且不扣额度。

## 数据与限制

额度使用独立本地存储，不随打乱或关卡存档清除。没有账号跨设备同步；卸载/清数据可能重置免费额度。当前额度是低价值本地权益，若后续接入高价值货币，应增加服务端验证和账本。

## 参考

- https://developers.google.com/admob/ios/rewarded
- https://developers.google.com/admob/android/rewarded
- https://developers.google.com/admob/ios/privacy
- https://developers.google.com/admob/android/privacy
