# HaiYue Native

HaiYue 移动端实现目录，承载原生 App、移动端宿主适配以及构建和真机调试工具。

## 0.1 源码版

当前源码名称为 **@haiyue/native**，版本为 **0.1.0**，发布标签为 `native-v0.1.0`。这是原 `@haiyue/native-repository` 的更名源码版，历史 `v0.1.0` / `v0.1.1` 保留。五款游戏源码、自有图片与音效位于本仓库 `games/`，无需相邻 Games 目录。[版本说明](release/NOTES-native-0.1.0.md) 提供下载、构建与验证范围；[正式发布页](https://github.com/HaiyueStudio/Native/releases/tag/native-v0.1.0) 公开可访问。本次通过 GitHub 分发源码，根包保留 `private: true`，不作为可直接 import 的 npm 库发布。运行 `npm run release:verify -- --install` 验证全部源码。三个第三方模型不随源码提供，运行 `npm run models:check` 检查放置路径与哈希，详见 [模型使用路径](games/ASSETS.md)。没有模型时仍可构建 PBR、蜘蛛纸牌、Sky Strike 和魔方。

本仓库采用 [MIT License](LICENSE)，第三方依赖和游戏素材保留各自许可，见 [第三方声明](THIRD_PARTY_NOTICES.md)。

## 目录

| 路径 | 用途 |
| --- | --- |
| [examples/](./examples/README.md) | 原生 App 示例 |
| [examples/neon-circuit/](./examples/neon-circuit/README.md) | 七赛道反重力竞速，陀螺仪 / 虚拟摇杆、独立刹车与油门 |
| [bridge/motion/](./bridge/motion/README.md) | iOS / Android 陀螺仪、设备姿态和屏幕方向倾斜角 |
| [examples/ak47-range/](./examples/ak47-range/README.md) | 横屏第三人称 AK47 生存射击、掩体寻路、视野迷雾和震动 |
| [examples/rubiks-cube/](./examples/rubiks-cube/README.md) | 仓库内游戏源码的二阶/三阶/四阶/镜面魔方，横竖屏与历史还原 |
| [examples/sky-strike/](./examples/sky-strike/README.md) | 仓库内 Sky Strike 源码的竖屏 iPhone 游戏 |
| [examples/spider-solitaire/](./examples/spider-solitaire/README.md) | 仓库内蜘蛛纸牌源码的横屏 iPhone 游戏 |
| [examples/ios-pbr-orbit/](./examples/ios-pbr-orbit/README.md) | 首个 iPhone PBR 立方体与 Orbit 交互 Demo |

移动端专用运行时和平台接线在本仓实现；Engine 保留可复用的渲染器、材质、控制器及通用接口。示例通过 Engine 公共包导出接入，具体依赖和构建配置在 M16 G01/G02 中建立。

方案与执行计划见 [Native 文档入口](../milestones/native/README.md)；跨仓依赖规则见 [repository-version-policy.json](../milestones/milestones/repository-version-policy.json)。

G02 已完成 [原生宿主](./bridge/README.md) 与 private App，真机清屏、暂停恢复、独立冷启动和逐像素校验通过。G03 已完成真机静态 PBR 立方体和粗糙度对照，Orbit 由 G04 接续。

Moonlight Sudoku (LED Sudoku) is maintained in the private [MoonlightSudoku repository](https://github.com/HaiyueStudio/MoonlightSudoku).
