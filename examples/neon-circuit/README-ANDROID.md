# 极速新星 Android

包名：`org.haiyue.games.neoncircuit`。iOS 继续使用 `org.haiyue.native.neoncircuit`；`native` 是 Java 保留字，Android 使用独立包名。

## 构建与安装

- Node 22+、JDK 21、Android SDK platform 36 / build-tools 36.0.0、带 Pillow 的 Python。
- 默认复用 `Native/.android-tools` 的 JDK、SDK、Gradle 缓存；也可设置 `JAVA_HOME`、`ANDROID_HOME`、`PYTHON`。
- 同级需要 Games 仓库的 neon-circuit 源码与素材。依赖使用 vendor 中固定的 Engine / Extensions / Animation Spec tarball。

```sh
npm ci
PYTHON=/path/to/python-with-pillow npm run build:android -- --copy-to /tmp/neon-circuit.apk
adb -s <serial> install -r /tmp/neon-circuit.apk
adb -s <serial> shell am start -n org.haiyue.games.neoncircuit/com.tns.NativeScriptActivity
```

最低 Android 8 / API 26，需要设备支持原生 Vulkan/WebGPU。游戏强制横屏并全屏绘制，HUD 使用安全区。设置中可选择虚拟摇杆或陀螺仪；没有完整传感器组合时禁用陀螺仪选项。新开始或恢复比赛时，以当前持握姿态重新校准中立角度。碰撞触发轻、中、重震动。

短音效使用 SoundPool，30 秒背景音乐使用 MediaPlayer 流式播放；大块 RGBA / 模型数据走直接缓冲区，避免逐字节跨 JNI 读取。

## 验证

```sh
npm run typecheck
npm test
adb -s <serial> shell am start -S -n org.haiyue.games.neoncircuit/com.tns.NativeScriptActivity --ez NEON_VERIFY_ANDROID true
adb -s <serial> shell run-as org.haiyue.games.neoncircuit cat files/neon-android-verification.json
```

专用验收入口使用内存比赛存档，覆盖 GUI 进入比赛、双指驾驶、真实传感器样本、暂停/恢复采集、音频与三档实际碰撞反馈。自动验收只证明震动接口被调用，物理手感需要人工体验。结束后重新使用不带参数的启动命令，返回正常游玩。

此构建是 Debug 真机开发包，不是商店 Release AAB。

## 性能采样

Android 默认使用 `batched`，启用视锥裁剪与材质批处理；保留原分辨率、4× MSAA 和 reverse-Z。正常游玩不采集详细引擎计数，也不周期性写完整快照。iOS 渲染配置仍为 `simple`。

安装当前构建后，在本目录执行固定场景对比：

```sh
node scripts/profile-android.mjs --device <serial>
```

默认依次比较 `simple`、`batched`，每种模式取预热后的六个 120 帧窗口。测试使用临时比赛/界面存储并忽略触摸，保持车辆在云端港湾起点；请保持设备解锁。结束或失败后自动重启为正常游玩。原始日志和摘要写入 `artifacts/android-performance/`，可用 `--output` 改变位置，或用 `ADB` 指定 adb。

手动驾驶采样保留正常操作与用户设置：

```sh
adb -s <serial> shell am start -S -n org.haiyue.games.neoncircuit/com.tns.NativeScriptActivity --ez NEON_PERF true --ez NEON_RACE true
```

额外传入 `--ez NEON_RENDER_DIAGNOSTICS true` 可定位绘制/上传开销，但该诊断有额外成本，不用于常规 FPS 对比。渲染配置覆盖 `--es NEON_RENDER_PROFILE simple` 仅在 `NEON_PERF` 启用时生效。实验性的 `gpu-driven` 在当前设备/运行时遇到 `execute_bundle` 错误，未用于默认配置。

本轮约 42 → 58 FPS 的固定场景结果与 17 项最终包真机回归见 [性能记录](evidence/android-performance-20260924/README.md)。这些 FPS 是渲染循环帧间隔估算，持续驾驶和其他赛道需分别测量。

后续修复了关闭周期日志后切换赛道的加载提示不消失问题：加载成功后主动隐藏原生标签，真机回归扩展至 23 项，包含连续切换霓虹都市与云端港湾。见 [加载提示修复记录](evidence/android-track-loading-20260924/README.md)。

2026-09-24 已在 X4000（Android 14 / Adreno 710）构建、安装并完成 17 项真机检查；15 项赛车单元测试与 12 项原 iOS 桥接回归全部通过。结构化结果见 [验收记录](evidence/android-20260924/verification.json)。
