# Changelog

이 프로젝트의 모든 주요 변경사항은 이 파일에 기록됩니다. 형식은 [Keep a Changelog](https://keepachangelog.com/) 를 따르며, [Semantic Versioning](https://semver.org/) 을 준수합니다.

## [2.5.0] — 2026-09-21

### Changed

- **Condition Script 출력에서 중복 헤더 제거**: 인스턴스 헤더(`Condition Script:`) 뒤에 한 번, `Condition:` 필드 아래에 또 한 번 반복되던 조건식 중 앞쪽 사본을 제거하고 `Condition:`부터 출력. 헤더 구조가 달라 `Condition:` 필드가 없는 export는 아무것도 버리지 않음.
- **`Comment:` 라인을 본문에서 제거**: 그 값은 이미 파일명이므로(2.4.0) 본문에서는 중복. Key Script의 `Key:` 라인과 같은 처리.
- **trigger 라벨 기준 상대 들여쓰기 보존**: `Script On True:` / `Script On False:` 등 라벨을 남기는 Condition Script에서, 본문을 0칸까지 밀어 라벨과 같은 열에 붙던 것을 라벨 들여쓰기만큼만 이동하도록 변경(라벨 8칸·본문 16칸 → 라벨 0칸·본문 8칸). 라벨을 제거하는 Application/Key Script는 종전대로 0칸.
- 위 세 동작은 카테고리 단위로 적용되므로, 인스턴스 라인에 이름이 직접 있는 `Condition Script: TAG` 형식도 본문 형태가 같이 바뀜(파일명은 종전대로 인스턴스 라인에서 옴).

### 관련 파일

- `src/splitter/categories.ts`
- `src/splitter/parseSections.ts`

---

## [2.4.0] — 2026-09-20

### Fixed

- **Application Script: 여러 trigger가 있을 때 첫 파일에 병합되던 문제 수정**: `Script On Application Startup:` / `Script While application running, ...:` / `Script On Application Shutdown:` 처럼 하나의 `Application Script:` 인스턴스 아래 여러 trigger가 있으면, 이전에는 첫 번째 trigger 이후의 내용이 모두 첫 파일에 합쳐졌음. 이제 trigger마다 별도 파일로 정상 분리됨.
- **Condition Script: 이름 없는 인스턴스(Comment 기반)를 trigger별로 잘못 쪼개던 문제 수정**: 인스턴스 라인에 이름이 없고 본문의 `Comment:` 필드로 이름을 붙이는 export 형식에서, 이전에는 `On True`/`On False`/`While True`/`While False` 등 trigger마다 별도 파일이 생기며 서로 이름이 충돌했음. 이제 하나의 Condition Script 세트(같은 조건에 딸린 모든 trigger)가 `Comment` 값을 파일명으로 삼아 한 파일로 병합되고(Comment가 없으면 `Condition_1`, `Condition_2`... 로 자동 명명), `Script <trigger>:` 라벨은 어느 코드가 어느 trigger인지 구분할 수 있도록 파일 안에 남음. 인스턴스 라인에 이름이 직접 있는 기존 형식(`Condition Script: TAG`)은 영향 없음.
- **Key Script: 본문에 중복된 `Key:` 필드 라인 제거**: 인스턴스 이름(`Key Script:Ctrl+Shift+t`)이 이미 파일명에 반영되는데, 본문에 동일한 키 조합을 반복하는 `    Key:        Ctrl+Shift+t` 줄이 그대로 남아있던 문제 수정.

### 관련 파일

- `src/splitter/categories.ts`
- `src/splitter/parseSections.ts`

---

## [2.3.2] — 2026-08-10

### Fixed

- **분할(Split) 저장 시에도 원본 인코딩 적용**: `InTouch: Split Project Export…` 실행 시 원본 파일을 디코딩할 때 사용한 VS Code `files.encoding` 값을 분할 결과 파일을 저장할 때도 동일하게 사용. 이전에는 저장 시 Node.js 기본값인 `utf8`로 고정 저장되어, `cp949`/`euc-kr` 등으로 된 원본을 분할하면 결과 파일 인코딩이 깨지거나 달라지는 문제가 있었음.
- CLI(`npm run split`)에도 `--encoding <id>`로 지정한 인코딩을 저장 시에도 그대로 적용.

### 관련 파일

- `src/splitter/encoding.ts`
- `src/splitter/writeFiles.ts`
- `src/commands/split.ts`, `src/scripts/split-cli.ts`

---

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

[Unreleased]: https://github.com/melonJe/intouch-vscode-extension/compare/v2.3.2...HEAD
[2.3.2]: https://github.com/melonJe/intouch-vscode-extension/releases/tag/v2.3.2
[2.3.1]: https://github.com/melonJe/intouch-vscode-extension/releases/tag/v2.3.1
[2.0.0]: https://github.com/melonJe/intouch-vscode-extension/releases/tag/v2.0.0
[1.0.0]: https://github.com/melonJe/intouch-vscode-extension/releases/tag/v1.0.0
