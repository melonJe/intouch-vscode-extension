import { buildLayout } from './buildLayout';
import { parseSections } from './parseSections';
import { SplitResult } from './types';

export function splitProject(text: string): SplitResult {
  const parsed = parseSections(text);
  const layout = buildLayout(parsed.sections);
  if (parsed.sections.length === 0) {
    throw new Error(
      'InTouch export 형식이 아닌 파일입니다. `Window Report for ...` 또는 `Database Report ...` 헤더를 찾을 수 없습니다.',
    );
  }
  return {
    files: layout.files,
    warnings: [...parsed.warnings, ...layout.warnings],
  };
}

export { parseSections } from './parseSections';
export { buildLayout } from './buildLayout';
export { writeFiles } from './writeFiles';
export type { ConflictAction, WriteOptions, WriteOutcome } from './writeFiles';
export * from './types';
