/**
 * Confirms Google tags are on every HTML page and primary landings mount intake.
 * Run: node js/ads-tags-test.js
 */
var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var failed = 0;

function assert(name, ok) {
  if (!ok) {
    failed += 1;
    console.error('FAIL', name);
  } else {
    console.log('ok  ', name);
  }
}

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (entry.name === '.git' || entry.name === 'node_modules') return;
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  });
  return out;
}

var htmlFiles = walk(root, []);
assert('found html pages', htmlFiles.length >= 40);

var snippet = "gtag('config', 'G-F983DQ22DR')";
var ads = "gtag('config', 'AW-1020943370')";
var loader = 'https://www.googletagmanager.com/gtag/js?id=G-F983DQ22DR';
var helper = '/js/google-tags.js';

htmlFiles.forEach(function (file) {
  var rel = path.relative(root, file);
  var html = fs.readFileSync(file, 'utf8');
  assert(rel + ' has GA4 config', html.indexOf(snippet) !== -1);
  assert(rel + ' has Ads config', html.indexOf(ads) !== -1);
  assert(rel + ' loads gtag.js', html.indexOf(loader) !== -1);
  assert(rel + ' loads conversion helper', html.indexOf(helper) !== -1);
  assert(rel + ' keeps the hotline or has no phone CTA', html.indexOf('tel:+18662955347') !== -1 || rel === '404.html');
});

function hasMount(rel) {
  var html = fs.readFileSync(path.join(root, rel), 'utf8');
  return html.indexOf('data-intake-mount') !== -1 && html.indexOf('/js/intake.js') !== -1;
}

assert('homepage mounts intake', hasMount('index.html'));
assert('florida lemon law mounts intake', hasMount('florida-lemon-law/index.html'));
assert('how it works mounts intake', hasMount('how-it-works/index.html'));
assert('case review still mounts intake', hasMount('case-review/index.html'));

var tags = fs.readFileSync(path.join(__dirname, 'google-tags.js'), 'utf8');
assert('helper uses recaldelaw send_to label', tags.indexOf('AW-1020943370/CXe2CPPUwMIZEIq46eYD') !== -1);
assert('helper defines gtag_report_conversion', tags.indexOf('function gtag_report_conversion') !== -1);

var intake = fs.readFileSync(path.join(__dirname, 'intake.js'), 'utf8');
assert('intake still posts to existing Formspree endpoint', intake.indexOf('https://formspree.io/f/mqegejrg') !== -1);
assert('intake subject prefix is the lemon inquiry label', intake.indexOf("parts = ['Lemon Law Inquiry — autowarrantylawyer.com']") !== -1 || intake.indexOf('Lemon Law Inquiry — autowarrantylawyer.com') !== -1);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('All ads tag checks passed (' + htmlFiles.length + ' html files)');
