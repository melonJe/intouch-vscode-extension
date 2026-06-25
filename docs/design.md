# Design Decisions

비자명한 설계 결정의 **이유(WHY)** 를 박제한다. 코드만 봐서는 "왜 이렇게 했지?"가 떠오르는 결정만 기록한다.

각 결정은 `Status / Context / Decision / Consequences` 4섹션. **결정은 immutable** — 변경 시 새 섹션을 추가하고 기존 섹션의 Status를 `Superseded by §N`으로 표기한다. silent edit 금지.

짧고 자명한 결정(`i` 플래그 일괄, 폴더명 단순화, `Last Modified` 라인 제거 등)은 코드 옆 `// WHY:` 주석으로 처리하고 본 문서에 넣지 않는다.

---

## 1. Tree-sitter over TextMate

**Status**: Accepted (v2.0.0, 2026-04-25)

**Context**: v1까지는 TextMate grammar(`syntaxes/intouch.tmLanguage.json`)로 syntax highlighting을 제공했다. 정규식 기반 매칭이라 컨텍스트 인식이 약하고, `source.intouch` scope에 의존하는 정적 색 매핑이라 사용자 테마의 `semanticTokenColors`를 활용하지 못했다. 또한 `command_statement`처럼 동일 토큰이 위치에 따라 의미가 달라지는 InTouch 특유의 구조(예: `Show`가 statement면 키워드, expression이면 함수)를 정규식만으로 분리하기 어려웠다.

**Decision**: Tree-sitter 파서(WASM, web-tree-sitter)로 전환하고 VSCode `DocumentSemanticTokensProvider`를 등록한다. AST 기반이라 부모 노드 타입을 보고 분류할 수 있고, semantic token API를 통해 사용자 테마에 자연스럽게 흡수된다.

**Consequences**:
- 빌드 파이프라인이 복잡해진다 — `tree-sitter generate` + WASM 빌드(Docker 의존). [CONTRIBUTING.md](contributing.md) 참조.
- TextMate scope(`source.intouch`)에 의존하던 외부 스니펫/테마는 호환성 끊김. CHANGELOG v2.0.0의 마이그레이션 노트 참고.
- `editor.semanticHighlighting.enabled`가 `false`인 환경에서는 색이 빈약해진다.
- `BUILTIN_FUNCTIONS` 같은 데이터를 [tree-sitter-intouch/grammar.js](../tree-sitter-intouch/grammar.js)와 [src/semanticTokensProvider.ts](../src/semanticTokensProvider.ts) 양쪽에 유지해야 한다(동기화 의무).
- **TextMate grammar는 제거되지 않았다** — §6 참조. Semantic tokens가 실제 하이라이트를 담당하고, TextMate grammar는 VSCode bracket colorization의 string 범위 인식 용도로만 유지된다.

---

## 2. `.intouch` 확장자 도입

**Status**: Accepted (v1.0.0, 2026-04-23)

**Context**: AVEVA InTouch 자체에는 표준 텍스트 확장자가 없다. WindowMaker는 export 시 `.txt`만 떨어뜨린다. 이 확장 패키지가 처리해야 할 입력은 둘:
1. WindowMaker export — 항상 `.txt`, 첫 줄에 `Window Report ...` / `Database Report ...` 헤더가 있다.
2. 사용자가 InTouch 외부 환경에서 직접 작성·관리하는 QuickScript 코드 — 헤더 없이 순수 코드만.

`.txt` 한 가지로만 처리하려면 모든 `.txt`를 InTouch 언어로 인식하거나 firstLine 매칭으로만 분류해야 한다. 전자는 다른 텍스트 파일을 오염시키고, 후자는 헤더 없는 순수 코드 파일을 인식할 방법이 없다.

**Decision**: 본 확장 전용 임의 확장자 `.intouch`를 정의한다. 사용자가 직접 작성하는 코드는 `.intouch`로 저장하고, export 파일은 `.txt`인 채로 firstLine 매칭으로 자동 인식한다.

