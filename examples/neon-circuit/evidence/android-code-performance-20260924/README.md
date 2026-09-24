# 每帧代码检查与优化 · 2026-09-24

## 本轮修改

- `Games/games/neon-circuit/main.ts` 增加只读 `canDrive`，Native 驾驶控制不再为了读取比赛阶段构造完整诊断快照。正常比赛中之前约每帧调用四次，快照会复制对手/火球、统计 72 个烟雾与 160 个火花槽位，空间赛道还会采样轨道与复制相机矩阵。
- `NativeDriving` 每帧读取一次摇杆状态供自身 HUD、物理与外观使用，避免消费者重复构造冻结的状态对象；暂停、取消和切换赛道清零，比赛阶段仍即时判断。
- 摇杆和 GUI 共用当帧安全区结果，下一帧、布局变化和恢复前台时失效，不把原生安全区长期缓存。
- Android 音频的相同通道增益与相同主音量不再重复调用 SoundPool / MediaPlayer。没有量化音量或降低音效更新频率；主音量变化仍更新已有通道。

保留 1600 × 720、4× MSAA、batched、游戏内容和 120 Hz 物理步长。赛道加载提示成功后主动关闭的修复保留。

## 同机测量

X4000 / Android 14 / Adreno 710；云端港湾、单人计时、追尾相机、起点静止；详细引擎诊断关闭。每版六个预热后的 120 帧窗口，共 720 帧，使用同一 `profile-android.mjs`。基线是上一轮已修复加载提示的 APK。

| 指标 | 本轮修改前 | 修改后 |
| --- | ---: | ---: |
| 平均帧间隔 | 17.318 ms | 17.327 ms |
| 帧间隔估算 FPS | 57.744 | 57.715 |
| 平均 CPU 回调时间（含 present 等待） | 16.013 ms | 16.006 ms |
| 六窗口中最高的 P95 帧间隔 | 19.285 ms | 19.392 ms |

**本轮固定场景没有测得明显帧率提升。** 不能据此宣称持续驾驶或其他赛道更快，也没有测 GC 停顿或 GPU 时间。上述改动消除了明确的重复工作，但该场景主要瓶颈还在其他位置。

汇总：[before.json](before.json)、[after.json](after.json)；原始采样：[before.jsonl](before.jsonl)、[after.jsonl](after.jsonl)。

## 后续优先测量的候选

1. **合并动态纹理提交。** `ThrusterFlameTexture.update`、`BoostStripTexture.update`、`HudMapTexture.update` 各自创建 encoder 并 `queue.submit`；彩虹路面、受损火焰按场景增加提交。可以考虑通过引擎帧内公共接口记录到共用 encoder，保持纹理先于主场景绘制；需要测量桥接/提交成本，并验证资源切换与销毁。不能直接改变队列提交顺序或批量延迟 `writeBuffer`。
2. **缩小 GUI 更新范围。** GUI 元素的 `setText`、`setStyle` 已有相同值判断，地图和健康纹理也已有去重。计时文字每帧变化仍可能使根节点变脏；当前 Engine 的 `GuiRenderer.prepareRootCaches/rebuildRoot` 按根重建批次。静态 HUD 与动态数字分开缓存值得测量；这是通用 GUI 能力，应优先落在 Engine，而非游戏中复制渲染器。
3. **减少原生尺寸查询。** `NativeSurface` 的 `clientWidth/clientHeight` 都通过完整 `nativeViewRect` 读取，包括窗口坐标。只取尺寸或在布局事件缓存可减少桥接，但要覆盖旋转、安全区变化、恢复前台与触摸坐标一致性。

这些是基于代码路径的候选，未作为已确认耗时排名或预估 FPS 收益。下一轮应先分别计时游戏更新、GUI 批次重建、命令记录/提交；CPU 回调包含 present 等待，不能据此直接判断 GPU 或纯 CPU 瓶颈。

## 验证与安装

- Native 和 Games TypeScript 检查通过，Native 15 项测试、赛车专项 78 项测试通过，赛车网页目标构建与 Android 构建通过。
- Games 全量：637 项，614 通过、2 失败、1 取消、20 跳过。失败为 HYMUGEN 二进制指纹与 MUGEN 查看器虚拟列表合约，取消项为 Petra 导入 30 秒超时；未修改这些模块，也未将全量结果描述为通过。
- 最终 APK 已覆盖安装，23 项真机检查通过，包含驾驶、陀螺仪、音频、震动和连续切换赛道。见 [verification.json](verification.json)。结束后恢复正常首页。
- APK：`/tmp/neon-circuit-code-optimized.apk`（Debug）。SHA-256：`465f30251ef758e5328269d6223e2211d954eca5386bfe0492d7a244bd5e3c98`。
