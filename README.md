# InTouch QuickScript Language Support

Tree-sitter 기반 VSCode extension으로 AVEVA InTouch HMI QuickScript 및 Window Report export 파일의 syntax highlighting 제공.

## Features

- **Tree-sitter 파서** — web-tree-sitter (WASM) 기반 정확한 구문 분석
- **Semantic Tokens** — `DocumentSemanticTokensProvider`로 테마 친화적 하이라이트
- **131개 built-in 함수** — String/Math/IO/Window/Alarm/File/Historian/SQL/System 카테고리
- **TODO/FIXME 마커** — `{ TODO ... }` 주석 내 특수 강조
- **Case-insensitive** — InTouch는 대소문자를 구분하지 않음
- **프로젝트 분할** — 한 파일로 export된 InTouch 프로젝트를 윈도우/스크립트별 파일로 분리

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

## InTouch 프로젝트 분할

WindowMaker가 한 파일에 한꺼번에 export한 프로젝트(`.txt`)를 윈도우·스크립트·태그DB 단위 파일로 분리. 원본 파일은 그대로 유지됨.

### 출력 구조 (예: `docs/demo_1.txt` 입력 시)

```
docs/demo_1.txt                                            # 원본 유지
docs/demo_1/
├── windows/
│   ├── pctConc.txt                                        # 윈도우별 1파일
│   ├── Conveyor.txt                                       # %는 'pct'로 치환
│   └── ... (이하 모든 Window Report)
├── application_scripts/
│   └── while_application_running_every_100_msec.txt       # trigger별 1파일
├── condition_scripts/      ← Condition Script별 1파일
├── data_change_scripts/    ← Data Change Script별 1파일
├── key_scripts/            ← Key Script별 1파일
├── quick_functions/        ← QuickFunction별 1파일 (예: L2S132InputEnter.txt)
├── activex_event_scripts/  ← ActiveX Event Script별 1파일
└── database_report.txt                                    # 태그 사전
```

각 윈도우 파일에는 그 윈도우의 객체, Link Details, Window Scripts, `Database entries used in "..."`까지 모두 포함.

### 사용법

**VS Code 명령**
- Command Palette → `InTouch: Split Project Export…`
- Explorer에서 `.txt`/`.intouch` 우클릭 → `InTouch: Split Project Export…`
- 에디터 탭 우클릭 (intouch 언어로 인식되는 파일)

출력 폴더에 이미 파일이 있으면 모달로 `Overwrite all` / `Cancel` 확인. 경고가 있으면 `Output → InTouch Split` 패널에 표시.

**CLI**
```bash
npm run compile                          # 처음 한 번
npm run split -- docs/demo_1.txt         # 출력 폴더에 파일이 있으면 거부
npm run split -- docs/demo_1.txt --force # 덮어쓰기
npm run split -- file1.txt file2.txt     # 여러 파일 일괄
```

### 처리되는 형식

InTouch가 export하는 모든 최상위 카테고리를 인식:

| 카테고리 | banner | 인스턴스 헤더 |
|---------|--------|--------------|
| Window Report | `Window Report for "<name>"` | (인스턴스 단위가 곧 윈도우) |
| Application Scripts | `Application Scripts` | `Application Script:` + 들여쓰기된 `Script <trigger>:` |
| Condition Scripts | `Condition Scripts` | `Condition Script:<expression>` |
| Data Change Scripts | `Data Change Scripts` | `Data Change Script:<tagname>` |
| Key Scripts | `Key Scripts` | `Key Script:<key>` |
| QuickFunctions | `QuickFunctions` | `QuickFunction:<name>( ... )` |
| ActiveX Event Scripts | `ActiveX Event Scripts` | `ActiveX Event Script:<name>` |
| Database Report | `Database Report Printed On : ...` | (단일 파일) |

CRLF/LF 라인 종결자는 자동 감지·보존. 첫 줄에서 `W`가 누락된 export(`indow Report for ...`)는 자동 보충 + 경고.

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
│   ├── semanticTokensProvider.ts         # Tree → SemanticTokens
│   ├── splitter/                         # 프로젝트 분할 핵심 로직 (vscode 의존성 X)
│   ├── commands/split.ts                 # VS Code 명령 래퍼
│   └── scripts/split-cli.ts              # CLI 진입점 (npm run split)
├── tree-sitter-intouch/
│   ├── grammar.js                        # Tree-sitter 문법
│   ├── queries/highlights.scm            # 하이라이트 규칙
│   ├── test/corpus/                      # 단위 테스트
│   └── tree-sitter-intouch.wasm          # 빌드 산출물
└── sample/test.intouch                   # 수동 테스트용 샘플
```

## License

MIT
