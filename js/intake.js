/**
 * Multi-step Florida Lemon Law intake.
 * Posts to the existing Formspree endpoint so current lead emails keep working.
 * Hard-screens Fla. Stat. § 681.102(9): rights period ends 24 months after original delivery.
 *
 * Locked funnel after a pass:
 *   1) Full document packet (DL, registration, lease/purchase, repair tickets)
 *   2) Fee explanation + reply “I want to proceed”
 *   3) Engagement letter for electronic signature
 *   4) Signed engagement → open the file
 *
 * Fees are ALL CONTINGENCY: no small upfront attorney fee, no retainer.
 * Manufacturer fee recovery when the statute allows; otherwise 30% of gross
 * recovery. Out-of-pocket items are costs disclosed in the engagement.
 *
 * Document packet: optional Google Form (upload only, Drive). This page never
 * posts binaries. Formspree is the text lead and must submit without an upload.
 *
 * TODO(esign): This repo has no recalde-portal, DocuSign, or other e-sign integration.
 * Do not invent one here. After the packet is in and the lead replies “I want to proceed”,
 * send the engagement agreement for e-signature through the firm’s existing portal
 * (recalde-portal.netlify.app lives in a different repo) or the current manual process.
 */
(function () {
  'use strict';

  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/mqegejrg';
  var DOCS_GOOGLE_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSei5FtsiCdXDqo9vn8Meu4mwtVosAs9VSMWX0OKjUOjwVWnKA/viewform';
  var DOCS_SEND_METHOD = 'Google Form offered (optional upload-only Drive)';
  var RIGHTS_MONTHS = 24;

  var US_STATES = [
    'Florida', 'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
    'Connecticut', 'Delaware', 'District of Columbia', 'Georgia', 'Hawaii', 'Idaho',
    'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
    'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
    'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
    'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
    'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee',
    'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
    'Wisconsin', 'Wyoming', 'Outside the United States'
  ];

  function parseISODate(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    var parts = value.split('-').map(Number);
    var dt = new Date(parts[0], parts[1] - 1, parts[2]);
    if (
      dt.getFullYear() !== parts[0] ||
      dt.getMonth() !== parts[1] - 1 ||
      dt.getDate() !== parts[2]
    ) {
      return null;
    }
    return dt;
  }

  function startOfToday() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function toISODate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /**
   * Rights period ends on the 24-month anniversary of original delivery.
   * The anniversary date itself is still inside the window.
   */
  function isOutsideRightsPeriod(isoDate, today) {
    var delivery = parseISODate(isoDate);
    if (!delivery) return null;
    var end = new Date(delivery.getFullYear(), delivery.getMonth(), delivery.getDate());
    end.setFullYear(end.getFullYear() + 2);
    var ref = today || startOfToday();
    return ref.getTime() > end.getTime();
  }

  function isFutureDate(isoDate, today) {
    var delivery = parseISODate(isoDate);
    if (!delivery) return null;
    var ref = today || startOfToday();
    return delivery.getTime() > ref.getTime();
  }

  function formatVehicle(year, make, model) {
    return [year, make, model].filter(Boolean).join(' ').trim() || 'vehicle';
  }

  function optionList(values, selected) {
    return values.map(function (value) {
      var sel = value === selected ? ' selected' : '';
      return '<option value="' + escapeAttr(value) + '"' + sel + '>' + escapeHtml(value) + '</option>';
    }).join('');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  function fieldId(prefix, name) {
    return prefix + '-' + name;
  }

  function googleFormCta(label) {
    return (
      '<a class="btn btn-primary btn-block intake-gform-cta" href="' +
      escapeAttr(DOCS_GOOGLE_FORM) +
      '" target="_blank" rel="noopener noreferrer" data-gform-cta>' +
      escapeHtml(label) +
      '</a>'
    );
  }

  function buildFormHtml(opts) {
    var p = opts.idPrefix;
    var compact = !!opts.compact;
    var source = opts.source || 'case-review';
    var subject = opts.subject || 'Auto Warranty Lawyer — Case Review';
    var yearId = fieldId(p, 'year');
    var makeId = fieldId(p, 'make');
    var modelId = fieldId(p, 'model');

    return (
      '<form action="' + FORMSPREE_ENDPOINT + '" method="POST" class="intake-form" data-intake novalidate>' +
        '<input type="hidden" name="_subject" value="' + escapeAttr(subject) + '">' +
        '<input type="hidden" name="form_source" value="' + escapeAttr(source) + '">' +
        '<input type="hidden" name="intake_status" value="">' +
        '<input type="hidden" name="rights_period_status" value="">' +
        '<input type="hidden" name="next_step" value="">' +
        '<input type="hidden" name="docs_required" value="Driver’s license; Vehicle registration; Lease or purchase contract; Repair tickets / repair orders">' +
        '<input type="hidden" name="docs_send_method" value="' + escapeAttr(DOCS_SEND_METHOD) + '">' +
        '<input type="hidden" name="docs_google_form" value="' + escapeAttr(DOCS_GOOGLE_FORM) + '">' +
        '<input type="hidden" name="fee_terms" value="All contingency. No upfront attorney fee. No retainer. If Lemon Law allows manufacturer fee recovery in addition to the client’s recovery, pursue that; otherwise 30% of gross recovery, not reduced by payoffs, mileage offsets, use deductions, or negative equity. Costs (if any) disclosed in engagement — not a retainer.">' +
        '<p class="intake-step-label" data-step-label>Step 1 of 4 — Delivery date</p>' +
        '<div class="intake-progress" aria-hidden="true">' +
          '<span class="intake-progress-step is-active" data-progress="1"></span>' +
          '<span class="intake-progress-line"></span>' +
          '<span class="intake-progress-step" data-progress="2"></span>' +
          '<span class="intake-progress-line"></span>' +
          '<span class="intake-progress-step" data-progress="3"></span>' +
          '<span class="intake-progress-line"></span>' +
          '<span class="intake-progress-step" data-progress="4"></span>' +
        '</div>' +

        '<div class="intake-panel" data-panel="1">' +
          '<div class="form-group">' +
            '<label for="' + fieldId(p, 'delivery_date') + '">Original delivery date</label>' +
            '<input type="date" id="' + fieldId(p, 'delivery_date') + '" name="delivery_date" required autocomplete="off">' +
            '<p class="intake-hint">The day you (or the first owner) took possession of the vehicle.</p>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="intake-check">' +
              '<input type="checkbox" name="delivery_date_unknown" value="I don\'t have the exact date" data-unknown-date>' +
              '<span>I don\'t have the exact date</span>' +
            '</label>' +
          '</div>' +
          '<div class="form-group" data-unknown-wrap hidden>' +
            '<label for="' + fieldId(p, 'delivery_window_guess') + '">Was it delivered to the first owner within the last 24 months?</label>' +
            '<select id="' + fieldId(p, 'delivery_window_guess') + '" name="delivery_window_guess">' +
              '<option value="">Select...</option>' +
              '<option value="Yes — within the last 24 months">Yes — within the last 24 months</option>' +
              '<option value="Not sure">Not sure</option>' +
              '<option value="No — more than 24 months ago">No — more than 24 months ago</option>' +
            '</select>' +
          '</div>' +
          '<div class="intake-row' + (compact ? ' intake-row-stack' : '') + '">' +
            '<div class="form-group">' +
              '<label for="' + fieldId(p, 'first_name') + '">First name</label>' +
              '<input type="text" id="' + fieldId(p, 'first_name') + '" name="first_name" autocomplete="given-name" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="' + fieldId(p, 'email') + '">Email</label>' +
              '<input type="email" id="' + fieldId(p, 'email') + '" name="email" autocomplete="email" required>' +
            '</div>' +
          '</div>' +
          '<div class="intake-row intake-row-3">' +
            '<div class="form-group">' +
              '<label for="' + yearId + '">Year</label>' +
              '<input type="text" id="' + yearId + '" name="year" inputmode="numeric" placeholder="2025" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="' + makeId + '">Make</label>' +
              '<input type="text" id="' + makeId + '" name="make" placeholder="Chevrolet" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="' + modelId + '">Model</label>' +
              '<input type="text" id="' + modelId + '" name="model" placeholder="Equinox" required>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="intake-panel" data-panel="2" hidden>' +
          '<div class="form-group">' +
            '<label for="' + fieldId(p, 'purchase_state') + '">State where you purchased or leased</label>' +
            '<select id="' + fieldId(p, 'purchase_state') + '" name="purchase_state" required>' +
              '<option value="">Select...</option>' +
              optionList(US_STATES, 'Florida') +
            '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="' + fieldId(p, 'purchase_type') + '">Purchase or lease?</label>' +
            '<select id="' + fieldId(p, 'purchase_type') + '" name="purchase_type" required>' +
              '<option value="">Select...</option>' +
              '<option value="Purchased new">Purchased new</option>' +
              '<option value="Leased new (1 year or longer)">Leased new (1 year or longer)</option>' +
              '<option value="Used">Used</option>' +
              '<option value="Not sure">Not sure</option>' +
            '</select>' +
          '</div>' +
        '</div>' +

        '<div class="intake-panel" data-panel="3" hidden>' +
          '<div class="intake-row">' +
            '<div class="form-group">' +
              '<label for="' + fieldId(p, 'repair_count') + '">Repair visits for the same problem</label>' +
              '<input type="text" id="' + fieldId(p, 'repair_count') + '" name="repair_count" inputmode="numeric" placeholder="e.g. 3" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="' + fieldId(p, 'days_out_of_service') + '">Total days out of service</label>' +
              '<input type="text" id="' + fieldId(p, 'days_out_of_service') + '" name="days_out_of_service" inputmode="numeric" placeholder="e.g. 15" required>' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="' + fieldId(p, 'issue') + '">What\'s wrong with the vehicle?</label>' +
            '<textarea id="' + fieldId(p, 'issue') + '" name="issue" rows="' + (compact ? '3' : '4') + '" placeholder="Symptoms, safety concerns, what the dealer has tried..." required></textarea>' +
          '</div>' +
        '</div>' +

        '<div class="intake-panel" data-panel="4" hidden>' +
          '<p class="intake-docs-lead">You can submit your case review now. Uploading documents is optional.</p>' +
          '<p class="intake-hint">If you have them, upload:</p>' +
          '<ul class="intake-doc-list">' +
            '<li>Driver’s license</li>' +
            '<li>Vehicle registration</li>' +
            '<li>Lease or purchase contract</li>' +
            '<li>Repair tickets / repair orders</li>' +
          '</ul>' +
          '<p class="intake-docs-secure">The Google Form is upload only — no name, email, or vehicle questions. Attach the files in one field. Files go to the firm’s Google Drive only — they are not attached to this case-review email.</p>' +
          googleFormCta('Upload your packet') +
          '<p class="intake-gform-note">Opens in a new tab. Google requires you to be signed into a Google account only if you attach files. You do not have to upload before submitting this case review.</p>' +
        '</div>' +

        '<div class="form-error" data-intake-error hidden></div>' +

        '<div class="intake-actions">' +
          '<button type="button" class="btn btn-outline intake-back" data-back hidden>Back</button>' +
          '<button type="button" class="btn btn-primary btn-block intake-next" data-next>Continue</button>' +
          '<button type="submit" class="btn btn-primary btn-block" data-submit hidden>Submit my case review</button>' +
        '</div>' +
        '<p class="form-note">Submitting this form does not create an attorney-client relationship. All information is kept confidential. We accept Florida Lemon Law cases for vehicles within the 24-month Lemon Law Rights Period (Fla. Stat. § 681.102(9)).</p>' +
        '<div class="intake-hp" aria-hidden="true">' +
          '<input type="text" name="_gotcha" class="intake-hp-input" tabindex="-1" autocomplete="off">' +
        '</div>' +
      '</form>'
    );
  }

  function declineHtml(firstName, vehicle) {
    var greeting = firstName ? 'Hi ' + escapeHtml(firstName) + ',' : 'Hi,';
    return (
      '<div class="intake-result intake-result-decline" role="status">' +
        '<p class="intake-result-kicker">Outside the 24-month window</p>' +
        '<h3>We can’t take this as a Florida Lemon Law case</h3>' +
        '<p>' + greeting + '</p>' +
        '<p>Thank you for reaching out about your ' + escapeHtml(vehicle) + '.</p>' +
        '<p>Florida’s Lemon Law rights period generally ends 24 months after the vehicle’s original delivery date (Fla. Stat. § 681.102(9)). Based on what you shared, this matter falls outside that window.</p>' +
        '<p>If you have a different original delivery date, email <a href="mailto:rafael@recaldelaw.com">rafael@recaldelaw.com</a> with that date and the purchase or lease documents and we’ll take another look.</p>' +
        '<p class="intake-signoff">Recalde Law Firm, P.A.<br>By: Rafael Recalde, Esq.</p>' +
      '</div>'
    );
  }

  function successHtml(firstName, vehicle) {
    var greeting = firstName ? 'Hi ' + escapeHtml(firstName) + ',' : 'Hi,';
    return (
      '<div class="intake-result intake-result-ok" role="status">' +
        '<h3>Your case review is in</h3>' +
        '<p>' + greeting + '</p>' +
        '<p>Thank you for contacting Recalde Law Firm about your ' + escapeHtml(vehicle) + '.</p>' +
        '<p>Your contact details were sent to the firm. Files are not attached to that email.</p>' +
        '<p>If you have the packet, upload driver’s license, registration, lease or purchase contract, and repair tickets. The Google Form is upload only — no name, email, or vehicle questions. Files go to the firm’s Google Drive only:</p>' +
        '<p>' + googleFormCta('Upload your packet') + '</p>' +
        '<p>We will not send an engagement agreement until this packet is in. After we have it, we’ll explain fees. Reply “I want to proceed” only then — we’ll send the agreement for electronic signature and open the file after it’s signed.</p>' +
        '<p class="intake-signoff">Recalde Law Firm, P.A.<br>By: Rafael Recalde, Esq.</p>' +
      '</div>'
    );
  }

  function setError(form, message) {
    var box = form.querySelector('[data-intake-error]');
    if (!box) return;
    if (!message) {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    box.hidden = false;
    box.textContent = message;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function panelFields(panel) {
    return Array.prototype.slice.call(
      panel.querySelectorAll('input, select, textarea')
    ).filter(function (el) {
      if (el.disabled || el.type === 'hidden' || el.type === 'file' || el.classList.contains('intake-hp') || el.classList.contains('intake-hp-input') || el.name === '_gotcha') return false;
      if (el.closest('.intake-hp')) return false;
      if (el.closest('[hidden]')) return false;
      return true;
    });
  }

  function validatePanel(panel, skipNames) {
    var skip = skipNames || {};
    var fields = panelFields(panel);
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      if (skip[el.name]) continue;
      if (!el.checkValidity()) {
        el.reportValidity();
        return false;
      }
    }
    return true;
  }

  function classifyWindow(form) {
    var unknown = form.querySelector('[data-unknown-date]');
    var dateInput = form.querySelector('input[name="delivery_date"]');
    var guess = form.querySelector('select[name="delivery_window_guess"]');

    if (unknown && unknown.checked) {
      var g = guess ? guess.value : '';
      if (g === 'No — more than 24 months ago') return 'out_of_window';
      if (g === 'Not sure') return 'not_sure';
      if (g === 'Yes — within the last 24 months') return 'in_window';
      return 'incomplete';
    }

    if (dateInput && dateInput.validity && dateInput.validity.badInput) return 'bad_date';
    var iso = dateInput ? dateInput.value : '';
    if (!iso) return 'incomplete';
    if (isFutureDate(iso)) return 'future';
    if (isOutsideRightsPeriod(iso)) return 'out_of_window';
    return 'in_window';
  }

  function subjectFor(status, baseSubject) {
    if (status === 'out_of_window') {
      return baseSubject + ' — Outside 24-month window';
    }
    if (status === 'not_sure') {
      return baseSubject + ' — Delivery date not confirmed';
    }
    return baseSubject;
  }

  function formValue(form, name) {
    var el = form.elements[name];
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked ? String(el.value || '').trim() : '';
    return (el.value && String(el.value).trim()) || '';
  }

  function gatherDocs() {
    return [
      'Packet to include if uploading: driver’s license; vehicle registration; lease or purchase contract; repair tickets / repair orders',
      'Send method: ' + DOCS_SEND_METHOD + ' — upload only, no name/email/vehicle questions: ' + DOCS_GOOGLE_FORM,
      'Files: none attached to this Formspree email. Upload was not required to submit this lead.'
    ].join(' | ');
  }

  function postAcceptJson(url, data) {
    return fetch(url, {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        return { ok: !!res.ok, status: res.status, body: body };
      });
    }).catch(function () {
      return { ok: false, status: 0, body: {} };
    });
  }

  /**
   * Formspree free/basic drops file binaries. This intake never uploads
   * files from the browser. Step 4 sends the client to a Google Form
   * (Drive). The Formspree payload is text only — never claim files were
   * attached.
   */
  function buildLeadData(form) {
    var data = new FormData(form);
    data.delete('_gotcha');
    data.delete('documents');
    data.delete('attachment');
    data.delete('vin');
    data.set('name', formValue(form, 'first_name'));
    data.set('vehicle', [formValue(form, 'year'), formValue(form, 'make'), formValue(form, 'model')].filter(Boolean).join(' '));
    data.set('uploaded_files', 'none — not attached to Formspree');

    if (formValue(form, 'intake_status') === 'out_of_window') {
      data.set('docs_send_method', 'Not requested — declined outside 24-month window');
      data.set('docs', 'Documents not requested. Matter declined as outside 24-month window. This Formspree email has no file attachments.');
      data.set('file_delivery', 'No files. This Formspree email has no attachments.');
      data.delete('docs_google_form');
    } else {
      data.set('docs_send_method', DOCS_SEND_METHOD);
      data.set('docs', gatherDocs());
      data.set('docs_google_form', DOCS_GOOGLE_FORM);
      data.set(
        'file_delivery',
        'No files attached to this Formspree email. Google Form (upload only) was offered; upload is optional and was not required to submit this lead.'
      );
    }
    return data;
  }

  function postTextLead(form) {
    return postAcceptJson(form.action || FORMSPREE_ENDPOINT, buildLeadData(form)).then(function (res) {
      return !!res.ok;
    });
  }

  function postLead(form) {
    var gotcha = form.querySelector('input[name="_gotcha"], .intake-hp-input');
    if (gotcha && gotcha.value) {
      return Promise.resolve({ ok: true, skipped: true });
    }
    return postTextLead(form).then(function (ok) {
      if (!ok) throw new Error('Unable to submit right now.');
      return { ok: true };
    });
  }

  function cardFor(mount) {
    return (mount && (mount.closest('.hero-form') || mount.closest('.cr-wrap'))) || mount;
  }

  function hideCardChrome(mount) {
    var card = cardFor(mount);
    if (!card) return;
    Array.prototype.forEach.call(card.children, function (el) {
      if (el === mount || (el.tagName && el.tagName.toLowerCase() === 'noscript')) return;
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
    });
  }

  function scrollCardIntoView(mount) {
    var card = cardFor(mount);
    if (!card) return;
    var nav = document.getElementById('nav');
    var callbar = document.querySelector('.callbar');
    var offset = 20 + (nav ? nav.offsetHeight : 0) + (callbar ? callbar.offsetHeight : 0);
    var top = card.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  }

  function replaceWith(mount, html) {
    hideCardChrome(mount);
    mount.innerHTML = html;
    scrollCardIntoView(mount);
  }

  function initForm(mount) {
    var prefix = mount.getAttribute('data-id-prefix') || 'intake';
    var source = mount.getAttribute('data-intake-source') || 'case-review';
    var subject = mount.getAttribute('data-intake-subject') || 'Auto Warranty Lawyer — Case Review';
    var compact = mount.getAttribute('data-compact') === 'true';

    mount.innerHTML = buildFormHtml({
      idPrefix: prefix,
      source: source,
      subject: subject,
      compact: compact
    });

    var form = mount.querySelector('form[data-intake]');
    if (!form) return;

    var step = 1;
    var total = 4;
    var submitting = false;
    var labels = [
      'Step 1 of 4 — Delivery date',
      'Step 2 of 4 — Vehicle details',
      'Step 3 of 4 — Repair history',
      'Step 4 of 4 — Document packet'
    ];
    var leads = [
      'A few questions, starting with the original delivery date. If you’re in the 24-month window, we’ll take the rest of the facts and you can submit — uploading documents is optional.',
      'Next: the state of purchase or lease, and whether this was a purchase or a lease.',
      'How many repair visits for the same problem, and how long the vehicle was out of service.',
      'You can submit now. Uploading your packet is optional and can be done after you send this review.'
    ];

    var unknown = form.querySelector('[data-unknown-date]');
    var unknownWrap = form.querySelector('[data-unknown-wrap]');
    var dateInput = form.querySelector('input[name="delivery_date"]');
    var guess = form.querySelector('select[name="delivery_window_guess"]');
    var backBtn = form.querySelector('[data-back]');
    var nextBtn = form.querySelector('[data-next]');
    var submitBtn = form.querySelector('[data-submit]');
    var stepLabel = form.querySelector('[data-step-label]');
    var statusInput = form.querySelector('input[name="intake_status"]');
    var rightsInput = form.querySelector('input[name="rights_period_status"]');
    var nextStepInput = form.querySelector('input[name="next_step"]');
    var subjectInput = form.querySelector('input[name="_subject"]');

    function updateLead(n) {
      var lead = cardFor(mount).querySelector('[data-intake-lead]');
      if (lead && leads[n - 1]) lead.textContent = leads[n - 1];
    }

    function showPanel(n, opts) {
      opts = opts || {};
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      step = n;
      form.querySelectorAll('[data-panel]').forEach(function (panel) {
        var id = Number(panel.getAttribute('data-panel'));
        var on = id === n;
        panel.hidden = !on;
        panel.classList.toggle('is-hidden-panel', !on);
        panel.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      form.querySelectorAll('[data-progress]').forEach(function (dot) {
        var id = Number(dot.getAttribute('data-progress'));
        dot.classList.toggle('is-active', id === n);
        dot.classList.toggle('is-done', id < n);
      });
      if (stepLabel) stepLabel.textContent = labels[n - 1];
      updateLead(n);
      backBtn.hidden = n === 1;
      nextBtn.hidden = n === total;
      submitBtn.hidden = n !== total;
      backBtn.classList.toggle('is-hidden', n === 1);
      nextBtn.classList.toggle('is-hidden', n === total);
      submitBtn.classList.toggle('is-hidden', n !== total);
      nextBtn.classList.toggle('btn-block', n === 1);
      setError(form, '');
      if (!opts.silent) scrollCardIntoView(mount);
    }

    function vehicle() {
      return formatVehicle(
        form.elements.year && form.elements.year.value,
        form.elements.make && form.elements.make.value,
        form.elements.model && form.elements.model.value
      );
    }

    function firstName() {
      return (form.elements.first_name && form.elements.first_name.value.trim()) || '';
    }

    function applyStatus(status) {
      if (statusInput) statusInput.value = status;
      if (rightsInput) {
        if (status === 'out_of_window') {
          rightsInput.value = 'Outside 24-month Lemon Law Rights Period (Fla. Stat. § 681.102(9))';
        } else if (status === 'not_sure') {
          rightsInput.value = 'Delivery date not confirmed — needs follow-up';
        } else {
          rightsInput.value = 'Looks inside 24-month Lemon Law Rights Period';
        }
      }
      if (nextStepInput) {
        if (status === 'out_of_window') {
          nextStepInput.value = 'Declined — do not request documents or send engagement.';
        } else {
          nextStepInput.value = 'Lead in. VIN not collected. Optional Google Form (upload only) for packet: driver’s license, vehicle registration, lease or purchase contract, repair tickets. This Formspree email has no file attachments. Do NOT send engagement or fee-to-sign until the packet is in. Then explain fees; if they reply “I want to proceed”, send engagement for e-sign (TODO: no e-sign/portal in this repo — use existing recalde-portal or manual send). Signed engagement → open file.';
        }
      }
      if (subjectInput) subjectInput.value = subjectFor(status, subject);
    }

    function showDeclineAndSubmit() {
      applyStatus('out_of_window');
      var name = firstName();
      var veh = vehicle();
      var pending = postLead(form);
      replaceWith(mount, declineHtml(name, veh));
      pending.catch(function () {
        /* Decline copy is still correct even if the notification fails. */
      });
    }

    if (unknown) {
      unknown.addEventListener('change', function () {
        var on = unknown.checked;
        if (unknownWrap) unknownWrap.hidden = !on;
        if (dateInput) {
          dateInput.required = !on;
          dateInput.disabled = on;
          if (on) dateInput.value = '';
        }
        if (guess) guess.required = on;
      });
    }

    if (dateInput) {
      dateInput.setAttribute('max', toISODate(startOfToday()));
      dateInput.setAttribute('min', '2000-01-01');
    }

    nextBtn.addEventListener('click', function () {
      var panel = form.querySelector('[data-panel="' + step + '"]');
      if (step === 1) {
        if (!validatePanel(panel, { delivery_date: true, delivery_window_guess: true })) return;
        var status = classifyWindow(form);
        if (status === 'incomplete' || status === 'bad_date') {
          setError(form, 'Choose the original delivery date from the calendar, or check the box if you don’t have the exact date.');
          return;
        }
        if (status === 'future') {
          setError(form, 'The delivery date can’t be in the future. Please enter the date you took possession.');
          return;
        }
        if (status === 'out_of_window') {
          showDeclineAndSubmit();
          return;
        }
        applyStatus(status);
      } else if (!validatePanel(panel)) {
        return;
      }

      showPanel(step + 1);
    });

    backBtn.addEventListener('click', function () {
      if (step > 1) showPanel(step - 1);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitting) return;
      if (step !== total) {
        nextBtn.click();
        return;
      }
      var panel = form.querySelector('[data-panel="' + step + '"]');
      if (!validatePanel(panel)) return;

      var status = classifyWindow(form);
      if (status === 'out_of_window') {
        showDeclineAndSubmit();
        return;
      }
      if (status === 'incomplete' || status === 'future' || status === 'bad_date') {
        showPanel(1);
        setError(form, 'Please confirm the original delivery date before submitting.');
        return;
      }

      applyStatus(status);
      submitting = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      postLead(form).then(function () {
        replaceWith(mount, successHtml(firstName(), vehicle()));
      }).catch(function (err) {
        submitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit my case review';
        setError(form, (err && err.message) || 'We couldn’t send your review just now. Please try again, or email rafael@recaldelaw.com with the same details.');
      });
    });

    showPanel(1, { silent: true });
  }

  function initMounts() {
    document.querySelectorAll('[data-intake-mount]').forEach(initForm);
  }

  window.LemonIntake = {
    isOutsideRightsPeriod: isOutsideRightsPeriod,
    isFutureDate: isFutureDate,
    parseISODate: parseISODate,
    classifyWindow: classifyWindow,
    gatherDocs: gatherDocs,
    DOCS_GOOGLE_FORM: DOCS_GOOGLE_FORM,
    DOCS_SEND_METHOD: DOCS_SEND_METHOD,
    RIGHTS_MONTHS: RIGHTS_MONTHS,
    init: initMounts
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMounts);
  } else {
    initMounts();
  }
})();
