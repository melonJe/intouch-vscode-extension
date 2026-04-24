import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import Parser = require('web-tree-sitter');

// Semantic token types & modifiers used by the InTouch highlights.scm.
// The order here defines the numeric IDs written into the semantic tokens
// byte stream — keep stable.
const TOKEN_TYPES = [
  'keyword',
  'type',
  'function',
  'variable',
  'property',
  'number',
  'string',
  'operator',
  'comment',
  'namespace',
  'label',
] as const;

const TOKEN_MODIFIERS = [
  'defaultLibrary',
  'documentation',
] as const;

export const legend = new vscode.SemanticTokensLegend(
  TOKEN_TYPES as unknown as string[],
  TOKEN_MODIFIERS as unknown as string[],
);

// Map from highlights.scm capture names (e.g. `@keyword.operator`) to
// semantic token type + modifiers.
const CAPTURE_MAP: Record<string, { type: string; mods?: string[] }> = {
  'keyword': { type: 'keyword' },
  'keyword.operator': { type: 'keyword' },
  'type': { type: 'type' },
  'function': { type: 'function' },
  'variable': { type: 'variable' },
  'variable.builtin': { type: 'variable', mods: ['defaultLibrary'] },
  'property': { type: 'property' },
  'number': { type: 'number' },
  'string': { type: 'string' },
  'operator': { type: 'operator' },
  'comment': { type: 'comment' },
  'namespace': { type: 'namespace' },
  'label': { type: 'label' },
};

// Built-in library function names (lowercase). Must stay in sync with
// tree-sitter-intouch/grammar.js `BUILTIN_FUNCTIONS` (131 entries).
const BUILTIN_FUNCTIONS: ReadonlySet<string> = new Set([
  // String
  'stringascii','stringchar','stringcompare','stringcomparenocase',
  'stringfind','stringfromintg','stringfromreal','stringfromtime',
  'stringfromtimelocal','stringinstring','stringleft','stringlen',
  'stringlower','stringmid','stringreplace','stringright','stringspace',
  'stringtest','stringtointg','stringtoreal','stringtrim','stringupper',
  'text','dtext',
  // Math
  'abs','atan','cos','exp','log','logn','pi','round','sgn',
  'sin','sqrt','tan','arccos','arcsin','arctan','pow','frac','int',
  'max','min','random','trunc',
  // IO
  'tagread','tagwrite','tagexists','tagdelete','tagsetattribute','taggetattribute',
  // Window
  'show','hide','togglehide','printwindow','closewindow',
  'wwdialup','wwcontrol','wwexecute','showat',
  // Alarm
  'ack','almackall','almackselect','almackselected','almselect',
  'almmovecursor','almshow','almsuppress','almunsuppress',
  // File
  'fileread','filewrite','filedelete','filecopy','filemove',
  'filefindfirst','filefindnext','filefindclose','fileclose',
  'filereadmessage','filewritemessage','infodisk','infofile','inforesource',
  // Historian
  'htgetpenname','htgetvalue','htgettimeatscooter',
  'htgettimestringatscooter','htsetpenname','htupdatetocurrenttime',
  // SQL
  'sqlconnect','sqlcreatetable','sqldelete','sqldroptable',
  'sqlexecute','sqlinsert','sqlselect','sqlsetparamvalue','sqlsetstatement',
  'sqltrancommit','sqltranrollback','sqltranstart','sqlupdate','sqlupdatecurrent',
  'sqlnext','sqlnumrows','sqlpreparestatement','sqldisconnect','sqlend',
  'sqlerrormsg','sqlfirst','sqlgetrecord',
  'sqlclearparam','sqlclearstatement','sqlappendstatement',
  // System
  'verifyuser','getusername','isauthorized','intouchversion',
  'intouchappdir','intouchviewaccess','postevent','sendkeys',
  'playsound','logmessage','execute','winplatform',
  'getnodename','getprojectname',
  'rgb',
]);

// Bare-command built-ins (lowercase) that should render as @keyword when
// used in statement form. Must stay in sync with
// tree-sitter-intouch/grammar.js `BARE_COMMANDS`.
const BARE_COMMAND_KEYWORDS: ReadonlySet<string> = new Set([
  'hideself', 'show', 'hide', 'ack',
]);

