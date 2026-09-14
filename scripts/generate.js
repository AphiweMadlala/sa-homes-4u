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
// SA Homes 4U's two confirmed contact channels: email and Instagram. No
// phone, WhatsApp or physical address has been supplied, so none is
// published — every CTA in this file uses one of these two.
// ---------------------------------------------------------------------------
const CONFIG = {
  email: 'sa.houses4u@gmail.com',
  instagram: 'https://www.instagram.com/sa_homes4u/',
  instagramHandle: '@sa_homes4u',
  // Production domain the site will be hosted at, no trailing slash, e.g.
  // 'https://www.sahomes4u.co.za'. Not knowable until SA Homes 4U picks a
  // domain, so absolute canonical/og/twitter URLs and sitemap.xml stay
  // switched off until this is filled in, rather than being built against
  // a made-up domain.
  siteUrl: null,
};

const hasSiteUrl = () => Boolean(CONFIG.siteUrl);

// Used as the social-preview image for pages that aren't about one specific
// listing (home, properties, about, sell, contact).
const DEFAULT_OG_IMAGE = 'assets/properties/5-bedroom-house-in-suiderstrand-western-cape/01.webp';

function mailtoHref(subject, body) {
  const params = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${CONFIG.email}${params.length ? '?' + params.join('&') : ''}`;
}

// A mailto button. When `subject`/`body` are given, the link is also marked
// `data-role="email-enquiry"` so main.js can append the visitor's current
// page URL to the body at runtime (see assets/js/main.js) — no backend, no
// build-time domain required, and the link still works fine without JS.
function emailButton(label, { subject, body, variant = 'primary', block = true } = {}) {
  const cls = `btn btn-${variant}${block ? ' btn-block' : ''}`;
  const dataAttrs = subject || body
    ? ` data-role="email-enquiry" data-subject="${escAttr(subject || '')}" data-body="${escAttr(body || '')}"`
    : '';
  return `<a class="${cls}"${dataAttrs} href="${esc(mailtoHref(subject, body))}">${ICONS.mail} ${label}</a>`;
}

function instagramButton(label = 'Message on Instagram', { variant = 'outline', block = true } = {}) {
  const cls = `btn btn-${variant}${block ? ' btn-block' : ''}`;
  return `<a class="${cls}" href="${CONFIG.instagram}" target="_blank" rel="noopener">${ICONS.instagram} ${label}</a>`;
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

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Same as esc(), but also entity-encodes newlines so a multi-line value
// (e.g. a mailto body) stays a single, readable line inside an HTML
// attribute instead of splitting the attribute across raw source lines.
function escAttr(str) {
  return esc(str).replace(/\n/g, '&#10;');
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

const normalize = (str) => String(str).trim().toLowerCase();

// Location-first, no filler: a home is only "related" if it's actually in
// the same place. Genuinely unrelated properties (matched only by bedroom
// count or nearest price, as this used to do) are worse than showing
// fewer — or zero — related properties.
function relatedFor(property, count = 3) {
  const pool = enriched.filter((p) => p.slug !== property.slug);
  const sameLocation = pool.filter((p) => normalize(p.location) === normalize(property.location));
  const sameArea = pool.filter((p) => normalize(p.area) === normalize(property.area));

  const picked = [];
  const seen = new Set();
  for (const list of [sameLocation, sameArea]) {
    for (const p of list) {
      if (picked.length >= count) break;
      if (seen.has(p.slug)) continue;
      seen.add(p.slug);
      picked.push(p);
    }
  }
  return picked;
}

// schema.org JSON-LD for a property detail page. Only known, non-null
// fields are included — same "no invented placeholders" rule as the UI.
function propertyStructuredData(property) {
  const abs = (p) => (hasSiteUrl() ? `${CONFIG.siteUrl}/${p}` : `/${p}`);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.title,
    url: abs(`properties/${property.slug}.html`),
    image: property.images.map(abs),
    datePosted: property.instagramPostDate || undefined,
    about: {
      '@type': 'SingleFamilyResidence',
      name: property.title,
      address: {
        '@type': 'PostalAddress',
        addressLocality: property.area,
        addressCountry: 'ZA',
      },
      numberOfRooms: property.bedrooms ?? undefined,
      numberOfBathroomsTotal: property.bathrooms ?? undefined,
    },
    offers: {
      '@type': 'Offer',
      price: property.askingPrice,
      priceCurrency: property.currency,
      availability: 'https://schema.org/InStock',
    },
  };
  return JSON.stringify(data);
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
  mail: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>`,
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

function head({ title, description, root, canonical, image, structuredData }) {
  const absUrl = hasSiteUrl() ? `${CONFIG.siteUrl}/${canonical}` : null;
  const absImage = hasSiteUrl() && image ? `${CONFIG.siteUrl}/${image}` : null;
  // Root-relative (leading "/"), never bare "properties/x.html": a bare
  // relative URL resolves against the *document's own* directory, so on a
  // page already living in /properties/ it would double up to
  // /properties/properties/x.html instead of /properties/x.html.
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(absUrl || `/${canonical}`)}">
<link rel="icon" href="${root}assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${root}assets/css/style.css">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
${absUrl ? `<meta property="og:url" content="${esc(absUrl)}">\n` : ''}${
    absImage
      ? `<meta property="og:image" content="${esc(absImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(absImage)}">`
      : ''
  }${structuredData ? `\n<script type="application/ld+json">${structuredData}</script>` : ''}`;
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
    <a href="mailto:${CONFIG.email}">${CONFIG.email}</a>
    <a href="${CONFIG.instagram}" target="_blank" rel="noopener">${CONFIG.instagramHandle} on Instagram</a>
  </div>
</div>`;
}

