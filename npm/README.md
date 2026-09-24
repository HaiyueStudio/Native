# @haiyue/native

Haiyue 的 NativeScript 原生适配层，支持 iOS / Android：WebGPU 宿主与帧调度、触摸输入、陀螺仪、震动、音频、屏幕方向、存储、图片保存和通用开屏组件。

**npm 只包含可复用的原生代码与小尺寸通用标志。游戏、示例、美术、模型、引擎 vendor 包、构建产物和验收资料均不包含。** 完整游戏示例从 [GitHub](https://github.com/HaiyueStudio/Native) 下载。

## 安装

在 NativeScript 应用项目中执行：

```sh
npm install @haiyue/native@0.1.0
```

配套版本：`@haiyue/engine@0.1.0`、`@nativescript/core@9.1.1`、`@nativescript/canvas@2.1.18`，通过 peer dependencies 使用应用自己的依赖，不复制引擎或平台二进制到本包。

这是 NativeScript 专用 TypeScript 包，交给 NativeScript Webpack 编译；保留 `.ios.ts` / `.android.ts`，由平台解析器选择实现，并处理 `@NativeClass`。已验证 `@nativescript/webpack@5.0.38` / TypeScript 5.7.3。宿主 tsconfig 使用 `experimentalDecorators: true`、`emitDecoratorMetadata: true`，并包含 `@nativescript/types` 和 `@webgpu/types`；这些类型工具由宿主开发依赖提供。本包不能直接在浏览器或普通 Node.js 中执行。

```ts
import { NativeDeviceMotion, NativeHaptics } from '@haiyue/native';
// 也可按能力导入：import { NativeDeviceMotion } from '@haiyue/native/motion';

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

## 能力入口

| 入口 | 内容 |
| --- | --- |
| `@haiyue/native` | 常用宿主、渲染、输入、运动、反馈、音频、存储与开屏 API |
| `@haiyue/native/motion` | NativeDeviceMotion |
| `@haiyue/native/feedback` | NativeHaptics |
| `@haiyue/native/audio` | NativePcmAudioBank |
| `@haiyue/native/orientation` | NativeOrientationController |
| `@haiyue/native/media` | savePhoto |
| `@haiyue/native/branding` | NativeEngineLaunchPage |
| `@haiyue/native/rewards` | 可选的 RewardController |
| `@haiyue/native/rewards/admob` | 可选的 AdMobRewardGateway |

使用开屏组件时，在应用 webpack 配置的 `webpack.init(env)` 之后添加：

```js
const { addEngineBrandingCopyRule } = require('@haiyue/native/branding/webpack');
addEngineBrandingCopyRule(webpack);
```

只有小尺寸通用月牙图会复制到应用资源。广告接口需要应用单独集成 Google SDK、Swift/Java 桥接源文件、广告配置与许可流程；本包不会自动接入广告服务。参考 [奖励接口说明](https://github.com/HaiyueStudio/Native/tree/main/bridge/rewards)。

## 许可与验证

MIT。原生实现取自 `native-v0.1.0` 的冻结源码，文件哈希保存在包内 `provenance.json`。npm 包验证独立类型检查、平台模块解析、安装和包内文件范围；已有原生构建与真机验证的范围见 [GitHub 发布说明](https://github.com/HaiyueStudio/Native/releases/tag/native-v0.1.0)。游戏模型不随 npm 分发。
