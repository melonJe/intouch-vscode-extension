# Contributing

기여자/유지자가 자주 부딪히는 절차를 정리한다. 전체 그림은 [ARCHITECTURE.md](architecture.md), 설계 결정의 이유는 [DESIGN.md](design.md) 참조.

## 개발 환경 셋업

**요구**:
- Node.js 20+
- Docker (tree-sitter WASM 빌드용 — `tree-sitter build --wasm`이 emscripten 컨테이너를 띄움)

**첫 빌드**:

```bash
npm install
npm run build:parser   # tree-sitter generate + WASM 빌드 + out/으로 복사
npm run compile        # TypeScript → out/
```

VSCode에서 F5로 Extension Development Host 실행 → `sample/test.intouch` 또는 `docs/demo_*.txt` 열어서 동작 확인.

**자주 쓰는 명령**:

| 명령 | 용도 |
|---|---|
| `npm run compile` | TS만 재컴파일 (grammar 변경 없을 때) |
| `npm run build:parser` | grammar 변경 후 WASM 재빌드 (Docker 필요) |
| `npm run package` | `.vsix` 생성 (배포용) |
| `npm run split -- <파일>` | CLI로 splitter 동작 확인 |
| `cd tree-sitter-intouch && npx tree-sitter test` | grammar corpus 테스트 |

---

## 새 카테고리 추가 절차

InTouch가 새로운 export 카테고리(예: 가상의 `Touch Push Buttons`)를 도입했거나, 기존에 누락된 카테고리를 추가할 때.

### 1. [src/splitter/categories.ts](../src/splitter/categories.ts)에 항목 추가

`SCRIPT_CATEGORIES` 배열에 `ScriptCategory` 객체 추가. 5개 필드 결정:

```ts
{
  banner: /^Touch Push Buttons\s*$/i,        // export의 카테고리 헤더
  instance: /^Touch Push Button:\s*(.*?)\s*$/i,   // 인스턴스 라인 (캡처 그룹 = 이름)
  folder: 'touch_buttons',                   // 출력 폴더명
  preserveIdentifier: true,                  // 이름이 코드 식별자면 true
  triggerFallback: undefined,                // 인스턴스가 비어있을 때만 정의
}
```

**필드별 결정 가이드**:

