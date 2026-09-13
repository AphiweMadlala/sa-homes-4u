#!/usr/bin/env node
/**
 * SA Homes 4U static site generator.
 * Reads data/properties.json (factual source of truth) and produces:
 *   - index.html, properties.html, about.html, sell-with-us.html, contact.html
 *   - properties/<slug>.html  (one per listing)
 *
 * Re-run this script any time data/properties.json changes:
 *   node scripts/generate.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'properties.json');

// ---------------------------------------------------------------------------
// Business contact details.
// SA Homes 4U's own phone/email/WhatsApp number was not present anywhere in
// the scraped Instagram data (only individual estate agents' numbers appear
// inside some captions, which belong to third-party agencies, not this
// business). Rather than publish fabricated contact details, these stay
// `null` until the real values are supplied — every template below checks
// `has*()` and falls back to the one channel we know is genuine: Instagram.
// Fill these in and re-run the generator once SA Homes 4U provides them.
// ---------------------------------------------------------------------------
const CONFIG = {
  whatsappNumber: null, // e.g. '27821234567' — no leading +, no spaces
  phoneDisplay: null, // e.g. '+27 82 123 4567'
  email: null, // e.g. 'info@sahomes4u.co.za'
  addressLine1: null, // e.g. 'Suite 4, 12 Main Road, Sea Point'
  instagram: 'https://www.instagram.com/sa_homes4u/',
  instagramHandle: '@sa_homes4u',
};

const hasWhatsapp = () => Boolean(CONFIG.whatsappNumber);
const hasPhone = () => Boolean(CONFIG.phoneDisplay);
const hasEmail = () => Boolean(CONFIG.email);
const hasAddress = () => Boolean(CONFIG.addressLine1);

// The one enquiry channel guaranteed to be real. Every CTA that would
// otherwise depend on a placeholder phone/email/WhatsApp number falls back
// to this instead of linking users to fabricated contact details.
function primaryCta(property) {
  if (hasWhatsapp()) {
    return { href: whatsappLink(property), label: 'Message on WhatsApp', icon: ICONS.whatsapp };
  }
  return { href: CONFIG.instagram, label: 'Message on Instagram', icon: ICONS.instagram };
}

const properties = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugOf(property) {
  const first = property.images && property.images[0];
  if (!first) throw new Error(`Property "${property.title}" has no images to derive a slug from`);
  const parts = first.split('/');
  return parts[2]; // assets/properties/<slug>/01.webp
}

function formatPrice(amount) {
  if (amount == null) return null;
  const grouped = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `R ${grouped}`;
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Broad city/suburb/market-area grouping, used for filtering and location
// stats. Every current listing carries an explicit "area" in properties.json
// (deliberately normalized — e.g. several distinct estates all roll up to
// "Ballito" or "Sandton"); this is only a safety net for a future listing
// that omits it, so the site still builds instead of erroring.
function fallbackAreaFromLocation(location) {
  const parts = location.split(',').map((s) => s.trim());
  return parts[parts.length - 1];
}

// Attach derived fields once, up front.
const enriched = properties.map((p) => {
  const area = p.area || fallbackAreaFromLocation(p.location);
  if (!p.area) {
    console.warn(`Property "${p.title}" has no "area" set — falling back to "${area}" derived from location.`);
  }
  return { ...p, slug: slugOf(p), area };
});

function bySlug(slug) {
  return enriched.find((p) => p.slug === slug);
}

function relatedFor(property, count = 3) {
  const pool = enriched.filter((p) => p.slug !== property.slug);
  const sameArea = pool.filter((p) => p.area === property.area);
  const sameBedrooms = pool.filter((p) => p.bedrooms === property.bedrooms && p.area !== property.area);
  const byPriceDistance = [...pool].sort(
    (a, b) => Math.abs(a.askingPrice - property.askingPrice) - Math.abs(b.askingPrice - property.askingPrice)
  );

  const picked = [];
  const seen = new Set();
  for (const list of [sameArea, sameBedrooms, byPriceDistance]) {
    for (const p of list) {
      if (picked.length >= count) break;
      if (seen.has(p.slug)) continue;
      seen.add(p.slug);
      picked.push(p);
    }
  }
  return picked.slice(0, count);
}

function whatsappLink(property) {
  if (!hasWhatsapp()) return null;
  const msg = property
    ? `Hi SA Homes 4U, I'm interested in ${property.title} (${formatPrice(property.askingPrice)}). Could you tell me more?\n\n${property.canonicalUrl || ''}`
    : `Hi SA Homes 4U, I'd like to enquire about a property.`;
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
}

// ---------------------------------------------------------------------------
// Icons (inline SVG, no external icon font)
// ---------------------------------------------------------------------------
// Every icon carries an explicit width/height. Inline SVGs with no size
// attribute resolve inconsistently depending on layout context (observed:
// 0x0 inside a flex item, ~682x682 in normal flow) — an explicit "1em"
// baseline keeps them predictable everywhere; CSS still overrides per use.
const ICONS = {
  bed: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7"/><path d="M3 18h18"/><path d="M7 9V6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3"/><path d="M13 9V7a1 1 0 0 1 1-1h3a2 2 0 0 1 2 2v1"/></svg>`,
  pin: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>`,
  arrow: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>`,
  whatsapp: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.5 0-10 4.5-10 10 0 1.77.47 3.45 1.3 4.9L2 22l5.25-1.38a9.96 9.96 0 0 0 4.79 1.22h.01c5.5 0 10-4.5 10-10s-4.5-9.84-10.01-9.84Zm0 18.2a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.34c0-4.53 3.69-8.22 8.24-8.22 4.54 0 8.22 3.68 8.22 8.22 0 4.53-3.69 8.2-8.23 8.2Zm4.52-6.16c-.25-.12-1.47-.72-1.7-.8-.23-.08-.4-.12-.56.13-.17.25-.65.8-.8.96-.15.17-.29.19-.54.06-.25-.12-1.06-.39-2.02-1.24-.75-.66-1.25-1.48-1.4-1.73-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.08s.9 2.41 1.02 2.58c.12.17 1.77 2.7 4.28 3.79.6.26 1.06.41 1.43.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.17-.48-.29Z"/></svg>`,
  close: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  chevL: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M15 6l-6 6 6 6"/></svg>`,
  chevR: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 6l6 6-6 6"/></svg>`,
  instagram: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/></svg>`,
};

// ---------------------------------------------------------------------------
// Shared partials
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
  { label: 'Properties', href: 'properties.html' },
  { label: 'About', href: 'about.html' },
  { label: 'Sell With Us', href: 'sell-with-us.html' },
  { label: 'Contact', href: 'contact.html' },
];

function head({ title, description, root, canonical }) {
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="stylesheet" href="${root}assets/css/style.css">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">`;
}

function header(activeHref, root) {
  const links = NAV_ITEMS.map(
    (item) =>
      `<a href="${root}${item.href}"${item.href === activeHref ? ' aria-current="page"' : ''}>${item.label}</a>`
  ).join('\n      ');
  return `<header class="site-header" id="siteHeader">
  <a href="${root}index.html" class="brand-mark">SA Homes<strong>4U</strong></a>
  <nav class="nav-links" aria-label="Primary">
      ${links}
  </nav>
  <button type="button" class="menu-toggle" id="menuToggle" aria-expanded="false" aria-controls="navOverlay">
    Menu
    <span class="burger"><span></span><span></span><span></span></span>
  </button>
</header>
<div class="nav-overlay" id="navOverlay">
  <div class="nav-overlay__links">
    ${NAV_ITEMS.map((item) => `<a href="${root}${item.href}">${item.label}</a>`).join('\n    ')}
  </div>
  <div class="nav-overlay__meta">
    ${hasWhatsapp() ? `<a href="${esc(whatsappLink())}" target="_blank" rel="noopener">WhatsApp: ${CONFIG.phoneDisplay}</a>` : ''}
    ${hasEmail() ? `<a href="mailto:${CONFIG.email}">${CONFIG.email}</a>` : ''}
    <a href="${CONFIG.instagram}" target="_blank" rel="noopener">${CONFIG.instagramHandle} on Instagram</a>
  </div>
</div>`;
}

function floatingCta(root, mode) {
  if (mode === 'none') return '';
  if (mode === 'enquire') {
    const cta = primaryCta();
    return `<div class="floating-cta">
  <a class="btn btn-primary" href="${esc(cta.href)}" target="_blank" rel="noopener">${cta.icon} Enquire Now</a>
</div>`;
  }
  return `<div class="floating-cta">
  <a class="btn btn-primary" href="${root}properties.html">View Collection ${ICONS.arrow}</a>
</div>`;
}

function footer(root) {
  const cta = primaryCta();
  const addressCol = hasAddress()
    ? `<div class="footer-col">
        <h4>Address</h4>
        <p>${esc(CONFIG.addressLine1)}</p>
        <p>South Africa</p>
      </div>`
    : '';
  const contactLines = [
    hasPhone() ? `<a href="tel:${CONFIG.phoneDisplay.replace(/\s+/g, '')}">${CONFIG.phoneDisplay}</a>` : '',
    hasEmail() ? `<a href="mailto:${CONFIG.email}">${CONFIG.email}</a>` : '',
  ]
    .filter(Boolean)
    .join('\n        ');
  const contactCol = `<div class="footer-col">
        <h4>Contact</h4>
        ${contactLines || `<p>Reach us on Instagram for now.</p>`}
      </div>`;
  return `<footer class="site-footer">
  <div class="container">
    <div class="cta-band" style="border-top:none;">
      <div class="cta-band__row">
        <h2>Let's find<br>your next home.</h2>
        <a class="btn btn-accent" href="${esc(cta.href)}" target="_blank" rel="noopener">${cta.icon} ${cta.label}</a>
      </div>
    </div>
    <div class="footer-grid">
      ${addressCol}
      ${contactCol}
      <div class="footer-col">
        <h4>Follow</h4>
        <a href="${CONFIG.instagram}" target="_blank" rel="noopener">${CONFIG.instagramHandle}</a>
      </div>
      <div class="footer-col">
        <h4>Navigate</h4>
        ${NAV_ITEMS.map((item) => `<a href="${root}${item.href}">${item.label}</a>`).join('\n        ')}
      </div>
    </div>
    <div class="footer-bottom">
      <span>SA Homes 4U — Est. 2020</span>
      <span>Homes with a point of view</span>
      <span>Property photography &amp; listings sourced from <a href="${CONFIG.instagram}" target="_blank" rel="noopener">${CONFIG.instagramHandle}</a></span>
    </div>
  </div>
</footer>`;
}

function lightbox() {
  return `<div class="lightbox" id="lightbox" aria-hidden="true">
  <button type="button" class="lightbox__close" id="lightboxClose" aria-label="Close gallery">${ICONS.close}</button>
  <button type="button" class="lightbox__prev" id="lightboxPrev" aria-label="Previous image">${ICONS.chevL}</button>
  <img id="lightboxImg" src="" alt="">
  <button type="button" class="lightbox__next" id="lightboxNext" aria-label="Next image">${ICONS.chevR}</button>
  <div class="lightbox__count" id="lightboxCount"></div>
</div>`;
}

function page({ title, description, root, activeHref, canonical, bodyClass = '', content, extraScripts = '', ctaMode = 'collection' }) {
  const cls = [bodyClass, ctaMode !== 'none' ? 'has-floating-cta' : ''].filter(Boolean).join(' ');
  return `<!doctype html>
<html lang="en">
<head>
${head({ title, description, root, canonical })}
</head>
<body class="${cls}">
${header(activeHref, root)}
${content}
${footer(root)}
${floatingCta(root, ctaMode)}
${lightbox()}
${extraScripts}
<script src="${root}assets/js/main.js"></script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Property card component
// ---------------------------------------------------------------------------
// Concise, non-repeating headline: "5 Bedroom House". The place name is
// carried once by the loc line below it, never duplicated in the title.
function cardHeadline(property) {
  const bits = [];
  if (property.bedrooms != null) bits.push(`${property.bedrooms} Bedroom`);
  bits.push(property.propertyType);
  return bits.join(' ');
}

function propertyCard(property, { size = '', index, root }) {
  const cls = size ? `p-card p-card--${size}` : 'p-card';
  const num = index != null ? `<span class="p-card__num">N&deg; ${String(index).padStart(2, '0')}</span>` : '<span></span>';
  return `<article class="${cls}" data-reveal>
  <a href="${root}properties/${property.slug}.html" aria-label="View ${esc(property.title)}">
    <img class="p-card__img" src="${root}${property.images[0]}" alt="${esc(property.title)}" loading="lazy">
    <div class="p-card__scrim"></div>
    <div class="p-card__top">
      ${num}
      <span class="p-card__price">${formatPrice(property.askingPrice)}</span>
    </div>
    <div class="p-card__body">
      <div class="p-card__loc">${ICONS.pin} ${esc(property.location)}</div>
      <h3 class="p-card__title">${esc(cardHeadline(property))}</h3>
      <span class="p-card__link">View Property ${ICONS.arrow}</span>
    </div>
  </a>
</article>`;
}

function gridCard(property, root) {
  return `<article class="p-card" data-filter-card
    data-area="${esc(property.area)}"
    data-type="${esc(property.propertyType)}"
    data-bedrooms="${property.bedrooms}"
    data-bathrooms="${property.bathrooms != null ? property.bathrooms : ''}"
    data-price="${property.askingPrice}"
    data-reveal>
  <a href="${root}properties/${property.slug}.html" aria-label="View ${esc(property.title)}">
    <img class="p-card__img" src="${root}${property.images[0]}" alt="${esc(property.title)}" loading="lazy">
    <div class="p-card__scrim"></div>
    <div class="p-card__top">
      <span class="p-card__num">${esc(property.propertyType)}</span>
      <span class="p-card__price">${formatPrice(property.askingPrice)}</span>
    </div>
    <div class="p-card__body">
      <div class="p-card__loc">${ICONS.pin} ${esc(property.location)}</div>
      <h3 class="p-card__title">${esc(cardHeadline(property))}</h3>
      <span class="p-card__link">View Property ${ICONS.arrow}</span>
    </div>
  </a>
</article>`;
}

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------
function buildHome() {
  const root = '';
  const featured = [...enriched]
    .sort((a, b) => new Date(b.instagramPostDate) - new Date(a.instagramPostDate))
    .slice(0, 3);
  const spotlight = [...enriched]
    .sort((a, b) => new Date(b.instagramPostDate) - new Date(a.instagramPostDate))
    .slice(3, 9);

  const areas = [...new Set(enriched.map((p) => p.area))];

  const content = `
<section class="hero">
  <div class="hero__media">
    <img src="assets/properties/5-bedroom-house-in-suiderstrand-western-cape/01.webp" alt="Dusk view of a contemporary SA Homes 4U listing overlooking the coast">
  </div>
  <div class="hero__scrim"></div>
  <div class="hero__body">
    <h1 class="hero__wordmark">SA Homes<span class="accent">4U<sup>TM</sup></span></h1>
    <p class="hero__tagline">Homes with a point of view</p>
  </div>
  <div class="hero__footer">
    <div class="hero__est"><span class="line"></span> EST. 2020</div>
    <a class="btn btn-primary" href="properties.html">View Collection ${ICONS.arrow}</a>
  </div>
</section>

<section class="section section--tight">
  <div class="container manifesto" data-reveal>
    <div class="manifesto__label">The Standard</div>
    <div>
      <p class="manifesto__lead">A curated view of South Africa's finest homes, presented the way they deserve to be seen.</p>
      <p class="manifesto__body">SA Homes 4U brings together standout residences from across South Africa's most sought-after estates and suburbs &mdash; from the Cape Winelands to the KwaZulu-Natal coast, Gauteng's private estates to the Garden Route. Every home in our collection is presented with the photography and detail it deserves, for buyers who know exactly what they're looking for.</p>
      <dl class="manifesto__meta">
        <div><dt>Listings</dt><dd>${enriched.length} homes currently presented</dd></div>
        <div><dt>Reach</dt><dd>${areas.length} areas across South Africa</dd></div>
        <div><dt>Since</dt><dd>Est. 2020</dd></div>
      </dl>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-head" data-reveal>
      <div>
        <span class="eyebrow">Featured</span>
        <h2>The Latest to the Collection</h2>
      </div>
      <p class="section-head__note">Three recently presented homes &mdash; chosen for their setting, their design, and what makes each one worth a closer look.</p>
    </div>
    <div class="featured-grid">
      ${propertyCard(featured[0], { size: 'lg', index: 1, root })}
      <div class="featured-grid__stack">
        ${propertyCard(featured[1], { size: 'sm', index: 2, root })}
        ${propertyCard(featured[2], { size: 'sm', index: 3, root })}
      </div>
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="container">
    <div class="section-head" data-reveal>
      <div>
        <span class="eyebrow">Explore</span>
        <h2>More From the Collection</h2>
      </div>
      <a class="btn btn-outline" href="properties.html">View All ${enriched.length} Properties ${ICONS.arrow}</a>
    </div>
    <div class="p-grid">
      ${spotlight.map((p, i) => propertyCard(p, { index: i + 4, root })).join('\n      ')}
    </div>
  </div>
</section>

<section class="cta-band">
  <div class="container cta-band__row" data-reveal>
    <h2>Selling a home that deserves a closer look?</h2>
    <a class="btn btn-accent" href="sell-with-us.html">Sell With Us ${ICONS.arrow}</a>
  </div>
</section>
`;

  return page({
    title: 'SA Homes 4U — Homes With a Point of View',
    description: 'A curated collection of South African homes for sale, presented with the photography and detail they deserve.',
    root,
    activeHref: '',
    canonical: 'index.html',
    bodyClass: 'is-home',
    content,
    ctaMode: 'none',
  });
}

// ---------------------------------------------------------------------------
// Properties listing page
// ---------------------------------------------------------------------------
function buildPropertiesPage() {
  const root = '';
  const areas = [...new Set(enriched.map((p) => p.area))].sort();

  // Always offer House/Apartment as a baseline, even if one has no current
  // listings, plus whatever other types show up in the data (Townhouse,
  // Penthouse, etc.) so the dropdown grows on its own as listings diversify.
  const baselineTypes = ['House', 'Apartment'];
  const otherTypes = [...new Set(enriched.map((p) => p.propertyType))]
    .filter((t) => !baselineTypes.includes(t))
    .sort();
  const types = [...baselineTypes, ...otherTypes];

  const minMaxOptions = [1, 2, 3, 4, 5];

  const content = `
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">The Collection</span>
    <h1>Every Home We Currently Represent</h1>
    <p>Search the full collection by area, property type, bedrooms, and bathrooms — set your own price range, then sort by price or browse the latest additions.</p>
  </div>
</section>

<section class="section section--tight">
  <div class="container">
    <form class="filter-bar" id="filterForm" role="search" aria-label="Filter properties">
      <div class="filter-grid">
        <div class="filter-field">
          <label for="fArea">Area</label>
          <select id="fArea">
            <option value="">Any Area</option>
            ${areas.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('\n            ')}
          </select>
        </div>
        <div class="filter-field">
          <label for="fType">Property Type</label>
          <select id="fType">
            <option value="">Any Type</option>
            ${types.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('\n            ')}
          </select>
        </div>
        <div class="filter-field">
          <label for="fBedrooms">Bedrooms</label>
          <select id="fBedrooms">
            <option value="">Any</option>
            ${minMaxOptions.map((n) => `<option value="${n}">${n}+</option>`).join('\n            ')}
          </select>
        </div>
        <div class="filter-field">
          <label for="fBathrooms">Bathrooms</label>
          <select id="fBathrooms">
            <option value="">Any</option>
            ${minMaxOptions.map((n) => `<option value="${n}">${n}+</option>`).join('\n            ')}
          </select>
        </div>
        <div class="filter-field">
          <label for="fMin">Minimum Price</label>
          <input type="text" inputmode="numeric" autocomplete="off" id="fMin" placeholder="e.g. R 7 500 000">
        </div>
        <div class="filter-field">
          <label for="fMax">Maximum Price</label>
          <input type="text" inputmode="numeric" autocomplete="off" id="fMax" placeholder="e.g. R 27 500 000">
        </div>
        <div class="filter-field">
          <label for="fSort">Sort By</label>
          <select id="fSort">
            <option value="default">Default / Latest</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>
      </div>
      <p class="filter-error" id="priceError" role="alert" hidden>Minimum price can&rsquo;t be higher than maximum price.</p>
      <div class="filter-actions">
        <button type="submit" class="btn btn-primary filter-submit" id="filterSearch">Search Properties</button>
        <button type="button" class="filter-reset" id="filterReset">Reset Filters</button>
      </div>
    </form>

    <div class="results-meta">
      <span id="resultsCount">Showing all ${enriched.length} properties</span>
      <span>Sourced from ${CONFIG.instagramHandle}</span>
    </div>

    <div class="p-grid" id="propertyGrid">
      ${enriched.map((p) => gridCard(p, root)).join('\n      ')}
    </div>
    <div class="empty-state" id="emptyState" hidden>No properties match those filters yet &mdash; try widening your search.</div>
  </div>
</section>
`;

  return page({
    title: 'Properties — SA Homes 4U',
    description: `Browse all ${enriched.length} homes currently for sale with SA Homes 4U across South Africa.`,
    root,
    activeHref: 'properties.html',
    canonical: 'properties.html',
    content,
    bodyClass: 'has-filters',
    ctaMode: 'enquire',
  });
}

// ---------------------------------------------------------------------------
// Individual property pages
// ---------------------------------------------------------------------------
function buildPropertyPage(property) {
  const root = '../';
  const related = relatedFor(property);
  const images = property.images;

  const galleryTiles = images
    .slice(0, 5)
    .map((img, i) => {
      if (i === 0) {
        return `<a href="#" class="g-hero" data-index="0"><img src="${root}${img}" alt="${esc(property.title)} — photo 1" loading="lazy"></a>`;
      }
      if (i === 4 && images.length > 5) {
        return `<a href="#" class="g-more" data-index="${i}" data-more="+${images.length - 5} more"><img src="${root}${img}" alt="${esc(property.title)} — photo ${i + 1}" loading="lazy"></a>`;
      }
      return `<a href="#" data-index="${i}"><img src="${root}${img}" alt="${esc(property.title)} — photo ${i + 1}" loading="lazy"></a>`;
    })
    .join('\n      ');

  const specs = [];
  if (property.bedrooms != null) specs.push(['Bedrooms', property.bedrooms]);
  if (property.bathrooms != null) specs.push(['Bathrooms', property.bathrooms]);
  if (property.garages != null) specs.push(['Garages', property.garages]);
  if (property.erfSize != null) specs.push(['Erf Size', property.erfSize]);
  if (property.floorSize != null) specs.push(['Floor Size', property.floorSize]);
  specs.push(['Property Type', property.propertyType]);

  const rateLevy = [];
  if (property.rates != null) rateLevy.push(`<div class="contact-detail"><dt>Rates</dt><dd>${esc(property.rates)}</dd></div>`);
  if (property.levies != null) rateLevy.push(`<div class="contact-detail"><dt>Levies</dt><dd>${esc(property.levies)}</dd></div>`);

  const content = `
<section class="p-hero">
  <div class="container">
    <div class="p-hero__breadcrumb">
      <a href="${root}index.html">Home</a> / <a href="${root}properties.html">Properties</a> / ${esc(property.title)}
    </div>
    <div class="p-hero__top">
      <div>
        <h1 class="p-hero__title">${esc(property.title)}</h1>
        <div class="p-hero__loc">${ICONS.pin} ${esc(property.location)}</div>
      </div>
      <div class="p-hero__price">${formatPrice(property.askingPrice)}</div>
    </div>

    <div class="gallery" id="gallery" data-count="${images.length}">
      ${galleryTiles}
    </div>

    <div class="p-layout">
      <div>
        <dl class="spec-grid">
          ${specs.map(([label, value]) => `<div class="spec-item"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('\n          ')}
        </dl>
        ${property.description ? `<p class="manifesto__body" style="max-width:none;">${esc(property.description)}</p>` : ''}
        ${
          property.features
            ? `<div class="value-grid" style="margin-top:24px;">${property.features
                .map((f) => `<div class="value-card"><p>${esc(f)}</p></div>`)
                .join('')}</div>`
            : ''
        }
        <p class="p-source">Originally presented on Instagram
          (<a href="${esc(property.instagramPostUrl)}" target="_blank" rel="noopener">${property.instagramPostDate ? formatDate(property.instagramPostDate) : 'view post'}</a>)
          &mdash; photography courtesy of ${CONFIG.instagramHandle}.
        </p>
      </div>

      <aside class="enquiry-card">
        <h3>Interested in this home?</h3>
        <p>Speak to the SA Homes 4U team about ${esc(property.title)}.</p>
        ${(() => {
          const cta = primaryCta(property);
          return `<a class="btn btn-primary btn-block" href="${esc(cta.href)}" target="_blank" rel="noopener">${cta.icon} ${cta.label}</a>`;
        })()}
        <a class="btn btn-outline btn-block" href="${root}contact.html?property=${encodeURIComponent(property.slug)}">Arrange Viewing</a>
        ${hasEmail() ? `<a class="btn btn-outline btn-block" href="mailto:${CONFIG.email}?subject=${encodeURIComponent('Enquiry: ' + property.title)}">Contact Agent</a>` : ''}
        <p class="enquiry-card__note">Asking price ${formatPrice(property.askingPrice)}. Figures and specifications shown are as supplied and subject to confirmation.</p>
      </aside>
    </div>

    ${
      related.length
        ? `<h2 class="related-heading">Related Properties</h2>
    <div class="p-grid">
      ${related.map((p) => propertyCard(p, { root })).join('\n      ')}
    </div>`
        : ''
    }
  </div>
</section>
`;

  return page({
    title: `${property.title} — SA Homes 4U`,
    description: `${property.title} in ${property.location}, asking ${formatPrice(property.askingPrice)}. View the full gallery and enquire with SA Homes 4U.`,
    root,
    activeHref: 'properties.html',
    canonical: `properties/${property.slug}.html`,
    content,
    extraScripts: `<script>window.__GALLERY__ = ${JSON.stringify(images.map((i) => root + i))};</script>`,
    // No floating CTA here: the sticky enquiry sidebar already carries the
    // primary WhatsApp/viewing/contact actions, and a fixed pill would
    // visually collide with it while scrolling.
    ctaMode: 'none',
  });
}

// ---------------------------------------------------------------------------
// About page
// ---------------------------------------------------------------------------
function buildAbout() {
  const root = '';
  const areas = [...new Set(enriched.map((p) => p.area))];
  const content = `
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">About</span>
    <h1>A Higher Standard of Presentation</h1>
    <p>SA Homes 4U was established in 2020 to give standout South African homes the presentation they deserve &mdash; strong photography, clear detail, and a collection worth browsing.</p>
  </div>
</section>

<section class="section">
  <div class="container two-col">
    <div data-reveal>
      <span class="eyebrow">Our Approach</span>
      <h2 style="margin-top:14px; font-size:clamp(1.8rem,3vw,2.6rem);">Homes with a point of view</h2>
      <p style="margin-top:18px; color:var(--text-dim); line-height:1.8;">Every home in our collection is chosen and presented on its own merits &mdash; its setting, its design, and what makes it worth a closer look. We work across South Africa's most sought-after addresses, from the Cape Winelands and Atlantic Seaboard to Gauteng's private estates and the KwaZulu-Natal coast.</p>
      <p style="margin-top:18px; color:var(--text-dim); line-height:1.8;">Our collection currently spans ${areas.length} areas across South Africa, presenting ${enriched.length} homes to buyers who know exactly what they're looking for.</p>
    </div>
    <img src="assets/properties/8-bedroom-house-in-the-hills-game-reserve-pretoria/01.webp" alt="A featured SA Homes 4U property" loading="lazy">
  </div>
</section>

<section class="section section--tight">
  <div class="container">
    <div class="section-head" data-reveal>
      <div><span class="eyebrow">What We Offer</span><h2>Built Around the Details That Matter</h2></div>
    </div>
    <div class="value-grid">
      <div class="value-card" data-reveal>
        <span class="eyebrow">Presentation</span>
        <h3>Photography-led listings</h3>
        <p>Every home is shown through full galleries, not a handful of thumbnails &mdash; because a home like this deserves to be seen properly.</p>
      </div>
      <div class="value-card" data-reveal>
        <span class="eyebrow">Focus</span>
        <h3>A curated collection</h3>
        <p>We don't list everything &mdash; only homes that stand on their own setting, design, and asking price.</p>
      </div>
      <div class="value-card" data-reveal>
        <span class="eyebrow">Access</span>
        <h3>A direct line to the team</h3>
        <p>Every listing connects straight to a real enquiry ${hasWhatsapp() ? '&mdash; WhatsApp, phone, or email &mdash;' : '&mdash; via Instagram, with more direct channels coming soon &mdash;'} with no unnecessary steps in between.</p>
      </div>
    </div>
  </div>
</section>

<section class="cta-band">
  <div class="container cta-band__row" data-reveal>
    <h2>Ready to see the collection?</h2>
    <a class="btn btn-accent" href="properties.html">View Collection ${ICONS.arrow}</a>
  </div>
</section>
`;
  return page({
    title: 'About — SA Homes 4U',
    description: 'SA Homes 4U presents a curated collection of South African homes for sale, established 2020.',
    root,
    activeHref: 'about.html',
    canonical: 'about.html',
    content,
  });
}

// ---------------------------------------------------------------------------
// Sell With Us page
// ---------------------------------------------------------------------------
function buildSell() {
  const root = '';
  const content = `
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">Sell With Us</span>
    <h1>List Your Home With SA Homes 4U</h1>
    <p>If your home belongs in a collection like this one, we'd like to hear from you. Tell us about the property and our team will be in touch.</p>
  </div>
</section>

<section class="section">
  <div class="container contact-grid">
    <div data-reveal>
      <span class="eyebrow">Why List With Us</span>
      <h2 style="margin-top:14px; font-size:clamp(1.6rem,3vw,2.2rem);">Presentation that matches your asking price</h2>
      <p style="margin-top:18px; color:var(--text-dim); line-height:1.8;">We present each home individually &mdash; full photography, a dedicated page, and direct enquiries routed straight to our team. No generic listings, no lost detail.</p>
      <div class="value-grid" style="grid-template-columns:1fr; margin-top:32px;">
        <div class="value-card">
          <span class="eyebrow">Step One</span>
          <h3>Tell us about the property</h3>
          <p>Share the location, asking price, and a few photos to start.</p>
        </div>
        <div class="value-card">
          <span class="eyebrow">Step Two</span>
          <h3>We prepare the listing</h3>
          <p>Our team puts together the full gallery and property page.</p>
        </div>
        <div class="value-card">
          <span class="eyebrow">Step Three</span>
          <h3>Your home joins the collection</h3>
          <p>Live on the site and shared with prospective buyers.</p>
        </div>
      </div>
    </div>

    <form class="contact-form" data-role="sell-form" onsubmit="return false;" data-reveal>
      <div>
        <label for="sName">Full Name</label>
        <input id="sName" type="text" name="name" required>
      </div>
      <div>
        <label for="sPhone">Phone Number</label>
        <input id="sPhone" type="tel" name="phone" required>
      </div>
      <div>
        <label for="sLocation">Property Location</label>
        <input id="sLocation" type="text" name="location" required>
      </div>
      <div>
        <label for="sPrice">Expected Asking Price</label>
        <input id="sPrice" type="text" name="price" placeholder="e.g. R 12 000 000">
      </div>
      <div>
        <label for="sDetails">Tell us about the property</label>
        <textarea id="sDetails" name="details" placeholder="Bedrooms, property type, what makes it stand out..."></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-block" id="sellSubmit">Submit Enquiry ${ICONS.arrow}</button>
      ${(() => {
        const cta = primaryCta();
        return `<a class="btn btn-outline btn-block" href="${esc(cta.href)}" target="_blank" rel="noopener">${cta.icon} Or ${cta.label}</a>`;
      })()}
      <p class="form-note" id="sellFormNote" hidden></p>
    </form>
  </div>
</section>
`;
  return page({
    title: 'Sell With Us — SA Homes 4U',
    description: 'List your home with SA Homes 4U — presentation-led property sales across South Africa.',
    root,
    activeHref: 'sell-with-us.html',
    canonical: 'sell-with-us.html',
    content,
    extraScripts: `<script>window.__SELL_WHATSAPP__ = ${JSON.stringify(CONFIG.whatsappNumber)}; window.__INSTAGRAM__ = ${JSON.stringify(CONFIG.instagram)};</script>`,
    // The form's own submit button + direct WhatsApp link already cover
    // enquiries here, and a fixed pill would overlap the form fields in
    // this two-column layout.
    ctaMode: 'none',
  });
}

// ---------------------------------------------------------------------------
// Contact page
// ---------------------------------------------------------------------------
function buildContact() {
  const root = '';
  const cta = primaryCta();
  const knownDetails = [
    hasWhatsapp()
      ? `<div class="contact-detail"><dt>WhatsApp</dt><dd><a href="${esc(whatsappLink())}" target="_blank" rel="noopener">${CONFIG.phoneDisplay}</a></dd></div>`
      : '',
    hasPhone()
      ? `<div class="contact-detail"><dt>Phone</dt><dd><a href="tel:${CONFIG.phoneDisplay.replace(/\s+/g, '')}">${CONFIG.phoneDisplay}</a></dd></div>`
      : '',
    hasEmail()
      ? `<div class="contact-detail"><dt>Email</dt><dd><a href="mailto:${CONFIG.email}">${CONFIG.email}</a></dd></div>`
      : '',
  ]
    .filter(Boolean)
    .join('\n      ');

  const content = `
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">Contact</span>
    <h1>Speak to the SA Homes 4U Team</h1>
    <p>Have a question about a listing, or want to arrange a viewing? Reach us directly below.</p>
  </div>
</section>

<section class="section">
  <div class="container contact-grid">
    <div data-reveal>
      ${knownDetails}
      <div class="contact-detail">
        <dt>Instagram</dt>
        <dd><a href="${CONFIG.instagram}" target="_blank" rel="noopener">${CONFIG.instagramHandle}</a></dd>
      </div>
      ${!hasWhatsapp() && !hasPhone() && !hasEmail() ? `<p class="form-note">Our direct phone and email lines are being finalised &mdash; for now, the fastest way to reach us is Instagram.</p>` : ''}
      <a class="btn btn-accent" href="${esc(cta.href)}" target="_blank" rel="noopener" style="margin-top:12px;">${cta.icon} ${cta.label}</a>
    </div>

    <form class="contact-form" data-role="contact-form" onsubmit="return false;" data-reveal>
      <div>
        <label for="cName">Full Name</label>
        <input id="cName" type="text" name="name" required>
      </div>
      <div>
        <label for="cEmail">Email</label>
        <input id="cEmail" type="email" name="email" required>
      </div>
      <div>
        <label for="cProperty">Property (optional)</label>
        <input id="cProperty" type="text" name="property" placeholder="Which listing are you enquiring about?">
      </div>
      <div>
        <label for="cMessage">Message</label>
        <textarea id="cMessage" name="message" required></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-block" id="contactSubmit">Send Enquiry ${ICONS.arrow}</button>
      <p class="form-note" id="contactFormNote" hidden></p>
    </form>
  </div>
</section>
`;
  return page({
    title: 'Contact — SA Homes 4U',
    description: 'Contact SA Homes 4U to enquire about a listing or arrange a viewing.',
    root,
    activeHref: 'contact.html',
    canonical: 'contact.html',
    content,
    extraScripts: `<script>window.__CONTACT_EMAIL__ = ${JSON.stringify(CONFIG.email)}; window.__INSTAGRAM__ = ${JSON.stringify(CONFIG.instagram)};</script>`,
    // Same reasoning as Sell With Us: the form + WhatsApp link already
    // cover enquiries, and a fixed pill would overlap the form column.
    ctaMode: 'none',
  });
}

// ---------------------------------------------------------------------------
// Write everything
// ---------------------------------------------------------------------------
fs.writeFileSync(path.join(ROOT, 'index.html'), buildHome());
fs.writeFileSync(path.join(ROOT, 'properties.html'), buildPropertiesPage());
fs.writeFileSync(path.join(ROOT, 'about.html'), buildAbout());
fs.writeFileSync(path.join(ROOT, 'sell-with-us.html'), buildSell());
fs.writeFileSync(path.join(ROOT, 'contact.html'), buildContact());

const propsDir = path.join(ROOT, 'properties');
fs.mkdirSync(propsDir, { recursive: true });
for (const file of fs.readdirSync(propsDir)) {
  if (file.endsWith('.html')) fs.unlinkSync(path.join(propsDir, file));
}
for (const property of enriched) {
  fs.writeFileSync(path.join(propsDir, `${property.slug}.html`), buildPropertyPage(property));
}

console.log(`Generated 5 top-level pages + ${enriched.length} property pages.`);
