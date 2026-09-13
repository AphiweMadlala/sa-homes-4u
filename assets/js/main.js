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

  /* ---------- Property filters (properties.html) ---------- */
  var grid = document.getElementById('propertyGrid');
  if (grid) {
    var cards = Array.prototype.slice.call(grid.querySelectorAll('[data-filter-card]'));
    var fLocation = document.getElementById('fLocation');
    var fType = document.getElementById('fType');
    var fBedrooms = document.getElementById('fBedrooms');
    var fMin = document.getElementById('fMin');
    var fMax = document.getElementById('fMax');
    var resetBtn = document.getElementById('filterReset');
    var resultsCount = document.getElementById('resultsCount');
    var emptyState = document.getElementById('emptyState');

    function applyFilters() {
      var loc = fLocation.value;
      var type = fType.value;
      var minBeds = fBedrooms.value ? parseInt(fBedrooms.value, 10) : null;
      var min = fMin.value ? parseInt(fMin.value, 10) : null;
      var max = fMax.value ? parseInt(fMax.value, 10) : null;

      var visibleCount = 0;
      cards.forEach(function (card) {
        var matchLoc = !loc || card.dataset.location === loc;
        var matchType = !type || card.dataset.type === type;
        var beds = parseInt(card.dataset.bedrooms, 10);
        var matchBeds = minBeds == null || beds >= minBeds;
        var price = parseInt(card.dataset.price, 10);
        var matchMin = min == null || price >= min;
        var matchMax = max == null || price <= max;
        var visible = matchLoc && matchType && matchBeds && matchMin && matchMax;
        card.hidden = !visible;
        if (visible) visibleCount++;
      });

      resultsCount.textContent =
        visibleCount === cards.length
          ? 'Showing all ' + cards.length + ' properties'
          : 'Showing ' + visibleCount + ' of ' + cards.length + ' properties';
      emptyState.hidden = visibleCount !== 0;
    }

    [fLocation, fType, fBedrooms, fMin, fMax].forEach(function (el) {
      el.addEventListener('change', applyFilters);
    });
    resetBtn.addEventListener('click', function () {
      [fLocation, fType, fBedrooms, fMin, fMax].forEach(function (el) {
        el.value = '';
      });
      applyFilters();
    });

    // Support deep-linking via query string, e.g. properties.html?location=...
    var params = new URLSearchParams(window.location.search);
    if (params.get('location')) fLocation.value = params.get('location');
    if (params.get('bedrooms')) fBedrooms.value = params.get('bedrooms');
    applyFilters();
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
  var sellForm = document.querySelector('[data-role="sell-form"]');
  if (sellForm && window.__SELL_WHATSAPP__) {
    sellForm.addEventListener('submit', function (e) {
      e.preventDefault();
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
    });
  }

  /* ---------- Contact form -> mailto handoff ---------- */
  var contactForm = document.querySelector('.contact-form:not([data-role])');
  if (contactForm && window.__CONTACT_EMAIL__ && document.getElementById('contactSubmit')) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
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
    });
  }
})();
