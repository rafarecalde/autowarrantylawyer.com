/**
 * Node checks for Fla. Stat. § 681.102(9) 24-month window math
 * and post-submit Google Form / Formspree text-lead wiring.
 * Run: node js/intake-date-test.js
 */
var fs = require('fs');
var path = require('path');
var src = fs.readFileSync(path.join(__dirname, 'intake.js'), 'utf8');

function extract(fnName) {
  var re = new RegExp('function ' + fnName + '\\([\\s\\S]*?\\n  \\}');
  var match = src.match(re);
  if (!match) throw new Error('Could not extract ' + fnName);
  return match[0];
}

eval(extract('parseISODate'));
eval(extract('addDays'));
eval(extract('addCalendarMonths'));
eval(extract('rightsPeriodEnd'));
eval(extract('isOutsideRightsPeriod'));
eval(extract('isAttorneyReviewWindow'));
eval(extract('isFutureDate'));
eval(extract('deliveryWindowStatus'));
eval(extract('classifyGuess'));
var ARBITRATION_GRACE_DAYS = 60;
var REVIEW_MONTHS = 26;

function d(y, m, day) {
  return new Date(y, m - 1, day);
}

var failed = 0;
function assert(name, actual, expected) {
  if (actual !== expected) {
    failed += 1;
    console.error('FAIL', name, 'got', actual, 'expected', expected);
  } else {
    console.log('ok  ', name);
  }
}

function assertNo(name, haystack, needle) {
  assert(name, haystack.indexOf(needle) === -1, true);
}

// Anniversary is still inside the window.
assert('in window on 24-month day', isOutsideRightsPeriod('2024-09-19', d(2026, 9, 19)), false);
assert('out the day after anniversary', isOutsideRightsPeriod('2024-09-18', d(2026, 9, 19)), true);
assert('recent delivery is in window', isOutsideRightsPeriod('2025-01-15', d(2026, 9, 19)), false);
assert('old delivery is out', isOutsideRightsPeriod('2023-09-01', d(2026, 9, 19)), true);
assert('invalid date', isOutsideRightsPeriod('2024-13-40', d(2026, 9, 19)), null);
assert('future delivery', isFutureDate('2026-12-01', d(2026, 9, 19)), true);
assert('today is not future', isFutureDate('2026-09-19', d(2026, 9, 19)), false);

assert('anniversary is not attorney review', isAttorneyReviewWindow('2024-09-19', d(2026, 9, 19)), false);
assert('day after anniversary is attorney review', isAttorneyReviewWindow('2024-09-19', d(2026, 9, 20)), true);
assert('status on anniversary is in window', deliveryWindowStatus('2024-09-19', d(2026, 9, 19)), 'in_window');
assert('status day after anniversary is attorney review', deliveryWindowStatus('2024-09-19', d(2026, 9, 20)), 'attorney_review');
// 2024-01-01 + 24 months = 2026-01-01; + 60 days = 2026-03-02, which is later than the 26-month day (2026-03-01).
assert('60th day after rights end stays in review', deliveryWindowStatus('2024-01-01', d(2026, 3, 2)), 'attorney_review');
assert('day after 60-day deadline declines', deliveryWindowStatus('2024-01-01', d(2026, 3, 3)), 'out_of_window');
// 2024-08-09 + 26 months = 2026-10-09, one day after the 60-day mark (2026-10-08).
assert('26-month anniversary stays in review', deliveryWindowStatus('2024-08-09', d(2026, 10, 9)), 'attorney_review');
assert('day after 26-month anniversary declines', deliveryWindowStatus('2024-08-09', d(2026, 10, 10)), 'out_of_window');
assert('years-old delivery still declines', deliveryWindowStatus('2023-09-01', d(2026, 9, 19)), 'out_of_window');
assert('guess in 24-26 band is attorney review', classifyGuess('About 24 to 26 months ago'), 'attorney_review');
assert('guess past 26 months still declines', classifyGuess('More than 26 months ago'), 'out_of_window');
assert('guess inside 24 months stays in window', classifyGuess('Within the last 24 months'), 'in_window');

