// ABI v1. Built against a developer-supplied Steamworks SDK; never vendor SDK headers.
// The host exclusively owns SteamAPI_Init/RunCallbacks/Shutdown and all StoreStats calls.
#include <steam/steam_api.h>
#include <algorithm>
#include <cstdint>
#if defined(_WIN32)
#define HY_API extern "C" __declspec(dllexport)
#else
#define HY_API extern "C" __attribute__((visibility("default")))
#endif
static bool active = false;
static uint64 player = 0, epoch = 0, pendingEpoch = 0, pendingPlayer = 0;
static uint32 app = 0;
// 0 idle, 1 waiting, 2 success, negative = EResult / identity failure.
static int completion = 0;
static void refresh() {
  const uint64 next = active && SteamUser() ? SteamUser()->GetSteamID().ConvertToUint64() : 0;
  if (next != player) { player = next; ++epoch; }
}
static bool guard(uint64 expected) {
  refresh(); return active && expected && expected == player && SteamUser()->BLoggedOn();
}
class Callbacks {
  STEAM_CALLBACK(Callbacks, stored, UserStatsStored_t);
public:
  Callbacks() : m_Callbackstored(this, &Callbacks::stored) {}
};
void Callbacks::stored(UserStatsStored_t *event) {
  if (completion != 1 || event->m_nGameID != app) return;
  refresh();
  completion = pendingEpoch != epoch || pendingPlayer != player ? -10001 :
    (event->m_eResult == k_EResultOK ? 2 : -static_cast<int>(event->m_eResult));
}
static Callbacks *callbacks = nullptr;
HY_API int hy_steam_abi() { return 1; }
HY_API int hy_steam_init(uint32 expectedApp) {
  if (active) return -2;
  if (!SteamAPI_Init()) return 0;
  if (!SteamUtils() || SteamUtils()->GetAppID() != expectedApp || !SteamUserStats()) { SteamAPI_Shutdown(); return -3; }
  active = true; app = expectedApp; completion = 0; callbacks = new Callbacks(); refresh(); return 1;
}
HY_API void hy_steam_pump() { if (active) { refresh(); SteamAPI_RunCallbacks(); refresh(); } }
HY_API uint64 hy_steam_player() { refresh(); return player; }
HY_API int hy_steam_online() { return active && SteamUser()->BLoggedOn() ? 1 : 0; }
HY_API int hy_steam_achievement(uint64 expected, const char *id) {
  if (!guard(expected)) return -2;
  bool unlocked = false;
  if (!SteamUserStats()->GetAchievement(id, &unlocked)) return -1;
  return unlocked ? 1 : 0;
}
HY_API int hy_steam_stat(uint64 expected, const char *id, int32 *value) {
  if (!guard(expected)) return -2;
  return SteamUserStats()->GetStat(id, value) ? 1 : -1;
}
HY_API int hy_steam_set(uint64 expected, const char *id, const char *stat, int32 value, int unlock) {
  if (!guard(expected)) return -2;
  if (completion != 0) return -3;
  if (*stat) {
    int32 current = 0;
    if (!SteamUserStats()->GetStat(stat, &current) || !SteamUserStats()->SetStat(stat, std::max(current, value))) return -1;
  }
  if (unlock && !SteamUserStats()->SetAchievement(id)) return -1;
  return 1;
}
HY_API int hy_steam_store(uint64 expected) {
  if (!guard(expected)) return -2;
  if (completion != 0) return -3;
  pendingEpoch = epoch; pendingPlayer = player; completion = 1;
  if (!SteamUserStats()->StoreStats()) { completion = 0; return -1; }
  return 1;
}
// A timed-out request stays quarantined until its real callback arrives. Never reuse its slot.
HY_API int hy_steam_completion() { const int result = completion; if (completion != 1) completion = 0; return result; }
HY_API void hy_steam_shutdown() {
  if (!active) return;
  delete callbacks; callbacks = nullptr; SteamAPI_Shutdown(); active = false; player = 0; ++epoch; completion = 0;
}
