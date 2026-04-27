import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { splitProject } from '../splitter';
import { writeFiles } from '../splitter/writeFiles';

let outputChannel: vscode.OutputChannel | undefined;

function getChannel(): vscode.OutputChannel {
  if (!outputChannel) outputChannel = vscode.window.createOutputChannel('InTouch Split');
  return outputChannel;
}

async function resolveTargetUri(target?: vscode.Uri): Promise<vscode.Uri | undefined> {
  if (target) return target;
  const active = vscode.window.activeTextEditor?.document.uri;
  if (active) return active;
  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: { 'InTouch export': ['txt', 'intouch'] },
  });
  return picked?.[0];
}

export async function runSplitCommand(target?: vscode.Uri): Promise<void> {
  const uri = await resolveTargetUri(target);
  if (!uri) return;

  let text: string;
  try {
    text = await fs.readFile(uri.fsPath, 'utf8');
  } catch (e) {
    void vscode.window.showErrorMessage(`파일 읽기 실패: ${(e as Error).message}`);
    return;
  }

  let result;
  try {
    result = splitProject(text);
  } catch (e) {
    void vscode.window.showErrorMessage((e as Error).message);
    return;
  }

  const baseDir = path.dirname(uri.fsPath);
  const outDir = path.join(baseDir, path.basename(uri.fsPath, path.extname(uri.fsPath)));

  const outcome = await writeFiles(result, {
    outDir,
    overwrite: 'abort',
    onConflict: async () => {
      const choice = await vscode.window.showWarningMessage(
        `${path.basename(outDir)} 폴더에 이미 파일이 있습니다. 덮어쓸까요?`,
        { modal: true },
        'Overwrite all',
      );
      return choice === 'Overwrite all' ? 'overwriteAll' : 'cancel';
    },
  });

  const ch = getChannel();
  if (result.warnings.length > 0) {
    ch.appendLine(`[${new Date().toISOString()}] ${uri.fsPath}`);
    for (const w of result.warnings) {
      const at = w.line ? ` (line ${w.line})` : '';
      ch.appendLine(`  [${w.code}]${at} ${w.message}`);
    }
    ch.show(true);
  }

  if (outcome.cancelled) {
    void vscode.window.showInformationMessage('분할 취소됨.');
    return;
  }

  void vscode.window.showInformationMessage(
    `${outcome.written.length}개 파일을 ${outDir}에 작성했습니다.`,
  );
}
