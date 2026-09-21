# Architecture

이 문서는 vs-intouch-extension의 내부 구조와 데이터 흐름을 정리한다. 6개월 후 본인이 다시 들어와도 30분 안에 splitter 흐름을 다시 잡는 것이 목표.

설계 결정의 **이유**는 [DESIGN.md](design.md)에 있고, 본 문서는 **무엇이 어떻게 연결되어 있는가**만 다룬다.

---

## 1. 모듈 구성

확장은 두 가지 독립된 경로를 가진다:

```
                     +-------------------------+
                     |  VSCode activate()      |
                     |  (src/extension.ts)     |
                     +------------+------------+
                                  |
         +------------------------+------------------------+
         |                                                 |
         v                                                 v
+-----------------------+                       +----------------------+
|  Highlighting 경로     |                       |  Splitter 경로        |
|                       |                       |                      |
|  parser.ts            |                       |  commands/split.ts   |
|    └─ web-tree-sitter |                       |    └─ splitter/      |
|       (WASM)          |                       |       (vscode 무관)  |
|                       |                       |                      |
|  semanticTokensProvider                       |                      |
|    └─ highlights.scm  |                       |                      |
+-----------------------+                       +----------+-----------+
                                                           ^
                                                           |
                                                +----------+-----------+
                                                |  CLI 진입점           |
                                                |  scripts/split-cli.ts|
                                                +----------------------+
```

**핵심 경계**: [src/splitter/](../src/splitter/)는 **VSCode 의존성이 없다**. CLI([src/scripts/split-cli.ts](../src/scripts/split-cli.ts))와 VSCode 명령([src/commands/split.ts](../src/commands/split.ts)) 양쪽이 동일한 `splitProject()`를 호출한다.

| 경로 | 진입점 | 의존성 |
|---|---|---|
| Highlighting | `activate()` → `IntouchSemanticTokensProvider` | vscode, web-tree-sitter |
| Splitter (VSCode) | `intouch.splitExport` 명령 → `runSplitCommand` | vscode |
| Splitter (CLI) | `npm run split` → `main()` | Node fs/path만 |

---

## 2. Splitter 파이프라인

`splitProject(text)` ([src/splitter/index.ts](../src/splitter/index.ts))는 3단계 함수 합성이다:

```
text
  │
  ▼ parseSections(text)
ParseResult { sections, warnings, terminator }
  │
  ▼ buildLayout(sections)
LayoutResult { files, warnings }
  │
  ▼ writeFiles(result, opts)        ← 디스크 I/O는 여기서만
WriteOutcome { written, cancelled }
```

**입출력 타입**: [src/splitter/types.ts](../src/splitter/types.ts)

- `Section { kind, name, category?, startLine, endLine, text }` — 분할의 논리 단위
- `SplitFile { pathParts, content }` — 디스크 쓰기 단위 (경로는 배열, OS 분리자 무관)
- `SplitWarning { code, message, line? }` — 5종 코드 (`truncated_first_line`, `unknown_top_level`, `empty_instance_name`, `duplicate_name`, `orphan_script_instance`)

**`SectionKind`는 3가지**:
- `'window'` — Window Report (한 윈도우 = 한 파일)
- `'scriptInstance'` — 6개 스크립트 카테고리 인스턴스
- `'databaseReport'` — 태그 사전 (단일 파일)

---

## 3. parseSections 상태 머신

