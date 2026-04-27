import { SCRIPT_CATEGORIES } from './categories';
import { sanitizeIdentifier, sanitizeScriptName, sanitizeWindowName } from './sanitize';
import { Section, SplitFile, SplitWarning } from './types';

export interface LayoutResult {
  files: SplitFile[];
  warnings: SplitWarning[];
}

export function buildLayout(sections: Section[]): LayoutResult {
  const warnings: SplitWarning[] = [];
  const used = new Set<string>();
  const files: SplitFile[] = [];

  const dedupe = (parts: string[]): string[] => {
    const key = parts.join('/').toLowerCase();
    if (!used.has(key)) {
      used.add(key);
      return parts;
    }
    const ext = parts[parts.length - 1].match(/\.[^.]+$/)?.[0] ?? '';
    const base = parts[parts.length - 1].slice(0, parts[parts.length - 1].length - ext.length);
    let n = 2;
    while (true) {
      const candidate = [...parts.slice(0, -1), `${base}_${n}${ext}`];
      const cKey = candidate.join('/').toLowerCase();
      if (!used.has(cKey)) {
        used.add(cKey);
        warnings.push({
          code: 'duplicate_name',
          message: `중복된 출력 경로 회피: ${candidate.join('/')}`,
        });
        return candidate;
      }
      n += 1;
    }
  };

  for (const s of sections) {
    if (s.kind === 'window') {
      const file = `${sanitizeWindowName(s.name)}.txt`;
      files.push({ pathParts: dedupe(['windows', file]), content: s.text });
    } else if (s.kind === 'databaseReport') {
      files.push({ pathParts: dedupe(['database_report.txt']), content: s.text });
    } else if (s.kind === 'scriptInstance' && s.category) {
      const cat = SCRIPT_CATEGORIES.find((c) => c.folder === s.category);
      const preserve = cat?.preserveIdentifier === true;
      const file = `${preserve ? sanitizeIdentifier(s.name) : sanitizeScriptName(s.name)}.txt`;
      files.push({ pathParts: dedupe([s.category, file]), content: s.text });
    }
  }

  return { files, warnings };
}
