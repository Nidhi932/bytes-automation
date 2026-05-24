import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKER = '<!-- Inner experience starts from below -->';

const bytesPath = path.join(__dirname, '..', 'bytes-master.html');
const standardPath = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'standard-implementation.html'
);
const outPath = path.join(__dirname, '..', 'bytes-master-merged.html');

const STYLE_DEFAULTS = {
  HookHeaderTitleFontFamily: 'Jost-Bold',
  HookHeaderTitleFontSize: '28px',
  HookHeaderTitleFontColor: '#212529',
  HookVideoTitleFontFamily: 'Jost_Regular',
  HookVideoTitleFontSize: '18px',
  HookVideoTitleColor: '#ffffff',
  HookCTATextFontFamily: 'Jost-Bold',
  HookCTATextFontSize: '16px',
  HookCTAText: '#ffffff',
  HookCTABackground: '#E5363A',
  HookCTATextHover: '#ffffff',
  HookCTABackgroundHover: '#000000',
  HookSliderBtn: '#87D3DB',
  HookSliderBtnArrow: '#000000',
  HookSliderBtnHover: '#E5363A',
  HookSliderBtnArrowHover: '#ffffff',
  iconWrapWidth: '60px',
  iconFillOpacity: '0.4',
  HookPlayBtnBackground: '#000000',
  HookPlayBtnArrow: '#ffffff',
  iconFillOpacityHover: '0.2',
  HookPlayBtnBackgroundHover: '#000000',
  HookPlayBtnArrowHover: '#ffffff',
  hookMaxWidth: '750px',
  slideWidth: '319px',
  slideHeight: '567px',
  slideMarginRight: '16px',
};

function escapeAttr(val) {
  return String(val).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function normalizeValue(raw, format) {
  if (!raw) return '';
  let val = String(raw).trim();
  if (!val) return '';
  if (format === 'px') {
    if (/^\d+(\.\d+)?$/.test(val)) return val + 'px';
    return val;
  }
  if (format === 'hex') {
    if (!val.startsWith('#')) val = '#' + val.replace(/^#/, '');
    return val;
  }
  if (format === 'opacity') {
    if (/^\d+$/.test(val) && Number(val) > 1) return String(Number(val) / 100);
    return val;
  }
  return val;
}

function extractTagdValue(html, name) {
  const quoted = html.match(new RegExp('name="' + name + '"\\s+value="([^"]*)"', 'i'));
  if (quoted) {
    const v = quoted[1];
    if (v === '{' + name + '}') return STYLE_DEFAULTS[name] || '';
    return v;
  }
  return STYLE_DEFAULTS[name] || '';
}

function parseStylesFromBytes(html) {
  const styles = { ...STYLE_DEFAULTS };
  for (const key of Object.keys(STYLE_DEFAULTS)) {
    if (key.startsWith('Hook')) {
      const v = extractTagdValue(html, key);
      if (v) styles[key] = v;
    }
  }
  const maxW = html.match(/\.reels-hook-wrapper\s*\{\s*max-width:\s*([^;}\s{]+)/i);
  if (maxW && !maxW[1].includes('{')) styles.hookMaxWidth = maxW[1].trim();
  const slide = html.match(/\.reels-hook\s+li\s*\{[^}]*width:\s*([^;!}\s]+)[^}]*height:\s*([^;!}\s]+)/i);
  if (slide) {
    if (!slide[1].includes('{')) styles.slideWidth = slide[1].trim();
    if (!slide[2].includes('{')) styles.slideHeight = slide[2].trim();
  }
  const iconWrap = html.match(/\.reels-hook\s+li\s+\.icon-wrap\s*\{[^}]*width:\s*([^;}\s]+)/i);
  if (iconWrap && !iconWrap[1].includes('{')) styles.iconWrapWidth = iconWrap[1].trim();
  const iconOpacity = html.match(/\.reels-hook\s+li\s+\.icon-wrap\s+svg\s+circle\s*\{fill-opacity:\s*([^;}\s]+)/i);
  if (iconOpacity && !iconOpacity[1].includes('{')) styles.iconFillOpacity = iconOpacity[1].trim();
  const iconHover = html.match(/\.reels-hook\s+li:hover\s+\.icon-wrap\s+svg\s+circle\s*\{[^}]*fill-opacity:\s*([^;}\s]+)/i);
  if (iconHover && !iconHover[1].includes('{')) styles.iconFillOpacityHover = iconHover[1].trim();
  const slideMargin = html.match(/\.reels-hook\s+li\s*\{[^}]*margin-right:\s*([^;!}\s{]+)/i);
  if (slideMargin && !slideMargin[1].includes('{')) styles.slideMarginRight = slideMargin[1].trim();
  return styles;
}

function applyVariable(html, varName, value) {
  if (!value) return html;
  const safe = escapeAttr(value);
  const parts = html.split('{' + varName + '}');
  if (parts.length > 1) html = parts.join(value);
  html = html.replace(new RegExp('value="\\{' + varName + '\\}"', 'gi'), 'value="' + safe + '"');
  html = html.replace(new RegExp('value=\\{' + varName + '\\}', 'gi'), 'value="' + safe + '"');
  html = html.replace(
    new RegExp('(name="' + varName + '"\\s+value=")([^"]*)(")', 'gi'),
    '$1' + safe + '$3'
  );
  return html;
}

