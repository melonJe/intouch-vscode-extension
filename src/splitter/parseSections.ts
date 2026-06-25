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
// WHY: export 시점에 따라 매번 달라지는 노이즈라 diff 안정성을 위해 출력에서 제거.
const LAST_MODIFIED = /^\s*Last Modified Date\/Time\s*:/;
// WHY: `Script <trigger>:` 라벨은 두 의미를 가진다 — Application Script의 인스턴스
// 이름 복원(triggerFallback) 또는 named instance(예: Condition) 안의 본문 블록 경계.
const TRIGGER_LABEL = /^\s*Script\s+.+:\s*$/i;

function dedentByMin(lines: string[], skipColumnZero: boolean): string[] {
  let min = Infinity;
  for (const ln of lines) {
    if (ln.trim() === '') continue;
    const lead = /^ */.exec(ln)![0].length;
    if (skipColumnZero && lead === 0) continue;
    if (lead < min) min = lead;
  }
  if (!isFinite(min) || min === 0) return lines.slice();
  return lines.map((ln) => {
    if (ln.trim() === '') return ln;
    const lead = /^ */.exec(ln)![0].length;
    if (skipColumnZero && lead === 0) return ln;
    return lead >= min ? ln.slice(min) : ln.replace(/^ +/, '');
  });
}

// WHY: 두 분기는 카테고리 형태 차이에서 옴 — docs/design.md §5 참조.
// trigger 앵커 경로(Application/Condition 등)는 `Script <trigger>:` 사이의 본문 블록을 dedent.
// 폴백 경로(QuickFunction/ActiveX)는 trigger 라벨 없이 `{...}` 안 본문이라
// column 0(인스턴스 헤더, `{`, `}`)을 보존하면서 dedent.
function dedentScriptBodies(lines: string[]): string[] {
  const hasTrigger = lines.some((ln) => TRIGGER_LABEL.test(ln));
  if (!hasTrigger) return dedentByMin(lines, true);

  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    out.push(lines[i]);
    if (TRIGGER_LABEL.test(lines[i])) {
      let j = i + 1;
      while (j < lines.length && !TRIGGER_LABEL.test(lines[j])) j++;
      out.push(...dedentByMin(lines.slice(i + 1, j), false));
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

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

  const openSection = (p: Pending, closeBefore?: number): void => {
    closeAt(closeBefore !== undefined ? closeBefore : p.startLine - 1);
    pendings.push(p);
    currentIdx = pendings.length - 1;
  };

  // WHY: 일부 InTouch export는 첫 줄이 `indow Report for ...`로 잘려 떨어지는
  // 결함이 관찰됨. 진행 자체를 막는 대신 W를 보충하고 경고로 알린다.
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
      openSection({ kind: 'window', name: winMatch[1], startLine: i }, i - 1);
      activeCategory = undefined;
      pendingStart = undefined;
      continue;
    }

    if (DB_REPORT_HDR.test(line)) {
      openSection({ kind: 'databaseReport', name: 'database_report', startLine: i }, i - 1);
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
        pendingStart = i + 1;
      } else {
        const name = ensureUniqueOrEmpty(raw, cat, i)!;
        openSection({ kind: 'scriptInstance', name, category: cat.folder, startLine: i + 1 }, i - 1);
        pendingStart = undefined;
      }
      continue;
    }

    // WHY: pendingStart 게이트는 named instance(Condition Script: TAG) 안의 trigger 라인이
    // 별도 섹션으로 분리되어 다른 태그 스크립트와 파일명 충돌하던 버그를 해소. 자세한 경위는 docs/design.md §4.
    if (cat?.triggerFallback && pendingStart !== undefined) {
      const tm = cat.triggerFallback.exec(line);
      if (tm) {
        const triggerName = ensureUniqueOrEmpty(tm[1], cat, i)!;
        pendings.push({
          kind: 'scriptInstance',
          name: triggerName,
          category: cat.folder,
          startLine: pendingStart + 1,
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
      let slice = lines
        .slice(p.startLine, p.endLine + 1)
        .filter((ln) => !LAST_MODIFIED.test(ln));
      if (p.kind === 'scriptInstance') slice = dedentScriptBodies(slice);
      if (p.kind === 'scriptInstance') slice = slice.filter((ln) => !TRIGGER_LABEL.test(ln));
      while (slice.length > 1 && slice[slice.length - 1] === '') slice.pop();
      if (p.kind === 'scriptInstance' && p.category) {
        const cat = SCRIPT_CATEGORIES.find((c) => c.folder === p.category);
        if (cat?.stripBraceWrapper) {
          if (slice.length > 0 && /\{\s*$/.test(slice[0])) slice = slice.slice(1);
          if (slice.length > 0 && /^\s*\}\s*$/.test(slice[slice.length - 1])) slice = slice.slice(0, -1);
        }
      }
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
