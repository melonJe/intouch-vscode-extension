export type SectionKind =
  | 'window'
  | 'scriptInstance'
  | 'databaseReport';

export interface Section {
  kind: SectionKind;
  name: string;
  category?: string;
  startLine: number;
  endLine: number;
  text: string;
}

export interface SplitFile {
  pathParts: string[];
  content: string;
}

export type SplitWarningCode =
  | 'truncated_first_line'
  | 'unknown_top_level'
  | 'empty_instance_name'
  | 'duplicate_name'
  | 'orphan_script_instance';

export interface SplitWarning {
  code: SplitWarningCode;
  message: string;
  line?: number;
}

export interface SplitResult {
  files: SplitFile[];
  warnings: SplitWarning[];
}
