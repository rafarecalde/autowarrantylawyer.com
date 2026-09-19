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
eval(extract('isOutsideRightsPeriod'));
eval(extract('isFutureDate'));

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
assert('docs_send_method is optional Google Form upload', src.indexOf('Google Form offered (optional upload-only Drive)') !== -1, true);
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
assert('initial showPanel is silent', src.indexOf('showPanel(1, { silent: true })') !== -1, true);
assertNo('no upload-failed fail-closed copy', src, 'Upload failed — email the packet to rafael@recaldelaw.com');

var formHtmlFn = extract('buildFormHtml');
var successFn = extract('successHtml');
assert('pre-submit form has no Google Form CTA', formHtmlFn.indexOf('data-gform-cta') === -1 && formHtmlFn.indexOf('Upload your packet') === -1, true);
assert('pre-submit form has no upload-first copy', formHtmlFn.indexOf('Uploading documents is optional') === -1 && formHtmlFn.indexOf('You do not have to upload') === -1, true);
var ctaFn = extract('googleFormCta');
assert('success screen primary CTA is Upload your packet', successFn.indexOf("googleFormCta('Upload your packet')") !== -1, true);
assert('Google Form CTA helper uses data-gform-cta', ctaFn.indexOf('data-gform-cta') !== -1, true);
assert('success screen lists packet docs', successFn.indexOf('Driver’s license') !== -1 && successFn.indexOf('Vehicle registration') !== -1 && successFn.indexOf('Lease or purchase contract') !== -1 && successFn.indexOf('Repair tickets') !== -1, true);
assert('success screen says files go to the firm securely', successFn.indexOf('Files go to the firm securely.') !== -1, true);
assert('success screen says upload is optional', successFn.indexOf('Upload is optional.') !== -1, true);
assert('success screen offers leave without upload', successFn.indexOf('Back to home') !== -1, true);
assertNo('client form omits Google account meta', formHtmlFn, 'signed into a Google account');
assertNo('client success omits Google account meta', successFn, 'signed into a Google account');
assertNo('client form omits awkward upload-only line', formHtmlFn, 'upload only — no name, email, or vehicle questions');
assertNo('client success omits awkward upload-only line', successFn, 'upload only — no name, email, or vehicle questions');
assertNo('client form omits just-upload copy', formHtmlFn, 'just upload no name nothing');
assertNo('client success omits just-upload copy', successFn, 'just upload no name nothing');

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('All date checks passed');
