#pragma once

#include "HyaPcmMixer.hpp"
#include <atomic>
#include <memory>
#include <type_traits>

namespace haiyue::audio {

template<class Item, std::size_t Capacity> class SpscRing final {
  static_assert(Capacity > 0 && std::is_trivially_copyable<Item>::value, "SPSC records must own no resources");
  static_assert(std::atomic<std::uint32_t>::is_always_lock_free, "Audio queue requires lock-free indexes");
  std::array<Item, Capacity + 1> items_{};
  alignas(64) std::atomic<std::uint32_t> read_{0};
  alignas(64) std::atomic<std::uint32_t> write_{0};
  static std::uint32_t next(std::uint32_t index) noexcept {return static_cast<std::uint32_t>((index + 1) % (Capacity + 1));}
public:
  bool push(const Item& item) noexcept {
    const auto write = write_.load(std::memory_order_relaxed), following = next(write);
    if (following == read_.load(std::memory_order_acquire)) return false;
    items_[write] = item; write_.store(following, std::memory_order_release); return true;
  }
  bool pop(Item& item) noexcept {
    const auto read = read_.load(std::memory_order_relaxed);
    if (read == write_.load(std::memory_order_acquire)) return false;
    item = items_[read]; read_.store(next(read), std::memory_order_release); return true;
  }
};

// Exactly one serialized control producer and one non-overlapping audio callback consumer.
// PCM shared_ptrs are touched only on the control producer. Queue records carry borrowed views.
class PcmBridge final {
public:
  using Frame = PcmMixer::Frame;
  static constexpr std::size_t commandCapacity = 256;
  enum class Result {ok, invalid, capacity, duplicate, retired, closed};
  struct Completion {PcmMixer::Completion voice; Result status = Result::ok;};
  explicit PcmBridge(std::uint32_t sampleRate, std::uint32_t channels = 2) noexcept
    : mixer_(sampleRate,channels), channels_(channels) {
    for (auto& cancellation : cancellation_) cancellation.store(0,std::memory_order_relaxed);
  }

  // Producer only. owner must keep the complete immutable request.buffer.pcm view alive.
  Result start(const PcmMixer::Request& request, const std::shared_ptr<const void>& owner) noexcept {
    if (closing_.load(std::memory_order_acquire)) return Result::closed;
    if (!owner || !mixer_.validRequest(request)) return Result::invalid;
    if (findSlot(request.token)) return Result::duplicate;
    std::size_t index = 0; while (index < slots_.size() && slots_[index].token) ++index;
    if (index == slots_.size()) return Result::capacity;
    auto& slot = slots_[index]; slot.token = request.token; slot.owner = owner;
    cancellation_[index].store(0,std::memory_order_release);
    Command command; command.kind = Kind::start; command.request = request;
    if (!commands_.push(command)) {slot.owner.reset(); slot.token = 0; return Result::capacity;}
    return Result::ok;
  }
  Result setGain(Frame token, double gain, Frame at) noexcept {return automate(token,gain,at,Kind::gain);}
  Result setRate(Frame token, double rate, Frame at) noexcept {return automate(token,rate,at,Kind::rate);}
  Result stop(Frame token, Frame at) noexcept {
    if (closing_.load(std::memory_order_acquire)) return Result::closed;
    if (at > PcmMixer::maxFrame) return Result::invalid;
    if (!findSlot(token)) return Result::retired;
    Command command; command.kind = Kind::stop; command.token = token; command.at = at;
    return commands_.push(command) ? Result::ok : Result::capacity;
  }
  // Cancellation needs no command-ring slot. Keep the retained PCM until completion is acquired.
  Result release(Frame token) noexcept {
    auto* slot = findSlot(token); if (!slot) return Result::retired;
    cancellation_[static_cast<std::size_t>(slot - slots_.data())].store(token,std::memory_order_release); return Result::ok;
  }
  bool takeCompletion(Completion& completion) noexcept {
    if (!completions_.pop(completion)) return false;
    auto* slot = findSlot(completion.voice.token);
    if (!slot) {faults_.fetch_add(1,std::memory_order_relaxed); return false;}
    // The render thread has removed its last PCM reference before publishing this record.
    auto retired = std::move(slot->owner); slot->token = 0; retired.reset(); return true;
  }
  std::size_t reserved() const noexcept {std::size_t count = 0; for (const auto& slot : slots_) if (slot.token) ++count; return count;}
  Frame now() const noexcept {return clock_.load(std::memory_order_acquire);}
  std::uint32_t reservedEvents() const noexcept {return eventReservations_.load(std::memory_order_acquire);}
  std::uint32_t faults() const noexcept {return faults_.load(std::memory_order_acquire);}
  bool closing() const noexcept {return closing_.load(std::memory_order_acquire);}
  void close() noexcept {closing_.store(true,std::memory_order_release);}
  // Hardware suspension is reversible. Seal access, wait for the last callback, then service
  // cancellation/completion on the producer without advancing samples or releasing peer voices.
  bool suspendRender() noexcept {
    if (closing()) return false;
    renderGate_.fetch_or(sealedBit,std::memory_order_acq_rel); return true;
  }
  bool serviceSuspended() noexcept {
    if (closing() || !renderQuiescent()) return false;
    drain(); collect(); clock_.store(mixer_.now(),std::memory_order_release); return true;
  }
  bool resumeRender() noexcept {
    if (closing()) return false;
    auto access = renderGate_.load(std::memory_order_acquire);
    if (!(access & sealedBit)) return true;
    if (access != sealedBit) return false;
    return renderGate_.compare_exchange_strong(access,0,std::memory_order_acq_rel,std::memory_order_acquire);
  }
  // Prevent all future callbacks from entering the mutable mixer. Existing callback drains normally.
  void sealRender() noexcept {close(); renderGate_.fetch_or(sealedBit,std::memory_order_acq_rel);}
  bool renderQuiescent() const noexcept {return renderGate_.load(std::memory_order_acquire) == sealedBit;}
  bool rendering() const noexcept {return (renderGate_.load(std::memory_order_acquire) & 1U) != 0;}

