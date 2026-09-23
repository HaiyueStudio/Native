# Haiyue 通用启动页

`NativeEngineLaunchPage` 是原生启动页面，初始化期间显示 Haiyue 标志，游戏实际呈现首帧后淡出。默认自动适配横竖屏，也可指定 `portrait` / `landscape`；指定样式不会锁定系统方向。背景铺满屏幕，`gameRoot` 中的应用内容遵守安全区。Android 的 Page 和背景容器将窗口边缘信息传递给子层，仅 `gameRoot` 应用安全区留白，避免开屏遮罩外露出页面背景。

## 接入

在应用的 `webpack.config.js` 中复制共享品牌素材（路径按项目位置调整）：

```js
const { addEngineBrandingCopyRule } = require('../../bridge/branding/webpack.cjs');
// webpack.init(env) 之后、webpack.resolveConfig() 之前：
addEngineBrandingCopyRule(webpack);
```

应用入口创建共享页面，将自己的 UI 加入 `gameRoot`：

```ts
import { Application } from '@nativescript/core';
import { NativeEngineLaunchPage } from '../../../bridge/branding/launch-page';

Application.run({ create: () => {
  const page = new NativeEngineLaunchPage({ orientation: 'auto' });
  page.gameRoot.id = 'appRoot';
  // 在 loaded 后构建 UI、创建 Canvas 并初始化引擎。
  // 将应用控件加入 page.gameRoot；保持品牌遮罩在最上层。
  return page;
} });
```

- 初始化状态可通过 `page.splash.setMessage('正在准备棋盘…')` 更新；默认载入文案支持中、英、日语。
- **首次成功呈现 GPU 帧后**调用 `page.splash.presented()`。初始化 Promise 完成或场景创建完成不代表画面已经呈现。组件用 180 ms 淡出，不增加固定等待时间。
- 初始化失败时调用 `page.splash.fail()`，也可传入自定义错误文案。失败会中止淡出并保持错误页可见。
- 页面真正销毁时调用 `page.splash.dispose()`；后台切换、临时模态窗口不需要销毁或重播开屏。销毁会移除布局监听，重复调用安全。
- `page.splash.status` 可供启动诊断使用。

已有 XML 页面可以继续使用 `new NativeEngineSplash(fullscreenGrid)`，保留同样的首帧/失败/销毁接线。`calendar-puzzle` 使用该方式；`led-sudoku` 使用共享页面的竖屏方式。

此组件覆盖 NativeScript 页面创建后的应用初始化阶段。操作系统在 JavaScript 启动前显示的 LaunchScreen / Android 系统启动画面仍由各应用的 `App_Resources` 配置。

## 品牌素材

沿用 calendar-puzzle 已使用的冰蓝色琉璃月牙：`assets/haiyue-moon-master.png` 为透明 RGBA 母版，`assets/haiyue-moon.png` 为 384 px、约 127 KiB 的发布版本。共享打包规则只复制发布版本，不打包母版，也不替换各游戏的应用图标。

素材于 2026-09-20 使用 imagegen 根据用户轮廓生成，参考文件为 `codex-clipboard-d5dc03ec-570a-48f9-8a70-78b7ec3c10eb.png`。原提示为宽左月牙、淡蓝透明抛光琉璃、透明圆形镂空、无文字及装饰；发布版本使用 macOS sips 缩放并保留透明通道。本次仅复用素材并调整页面布局。

## 验证

`examples/calendar-puzzle/test/loading-performance.test.mjs` 验证横竖屏尺寸、旋转重排、页面分层、消息更新、失败与淡出竞争、销毁清理。数独的真机诊断额外检查首帧后启动页已隐藏；仅诊断模式会保存开屏截图。