assert('step label comes before first panel', src.indexOf('data-step-label') < src.indexOf('data-panel="1"'), true);
assert('delivery date is first step-1 field', src.indexOf('Original delivery date') < src.indexOf('First name'), true);
assert('delivery date uses type=date', /type="date"[^>]*name="delivery_date"|name="delivery_date"[^>]*type="date"/.test(src), true);
assert('honeypot has no leaked value', !/value=["']1234["']/.test(src), true);
assert('honeypot is visually-hidden wrapper', src.indexOf('class="intake-hp"') !== -1 && src.indexOf('aria-hidden="true"') !== -1, true);
assert('honeypot is tabindex -1', src.indexOf('tabindex="-1"') !== -1, true);
assert('honeypot autocomplete off', /name="_gotcha"[^>]*autocomplete="off"|autocomplete="off"[^>]*name="_gotcha"/.test(src), true);
assert('progress steps have no inner 1234 text', !/>1<\/span>/.test(src) && !/>2<\/span>/.test(src), true);
assert('does not silently strip files on retry', src.indexOf('formDataWithoutFiles') === -1 && !/if \(!skipFiles\) return postLead\(form, true\)/.test(src), true);
assert('never claims Files attached from input count', src.indexOf('Files attached on this submit') === -1, true);
assert('does not POST binaries to Formspree', src.indexOf("data.append('attachment'") === -1, true);
assert('does not POST binaries to FormSubmit', src.indexOf("data.append('attachment'") === -1, true);
assert('no FormSubmit inbox path', src.indexOf('formsubmit.co') === -1, true);
assert('no file.io host', src.indexOf('file.io') === -1, true);
assert('no litterbox host', src.indexOf('litterbox') === -1 && src.indexOf('catbox.moe') === -1, true);
assert('no tmpfiles host', src.indexOf('tmpfiles') === -1, true);
assert('no filebin host', src.indexOf('filebin') === -1, true);
assert('no gofile host', src.indexOf('gofile') === -1, true);
assert('no file input', src.indexOf('type="file"') === -1 && src.indexOf('name="attachment"') === -1, true);
assert('no multipart file encoding', src.indexOf('enctype="multipart/form-data"') === -1, true);
assert(
  'wires Google Form URL',
  src.indexOf('https://docs.google.com/forms/d/e/1FAIpQLSei5FtsiCdXDqo9vn8Meu4mwtVosAs9VSMWX0OKjUOjwVWnKA/viewform') !== -1,
  true
);
assert('docs_send_method is optional Google Form', src.indexOf('Google Form offered (optional Drive)') !== -1, true);
assert('awkward upload-only sentence is not in intake.js', src.indexOf('The Google Form is upload only — no name, email, or vehicle questions') === -1, true);
assert('awkward upload-only fragment is not in intake.js', src.indexOf('upload only — no name, email, or vehicle questions') === -1, true);
assert('Formspree _subject is unique per lead', src.indexOf('function uniqueLeadSubject') !== -1 && src.indexOf("data.set('_subject'") !== -1, true);
assert('form_source is kept as a posted field', src.indexOf('name="form_source"') !== -1 && src.indexOf("data.set('form_source'") !== -1, true);
assert('initial _subject is empty until submit', src.indexOf('name="_subject" value=""') !== -1, true);
assert('Gmail subject format uses name and vehicle', src.indexOf('Auto Warranty Lawyer — Case Review') !== -1 && src.indexOf("parts.push(name)") !== -1 && src.indexOf('parts.push(vehicle)') !== -1 && src.indexOf('compactStamp') !== -1, true);
assert('Google Form opens in a new tab', src.indexOf('target="_blank"') !== -1 && src.indexOf('data-gform-cta') !== -1, true);
assert('three on-site steps', src.indexOf('var total = 3') !== -1 && src.indexOf('data-panel="4"') === -1, true);
assert('step 1 label is delivery date', src.indexOf('Step 1 of 3 — Delivery date') !== -1, true);
assert('step 2 label is vehicle and contact', src.indexOf('Step 2 of 3 — Vehicle & contact') !== -1, true);
assert('step 3 label is repair history', src.indexOf('Step 3 of 3 — Repair history') !== -1, true);
assert('no pre-submit document-packet step', src.indexOf('Step 4 of') === -1 && src.indexOf('data-panel="4"') === -1, true);
assert('does not describe four separate upload fields', !/four separate|four file fields|four uploads|separate upload fields/i.test(src), true);
assert('does not claim files attached to Formspree', src.indexOf('none — not attached to Formspree') !== -1, true);
assert('Formspree docs field says upload was not required', src.indexOf('Upload was not required to submit this lead') !== -1, true);
assert('Formspree next_step notes packet optional via Drive form', src.indexOf('Packet optional via Drive form') !== -1, true);
assert('submit is not gated on Google Form checkbox', src.indexOf('name="docs_form_opened"') === -1 && src.indexOf('data-gform-ack') === -1 && src.indexOf('syncSubmitEnabled') === -1, true);
assert('VIN is not an intake field', src.indexOf('name="vin"') === -1 && src.indexOf('17-character VIN') === -1, true);
assert('intake placeholders are Chevrolet Equinox not Tesla', src.indexOf('placeholder="Chevrolet"') !== -1 && src.indexOf('placeholder="Equinox"') !== -1 && src.indexOf('placeholder="Tesla"') === -1 && src.indexOf('placeholder="Model Y"') === -1, true);
assert('required docs list includes DL', src.indexOf('Driver’s license') !== -1, true);
assert('required docs list includes registration', src.indexOf('Vehicle registration') !== -1, true);
assert('required docs list includes contract', src.indexOf('Lease or purchase contract') !== -1, true);
assert('required docs list includes repair tickets', src.indexOf('Repair tickets / repair orders') !== -1, true);
assert('decline is a designed screen', src.indexOf('Outside the 24-month window') !== -1, true);
assert('attorney review is a designed screen', src.indexOf('An attorney will review the timing') !== -1, true);
assert('collects last name', src.indexOf('name="last_name"') !== -1 && src.indexOf('>Last name<') !== -1, true);
assert('collects phone for callback', src.indexOf('name="phone"') !== -1 && src.indexOf('type="tel"') !== -1 && src.indexOf('>Phone number<') !== -1, true);
assert('old more-than-24-months guess no longer auto-declines', src.indexOf('No — more than 24 months ago') === -1, true);
assert('24-to-26-month guess exists', src.indexOf('About 24 to 26 months ago') !== -1, true);
assert('more-than-26-months guess still declines', src.indexOf('More than 26 months ago') !== -1, true);
assert('initial showPanel is silent', src.indexOf('showPanel(1, { silent: true })') !== -1, true);
assertNo('no upload-failed fail-closed copy', src, 'Upload failed — email the packet to rafael@recaldelaw.com');

var formHtmlFn = extract('buildFormHtml');
var successFn = extract('successHtml');
assert('pre-submit form has no Google Form CTA', formHtmlFn.indexOf('data-gform-cta') === -1 && formHtmlFn.indexOf('Upload your packet') === -1, true);
assert('pre-submit form has no upload-first copy', formHtmlFn.indexOf('Uploading documents is optional') === -1 && formHtmlFn.indexOf('You do not have to upload') === -1, true);
var ctaFn = extract('googleFormCta');
assert('success screen primary CTA is Upload your packet', successFn.indexOf("googleFormCta('Upload your packet')") !== -1, true);
assert('Google Form CTA helper uses data-gform-cta', ctaFn.indexOf('data-gform-cta') !== -1, true);
assert('success screen names packet docs', successFn.indexOf('driver’s license') !== -1 && successFn.indexOf('registration') !== -1 && successFn.indexOf('lease or purchase contract') !== -1 && successFn.indexOf('repair tickets') !== -1, true);
assert('success screen says files go to the firm securely', successFn.indexOf('Files go to the firm securely.') !== -1, true);
assert('success screen says upload is optional', successFn.indexOf('Upload is optional.') !== -1, true);
assert('success screen offers leave without upload', successFn.indexOf('Back to home') !== -1, true);
assertNo('client form omits Google account meta', formHtmlFn, 'signed into a Google account');
assertNo('client success omits Google account meta', successFn, 'signed into a Google account');
assertNo('client form omits awkward upload-only line', formHtmlFn, 'upload only — no name, email, or vehicle questions');
assertNo('client success omits awkward upload-only line', successFn, 'upload only — no name, email, or vehicle questions');
assertNo('client form omits just-upload copy', formHtmlFn, 'just upload no name nothing');
assertNo('client success omits just-upload copy', successFn, 'just upload no name nothing');

eval(extract('formValue'));
eval(extract('compactStamp'));
eval(extract('uniqueLeadSubject'));

function mockForm(values) {
  var fields = {};
  Object.keys(values).forEach(function (k) {
    fields[k] = { type: 'text', value: values[k] };
  });
  return { elements: fields };
}

var when = new Date(Date.UTC(2026, 8, 19, 15, 22, 41));
var jane = mockForm({
  first_name: 'Jane',
  year: '2025',
  make: 'Chevrolet',
  model: 'Equinox',
  form_source: 'homepage-hero'
});
assert(
  'subject is name + vehicle + compact timestamp',
  uniqueLeadSubject(jane, 'Auto Warranty Lawyer — Case Review (Hero Form)', 'in_window', when),
  'Auto Warranty Lawyer — Case Review — Jane — 2025 Chevrolet Equinox — 2026-09-19 15:22:41 UTC'
);
var janeDoe = mockForm({
  first_name: 'Jane',
  last_name: 'Doe',
  year: '2025',
  make: 'Chevrolet',
  model: 'Equinox',
  form_source: 'homepage-hero'
});
assert(
  'subject uses full name',
  uniqueLeadSubject(janeDoe, '', 'in_window', when),
  'Auto Warranty Lawyer — Case Review — Jane Doe — 2025 Chevrolet Equinox — 2026-09-19 15:22:41 UTC'
);
assert(
  'attorney review subject marks the 24-26 month band',
  uniqueLeadSubject(janeDoe, '', 'attorney_review', when),
  'Auto Warranty Lawyer — Case Review — Jane Doe — 2025 Chevrolet Equinox — 2026-09-19 15:22:41 UTC — Attorney review — 24–26 month window'
);
assert(
  'subject ignores shared Hero Form base label',
  uniqueLeadSubject(jane, 'Auto Warranty Lawyer — Case Review (Hero Form)', 'in_window', when).indexOf('(Hero Form)') === -1,
  true
);
var later = new Date(Date.UTC(2026, 8, 19, 16, 4, 8));
assert(
  'same lead at another second gets a different subject',
  uniqueLeadSubject(jane, '', 'in_window', when) !== uniqueLeadSubject(jane, '', 'in_window', later),
  true
);
var empty = mockForm({});
assert(
  'subject is still unique without name or vehicle',
  uniqueLeadSubject(empty, '', 'out_of_window', when),
  'Auto Warranty Lawyer — Case Review — 2026-09-19 15:22:41 UTC — Outside 24-month window'
);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('All date checks passed');