- **`banner` / `instance`**: 항상 `i` 플래그. InTouch export는 환경에 따라 케이스가 일정하지 않음([DESIGN.md](design.md)에 ADR 없음 — 코드 옆 `// WHY:` 주석 참조).
- **`folder`**: 짧고 출력 경로에 노출돼도 어색하지 않은 이름. 기존: `application` / `condition` / `data_change` / `key` / `quick_functions` / `activex_event`.
- **`preserveIdentifier`**: [DESIGN.md §3](design.md#3-preserveidentifier-플래그-기준)의 표 참고. 인스턴스 이름이 **코드/태그에서 동일 케이스로 등장하는 식별자**면 `true`, 사람이 읽는 트리거 표현식이면 `false`(기본).
- **`triggerFallback`**: 인스턴스 라인이 비어 떨어지는 카테고리(현재 Application Script만)에서만 정의. 안쪽의 `    Script <trigger>:` 라인에서 이름을 복원하는 정규식. **`pendingStart !== undefined`일 때만 발동**한다는 [DESIGN.md §4](design.md#4-triggerfallback-게이트-pendingstart--undefined)의 게이트 동작 숙지 필수.
- **`postProcessName`**: 추출한 이름에서 군더더기 제거(예: QuickFunction의 `(args)` 잘라내기). 옵션.

### 2. [tree-sitter-intouch/test/corpus/](../tree-sitter-intouch/test/corpus/)에 샘플 추가 (선택)

새 카테고리의 export 샘플이 손에 있고 grammar가 영향을 받으면 corpus 테스트 케이스 추가. splitter만 영향받으면 생략 가능.

### 3. [README.md](../README.md)의 처리되는 형식 표 갱신

새 카테고리 행 추가. banner / 인스턴스 헤더 형식을 한 줄로.

### 4. [ARCHITECTURE.md](architecture.md) §4의 "카테고리 분기" 표 영향 확인

새 카테고리가 기존 3-way 분기(`window` / `databaseReport` / `scriptInstance`) 안에 들어가면 별도 갱신 불필요. 새 `kind`가 필요하면 [src/splitter/types.ts](../src/splitter/types.ts)의 `SectionKind` 확장 + [src/splitter/buildLayout.ts](../src/splitter/buildLayout.ts)의 분기 추가 + ARCHITECTURE 갱신 모두 필요.

### 5. `preserveIdentifier` 기준에 변동이 생기면 [DESIGN.md §3](design.md#3-preserveidentifier-플래그-기준) 갱신

새 카테고리 행을 표에 추가. 기준이 바뀌는 경우는 거의 없으나, 새 사례가 가이드라인을 흔들면 ADR 보강.

### 6. 회귀 확인

`npm run split -- <샘플>` 실행해서:
- 새 폴더가 만들어지는가
- 파일명이 의도대로 sanitize되는가
- 기존 카테고리가 영향받지 않는가

---

## 에러 처리 규약

**계층별 책임**:

| 계층 | 에러 처리 방식 |
|---|---|
| `src/splitter/*` (도메인 로직) | 회복 불가능한 형식 오류는 `throw new Error(message)`. 회복 가능한 이상은 `SplitWarning` 누적. |
| `src/commands/split.ts` (VSCode 진입) | 모든 throw를 try/catch로 받아 `OutputChannel`에 로그 + `showErrorMessage` 토스트. process는 절대 종료 안 함. |
| `src/scripts/split-cli.ts` (CLI 진입) | throw를 `console.error`로 출력 + `process.exit(1)`. 한 파일 실패가 다음 파일을 막지 않게 할지는 미정 — 현재는 즉시 abort. |

**경고 vs 에러**:
- 경고: export 형식의 사소한 결함(첫 줄 W 누락, 빈 인스턴스 이름, banner 없는 인스턴스, 중복 경로 회피). 처리는 계속.
- 에러: 진행 자체가 불가능(파일 읽기 실패, `Window Report` / `Database Report` 헤더가 하나도 없음 → `splitProject`가 throw).

**경고 코드 추가 시**: [src/splitter/types.ts](../src/splitter/types.ts)의 `SplitWarningCode` 유니언에 추가 + 발생 위치에 `warnings.push({ code, message, line? })` + 양쪽 entry(VSCode/CLI)에서 동일하게 출력되는지 확인.

---

## 문서 stale 방지

CI 강제는 도입하지 않는다. 대신 PR 체크 1줄을 머릿속에 둔다:

> splitter 파이프라인/상태 머신 또는 카테고리 정의를 건드렸으면 [ARCHITECTURE.md](architecture.md) §3·§4 갱신 여부 확인.
> 비자명한 결정을 새로 내렸으면 [DESIGN.md](design.md)에 섹션 추가.
> 짧은 결정은 코드 옆 `// WHY:` 주석으로 충분.

**WHY 주석 규칙**:
- 접두 `// WHY:` 통일.
- 1-2줄 이내. HOW(동작 방식)는 쓰지 않음 — 코드로 충분.
- TODO는 외부 차단 항목만(예: `// TODO: web-tree-sitter 0.21에서 X 제거`).

**DESIGN.md immutable 원칙**:
- 결정이 뒤집혀도 기존 섹션을 수정하지 말 것. 새 섹션을 추가하고 기존 Status를 `Superseded by §N`으로 표기.
- 이유: 시점의 맥락이 사라지면 같은 토론을 반복하게 된다.

---

## 패키지 빌드와 릴리스

**버전 bump 흐름**:

1. [package.json](../package.json) `version` 수정 → 커밋
2. annotated tag 생성: `git tag -a vX.Y.Z -m "Release X.Y.Z — ..."`
3. push: `git push origin main && git push origin vX.Y.Z`
4. (선택) `npm run package`로 `.vsix` 생성 — `*.vsix`는 `.vscodeignore`에 있어 패키지 자체에는 포함되지 않음.

**Semantic versioning**:
- patch: 버그 수정만
- minor: 기능 추가, 출력 형식 변경(splitter 폴더명 등 — 사용자 영향 있는 변화)
- major: TextMate→tree-sitter 같은 광범위 호환성 변경

CHANGELOG는 사용자 시점 사실만 기록. 결정의 이유는 DESIGN.md로 분리.