const TODO_RE = /\b(TODO|FIXME|HACK|NOTE|BUG|XXX):?/gi;

interface PendingToken {
  line: number;
  col: number;
  length: number;
  typeIdx: number;
  modBits: number;
}

interface CachedTree {
  version: number;
  tree: Parser.Tree;
}

export class IntouchSemanticTokensProvider
  implements vscode.DocumentRangeSemanticTokensProvider, vscode.Disposable {
  private query: Parser.Query | undefined;
  private trees = new Map<string, CachedTree>();

  constructor(private parser: Parser, language: Parser.Language) {
    try {
      const scmPath = this.findHighlightsScm();
      const source = fs.readFileSync(scmPath, 'utf8');
      this.query = language.query(source);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(
        `InTouch highlights query failed to load: ${msg}`,
      );
      this.query = undefined;
    }
  }

  private findHighlightsScm(): string {
    // Resolve highlights.scm bundled alongside the WASM under out/ or
    // inside tree-sitter-intouch/queries/ during dev.
    const candidates = [
      path.join(__dirname, '..', 'tree-sitter-intouch', 'queries', 'highlights.scm'),
      path.join(__dirname, 'highlights.scm'),
      path.join(__dirname, '..', 'out', 'highlights.scm'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    throw new Error('highlights.scm not found (checked ' + candidates.join(', ') + ')');
  }

  provideDocumentRangeSemanticTokens(
    document: vscode.TextDocument,
    range: vscode.Range,
    token: vscode.CancellationToken,
  ): vscode.SemanticTokens {
    const builder = new vscode.SemanticTokensBuilder(legend);
    if (!this.query) return builder.build();

    const tree = this.getOrParseTree(document);
    const captures = this.query.captures(tree.rootNode, {
      startPosition: { row: range.start.line, column: range.start.character },
      endPosition: { row: range.end.line, column: range.end.character },
    });

    const tokens: PendingToken[] = [];

    for (const capture of captures) {
      if (token.isCancellationRequested) break;

      const mapping = this.resolveMapping(capture);
      if (!mapping) continue;

      const node = capture.node;
      const typeIdx = legend.tokenTypes.indexOf(mapping.type);
      const modBits = this.modifierBitmask(mapping.mods);

      this.pushNodeRange(tokens, document, node, typeIdx, modBits);

      // Word-level TODO/FIXME markers inside comments.
      if (capture.name === 'comment') {
        this.scanCommentForTodos(tokens, document, node);
      }
    }

    tokens.sort((a, b) => a.line - b.line || a.col - b.col);
    for (const t of tokens) {
      builder.push(t.line, t.col, t.length, t.typeIdx, t.modBits);
    }

    return builder.build();
  }

  // Apply incremental edits from a TextDocumentChangeEvent to the cached
  // parse tree, then reparse with the edited tree as oldTree so tree-sitter
  // can reuse unchanged subtrees. Called from extension.ts.
  applyEdits(
    document: vscode.TextDocument,
    changes: readonly vscode.TextDocumentContentChangeEvent[],
  ): void {
    if (changes.length === 0) return;
    const uri = document.uri.toString();
    const cached = this.trees.get(uri);
    if (!cached) return; // no prior tree — next provide call will do a full parse

    // Apply in reverse offset order so earlier edits' coordinates remain
    // valid (VSCode may emit changes in any order).
    const ordered = [...changes].sort((a, b) => b.rangeOffset - a.rangeOffset);
    for (const c of ordered) {
      const startIndex = c.rangeOffset;
      const oldEndIndex = c.rangeOffset + c.rangeLength;
      const newEndIndex = c.rangeOffset + c.text.length;
      const startPosition = {
        row: c.range.start.line,
        column: c.range.start.character,
      };
      const oldEndPosition = {
        row: c.range.end.line,
        column: c.range.end.character,
      };
      const newEndPosition = computeNewEndPosition(startPosition, c.text);
      cached.tree.edit({
        startIndex,
        oldEndIndex,
        newEndIndex,
        startPosition,
        oldEndPosition,
        newEndPosition,
      });
    }

    const newTree = this.parser.parse(document.getText(), cached.tree);
    cached.tree.delete();
    this.trees.set(uri, { version: document.version, tree: newTree });
  }

  // Release the cached tree for a closed document to free WASM heap memory.
  forget(uri: vscode.Uri): void {
    const key = uri.toString();
    const entry = this.trees.get(key);
    if (entry) {
      entry.tree.delete();
      this.trees.delete(key);
    }
  }

  dispose(): void {
    for (const { tree } of this.trees.values()) {
      tree.delete();
    }
    this.trees.clear();
    this.query?.delete();
    this.query = undefined;
  }

  private getOrParseTree(document: vscode.TextDocument): Parser.Tree {
    const uri = document.uri.toString();
    const cached = this.trees.get(uri);
    if (cached && cached.version === document.version) {
      return cached.tree;
    }
    if (cached) {
      cached.tree.delete();
    }
    const tree = this.parser.parse(document.getText());
    this.trees.set(uri, { version: document.version, tree });
    return tree;
  }

  // Resolve a capture to a token type/modifier, applying the bare-command
  // and built-in function reclassification that used to live in
  // highlights.scm #match? predicates (which depend on JS RegExp and
  // cannot use inline `(?i)` flags).
  private resolveMapping(
    capture: Parser.QueryCapture,
  ): { type: string; mods?: string[] } | undefined {
    if (capture.name === 'function') {
      const name = capture.node.text.toLowerCase();
      if (
        capture.node.parent?.type === 'command_statement' &&
        BARE_COMMAND_KEYWORDS.has(name)
      ) {
        return { type: 'keyword' };
      }
      if (BUILTIN_FUNCTIONS.has(name)) {
        return { type: 'function', mods: ['defaultLibrary'] };
      }
      return { type: 'function' };
    }
    return CAPTURE_MAP[capture.name];
  }

  private pushNodeRange(
    out: PendingToken[],
    document: vscode.TextDocument,
    node: Parser.SyntaxNode,
    typeIdx: number,
    modBits: number,
  ): void {
    const start = node.startPosition;
    const end = node.endPosition;

    if (start.row === end.row) {
      if (end.column > start.column) {
        out.push({
          line: start.row,
          col: start.column,
          length: end.column - start.column,
          typeIdx,
          modBits,
        });
      }
      return;
    }

    for (let row = start.row; row <= end.row; row++) {
      const lineText = document.lineAt(row).text;
      const colStart = row === start.row ? start.column : 0;
      const colEnd = row === end.row ? end.column : lineText.length;
      if (colEnd > colStart) {
        out.push({
          line: row,
          col: colStart,
          length: colEnd - colStart,
          typeIdx,
          modBits,
        });
      }
    }
  }

  private scanCommentForTodos(
    out: PendingToken[],
    document: vscode.TextDocument,
    node: Parser.SyntaxNode,
  ): void {
    const text = node.text;
    const baseOffset = node.startIndex;
    const typeIdx = legend.tokenTypes.indexOf('comment');
    const modBits = this.modifierBitmask(['documentation']);

    TODO_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TODO_RE.exec(text)) !== null) {
      const startPos = document.positionAt(baseOffset + m.index);
      out.push({
        line: startPos.line,
        col: startPos.character,
        length: m[0].length,
        typeIdx,
        modBits,
      });
    }
  }

  private modifierBitmask(mods?: string[]): number {
    if (!mods || mods.length === 0) return 0;
    let mask = 0;
    for (const m of mods) {
      const idx = legend.tokenModifiers.indexOf(m);
      if (idx >= 0) mask |= 1 << idx;
    }
    return mask;
  }
}

// Compute the tree-sitter point that results from inserting `text` starting
// at `start`. tree-sitter Points are 0-based { row, column }.
function computeNewEndPosition(
  start: { row: number; column: number },
  text: string,
): { row: number; column: number } {
  let row = start.row;
  let lastNewline = -1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) {
      row++;
      lastNewline = i;
    }
  }
  const column =
    lastNewline === -1
      ? start.column + text.length
      : text.length - lastNewline - 1;
  return { row, column };
}
