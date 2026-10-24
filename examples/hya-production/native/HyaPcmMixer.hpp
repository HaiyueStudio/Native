#pragma once

#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <limits>

namespace haiyue::audio {

// Render-thread kernel only. A platform bridge must serialize commands onto that thread and
// retain borrowed PCM until takeCompletion(). No allocation, locks, timers, JS or OS audio calls.
class PcmMixer final {
public:
  using Frame = std::uint64_t;
  static constexpr Frame maxFrame = 9007199254740991ULL;
  static constexpr Frame noStop = std::numeric_limits<Frame>::max();
  static constexpr std::size_t maxVoices = 64, maxEvents = 512;
  struct Buffer {const float* pcm = nullptr; Frame frames = 0; std::uint32_t channels = 0, sampleRate = 0;};
  struct Request {
    Frame token = 0; Buffer buffer; Frame start = 0, offset = 0, stop = noStop;
    double gain = 1, rate = 1; bool loop = false; Frame loopStart = 0, loopEnd = 0;
  };
  enum class Result {ok, invalid, capacity, duplicate, retired};
  enum class End {natural, stopped, released};
  struct Completion {Frame token = 0, frame = 0; End reason = End::natural;};

  explicit PcmMixer(std::uint32_t sampleRate, std::uint32_t channels = 2) noexcept
    : sampleRate_(sampleRate), channels_(channels) {}
  Frame now() const noexcept {return clock_;}
  std::size_t reserved() const noexcept {
    std::size_t count = 0; for (const auto& voice : voices_) if (voice.state != State::free) ++count; return count;
  }
  std::size_t pendingEvents() const noexcept {return eventCount_;}
  bool valid() const noexcept {return sampleRate_ > 0 && sampleRate_ <= 384000 && (channels_ == 1 || channels_ == 2);}

  // Reads immutable configuration and the request only; safe for the serialized control producer.
  bool validRequest(const Request& request) const noexcept {
    const auto& buffer = request.buffer;
    if (!valid() || !request.token || request.token > maxFrame || !buffer.pcm || !buffer.frames || buffer.frames > maxFrame
        || (buffer.channels != 1 && buffer.channels != 2) || !buffer.sampleRate || buffer.sampleRate > 384000
        || buffer.frames > std::numeric_limits<std::size_t>::max() / buffer.channels
        || request.start > maxFrame || request.offset >= buffer.frames
        || (request.stop != noStop && (request.stop > maxFrame || request.stop < request.start))
        || !validGain(request.gain) || !validRate(request.rate)
        || (request.loop && (request.loopStart >= request.loopEnd || request.loopEnd > buffer.frames))) return false;
    return true;
  }
  Result start(const Request& request) noexcept {
    if (!validRequest(request)) return Result::invalid;
    if (find(request.token)) return Result::duplicate;
    Voice* target = nullptr;
    for (auto& voice : voices_) if (voice.state == State::free) {target = &voice; break;}
    if (!target) return Result::capacity;
    *target = Voice{}; target->state = State::pending; target->request = request;
    // A late host call starts immediately at its declared source offset. The HYA owner has
    // already applied its late-decode policy; do not apply an extra catch-up here.
    target->request.start = request.start < clock_ ? clock_ : request.start;
    target->position = static_cast<double>(request.offset);
    target->gain = request.gain; target->rate = request.rate; target->sequence = ++sequence_;
    return Result::ok;
  }
  Result setGain(Frame token, double value, Frame at) noexcept {return automate(token, value, at, Kind::gain);}
  Result setRate(Frame token, double value, Frame at) noexcept {return automate(token, value, at, Kind::rate);}
  Result stop(Frame token, Frame at) noexcept {
    if (at > maxFrame) return Result::invalid;
    auto* voice = find(token); if (!live(voice)) return Result::retired;
    voice->request.stop = at; return Result::ok;
  }
  Result release(Frame token) noexcept {
    auto* voice = find(token); if (!live(voice)) return Result::retired;
    finish(*voice, clock_, End::released); return Result::ok;
  }
  void releaseAll() noexcept {for (auto& voice : voices_) if (live(&voice)) finish(voice, clock_, End::released);}
  bool takeCompletion(Completion& completion) noexcept {
    Voice* first = nullptr;
    for (auto& voice : voices_) if (voice.state == State::ended
        && (!first || voice.completion.frame < first->completion.frame
        || (voice.completion.frame == first->completion.frame && voice.sequence < first->sequence))) first = &voice;
    if (!first) return false;
    completion = first->completion; *first = Voice{}; return true;
  }

