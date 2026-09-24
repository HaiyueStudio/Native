# 开发者签名

Native 0.1 发布源码。下载、修改或发布本仓库源码不需要 App Store / Google Play 签名；将示例构建成手机应用时，由构建者配置自己的签名身份。本仓库不提供签名私钥、开发者账号或商店凭据。

## iOS

独立开发者使用自己的 Apple 开发者账号与 Team，并在 `examples/<app>/nativescript.config.ts` 中将应用 ID 改为自己控制的唯一标识。同一团队维护同一应用时，沿用团队的应用身份；开发证书属于个人，分发证书属于团队，不要求每个成员另建一套应用分发身份。参见 [Apple 证书说明](https://developer.apple.com/help/account/certificates/certificates-overview)。

在 Xcode → Settings → Accounts 登录账号，确认团队可用、测试设备已配对且启用开发者模式。当前构建脚本通过 `IOS_TEAM_ID` 或应用内 ignored 的 `App_Resources/iOS/signing.local.xcconfig` 读取 `DEVELOPMENT_TEAM`：

```sh
IOS_DEVICE_UDID=<设备UDID> IOS_TEAM_ID=<自己的TeamID> PYTHON=/path/to/python \
  npm run release:verify -- --profile build --app neon-circuit --platform ios
```

示例构建为 Debug 真机开发包。App Store 分发需另行配置分发证书、描述文件及商店记录，不属于本次源码发布范围。私钥和描述文件不应提交仓库。修改应用 ID 等冻结输入后，按照发布说明创建自己的新候选再验证。

遇到 `No Account for Team`，应先恢复 Xcode 中该团队的账号登录与访问权限，或明确切换为自己的 Team；`No profiles` 还需要对应应用 ID、设备及证书的开发描述文件。不能通过关闭代码签名来完成 iPhone 真机验收。

## Android

本仓库的 Android 验证入口生成 Debug APK，开发调试签名不作为正式发布密钥。独立发布者使用自己的应用 ID 和正式签名配置，或使用 Google Play App Signing。

同一应用的更新需要保持兼容的应用签名身份，不能因为换了开发人员就随意换签名。Play App Signing 区分应用签名密钥和上传密钥：上传密钥可以按官方流程重置，应用签名密钥升级也有专门流程及兼容限制。参见 [Android 应用签名](https://developer.android.com/studio/publish/app-signing)。

keystore、私钥及密码保存在发布者本地或 CI 的凭据存储中，不放进源码、候选清单或验收日志。
