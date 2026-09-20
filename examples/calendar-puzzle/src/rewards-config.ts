/** Official Google demo units. Replace both app IDs (native resources) and units before release.
 * The shared adapter refuses to request demo units in a Release build. */
export const CALENDAR_REWARDS = {
  dailyFree: 1,
  dailyAds: 2,
  iosUnit: 'ca-app-pub-3940256099942544/1712485313',
  androidUnit: 'ca-app-pub-3940256099942544/5224354917',
} as const;
