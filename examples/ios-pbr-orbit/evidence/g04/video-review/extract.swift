import Foundation
import AVFoundation
import AppKit

let source = URL(fileURLWithPath: CommandLine.arguments[1])
let out = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
let asset = AVURLAsset(url: source)
let duration = CMTimeGetSeconds(asset.duration)
let tracks = asset.tracks(withMediaType: .video)
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero
generator.maximumSize = CGSize(width: 480, height: 1000)
let interval = Double(CommandLine.arguments.count > 3 ? CommandLine.arguments[3] : "2")!
let start = Double(CommandLine.arguments.count > 4 ? CommandLine.arguments[4] : "0")!
let end = min(duration, Double(CommandLine.arguments.count > 5 ? CommandLine.arguments[5] : String(duration))!)
var metadata: [String: Any] = ["durationSeconds": duration, "intervalSeconds": interval, "start": start, "end": end]
metadata["tracks"] = tracks.map { ["width": $0.naturalSize.width, "height": $0.naturalSize.height, "nominalFrameRate": $0.nominalFrameRate] }
metadata["creationDate"] = asset.creationDate?.stringValue
try JSONSerialization.data(withJSONObject: metadata, options: [.prettyPrinted, .sortedKeys]).write(to: out.appendingPathComponent("metadata.json"))
print(String(data: try JSONSerialization.data(withJSONObject: metadata), encoding: .utf8)!)
let tileW = 240, tileH = 545, cols = 6, rows = 4
var sheet: NSImage? = nil
var index = 0
for seconds in stride(from: start, to: end, by: interval) {
    if index % (cols * rows) == 0 {
        sheet = NSImage(size: NSSize(width: cols * tileW, height: rows * tileH))
        sheet!.lockFocus()
        NSColor.darkGray.setFill()
        NSRect(x: 0, y: 0, width: cols * tileW, height: rows * tileH).fill()
        sheet!.unlockFocus()
    }
    let cg = try generator.copyCGImage(at: CMTime(seconds: seconds, preferredTimescale: 600), actualTime: nil)
    let image = NSImage(cgImage: cg, size: NSSize(width: cg.width, height: cg.height))
    let cell = index % (cols * rows), x = (cell % cols) * tileW, y = (rows - 1 - cell / cols) * tileH
    sheet!.lockFocus()
    let scale = min(Double(tileW) / Double(cg.width), Double(tileH - 25) / Double(cg.height))
    image.draw(in: NSRect(x: Double(x), y: Double(y + 25), width: Double(cg.width) * scale, height: Double(cg.height) * scale))
    (String(format: "%.2f s", seconds) as NSString).draw(at: NSPoint(x: x + 4, y: y + 3), withAttributes: [.font: NSFont.monospacedSystemFont(ofSize: 16, weight: .medium), .foregroundColor: NSColor.white])
    sheet!.unlockFocus()
    index += 1
    if index % (cols * rows) == 0 || seconds + interval >= end {
        let bitmap = NSBitmapImageRep(data: sheet!.tiffRepresentation!)!
        let path = out.appendingPathComponent(String(format: "sheet-%03d.jpg", (index - 1) / (cols * rows)))
        try bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.85])!.write(to: path)
        print(path.path)
    }
}
