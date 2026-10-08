import Foundation

/// Conservative ATT eligibility after a European CMP choice. This is not an ad
/// serving decision: UMP and GMA remain responsible for the applicable TCF mode.
enum HYTrackingConsent {
    static func permitsPrompt(purposes: String?, vendors: String?,
                              legitimatePurposes: String? = nil, legitimateVendors: String? = nil) -> Bool {
        func consent(_ bits: String?, _ index: Int) -> Bool {
            guard let bits, bits.allSatisfy({ $0 == "0" || $0 == "1" }), bits.count >= index else { return false }
            return bits[bits.index(bits.startIndex, offsetBy: index - 1)] == "1"
        }
        // Google declares purpose 7 under legitimate interest by default (GVL 755).
        // A user objection must block that route too. ATT remains a separate opt-in.
        let measurement = consent(purposes, 7)
            || (consent(legitimatePurposes, 7) && consent(legitimateVendors, 755))
        return consent(purposes, 1) && consent(vendors, 755) && measurement
    }
}
