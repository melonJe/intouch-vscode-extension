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
  /**
   * When the instance line has no name, look for this field inside the body (capture group 1)
   * instead of treating `Script <trigger>:` lines as separate-file boundaries. All trigger blocks
   * stay merged into one file and their `Script ...:` labels are kept in the output (not stripped).
   */
  nameField?: RegExp;
  /** Prefix for the auto-generated name when both the instance line and nameField are empty. */
  fallbackNamePrefix?: string;
  /** Body lines matching this pattern are dropped from the output — redundant metadata already captured in the filename. */
  stripFieldLine?: RegExp;
  /**
   * Output starts at the first line matching this (inclusive); everything before it is dropped.
   * For exports that echo the instance header content before the real fields begin.
   * No match anywhere in the section means the section is left untouched.
   */
  bodyStartField?: RegExp;
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
    preserveIdentifier: true,
    // WHY: 일부 export는 인스턴스 라인에 이름이 없고 본문의 `Comment:` 필드가 사람이 붙인
    // 이름 역할을 한다. On True/On False/While True/While False 등 여러 trigger 블록이 한
    // Condition Script 세트에 속하므로(Application Script와 반대) 트리거별로 쪼개지 않고
    // Comment 이름의 파일 하나로 병합한다.
    nameField: /^\s*Comment:\s*(.*)$/i,
    fallbackNamePrefix: 'Condition',
    // WHY: 인스턴스 헤더 뒤에 조건식이 한 번 나오고 `Condition:` 필드에서 똑같이 반복된다.
    // 앞쪽 사본은 중복이라 `Condition:`부터 출력한다. Comment는 파일명으로 이미 드러나므로 제거.
    bodyStartField: /^\s*Condition:/i,
    stripFieldLine: /^\s*Comment:/i,
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
    // WHY: 인스턴스 라인이 이미 키 조합 이름을 담고 있는데(`Key Script:Ctrl+Shift+t`), 본문에
    // 동일 정보를 반복하는 `    Key:        Ctrl+Shift+t` 라인이 또 있다. 파일명으로 이미
    // 드러나므로 본문에서는 중복 노이즈일 뿐이라 제거한다.
    stripFieldLine: /^\s*Key:\s*.*$/i,
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