**Consequences**:
- `.intouch`는 InTouch 표준이 아님을 [README.md](../README.md#인식되는-파일)와 본 문서에 명시한다 — 사용자 혼동 방지.
- 두 확장자 모두 `intouch.splitExport` 명령의 입력으로 받을 수 있다(참조: [package.json](../package.json) `menus`).
- 확장자 자체에 의미는 없다. 사용자가 다른 이름을 쓰고 싶으면 VSCode `files.associations`로 매핑 가능.

---

## 3. `preserveIdentifier` 플래그 기준

**Status**: Accepted (v2.2.0, 2026-04-28)

**Context**: 스크립트 파일명을 만들 때 InTouch에서 추출한 이름을 sanitize한다. 두 가지 경로가 있다:
- `sanitizeScriptName` — lowercase + `[a-z0-9_]` 외 모두 `_`. 사람이 읽는 트리거 표현식("While application running, every 100 msec")을 깔끔한 파일명("while_application_running_every_100_msec.txt")으로 만들기에 적합.
- `sanitizeIdentifier` — case 보존, 공백·금지문자만 `_`로 치환. 대소문자가 의미를 가지는 식별자(`L2_S135_ROLL_CHANGE_ALARM`, `L2S212InputClear`)에 적합.

어느 카테고리가 어느 처리를 받아야 하는가는 카테고리 이름이 **트리거 표현식**인지 **코드 식별자**인지에 따라 갈린다.

**Decision**: 카테고리별 분류를 다음 표로 고정한다.

| 카테고리 | 인스턴스 이름의 정체 | preserveIdentifier | 예시 → 파일명 |
|---|---|---|---|
| Application Script | 트리거 표현식 (영문 자연어) | (false) | `While application running, every 100 msec` → `while_application_running_every_100_msec.txt` |
| Condition Script | 태그명 | true | `GROUP_CONFIRM_1` → `GROUP_CONFIRM_1.txt` |
| Data Change Script | 태그명 | true | `L2_S135_ROLL_CHANGE_ALARM` → `L2_S135_ROLL_CHANGE_ALARM.txt` |
| Key Script | 키 조합 표현 | (false) | `Ctrl F1` → `ctrl_f1.txt` |
| QuickFunction | 함수명 (코드 식별자) | true | `L2S212InputClear` → `L2S212InputClear.txt` |
| ActiveX Event Script | 이벤트 핸들러 식별자 | true | `L2S291Scroll` → `L2S291Scroll.txt` |

기준: **파일명이 코드에서 참조될 가능성이 있는가**. QuickFunction 이름은 다른 스크립트가 `CALL`로 부르고, Condition/Data Change Script 이름은 감시 대상 태그라 코드/태그 사전에 동일 케이스로 등장한다. 이런 경우 케이스 보존이 grep/검색에 유리하다.

**Consequences**:
- 새 카테고리 추가 시 이 표를 확장해야 한다([CONTRIBUTING.md](contributing.md#새-카테고리-추가-절차) 참조).
- Condition Script의 인스턴스가 트리거 표현식인 환경(예: 기명되지 않고 `Script On True:`만 있는 export)은 `triggerFallback` 경로로 대체 이름이 만들어지므로 케이스 보존이 의미가 없어 사실상 영향 없음 — 단, 그런 export에서도 결과가 일관되게 나오는지는 회귀 케이스로 확인 필요.

---

## 4. `triggerFallback` 게이트 (`pendingStart !== undefined`)

**Status**: Accepted (v2.2.0, 2026-04-28). Supersedes 초기 구현(de53c01).

**Context**: Application Script export는 인스턴스 라인이 항상 비어 있다(`Application Script:`만 있고 그 뒤가 비어 있음). 이름이 없으니 안쪽의 `    Script While application running, every 100 msec:` 같은 trigger 라인에서 이름을 복원해야 한다 — 이 용도로 [categories.ts](../src/splitter/categories.ts)의 `triggerFallback` 정규식이 도입됐다.

초기 구현은 카테고리에 `triggerFallback`이 정의돼 있으면 무조건 발동했다. 그런데 Condition Script export는 인스턴스 라인이 **이름을 포함**한다(예: `Condition Script: GROUP_CONFIRM_1`)고 그 안에 여러 trigger 블록(`Script On True:`, `Script On False:`, `Script While True every 1000 msec:`)이 있다. 이 trigger 라인들도 `triggerFallback` 정규식에 매치되어 새 섹션을 만들었고, 결과적으로:

1. `GROUP_CONFIRM_1` 섹션이 열리자마자 다음 trigger 라인에서 닫혀 본문이 잘리고
2. `On_False`, `On_True` 같은 trigger 이름의 섹션이 다른 Condition Script들(태그명이 다른)과 파일명 충돌
3. dedupe 결과 `on_true.txt`, `on_true_2.txt`, ... 식으로 태그 정보가 사라짐

**Decision**: `triggerFallback`은 `pendingStart !== undefined`일 때만 발동한다([parseSections.ts:176](../src/splitter/parseSections.ts#L176)). `pendingStart`는 "비어있는 인스턴스 라인을 만났다"는 신호이므로, 이 신호가 있을 때만 trigger 라인이 인스턴스 이름의 대체로 작동한다. 기명된 인스턴스가 열려 있을 때는 trigger 라인이 본문의 일부로 흡수된다.

**Consequences**:
- Condition Script 본문이 한 섹션으로 보존된다 — 여러 trigger 블록이 한 파일에 들어감.
- Application Script의 기존 동작(trigger별 1파일)은 그대로 유지 — 거기는 `pendingStart`가 항상 설정됨.
- `Condition Script:`가 빈 인스턴스로 떨어지는 (이론상의) 환경에서도 `pendingStart`가 설정되어 trigger fallback이 정상 동작.
- `Application Scripts`/`Condition Scripts`는 `triggerFallback`을 정의하지만 의미가 다르다 — 전자는 일상 경로, 후자는 비상 경로. 이걸 알지 못하면 테스트 시 혼동.

---

## 5. Script body auto-dedent

**Status**: Accepted (v2.2.0, 2026-04-28)

**Context**: InTouch export의 스크립트 본문은 보통 16칸 들여쓰기로 떨어진다. 그대로 출력하면 코드가 화면 가운데에서 시작해 가독성이 떨어진다. 자동으로 들여쓰기를 줄이고 싶지만, 단순히 "전체 섹션의 최소 들여쓰기로 dedent"하면 헤더 라인(`Condition Script:`, `Comment:` 등)이 column 0이라 min이 0으로 잡혀 아무 효과가 없다.

본문의 시작점은 카테고리에 따라 두 가지로 갈린다:
- **Application/Condition/Data Change/Key**: `        Script <trigger>:` 라벨이 있고, 그 다음 줄부터 본문 시작.
- **QuickFunction/ActiveX Event Script**: trigger 라벨이 없고 `{ ... }` 블록 안에 본문이 들어 있다(예: `L2S212InputClear( )   {` 다음 줄부터 본문).

**Decision**: [parseSections.ts:32-50](../src/splitter/parseSections.ts#L32-L50)의 `dedentScriptBodies()`가 두 경로로 분기한다:

- **Trigger 앵커 경로**: 섹션 안에 `TRIGGER_LABEL` 매치가 하나라도 있으면, 각 trigger 라인의 다음 줄부터 다음 trigger 라인 직전까지가 한 본문 블록. 각 본문 블록을 `dedentByMin(body, skipColumnZero=false)`로 dedent — 본문 블록 안에는 column 0 라인이 없을 거라는 가정 하에 모든 라인을 동일하게 처리.
- **폴백 경로**: trigger 라벨이 없으면 섹션 전체에 `dedentByMin(lines, skipColumnZero=true)` — column 0 라인(인스턴스 헤더 `QuickFunction: ...`, 함수 시그니처 `L2S212InputClear( )   {`, 닫는 `}`)을 min 계산과 dedent 양쪽에서 제외.

`dedentByMin`은 표준 textwrap.dedent 의미: 비어있지 않은 라인들의 최소 들여쓰기만큼 strip, 더 짧은 라인은 leading whitespace 전체 제거.

**Consequences**:
- Condition Script 출력은 trigger 라벨 사이의 본문이 0칸부터 시작 — 가독성 향상, 단 header(`Condition:`, `Comment:`)와 trigger 라벨(`        Script On False:`)은 원본 들여쓰기 유지.
- QuickFunction 출력은 `{` / `}` 사이의 본문이 0칸부터 시작.
- **가정 위반 시 동작 미정의**: trigger 앵커 경로에서 본문 블록 안에 column 0 라인이 들어가면 그것이 min을 0으로 끌어내려 dedent가 무력화될 수 있다. 실제 export에서 본 적은 없지만 회귀 케이스로 수집할 가치 있음.
- 향후 dedent 강도를 조절(예: column 4까지만 줄이기)하려면 `dedentByMin`에 옵셔널 floor 인자 추가.

---

## 6. 출력 파일 헤더·래퍼 제거

**Status**: Accepted (v2.2.1, 2026-06-25)

**Context**: `parseSections`는 원래 섹션 헤더 라인(`Application Script:`, `Condition Script: TAG`, `QuickFunction:FuncName( )`)을 `startLine`에 포함시켰다. 결과적으로 출력 파일 첫 줄이 항상 헤더였고, QuickFunction/ActiveX 파일은 `FuncName( )   {` 시그니처 라인과 닫는 `}` 도 본문에 포함됐다. 이 정보는 파일명·폴더명으로 이미 알 수 있어 중복 노이즈였다.

**Decision**: 3단계로 헤더/래퍼를 제거한다.

1. **인스턴스 헤더 라인 제외**: `scriptInstance` 섹션의 `startLine`을 `i + 1`로 설정(헤더 라인 `i` 다음 줄부터 슬라이스). 이전 섹션의 `endLine` 계산이 `startLine - 1`을 사용하므로 `openSection`에 `closeBefore` 파라미터(`i - 1`)를 별도로 넘겨 경계를 분리.

2. **Trigger 라벨 라인 제거**: dedent 후 `TRIGGER_LABEL` 패턴(`Script ...:`)에 매치되는 라인을 `filter`로 제거. Application Script의 trigger fallback 경로는 `startLine: pendingStart + 1`로 trigger 라인 자체를 슬라이스에서 제외.

3. **`{...}` 래퍼 제거** (`stripBraceWrapper`): QuickFunction과 ActiveX Event Script는 본문이 `FuncName( )   {` … `}` 으로 감싸인다. `categories.ts`에 `stripBraceWrapper: true` 플래그를 추가하고, trailing 빈 줄 제거 후 첫 줄(`/\{\s*$/` 매치)과 마지막 줄(`/^\s*\}\s*$/` 매치)을 `slice`로 제거.

**Consequences**:
- 출력 파일에는 순수 코드 본문만 남는다 — 파일명·폴더명이 헤더 정보를 대체.
- `closeBefore` 파라미터 도입으로 `openSection` 시그니처가 변경됐다. `window`·`databaseReport`·`scriptInstance` 호출 모두 명시적으로 `i - 1`을 전달.
- trailing 빈 줄 제거가 `stripBraceWrapper` **앞**에 선행되어야 `}` 매칭이 정상 동작함 — 순서 의존성 주의.
- `window`·`databaseReport` 섹션은 헤더 제거 대상이 아니다 (구조 문서로서의 가치 유지).

---

## 7. TextMate grammar 유지 (bracket colorization용)

**Status**: Accepted (v2.2.1, 2026-06-25). Supersedes §1의 "TextMate 제거" 결정.

**Context**: §1에서 semantic tokens로 전환하며 TextMate grammar를 제거했다. 그러나 VSCode의 bracket pair colorization은 TextMate grammar의 `string` 스코프를 보고 문자열 내부 괄호를 카운팅에서 제외한다. TextMate grammar가 없으면 `"Show (all)"` 같은 문자열 안의 `(` `)` 가 코드 밖 괄호와 쌍으로 매핑되어 잘못 색칠된다.

**Decision**: [syntaxes/intouch.tmLanguage.json](../syntaxes/intouch.tmLanguage.json)을 최소 정의로 재도입한다. `string.quoted.double.intouch`(`"..."`)와 `comment.block.intouch`(`{...}`) 두 스코프만 정의. 실제 syntax highlighting은 semantic tokens가 담당하므로 TextMate 규칙이 색에 영향을 주지 않는다.

**Consequences**:
- Bracket pair colorization이 문자열·주석 내부 괄호를 올바르게 무시한다.
- TextMate grammar가 생성하는 `source.intouch` 토큰은 semantic tokens에 덮어씌워진다 — 시각적 충돌 없음.
- 향후 semantic tokens를 사용하지 않는 환경(예: `editor.semanticHighlighting.enabled: false`)에서도 최소한 string/comment 색은 TextMate 테마 기반으로 표시된다.
