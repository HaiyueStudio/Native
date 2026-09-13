# Native Device Motion 验证 — 2026-09-13

- Native AK47 宿主类型检查通过；12 项测试通过，其中新增 4 项传感器测试覆盖角度/单位、倾斜正负方向及四种屏幕坐标、样本不可变、时间戳去重、挂起恢复、明确停止、单实例、硬件不可用、参数校验和异常清理。
- iOS 构建、签名通过，宿主原有 21 个模型/贴图资源校验通过。安装到 iPhone 15 Plus 后以 `MOTION_VERIFY=1` 启动显式传感器诊断。
- `iphone-verification.json`：120 个真实 Core Motion 样本、11 项检查通过，检查重力模长、四元数归一化、时间戳递增、度/弧度换算、屏幕轴配置以及真实 stop/start/suspend/resume 调用。首末样本的 pitch 约 35.4°→13.7°，roll 约 −18.3°→−34.0°，yaw 约 16.0°→6.1°。
- 采集来自真实硬件；姿态正负方向的标准角度验证通过合成重力向量测试覆盖，未声称完成实体角度量具标定。应用后台事件解绑/恢复路径通过模拟 Application 事件测试，真机诊断直接调用相同控制器的挂起恢复方法。
- 诊断完成后已停止并释放采集，再以所有验证开关为 0 重启普通 App。游戏未接入体感移动或瞄准。

原始输出见 `tests.log`、`typecheck.log`、`native-build.log`、`iphone-verification.json` 与设备操作 JSON；`build-proof.json` 记录桥接、接入代码和原生包摘要。仅验证 iOS，未发布新包。
