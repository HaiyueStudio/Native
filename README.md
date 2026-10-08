# HaiYue Native

HaiYue 移动端实现目录，承载原生 App、移动端宿主适配以及构建和真机调试工具。

## 0.1 源码版

当前待发布版本为 **@haiyue/native 0.1.2**，详见 [版本说明](release/NOTES-native-0.1.2.md) 和 [发布流程](release/README.md)。已发布 0.1.0、0.1.1 与历史标签保留；根包为私有源码仓库，npm 适配库从 `npm/` 制包。五款游戏源码、自有图片与音效位于 `games/`，不依赖相邻 Games 目录。运行 `npm run release:verify -- --install` 检查源码及 npm 候选。三个第三方模型不随源码提供，见 [模型使用路径](games/ASSETS.md)。

本仓库采用 [MIT License](LICENSE)，第三方依赖和游戏素材保留各自许可，见 [第三方声明](THIRD_PARTY_NOTICES.md)。

## 目录

| 路径 | 用途 |
| --- | --- |
| [examples/](./examples/README.md) | 原生 App 示例 |
| [examples/neon-circuit/](./examples/neon-circuit/README.md) | 七赛道反重力竞速，陀螺仪 / 虚拟摇杆、独立刹车与油门 |
| [bridge/share/](./bridge/share/README.md) | iOS / Android / Web 系统分享：文字、链接与战绩图片（源码新增，未发布） |
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

## 通用内购与激励广告（开发中）

买断内购、已验证权益、AdMob/UMP、奖励额度与构建接线已提供通用模块，UI 和业务规则由 App 注入。见 [接入说明](bridge/monetization/README.md)。Android 验证服务模板位于 [services/play-entitlements](services/play-entitlements/README.md)，单独部署，不进入移动 npm 包。本次不修改现有应用或已发布的 0.1.0，后续通过新游戏完成真机验收。
