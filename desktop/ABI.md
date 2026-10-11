# P0 桌面契约 v1

`host/` 是本仓库桌面样板的内部模块，未承诺稳定 npm 桌面 API。公共成就端口由 `bridge/achievements/core/types.ts` 定义，`AchievementPort.contractVersion = 1`；JSON 例子在 `test/fixtures/achievements`。

## 所有权

一个主线程拥有 GLFW init/terminate、一个窗口及 surface。Deno 创建 device 和 WebGPU 对象；不与 RustNative 或其他宿主交换句柄。GLFW native handle 在窗口销毁前有效，Cocoa view 必须在主线程读取。图片/Worker 结果只传数据。

窗口构造失败释放已分配资源；正常关闭停止帧回调、保存游戏、释放 GPU 场景、销毁窗口、关闭原生 callback 和动态库。键鼠监听由 window.on 返回取消函数。关闭后不派发输入；失焦清空按键和指针。原生回调不得把异常跨 C 栈抛出，错误在下一次 poll 进入 JS 主循环诊断。

GPU 帧在已知尺寸下先 acquire，再执行 Engine RAF 队列，最后一次 present。临时获取失败不清空 RAF 队列。没有使用 placeholder texture。前台连续 120 次已知获取失败终止；未知 GPU 错误立即上抛。没有声称完整 device 重建已实现。

## 音频 C ABI v1

| 函数 | 结果 |
| --- | --- |
| `int haiyue_audio_version(void)` | 1 |
| `int haiyue_audio_init(void)` | 0 成功，非 0 miniaudio 错误 |
| `int haiyue_audio_play(const char *path)` | UTF-8 NUL 结尾路径，在调用期间借用；JS 拒绝内部 NUL |
| `int haiyue_audio_pause(void)` / `resume(void)` | 0 成功 |
| `void haiyue_audio_dispose(void)` | 幂等释放 |

一个进程只创建一个音频 engine。所有 ABI 调用在 JS 主线程发起，音频混音由 miniaudio 线程持有，不回调 V8。不暴露跨 FFI JS 对象或任意函数指针。Windows x64 固定 32 位 int；后续 Steam/GameKit 必须各自定义版本化 ABI、线程和释放规则，不假设可以复用音频签名。

## 成就端口

平台 provider 显式注入；core import 无 Engine、NativeScript、Deno 或平台 SDK 副作用。绝对整数进度有目标上限，只增不减；每账号/成就仅保留最高同步意图。账号 namespace 含游戏、环境、provider、应用 ID 和 player/guest ID。guest 不自动归属新登录账号。

queued 在原子写成功后返回；provider-accepted 仅代表 SDK 接受；querying provider 的意图在读回确认前保留，五秒后可重发绝对值。reconciled 也不代表平台提供云端强一致保证。provider 必须在实际 SDK 副作用之前再次核对 context 中的玩家身份；generation 和 AbortSignal 防止迟到结果更新当前账号。

存储 adapter 必须是单写者、有界 IO、原子替换；JSON schema/目标变化需显式迁移。游戏规则、toast、奖励、跨设备累计与跨平台账号绑定都不属于核心契约。
