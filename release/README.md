# Native 0.1 发布

当前冻结源码版本：**0.1.1**，应用版本仍为 **0.1.0**，标签 `v0.1.1`。游戏代码与自有素材已纳入 Native，见 [正式版本说明](NOTES-0.1.1.md) 和 [发布页](https://github.com/HaiyueStudio/Native/releases/tag/v0.1.1)。正式版与 rc.4 运行输入相同，沿用其完整的新目录原生构建证据；最终源码检查单独记录。已发布 v0.1.0 的 [真机验收](ACCEPTANCE.md) 保留为历史记录，不冒充本次重新验收。本次不上传商店或发布 npm 包。源码使用 MIT；第三方内容见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。

## 候选范围

| 应用 | iOS | Android |
| --- | --- | --- |
| ios-pbr-orbit | 包含 | — |
| spider-solitaire | 包含 | — |
| sky-strike | 包含 | — |
| rubiks-cube | 包含 | — |
| ak47-range | 包含 | — |
| neon-circuit | 包含 | 包含 |

`config.json` 定义范围和工具版本。`candidate.json` 记录 Native 基线提交、输入 SHA-256、各应用直接及传递 npm 依赖（含 resolved / integrity / license），以及平台矩阵。基线提交仅用于定位；冻结时未提交的修改也按实际内容计算哈希。Engine 使用仓库内 vendor tgz，不从 Engine 工作目录构建，同名同版本包也必须匹配内容哈希。

只需要 Native Git 工作目录，目录名称任意；游戏实现和自有素材在 games/。无需相邻 Games 或 Engine 源码目录。模型需要独立提供，见 [素材准备](../games/ASSETS.md)。输入清单使用 Git tracked + 非 ignored untracked 文件，识别新增、删除与修改；不纳入历史 evidence、私有应用、签名信息、node_modules、platforms、本地模型、生成的运行纹理和构建产物。

## 统一验证入口

在 Native 根目录执行，Node **24.19.0**（`.nvmrc`），npm **11.17.0**。根目录工具没有第三方 npm 依赖。各示例已有 node_modules 时：

```sh
npm run release:verify
```

默认验证全部六个应用：候选输入及依赖完整性、工具版本、发布脚本回归测试、安装依赖版本、npm 依赖图与已安装 vendor 文件内容、TypeScript 检查、应用单元测试，最后再次验证候选没有被检查过程修改。缺失依赖会失败。新环境使用同一入口安装锁定依赖：

```sh
npm run release:verify -- --install
```

`--install` 对所选应用执行 `npm ci --registry=https://registry.npmjs.org`（会替换其 node_modules，运行依赖安装脚本，可能联网）。普通验证不更新锁文件、不重新冻结、不安装手机应用。

按应用运行或增加原生打包/构建：

```sh
npm run release:verify -- --app neon-circuit
PYTHON=/path/to/python npm run release:verify -- --profile bundle --app neon-circuit --platform android
PYTHON=/path/to/python npm run release:verify -- --profile build --app neon-circuit --platform android
IOS_DEVICE_UDID=<udid> IOS_TEAM_ID=<team> PYTHON=/path/to/python npm run release:verify -- --profile build --app neon-circuit --platform ios
```

`source` / `bundle` / `build` 是逐级增加检查；可省略 `--app`，检查该平台全部支持的应用。`bundle` 调用示例 prepare；iOS `build` 调用现有 `build:device`（固定 SwiftPM revision、禁止自动解析），Android `build` 调用 `build:android`。它们生成开发构建，不能冒充商店 Release IPA/AAB。iOS 签名仍由本机环境或 ignored 的 `signing.local.xcconfig` 提供。IOS_DEVICE_UDID 可省略，此时为 generic/platform=iOS 构建。

原生工具固定在 `config.json`：Xcode 26.3 (17C529)、Ruby 4.0.6 / Bundler 4.0.16 / CocoaPods 1.17.0；Android JDK 21.0.12.1、SDK 36 / Build Tools 36.0.0、Gradle 8.14.3；Sky / AK47 / Neon 素材转换 Python 3.12.14 / Pillow 12.3.0。`PYTHON` 应指向相应解释器。Ruby 依赖按各示例 Gemfile.lock 安装，禁止通过 `bundle update` 临时修复候选；Android SDK、Xcode、Ruby、JDK 不随仓库分发。首次安装依赖或原生构建可能访问 npm / Maven / SwiftPM 仓库，后续可复用本机缓存。

每次运行写入 ignored 的 `artifacts/release/<UTC时间>/report.json` 与逐阶段日志，并更新 `artifacts/release/latest.json`。报告包含候选清单哈希、所选范围、工具版本、通过/失败/跳过信息；Android build 还记录产出 Debug APK 的 SHA-256。任何必需阶段失败返回非零并停止后续阶段。`source` 通过只表示源码 gate 通过；报告明确列出未执行的原生构建和真机/商店验收。旧 evidence 不会自动计为本次通过。

## 冻结和后续修订

首次冻结执行 `npm run release:freeze`。已有同名版本时命令拒绝覆盖。需要改动时，将根 package.json / package-lock.json 和 release/config.json 的版本一起递增，例如 0.1.1-rc.4；更新必要的 npm、Ruby、SPM、Maven 锁文件，审查差异后重新冻结和验证。不要手工修改 candidate.json 来消除校验失败。下一应用版本发布时同步更新 config.appVersion 和各示例 package 元数据。

Android Maven 锁由 Gradle `:app:verifyReleaseDependencies --write-locks` 生成，普通构建启用严格锁模式。依赖更新时同时解析 Debug / Release 的编译及运行配置，解析失败会返回非零；发布 gate 不自动执行 `--write-locks`。iOS Podfile.lock 快照在本候选中没有外部 pod，仅含 Podfile checksum 和 CocoaPods 版本。locks/Podfile 保留规范化的完整正文：仅去除 NativeScript 两类生成注释中的检出路径；验证先检查实际 Podfile 的原始 SHA-1，再逐字比较规范化正文、依赖锁和 CocoaPods 版本，不能忽略真实依赖变更；SwiftPM 另行固定 font-manager revision。

验证通过后一起提交候选清单、配置、源码、依赖锁与验收记录，并保存实际二进制的哈希。正式源码 tag 指向该提交，应用商店发布另行进行。

## 0.1 源码正式发布条件

2026-09-24 确认发布范围：六个公开示例逐个完成候选真机验收后，发布 Native 源码版。此次不发布 npm 包、游戏模型、APK / IPA / AAB，也不上传应用商店。六个示例均验收 iOS；Neon Circuit 另外验收 Android。

- 对应候选的源码、依赖、原生构建与逐应用真机验收通过，保留二进制哈希、设备系统版本、测试结果和日志。历史 evidence 不能直接代替本候选验收；prepare 成功不代表原生编译或真机通过。
- 逐项功能与当前状态见 [真机验收清单](ACCEPTANCE.md)。未执行、阻塞、失败均不能记为通过，也不能据此创建正式 0.1.0 tag。
- 公开内容包含 Native 源码、games/ 的自有素材及现有 vendor 依赖；检查不含签名凭据、第三方模型及其转换产物或游戏应用二进制。源码 MIT 和未知原始许可的模型分开说明，见 [第三方声明](../THIRD_PARTY_NOTICES.md)。
- 游戏代码全部冻结在本仓库。全新目录构建需排除旧依赖和构建产物；无法再分发的模型由接收者自行准备，验证报告必须说明模型输入。

签名由各开发者或团队配置，见 [签名指南](SIGNING.md)。正式商店签名、商店资料及含模型二进制的再分发许可属于后续应用发布，不作为本次 Native 源码发布的承诺。

## 全新目录验证

在修改完成且已冻结候选的工作目录中导出：

```sh
npm run release:export -- --output /tmp/native-clean/checkout
cd /tmp/native-clean/checkout
npm run release:verify -- --install
# 为每个 iOS 示例按 Gemfile.lock 安装 Ruby 工具（BUNDLE_FROZEN=true bundle install）。
# 设置 PYTHON、IOS_TEAM_ID，并提供 local-assets/ 原始模型后：
npm run release:verify -- --profile build --platform ios
# 按固定版本安装 Android SDK/JDK，设置 JAVA_HOME、ANDROID_HOME 后：
npm run release:verify -- --profile build --platform android --app neon-circuit
```

导出程序只复制通过校验的冻结输入及 candidate.json，初始化独立 Git 工作目录，不复制历史截图、原目录 .git、node_modules、platforms、生成素材、模型或签名。输出目录必须不存在。可选的 HAIYUE_MODEL_ASSETS 指向独立模型目录；模型哈希记录在原生构建报告内。Android 可用 GRADLE_USER_HOME 指定全新下载缓存。

这是当前工作树的冻结源码快照验证，不等同于已推送远端的干净克隆，也不是全新操作系统验证。构建可以使用本机已安装的固定工具链和平台依赖下载缓存；应在证据中准确记录缓存使用情况。候选发布后还可按 tag 克隆复验。
