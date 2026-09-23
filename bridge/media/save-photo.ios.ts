/** Add-only permission is requested on export, never when the application starts. */
export async function savePhoto(canvas: HTMLCanvasElement, _filename: string): Promise<'photos'> {
  const status = await new Promise<PHAuthorizationStatus>(resolve =>
    PHPhotoLibrary.requestAuthorizationForAccessLevelHandler(PHAccessLevel.AddOnly, resolve));
  if (status !== PHAuthorizationStatus.Authorized && status !== PHAuthorizationStatus.Limited)
    throw Error('Photo permission denied');
  const encoded = canvas.toDataURL('image/png').split(',')[1];
  if (!encoded) throw Error('PNG encoding failed');
  const data = NSData.alloc().initWithBase64EncodedStringOptions(encoded, NSDataBase64DecodingOptions.IgnoreUnknownCharacters);
  const image = data && UIImage.imageWithData(data);
  if (!image) throw Error('Cannot decode photo');
  await new Promise<void>((resolve, reject) => {
    PHPhotoLibrary.sharedPhotoLibrary().performChangesCompletionHandler(
      () => { PHAssetChangeRequest.creationRequestForAssetFromImage(image); },
      (success, error) => success ? resolve() : reject(Error(error?.localizedDescription ?? 'Cannot save photo')),
    );
  });
  return 'photos';
}
