import * as path from 'path';
import * as vscode from 'vscode';
import Parser = require('web-tree-sitter');

export interface IntouchParser {
  parser: Parser;
  language: Parser.Language;
}

/**
 * Initializes web-tree-sitter and loads the InTouch grammar WASM that
 * ships with the extension.
 */
export async function loadIntouchParser(ctx: vscode.ExtensionContext): Promise<IntouchParser> {
  await Parser.init({
    locateFile(_name: string): string {
      // `tree-sitter.wasm` (runtime) is bundled with web-tree-sitter itself.
      return path.join(
        ctx.extensionPath,
        'node_modules',
        'web-tree-sitter',
        'tree-sitter.wasm',
      );
    },
  });

  const parser = new Parser();
  const wasmPath = path.join(ctx.extensionPath, 'out', 'tree-sitter-intouch.wasm');
  const language = await Parser.Language.load(wasmPath);
  parser.setLanguage(language);

  return { parser, language };
}
