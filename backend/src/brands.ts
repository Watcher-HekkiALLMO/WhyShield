// Canonical domains for the top brands phishing kits like to impersonate.
// Used by the typosquat heuristic: any host within edit-distance 1 of one
// of these domains (after homoglyph normalization) is flagged as a likely
// typosquat.
//
// To add a brand: append the canonical eTLD+1 (or eTLD+2 for things like
// "cash.app" or ".co.uk"). Subdomain matters only when a brand is famously
// associated with one (e.g. "drive.google.com") — in those cases prefer
// the parent domain so we catch typos of either.
//
// Future work: cryptocurrency wallet keywords ("bitcoin", "wallet",
// "metamask") don't fit this list cleanly. They will get their own
// keyword-based heuristic in a later iteration.

export const BRAND_DOMAINS: readonly string[] = [
  // Payments / banks
  "paypal.com",
  "chase.com",
  "bankofamerica.com",
  "wellsfargo.com",
  "citi.com",
  "citibank.com",
  "venmo.com",
  "cash.app",
  "zellepay.com",

  // Big tech / OS / search / shopping
  "microsoft.com",
  "google.com",
  "apple.com",
  "amazon.com",
  "meta.com",

  // Social
  "facebook.com",
  "instagram.com",
  "whatsapp.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "youtube.com",

  // Email / cloud storage
  "gmail.com",
  "outlook.com",
  "yahoo.com",
  "aol.com",
  "icloud.com",
  "dropbox.com",
  "onedrive.com",

  // Streaming
  "netflix.com",
  "spotify.com",

  // Productivity / docs / comms
  "docusign.com",
  "adobe.com",
  "zoom.us",
  "slack.com",
  "discord.com",

  // Gaming
  "steampowered.com",
  "steamcommunity.com",

  // Crypto / brokerage
  "coinbase.com",
  "binance.com",
  "robinhood.com",

  // Retail
  "ebay.com",
  "walmart.com",
  "target.com",
  "bestbuy.com",

  // Shipping (heavily impersonated for "package failed delivery" scams)
  "fedex.com",
  "ups.com",
  "usps.com",
  "dhl.com",

  // US government (heavily impersonated for tax/benefit scams)
  "irs.gov",
  "ssa.gov",
  "medicare.gov",
];
