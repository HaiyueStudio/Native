# 魔方实验室验证 — 2026-09-10

本文件记录首次交付。后续圆角几何与透视相机更新的构建、截图及真机证据见 [rounded-perspective/verification.md](rounded-perspective/verification.md)。

## 已通过

- Games 与 Native TypeScript 类型检查；新游戏目录 ESLint 无问题。
- 18 项魔方规则/动画事务/布局测试、6 项共享存档测试，共 24 项通过。覆盖四种类型、任意层四次旋转、逆操作、500 次混合操作后精确回退、镜面异形、切面互不穿插、打乱/停止/撤销/回放事务。
- 2 项目录/Pages 接入测试，4 项 Native 桥接测试通过。
- `npm run build:target -- game:rubiks-cube` 通过。
- Chrome 原生 WebGPU 在 390×844 与 844×390 两个尺寸下，分别对全部四种魔方执行：种子 20260910 打乱 → Engine GUI 选择第二层并转动 → GUI 撤销 → GUI 完整历史还原。所有断言通过，无未分类浏览器/GPU 错误。截图已目视检查文字、按钮、几何和留边。
- 人工浏览器交互检查：镜面打乱后外形变化；25 步回放恢复原形；在方块表面拖动触发单层旋转；游戏过程中由竖屏切到横屏保留操作记录；四阶提供四层选择。
- NativeScript/webpack 打包通过，Xcode Debug iPhone 签名构建 `BUILD SUCCEEDED`。产物位于 `platforms/ios/build/Debug-iphoneos/rubikscube.app`。Engine/Native bridge 未修改。

## 真机安装与运行

用户明确授权后，已卸载旧 `org.haiyue.native.iospbrorbit` Demo 并成功安装、启动独立 `org.haiyue.native.rubikscube`，解决免费开发签名三个 App 的数量限制。Spider Solitaire 与 Sky Strike 未卸载。

Apple A16 GPU 上通过 Canvas/wgpu/Metal 正常呈现。归档日志已到第 4920 帧，竖屏像素尺寸 860×1678（安全区内逻辑尺寸 430×839），没有 error 或 capture-error。日志中可见二阶的触摸旋转、历史步数增加、还原回放以及完成后的 0 步/已复原状态，也观察到切换进入镜面魔方并转层。

真机横屏与四阶的操作尚未在此次日志中观察到；横竖屏全部四种类型的自动交互验收已在浏览器通过。应用在诊断启动命令前已经运行，因此此次未生成一次性帧截图；未为截图强制重启用户正在玩的局面。

详见 `iphone-host.jsonl` 和不含设备标识符的汇总 `iphone-verification.json`。

## 仓库级检查限制

`npm test` 全量运行出现 MUGEN 的 fixture/oracle/golden 断言失败，长时间运行后中止，部分 MUGEN 用例取消。新游戏的目录缩略图和存档接口接入已补齐并单独复测通过。`npm run build` 全量构建在同时运行大批测试时于 match-3 达到原有 60 秒超时上限；之后魔方目标独立构建通过。未改动 MUGEN、match-3 或全局验收阈值。详见 `repository-checks.txt`，不能把这些结果表述为全仓验收通过。

## 证据

- `browser-portrait.png`、`browser-landscape.png`：最终镜面/四阶画面。
- 对应 JSON：每种魔方验收结果、浏览器身份、WebGPU 诊断、画面指纹和 bundle SHA-256。
- `build-proof.json`：最终共享源码、Native 入口、锁文件、浏览器/Native bundle 哈希和设备构建状态。
- `rules-and-save-tests.log`、`native-tests.log`、`lobby-tests.log`、类型检查与目标构建日志。

当前还原仅使用本局历史；最近使用的魔方类型走 Engine 单槽存档，完整棋局不跨冷启动持久化。后续公式求解没有提前引入。
