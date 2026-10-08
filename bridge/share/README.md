# 系统分享（Native / Web）

源码新增能力，尚未发布到 npm。先用 `node npm/stage-development.mjs` 生成私有开发包。
`@haiyue/native/share` 由 NativeScript 选择 iOS / Android 实现，普通 Web 构建选择浏览器实现。
Web 也可显式导入 `@haiyue/native/share/web`；这两个 Web 入口不加载 NativeScript、Engine 或平台 SDK。
包仍为 TypeScript 源码，需要构建器编译；Web 应用不要导入 Native 根入口。

```ts
import { shareContent, canShareContent, ShareError } from '@haiyue/native/share';

const content = {
  title: '我的最佳战绩',
  text: '专家数独 06:32，零提示！',
  url: 'https://example.com/challenge/123',
  // 可选：提前编码的 PNG/JPEG，不能传原始 GPU 像素。
  image: { bytes: pngBytes, mimeType: 'image/png' as const, filename: 'result.png' },
};
shareButton.on('tap', async () => {
  // Web 的 DOM button 可在 click listener 中调用同一个函数。
  try {
    const result = await shareContent(content);
    if (result.status === 'unsupported') showDownloadOrCopyActions();
  } catch (error) {
    if (error instanceof ShareError) showError(error.code, error.message);
  }
});
```

`pngBytes`、按钮与提示函数由宿主提供。截图/战绩卡排版留在游戏或 Engine；本层只负责系统分享。
须在点击前准备图片，Web 的点击回调中先 await 截图、读文件或网络请求可能丢失用户激活。
文字/标题/链接每项最多 16,384 个字符；至少传 text、url、image 中的一项。
图片最多 10 MiB，支持 PNG/JPEG，校验签名并复制字节；这不是完整图像解码校验。
链接必须为绝对 HTTP(S) 地址，文件名不得包含路径分隔符。单次支持一张图。

## 结果和能力检测

| status | 含义 |
| --- | --- |
| completed | Web 或 iOS 报告系统分享操作完成；不证明社交平台已发布 |
| cancelled | iOS 用户取消；Web AbortError（也可能没有可用目标） |
| presented | Android chooser 已返回；系统没有可靠的最终发布/取消结果 |
| unsupported | 浏览器没有所需 API、当前策略不允许或不支持这类文件；不会偷偷改为仅分享文字 |

`canShareContent(content)` 是同步预检查：校验输入，Web 查询 `navigator.canShare`（如存在），
Native 检查宿主/Android 图片 provider 配置。返回 true 不保证有已安装的接收 App 或最终分享成功。
`ShareError.code` 为 invalid-data、busy、unavailable、failed。并发请求拒绝，结束后可再次分享。
Web 权限/用户激活拒绝会抛 failed，不当作用户取消。
接口不会自动复制、下载、上传或发奖；提供“保存图片 / 复制链接”等显式备用按钮由游戏决定。

## iOS

使用 UIActivityViewController；无需平台 SDK、登录、相册权限或 Info.plist 权限声明。
自动锚定当前前台视图的中心以支持 iPad popover。图片写入应用临时目录，通过文件 URL 分享，
活动完成后清理；进程被终止的残留由系统临时目录清理机制管理。
需要在可见宿主中调用，不要在视图转场或后台触发。不同接收 App 可能忽略标题、文字或链接。

## Android

文字分享无需配置。图片分享使用 AndroidX FileProvider，仅暴露本功能自己的缓存子目录，
不需要存储/相册权限。NativeScript 已依赖 AndroidX Core，无需新增社交 SDK。

1. 将包内 `bridge/share/android/HaiyueShareProvider.java` 复制到宿主
   `App_Resources/Android/src/main/java/org/haiyue/share/HaiyueShareProvider.java`。
2. 将 `bridge/share/android/haiyue_share_paths.xml` 复制到宿主
   `App_Resources/Android/src/main/res/xml/haiyue_share_paths.xml`。
3. 在宿主 `AndroidManifest.xml` 的 `<application>` 中加入：

```xml
<provider android:name="org.haiyue.share.HaiyueShareProvider"
    android:authorities="${applicationId}.haiyue.share"
    android:exported="false" android:grantUriPermissions="true">
    <meta-data android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/haiyue_share_paths" />
</provider>
```

独立 provider 类避免与其他插件的 manifest 合并冲突。只给接收方临时 URI 读取权限，
不暴露 file:// 路径、不开放整个缓存目录。chooser 返回时不立即删除图片，避免接收方延迟读取失败；
下次图片分享时清理超过 24 小时的本功能缓存。应用退出会释放等待中的监听器。
系统回调不能证明发布成功，因此不要依赖返回值发放“分享成功奖励”。

## Web

使用 Web Share API，需要 HTTPS（本地开发可用 localhost）、用户点击及浏览器支持；
iframe 还可能受 `web-share` Permissions Policy 限制。缺少文件分享能力时返回 unsupported。
可用应用、图片/文字组合的接受方式由浏览器、操作系统和接收方决定。

## 验证

`node --test test/share.test.mjs` 验证三端流程与生命周期，但不能替代系统 UI 真机验收。
`node scripts/validation/prepare-share-web.mjs` 生成 `artifacts/share-web`，可用本地 HTTP 服务打开。
示例预先生成虚构数独战绩图，支持文字/图片系统分享以及显式下载。
Engine 战绩卡真机验收记录见 [2026-10-08 设备结果](evidence/device-content-2026-10-08.json)：
Android 和 iPhone 均已通过内容生成和分享 UI 生命周期。iPhone XCTest 验证图片/文字取消后立即重开、横屏、后台返回、关闭以及恢复后重新生成四种战绩卡。
独立 Native 验收宿主包含 Share text / Share image 按钮和 Android provider 配置，见仓库
`scripts/validation/README.md`。无需覆盖任何游戏安装或游戏存档。

平台依据：[Apple](https://developer.apple.com/documentation/uikit/uiactivityviewcontroller)、
[Android](https://developer.android.com/training/secure-file-sharing/share-file)、
[Web](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)。
