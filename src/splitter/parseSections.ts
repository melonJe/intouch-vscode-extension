import {
  SCRIPT_CATEGORIES,
  ScriptCategory,
  findCategoryByBanner,
  findCategoryByInstance,
} from './categories';
import { Section, SplitWarning } from './types';

const WINDOW_HDR = /^[Ww]?indow Report for\s+"([^"]+)"/;
const TRUNCATED_WINDOW_HDR = /^indow Report for\s+"([^"]+)"/;
const DB_REPORT_HDR = /^Database Report\s+Printed On\s*:/;

export interface ParseResult {
  sections: Section[];
  warnings: SplitWarning[];
  terminator: '\r\n' | '\n';
}

function detectTerminator(text: string): '\r\n' | '\n' {
  const idx = text.indexOf('\n');
  if (idx > 0 && text.charCodeAt(idx - 1) === 0x0d) return '\r\n';
  return '\n';
}

interface Pending {
  kind: Section['kind'];
  name: string;
  category?: string;
  startLine: number;
  endLine?: number;
}

export function parseSections(text: string): ParseResult {
  const terminator = detectTerminator(text);
  const lines = text.split(/\r?\n/);
  const warnings: SplitWarning[] = [];
  const pendings: Pending[] = [];

  let currentIdx: number | undefined;
  let activeCategory: ScriptCategory | undefined;
  let pendingStart: number | undefined;

  const closeAt = (at: number): void => {
    if (currentIdx !== undefined) {
      pendings[currentIdx].endLine = at;
      currentIdx = undefined;
    }
  };

  const openSection = (p: Pending): void => {
    closeAt(p.startLine - 1);
    pendings.push(p);
    currentIdx = pendings.length - 1;
  };

  if (lines.length > 0 && TRUNCATED_WINDOW_HDR.test(lines[0])) {
    lines[0] = 'W' + lines[0];
    warnings.push({
      code: 'truncated_first_line',
      message: '첫 줄에서 W 누락이 감지되어 보충 후 진행',
      line: 1,
    });
  }

  const ensureUniqueOrEmpty = (rawName: string, cat: ScriptCategory, lineIdx: number): string | undefined => {
    let name = rawName.trim();
    if (cat.postProcessName) name = cat.postProcessName(name);
    if (name === '') {
      warnings.push({
        code: 'empty_instance_name',
        message: `${cat.folder} 인스턴스 이름이 비어있어 자동 생성`,
        line: lineIdx + 1,
      });
      const n = pendings.filter((s) => s.category === cat.folder).length + 1;
      return `${cat.folder}_${n}`;
    }
    return name;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const winMatch = WINDOW_HDR.exec(line);
    if (winMatch) {
      openSection({ kind: 'window', name: winMatch[1], startLine: i });
      activeCategory = undefined;
      pendingStart = undefined;
      continue;
    }

    if (DB_REPORT_HDR.test(line)) {
      openSection({ kind: 'databaseReport', name: 'database_report', startLine: i });
      activeCategory = undefined;
      pendingStart = undefined;
      continue;
    }

    const banner = findCategoryByBanner(line);
    if (banner) {
      closeAt(i - 1);
      activeCategory = banner;
      pendingStart = undefined;
      continue;
    }

    let cat = activeCategory;
    let instMatch: RegExpExecArray | null = null;
    if (cat) {
      instMatch = cat.instance.exec(line);
    }
    if (!instMatch && !cat) {
      const orphan = findCategoryByInstance(line);
      if (orphan) {
        warnings.push({
          code: 'orphan_script_instance',
          message: `banner 없이 ${orphan.category.folder} 인스턴스를 발견 — 카테고리 역추론`,
          line: i + 1,
        });
        cat = orphan.category;
        activeCategory = cat;
        instMatch = orphan.match;
      }
    }
    if (instMatch && cat) {
      const raw = (instMatch[1] || '').trim();
      if (raw === '') {
        closeAt(i - 1);
        pendingStart = i;
      } else {
        const name = ensureUniqueOrEmpty(raw, cat, i)!;
        openSection({ kind: 'scriptInstance', name, category: cat.folder, startLine: i });
        pendingStart = undefined;
      }
      continue;
    }

    if (cat?.triggerFallback) {
      const tm = cat.triggerFallback.exec(line);
      if (tm) {
        const triggerName = ensureUniqueOrEmpty(tm[1], cat, i)!;
        const startLine = pendingStart ?? i;
        if (pendingStart === undefined) closeAt(i - 1);
        pendings.push({
          kind: 'scriptInstance',
          name: triggerName,
          category: cat.folder,
          startLine,
        });
        currentIdx = pendings.length - 1;
        pendingStart = undefined;
        continue;
      }
    }
  }

  closeAt(lines.length - 1);

  const finalSections: Section[] = pendings
    .filter((p): p is Required<Pending> => p.endLine !== undefined && p.endLine >= p.startLine)
    .map((p) => {
      const slice = lines.slice(p.startLine, p.endLine + 1);
      while (slice.length > 1 && slice[slice.length - 1] === '') slice.pop();
      return {
        kind: p.kind,
        name: p.name,
        category: p.category,
        startLine: p.startLine,
        endLine: p.endLine,
        text: slice.join(terminator) + terminator,
      };
    });

  return { sections: finalSections, warnings, terminator };
}
