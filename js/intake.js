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
 * TODO(esign): This repo has no recalde-portal, DocuSign, or other e-sign integration.
 * Do not invent one here. After the packet is in and the lead replies “I want to proceed”,
 * send the engagement agreement for e-signature through the firm’s existing portal
 * (recalde-portal.netlify.app lives in a different repo) or the current manual process.
 */
(function () {
  'use strict';

  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/mqegejrg';
  var DOCS_INBOX = 'https://formsubmit.co/ajax/rafael@recaldelaw.com';
  var LITTERBOX_ENDPOINT = 'https://litterbox.catbox.moe/resources/internals/api.php';
  var TMPFILES_ENDPOINT = 'https://tmpfiles.org/api/v1/upload';
  var FILEBIN_ORIGIN = 'https://filebin.net';
  var GOFILE_SERVERS = 'https://api.gofile.io/servers';
  var HOST_TIMEOUT_MS = 12000;
  var TMPFILES_EXPIRE_SECONDS = 172800;
  var MAX_INTAKE_FILES = 10;
  var MAX_FILE_BYTES = 10 * 1024 * 1024;
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

  function buildFormHtml(opts) {
    var p = opts.idPrefix;
    var compact = !!opts.compact;
    var source = opts.source || 'case-review';
    var subject = opts.subject || 'Auto Warranty Lawyer — Case Review';
    var yearId = fieldId(p, 'year');
    var makeId = fieldId(p, 'make');
    var modelId = fieldId(p, 'model');

    return (
      '<form action="' + FORMSPREE_ENDPOINT + '" method="POST" class="intake-form" data-intake novalidate enctype="multipart/form-data">' +
        '<input type="hidden" name="_subject" value="' + escapeAttr(subject) + '">' +
        '<input type="hidden" name="form_source" value="' + escapeAttr(source) + '">' +
        '<input type="hidden" name="intake_status" value="">' +
        '<input type="hidden" name="rights_period_status" value="">' +
        '<input type="hidden" name="next_step" value="">' +
        '<input type="hidden" name="docs_required" value="Driver’s license; Vehicle registration; Lease or purchase contract; Repair tickets / repair orders">' +
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
              '<input type="text" id="' + makeId + '" name="make" placeholder="Tesla" required>' +
            '</div>' +
            '<div class="form-group">' +
              '<label for="' + modelId + '">Model</label>' +
              '<input type="text" id="' + modelId + '" name="model" placeholder="Model Y" required>' +
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
            '<label for="' + fieldId(p, 'vin') + '">VIN</label>' +
            '<input type="text" id="' + fieldId(p, 'vin') + '" name="vin" maxlength="20" autocomplete="off" placeholder="17-character VIN" required>' +
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
          '<p class="intake-docs-lead">To finish the evaluation, send this packet — email or upload:</p>' +
          '<ul class="intake-doc-list">' +
            '<li>Driver’s license</li>' +
            '<li>Vehicle registration</li>' +
            '<li>Lease or purchase contract</li>' +
            '<li>Repair tickets / repair orders</li>' +
          '</ul>' +
          '<p class="intake-hint">This step is the packet only — not a signature. After the documents are in, we’ll explain fees. If you then reply “I want to proceed,” we’ll send the engagement agreement for electronic signature.</p>' +
          '<fieldset class="intake-fieldset">' +
            '<legend>How will you send them?</legend>' +
            '<label class="intake-check"><input type="radio" name="docs_send_method" value="Upload now"><span>Upload what I have now</span></label>' +
            '<label class="intake-check"><input type="radio" name="docs_send_method" value="Email to rafael@recaldelaw.com" checked><span>I’ll email them to rafael@recaldelaw.com</span></label>' +
          '</fieldset>' +
          '<div class="form-group">' +
            '<label for="' + fieldId(p, 'attachment') + '">Upload files <span class="intake-optional">(PDF or photos — download links go to the review email)</span></label>' +
            '<input type="file" id="' + fieldId(p, 'attachment') + '" name="attachment" data-intake-files multiple accept="image/*,.pdf,application/pdf">' +
            '<p class="intake-file-list" data-file-list hidden></p>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="intake-check">' +
              '<input type="checkbox" name="docs_packet_ack" value="Understood: full packet required before engagement" required>' +
              '<span>I understand the firm needs this packet before fee terms or an engagement agreement.</span>' +
            '</label>' +
          '</div>' +
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

  function successHtml(firstName, vehicle, fileStatus) {
    var greeting = firstName ? 'Hi ' + escapeHtml(firstName) + ',' : 'Hi,';
    var fileNote = '';
    if (fileStatus && fileStatus.requested) {
      if (fileStatus.delivered) {
        fileNote = '<p>We received the file(s) you uploaded with this review: ' + escapeHtml(fileStatus.names || 'uploaded files') + '.</p>';
      } else {
        fileNote = '<p class="intake-file-warn"><strong>Your review was sent, but the files you selected could not be attached to the notification.</strong> Please email the packet to <a href="mailto:rafael@recaldelaw.com">rafael@recaldelaw.com</a> now so the evaluation can continue.</p>';
      }
    }
    return (
      '<div class="intake-result intake-result-ok" role="status">' +
        '<h3>Your case review is in</h3>' +
        '<p>' + greeting + '</p>' +
        '<p>Thank you for contacting Recalde Law Firm about your ' + escapeHtml(vehicle) + '.</p>' +
        fileNote +
        '<p>Next step: send the full document packet so we can finish the evaluation. Email it to <a href="mailto:rafael@recaldelaw.com">rafael@recaldelaw.com</a> if anything is still missing:</p>' +
        '<ul class="intake-doc-list">' +
          '<li>Driver’s license</li>' +
          '<li>Vehicle registration</li>' +
          '<li>Lease or purchase contract</li>' +
          '<li>Repair tickets / repair orders</li>' +
        '</ul>' +
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

  function selectedFiles(form) {
    var input = form.querySelector('[data-intake-files], input[name="attachment"]');
    if (!input || !input.files) return [];
    return Array.prototype.slice.call(input.files, 0, MAX_INTAKE_FILES);
  }

  function describeFiles(files) {
    if (!files || !files.length) return 'None uploaded on this submit';
    return Array.prototype.map.call(files, function (f) {
      return (f.name || 'file') + ' (' + Math.round((f.size || 0) / 1024) + ' KB)';
    }).join('; ');
  }

  var UPLOAD_FAILED_MSG = 'Upload failed — email the packet to rafael@recaldelaw.com';

  function wantsUploadNow(form) {
    var method = form.querySelector('input[name="docs_send_method"]:checked');
    return !!(method && method.value === 'Upload now');
  }

  function isTrustedFileHost(hostname) {
    var host = String(hostname || '').toLowerCase();
    if (host.indexOf('www.') === 0) host = host.slice(4);
    return host === 'litter.catbox.moe' ||
      host === 'litterbox.catbox.moe' ||
      host === 'files.catbox.moe' ||
      host === 'tmpfiles.org' ||
      host === 'filebin.net' ||
      host === 'gofile.io';
  }

  function isHttpsDownloadUrl(value) {
    if (!value || typeof value !== 'string') return false;
    var trimmed = value.trim();
    if (!/^https:\/\/[^\s/$.?#].[^\s]*$/.test(trimmed)) return false;
    try {
      var parsed = new URL(trimmed);
      return parsed.protocol === 'https:' &&
        isTrustedFileHost(parsed.hostname) &&
        parsed.pathname &&
        parsed.pathname.length > 1;
    } catch (e) {
      return false;
    }
  }

  function firstHttpsUrl(text) {
    var match = String(text || '').match(/https:\/\/[^\s"'<>\\]+/);
    if (!match) return '';
    var url = match[0].replace(/[.,;)]+$/, '');
    return isHttpsDownloadUrl(url) ? url : '';
  }

  function countHttpsUrls(text) {
    var matches = String(text || '').match(/https:\/\/[^\s"'<>\\]+/g);
    if (!matches) return 0;
    var n = 0;
    for (var i = 0; i < matches.length; i++) {
      var url = matches[i].replace(/[.,;)]+$/, '');
      if (isHttpsDownloadUrl(url)) n += 1;
    }
    return n;
  }

  function hasDeliveredUrls(delivery, files) {
    if (!delivery || delivery.status !== 'delivered' || !files || !files.length) return false;
    return countHttpsUrls(delivery.links) >= files.length;
  }

  function fileDeliveryLine(files, delivery) {
    if (!files || !files.length) {
      return 'Files delivered: none. Client chose to email the packet.';
    }
    if (hasDeliveredUrls(delivery, files)) {
      return 'Files delivered (download): ' + delivery.links;
    }
    return 'Files NOT attached to this email. Selected names only: ' + describeFiles(files) + '. Client was told: Upload failed — email the packet to rafael@recaldelaw.com';
  }

  function gatherDocs(form, files, delivery) {
    var method = form.querySelector('input[name="docs_send_method"]:checked');
    var ack = form.querySelector('input[name="docs_packet_ack"]');
    var list = files || [];
    return [
      'Required packet: driver’s license; vehicle registration; lease or purchase contract; repair tickets / repair orders',
      'Send method: ' + (method ? method.value : 'not selected'),
      fileDeliveryLine(list, delivery),
      'Packet ack: ' + (ack && ack.checked ? 'yes' : 'no')
    ].join(' | ');
  }

  function formValue(form, name) {
    return (form.elements[name] && form.elements[name].value && form.elements[name].value.trim()) || '';
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

  function buildLeadData(form, files, delivery) {
    var data = new FormData(form);
    data.delete('_gotcha');
    data.delete('documents');
    data.delete('attachment');
    data.set('name', formValue(form, 'first_name'));
    data.set('vehicle', [formValue(form, 'year'), formValue(form, 'make'), formValue(form, 'model')].filter(Boolean).join(' '));
    data.set('docs', gatherDocs(form, files, delivery));
    if (hasDeliveredUrls(delivery, files)) {
      data.set('document_links', delivery.links);
      data.set('file_delivery', 'Delivered. Clickable https download links below — this Formspree email has no binary attachments.');
      data.set('uploaded_files', describeFiles(files));
    } else if (files && files.length) {
      data.set('file_delivery', 'FAILED. No verified https download URL. Client was shown: ' + UPLOAD_FAILED_MSG);
      data.set('uploaded_files', 'NOT ATTACHED. Selected: ' + describeFiles(files));
      if (delivery && firstHttpsUrl(delivery.links)) {
        data.set('document_links', delivery.links);
      }
    } else {
      data.set('file_delivery', 'No website upload. Client will email the packet.');
      data.set('uploaded_files', 'none');
    }
    return data;
  }

  /**
   * Formspree free/basic drops or rejects file binaries and does not put
   * them in Gmail. A Formspree 200 is NOT proof files arrived.
   * FormSubmit often lists filenames in uploaded_files without attaching
   * the binaries. A FormSubmit HTTP 200 is NEVER proof files arrived.
   *
   * Never POST binaries to Formspree. Never retry-without-files and then
   * claim “Files attached: N” from the input count.
   *
   * Upload path: host each file on a CORS-friendly provider that returns a
   * real https:// download URL. Verify the URL looks like https:// before
   * success. Put those URLs in Formspree document_links / docs. If any file
   * has no verified https URL, reject with UPLOAD_FAILED_MSG and do not
   * show a success screen.
   */
  function fetchWithTimeout(url, options, ms) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, ms || HOST_TIMEOUT_MS);
    var opts = {};
    var key;
    for (key in (options || {})) {
      if (Object.prototype.hasOwnProperty.call(options, key)) opts[key] = options[key];
    }
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(url, opts).then(function (res) {
      clearTimeout(timer);
      return res;
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  function readFetchBody(res) {
    return res.text().then(function (text) {
      var json = {};
      try { json = JSON.parse(text); } catch (e1) {}
      return { ok: !!res.ok, status: res.status, text: text, json: json };
    });
  }

  function postFormNoHeaders(url, data) {
    return fetchWithTimeout(url, { method: 'POST', body: data }, HOST_TIMEOUT_MS)
      .then(readFetchBody)
      .catch(function () {
        return { ok: false, status: 0, text: '', json: {} };
      });
  }

  function randomBinId() {
    var bytes = new Uint8Array(8);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.prototype.map.call(bytes, function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  function uploadLitterbox(file) {
    var data = new FormData();
    data.append('reqtype', 'fileupload');
    data.append('time', '72h');
    data.append('fileToUpload', file, file.name || 'upload');
    return postFormNoHeaders(LITTERBOX_ENDPOINT, data).then(function (res) {
      if (!res.ok) return '';
      return firstHttpsUrl(res.text);
    });
  }

  function uploadTmpfiles(file) {
    var data = new FormData();
    data.append('file', file, file.name || 'upload');
    data.append('expire', String(TMPFILES_EXPIRE_SECONDS));
    return postFormNoHeaders(TMPFILES_ENDPOINT, data).then(function (res) {
      if (!res.ok || (res.json && res.json.status && res.json.status !== 'success')) return '';
      var url = res.json && res.json.data && res.json.data.url;
      if (url && /^http:\/\//i.test(url)) url = 'https://' + url.slice(7);
      return firstHttpsUrl(url || '');
    });
  }

  function uploadFilebin(file, binId) {
    var name = encodeURIComponent(file.name || 'upload');
    var href = FILEBIN_ORIGIN + '/' + encodeURIComponent(binId) + '/' + name;
    var data = new FormData();
    data.append('file', file, file.name || 'upload');
    return postFormNoHeaders(href, data).then(function (res) {
      if (!(res.ok || res.status === 201)) return '';
      var named = res.json && res.json.file && res.json.file.filename;
      if (named) {
        href = FILEBIN_ORIGIN + '/' + encodeURIComponent(binId) + '/' + encodeURIComponent(named);
      }
      return firstHttpsUrl(href);
    });
  }

  function uploadGofile(file) {
    return fetchWithTimeout(GOFILE_SERVERS, { method: 'GET' }, HOST_TIMEOUT_MS)
      .then(readFetchBody)
      .then(function (res) {
        var servers = (res.json && res.json.data && res.json.data.servers) || [];
        var server = servers[0] && servers[0].name;
        if (!server || !/^[a-z0-9-]+$/i.test(server)) return '';
        var data = new FormData();
        data.append('file', file, file.name || 'upload');
        return postFormNoHeaders('https://' + server + '.gofile.io/contents/uploadfile', data).then(function (up) {
          if (!up.ok || (up.json && up.json.status && up.json.status !== 'ok')) return '';
          var page = up.json && up.json.data && (up.json.data.downloadPage || up.json.data.link);
          return firstHttpsUrl(page || '');
        });
      })
      .catch(function () { return ''; });
  }

  function tryHosts(file, binId) {
    var steps = [
      function () { return uploadLitterbox(file); },
      function () { return uploadTmpfiles(file); },
      function () { return uploadFilebin(file, binId); },
      function () { return uploadGofile(file); }
    ];
    return steps.reduce(function (prev, step) {
      return prev.then(function (url) {
        return url || step();
      });
    }, Promise.resolve(''));
  }

  function notifyInboxWithLinks(form, files, links) {
    var data = new FormData();
    data.set('_subject', 'Auto Warranty Lawyer — Intake document packet');
    data.set('_template', 'table');
    data.set('_captcha', 'false');
    data.set('name', formValue(form, 'first_name') || 'Intake upload');
    data.set('email', formValue(form, 'email'));
    data.set('vehicle', [formValue(form, 'year'), formValue(form, 'make'), formValue(form, 'model')].filter(Boolean).join(' '));
    data.set('uploaded_files', describeFiles(files));
    data.set('document_links', links);
    data.set('message', 'Download links for the website intake packet. Filenames and https links only — no attachments. The matching lead is in the Formspree notification.');
    return postAcceptJson(DOCS_INBOX, data).catch(function () {
      return { ok: false };
    });
  }

  function deliverFiles(form, files) {
    var binId = randomBinId();
    return Promise.all(files.map(function (file) {
      return tryHosts(file, binId).then(function (url) {
        return { name: file.name || 'file', url: url };
      });
    })).then(function (rows) {
      var lines = rows.filter(function (row) { return isHttpsDownloadUrl(row.url); })
        .map(function (row) { return row.name + ': ' + row.url; });
      var links = lines.join('\n');
      var allOk = rows.length === files.length && rows.every(function (row) {
        return isHttpsDownloadUrl(row.url);
      });
      if (!allOk) return { status: 'failed', links: links };
      return notifyInboxWithLinks(form, files, links).then(function () {
        return { status: 'delivered', links: links };
      }, function () {
        return { status: 'delivered', links: links };
      });
    }).catch(function () {
      return { status: 'failed', links: '' };
    });
  }

  function postTextLead(form, files, delivery) {
    return postAcceptJson(form.action || FORMSPREE_ENDPOINT, buildLeadData(form, files, delivery)).then(function (res) {
      return !!res.ok;
    });
  }

  function postLead(form) {
    var gotcha = form.querySelector('input[name="_gotcha"], .intake-hp-input');
    if (gotcha && gotcha.value) {
      return Promise.resolve({ ok: true, skipped: true, filesDelivered: true });
    }

    var files = selectedFiles(form);
    var uploadNow = wantsUploadNow(form);
    var oversized = files.filter(function (file) { return file.size > MAX_FILE_BYTES; });
    if (oversized.length) {
      return Promise.reject(new Error(UPLOAD_FAILED_MSG));
    }
    if (uploadNow && !files.length) {
      return Promise.reject(new Error(UPLOAD_FAILED_MSG));
    }

    function succeed(delivery) {
      return {
        ok: true,
        filesRequested: files.length > 0,
        filesDelivered: !files.length || hasDeliveredUrls(delivery, files),
        names: describeFiles(files),
        links: delivery && delivery.links
      };
    }

    if (!files.length) {
      return postTextLead(form, [], { status: 'none' }).then(function (ok) {
        if (!ok) throw new Error('Unable to submit right now.');
        return succeed({ status: 'none' });
      });
    }

    return deliverFiles(form, files).then(function (delivery) {
      if (!hasDeliveredUrls(delivery, files)) {
        return postTextLead(form, files, delivery).catch(function () { return false; }).then(function () {
          throw new Error(UPLOAD_FAILED_MSG);
        });
      }
      return postTextLead(form, files, delivery).then(function (ok) {
        if (!ok) throw new Error('Unable to submit right now.');
        return succeed(delivery);
      });
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
      'A few questions, starting with the original delivery date. If you’re in the 24-month window, we’ll ask for the document packet next.',
      'Next: the state of purchase or lease, VIN, and whether this was a purchase or a lease.',
      'How many repair visits for the same problem, and how long the vehicle was out of service.',
      'Send the document packet so we can finish the evaluation. This step is not a signature.'
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
          nextStepInput.value = 'Await FULL document packet (driver’s license, vehicle registration, lease or purchase contract, repair tickets). Do NOT send engagement or fee-to-sign until the packet is in. Then explain fees; if they reply “I want to proceed”, send engagement for e-sign (TODO: no e-sign/portal in this repo — use existing recalde-portal or manual send). Signed engagement → open file.';
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

    var fileInput = form.querySelector('[data-intake-files]');
    var fileList = form.querySelector('[data-file-list]');
    if (fileInput && fileList) {
      fileInput.addEventListener('change', function () {
        var files = selectedFiles(form);
        if (!files.length) {
          fileList.hidden = true;
          fileList.textContent = '';
          return;
        }
        fileList.hidden = false;
        fileList.textContent = 'Selected: ' + describeFiles(files);
      });
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
      if (wantsUploadNow(form) && !selectedFiles(form).length) {
        setError(form, UPLOAD_FAILED_MSG);
        return;
      }

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

      postLead(form).then(function (result) {
        replaceWith(mount, successHtml(firstName(), vehicle(), {
          requested: !!(result && result.filesRequested),
          delivered: !!(result && result.filesDelivered),
          names: result && result.names
        }));
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
    describeFiles: describeFiles,
    selectedFiles: selectedFiles,
    fileDeliveryLine: fileDeliveryLine,
    isHttpsDownloadUrl: isHttpsDownloadUrl,
    firstHttpsUrl: firstHttpsUrl,
    countHttpsUrls: countHttpsUrls,
    hasDeliveredUrls: hasDeliveredUrls,
    wantsUploadNow: wantsUploadNow,
    UPLOAD_FAILED_MSG: UPLOAD_FAILED_MSG,
    init: initMounts
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMounts);
  } else {
    initMounts();
  }
})();
