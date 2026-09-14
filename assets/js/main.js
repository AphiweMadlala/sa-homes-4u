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

  /* ---------- Scroll lock (shared: mobile nav overlay + lightbox) ---------- */
  // Plain `overflow:hidden` on body is not a reliable scroll lock across
  // browser engines once a position:fixed overlay is involved on a page
  // with real scroll height — it can leave the fixed overlay positioned
  // or painted against the pre-lock document instead of the current
  // viewport. Freezing body in place with position:fixed at its current
  // scroll offset (then restoring scroll on unlock) is the standard,
  // robust alternative.
  var lockedScrollY = 0;
  function lockScroll() {
    lockedScrollY = window.scrollY;
    document.body.style.top = -lockedScrollY + 'px';
    document.body.classList.add('menu-open');
  }
  function unlockScroll() {
    document.body.classList.remove('menu-open');
    document.body.style.top = '';
    window.scrollTo(0, lockedScrollY);
  }

  /* ---------- Mobile nav overlay ---------- */
  var toggle = document.getElementById('menuToggle');
  var overlay = document.getElementById('navOverlay');
  if (toggle && overlay) {
    toggle.addEventListener('click', function () {
      var open = overlay.classList.toggle('is-open');
      toggle.classList.toggle('is-active', open);
      if (open) lockScroll();
      else unlockScroll();
      toggle.setAttribute('aria-expanded', String(open));
    });
    overlay.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        overlay.classList.remove('is-open');
        toggle.classList.remove('is-active');
        unlockScroll();
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
        overlay.classList.remove('is-open');
        toggle.classList.remove('is-active');
        unlockScroll();
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
    var lightboxStage = document.getElementById('lightboxStage');
    var lightboxImg = document.getElementById('lightboxImg');
    var lightboxCount = document.getElementById('lightboxCount');
    var closeBtn = document.getElementById('lightboxClose');
    var prevBtn = document.getElementById('lightboxPrev');
    var nextBtn = document.getElementById('lightboxNext');
    var thumbsEl = document.getElementById('lightboxThumbs');
    var current = 0;

    // Thumbnail filmstrip: built once from the same image list the
    // full-size viewer uses, so it's always in sync with no separate
    // source of truth.
    var thumbButtons = images.map(function (src, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lightbox__thumb';
      btn.setAttribute('aria-label', 'View photo ' + (i + 1) + ' of ' + images.length);
      var img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.loading = 'lazy';
      btn.appendChild(img);
      btn.addEventListener('click', function () {
        show(i);
      });
      thumbsEl.appendChild(btn);
      return btn;
    });

    function show(index) {
      current = (index + images.length) % images.length;
      lightboxImg.src = images[current];
      lightboxImg.alt = 'Photo ' + (current + 1) + ' of ' + images.length;
      lightboxCount.textContent = current + 1 + ' / ' + images.length;
      thumbButtons.forEach(function (btn, i) {
        btn.classList.toggle('is-active', i === current);
      });
      var activeThumb = thumbButtons[current];
      if (activeThumb && activeThumb.scrollIntoView) {
        activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
    // showModal() puts the <dialog> in the browser's top layer (see the
    // comment on lightbox() in generate.js) and makes it interactive;
    // .is-open only drives the opacity fade on top of that. rAF defers
    // adding the class a frame so the fade actually transitions from 0
    // instead of starting already at 1.
    function open(index) {
      show(index);
      lightbox.showModal();
      requestAnimationFrame(function () {
        lightbox.classList.add('is-open');
      });
      lockScroll();
    }
    function close() {
      lightbox.classList.remove('is-open');
      // Let the fade-out run before actually closing (which removes it from
      // the top layer immediately) instead of cutting it short.
      setTimeout(function () {
        if (lightbox.open) lightbox.close();
      }, 300);
    }
    // Fires for every path a <dialog> can close through — our close()
    // above, or the browser's own native Escape handling — so scroll
    // unlock always happens exactly once regardless of which triggered it.
    lightbox.addEventListener('close', function () {
      lightbox.classList.remove('is-open');
      unlockScroll();
    });

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
    // Click the dimmed backdrop (outside the image/controls/filmstrip) to
    // close, same as before — now also covers the stage area around the
    // image, since that's no longer the same element as the lightbox root.
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox || e.target === lightboxStage) close();
    });
    // Escape is handled natively by the dialog itself; only arrow keys
    // need a listener here.
    document.addEventListener('keydown', function (e) {
      if (!lightbox.open) return;
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });
  }

  /* ---------- Email enquiry links: append the current page URL ---------- */
  // Each [data-role="email-enquiry"] link already ships a working
  // mailto: href (subject + body) rendered at build time, so it works with
  // JS disabled. Here we just enhance it by appending the visitor's actual
  // page URL to the body — more useful than anything guessable at build
  // time, and correct on any domain the site ends up hosted on.
  document.querySelectorAll('[data-role="email-enquiry"]').forEach(function (a) {
    var subject = a.getAttribute('data-subject') || '';
    var body = a.getAttribute('data-body') || '';
    var fullBody = body + (body ? '\n\n' : '') + window.location.href;
    var email = a.href.replace(/^mailto:/, '').split('?')[0];
    a.href = 'mailto:' + email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(fullBody);
  });
})();
