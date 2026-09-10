# HaiYue Native

HaiYue 移动端实现目录，承载原生 App、移动端宿主适配以及构建和真机调试工具。

## 目录

| 路径 | 用途 |
| --- | --- |
| [examples/](./examples/README.md) | 原生 App 示例 |
| [examples/spider-solitaire/](./examples/spider-solitaire/README.md) | 共享 Games 蜘蛛纸牌源码的横屏 iPhone 游戏 |
| [examples/ios-pbr-orbit/](./examples/ios-pbr-orbit/README.md) | 首个 iPhone PBR 立方体与 Orbit 交互 Demo |

移动端专用运行时和平台接线在本仓实现；Engine 保留可复用的渲染器、材质、控制器及通用接口。示例通过 Engine 公共包导出接入，具体依赖和构建配置在 M16 G01/G02 中建立。

方案与执行计划见 [Native 文档入口](../milestones/native/README.md)；跨仓依赖规则见 [repository-version-policy.json](../milestones/milestones/repository-version-policy.json)。

G02 已完成 [原生宿主](./bridge/README.md) 与 private App，真机清屏、暂停恢复、独立冷启动和逐像素校验通过。G03 已完成真机静态 PBR 立方体和粗糙度对照，Orbit 由 G04 接续。
