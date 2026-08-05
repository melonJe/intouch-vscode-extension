# Changelog

이 프로젝트의 모든 주요 변경사항은 이 파일에 기록됩니다. 형식은 [Keep a Changelog](https://keepachangelog.com/) 를 따르며, [Semantic Versioning](https://semver.org/) 을 준수합니다.

## [2.3.1] — 2026-08-05

### Fixed

- **분할(Split) 기능의 인코딩 깨짐 버그 수정**: `InTouch: Split Project Export…` 실행 시 원본 파일을 항상 `utf8`로 고정 디코딩하던 문제를 수정. EUC-KR/CP949 등으로 저장된 export 파일이 분할 시 문자가 깨지는 현상이 있었음.
- 이제 VS Code의 `files.encoding` 설정(전역 → 워크스페이스 → 폴더 → `[intouch]` 언어별 오버라이드 순으로 병합된 유효값)을 그대로 읽어 디코딩. 파일이 정상적으로 보이도록 `files.encoding`을 맞춰둔 상태라면 분할 결과도 동일하게 정상 처리됨.
- CLI(`npm run split`)에도 `--encoding <id>` 옵션 추가 (기본값 `utf8`).

### 관련 파일

- `src/splitter/encoding.ts` (신규)
- `src/commands/split.ts`, `src/scripts/split-cli.ts`

---

## [2.0.0] — 2026-04-25

Tree-sitter 기반 semantic highlighting으로 전환한 메이저 릴리스.

### Added

- **Tree-sitter 파서**: `web-tree-sitter` (WASM) 로 InTouch QuickScript + Window Report export 문법을 정확하게 파싱.
- **`DocumentSemanticTokensProvider`** 등록 — 테마의 `semanticTokenColors` 설정에 따라 색상이 적용됨.
- **131개 빌트인 함수** 카테고리 분류 (String / Math / IO / Window / Alarm / File / Historian / SQL / System) → `function.defaultLibrary` modifier.
- **Bare command 키워드** (`HideSelf`, `Show`, `Hide`, `Ack`) 가 statement 위치에서 키워드로 재분류.
- **TODO / FIXME / HACK / NOTE / BUG / XXX** 주석 내 마커 단어 강조 (`comment.documentation`).
- **Case-insensitive** 처리 — 모든 키워드/타입/연산자가 대소문자 무관하게 매칭.
- 파싱 결과를 URI + `document.version` 키로 캐시하여 탭 복귀 시 재파싱 방지.
- 편집 시 `Tree.edit()` + 부분 재파싱으로 incremental update.

### Changed

- 하이라이트 엔진을 **TextMate → Tree-sitter** 로 교체.
- VSCode 엔진 호환 범위를 `^1.80.0` 으로 갱신.

### Removed

- **TextMate grammar (`syntaxes/intouch.tmLanguage.json`)** 제거. 동일한 7개 scope (comment, string, keyword, type, operator-word, system-variable, number) 를 tree-sitter highlights query 가 모두 emit한다고 판단하여 제거함.
  - **주의**: TextMate scope (`source.intouch`) 에 의존하던 외부 테마/스니펫이 있다면 영향을 받을 수 있음.

### 호환성 / 마이그레이션 노트

- `editor.semanticHighlighting.enabled` 가 `false` 인 환경에서는 색상이 표시되지 않음 (기본값 `configuredByTheme` 권장).
- semantic tokens 미지원 테마에서는 색상이 빈약할 수 있음.

### 관련 커밋

- `efc9d6b` Migrate to tree-sitter-based semantic highlighting
- `d1c5f1a` Switch to full-document semantic tokens provider
- `1b8d0d3` Remove redundant TextMate grammar

---

## [1.0.0] — 2026-04-23

TextMate grammar 기반의 첫 안정 릴리스. (이전까지 `package.json` 의 버전은 `0.1.0` 이었으나, tree-sitter 도입을 v2.0.0 으로 표기하면서 마지막 TextMate 버전을 v1.0.0 으로 소급 태그.)

### Added

- **TextMate grammar (`syntaxes/intouch.tmLanguage.json`)** — `source.intouch` scope 기반 정규식 매칭 하이라이트.
- 지원 scope: `comment.block.intouch`, `string.quoted.double.intouch`, `keyword.control.intouch`, `storage.type.intouch`, `keyword.operator.intouch`, `variable.language.intouch`, `constant.numeric.intouch`.
- **언어 식별자**: `intouch` — 확장자 `.intouch` + 내용 기반 firstLine 매칭으로 `.txt` (Window Report export) 도 감지.
- **bracket matching / auto-closing** 설정 (`language-configuration.json`).
- SQL / Math / File / Window 카테고리의 빌트인 함수 키워드 포함.
- 멀티라인 SQL 문자열 내부 bracket 처리 보정.

### 관련 커밋

- `02c9521` Initial commit: InTouch QuickScript VSCode Extension
- `f3bebf1` Add .txt file support with firstLine pattern matching
- `eb772bc` Add SQL functions and missing math/file functions
- `20fdc48` Add missing keywords and SQL functions from IDE screenshots
- `f21f4b6` Fix bracket highlighting in multi-line SQL strings
- `76a419c` Fix bracket highlighting: move unbalancedBracketScopes to package.json grammars section

---

[2.0.0]: https://github.com/melonJe/intouch-vscode-extension/releases/tag/v2.0.0
[1.0.0]: https://github.com/melonJe/intouch-vscode-extension/releases/tag/v1.0.0
