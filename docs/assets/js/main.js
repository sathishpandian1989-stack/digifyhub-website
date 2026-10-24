(function () {
  'use strict';

  document.documentElement.classList.add('js');
  var config = window.DIGIFYHUB_CONFIG || {};

  /* ---------- Header: scrolled state + mobile menu ---------- */
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');

  function onScroll() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 10);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1120 && nav.classList.contains('is-open')) setMenu(false);
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Hero video: drop it if the file is missing or blocked ---------- */
  var video = document.querySelector('.hero-video');
  if (video) {
    var source = video.querySelector('source');
    var dropVideo = function () { video.remove(); };
    if (source) source.addEventListener('error', dropVideo);
    video.addEventListener('error', dropVideo);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) video.pause();
  }

  /* ---------- Blog category filter ---------- */
  var filterRow = document.querySelector('[data-filter]');
  if (filterRow) {
    var posts = document.querySelectorAll('[data-category]');
    filterRow.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      filterRow.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      var cat = btn.dataset.value;
      posts.forEach(function (p) { p.hidden = cat !== 'all' && p.dataset.category !== cat; });
    });
  }

  /* ---------- Entrepreneur checklist progress (remembered on this device) ---------- */
  var checklist = document.querySelector('[data-checklist]');
  if (checklist) {
    var boxes = checklist.querySelectorAll('input[type="checkbox"]');
    var bar = document.querySelector('[data-checklist-bar]');
    var label = document.querySelector('[data-checklist-label]');
    var KEY = 'dh-checklist';
    var saved = [];
    try { saved = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { saved = []; }
    var update = function () {
      var done = 0, state = [];
      boxes.forEach(function (b, i) { if (b.checked) { done++; state.push(i); } });
      if (bar) bar.style.width = (done / boxes.length * 100) + '%';
      if (label) label.textContent = done + ' of ' + boxes.length + ' steps complete';
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
    };
    boxes.forEach(function (b, i) { b.checked = saved.indexOf(i) !== -1; b.addEventListener('change', update); });
    update();
  }

  /* ---------- Lead form ---------- */
  var ICON_ERR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16.5v.01"/></svg>';
  var ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE_CHARS_RE = /^\+?[\d\s\-().]{7,20}$/;

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function validate(data) {
    var errors = {};
    if (!data.name) errors.name = 'Please enter your name.';
    else if (data.name.length < 2) errors.name = 'Please enter your full name.';
    var digits = data.phone.replace(/\D/g, '');
    if (!data.phone) errors.phone = 'Please enter your phone number.';
    else if (!PHONE_CHARS_RE.test(data.phone) || digits.length < 7 || digits.length > 15) errors.phone = 'Please enter a valid phone number, including country code if outside India.';
    if (!data.email) errors.email = 'Please enter your email address.';
    else if (!EMAIL_RE.test(data.email)) errors.email = 'Please enter a valid email address, e.g. name@company.com.';
    if (!data.business) errors.business = 'Please enter your business name.';
    if (data.message.length > 1000) errors.message = 'Please keep your message under 1000 characters.';
    if (!data.consent) errors.consent = 'Please confirm you agree so we can respond to your enquiry.';
    return errors;
  }

  function initForm(form) {
    var btn = form.querySelector('button[type="submit"]');
    var btnLabel = btn.querySelector('.btn-label');
    var statusBox = form.querySelector('.form-status');
    var msg = form.querySelector('[name="message"]');
    var counter = form.querySelector('#lf-message-count');
    var startedAt = Date.now();
    // One key per enquiry: a retry after a timeout reuses it so the server can de-duplicate.
    var submissionKey = uuid();
    var busy = false;

    if (msg && counter) {
      msg.addEventListener('input', function () { counter.textContent = msg.value.length + ' / 1000'; });
    }

    function fieldEl(name) { return form.elements[name]; }
    function setError(name, text) {
      var el = fieldEl(name);
      var err = form.querySelector('#lf-' + name + '-err');
      if (el) el.setAttribute('aria-invalid', text ? 'true' : 'false');
      if (err) err.textContent = text || '';
    }
    function clearErrors() {
      ['name', 'phone', 'email', 'business', 'service', 'message', 'consent'].forEach(function (n) { setError(n, ''); });
    }
    function showErrors(errors) {
      var first = null;
      Object.keys(errors).forEach(function (k) {
        setError(k, errors[k]);
        if (!first && fieldEl(k)) first = fieldEl(k);
      });
      if (first) first.focus();
    }
    function showStatus(html) {
      statusBox.innerHTML = html;
      statusBox.focus({ preventScroll: true });
    }
    function setBusy(on) {
      busy = on;
      btn.disabled = on;
      form.classList.toggle('is-submitting', on);
      btnLabel.textContent = on ? 'Submitting…' : 'Submit My Enquiry';
    }
    function fallbackContact() {
      return ' You can also reach us directly on <a href="https://wa.me/918610458908" target="_blank" rel="noopener">WhatsApp</a>, by phone at <a href="tel:+918610458908">+91 8610458908</a> or by email at <a href="mailto:sathishpandian1989@gmail.com">sathishpandian1989@gmail.com</a>.';
    }
    function showFailure(text) {
      showStatus('<div class="msg error">' + ICON_ERR + '<p>' + text + fallbackContact() + '</p></div>');
    }

    // Re-validate a field once the visitor has corrected it.
    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true') {
        var errs = validate(readData());
        setError(e.target.name, errs[e.target.name] || '');
      }
    });
    form.addEventListener('change', function (e) {
      if (e.target.name === 'consent' && e.target.checked) setError('consent', '');
    });

    function readData() {
      return {
        name: fieldEl('name').value.trim(),
        phone: fieldEl('phone').value.trim(),
        email: fieldEl('email').value.trim(),
        business: fieldEl('business').value.trim(),
        service: fieldEl('service').value,
        message: fieldEl('message').value.trim(),
        consent: fieldEl('consent').checked,
        website: fieldEl('website').value, // honeypot
      };
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return; // ignore double-clicks while a request is in flight
      statusBox.innerHTML = '';
      clearErrors();

      var data = readData();
      var errors = validate(data);
      if (Object.keys(errors).length) { showErrors(errors); return; }

      if (!config.FORM_ENDPOINT) {
        showFailure('Our enquiry form is being connected right now, so we couldn\'t send this message.');
        return;
      }

      var payload = Object.assign({}, data, {
        submissionKey: submissionKey,
        landingPage: form.dataset.landing || location.pathname,
        pageUrl: location.href.split('#')[0],
        referrer: document.referrer || '',
        fillTimeMs: Date.now() - startedAt,
      });

      setBusy(true);
      var controller = 'AbortController' in window ? new AbortController() : null;
      var timer = setTimeout(function () { if (controller) controller.abort(); }, config.REQUEST_TIMEOUT_MS || 25000);

      // text/plain keeps this a "simple" request, which Apps Script web apps accept without a CORS preflight.
      fetch(config.FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined,
        redirect: 'follow',
      })
        .then(function (res) {
          return res.json().catch(function () { return { ok: false, code: 'BAD_RESPONSE' }; });
        })
        .then(function (res) {
          clearTimeout(timer);
          setBusy(false);
          if (res && res.ok) {
            onSuccess(res);
          } else if (res && res.code === 'VALIDATION' && res.errors) {
            showErrors(res.errors);
            showFailure('Please check the highlighted fields and try again.');
          } else if (res && res.code === 'RATE_LIMITED') {
            showFailure('We\'ve received several enquiries from these details in a short time. Please wait a few minutes before trying again.');
          } else {
            showFailure('Sorry — something went wrong on our side and your enquiry was <strong>not</strong> saved' + (res && res.ref ? ' (reference ' + escapeHtml(res.ref) + ')' : '') + '. Please try again in a moment.');
          }
        })
        .catch(function () {
          clearTimeout(timer);
          setBusy(false);
          showFailure('We couldn\'t confirm that your enquiry reached us — please check your connection and press submit again. Retrying won\'t create a duplicate.');
        });
    });

    function onSuccess(res) {
      if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead', { form_location: form.dataset.landing });
      var name = escapeHtml(readData().name.split(' ')[0] || 'there');
      var wrap = form.parentNode;
      var box = document.createElement('div');
      box.className = 'form-success';
      box.setAttribute('role', 'status');
      box.setAttribute('tabindex', '-1');
      box.innerHTML =
        '<div class="tick">' + ICON_OK + '</div>' +
        '<h3>Thank you, ' + name + '! Your enquiry is in.</h3>' +
        '<p>' + (res.duplicate ? 'We already have this enquiry on file — no need to send it again.' : 'We\'ve received your details and will get back to you using the contact information you shared.') + '</p>' +
        (res.leadId ? '<p class="muted" style="margin-bottom:4px">Your reference</p><div class="ref">' + escapeHtml(res.leadId) + '</div>' : '') +
        '<p><a class="link-arrow" href="https://wa.me/918610458908" target="_blank" rel="noopener">Need a faster reply? Message us on WhatsApp</a></p>';
      form.hidden = true;
      wrap.insertBefore(box, form.nextSibling);
      box.focus();
    }
  }

  document.querySelectorAll('[data-lead-form]').forEach(initForm);
})();
