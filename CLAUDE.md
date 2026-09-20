# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A VSCode extension (`intouch-language`) providing tree-sitter-powered syntax highlighting for AVEVA InTouch HMI QuickScript and Window Report export files, plus a command/CLI to split a monolithic InTouch project export into per-window/per-script files.

## Commands

```bash
npm install
npm run build:parser   # tree-sitter generate + WASM build (requires Docker) + copy to out/
npm run compile        # TypeScript -> out/
npm run package         # build .vsix via vsce
npm run split -- <file> [--force] [--encoding cp949]   # CLI splitter (requires compile first)
```

- `npm run build:parser` only needs re-running when `tree-sitter-intouch/grammar.js` (or queries) change — it spins up a Docker/emscripten container to build the WASM parser.
- `npm run compile` alone is enough for TypeScript-only changes.
- Manual testing: press F5 in VSCode to launch the Extension Development Host, then open `sample/test.intouch` or a file under `docs/samples/`.
- Grammar corpus tests: `cd tree-sitter-intouch && npx tree-sitter test`.
- There is no JS/TS unit test suite; correctness is verified via the tree-sitter corpus tests and manual splitter runs against sample exports.

## Architecture

Full details live in [docs/architecture.md](docs/architecture.md) (what connects to what) and [docs/design.md](docs/design.md) (why, as immutable ADR-style sections — never edit past decisions, only append superseding ones). Read those before making non-trivial changes; the summary below is only an index.

The extension has two independent paths from `src/extension.ts`:

1. **Highlighting**: `src/parser.ts` (web-tree-sitter WASM) → `src/semanticTokensProvider.ts` (captures from `tree-sitter-intouch/queries/highlights.scm` mapped to VSCode semantic tokens). `syntaxes/intouch.tmLanguage.json` is a minimal TextMate grammar kept *only* so VSCode's bracket-pair colorizer recognizes string/comment scopes — it has no visible effect since semantic tokens override it.
2. **Splitter**: `src/splitter/` is a pure pipeline with **no VSCode dependency** (`parseSections` → `buildLayout` → `writeFiles`), called identically by both `src/commands/split.ts` (VSCode command) and `src/scripts/split-cli.ts` (CLI entry point). Only logging/conflict-handling UX differs between the two entry points.

Key facts worth knowing before touching splitter code:
- `SectionKind` is one of `'window' | 'scriptInstance' | 'databaseReport'`; the 6 script categories (Application/Condition/Data Change/Key/QuickFunction/ActiveX Event) are all `scriptInstance`, configured in `src/splitter/categories.ts`.
- `parseSections.ts` is a line-by-line state machine with 3 state variables (`currentIdx`, `activeCategory`, `pendingStart`) — see the transition table in architecture.md §3 before modifying it.
- Adding a new export category is a documented procedure in [docs/contributing.md](docs/contributing.md) ("새 카테고리 추가 절차") — it's an entry in `SCRIPT_CATEGORIES`, not new code, unless the category needs a genuinely new `SectionKind`.
- `TOKEN_TYPES`/`TOKEN_MODIFIERS` arrays in `semanticTokensProvider.ts` are order-sensitive (order = numeric ID encoded into `SemanticTokensBuilder`) — always append, never reorder.
- Error handling convention: domain code (`src/splitter/*`) throws on unrecoverable format errors and accumulates `SplitWarning`s for recoverable ones; the VSCode entry point never lets an error kill the process, the CLI entry point exits non-zero.

## Documentation upkeep

This repo intentionally keeps docs close to code and expects them to stay in sync manually (no CI enforcement):
- Changed the splitter pipeline/state machine or category definitions? Check whether [docs/architecture.md](docs/architecture.md) §3/§4 need updating.
- Made a non-obvious design decision? Add a new section to [docs/design.md](docs/design.md) (never edit existing sections — mark them "Superseded by §N" instead).
- Small rationale that doesn't need a design doc section: a `// WHY:` code comment (1-2 lines, no HOW, prefix exactly `// WHY:`).
- Added/changed an export category: also update the format table in [README.md](README.md).
