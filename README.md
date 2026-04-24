# InTouch QuickScript Language Support

Tree-sitter 기반 VSCode extension으로 AVEVA InTouch HMI QuickScript 및 Window Report export 파일의 syntax highlighting 제공.

## Features

- **Tree-sitter 파서** — web-tree-sitter (WASM) 기반 정확한 구문 분석
- **Semantic Tokens** — `DocumentSemanticTokensProvider`로 테마 친화적 하이라이트
- **TextMate fallback** — semantic token 미지원 테마에서도 기본 색상 표시
- **131개 built-in 함수** — String/Math/IO/Window/Alarm/File/Historian/SQL/System 카테고리
- **TODO/FIXME 마커** — `{ TODO ... }` 주석 내 특수 강조
- **Case-insensitive** — InTouch는 대소문자를 구분하지 않음

### 지원 파일
- `.intouch` — 순수 QuickScript 파일
- `.txt` — InTouch Window Report export (firstLine 매칭)

## 지원하는 QuickScript 구문

### 선언 / 할당
```intouch
DIM motorSpeed INTEGER;
Batch%Conc = SetPoint;                { % 포함 식별자 }
HistTrend.ChartLength = 180;          { 태그 속성 할당 }
```

### 제어문
```intouch
IF condition THEN
  ...
ELSE
  IF nestedCondition THEN ... ENDIF;  { ELSE IF 는 별도 구성이 아님 }
ENDIF;

FOR i = 1 TO 10 STEP 2
  ...
NEXT;
```

### Bare command (괄호 없는 built-in)
```intouch
HideSelf;
Show "Window";
Hide "Conveyor";
Ack ReactLevel;
ShowHome;              { 사용자 정의 Quickfunction }
```

### 표현식
- 산술: `+`, `-`, `*`, `/`, `^`, `&`, `MOD`
- 비교: `==`, `<>`, `!=`, `>`, `<`, `>=`, `<=`
- 논리: `AND`, `OR`, `NOT`, `XOR`

### 시스템 변수
`$Second`, `$DateTime`, `$System`, `$Operator` 등 `$`로 시작하는 모든 변수

## 개발

### 요구 사항
- Node.js 20+
- Docker (WASM 빌드용)

### 빌드
```bash
npm install
npm run build:parser   # tree-sitter generate + build --wasm
npm run compile        # TypeScript → out/
```

### 테스트
```bash
cd tree-sitter-intouch
npx tree-sitter test
```

F5 키로 VSCode Extension Development Host 실행 → `sample/test.intouch` 또는 `docs/demo_*.txt` 열기.

### 패키지 빌드
```bash
npm run package        # .vsix 생성
```

## Architecture

```
vs-intouch-extension/
├── package.json                          # 확장 manifest
├── language-configuration.json           # { } 주석, 브래킷, autoClosing
├── tsconfig.json
├── src/
│   ├── extension.ts                      # activate()
│   ├── parser.ts                         # web-tree-sitter WASM 로드
│   └── semanticTokensProvider.ts         # Tree → SemanticTokens
├── syntaxes/
│   └── intouch.tmLanguage.json           # 최소 TextMate fallback
├── tree-sitter-intouch/
│   ├── grammar.js                        # Tree-sitter 문법
│   ├── queries/highlights.scm            # 하이라이트 규칙
│   ├── test/corpus/                      # 단위 테스트
│   └── tree-sitter-intouch.wasm          # 빌드 산출물
└── sample/test.intouch                   # 수동 테스트용 샘플
```

## License

MIT
