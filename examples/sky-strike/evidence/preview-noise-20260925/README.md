# iPad Boss 预览噪声修复 — 2026-09-25

用户报告：失败后返回选择关卡，第 5 关 Boss 预览偶发变成条纹噪声。

## 修复

- 原生素材包原先使用 `new Uint8Array(interop.bufferFromData(data))`，只创建了指向临时 NSData 内存的视图。`unpackSkySprites` 保存的子视图会被后续按需合成 Boss 预览再次读取。现在立即 `.slice()` 为 JavaScript 所有的缓冲区，避免原始 NSData 回收后继续读取。
- 预览离屏渲染器、MSAA 纹理和 attachment views 保留至 GPU 队列完成后释放；`pendingPreviewCompositions` 用于检查回收。保持原有独立预览渲染器和战斗命令隔离。
- 新增素材存储所有权与预览资源生命周期回归测试。

## 定位证据

仅调整 GPU 临时资源释放时机后，诊断仍能稳定触发 SIGSEGV。直接纹理读回版本和整帧截图版本的崩溃报告均指向 `_platform_memmove` / `Builtins_TypedArrayPrototypeSlice`：整帧版本完成第一张截图后，在后续预览创建阶段退出。这使定位从读回接口转向后续素材读取。修复 NSData 所有权后，同一整帧诊断完整通过。

`pre-fix-crash-summary.json` 保留两个原生崩溃堆栈的脱敏摘要。用户照片中的具体噪声像素未做逐像素复现；实际复现并消除的是同一按需素材读取路径的非法内存访问。

## 验证

- iPad Air 第四代，原生 WebGPU / Metal，1640 × 2360，4× MSAA。
- `npm test`：12/12 通过；`npm run typecheck` 通过；`git diff --check` 通过。
- `build:device` 成功，`codesign --verify --deep --strict` 成功；修复包已安装。
- `SKY_PREVIEW_PROBE=1`，使用 MemorySaveBackend 隔离真实玩家存档。
- 12 关 × 3 轮，共 36 次：进入游戏 15 帧 → 失败返回 → 等待 30 帧 → 截取实际 GPU 画面。前两轮覆盖缓存预览，第三轮以新的 key 强制重新合成组合式 Boss 预览。
- `probe.json`：complete=true，36 条记录，无错误；每条记录 pendingPreviewCompositions=0，渲染器 ready=true。
- 已目视检查所有 36 张截图：Boss 均正常，无条纹噪声。`round-1.png` 至 `round-3.png` 是选择关卡区域的截图汇总；`level-05.png` 为第三轮第 5 关原始整帧截图。完整原始帧暂存在 `/private/tmp/sky-noise-captures`，哈希见 `frame-hashes.json`。
- `probe-host.jsonl` 连续呈现到 3720 帧，无 error / failed / device-lost 事件。
- 最后已以 SKY_PERF=0、SKY_PREVIEW_PROBE=0、SKY_CAPTURE_FRAME=0 重启 App，恢复正常存档和游戏模式。
- `normal-host.jsonl`：正常模式持续呈现到 3360 帧，phase=ready，splash=hidden，pendingPreviewCompositions=0，ready=true，无 GPU 错误。

本次不改 Boss 外观、玩法、屏幕比例或存档格式。诊断模式仅由显式启动环境变量开启，日常启动不执行自动切关或截图。
