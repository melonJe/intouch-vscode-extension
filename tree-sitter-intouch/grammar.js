/**
 * Tree-sitter grammar for AVEVA InTouch QuickScript
 * + InTouch Window Report export format
 *
 * Handles two kinds of files:
 *   1. .intouch — pure QuickScript source
 *   2. Window Report exports (.txt) — object metadata with embedded
 *      QuickScript under `Statement:` and `Script ... :` blocks
 *
 * Design: QuickScript statements parse tightly (same as .intouch).
 * Window Report metadata parses LOOSELY — individual identifiers,
 * numbers, strings and punctuation are recognized at top-level with
 * negative precedence, so the parser tokenizes them without building
 * an ERROR tree. Highlighting queries then decide semantic meaning
 * via predicates on node text (e.g. identifying property keys).
 *
 * InTouch is case-insensitive — keywords use the `ci` helper.
 */

function ci(word) {
  return new RegExp(
    word.split('').map(c => {
      const l = c.toLowerCase();
      const u = c.toUpperCase();
      return l === u ? c : `[${l}${u}]`;
    }).join('')
  );
}

// Aliased case-insensitive keyword token. Produces a named anonymous
// node with stable name (e.g. "DIM") so highlights.scm can query it.
function kw(word) {
  return alias(ci(word), word);
}

