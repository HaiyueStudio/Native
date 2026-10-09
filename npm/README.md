# @haiyue/native

Haiyue 的 NativeScript 原生适配层，支持 iOS / Android：WebGPU 宿主与帧调度、触摸输入、陀螺仪、震动、音频、屏幕方向、存储、图片保存和通用开屏组件。

**npm 只包含可复用的原生代码与小尺寸通用标志。游戏、示例、美术、模型、引擎 vendor 包、构建产物和验收资料均不包含。** 完整游戏示例从 [GitHub](https://github.com/HaiyueStudio/Native) 下载。

## 安装

本说明包含尚未发布的 Engine 可选依赖、`/engine` 和系统分享入口；请使用本地候选 tarball 验证。

在 NativeScript 应用项目中执行：

```sh
npm install ./haiyue-native-<candidate>.tgz
```

系统能力使用 `@nativescript/core@9.1.1` 和 `@nativescript/canvas@2.1.18` 作为宿主 peer dependencies。
`@haiyue/engine@^0.2.0` 是 **可选 peer dependency**：只使用分享、震动、陀螺仪、扫码等独立入口时，无需安装 Engine。

渲染宿主使用 `@haiyue/native/engine`，应用须额外提供 `@haiyue/engine@^0.2.0`（`>=0.2.0 <0.3.0`，不包含预发布版本）。
旧根入口 `@haiyue/native` 保留原有导出，仍会引用 Engine 适配层；无 Engine 的应用应使用能力子入口。
本次未改变 NativeScript Core / Canvas 的必需 peer 声明。

兼容范围的最低版本 `0.2.0` 已在 npm 发布，仓库开发依赖精确锁定到该注册表版本，
并通过 lockfile 校验完整性。渲染适配不再要求未发布的 Engine 候选包；后续兼容补丁版本属于同一范围，
`0.3.x` 需要单独验证后再扩展。纯系统能力的消费者不会安装此开发依赖。

需要渲染时额外安装：

```sh
npm install @haiyue/engine@^0.2.0
```

这是 NativeScript 专用 TypeScript 包，交给 NativeScript Webpack 编译；保留 `.ios.ts` / `.android.ts`，由平台解析器选择实现，并处理 `@NativeClass`。已验证 `@nativescript/webpack@5.0.38` / TypeScript 5.7.3。宿主 tsconfig 使用 `experimentalDecorators: true`、`emitDecoratorMetadata: true`，并包含 `@nativescript/types` 和 `@webgpu/types`；这些类型工具由宿主开发依赖提供。根入口不能直接在浏览器或普通 Node.js 中执行。系统分享的独立 `@haiyue/native/share`（Web 默认）和 `@haiyue/native/share/web` 入口可经 Web 构建器编译使用，不加载原生依赖。

```ts
import { NativeDeviceMotion } from '@haiyue/native/motion';
import { NativeHaptics } from '@haiyue/native/feedback';

const motion = new NativeDeviceMotion({ updateIntervalMs: 1000 / 60 });
motion.onUpdate(sample => console.log(sample.angles.pitch, sample.angles.roll));
motion.start();
// 在应用已有的逐帧回调内调用 motion.update(deltaMs)。

const haptics = new NativeHaptics();
haptics.resume();
haptics.impact('light');
// 页面真正销毁时调用 motion.dispose()、haptics.dispose()。
```

iOS 使用陀螺仪时配置 `NSMotionUsageDescription`；Android 震动声明 `android.permission.VIBRATE`。其他权限和生命周期要求见 [原生能力说明](https://github.com/HaiyueStudio/Native/tree/main/bridge)。

渲染应用按需导入：

```ts
import { NativeRenderHost, NativeSurface, NativeTouchInput } from '@haiyue/native/engine';
import { shareContent } from '@haiyue/native/share';
```

## 能力入口

| 入口 | 内容 |
| --- | --- |
| `@haiyue/native` | 兼容聚合入口，保留既有 API；需要 Engine |
| `@haiyue/native/engine` | 可选渲染适配层：NativeRenderHost、NativeSurface、NativeCanvasTextures、NativeTouchInput 与帧控制；需要 Engine ^0.2.0 |
| `@haiyue/native/motion` | NativeDeviceMotion |
| `@haiyue/native/feedback` | NativeHaptics |
| `@haiyue/native/audio` | NativePcmAudioBank |
| `@haiyue/native/orientation` | NativeOrientationController |
| `@haiyue/native/media` | savePhoto |
| `@haiyue/native/share` | shareContent、canShareContent（iOS / Android / Web 系统分享，源码新增未发布） |
| `@haiyue/native/share/web` | 显式浏览器分享入口，无 NativeScript 依赖 |
| `@haiyue/native/branding` | NativeEngineLaunchPage |
| `@haiyue/native/scanner` | 可取消的离线 QR 扫描（相机权限按需申请） |
| `@haiyue/native/rewards` | 可选的 RewardController |
| `@haiyue/native/rewards/admob` | 可选的 AdMobRewardGateway |

使用开屏组件时，在应用 webpack 配置的 `webpack.init(env)` 之后添加：

```js
const { addEngineBrandingCopyRule } = require('@haiyue/native/branding/webpack');
addEngineBrandingCopyRule(webpack);
```

只有小尺寸通用月牙图会复制到应用资源。广告接口需要应用单独集成 Google SDK、Swift/Java 桥接源文件、广告配置与许可流程；本包不会自动接入广告服务。参考 [奖励接口说明](https://github.com/HaiyueStudio/Native/tree/main/bridge/rewards)。

## 许可与验证

MIT。原生实现来自对应版本的冻结源码，文件哈希保存在包内 `provenance.json`。npm 包验证独立类型检查、平台模块解析、安装和包内文件范围；已有原生构建与真机验证的范围见 [GitHub 发布说明](https://github.com/HaiyueStudio/Native/releases/tag/native-v0.1.1)。游戏模型不随 npm 分发。

## Experimental: reusable monetization

Version 0.1.1 adds `@haiyue/native/purchases`, `@haiyue/native/purchases/native`, `@haiyue/native/rewards/native`, `@haiyue/native/rewards/policy` and `@haiyue/native/monetization/build`. These entries are not available in the published 0.1.0 package. These new monetization APIs are experimental until the next consuming game completes native store/ad acceptance. See [the integration guide](bridge/monetization/README.md) (included as `bridge/monetization/README.md` in the staged package). Use `npm run stage:development` to test source without altering the frozen release. No existing game is migrated automatically.

Version 0.1.2 adds `rewardAmount` (default 1) to rewarded allowances and `PurchaseCatalog` to `@haiyue/native/purchases`. The catalog combines verified base, advanced, full and prerequisite-gated upgrade products. Prices remain separate store-configured products; there is no automatic store discount or cross-platform purchase sharing. Existing wallet balances are unchanged. See the integration guide for examples and restore/refund semantics.

Version 0.1.3 adds `@haiyue/native/scanner` (iOS AVFoundation / Android ZXing Embedded) and sanitized structured rewarded-ad failure diagnostics. Hosts must configure camera permissions and the Android scanner dependency; see [QR scanning](bridge/scanner/README.md). See [reward diagnostics](bridge/rewards/README.md) for `onFailure` and `snapshot().lastFailure`. Existing error messages and wallet formats remain compatible. Release readiness and device coverage are recorded in the repository release evidence.

系统分享接入与 Android provider 配置见 [系统分享](bridge/share/README.md)。当前源码新增，使用私有开发包验证；不表示已包含在此前发布版本中。

Version 0.1.4 adds Native/Web system sharing and the explicit `/engine` adapter entry. Engine is an optional peer (`^0.2.0`); system-only imports do not load it. Rendering consumers must install Engine, with compatibility checks pinned to the published 0.2.0 minimum. iOS system ATT is opt-in and respects age policy and regional refusal. `restricted` has automated coverage; physical-device acceptance remains pending. See the repository 0.1.4 release notes for device evidence and limitations.