[src/splitter/parseSections.ts:72-191](../src/splitter/parseSections.ts#L72-L191)는 텍스트를 한 줄씩 훑으며 `Pending` 배열을 쌓는 단순 누적기다. 3개의 상태 변수가 있다:

| 변수 | 의미 | 언제 변하는가 |
|---|---|---|
| `currentIdx` | 지금 열려 있는 섹션의 `pendings` 인덱스 (없으면 `undefined`) | `openSection()` 시 설정, `closeAt()` 시 해제 |
| `activeCategory` | 가장 최근에 본 banner의 카테고리 ([categories.ts](../src/splitter/categories.ts)) | banner 매치, Window/DB Report, orphan 인스턴스 매치 시 변경 |
| `pendingStart` | 비어있는 인스턴스 라인이 발생한 줄 인덱스 (첫 trigger fallback이 이걸 startLine으로 씀) | `Application Script:` 같은 빈 인스턴스에서 설정, banner/window/DB Report 매치 시 해제. trigger fallback 발동 자체로는 해제하지 않음 — 같은 빈 인스턴스 아래 trigger가 여러 개(Startup/주기실행/Shutdown 등) 올 수 있어 게이트를 계속 열어둬야 각각 별도 섹션으로 열린다 |

### 라인 종류별 상태 전이

| 라인 패턴 | 액션 | `currentIdx` | `activeCategory` | `pendingStart` |
|---|---|---|---|---|
| `Window Report for "..."` | 새 window 섹션 open | 새 인덱스 | undefined로 리셋 | undefined로 리셋 |
| `Database Report Printed On :` | 새 databaseReport 섹션 open | 새 인덱스 | undefined로 리셋 | undefined로 리셋 |
| 카테고리 banner (`Application Scripts` 등) | 현재 섹션 close, 카테고리 활성화 | undefined | banner의 카테고리 | undefined로 리셋 |
| named instance (`Condition Script: TAG`) | 새 scriptInstance 섹션 open | 새 인덱스 | 유지 | undefined로 리셋 |
| empty instance, `nameField` 카테고리 아님 (`Application Script:`) | 현재 섹션 close, pendingStart 설정 | undefined | 유지 | 현재 줄 인덱스 |
| empty instance, `nameField` 카테고리 (`Condition Script:`, 이름 없이 조건식만) | 이름 빈 문자열(`''`)로 즉시 새 scriptInstance 섹션 open — trigger를 기다리지 않음 | 새 인덱스 | 유지 | 무관(사용 안 함) |
| `nameField` 라인 (`    Comment: ...`) AND 현재 섹션 이름이 `''` | 캡처된 텍스트가 비어있지 않으면 그 섹션의 이름을 채움 | 유지 | 유지 | 유지 |
| trigger 라인 (`    Script While ...:`) AND `pendingStart !== undefined` (즉 `triggerFallback`이 있고 `nameField`는 없는 카테고리) | 이전 trigger 섹션(있으면) close, 새 섹션 open(첫 trigger는 pendingStart+1부터, 이후 trigger는 자기 줄부터) | 새 인덱스 | 유지 | 유지 (같은 빈 인스턴스 안의 다음 trigger에도 재사용) |
| 그 외 일반 라인 | 무변화 (현재 섹션 본문) | 유지 | 유지 | 유지 |
| EOF | 마지막 섹션 close(비어있는 이름은 `closeAt`이 폴백 이름 확정) | undefined | — | — |

**`triggerFallback` vs `nameField`**: 둘 다 "인스턴스 라인에 이름이 없다"는 같은 신호(`raw === ''`)에서 출발하지만 목적이 반대다. `triggerFallback`(Application Script)은 trigger마다 **별도 파일**을 만든다 — 이름을 trigger 라인에서 얻는다. `nameField`(Condition Script)는 여러 trigger를 **한 파일로 병합**한다 — 이름을 trigger와 무관한 본문 필드(`Comment:`)에서 얻고, `Script <trigger>:` 라벨은 출력에서 지우지 않고 남긴다. 한 카테고리가 두 필드를 동시에 가질 필요는 없다(현재 상호 배타적으로 사용). 배경은 [DESIGN.md §8](design.md#8-condition-script-namefield-comment-기반-병합) 참조.

### orphan 인스턴스 복구

`activeCategory === undefined`일 때 인스턴스 라인을 만나면 ([src/splitter/parseSections.ts:150-162](../src/splitter/parseSections.ts#L150-L162)) — banner를 누락한 export에 대비해 인스턴스 정규식으로 카테고리를 역추론하고 경고(`orphan_script_instance`)를 남긴다.

### 첫 줄 `W` 누락 보충

InTouch export는 가끔 첫 줄에서 `W`가 잘려 `indow Report for ...`로 시작한다. [src/splitter/parseSections.ts:95-102](../src/splitter/parseSections.ts#L95-L102)에서 자동으로 `W`를 보충하고 경고(`truncated_first_line`)를 발생시킨다.

### 후처리 (섹션 텍스트 빌드)

`parseSections`의 최종 매핑에서 순서대로:

1. `LAST_MODIFIED` 라인을 필터링 (모든 섹션)
2. 카테고리에 `bodyStartField`가 있으면 첫 매치 지점부터로 잘라냄(`trimToBodyStart`) — 인스턴스 헤더 뒤에 본문 필드와 중복되는 사본이 나오는 export용(Condition Script의 조건식 반복). **매치가 없으면 원본 유지**
3. 카테고리에 `stripFieldLine`이 있으면 매치 라인을 제거(`stripFieldLines`) — 파일명에 이미 드러난 정보를 반복하는 필드 라인용(Key Script의 `Key: <combo>`, Condition Script의 `Comment:`). 지운 라인의 양옆이 모두 빈 줄이면 뒤쪽 빈 줄 하나도 같이 제거
4. `scriptInstance`이면 `dedentScriptBodies(slice, preserveLabels)` 적용 — `preserveLabels`는 `nameField` 여부
5. `scriptInstance`이고 카테고리에 `nameField`가 **없으면** `TRIGGER_LABEL`(`Script ...:`) 라인 필터 제거 — `nameField` 카테고리(Condition 등)는 여러 trigger가 한 파일에 병합되므로 라벨을 남겨 구분 가능하게 한다
6. trailing 빈 줄 제거
7. `stripBraceWrapper` 카테고리(QuickFunction·ActiveX)이면 첫 줄(`FuncName( )   {`)·마지막 줄(`}`) 제거
8. trailing 빈 줄 재정리
9. 원본 라인 종결자(`\r\n` / `\n`)로 join

**순서 의존성**: 6번(trailing 빈 줄 제거)이 7번(`stripBraceWrapper`) 앞에 선행되어야 `}` 패턴 매칭이 정상 동작한다.

### dedent 모드 두 가지

`dedentScriptBodies`의 trigger 앵커 경로는 `preserveLabels`로 갈린다:

| 모드 | 대상 | 라벨 | 본문 |
|---|---|---|---|
| `false` (기본) | 라벨을 어차피 5번에서 지우는 카테고리(Application·Key 등) | 원본 그대로(어차피 제거됨) | `dedentByMin`으로 0칸까지 |
| `true` | `nameField` 카테고리(Condition) | 0칸으로 이동 | 라벨의 들여쓰기만큼만 왼쪽 이동 — 라벨 대비 상대 들여쓰기 보존 |

`preserveLabels: true`에서 본문을 0칸까지 밀면 남겨둔 라벨과 본문이 같은 열에 붙어 블록 구조가 사라지므로, 블록 전체를 라벨 들여쓰기만큼만 옮긴다(`shiftBlockByLabelIndent`). 예: 라벨 8칸·본문 16칸 → 라벨 0칸·본문 8칸.

`dedentScriptBodies` 분기는 [DESIGN.md §5](design.md#5-script-body-auto-dedent), 헤더·래퍼 제거 결정은 [DESIGN.md §6](design.md#6-출력-파일-헤더래퍼-제거), Condition Script 출력 형태는 [DESIGN.md §9](design.md#9-condition-script-출력-형태-중복-제거--상대-들여쓰기) 참조.

---

## 4. 카테고리 분기

[src/splitter/buildLayout.ts:39-50](../src/splitter/buildLayout.ts#L39-L50)는 `kind`별로 출력 경로를 만든다:

| kind | 경로 패턴 | sanitize 함수 | 비고 |
|---|---|---|---|
| `window` | `windows/<name>.txt` | `sanitizeWindowName` | 공백 보존, `%`→`pct` |
| `databaseReport` | `database_report.txt` | (고정 이름) | 단일 파일 |
| `scriptInstance` | `<category>/<name>.txt` | `sanitizeIdentifier` (preserveIdentifier) 또는 `sanitizeScriptName` | 카테고리 정의에 따라 분기 |

**왜 3-way 분기인가?** 세 종류의 출력이 구조상 다르다:
- Window Report는 윈도우 객체·Link Detail·Window Script까지 한 덩어리 — 카테고리 폴더 없이 `windows/` 아래로 평면화
- Database Report는 태그 사전이라 항상 단일 파일 — 카테고리 자체가 없음
- 스크립트 카테고리(6종)는 [categories.ts](../src/splitter/categories.ts)에서 banner/instance 정규식·폴더명·`preserveIdentifier`로 정의된 동질적 경로

중복 경로는 `dedupe()`이 `_2`, `_3` 접미사로 회피하고 `duplicate_name` 경고를 남긴다.

---

## 5. Highlighting 파이프라인

[src/semanticTokensProvider.ts](../src/semanticTokensProvider.ts)는 tree-sitter의 capture 결과를 VSCode semantic token으로 변환한다.

```
Document text
  │
  ▼ parser.parse(text, oldTree?)        ← oldTree는 incremental update 시
Tree (캐시: trees Map<uri, {version, tree}>)
  │
  ▼ query.captures(rootNode)
QueryCapture[]                           ← @keyword, @function 등
  │
  ▼ resolveMapping(capture)              ← BARE_COMMAND/BUILTIN 재분류
{ type, mods? }
  │
  ▼ pushNodeRange / scanCommentForTodos
PendingToken[]
  │
  ▼ sort by (line, col) → builder.push
SemanticTokens
```

### 캐시 키

`trees` Map의 키는 `document.uri.toString()`, 값은 `{ version, tree }`. `getOrParseTree`가 version이 일치하면 재사용, 다르면 이전 트리를 `delete()`하고 새로 parse. 닫힌 문서는 `forget()`이 정리.

### Incremental update

`onDidChangeTextDocument` → `applyEdits()`가 변경을 역순(offset 큰 것부터)으로 `tree.edit()` 적용 후 `parser.parse(text, oldTree)`로 재파싱. tree-sitter가 변하지 않은 subtree를 재사용한다.

### Capture → Token 매핑

[src/semanticTokensProvider.ts:35-49](../src/semanticTokensProvider.ts#L35-L49)의 `CAPTURE_MAP`이 1차 매핑. `@function` 캡처는 `resolveMapping()`이 추가 분기:

- 부모가 `command_statement`고 이름이 `BARE_COMMAND_KEYWORDS` 안에 있으면 → `keyword`
- 이름이 `BUILTIN_FUNCTIONS` 안에 있으면 → `function + defaultLibrary` modifier
- 그 외 → `function`

이 분기는 highlights.scm의 `#match?` predicate가 case-insensitive 정규식을 인라인으로 못 받기 때문에 JS 쪽으로 넘어왔다.

### TOKEN_TYPES / TOKEN_MODIFIERS 순서

[src/semanticTokensProvider.ts:9-26](../src/semanticTokensProvider.ts#L9-L26)의 두 배열은 **선언 순서가 numeric ID**다. SemanticTokensBuilder가 이 순서로 인덱스를 인코딩하므로 **순서를 바꾸면 모든 기존 토큰이 어긋난다**. 추가는 항상 끝에 append.

### TextMate grammar (bracket colorization 전용)

[syntaxes/intouch.tmLanguage.json](../syntaxes/intouch.tmLanguage.json)은 `string.quoted.double.intouch`와 `comment.block.intouch` 두 스코프만 정의한다. 실제 색칠은 semantic tokens가 덮어쓰므로 TextMate 규칙이 사용자에게 보이지 않는다. 존재 이유는 VSCode bracket pair colorization이 `string` 스코프를 보고 문자열 내 괄호를 카운팅에서 제외하기 때문이다. 결정 배경은 [DESIGN.md §7](design.md#7-textmate-grammar-유지-bracket-colorization용) 참조.

---

## 6. VSCode ↔ CLI 분담

두 진입점 모두 같은 `splitProject()` + `writeFiles()` 조합을 호출하지만, **로깅과 충돌 처리 UX가 다르다**.

| 항목 | VSCode ([commands/split.ts](../src/commands/split.ts)) | CLI ([scripts/split-cli.ts](../src/scripts/split-cli.ts)) |
|---|---|---|
| 입력 결정 | URI 인자 → 활성 에디터 → showOpenDialog | argv (여러 파일 일괄) |
| 진행 로그 | OutputChannel `InTouch Split`에 시작/진행 중/완료 라인 | stdout/stderr |
| 충돌 처리 | 모달 `Overwrite all` / `Cancel` 버튼 | `--force` 플래그 (없으면 abort) |
| 에러 표시 | `showErrorMessage` 토스트 + 채널 라인 | stderr 라인 + non-zero exit |

공통 로직 추출 여지가 있으나 현재는 의도적으로 분리. UX 차이가 본질적이라 한 함수로 묶으면 옵션 폭주.

---

## 빌드 산출물 구조

`npm run vscode:prepublish` (= `build:parser` + `compile`) 실행 결과:

- `out/extension.js`, `out/parser.js`, `out/semanticTokensProvider.js` — TS 컴파일 결과
- `out/splitter/*.js`, `out/commands/split.js`, `out/scripts/split-cli.js`
- `out/tree-sitter-intouch.wasm` — `build:parser`가 [tree-sitter-intouch/](../tree-sitter-intouch/)에서 생성 후 복사

`semanticTokensProvider.findHighlightsScm()`이 dev/패키지 양쪽에서 `highlights.scm`을 찾을 수 있도록 후보 경로 3개를 순회한다.

`syntaxes/intouch.tmLanguage.json` — TextMate grammar (bracket colorization 전용, [DESIGN.md §7](design.md#7-textmate-grammar-유지-bracket-colorization용) 참조)