function varFormat(varName) {
  if (varName.includes('FillOpacity')) return 'opacity';
  if (varName.includes('FontSize') || varName.includes('Width') || varName.includes('Height') || varName === 'hookMaxWidth' || varName.startsWith('slide') || varName === 'iconWrapWidth') return 'px';
  if (varName.startsWith('Hook')) return 'hex';
  return 'text';
}

function applyCustomStyles(html, styles) {
  let out = html;
  for (const [varName, raw] of Object.entries(styles)) {
    if (!raw) continue;
    const val = normalizeValue(raw, varFormat(varName));
    if (!val) continue;
    if (varName.startsWith('Hook') || ['hookMaxWidth', 'slideWidth', 'slideHeight', 'slideMarginRight', 'iconWrapWidth', 'iconFillOpacity', 'iconFillOpacityHover'].includes(varName)) {
      out = applyVariable(out, varName, val);
    }
  }
  const slideW = normalizeValue(styles.slideWidth, 'px');
  const slideH = normalizeValue(styles.slideHeight, 'px');
  if (slideW) {
    out = out.replace(/(\.reels-hook\s+li\s*\{[^}]*width:\s*)(\{slideWidth\}|[^;!}]+)/i, '$1' + slideW);
    out = out.replace(/(\.hook-ed-wrapperouter\s*\{[^}]*width:\s*)(\{slideWidth\}|[^;}+]+)/i, '$1' + slideW);
  }
  if (slideH) {
    out = out.replace(/(\.reels-hook\s+li\s*\{[^}]*height:\s*)(\{slideHeight\}|[^;!}]+)/i, '$1' + slideH);
    out = out.replace(/(\.reels-hook\s+li\s+\.video-wrap\s*\{\s*height:\s*)(\{slideHeight\}|[^;}+]+)/i, '$1' + slideH);
    out = out.replace(/(\.hook-ed-wrapperouter\s*\{[^}]*height:\s*)(\{slideHeight\}|[^;}+]+)/i, '$1' + slideH);
  }
  const slideMargin = normalizeValue(styles.slideMarginRight, 'px');
  if (slideMargin) {
    out = out.replace(/(\.reels-hook\s+li\s*\{[^}]*margin-right:\s*)(\{slideMarginRight\}|[^;!}]+)/i, '$1' + slideMargin);
  }
  const maxW = normalizeValue(styles.hookMaxWidth, 'px');
  if (maxW) {
    out = out.replace(/(\.reels-hook-wrapper\s*\{\s*max-width:\s*)(\{hookMaxWidth\}|[^;}+]+)/i, '$1' + maxW);
  }
  const iconW = normalizeValue(styles.iconWrapWidth, 'px');
  if (iconW) {
    out = out.replace(/(\.reels-hook\s+li\s+\.icon-wrap\s*\{[^}]*width:\s*)(\{iconWrapWidth\}|[^;]+)/i, '$1' + iconW);
  }
  const iconOp = normalizeValue(styles.iconFillOpacity, 'opacity');
  if (iconOp) {
    out = out.replace(/(\.reels-hook\s+li\s+\.icon-wrap\s+svg\s+circle\s*\{fill-opacity:\s*)(\{iconFillOpacity\}|[^;}+]+)/i, '$1' + iconOp);
  }
  const iconOpHover = normalizeValue(styles.iconFillOpacityHover, 'opacity');
  if (iconOpHover) {
    out = out.replace(/(\.reels-hook\s+li:hover\s+\.icon-wrap\s+svg\s+circle\s*\{[^}]*fill-opacity:)(\{iconFillOpacityHover\}|[^;}+]+)/i, '$1' + iconOpHover);
  }
  return out;
}

const bytes = fs.readFileSync(bytesPath, 'utf8');
const standard = fs.readFileSync(standardPath, 'utf8');
const bi = bytes.indexOf(MARKER);
const si = standard.indexOf(MARKER);
if (bi === -1 || si === -1) throw new Error('Marker not found');

let result = bytes.slice(0, bi) + standard.slice(si);

if (bytes.includes('swiper-bundleH.min.css') && bytes.includes('swiper-bundleH.min.js')) {
  result = result.replace(
    /(\s*)\/\/hookHandler\.init\(\);(\s*\/\/ slider with leftmostAnimation)/,
    '$1hookHandler.init();$2'
  );
}

const styles = parseStylesFromBytes(bytes);
result = applyCustomStyles(result, styles);
fs.writeFileSync(outPath, result, 'utf8');

const checks = [
  ['no {slideWidth}', !result.includes('{slideWidth}')],
  ['header quoted', /HookHeaderTitleFontSize" value="28px"/.test(result)],
  ['slide rule', /\.reels-hook li \{width: 319px/.test(result)],
];
checks.forEach(([n, ok]) => console.log(ok ? 'OK' : 'FAIL', n));
console.log('Written:', outPath);
