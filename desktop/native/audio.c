/* MIT. One owned audio engine; callbacks and audio mixing never enter JavaScript. */
#define MINIAUDIO_IMPLEMENTATION
#include "miniaudio.h"
#if defined(_WIN32)
#define HY_EXPORT __declspec(dllexport)
#else
#define HY_EXPORT __attribute__((visibility("default")))
#endif
static ma_engine engine;
static int initialized = 0;
HY_EXPORT int haiyue_audio_version(void) { return 1; }
HY_EXPORT int haiyue_audio_init(void) {
    if (initialized) return MA_INVALID_OPERATION;
    int result = ma_engine_init(NULL, &engine);
    if (result == MA_SUCCESS) initialized = 1;
    return result;
}
HY_EXPORT int haiyue_audio_play(const char* path) {
    if (!initialized || !path) return MA_INVALID_OPERATION;
    return ma_engine_play_sound(&engine, path, NULL);
}
HY_EXPORT int haiyue_audio_pause(void) { return initialized ? ma_engine_stop(&engine) : MA_INVALID_OPERATION; }
HY_EXPORT int haiyue_audio_resume(void) { return initialized ? ma_engine_start(&engine) : MA_INVALID_OPERATION; }
HY_EXPORT void haiyue_audio_dispose(void) {
    if (initialized) { ma_engine_uninit(&engine); initialized = 0; }
}
