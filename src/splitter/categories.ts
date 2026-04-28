export interface ScriptCategory {
  banner: RegExp;
  instance: RegExp;
  folder: string;
  triggerFallback?: RegExp;
  postProcessName?: (raw: string) => string;
  /** Treat the extracted name as a code identifier — preserve case, do not convert to snake_case. */
  preserveIdentifier?: boolean;
}

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
  },
  {
    banner: /^ActiveX Event Scripts\s*$/i,
    instance: /^ActiveX Event Script:\s*(.+?)\s*$/i,
    folder: 'activex_event',
    preserveIdentifier: true,
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
