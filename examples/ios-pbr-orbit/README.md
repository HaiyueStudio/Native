# iOS PBR Orbit Demo

对应 [M16：iPhone 原生 PBR 立方体与 Orbit 交互](../../../milestones/native/m16-ios-pbr-orbit/README.md)。

这是 App 已确认的实现位置：`native/examples/ios-pbr-orbit/`。

- 首选 NativeScript Core + Canvas / wgpu，使用纯 TypeScript。
- 复用 HaiYue Engine 的 PbrMaterial 渲染一个立方体。
- 单指拖拽通过现有 OrbitControl 围绕立方体控制相机。
- 最终交付可在用户 iPhone 独立启动的原生 App，验收覆盖后台恢复与输入取消。

当前仅建立示例目录。依赖版本、package 配置、构建安装命令和 App 代码由 M16 G01/G02 起逐步补齐；此目录目前还不能运行。

实施前阅读 [契约](../../../milestones/native/m16-ios-pbr-orbit/contracts.md)、[Goal 清单](../../../milestones/native/m16-ios-pbr-orbit/milestone.json)、[集成验收](../../../milestones/native/m16-ios-pbr-orbit/integration.md) 和 [iPhone 指南](../../../milestones/native/m16-ios-pbr-orbit/iphone-guide.md)。