function commaSep(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

// Built-in function names used by InTouch QuickScript. Matched
// case-insensitively via the `function_call` -> `identifier` path;
// highlighting queries detect built-ins via predicate.
const BUILTIN_FUNCTIONS = [
  // String (24)
  'StringASCII','StringChar','StringCompare','StringCompareNoCase',
  'StringFind','StringFromIntg','StringFromReal','StringFromTime',
  'StringFromTimeLocal','StringInString','StringLeft','StringLen',
  'StringLower','StringMid','StringReplace','StringRight','StringSpace',
  'StringTest','StringToIntg','StringToReal','StringTrim','StringUpper',
  'Text','DText',
  // Math (22)
  'Abs','Atan','Cos','Exp','Log','LogN','Pi','Round','Sgn',
  'Sin','Sqrt','Tan','ArcCos','ArcSin','ArcTan','Pow','Frac','Int',
  'Max','Min','Random','Trunc',
  // IO (6)
  'TagRead','TagWrite','TagExists','TagDelete','TagSetAttribute','TagGetAttribute',
  // Window (9)
  'Show','Hide','ToggleHide','PrintWindow','CloseWindow',
  'WWDialUp','WWControl','WWExecute','ShowAt',
  // Alarm (9)
  'Ack','AlmAckAll','AlmAckSelect','AlmAckSelected','AlmSelect',
  'AlmMoveCursor','AlmShow','AlmSuppress','AlmUnSuppress',
  // File (13)
  'FileRead','FileWrite','FileDelete','FileCopy','FileMove',
  'FileFindFirst','FileFindNext','FileFindClose','FileClose',
  'FileReadMessage','FileWriteMessage','InfoDisk','InfoFile','InfoResource',
  // Historian (6)
  'HTGetPenName','HTGetValue','HTGetTimeAtScooter',
  'HTGetTimeStringAtScooter','HTSetPenName','HTUpdateToCurrentTime',
  // SQL (26)
  'SQLConnect','SQLCreateTable','SQLDelete','SQLDropTable',
  'SQLExecute','SQLInsert','SQLSelect','SQLSetParamValue','SQLSetStatement',
  'SQLTranCommit','SQLTranRollback','SQLTranStart','SQLUpdate','SQLUpdateCurrent',
  'SQLNext','SQLNumRows','SQLPrepareStatement','SQLDisconnect','SQLEnd',
  'SQLErrorMsg','SQLFirst','SQLGetRecord',
  'SQLClearParam','SQLClearStatement','SQLAppendStatement',
  // System (14)
  'VerifyUser','GetUserName','IsAuthorized','InTouchVersion',
  'InTouchAppDir','InTouchViewAccess','PostEvent','SendKeys',
  'PlaySound','LogMessage','Execute','WinPlatform',
  'GetNodeName','GetProjectName',
];

// Bare-command built-ins callable without parens as a statement.
const BARE_COMMANDS = ['HideSelf', 'Show', 'Hide', 'Ack'];

module.exports = grammar({
  name: 'intouch',

  extras: $ => [
    /[ \t\r\n]/,
    $.comment,
  ],

  word: $ => $.identifier,

  rules: {
    // -----------------------------------------------------------------------
    // Top-level — well-known Window Report markers first, then
    // QuickScript statements, then a catch-all for loose metadata tokens.
    // -----------------------------------------------------------------------
    source_file: $ => repeat($._top_item),

    _top_item: $ => choice(
      $.window_report_header,
      $.statement_header,
      $.application_scripts_marker,
      $.application_script_marker,
      $.script_timing_marker,
      $.statement,
      $.comment,
      // Catch-all loose tokens for metadata lines. Negative precedence
      // ensures real QuickScript constructs win when applicable.
      $._meta_token,
    ),

    _meta_token: $ => prec(-10, choice(
      $.identifier,
      $.system_variable,
      $.number,
      $.string,
      $.property_access,
      ':',
      '(',
      ')',
      ',',
      '-',
      '/',
      '=',
    )),

    // -----------------------------------------------------------------------
    // Window Report well-known markers
    // -----------------------------------------------------------------------
    // "Window Report for "<name>""  — first line of an export
    window_report_header: $ => seq(
      kw('Window'), kw('Report'), kw('for'),
      field('name', $.string),
    ),

    // "Statement:"  — marker preceding a QuickScript block
    statement_header: $ => prec(5, seq(kw('Statement'), ':')),

    // "Application Scripts"
    application_scripts_marker: $ => prec(5, seq(kw('Application'), kw('Scripts'))),

    // "Application Script:"
    application_script_marker: $ => prec(5, seq(kw('Application'), kw('Script'), ':')),

    // "Script While application running, every 100 msec:"
    script_timing_marker: $ => prec(5, seq(
      kw('Script'),
      repeat1(choice($.identifier, $.number, ',')),
      ':',
    )),

    // -----------------------------------------------------------------------
    // QuickScript statements
    // -----------------------------------------------------------------------
    statement: $ => seq(
      choice(
        $.declaration,
        $.if_statement,
        $.for_statement,
        $.exit_statement,
        $.call_statement,
        $.assignment,
        $.command_statement,
        $.expression_statement,
      ),
      ';',
    ),

    declaration: $ => seq(
      kw('DIM'),
      field('name', $.identifier),
      field('type', $.data_type),
    ),

    data_type: $ => choice(
      kw('INTEGER'), kw('REAL'), kw('DISCRETE'),
      kw('MESSAGE'), kw('TIME'), kw('BOOLEAN'),
    ),

    assignment: $ => prec(2, seq(
      field('left', choice($.identifier, $.system_variable, $.property_access)),
      '=',
      field('right', $.expression),
    )),

    // InTouch has NO dedicated ELSE IF construct — ELSE may contain a
    // nested IF statement with its own ENDIF.
    if_statement: $ => seq(
      kw('IF'),
      field('condition', $.expression),
      kw('THEN'),
      repeat($.statement),
      optional($.else_clause),
      kw('ENDIF'),
    ),

    else_clause: $ => seq(
      kw('ELSE'),
      repeat($.statement),
    ),

    for_statement: $ => seq(
      kw('FOR'),
      field('variable', $.identifier),
      '=',
      field('start', $.expression),
      kw('TO'),
      field('end', $.expression),
      optional(seq(kw('STEP'), field('step', $.expression))),
      repeat($.statement),
      kw('NEXT'),
    ),

    call_statement: $ => seq(kw('CALL'), $.identifier),

    exit_statement: $ => choice(kw('EXIT'), kw('RETURN')),

    // Bare command: `HideSelf;` / `Show "win";` / `Ack tag;` / `ShowHome;`
    command_statement: $ => prec(1, seq(
      field('command', $.identifier),
      optional(field('arg', $._command_arg)),
    )),

    _command_arg: $ => choice(
      $.string,
      $.property_access,
      $.identifier,
      $.system_variable,
      $.number,
    ),

    expression_statement: $ => $.function_call,

    // -----------------------------------------------------------------------
    // Expressions — precedence (higher = binds tighter):
    //   8  unary NOT, unary -
    //   7  ^
    //   6  * /
    //   5  + -  &  MOD
    //   4  ==  <>  !=  >  <  >=  <=
    //   3  AND  OR  XOR
    // -----------------------------------------------------------------------
    expression: $ => choice(
      $.binary_expression,
      $.unary_expression,
      $.primary_expression,
    ),

    primary_expression: $ => choice(
      $.function_call,
      $.property_access,
      $.identifier,
      $.system_variable,
      $.number,
      $.string,
      $.parenthesized_expression,
    ),

    parenthesized_expression: $ => seq('(', $.expression, ')'),

    binary_expression: $ => {
      const table = [
        [3, choice(kw('AND'), kw('OR'), kw('XOR'))],
        [4, choice('==', '<>', '!=', '>=', '<=', '>', '<')],
        [5, choice('+', '-', '&', kw('MOD'))],
        [6, choice('*', '/')],
        [7, '^'],
      ];
      return choice(...table.map(([p, op]) =>
        prec.left(p, seq(
          field('left', $.expression),
          field('operator', op),
          field('right', $.expression),
        ))
      ));
    },

    unary_expression: $ => choice(
      prec.right(8, seq(field('operator', kw('NOT')), $.expression)),
      prec.right(8, seq(field('operator', '-'), $.expression)),
    ),

    // Chained property access: HistTrend.Pen4, $System.Alarm,
    // Batch%Conc.UnAck, TagRead("x").Alarm
    property_access: $ => prec.left(seq(
      choice($.identifier, $.system_variable, $.function_call, $.property_access),
      '.',
      field('property', $.identifier),
    )),

    function_call: $ => prec(2, seq(
      field('name', $.identifier),
      '(',
      optional(commaSep($.expression)),
      ')',
    )),

    // -----------------------------------------------------------------------
    // Tokens
    // -----------------------------------------------------------------------
    identifier: $ => /[A-Za-z_][A-Za-z0-9_%]*/,

    system_variable: $ => token(/\$[A-Za-z][A-Za-z0-9_]*/),

    number: $ => token(choice(
      /\d+\.\d+/,
      /\.\d+/,
      /\d+/,
    )),

    string: $ => seq(
      '"',
      repeat(choice(
        token.immediate(/[^"\\\n]+/),
        token.immediate(seq('\\', /./)),
      )),
      '"',
    ),

    // Block comment: { ... }  (no nesting)
    comment: $ => token(seq('{', /[^}]*/, '}')),
  },
});
