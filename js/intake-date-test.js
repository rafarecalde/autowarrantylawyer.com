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

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('All date checks passed');
