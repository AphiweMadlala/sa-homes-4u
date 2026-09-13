# SA Homes 4U — Reference & Source Hierarchy

This file records where every piece of design direction and content comes from, and the authority each source carries. When sources conflict, resolve in the order listed below.

## Source list

| Source | Path / URL | Role |
|---|---|---|
| Hero reference | `references/hero-reference.png` | **Primary visual authority** for the homepage hero |
| UX reference | https://aphiwemadlala.github.io/Exclusive-cape-town/index.html | Broader UX/quality reference only |
| Property source (origin) | https://www.instagram.com/sa_homes4u/ | Where the listings originally came from |
| Production property data | `data/properties.json` | Factual source of truth for all listing content |
| Raw Instagram scrape | `data/instagram-posts.json` | Raw provenance record backing `properties.json` |
| Property media | `assets/properties/` | Production property images (local, permanent, WebP) |

## Authority rules

1. **`references/hero-reference.png` controls the homepage hero direction.**
   It is the highest-authority visual reference for the homepage hero specifically: composition, typography scale, navigation positioning, "SA HOMES 4U" branding treatment, "EST. 2020" treatment, tagline placement, the "View Collection" CTA, architectural imagery style, spacing, and overall restrained luxury/editorial hierarchy. The hero is recreated as real responsive HTML/CSS (not dropped in as a flat image) and is not materially redesigned except where necessary for responsive behavior.

2. **Exclusive Cape Town is a broader UX/quality reference only — not a design or content source.**
   Used only to calibrate: overall quality bar, editorial property presentation, photography treatment, property-card polish, spacing/typography rhythm, section pacing, responsive behavior, filtering UX, subtle interaction quality, premium minimalism, and WhatsApp-led enquiry patterns. Its branding, copy, and rental-specific functionality (availability, booking calendars, guest counts, nightly pricing) are explicitly **not** carried over — this is a property-*sales* site, not a rental site.

3. **`data/properties.json` is the factual source of truth for listings.**
   All 30 property records (price, location, bedrooms, property type, images, source Instagram URL) come from this file. Fields that are `null` (bathrooms, garages, erf size, floor size, rates, levies, features, description) are **omitted from the UI**, never shown as placeholders like "N/A" or "—". No specifications are invented.

4. **`assets/properties/` holds the production images.**
   These local WebP files (downloaded and converted from the Instagram scrape, deduplicated, uncropped) are what the site renders — never the original Instagram CDN URLs, which are temporary/signed and expire.

5. **`data/instagram-posts.json` is raw provenance only**, kept for traceability back to the original scraped post data. It is not read directly by the website; `data/properties.json` is the normalized, UI-facing dataset derived from it.

## Precedence order (highest to lowest)

1. `references/hero-reference.png` — for the homepage hero only
2. Exclusive Cape Town live reference — for general UX/quality calibration
3. design-md / Awesome Design library — secondary guidance only, never overrides #1
