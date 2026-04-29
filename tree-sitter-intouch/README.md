# tree-sitter-intouch

AVEVA InTouch QuickScript + Window Report export 형식의 tree-sitter grammar.

상위 패키지(VSCode 확장)에서 WASM으로 로드해 `IntouchSemanticTokensProvider`의 입력으로 쓴다. 전체 구조는 상위 [ARCHITECTURE.md](../docs/architecture.md), 설계 결정은 [DESIGN.md](../docs/design.md) 참조.

---

## `ci()` 헬퍼

InTouch는 case-insensitive 언어다 — `IF`/`if`/`If`/`iF`가 모두 같은 키워드. tree-sitter 1.x는 정규식 inline `(?i)` 플래그를 지원하지 않으므로, [grammar.js](grammar.js)의 `ci()` 헬퍼가 글자별로 `[lL]` 형태의 character class를 만든다.

```js
function ci(word) {
  return new RegExp(
    word.split('').map(c => {
      const l = c.toLowerCase();
      const u = c.toUpperCase();
      return l === u ? c : `[${l}${u}]`;
    }).join('')
  );
}
```

`kw()`는 `ci()`를 감싸 `alias`로 안정적인 노드 이름(예: `"DIM"`)을 부여 — highlights query가 `(declaration "DIM" @keyword)` 같은 패턴으로 안전하게 캡처할 수 있게 한다.

---

## `BUILTIN_FUNCTIONS` 동기화 규약

`grammar.js`의 `BUILTIN_FUNCTIONS` 배열(현재 131개, 9개 카테고리)은 **상위 [src/semanticTokensProvider.ts](../src/semanticTokensProvider.ts)의 `BUILTIN_FUNCTIONS` `Set`과 1:1 일치해야 한다**.

- grammar 쪽은 *문서 목적*만 수행 — 빌트인 이름을 기록해 둘 뿐, parsing rule은 일반 `identifier`로 받는다.
- 분류(`@function + defaultLibrary`)는 JS 쪽 `resolveMapping()`이 lowercase 비교로 결정한다.
- **둘 중 하나만 추가하면 분류 누락**. 새 빌트인 추가 시 양쪽 모두 갱신.

**왜 grammar.js에 두는가**: 향후 grammar에서 빌트인 이름을 직접 참조하는 rule(예: `command_statement`의 인자 형태별 분기)이 생길 가능성을 열어 두기 위해서다. 현재는 redundancy.

`BARE_COMMANDS`도 동일한 규약 — `BARE_COMMAND_KEYWORDS`와 동기화.

---

## 빌드와 테스트

**WASM 빌드 (Docker 필요)**:

```bash
npx tree-sitter generate
npx tree-sitter build --wasm
```

`tree-sitter build --wasm`은 emscripten 컨테이너를 띄워 C 소스를 wasm으로 컴파일한다. 산출물 `tree-sitter-intouch.wasm`은 상위 패키지가 [package.json](../package.json)의 `build:parser` 스크립트에서 `out/`으로 복사한다.

**Corpus 테스트**:

```bash
npx tree-sitter test
```

[test/corpus/quickscript.txt](test/corpus/quickscript.txt)에 케이스가 정의돼 있다. 새 케이스 추가는 표준 tree-sitter test 형식을 따른다:

```
=========================================
설명적 케이스 이름
=========================================
입력 코드
---
(기대 트리)
```

**언제 corpus 테스트가 필요한가**:
- grammar 룰을 변경하거나 새 룰을 추가했을 때
- 우선순위(`prec`) 조정 후 회귀 방지
- Window Report metadata 토큰의 새 패턴을 처리할 때

splitter 동작만 영향받는 변경은 splitter 쪽에서 검증(현재 단위테스트 인프라 없음, 수동 회귀).

---

## Grammar 구조 한눈에

[grammar.js](grammar.js)는 두 종류의 입력을 한 grammar로 처리한다:

| 입력 | 처리 |
|---|---|
| `.intouch` (순수 QuickScript) | `statement` rule들이 단단하게 매칭 |
| `.txt` (Window Report export) | `_top_item`이 well-known 헤더(`window_report_header`, `application_scripts_marker` 등)를 먼저 시도, 실패 시 `_meta_token`이 negative precedence로 느슨하게 토크나이즈 |

**핵심 패턴**:
- `_meta_token`은 `prec(-10, ...)` — 진짜 QuickScript 구조가 매칭 가능하면 그쪽이 항상 이긴다.
- Window Report 메타데이터는 식별자/숫자/문자열 단위로만 캡처되고, 의미 분류(예: "이 identifier는 property key다")는 [queries/highlights.scm](queries/highlights.scm)이 부모 노드 패턴(`(source_file (identifier) @label)`)으로 결정.

---

## 자주 부딪히는 함정

- **`tree-sitter generate` 후 `compile` 빠뜨림**: WASM은 새로 만들어졌지만 TS 쪽 캐시를 안 거치면 dev 환경에서 구버전 wasm이 로드됨. 항상 `build:parser`가 `cp ... ../out/`까지 끝나는지 확인.
- **Docker 미실행**: `tree-sitter build --wasm`이 조용히 실패하지 않고 에러를 뱉지만, 메시지에 docker daemon 언급이 없을 수 있다. `docker info`로 먼저 확인.
- **Predicate 정규식**: highlights.scm의 `#match?`는 native regex (pcre 아님)라 inline `(?i)` 안 됨. 대소문자 처리는 [src/semanticTokensProvider.ts](../src/semanticTokensProvider.ts)의 `resolveMapping()`에 위임.
