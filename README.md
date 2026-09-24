# HaiYue Native

HaiYue 移动端实现目录，承载原生 App、移动端宿主适配以及构建和真机调试工具。

## 0.1 源码版

当前源码版本为 **0.1.0**，发布 tag 为 `v0.1.0`。六个公开示例已完成 [真机验收](release/ACCEPTANCE.md)。在仓库根目录运行 `npm run release:verify` 验证冻结输入、依赖、类型和测试；原生 bundle/build 使用同一入口的 profile 参数。范围、工具链和重建命令见 [发布说明](release/README.md)，变更与素材限制见 [0.1.0 版本说明](release/NOTES-0.1.0.md)。

本仓库采用 [MIT License](LICENSE)，第三方依赖和游戏素材保留各自许可，见 [第三方声明](THIRD_PARTY_NOTICES.md)。

## 目录

| 路径 | 用途 |
| --- | --- |
| [examples/](./examples/README.md) | 原生 App 示例 |
| [examples/neon-circuit/](./examples/neon-circuit/README.md) | 七赛道反重力竞速，陀螺仪 / 虚拟摇杆、独立刹车与油门 |
| [bridge/motion/](./bridge/motion/README.md) | iOS / Android 陀螺仪、设备姿态和屏幕方向倾斜角 |
| [examples/ak47-range/](./examples/ak47-range/README.md) | 横屏第三人称 AK47 生存射击、掩体寻路、视野迷雾和震动 |
| [examples/rubiks-cube/](./examples/rubiks-cube/README.md) | 共享 Games 源码的二阶/三阶/四阶/镜面魔方，横竖屏与历史还原 |
| [examples/sky-strike/](./examples/sky-strike/README.md) | 共享 Games Sky Strike 源码的竖屏 iPhone 游戏 |
| [examples/spider-solitaire/](./examples/spider-solitaire/README.md) | 共享 Games 蜘蛛纸牌源码的横屏 iPhone 游戏 |
| [examples/ios-pbr-orbit/](./examples/ios-pbr-orbit/README.md) | 首个 iPhone PBR 立方体与 Orbit 交互 Demo |

移动端专用运行时和平台接线在本仓实现；Engine 保留可复用的渲染器、材质、控制器及通用接口。示例通过 Engine 公共包导出接入，具体依赖和构建配置在 M16 G01/G02 中建立。

方案与执行计划见 [Native 文档入口](../milestones/native/README.md)；跨仓依赖规则见 [repository-version-policy.json](../milestones/milestones/repository-version-policy.json)。

G02 已完成 [原生宿主](./bridge/README.md) 与 private App，真机清屏、暂停恢复、独立冷启动和逐像素校验通过。G03 已完成真机静态 PBR 立方体和粗糙度对照，Orbit 由 G04 接续。

Moonlight Sudoku (LED Sudoku) is maintained in the private [MoonlightSudoku repository](https://github.com/HaiyueStudio/MoonlightSudoku).
