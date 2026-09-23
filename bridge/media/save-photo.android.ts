import { Application } from '@nativescript/core';

async function legacyPermission(): Promise<void> {
  const activity = Application.android.foregroundActivity ?? Application.android.startActivity;
  const permission = android.Manifest.permission.WRITE_EXTERNAL_STORAGE;
  if (!activity || activity.checkSelfPermission(permission) === android.content.pm.PackageManager.PERMISSION_GRANTED) {
    if (!activity) throw Error('No active activity');
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const requestCode = 7042;
    const listener = (args: { requestCode: number; grantResults: number[] }) => {
      if (args.requestCode !== requestCode) return;
      Application.android.off(Application.android.activityRequestPermissionsEvent, listener);
      if (args.grantResults[0] === android.content.pm.PackageManager.PERMISSION_GRANTED) resolve();
      else reject(Error('Photo permission denied'));
    };
    Application.android.on(Application.android.activityRequestPermissionsEvent, listener);
    activity.requestPermissions([permission], requestCode);
  });
}

/** Save only the image requested by the player; scoped storage needs no library access. */
export async function savePhoto(canvas: HTMLCanvasElement, filename: string): Promise<'photos'> {
  const scoped = android.os.Build.VERSION.SDK_INT >= 29;
  if (!scoped) await legacyPermission();
  const data = canvas.toDataURL('image/png').split(',')[1];
  if (!data) throw Error('PNG encoding failed');
  const bytes = android.util.Base64.decode(data, android.util.Base64.DEFAULT);
  const resolver = Application.android.context.getContentResolver();
  const values = new android.content.ContentValues();
  values.put('_display_name', filename); values.put('mime_type', 'image/png');
  if (scoped) { values.put('relative_path', 'Pictures/Haiyue'); values.put('is_pending', java.lang.Integer.valueOf(1)); }
  const uri = resolver.insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
  if (!uri) throw Error('Cannot create photo');
  try {
    const stream = resolver.openOutputStream(uri);
    if (!stream) throw Error('Cannot open photo');
    try { stream.write(bytes); } finally { stream.close(); }
    if (scoped) {
      const complete = new android.content.ContentValues(); complete.put('is_pending', java.lang.Integer.valueOf(0));
      if (resolver.update(uri, complete, '', []) !== 1) throw Error('Cannot publish photo');
    }
    return 'photos';
  } catch (error) {
    resolver.delete(uri, '', []);
    throw error;
  }
}
