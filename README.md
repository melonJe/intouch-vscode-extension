# InTouch QuickScript Language Support

VSCode extension for AVEVA InTouch HMI QuickScript syntax highlighting.

## Features

- **Syntax highlighting** for `.intouch` files
- **Theme support** - Colors automatically adapt to your VSCode theme
- **TODO/FIXME highlighting** - Special highlighting for TODO, FIXME, HACK, NOTE, BUG, XXX keywords inside comments
- **Comprehensive function support**:
  - String functions (StringLeft, StringMid, etc.)
  - Math functions (Abs, Sin, Cos, etc.)
  - System/IO functions (TagRead, TagWrite, etc.)
  - Window functions (Show, Hide, etc.)
  - Alarm functions (Ack, AlmAckAll, etc.)
  - File functions (FileRead, FileWrite, etc.)
  - Historian functions (HTGetPenName, HTGetValue, etc.)

## Supported Language Constructs

### Control Keywords
- `IF`, `THEN`, `ELSE`, `ELSEIF`, `ENDIF`
- `WHILE`, `ENDWHILE`
- `FOR`, `NEXT`
- `GOTO`, `CALL`, `RETURN`, `EXIT`

### Data Types
- `INTEGER`, `REAL`, `DISCRETE`, `MESSAGE`, `TIME`, `BOOLEAN`

### Operators
- Logical: `AND`, `OR`, `NOT`, `XOR`
- Arithmetic: `+`, `-`, `*`, `/`, `^`, `MOD`
- Comparison: `=`, `<>`, `>`, `<`, `>=`, `<=`

### Comments
InTouch uses curly braces for block comments:
```intouch
{ This is a comment }
{ TODO: This will be highlighted in gold/orange }
```

### System Variables
System variables start with `$`:
- `$DateString`, `$TimeString`
- `$Year`, `$Month`, `$Day`
- `$Hour`, `$Minute`, `$Second`
- `$Date`, `$Msec`

## Installation

1. Open VSCode
2. Go to Extensions (Cmd+Shift+X)
3. Search for "InTouch QuickScript"
4. Click Install

Or install from VSIX:
```bash
vsce package
# Then install the generated .vsix file
```

## Usage

1. Open any `.intouch` file
2. The extension automatically detects the file type
3. Enjoy syntax highlighting!

To check token scopes: Command Palette → `Developer: Inspect Editor Tokens and Scopes`

## Development

### Project Structure
```
vs-intouch-extension/
├── package.json                      # Extension manifest
├── language-configuration.json       # Language settings
├── syntaxes/
│   └── intouch.tmLanguage.json       # TextMate grammar
├── sample/
│   └── test.intouch                  # Sample file
└── README.md                         # This file
```

### Testing
1. Open the project in VSCode
2. Press F5 to open Extension Development Host
3. Open `sample/test.intouch` to see highlighting in action

## License

MIT
