import Foundation
private let bridge = HYGameCenterBridge()
@_cdecl("hy_gc_abi") public func gcABI() -> Int32 { 1 }
@_cdecl("hy_gc_start") public func gcStart(_ bundle: UnsafePointer<CChar>) { bridge.start(String(cString: bundle)) }
@_cdecl("hy_gc_request") public func gcRequest(_ json: UnsafePointer<CChar>) -> Int32 { bridge.request(String(cString: json)) ? 1 : 0 }
private func copy(_ text: String, _ output: UnsafeMutablePointer<CChar>, _ capacity: Int32) -> Int32 {
    let bytes = text.utf8CString; guard bytes.count <= capacity else { return -1 }
    for i in bytes.indices { output[i] = bytes[i] }; return Int32(bytes.count - 1)
}
@_cdecl("hy_gc_session") public func gcSession(_ output: UnsafeMutablePointer<CChar>, _ capacity: Int32) -> Int32 { copy(bridge.session(), output, capacity) }
@_cdecl("hy_gc_poll") public func gcPoll(_ output: UnsafeMutablePointer<CChar>, _ capacity: Int32) -> Int32 { copy(bridge.poll(), output, capacity) }
@_cdecl("hy_gc_stop") public func gcStop() { bridge.stop() }
