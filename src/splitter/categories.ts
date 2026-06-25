export interface ScriptCategory {
  banner: RegExp;
  instance: RegExp;
  folder: string;
  triggerFallback?: RegExp;
  postProcessName?: (raw: string) => string;
  /** Treat the extracted name as a code identifier — preserve case, do not convert to snake_case. */
  preserveIdentifier?: boolean;
  /** Strip the `FuncName( )   {` first line and closing `}` last line from the output. */
  stripBraceWrapper?: boolean;
}

// WHY: 모든 banner/instance 정규식에 `i` 플래그 일괄 적용. InTouch export 파일은
// 환경/버전에 따라 케이스가 일정하지 않게 떨어진다(`Data change script:` 등 관찰됨).
// preserveIdentifier 기준은 docs/design.md §3 표 참조 — 이름이 코드/태그에서 동일 케이스로
// 등장하는 식별자면 true, 사람이 읽는 트리거 표현식이면 미설정(false).
export const SCRIPT_CATEGORIES: ScriptCategory[] = [
  {
    banner: /^Application Scripts\s*$/i,
    instance: /^Application Script:\s*$/i,
    folder: 'application',
    triggerFallback: /^\s{4,}Script\s+(.+?):\s*$/i,
  },
  {
    banner: /^Condition Scripts\s*$/i,
    instance: /^Condition Script:\s*(.*?)\s*$/i,
    folder: 'condition',
    triggerFallback: /^\s{4,}Script\s+(.+?):\s*$/i,
    preserveIdentifier: true,
  },
  {
    banner: /^Data Change Scripts\s*$/i,
    instance: /^Data Change Script:\s*(.*?)\s*$/i,
    folder: 'data_change',
    preserveIdentifier: true,
  },
  {
    banner: /^Key Scripts\s*$/i,
    instance: /^Key Script:\s*(.*?)\s*$/i,
    folder: 'key',
  },
  {
    banner: /^QuickFunctions\s*$/i,
    instance: /^QuickFunction:\s*(.+?)\s*$/i,
    folder: 'quick_functions',
    postProcessName: (raw) => raw.split('(')[0].trim(),
    preserveIdentifier: true,
    stripBraceWrapper: true,
  },
  {
    banner: /^ActiveX Event Scripts\s*$/i,
    instance: /^ActiveX Event Script:\s*(.+?)\s*$/i,
    folder: 'activex_event',
    preserveIdentifier: true,
    stripBraceWrapper: true,
  },
];

export function findCategoryByBanner(line: string): ScriptCategory | undefined {
  return SCRIPT_CATEGORIES.find((c) => c.banner.test(line));
}

export function findCategoryByInstance(line: string): { category: ScriptCategory; match: RegExpExecArray } | undefined {
  for (const c of SCRIPT_CATEGORIES) {
    const m = c.instance.exec(line);
    if (m) return { category: c, match: m };
  }
  return undefined;
}
