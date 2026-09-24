# Android 性能优化 · 2026-09-24

X4000 / Android 14 / Adreno 710，NativeScript 9.0.3、Canvas 2.1.18、Engine 0.1.0。Android 默认从 `simple` 改为 `batched`，启用视锥裁剪、材质批处理；保留 1600 × 720、4× MSAA、reverse-Z 与游戏内容。正常游玩关闭周期性完整日志写入，仍保留首帧、生命周期和错误记录。

## 同包 A/B 结果

云端港湾、单人计时、第三人称相机、车辆静止在起点。禁用详细引擎诊断，只记录轻量帧计时。每种模式丢弃启动/倒计时阶段，取结束于第 360、480、600、720、840、960 帧的六个窗口，共 720 帧。使用内存比赛/界面存储，阻止触摸干扰，不覆盖玩家成绩与界面偏好。

| 指标 | simple | batched |
| --- | ---: | ---: |
| 平均帧间隔 | 23.657 ms | 17.317 ms |
| 按平均帧间隔估算 FPS | 42.27 | 57.75 |
| 平均 CPU 回调时间（含 present 等待） | 22.693 ms | 15.998 ms |
| 六个窗口中最高的 P95 帧间隔 | 26.077 ms | 19.477 ms |

帧间隔降低约 26.8%，估算 FPS 提升约 36.6%。这是单设备固定场景的渲染循环采样，不是系统呈现帧率，也不是所有赛道持续驾驶的 60 FPS 保证；没有测 GPU 时间或长时间温控降频。P95 列是六个窗口 P95 的最大值，并非全部样本的合并 P95。

另一次开启详细计数的初始诊断中，绘制调用约由 1273 降至 108；该次诊断包含对手且有额外计时开销，仅用于定位瓶颈，不混入上表。实验 `gpu-driven` 在首帧前触发 `In a execute_bundle command`，因此最终选择 `batched`。失败记录为 [gpu-driven.jsonl](gpu-driven.jsonl)。

原始成功采样：[simple.jsonl](simple.jsonl)、[batched.jsonl](batched.jsonl)；加权汇总：[summary.json](summary.json)。复测入口是 `scripts/profile-android.mjs`，默认只比较 simple/batched。A/B 后将临时存储和触摸隔离从 `NEON_PERF` 拆至独立的 `NEON_BENCHMARK`；脚本同时设置二者，采样行为不变，手动性能采样可正常驾驶。

## 最终包验证

- TypeScript 检查通过；赛车单元测试 15/15 通过；Android APK 构建成功。
- 最终 APK 已覆盖安装到 X4000；[verification.json](verification.json) 的 17 项真机检查通过，包含 Vulkan 横屏、PBR 模型、GUI、双指驾驶、真实陀螺仪、采集暂停/恢复、音频及三档碰撞震动接口。震动接口通过不代表已人工验证物理手感。
- 最终安装包：`/tmp/neon-circuit-optimized.apk`（Debug）。SHA-256：`353e15bc0af5adc0356c8bd884679c9515d5a03ac3d77438d9d422aea5e53425`。
- A/B 原始采样使用此前同轮构建；最终包包含上述诊断开关拆分，默认渲染配置相同。未将历史 iOS 或全 Games 测试当作本轮重新通过。
- 正常比赛启动的 [宿主日志](final-race-host.jsonl) 确认 `batched`、1600 × 720 与首帧呈现，记录中无宿主错误。ADB 截图传输多次截断，未取得可检查的完整图片，因此本轮不宣称完成截图视觉验收。结束后已移除诊断启动参数并返回正常首页。
