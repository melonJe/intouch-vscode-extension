const RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

const FORBIDDEN = /[<>:"/\\|?*\x00-\x1F]/g;

function baseSanitize(raw: string): string {
  let s = raw.trim();
  s = s.replace(FORBIDDEN, '_');
  s = s.replace(/%/g, 'pct');
  s = s.replace(/[\s.]+/g, '_');
  s = s.replace(/^[._]+|[._]+$/g, '');
  if (RESERVED.has(s.toUpperCase())) s = '_' + s;
  if (s.length > 80) s = s.slice(0, 80);
  if (s === '') s = '_';
  return s;
}

export function sanitizeWindowName(raw: string): string {
  let s = raw.trim();
  s = s.replace(FORBIDDEN, '_');
  s = s.replace(/%/g, 'pct');
  s = s.replace(/[.]+/g, '_');
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/^[._\s]+|[._\s]+$/g, '');
  if (RESERVED.has(s.toUpperCase())) s = '_' + s;
  if (s.length > 80) s = s.slice(0, 80);
  if (s === '') s = '_';
  return s;
}

export function sanitizeScriptName(raw: string): string {
  let s = baseSanitize(raw).toLowerCase();
  s = s.replace(/[^a-z0-9_]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (s === '') s = '_';
  return s;
}

export function sanitizeIdentifier(raw: string): string {
  return baseSanitize(raw);
}
