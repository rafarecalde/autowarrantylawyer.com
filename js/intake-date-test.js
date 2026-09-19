/**
 * Node checks for Fla. Stat. § 681.102(9) 24-month window math.
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
eval(extract('describeFiles'));
eval(extract('isTrustedFileHost'));
eval(extract('isHttpsDownloadUrl'));
eval(extract('firstHttpsUrl'));
eval(extract('countHttpsUrls'));
eval(extract('hasDeliveredUrls'));
eval(extract('fileDeliveryLine'));

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
assert('form is multipart', src.indexOf('enctype="multipart/form-data"') !== -1, true);
assert('file field is attachment', src.indexOf('name="attachment"') !== -1, true);
assert('does not silently strip files on retry', src.indexOf('formDataWithoutFiles') === -1 && !/if \(!skipFiles\) return postLead\(form, true\)/.test(src), true);
assert('never claims Files attached from input count', src.indexOf('Files attached on this submit') === -1, true);
assert('does not POST binaries to Formspree', src.indexOf('data.append(\'attachment\'') === -1 || src.indexOf('Never POST binaries to Formspree') !== -1, true);
assert('fail-closed upload copy', src.indexOf('Upload failed — email the packet to rafael@recaldelaw.com') !== -1, true);
assert('has inbox notify for filenames and links only', src.indexOf('formsubmit.co/ajax/rafael@recaldelaw.com') !== -1, true);
assert('does not POST binaries to FormSubmit inbox', src.indexOf("data.append('attachment'") === -1, true);
assert('never treats FormSubmit 200 as file delivery', src.indexOf('Emailed as attachments') === -1 && src.indexOf('if (courier.ok)') === -1, true);
assert('does not use file.io as the upload host', src.indexOf('https://file.io') === -1, true);
assert('tries litterbox then tmpfiles then filebin', src.indexOf('litterbox.catbox.moe') !== -1 && src.indexOf('tmpfiles.org/api/v1/upload') !== -1 && src.indexOf('https://filebin.net') !== -1, true);
assert('tmpfiles expire is 48 hours', src.indexOf('var TMPFILES_EXPIRE_SECONDS = 172800') !== -1, true);
assert('no-file delivery line is honest', fileDeliveryLine([], { status: 'none' }).indexOf('none') !== -1, true);
assert('failed delivery line is honest', fileDeliveryLine([{ name: 'dl.pdf', size: 1024 }], { status: 'failed' }).indexOf('NOT attached') !== -1, true);
assert('delivered without https is not delivered', fileDeliveryLine([{ name: 'dl.pdf', size: 1024 }], { status: 'delivered', links: 'Emailed as attachments to rafael@recaldelaw.com' }).indexOf('NOT attached') !== -1, true);
assert('delivered delivery line has links', fileDeliveryLine([{ name: 'dl.pdf', size: 1024 }], { status: 'delivered', links: 'https://tmpfiles.org/abc/dl.pdf' }).indexOf('https://tmpfiles.org/abc/dl.pdf') !== -1, true);
assert('https url accepted', isHttpsDownloadUrl('https://tmpfiles.org/abc/dl.pdf'), true);
assert('http url rejected', isHttpsDownloadUrl('http://tmpfiles.org/abc/dl.pdf'), false);
assert('inbox note rejected as url', isHttpsDownloadUrl('Emailed as attachments to rafael@recaldelaw.com'), false);
assert('empty url rejected', isHttpsDownloadUrl(''), false);
assert('error-page https rejected', isHttpsDownloadUrl('https://www.bunkerweb.io/?utm_source=bwerror'), false);
assert('untrusted https host rejected', isHttpsDownloadUrl('https://example.com/file.pdf'), false);
assert('trusted host homepage rejected', isHttpsDownloadUrl('https://tmpfiles.org/'), false);
assert('firstHttpsUrl picks the link', firstHttpsUrl('dl.pdf: https://filebin.net/bin/dl.pdf'), 'https://filebin.net/bin/dl.pdf');
assert('countHttpsUrls counts verified links', countHttpsUrls('a: https://tmpfiles.org/a/x.pdf\nb: https://filebin.net/b/y.pdf'), 2);
assert('hasDeliveredUrls requires one https per file', hasDeliveredUrls({ status: 'delivered', links: 'https://tmpfiles.org/a/x.pdf' }, [{ name: 'x.pdf' }, { name: 'y.pdf' }]), false);
assert('decline is a designed screen', src.indexOf('Outside the 24-month window') !== -1, true);
assert('initial showPanel is silent', src.indexOf('showPanel(1, { silent: true })') !== -1, true);
assert('describe empty files', describeFiles([]), 'None uploaded on this submit');
assert('describe named file', describeFiles([{ name: 'dl.pdf', size: 2048 }]), 'dl.pdf (2 KB)');

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('All date checks passed');
