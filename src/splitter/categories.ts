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
    banner: /^Application Scripts\s*$/,
    instance: /^Application Script:\s*$/,
    folder: 'application_scripts',
    triggerFallback: /^\s{4,}Script\s+(.+?):\s*$/,
  },
  {
    banner: /^Condition Scripts\s*$/,
    instance: /^Condition Script:\s*(.*?)\s*$/,
    folder: 'condition_scripts',
    triggerFallback: /^\s{4,}Script\s+(.+?):\s*$/,
  },
  {
    banner: /^Data Change Scripts\s*$/,
    instance: /^Data Change Script:\s*(.*?)\s*$/,
    folder: 'data_change_scripts',
  },
  {
    banner: /^Key Scripts\s*$/,
    instance: /^Key Script:\s*(.*?)\s*$/,
    folder: 'key_scripts',
  },
  {
    banner: /^QuickFunctions\s*$/,
    instance: /^QuickFunction:\s*(.+?)\s*$/,
    folder: 'quick_functions',
    postProcessName: (raw) => raw.split('(')[0].trim(),
    preserveIdentifier: true,
  },
  {
    banner: /^ActiveX Event Scripts\s*$/,
    instance: /^ActiveX Event Script:\s*(.+?)\s*$/,
    folder: 'activex_event_scripts',
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
