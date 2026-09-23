/** iOS production rewarded unit; Android release configuration is deferred.
 * Development builds force Google demo units in the shared adapter. */
export const CALENDAR_REWARDS = {
  dailyFree: 1,
  dailyAds: 2,
  iosUnit: 'ca-app-pub-2053256758816744/9110868483',
  androidUnit: 'ca-app-pub-3940256099942544/5224354917',
} as const;
