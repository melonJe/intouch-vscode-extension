#!/usr/bin/env node
import * as fs from 'fs/promises';
import * as path from 'path';
import { splitProject } from '../splitter';
import { writeFiles } from '../splitter/writeFiles';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const inputs = args.filter((a) => !a.startsWith('--'));
  if (inputs.length === 0) {
    console.error('Usage: npm run split -- <file.txt> [<file2.txt> …] [--force]');
    process.exit(2);
  }

  for (const input of inputs) {
    const abs = path.resolve(input);
    const text = await fs.readFile(abs, 'utf8');
    const result = splitProject(text);
    const outDir = path.join(path.dirname(abs), path.basename(abs, path.extname(abs)));

    const outcome = await writeFiles(result, {
      outDir,
      overwrite: force ? 'overwriteAll' : 'abort',
      onConflict: async () => {
        console.error(`Refusing to overwrite ${outDir}. Re-run with --force.`);
        return 'cancel';
      },
    });

    for (const w of result.warnings) {
      const at = w.line ? ` (line ${w.line})` : '';
      console.warn(`[${w.code}]${at} ${w.message}`);
    }

    if (outcome.cancelled) {
      process.exit(1);
    }
    console.log(`Wrote ${outcome.written.length} files to ${outDir}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
