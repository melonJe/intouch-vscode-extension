;; ---------------------------------------------------------------------------
;; Tree-sitter highlights for InTouch QuickScript + Window Report exports.
;;
;; Capture names map to VSCode semantic token types via the extension's
;; `semanticTokensProvider.ts`. See README for the capture → token table.
;; ---------------------------------------------------------------------------

;; ---- QuickScript control keywords ----------------------------------------
[
  (declaration "DIM" @keyword)
  (if_statement "IF" @keyword)
  (if_statement "THEN" @keyword)
  (if_statement "ENDIF" @keyword)
  (else_clause "ELSE" @keyword)
  (for_statement "FOR" @keyword)
  (for_statement "TO" @keyword)
  (for_statement "STEP" @keyword)
  (for_statement "NEXT" @keyword)
  (call_statement "CALL" @keyword)
  (exit_statement) @keyword
]

;; ---- Data types ----------------------------------------------------------
(data_type) @type

;; ---- Logical / arithmetic word operators ---------------------------------
(binary_expression
  operator: _ @keyword.operator
  (#match? @keyword.operator "^([Aa][Nn][Dd]|[Oo][Rr]|[Xx][Oo][Rr]|[Mm][Oo][Dd])$"))

(unary_expression
  operator: _ @keyword.operator
  (#match? @keyword.operator "^[Nn][Oo][Tt]$"))

;; ---- Symbolic operators --------------------------------------------------
(binary_expression
  operator: _ @operator
  (#match? @operator "^(\\+|-|\\*|/|\\^|&|==|<>|!=|>=|<=|>|<)$"))

(unary_expression
  operator: _ @operator
  (#match? @operator "^-$"))

(assignment "=" @operator)

;; ---- Literals ------------------------------------------------------------
(number) @number
(string) @string

;; ---- Comments -----------------------------------------------------------
;; TODO/FIXME word-level highlighting is applied post-hoc in the JS
;; semantic tokens provider (comment text is opaque to tree-sitter).
(comment) @comment

;; ---- System variables ----------------------------------------------------
(system_variable) @variable.builtin

;; ---- Property access: tag.Field ------------------------------------------
(property_access
  property: (identifier) @property)

;; ---- Function calls ------------------------------------------------------
;; All function calls captured as @function; the JS semantic tokens
;; provider upgrades known builtins (case-insensitive) to
;; `function + defaultLibrary`. Case-insensitive matching via JS RegExp is
;; incompatible with `(?i)` inline flags, hence the JS-side classification.
(function_call
  name: (identifier) @function)

;; ---- Bare commands (statement form) -------------------------------------
;; All bare-command identifiers captured as @function; the provider
;; re-maps the four built-in commands (HideSelf/Show/Hide/Ack) to @keyword.
(command_statement
  command: (identifier) @function)

;; ---- Call statement (CALL <id>) -----------------------------------------
(call_statement (identifier) @function)

;; ---- Declaration name ---------------------------------------------------
(declaration name: (identifier) @variable)

;; ---- Assignment LHS -----------------------------------------------------
(assignment
  left: (identifier) @variable)

;; ---- FOR loop variable --------------------------------------------------
(for_statement variable: (identifier) @variable)

;; ---- Generic identifier fallback (primary expressions) ------------------
(primary_expression (identifier) @variable)

;; ---------------------------------------------------------------------------
;; Window Report metadata
;; ---------------------------------------------------------------------------
(window_report_header "Window" @namespace)
(window_report_header "Report" @namespace)
(window_report_header "for" @namespace)
(window_report_header name: (string) @string)

(statement_header "Statement" @namespace)
(application_scripts_marker) @namespace
(application_script_marker) @namespace
(script_timing_marker "Script" @namespace)
(script_timing_marker (identifier) @label)
(script_timing_marker (number) @number)

;; Top-level loose metadata tokens — treat identifiers as labels so that
;; "Object Type", "Location", "Caption", etc. read as structural metadata
;; rather than code variables. Matching done via the parent (source_file)
;; so we only capture meta-token identifiers, not in-script identifiers.
(source_file (identifier) @label)
(source_file (number) @number)
(source_file (string) @string)

;; ---- Structural punctuation ---------------------------------------------
;; (ERROR nodes) contain individual tokens that still get highlighted
;; through their own patterns above.
