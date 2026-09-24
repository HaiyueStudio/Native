# @haiyue/native 0.1.0 源码版

根项目由 `@haiyue/native-repository` 更名为 `@haiyue/native`，按新的名称发布 0.1.0。根 package.json、package-lock.json、候选配置和冻结清单统一。使用新标签 `native-v0.1.0` 区分新旧名称，原 `v0.1.0` / `v0.1.1` 标签与发布记录保留。

这是 GitHub 源码发布，根包保持 `private: true`，没有发布 npm 安装包，也不新增可直接 import 的库入口。

## 使用

```sh
git clone --branch native-v0.1.0 --depth 1 https://github.com/HaiyueStudio/Native.git
cd Native
npm run release:verify -- --install
npm run models:check
```

需要 Node 24.19.0 / npm 11.17.0，其他固定工具链见 [构建指南](README.md)。ZIP/TAR 用户在解压根目录先运行 `git init`，再执行同样的检查。

六个示例的源码、自有美术、音效和固定 vendor 依赖均在本仓库内，不依赖相邻 Games / Engine 目录。PBR Orbit、蜘蛛纸牌、Sky Strike、魔方无需外部模型；AK47 Range 与 Neon Circuit 需要自行提供有权使用、结构兼容的模型。模型路径和替代步骤见 [模型指南](../games/ASSETS.md)，签名见 [签名指南](SIGNING.md)。

## 本次包含的改动

- 新名称、版本元数据及使用说明统一，重新冻结候选输入。
- 包含最近提交的 Sky Strike iPad 支持与共享开屏页：游戏首帧实际呈现后淡出，初始化失败时保留提示。
- 保留 0.1.1 中的独立游戏源码、模型检查入口、原生桥接与构建工具。

## 验证范围

本次重新运行六个示例的源码检查、依赖检查和单元测试，结果见 [本次验证](evidence/native-0.1.0/README.md)。

Sky Strike 的最近改动已有 [iPad 支持记录](../examples/sky-strike/evidence/ipad-air4-20260924/README.md) 和 [共享开屏页构建、签名及真机记录](../examples/sky-strike/evidence/shared-launch-ipad-20260924/README.md)。这些记录来自本次更名前的同一实现，不冒充此次重新进行的真机操作。

先前六个 iOS App 与 Neon Android 的 [全新目录构建](evidence/0.1.1-rc.4/README.md) 保留为历史证据。此次包含 Sky Strike 实现变化，不能据此声称所有原生 App 均对新标签重新构建或重新真机验收。

仅分发源码及可分发素材，不包含第三方 GLB、模型转换产物、APK / IPA / AAB 或签名凭据。MIT 不会重新授权来源、许可未核实的模型；本次不上传应用商店。
