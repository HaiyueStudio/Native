# 0.1.0-rc.3 真机验收

日期：2026-09-24。此目录记录本次候选的实际构建与验收，不表示已经正式发布。

六个 iOS 示例已使用用户指定的付费开发者账号完成签名构建并安装到 iPhone 15 Plus（iOS 18.7.3）。签名配置只在本地，未纳入 Git。初次构建遇到旧免费 Team 不可用，切换后解决。期间 iPhone 无线连接中断造成若干构建或安装失败，恢复 USB 后重试通过；失败原始日志留在 ignored artifacts。

- `source.json`：六个示例的冻结输入、依赖、类型与 84 项单元测试通过。
- `*-ios-build.json`：各示例完整原生构建和依赖锁验证。
- `*-ios-artifact.json`：实际安装的签名 Debug App 逐文件 SHA-256，不附带 App 本体。
- `neon-ios-verification.json`：106 项真机自动检查通过。
- `range-ios-verification.json`：47 项真机自动检查通过。
- `rc2-runtime-equivalence.json`：rc.2 → rc.3 只修改发布文档和根版本配置，桥接、六个示例与 Games 输入完全相同；Android 29 项及 5 轮前后台证据引用 rc.2，不声称 rc.3 新跑了一遍 Android。

六个示例的本次验收通过，范围见 [验收汇总](../../ACCEPTANCE.md)。XCTest 9 个流程无失败，日志分别为 `pbr-uitest.log`、`interactions-uitest.log`、`extra-uitest.log`；执行源码为 `Acceptance.swift`，截图在 `ui/`。这个 UI 测试使用 iPhone 15 Plus 的逻辑尺寸和本次纸牌牌局坐标，迁移设备或重开随机牌局需重新校准，不能直接当通用回归测试。

`ios-lifecycle.json` 逐个核对恢复时与后续帧数。魔方宿主记录四种打乱/还原，`cube-drag-host.jsonl` 记录面拖动及内层旋转分别从 0→1→0 步。蜘蛛纸牌截图显示非法放牌拒绝、合法 J→Q 移动及“Saved game restored”；`spider-reloaded-host.jsonl` 的新启动场景包含恢复后的 1 步、50 张库存及 Q/J 同列。Sky Strike 普通交互日志记录 ready→playing→paused、移动、开火和子弹；`sky-parts-probe.json` 记录 13 种 Boss/精英部件的 44 次采样。这些探针是指定场景，未宣称自然通关全部关卡。

模拟输入的游戏逻辑断言、XCTest 实际触摸、人工图像检查分别报告，不能互相替代。原始 xcresult 与签名安装包保留在 ignored artifacts；源码发布仅包含日志、哈希和选用的截图。

`sky-audio-probe.json` 是单独启动音效探针取得的结果，20 种效果的原生音频后端均无错误。首次将其与 Boss 探针同时启动时，Boss 探针结束会暂停音频，因而没有生成完整音效报告；单独运行后完成，不将首次未完成尝试算作通过。
