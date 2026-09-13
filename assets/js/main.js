(function () {
  'use strict';

  /* ---------- Header scroll state ---------- */
  var header = document.getElementById('siteHeader');
  function onScroll() {
    if (!header) return;
    if (window.scrollY > 12) header.classList.add('is-scrolled');
    else header.classList.remove('is-scrolled');
  }
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile nav overlay ---------- */
  var toggle = document.getElementById('menuToggle');
  var overlay = document.getElementById('navOverlay');
  if (toggle && overlay) {
    toggle.addEventListener('click', function () {
      var open = overlay.classList.toggle('is-open');
      toggle.classList.toggle('is-active', open);
      document.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    overlay.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        overlay.classList.remove('is-open');
        toggle.classList.remove('is-active');
        document.body.classList.remove('menu-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
        overlay.classList.remove('is-open');
        toggle.classList.remove('is-active');
        document.body.classList.remove('menu-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach(function (el) {
      io.observe(el);
    });
    // Safety net: if anything is still unrevealed after a short delay
    // (e.g. an edge case where a browser resizes/paginates without firing
    // intersection callbacks), reveal it anyway rather than leaving it hidden.
    setTimeout(function () {
      document.querySelectorAll('[data-reveal]:not(.is-visible)').forEach(function (el) {
        el.classList.add('is-visible');
      });
    }, 2500);
  } else {
    revealEls.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  /* ---------- Property filters + sort (properties.html) ---------- */
  var grid = document.getElementById('propertyGrid');
  if (grid) {
    // Original markup order, captured once — this is what "Default / Latest"
    // restores, and what every other sort mode reorders away from.
    var originalOrder = Array.prototype.slice.call(grid.querySelectorAll('[data-filter-card]'));

    var fArea = document.getElementById('fArea');
    var fType = document.getElementById('fType');
    var fBedrooms = document.getElementById('fBedrooms');
    var fBathrooms = document.getElementById('fBathrooms');
    var fMin = document.getElementById('fMin');
    var fMax = document.getElementById('fMax');
    var fSort = document.getElementById('fSort');
    var filterForm = document.getElementById('filterForm');
    var resetBtn = document.getElementById('filterReset');
    var resultsCount = document.getElementById('resultsCount');
    var emptyState = document.getElementById('emptyState');
    var priceError = document.getElementById('priceError');

    // Strips "R", spaces, commas and any other non-digit characters so
    // "R 7 500 000", "7500000" and "R7,500,000" all parse the same way.
    // Returns null for blank/invalid input rather than throwing, so a
    // stray letter can never break filtering.
    function parsePrice(raw) {
      if (raw == null) return null;
      var digits = String(raw).replace(/[^\d]/g, '');
      if (!digits) return null;
      var n = parseInt(digits, 10);
      return isNaN(n) ? null : n;
    }

    // The filters actually in effect. Only Search Properties (or a Reset,
    // or restoring from the URL on load) updates this — Sort By re-reads it
    // to resort the current result set without re-running the search.
    var appliedFilters = { area: '', type: '', minBeds: null, minBaths: null, min: null, max: null };
    var appliedSort = 'default';

    function validatePriceRange() {
      var min = parsePrice(fMin.value);
      var max = parsePrice(fMax.value);
      var invalid = min != null && max != null && min > max;
      priceError.hidden = !invalid;
      return !invalid;
    }
    fMin.addEventListener('input', validatePriceRange);
    fMax.addEventListener('input', validatePriceRange);

    function cardMatches(card, filters) {
      var matchArea = !filters.area || card.dataset.area === filters.area;
      var matchType = !filters.type || card.dataset.type === filters.type;
      var beds = parseInt(card.dataset.bedrooms, 10);
      var matchBeds = filters.minBeds == null || (!isNaN(beds) && beds >= filters.minBeds);
      var baths = parseInt(card.dataset.bathrooms, 10);
      var matchBaths = filters.minBaths == null || (!isNaN(baths) && baths >= filters.minBaths);
      var price = parseInt(card.dataset.price, 10);
      var matchMin = filters.min == null || (!isNaN(price) && price >= filters.min);
      var matchMax = filters.max == null || (!isNaN(price) && price <= filters.max);
      return matchArea && matchType && matchBeds && matchBaths && matchMin && matchMax;
    }

    function currentlyVisible() {
      return originalOrder.filter(function (card) {
        return !card.hidden;
      });
    }

    function renderSort() {
      var visible = currentlyVisible();
      var sorted;
      if (appliedSort === 'price-asc' || appliedSort === 'price-desc') {
        sorted = visible.slice().sort(function (a, b) {
          var pa = parseInt(a.dataset.price, 10);
          var pb = parseInt(b.dataset.price, 10);
          return appliedSort === 'price-asc' ? pa - pb : pb - pa;
        });
      } else {
        // "Default / Latest": the order cards already appear in the DOM,
        // which is original markup order for the visible subset.
        sorted = visible;
      }
      // Move nodes into place rather than re-creating them, so galleries,
      // lazy-loaded images and reveal state on each card are preserved.
      sorted.forEach(function (card) {
        grid.appendChild(card);
      });
    }

    function updateResultsMeta(visibleCount) {
      var total = originalOrder.length;
      resultsCount.textContent =
        visibleCount === total
          ? 'Showing all ' + total + ' properties'
          : 'Showing ' + visibleCount + ' of ' + total + ' properties';
      emptyState.hidden = visibleCount !== 0;
    }

    function render() {
      var visibleCount = 0;
      originalOrder.forEach(function (card) {
        var visible = cardMatches(card, appliedFilters);
        card.hidden = !visible;
        if (visible) visibleCount++;
      });
      renderSort();
      updateResultsMeta(visibleCount);
    }

    function syncUrl() {
      var params = new URLSearchParams();
      if (appliedFilters.area) params.set('area', appliedFilters.area);
      if (appliedFilters.type) params.set('type', appliedFilters.type);
      if (appliedFilters.minBeds != null) params.set('beds', String(appliedFilters.minBeds));
      if (appliedFilters.minBaths != null) params.set('baths', String(appliedFilters.minBaths));
      if (appliedFilters.min != null) params.set('min', String(appliedFilters.min));
      if (appliedFilters.max != null) params.set('max', String(appliedFilters.max));
      if (appliedSort !== 'default') params.set('sort', appliedSort);
      var query = params.toString();
      var url = window.location.pathname + (query ? '?' + query : '');
      window.history.replaceState(null, '', url);
    }

    function readFiltersFromForm() {
      return {
        area: fArea.value,
        type: fType.value,
        minBeds: fBedrooms.value ? parseInt(fBedrooms.value, 10) : null,
        minBaths: fBathrooms.value ? parseInt(fBathrooms.value, 10) : null,
        min: parsePrice(fMin.value),
        max: parsePrice(fMax.value),
      };
    }

    function runSearch(opts) {
      if (!validatePriceRange()) return;
      appliedFilters = readFiltersFromForm();
      appliedSort = fSort.value;
      render();
      syncUrl();
      if (opts && opts.scrollToResults && window.innerWidth < 760) {
        var heading = document.querySelector('.results-meta');
        if (heading) heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    if (filterForm) {
      filterForm.addEventListener('submit', function (e) {
        e.preventDefault();
        runSearch({ scrollToResults: true });
      });
    }

    // Sort updates the already-applied result set immediately — it does not
    // require pressing Search Properties again.
    fSort.addEventListener('change', function () {
      appliedSort = fSort.value;
      renderSort();
      syncUrl();
    });

    resetBtn.addEventListener('click', function () {
      fArea.value = '';
      fType.value = '';
      fBedrooms.value = '';
      fBathrooms.value = '';
      fMin.value = '';
      fMax.value = '';
      fSort.value = 'default';
      priceError.hidden = true;
      appliedFilters = { area: '', type: '', minBeds: null, minBaths: null, min: null, max: null };
      appliedSort = 'default';
      render();
      syncUrl();
    });

    // Restore filters from the URL (shared/bookmarked/refreshed link) and
    // apply them immediately so the visible grid matches what was shared.
    (function restoreFromUrl() {
      var params = new URLSearchParams(window.location.search);
      var hasAny = false;
      if (params.get('area')) {
        fArea.value = params.get('area');
        hasAny = true;
      }
      if (params.get('type')) {
        fType.value = params.get('type');
        hasAny = true;
      }
      if (params.get('beds')) {
        fBedrooms.value = params.get('beds');
        hasAny = true;
      }
      if (params.get('baths')) {
        fBathrooms.value = params.get('baths');
        hasAny = true;
      }
      if (params.get('min')) {
        fMin.value = params.get('min');
        hasAny = true;
      }
      if (params.get('max')) {
        fMax.value = params.get('max');
        hasAny = true;
      }
      if (params.get('sort')) {
        fSort.value = params.get('sort');
        hasAny = true;
      }
      if (hasAny) {
        appliedFilters = readFiltersFromForm();
        appliedSort = fSort.value;
        render();
      } else {
        render();
      }
    })();
  }

  /* ---------- Gallery lightbox (property detail pages) ---------- */
  var galleryEl = document.getElementById('gallery');
  if (galleryEl && window.__GALLERY__ && window.__GALLERY__.length) {
    var images = window.__GALLERY__;
    var lightbox = document.getElementById('lightbox');
    var lightboxImg = document.getElementById('lightboxImg');
    var lightboxCount = document.getElementById('lightboxCount');
    var closeBtn = document.getElementById('lightboxClose');
    var prevBtn = document.getElementById('lightboxPrev');
    var nextBtn = document.getElementById('lightboxNext');
    var current = 0;

    function show(index) {
      current = (index + images.length) % images.length;
      lightboxImg.src = images[current];
      lightboxImg.alt = 'Photo ' + (current + 1) + ' of ' + images.length;
      lightboxCount.textContent = current + 1 + ' / ' + images.length;
    }
    function open(index) {
      show(index);
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.classList.add('menu-open');
    }
    function close() {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('menu-open');
    }

    galleryEl.querySelectorAll('a[data-index]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        open(parseInt(a.dataset.index, 10));
      });
    });
    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function () {
      show(current - 1);
    });
    nextBtn.addEventListener('click', function () {
      show(current + 1);
    });
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) close();
    });
    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });
  }

  /* ---------- Sell With Us form -> WhatsApp handoff ---------- */
  // If SA Homes 4U hasn't supplied a real WhatsApp number yet, don't send
  // the enquiry into a fabricated one — fall back to opening Instagram and
  // tell the visitor why, so the form stays usable either way.
  var sellForm = document.querySelector('[data-role="sell-form"]');
  var sellNote = document.getElementById('sellFormNote');
  if (sellForm) {
    sellForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (window.__SELL_WHATSAPP__) {
        var data = new FormData(sellForm);
        var lines = [
          'Hi SA Homes 4U, I would like to list my property.',
          'Name: ' + (data.get('name') || ''),
          'Phone: ' + (data.get('phone') || ''),
          'Location: ' + (data.get('location') || ''),
          'Expected price: ' + (data.get('price') || ''),
          'Details: ' + (data.get('details') || ''),
        ];
        var url = 'https://wa.me/' + window.__SELL_WHATSAPP__ + '?text=' + encodeURIComponent(lines.join('\n'));
        window.open(url, '_blank', 'noopener');
      } else if (window.__INSTAGRAM__) {
        if (sellNote) {
          sellNote.textContent = 'Our direct WhatsApp line is being finalised — please message us on Instagram in the meantime; we opened it in a new tab.';
          sellNote.hidden = false;
        }
        window.open(window.__INSTAGRAM__, '_blank', 'noopener');
      }
    });
  }

  /* ---------- Contact form -> mailto handoff ---------- */
  // Same fallback reasoning as the Sell With Us form above.
  var contactForm = document.querySelector('[data-role="contact-form"]');
  var contactNote = document.getElementById('contactFormNote');
  if (contactForm && document.getElementById('contactSubmit')) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (window.__CONTACT_EMAIL__) {
        var data = new FormData(contactForm);
        var subject = 'Enquiry from ' + (data.get('name') || 'website visitor');
        var body = [
          'Name: ' + (data.get('name') || ''),
          'Email: ' + (data.get('email') || ''),
          'Property: ' + (data.get('property') || ''),
          '',
          data.get('message') || '',
        ].join('\n');
        window.location.href =
          'mailto:' + window.__CONTACT_EMAIL__ + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      } else if (window.__INSTAGRAM__) {
        if (contactNote) {
          contactNote.textContent = 'Our direct email line is being finalised — please message us on Instagram in the meantime; we opened it in a new tab.';
          contactNote.hidden = false;
        }
        window.open(window.__INSTAGRAM__, '_blank', 'noopener');
      }
    });
  }
})();