  // Consumer only. No allocation, resource destruction, lock, JS/host callback or unbounded drain.
  bool render(float* interleaved, std::size_t frames) noexcept {
    if (!mixer_.valid() || !interleaved || frames > PcmMixer::maxFrame
        || frames > std::numeric_limits<std::size_t>::max() / channels_) return false;
    auto access = renderGate_.load(std::memory_order_acquire);
    do {
      if (access & sealedBit) {for (std::size_t i = 0; i < frames * channels_; ++i) interleaved[i] = 0; return true;}
      if (access & 1U) {faults_.fetch_add(1,std::memory_order_relaxed); return false;}
    } while (!renderGate_.compare_exchange_weak(access,access+1,std::memory_order_acq_rel,std::memory_order_acquire));
    struct Leave {std::atomic<std::uint32_t>& gate; ~Leave() {gate.fetch_sub(1,std::memory_order_release);}} leave{renderGate_};
    if (frames > PcmMixer::maxFrame - mixer_.now()) return false;
    drain();
    if (closing_.load(std::memory_order_acquire)) {
      releaseAll(); for (std::size_t i = 0; i < frames * channels_; ++i) interleaved[i] = 0;
    } else {
      const auto pending = mixer_.pendingEvents();
      if (!mixer_.render(interleaved,frames)) return false;
      giveBackEvents(pending - mixer_.pendingEvents());
    }
    collect(); clock_.store(mixer_.now(),std::memory_order_release); return true;
  }
  // Producer only after sealRender(). False means an earlier callback is still using the mixer;
  // retry from the control thread. Later sealed callbacks only zero output and do not access it.
  // The platform still must stop/join its callbacks before destroying the bridge object itself.
  bool finalizeAfterRenderStopped() noexcept {
    if (!closing() || !renderQuiescent()) return false;
    drain(); releaseAll(); collect(); clock_.store(mixer_.now(),std::memory_order_release); return true;
  }

private:
  static_assert(std::atomic<Frame>::is_always_lock_free && std::atomic<bool>::is_always_lock_free, "Audio bridge requires lock-free publication");
  enum class Kind {start, gain, rate, stop};
  struct Command {Kind kind = Kind::stop; PcmMixer::Request request; Frame token = 0, at = 0; double value = 0;};
  struct Slot {Frame token = 0; std::shared_ptr<const void> owner;};
  PcmMixer mixer_; const std::uint32_t channels_;
  static constexpr std::uint32_t sealedBit = 1U << 31U;
  std::atomic<std::uint32_t> renderGate_{0};
  std::array<Slot,PcmMixer::maxVoices> slots_{}; // Producer only; never read by callback.
  std::array<std::atomic<Frame>,PcmMixer::maxVoices> cancellation_{};
  SpscRing<Command,commandCapacity> commands_;
  SpscRing<Completion,PcmMixer::maxVoices> completions_;
  std::atomic<Frame> clock_{0}; std::atomic<std::uint32_t> eventReservations_{0},faults_{0}; std::atomic<bool> closing_{false};
  Slot* findSlot(Frame token) noexcept {if (!token) return nullptr; for (auto& slot : slots_) if (slot.token == token) return &slot; return nullptr;}
  Result automate(Frame token, double value, Frame at, Kind kind) noexcept {
    if (closing()) return Result::closed;
    if (at > PcmMixer::maxFrame || !std::isfinite(value) || (kind == Kind::gain ? value < 0 : value < .0625 || value > 16)) return Result::invalid;
    if (!findSlot(token)) return Result::retired;
    auto count = eventReservations_.load(std::memory_order_acquire);
    do {if (count >= PcmMixer::maxEvents) return Result::capacity;}
    while (!eventReservations_.compare_exchange_weak(count,count+1,std::memory_order_acq_rel,std::memory_order_acquire));
    Command command; command.kind = kind; command.token = token; command.at = at; command.value = value;
    if (!commands_.push(command)) {giveBackEvents(1); return Result::capacity;} return Result::ok;
  }
  void giveBackEvents(std::size_t count) noexcept {
    if (!count) return;
    const auto previous = eventReservations_.fetch_sub(static_cast<std::uint32_t>(count),std::memory_order_acq_rel);
    if (previous < count) faults_.fetch_add(1,std::memory_order_relaxed);
  }
  void releaseAll() noexcept {const auto before = mixer_.pendingEvents(); mixer_.releaseAll(); giveBackEvents(before - mixer_.pendingEvents());}
  void drain() noexcept {
    Command command;
    for (std::size_t i = 0; i < commandCapacity && commands_.pop(command); ++i) {
      const auto before = mixer_.pendingEvents(); PcmMixer::Result result = PcmMixer::Result::ok;
      switch (command.kind) {
        case Kind::start:
          result = mixer_.start(command.request);
          if (result != PcmMixer::Result::ok) {
            faults_.fetch_add(1,std::memory_order_relaxed);
            publish({{command.request.token,mixer_.now(),PcmMixer::End::released},Result::invalid});
          }
          break;
        case Kind::gain: result = mixer_.setGain(command.token,command.value,command.at); break;
        case Kind::rate: result = mixer_.setRate(command.token,command.value,command.at); break;
        case Kind::stop: result = mixer_.stop(command.token,command.at); break;
      }
      const auto addedReservation = command.kind == Kind::gain || command.kind == Kind::rate ? 1U : 0U;
      giveBackEvents(before + addedReservation - mixer_.pendingEvents());
      if (result != PcmMixer::Result::ok && result != PcmMixer::Result::retired && command.kind != Kind::start) faults_.fetch_add(1,std::memory_order_relaxed);
    }
    for (auto& cancellation : cancellation_) {
      const auto token = cancellation.load(std::memory_order_acquire); if (!token) continue;
      const auto before = mixer_.pendingEvents(); mixer_.release(token); giveBackEvents(before - mixer_.pendingEvents());
    }
  }
  void publish(const Completion& completion) noexcept {if (!completions_.push(completion)) faults_.fetch_add(1,std::memory_order_relaxed);}
  void collect() noexcept {PcmMixer::Completion completion; for (std::size_t i = 0; i < PcmMixer::maxVoices && mixer_.takeCompletion(completion); ++i) publish({completion,Result::ok});}
};
} // namespace haiyue::audio
