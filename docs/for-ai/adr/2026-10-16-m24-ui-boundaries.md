# M24 Native UI 包边界与宿主职责

状态：G01 架构决定；实施由 G03/G06/G08/G10 完成。2026-10-16。

共享应用状态和业务留在产品仓库，UI 仓库提供无 DOM 核心及 Web 适配，Native 提供可选平台适配。维持现有移动 NativeScript 与桌面 Deno/GLFW/wgpu 路线；桌面最终 UI 呈现选择由 G04 实测后接受，不把移动 NativeScript 控件假定为桌面可用。

## 冻结入口与依赖

| 入口 | 归属 | 允许依赖 | 要求 |
| --- | --- | --- | --- |
| `@haiyue/ui/core`、`/portable` | UI 根 package | 无 Haiyue runtime/产品依赖 | 无 DOM 全局、无注册副作用；G03 后才实际导出 |
| `@haiyue/ui/adapters/web` | UI 根 package | 同包核心与明确组件子路径 | 不导入根 barrel，不引入 NativeScript |
| `@haiyue/native/ui` | Native `bridge/ui/index.ts` | UI 的独立子路径、NativeScript | 显式可选入口；G06 导出，不从 Native 根入口重导出 |
| `Native/desktop/ui/index.ts` | 现有私有 desktop 开发包 | 锁定 UI 包；选型需要时显式 Engine GUI 适配 | G08 接入；M24 不预先承诺 npm 桌面二进制入口 |
| Native 系统子路径 | 既有 bridge | 相应平台 API | 不引入 UI 或 Engine |

Native npm 增加 UI 时采用 **optional peer dependency**，由 UI consumer 显式安装并锁定被测 UI 版本；不能放入普通 dependencies，也不能用会默认安装的 optionalDependencies 代替“无需安装”。确切可发布版本范围由 G10 最小/最大/candidate 消费测试确定，G01 不声明未发布范围可用。NativeScript 现有 peer 规则不在本目标扩大或改写。

当前 Native 根兼容入口仍重导出 Engine adapter，因此“系统功能无 Engine”只针对隔离子路径，不应宣称当前根入口完全独立。G01 的真实无 UI/Engine 消费者验证采用 achievements/local 子路径；G10 再覆盖系统能力完整矩阵。新 UI 入口不加剧根依赖，也不在本目标悄悄移除旧兼容导出。

ShaderLab 作为同仓 workspace 增设私有 shared 构建单元（G02）：先构建 domain/application/ports/views，再构建 Web 和 mobile；mobile 不再通过 web/dist 获得模型。现阶段保留旧路径并用当前 fixture 固定行为。

## 构建与验证入口

UI 保留 `typecheck`、`test`、`build`、`api:check`，后续新增 `verify:portable` 验证 core/types/fixtures；Native 后续新增 `verify:ui -- --profile core|mobile|desktop|consumer|fresh`。聚合器中 pending-device 与 unsupported 不能当通过。G01 探针入口单独位于 review/experiments，不提前替换生产构建。

跨仓消费只能 registry 包或 SHA-256 固定的 npm-pack tarball。npm 包不含游戏/ShaderLab 样例、基线证据、SDK 和本地工具链。Engine 不依赖 UI/Native，产品在装配点注入服务。M23 Native 0.2.0 候选与现有发布版本不变。

## 后续验收责任

G04：Windows x64/macOS arm64 宿主、真实中文 IME、可访问性树与读屏、DPI、GPU 合成。G06：iPhone/iPad/Android 原生控件语义。G07：原生设备旧路径基线与共享页面对照。G08：桌面旧路径和迁移后对照。G10：最终当前 revision 完整矩阵与纯系统消费包边界。
