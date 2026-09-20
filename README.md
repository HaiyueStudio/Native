# HaiYue Native

HaiYue 移动端实现目录，承载原生 App、移动端宿主适配以及构建和真机调试工具。

## 目录

| 路径 | 用途 |
| --- | --- |
| [examples/](./examples/README.md) | 原生 App 示例 |
| [examples/led-sudoku/](./examples/led-sudoku/README.md) | iPhone / Android 竖屏流光数独，LED 灯管、九宫格输入与十四种规则 |
| [examples/neon-circuit/](./examples/neon-circuit/README.md) | 四赛道反重力竞速，陀螺仪 / 虚拟摇杆、独立刹车与油门 |
| [bridge/motion/](./bridge/motion/README.md) | iOS 陀螺仪、设备姿态和屏幕方向倾斜角 |
| [examples/ak47-range/](./examples/ak47-range/README.md) | 横屏第三人称 AK47 生存射击、掩体寻路、视野迷雾和震动 |
| [examples/rubiks-cube/](./examples/rubiks-cube/README.md) | 共享 Games 源码的二阶/三阶/四阶/镜面魔方，横竖屏与历史还原 |
| [examples/sky-strike/](./examples/sky-strike/README.md) | 共享 Games Sky Strike 源码的竖屏 iPhone 游戏 |
| [examples/spider-solitaire/](./examples/spider-solitaire/README.md) | 共享 Games 蜘蛛纸牌源码的横屏 iPhone 游戏 |
| [examples/ios-pbr-orbit/](./examples/ios-pbr-orbit/README.md) | 首个 iPhone PBR 立方体与 Orbit 交互 Demo |

移动端专用运行时和平台接线在本仓实现；Engine 保留可复用的渲染器、材质、控制器及通用接口。示例通过 Engine 公共包导出接入，具体依赖和构建配置在 M16 G01/G02 中建立。

方案与执行计划见 [Native 文档入口](../milestones/native/README.md)；跨仓依赖规则见 [repository-version-policy.json](../milestones/milestones/repository-version-policy.json)。

G02 已完成 [原生宿主](./bridge/README.md) 与 private App，真机清屏、暂停恢复、独立冷启动和逐像素校验通过。G03 已完成真机静态 PBR 立方体和粗糙度对照，Orbit 由 G04 接续。