function floatingCta(root, mode) {
  if (mode === 'none') return '';
  if (mode === 'enquire') {
    return `<div class="floating-cta">
  <a class="btn btn-primary" href="${CONFIG.instagram}" target="_blank" rel="noopener">${ICONS.instagram} Message on Instagram</a>
</div>`;
  }
  return `<div class="floating-cta">
  <a class="btn btn-primary" href="${root}properties.html">View Collection ${ICONS.arrow}</a>
</div>`;
}

function footer(root) {
  return `<footer class="site-footer">
  <div class="container">
    <div class="cta-band" style="border-top:none;">
      <div class="cta-band__row">
        <h2>Let's find<br>your next home.</h2>
        <a class="btn btn-accent" href="mailto:${CONFIG.email}">${ICONS.mail} Email Us</a>
      </div>
    </div>
    <div class="footer-grid">
      <div class="footer-col">
        <h4>Contact</h4>
        <a href="mailto:${CONFIG.email}">${CONFIG.email}</a>
      </div>
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
    </div>
  </div>
</footer>`;
}

// A native <dialog>, shown via showModal(), renders in the browser's "top
// layer" — guaranteed by spec to paint above every other element in the
// document regardless of z-index or stacking context, unlike a plain
// position:fixed div. That sidesteps a rendering issue found in testing
// where a plain fixed div could show page content behind it.
function lightbox() {
  return `<dialog class="lightbox" id="lightbox">
  <button type="button" class="lightbox__close" id="lightboxClose" aria-label="Close gallery">${ICONS.close}</button>
  <div class="lightbox__stage" id="lightboxStage">
    <button type="button" class="lightbox__prev" id="lightboxPrev" aria-label="Previous image">${ICONS.chevL}</button>
    <img id="lightboxImg" src="" alt="">
    <button type="button" class="lightbox__next" id="lightboxNext" aria-label="Next image">${ICONS.chevR}</button>
    <div class="lightbox__count" id="lightboxCount"></div>
  </div>
  <div class="lightbox__thumbs" id="lightboxThumbs" aria-label="Image thumbnails"></div>
</dialog>`;
}

function page({
  title,
  description,
  root,
  activeHref,
  canonical,
  bodyClass = '',
  content,
  extraScripts = '',
  ctaMode = 'collection',
  image = DEFAULT_OG_IMAGE,
  structuredData,
}) {
  const cls = [bodyClass, ctaMode !== 'none' ? 'has-floating-cta' : ''].filter(Boolean).join(' ');
  return `<!doctype html>
<html lang="en">
<head>
${head({ title, description, root, canonical, image, structuredData })}
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
      </div>
      <p class="filter-error" id="priceError" role="alert" hidden>Minimum price can&rsquo;t be higher than maximum price.</p>
      <div class="filter-actions">
        <button type="submit" class="btn btn-primary filter-submit" id="filterSearch">Search Properties</button>
        <button type="button" class="filter-reset" id="filterReset">Reset Filters</button>
      </div>
    </form>

    <div class="results-meta">
      <span id="resultsCount">Showing all ${enriched.length} properties</span>
      <div class="sort-field">
        <label for="fSort">Sort By</label>
        <select id="fSort">
          <option value="default">Default / Latest</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
        </select>
      </div>
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

  const enquirySubject = `Property Enquiry — ${property.title}`;
  const enquiryBody = [
    'Hi SA Homes 4U,',
    '',
    "I'd like to enquire about:",
    property.title,
    formatPrice(property.askingPrice),
    property.location,
  ].join('\n');

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
      </div>

      <aside class="enquiry-card">
        <h3>Interested in this home?</h3>
        <p>Speak to the SA Homes 4U team about ${esc(property.title)}.</p>
        ${emailButton('Enquire by Email', { subject: enquirySubject, body: enquiryBody })}
        ${instagramButton()}
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
    image: property.images[0],
    structuredData: propertyStructuredData(property),
    extraScripts: `<script>window.__GALLERY__ = ${JSON.stringify(images.map((i) => root + i))};</script>`,
    // No floating CTA here: the sticky enquiry sidebar already carries the
    // primary email/Instagram actions, and a fixed pill would visually
    // collide with it while scrolling.
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
        <p>Every listing connects straight to a real enquiry &mdash; by email or Instagram &mdash; with no unnecessary steps in between.</p>
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

    <aside class="enquiry-card" data-reveal>
      <h3>Ready to list your home?</h3>
      <p>Send us the location, asking price, and a few photos to start.</p>
      ${emailButton('Email Us About Your Property', {
        subject: 'Sell With Us — Property Enquiry',
        body: [
          'Hi SA Homes 4U,',
          '',
          "I'd like to list my property with you.",
          '',
          'Name:',
          'Phone:',
          'Location:',
          'Asking price:',
          'About the property:',
        ].join('\n'),
      })}
      ${instagramButton('Contact Us on Instagram')}
      <p class="enquiry-card__note">We'll come back to you to discuss photography, presentation, and next steps.</p>
    </aside>
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
    // The enquiry card already carries the primary email/Instagram actions,
    // and a fixed pill would overlap it in this two-column layout.
    ctaMode: 'none',
  });
}

// ---------------------------------------------------------------------------
// Contact page
// ---------------------------------------------------------------------------
function buildContact() {
  const root = '';
  const content = `
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">Contact</span>
    <h1>Speak to the SA Homes 4U Team</h1>
    <p>Have a question about a listing, or want to arrange a viewing? Reach us directly below.</p>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="value-grid" style="grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));">
      <div class="value-card" data-reveal>
        <span class="eyebrow">Email</span>
        <h3>Email SA Homes 4U</h3>
        <p>${CONFIG.email}</p>
        ${emailButton('Email Us', { block: true })}
      </div>
      <div class="value-card" data-reveal>
        <span class="eyebrow">Instagram</span>
        <h3>${CONFIG.instagramHandle}</h3>
        <p>Message us directly on Instagram for a fast response.</p>
        ${instagramButton()}
      </div>
    </div>
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
    // The channel cards above already carry the primary email/Instagram
    // actions, and a fixed pill would be redundant on this page.
    ctaMode: 'none',
  });
}

