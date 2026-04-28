// Regulated/high-stakes brands phishers love to impersonate over email.
// Two heuristics consume this list:
//
//   1. Display-name spoof: if the From header's display name mentions one
//      of these brands but the From host is not the brand's own domain,
//      we flag conclusively. Legit brand mail comes from brand-owned
//      domains.
//
//   2. Free-email impersonation: if the From host is a personal email
//      provider (gmail.com, yahoo.com, ...) AND the display name or
//      subject mentions one of these brands, we flag inconclusively. This
//      is a softer signal because it can fire on legitimate forwards.
//
// Per the project owner's call: lean broad. False positives just escalate
// to AI for a final call, so over-firing here is cheap.
//
// Matching uses word-boundary case-insensitive substring on `humanName`,
// not the domain — phishers spoof "PayPal" in display headers, not the
// literal string "paypal.com". `domain` is what we compare the From host
// against to decide if it really belongs to the brand.

export type BrandCategory =
  | "bank"
  | "payment"
  | "crypto-brokerage"
  | "government"
  | "carrier"
  | "cloud-identity"
  | "hr-tax";

export interface RegulatedBrand {
  humanName: string;
  domain: string;
  category: BrandCategory;
}

export const REGULATED_BRANDS: readonly RegulatedBrand[] = [
  // Banks
  { humanName: "Chase", domain: "chase.com", category: "bank" },
  { humanName: "Bank of America", domain: "bankofamerica.com", category: "bank" },
  { humanName: "Wells Fargo", domain: "wellsfargo.com", category: "bank" },
  { humanName: "Citi", domain: "citi.com", category: "bank" },
  { humanName: "Citibank", domain: "citibank.com", category: "bank" },
  { humanName: "Capital One", domain: "capitalone.com", category: "bank" },
  { humanName: "US Bank", domain: "usbank.com", category: "bank" },
  { humanName: "PNC", domain: "pnc.com", category: "bank" },

  // Payment / money movement
  { humanName: "PayPal", domain: "paypal.com", category: "payment" },
  { humanName: "Venmo", domain: "venmo.com", category: "payment" },
  { humanName: "Cash App", domain: "cash.app", category: "payment" },
  { humanName: "Zelle", domain: "zellepay.com", category: "payment" },
  { humanName: "Stripe", domain: "stripe.com", category: "payment" },

  // Crypto / brokerage
  { humanName: "Coinbase", domain: "coinbase.com", category: "crypto-brokerage" },
  { humanName: "Binance", domain: "binance.com", category: "crypto-brokerage" },
  { humanName: "Robinhood", domain: "robinhood.com", category: "crypto-brokerage" },

  // Government / public services
  { humanName: "IRS", domain: "irs.gov", category: "government" },
  { humanName: "Social Security Administration", domain: "ssa.gov", category: "government" },
  { humanName: "Medicare", domain: "medicare.gov", category: "government" },
  { humanName: "USPS", domain: "usps.com", category: "government" },

  // Shipping / delivery (fake-delivery scams are massive)
  { humanName: "UPS", domain: "ups.com", category: "carrier" },
  { humanName: "FedEx", domain: "fedex.com", category: "carrier" },
  { humanName: "DHL", domain: "dhl.com", category: "carrier" },
  { humanName: "Amazon", domain: "amazon.com", category: "carrier" },

  // Cloud / identity (credential phishing targets)
  { humanName: "Microsoft", domain: "microsoft.com", category: "cloud-identity" },
  { humanName: "Google", domain: "google.com", category: "cloud-identity" },
  { humanName: "Apple", domain: "apple.com", category: "cloud-identity" },
  { humanName: "iCloud", domain: "icloud.com", category: "cloud-identity" },
  { humanName: "Adobe", domain: "adobe.com", category: "cloud-identity" },
  { humanName: "DocuSign", domain: "docusign.com", category: "cloud-identity" },
  { humanName: "Dropbox", domain: "dropbox.com", category: "cloud-identity" },
  { humanName: "OneDrive", domain: "microsoft.com", category: "cloud-identity" },
  { humanName: "Google Drive", domain: "google.com", category: "cloud-identity" },

  // HR / tax (W-2 / payroll scams)
  { humanName: "ADP", domain: "adp.com", category: "hr-tax" },
  { humanName: "Workday", domain: "workday.com", category: "hr-tax" },
  { humanName: "TurboTax", domain: "turbotax.com", category: "hr-tax" },
  { humanName: "H&R Block", domain: "hrblock.com", category: "hr-tax" },
];

// Personal email providers. A sender on one of these CAN'T be a real
// regulated brand — banks don't send from gmail.com. Used by the
// free-email-impersonation heuristic.
export const FREE_EMAIL_PROVIDERS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "rocketmail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "yandex.com",
  "yandex.ru",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "tutanota.com",
  "zoho.com",
]);
