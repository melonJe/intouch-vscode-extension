import * as vscode from 'vscode';
import { runSplitCommand } from './commands/split';
import { loadIntouchParser } from './parser';
import { IntouchSemanticTokensProvider, legend } from './semanticTokensProvider';

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  const { parser, language } = await loadIntouchParser(ctx);
  const provider = new IntouchSemanticTokensProvider(parser, language);

  ctx.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: 'intouch' },
      provider,
      legend,
    ),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId !== 'intouch') return;
      provider.applyEdits(e.document, e.contentChanges);
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      provider.forget(doc.uri);
    }),
    vscode.commands.registerCommand('intouch.splitExport', runSplitCommand),
    provider,
  );
}

export function deactivate(): void {}