// ---------------------------------------------------------------------------
// 404 page
// ---------------------------------------------------------------------------
function build404() {
  const root = '';
  const content = `
<section class="page-hero">
  <div class="container">
    <span class="eyebrow">404</span>
    <h1>This page has moved on.</h1>
    <p>The page you're looking for doesn't exist &mdash; it may have been an outdated link, or a listing that's no longer part of the collection.</p>
    <a class="btn btn-primary" href="properties.html">View Collection ${ICONS.arrow}</a>
  </div>
</section>
`;
  return page({
    title: 'Page Not Found — SA Homes 4U',
    description: 'The page you were looking for could not be found.',
    root,
    activeHref: '',
    canonical: '404.html',
    content,
    ctaMode: 'none',
  });
}

// ---------------------------------------------------------------------------
// robots.txt / sitemap.xml
// ---------------------------------------------------------------------------
// robots.txt itself needs no domain, so it's always written; the Sitemap:
// directive (and sitemap.xml itself, whose <loc> entries must be absolute
// per spec) only make sense once CONFIG.siteUrl is known.
function buildRobotsTxt() {
  return `User-agent: *
Allow: /
${hasSiteUrl() ? `\nSitemap: ${CONFIG.siteUrl}/sitemap.xml\n` : ''}`;
}

function buildSitemapXml() {
  const urls = [
    'index.html',
    'properties.html',
    'about.html',
    'sell-with-us.html',
    'contact.html',
    ...enriched.map((p) => `properties/${p.slug}.html`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(`${CONFIG.siteUrl}/${u}`)}</loc></url>`).join('\n')}
</urlset>
`;
}

// ---------------------------------------------------------------------------
// Write everything
// ---------------------------------------------------------------------------
fs.writeFileSync(path.join(ROOT, 'index.html'), buildHome());
fs.writeFileSync(path.join(ROOT, 'properties.html'), buildPropertiesPage());
fs.writeFileSync(path.join(ROOT, 'about.html'), buildAbout());
fs.writeFileSync(path.join(ROOT, 'sell-with-us.html'), buildSell());
fs.writeFileSync(path.join(ROOT, 'contact.html'), buildContact());
fs.writeFileSync(path.join(ROOT, '404.html'), build404());
fs.writeFileSync(path.join(ROOT, 'robots.txt'), buildRobotsTxt());
if (hasSiteUrl()) {
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), buildSitemapXml());
} else {
  console.warn('CONFIG.siteUrl is not set — skipping sitemap.xml. Set it once the production domain is known and re-run.');
}

const propsDir = path.join(ROOT, 'properties');
fs.mkdirSync(propsDir, { recursive: true });
for (const file of fs.readdirSync(propsDir)) {
  if (file.endsWith('.html')) fs.unlinkSync(path.join(propsDir, file));
}
for (const property of enriched) {
  fs.writeFileSync(path.join(propsDir, `${property.slug}.html`), buildPropertyPage(property));
}

console.log(`Generated 5 top-level pages + 404.html + robots.txt + ${enriched.length} property pages.`);
