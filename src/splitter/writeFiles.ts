import * as fs from 'fs/promises';
import * as path from 'path';
import { SplitResult } from './types';

export type ConflictAction = 'overwriteAll' | 'cancel';

export interface WriteOptions {
  outDir: string;
  overwrite: 'abort' | 'overwriteAll';
  onConflict?: () => Promise<ConflictAction>;
}

export interface WriteOutcome {
  written: string[];
  cancelled: boolean;
}

async function dirHasFiles(dir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir);
    return entries.length > 0;
  } catch {
    return false;
  }
}

export async function writeFiles(result: SplitResult, opts: WriteOptions): Promise<WriteOutcome> {
  const written: string[] = [];

  if (opts.overwrite !== 'overwriteAll' && (await dirHasFiles(opts.outDir))) {
    if (!opts.onConflict) return { written, cancelled: true };
    const action = await opts.onConflict();
    if (action === 'cancel') return { written, cancelled: true };
  }

  for (const file of result.files) {
    const rel = file.pathParts.join('/');
    const abs = path.join(opts.outDir, ...file.pathParts);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, file.content);
    written.push(rel);
  }

  return { written, cancelled: false };
}