  bool render(float* interleaved, std::size_t frames) noexcept {
    if (!valid() || !interleaved || frames > maxFrame - clock_
        || frames > std::numeric_limits<std::size_t>::max() / channels_) return false;
    for (std::size_t frame = 0; frame < frames; ++frame, ++clock_) {
      for (std::uint32_t channel = 0; channel < channels_; ++channel) interleaved[frame * channels_ + channel] = 0;
      while (eventCount_ && events_[0].at <= clock_) {
        const auto event = events_[0]; eraseEvent(0);
        if (auto* voice = find(event.token); live(voice)) {
          if (event.kind == Kind::gain) voice->gain = event.value; else voice->rate = event.value;
        }
      }
      for (auto& voice : voices_) {
        if (!live(&voice)) continue;
        if (voice.request.stop <= clock_) {finish(voice, clock_, End::stopped); continue;}
        if (voice.request.start > clock_) continue;
        voice.state = State::playing;
        const auto& request = voice.request;
        if (request.loop && voice.position >= static_cast<double>(request.loopEnd))
          voice.position = static_cast<double>(request.loopStart) + std::fmod(voice.position - static_cast<double>(request.loopStart), static_cast<double>(request.loopEnd - request.loopStart));
        if (voice.position >= static_cast<double>(request.buffer.frames)) {finish(voice, clock_, End::natural); continue;}
        const auto index = static_cast<Frame>(voice.position); const double fraction = voice.position - static_cast<double>(index);
        Frame next = index + 1;
        if (request.loop && next >= request.loopEnd) next = request.loopStart;
        for (std::uint32_t channel = 0; channel < channels_; ++channel) {
          const double a = sample(request.buffer, index, channel), b = sample(request.buffer, next, channel);
          interleaved[frame * channels_ + channel] += static_cast<float>((a + (b - a) * fraction) * voice.gain);
        }
        voice.position += voice.rate * static_cast<double>(request.buffer.sampleRate) / sampleRate_;
        if (request.stop <= clock_ + 1) finish(voice, clock_ + 1, End::stopped);
        else if (!request.loop && voice.position >= static_cast<double>(request.buffer.frames)) finish(voice, clock_ + 1, End::natural);
      }
    }
    return true;
  }

private:
  enum class State {free, pending, playing, ended};
  enum class Kind {gain, rate};
  struct Voice {
    State state = State::free; Request request; double position = 0, gain = 1, rate = 1;
    Frame sequence = 0; Completion completion;
  };
  struct Event {Frame token = 0, at = 0; double value = 0; Kind kind = Kind::gain;};
  const std::uint32_t sampleRate_, channels_; Frame clock_ = 0, sequence_ = 0;
  std::array<Voice, maxVoices> voices_{}; std::array<Event, maxEvents> events_{}; std::size_t eventCount_ = 0;
  static bool validGain(double value) noexcept {return std::isfinite(value) && value >= 0;}
  static bool validRate(double value) noexcept {return std::isfinite(value) && value >= .0625 && value <= 16;}
  static bool live(const Voice* voice) noexcept {return voice && (voice->state == State::pending || voice->state == State::playing);}
  Voice* find(Frame token) noexcept {for (auto& voice : voices_) if (voice.state != State::free && voice.request.token == token) return &voice; return nullptr;}
  void eraseEvent(std::size_t index) noexcept {for (std::size_t i = index + 1; i < eventCount_; ++i) events_[i - 1] = events_[i]; --eventCount_;}
  void finish(Voice& voice, Frame at, End reason) noexcept {
    const auto token = voice.request.token; voice.state = State::ended; voice.completion = {token, at, reason};
    for (std::size_t i = 0; i < eventCount_;) {if (events_[i].token == token) eraseEvent(i); else ++i;}
    // Completion retains the token/slot. The caller keeps PCM alive until it takes that completion.
    voice.request.buffer = Buffer{};
  }
  Result automate(Frame token, double value, Frame at, Kind kind) noexcept {
    if (at > maxFrame || (kind == Kind::gain ? !validGain(value) : !validRate(value))) return Result::invalid;
    if (!live(find(token))) return Result::retired;
    std::size_t replaced = 0;
    for (std::size_t i = 0; i < eventCount_; ++i) if (events_[i].token == token && events_[i].kind == kind && events_[i].at >= at) ++replaced;
    if (eventCount_ - replaced >= maxEvents) return Result::capacity;
    for (std::size_t i = 0; i < eventCount_;) {
      if (events_[i].token == token && events_[i].kind == kind && events_[i].at >= at) eraseEvent(i); else ++i;
    }
    std::size_t insert = 0; while (insert < eventCount_ && events_[insert].at <= at) ++insert;
    for (std::size_t i = eventCount_; i > insert; --i) events_[i] = events_[i - 1];
    events_[insert] = {token, at, value, kind}; ++eventCount_; return Result::ok;
  }
  double sample(const Buffer& buffer, Frame frame, std::uint32_t outputChannel) const noexcept {
    if (frame >= buffer.frames) return 0;
    const auto index = static_cast<std::size_t>(frame) * buffer.channels;
    if (buffer.channels == 1) return buffer.pcm[index];
    if (channels_ == 1) return (static_cast<double>(buffer.pcm[index]) + buffer.pcm[index + 1]) * .5;
    return buffer.pcm[index + outputChannel];
  }
};
} // namespace haiyue::audio
