/**
 * Multi-step Florida Lemon Law intake.
 * Posts to the existing Formspree endpoint so current lead emails keep working.
 * Hard-screens Fla. Stat. § 681.102(9): rights period ends 24 months after original delivery.
 */
(function () {
  'use strict';

  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/mqegejrg';
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
      '<form action="' + FORMSPREE_ENDPOINT + '" method="POST" class="intake-form" data-intake novalidate>' +
        '<input type="hidden" name="_subject" value="' + escapeAttr(subject) + '">' +
        '<input type="hidden" name="form_source" value="' + escapeAttr(source) + '">' +
        '<input type="hidden" name="intake_status" value="">' +
        '<input type="hidden" name="rights_period_status" value="">' +
        '<input type="text" name="_gotcha" class="intake-hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +

        '<div class="intake-progress" aria-hidden="true">' +
          '<span class="intake-progress-step is-active" data-progress="1">1</span>' +
          '<span class="intake-progress-line"></span>' +
          '<span class="intake-progress-step" data-progress="2">2</span>' +
          '<span class="intake-progress-line"></span>' +
          '<span class="intake-progress-step" data-progress="3">3</span>' +
          '<span class="intake-progress-line"></span>' +
          '<span class="intake-progress-step" data-progress="4">4</span>' +
        '</div>' +
        '<p class="intake-step-label" data-step-label>Step 1 of 4 — Delivery date</p>' +

        '<div class="intake-panel" data-panel="1">' +
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
          '<div class="form-group">' +
            '<label for="' + fieldId(p, 'delivery_date') + '">Original delivery date</label>' +
            '<input type="date" id="' + fieldId(p, 'delivery_date') + '" name="delivery_date">' +
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
          '<p class="intake-docs-lead">Which of these do you have, or can you send with your next reply?</p>' +
          '<div class="intake-docs">' +
            '<label class="intake-check"><input type="checkbox" name="docs" value="Purchase or lease agreement"><span>Purchase or lease agreement</span></label>' +
            '<label class="intake-check"><input type="checkbox" name="docs" value="Repair orders"><span>Repair orders</span></label>' +
            '<label class="intake-check"><input type="checkbox" name="docs" value="Warranty information"><span>Warranty information</span></label>' +
            '<label class="intake-check"><input type="checkbox" name="docs" value="Emails or letters with the dealer or manufacturer"><span>Emails or letters with the dealer or manufacturer</span></label>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="' + fieldId(p, 'phone') + '">Phone <span class="intake-optional">(optional)</span></label>' +
            '<input type="tel" id="' + fieldId(p, 'phone') + '" name="phone" autocomplete="tel">' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="' + fieldId(p, 'notes') + '">Anything else we should know? <span class="intake-optional">(optional)</span></label>' +
            '<textarea id="' + fieldId(p, 'notes') + '" name="notes" rows="2" placeholder="Goodwill offers, prior counsel, arbitration..."></textarea>' +
          '</div>' +
        '</div>' +

        '<div class="form-error" data-intake-error hidden></div>' +

        '<div class="intake-actions">' +
          '<button type="button" class="btn btn-outline intake-back" data-back hidden>Back</button>' +
          '<button type="button" class="btn btn-primary btn-block intake-next" data-next>Continue</button>' +
          '<button type="submit" class="btn btn-primary btn-block" data-submit hidden>Submit my case review</button>' +
        '</div>' +
        '<p class="form-note">Submitting this form does not create an attorney-client relationship. All information is kept confidential. We accept Florida Lemon Law cases for vehicles within the 24-month Lemon Law Rights Period (Fla. Stat. § 681.102(9)).</p>' +
      '</form>'
    );
  }

  function declineHtml(firstName, vehicle) {
    var greeting = firstName ? 'Hi ' + escapeHtml(firstName) + ',' : 'Hi,';
    return (
      '<div class="intake-result intake-result-decline" role="status">' +
        '<h3>Your Lemon Law inquiry</h3>' +
        '<p>' + greeting + '</p>' +
        '<p>Thank you for reaching out about your ' + escapeHtml(vehicle) + '.</p>' +
        '<p>Florida’s Lemon Law rights period generally ends 24 months after the vehicle’s original delivery date. Based on what you shared, this matter falls outside that window, so we’re not able to take it under Florida’s Lemon Law statute.</p>' +
        '<p>If you have a different delivery date than what you entered, reply with that date and the purchase or lease documents and we’ll take another look. Otherwise we wish you the best in resolving it.</p>' +
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
        '<p>We’ll review what you sent and tell you plainly whether it looks viable under Florida Lemon Law and, if so, how we’d proceed — including fees.</p>' +
        '<p>If you have copies of the purchase or lease agreement, repair orders, warranty information, or correspondence with the dealer or manufacturer, keep those handy. We’ll ask for anything still needed to finish the evaluation.</p>' +
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
      if (el.disabled || el.type === 'hidden' || el.classList.contains('intake-hp')) return false;
      if (el.closest('[hidden]')) return false;
      return true;
    });
  }

  function validatePanel(panel) {
    var fields = panelFields(panel);
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
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

  function gatherDocs(form) {
    var boxes = form.querySelectorAll('input[name="docs"]:checked');
    var values = Array.prototype.map.call(boxes, function (el) { return el.value; });
    return values.length ? values.join('; ') : 'None selected';
  }

  function postLead(form) {
    var data = new FormData(form);
    data.set('docs', gatherDocs(form));
    var first = (form.elements.first_name && form.elements.first_name.value.trim()) || '';
    var year = (form.elements.year && form.elements.year.value.trim()) || '';
    var make = (form.elements.make && form.elements.make.value.trim()) || '';
    var model = (form.elements.model && form.elements.model.value.trim()) || '';
    data.set('name', first);
    data.set('vehicle', [year, make, model].filter(Boolean).join(' '));
    data.delete('_gotcha');
    var gotcha = form.querySelector('.intake-hp');
    if (gotcha && gotcha.value) {
      return Promise.resolve({ ok: true, skipped: true });
    }

    return fetch(form.action || FORMSPREE_ENDPOINT, {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          var err = new Error((body && body.error) || 'Unable to submit right now.');
          err.status = res.status;
          throw err;
        });
      }
      return res;
    });
  }

  function replaceWith(mount, html) {
    mount.innerHTML = html;
    var result = mount.querySelector('.intake-result');
    if (result) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      'Step 4 of 4 — Documents'
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
    var subjectInput = form.querySelector('input[name="_subject"]');

    function showPanel(n) {
      step = n;
      form.querySelectorAll('[data-panel]').forEach(function (panel) {
        var id = Number(panel.getAttribute('data-panel'));
        panel.hidden = id !== n;
      });
      form.querySelectorAll('[data-progress]').forEach(function (dot) {
        var id = Number(dot.getAttribute('data-progress'));
        dot.classList.toggle('is-active', id === n);
        dot.classList.toggle('is-done', id < n);
      });
      if (stepLabel) stepLabel.textContent = labels[n - 1];
      backBtn.hidden = n === 1;
      nextBtn.hidden = n === total;
      submitBtn.hidden = n !== total;
      nextBtn.classList.toggle('btn-block', n === 1);
      setError(form, '');
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
      if (!validatePanel(panel)) return;

      if (step === 1) {
        var status = classifyWindow(form);
        if (status === 'incomplete') {
          setError(form, 'Enter the original delivery date, or check the box and tell us whether it was within the last 24 months.');
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
      }

      showPanel(step + 1);
    });

    backBtn.addEventListener('click', function () {
      if (step > 1) showPanel(step - 1);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitting) return;
      var panel = form.querySelector('[data-panel="' + step + '"]');
      if (!validatePanel(panel)) return;

      var status = classifyWindow(form);
      if (status === 'out_of_window') {
        showDeclineAndSubmit();
        return;
      }
      if (status === 'incomplete' || status === 'future') {
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
      }).catch(function () {
        submitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit my case review';
        setError(form, 'We couldn’t send your review just now. Please try again, or email rafael@recaldelaw.com with the same details.');
      });
    });

    showPanel(1);
  }

  function initMounts() {
    document.querySelectorAll('[data-intake-mount]').forEach(initForm);
  }

  window.LemonIntake = {
    isOutsideRightsPeriod: isOutsideRightsPeriod,
    isFutureDate: isFutureDate,
    parseISODate: parseISODate,
    classifyWindow: classifyWindow,
    init: initMounts
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMounts);
  } else {
    initMounts();
  }
})();
