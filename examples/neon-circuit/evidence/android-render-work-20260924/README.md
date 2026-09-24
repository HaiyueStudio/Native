# 三项渲染实现优化 · 2026-09-24

## 已完成的修改

1. **合并动态纹理提交。** 游戏在更新外观、GUI 动画和 HUD 时按需创建一个共用 command encoder，随后提交，再执行场景绘制。尾焰、船体火焰、加速带、彩虹路面及 mip、小地图、血量环、GUI 动画贴图与轮播都支持记录到该 encoder。初始化、独立验证或帧外更新仍可独立提交。每个生产者保留自己的 uniform buffer，未变化的纹理不记录；没有延后或合并 uniform 写入，也没有改变各 pass 的顺序。
2. **缩小 GUI 重建范围。** 使用现有公开 `GuiRoot` 能力，将时间、最佳时间、速度、耐久/名次、圈数五个读数放到独立根节点。原 HUD 仍负责静态图片与交互。新根节点禁用命中测试，沿用原控件的布局锚点；布局、语言与可见性变化会刷新读数，暂停/结算/首页隐藏读数，不遮挡弹窗。引擎已有的按根缓存因此能复用静态 HUD。
3. **减少 Native 尺寸查询。** Android/iOS 都新增只取尺寸的桥接函数。`NativeSurface` 在当帧共用宽高结果，呈现、布局检查、前台恢复路径和释放时刷新/失效。`getBoundingClientRect` 保持实时读取窗口位置，保证触摸坐标一致；iOS 仍以完整 UIKit drawing bounds 为准。

未改 Engine 源码或升级当前固定包；游戏复用公开 API，Native 共享桥接同时覆盖 iOS/Android。1600 × 720、4× MSAA、batched、120 Hz 物理与游戏内容保持一致。

## 验证到的结构变化

- 七种动态纹理同时更新的 GPU audit：encoder/submit 从 **7 次变为 1 次**；pass 数、draw 数、uniform 写入次数与字节数一致。检查每个生产者使用独立 uniform，重复相同状态不再请求 encoder，销毁后 buffer/texture live 数归零。
- 安卓普通比赛中，60 帧计时更新期间静态 HUD layout 计数不变，读数根节点持续更新。真机起点通常有 2 个纹理生产者更新、共用 1 次提交；不把测试中的 7 种同时更新当作所有场景的实际数量。
- Native 尺寸测试中，当帧重复读取 120 次宽高只获取一组原生尺寸，窗口坐标读取为 0；新帧、布局变化与释放后重新获取尺寸，触摸查询随窗口位置变化实时更新。

## 真机对比

X4000 / Android 14 / Adreno 710。云端港湾、单人计时、追尾相机、车辆静止在起点。详细引擎诊断关闭，每版使用预热后的六个 120 帧窗口，共 720 帧。

| 指标 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 平均帧间隔 | 17.338 ms | 17.284 ms |
| 按帧间隔估算 FPS | 57.676 | 57.858 |
| 平均 CPU 回调（含 present 等待） | 15.994 ms | 15.943 ms |
| 六窗口中最高 P95 帧间隔 | 19.267 ms | 19.191 ms |

**固定场景未测得明显帧率提升。** 这些很小的差异不构成稳定提速结论；本轮确认的是上述提交、重建与查询次数的减少。未测 GPU 时间、纯 CPU 忙碌时间、GC 停顿或长时间温控，不将渲染循环间隔当作系统实际呈现 FPS，也不外推到全部赛道持续驾驶。

汇总：[before.json](before.json)、[after.json](after.json)；原始采样：[before.jsonl](before.jsonl)、[after.jsonl](after.jsonl)。

## 功能检查和安装

- Games 与 Native 类型检查通过，赛车网页目标构建与 Android APK 构建通过。
- 赛车专项 **79/79**、Native 赛车 **17/17**、AK47 原 iOS 桥接回归 **12/12** 通过。
- Games 全量 **638** 项：616 通过、2 失败、20 跳过；失败仍为 HYMUGEN 二进制指纹与 MUGEN 查看器虚拟列表合约，本轮未修改对应模块。没有将全量结果描述为通过。
- 安卓真机 **25/25** 通过，包含提交合并、静态 HUD 缓存、双指驾驶、陀螺仪、音频、三档震动接口和连续切换赛道。见 [verification.json](verification.json)。
- 浏览器四场景共 **288** 项 gameplay/UI 检查及 WebGPU 验证通过；已检查 [普通赛道](idle.png)、[竖屏 HUD](hud-mobile.png)、[横屏暂停](paused-landscape.png)、[彩虹赛道](rainbow-road.png) 截图。没有更新旧截图基线。
- 扩展检查发现 `ios-pbr-orbit` 历史宿主测试夹具未 mock `PresentationPause`，其 23 项中 17 通过、6 失败；本轮未修改宿主生命周期实现或这些夹具。日志见 [宿主测试](neon-three-host-tests.log)。
- 最终包已覆盖安装到 X4000，性能采样结束后恢复正常首页。APK：`/tmp/neon-three-optimized.apk`（Debug），SHA-256：`9f9a639656f1be15a2b59071a84d8f4eaece4eb61f482f9335b484fc4e3877f9`。
