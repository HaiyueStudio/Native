import Foundation
let google = String(repeating: "0", count: 754) + "1"
precondition(HYTrackingConsent.permitsPrompt(purposes: "1000001", vendors: google))
for purposes: String? in [nil, "", "0000000", "1000000", "0000001", "100000x"] {
 precondition(!HYTrackingConsent.permitsPrompt(purposes: purposes, vendors: google))
}
for vendors: String? in [nil, "", "1", String(repeating: "0", count: 755)] {
 precondition(!HYTrackingConsent.permitsPrompt(purposes: "1000001", vendors: vendors))
}
print("TCF ATT eligibility: allow, reject, partial, malformed and missing consent passed")
// Google's default measurement legal basis is LI, not a purpose-7 consent bit.
precondition(HYTrackingConsent.permitsPrompt(purposes: "1000000", vendors: google, legitimatePurposes: "0000001", legitimateVendors: google))
precondition(!HYTrackingConsent.permitsPrompt(purposes: "0000000", vendors: google, legitimatePurposes: "0000001", legitimateVendors: google))
precondition(!HYTrackingConsent.permitsPrompt(purposes: "1000000", vendors: google, legitimatePurposes: "0000000", legitimateVendors: google))
precondition(!HYTrackingConsent.permitsPrompt(purposes: "1000000", vendors: google, legitimatePurposes: "0000001", legitimateVendors: "0"))
