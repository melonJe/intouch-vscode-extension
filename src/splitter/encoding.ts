import * as iconv from 'iconv-lite';

/**
 * VS Code의 `files.encoding` 설정 값(예: 'utf8', 'cp949', 'shiftjis' 등)을
 * iconv-lite가 이해하는 라벨로 매핑한다. 대부분의 id는 iconv-lite의
 * 정규화 규칙(소문자화 + 영숫자만 남김)과 동일하므로 별도 매핑이 필요 없지만,
 * VS Code 고유 명칭을 쓰는 일부만 명시적으로 변환한다.
 */
const VSCODE_TO_ICONV: Record<string, string> = {
  utf8: 'utf8',
  utf8bom: 'utf8',
  utf16le: 'utf16le',
  utf16be: 'utf16be',
  windows1252: 'windows1252',
  windows1250: 'windows1250',
  windows1251: 'windows1251',
  windows1253: 'windows1253',
  windows1254: 'windows1254',
  windows1255: 'windows1255',
  windows1256: 'windows1256',
  windows1257: 'windows1257',
  windows1258: 'windows1258',
  windows874: 'windows874',
  iso88591: 'iso88591',
  iso88592: 'iso88592',
  iso88593: 'iso88593',
  iso88594: 'iso88594',
  iso88595: 'iso88595',
  iso88596: 'iso88596',
  iso88597: 'iso88597',
  iso88598: 'iso88598',
  iso88599: 'iso88599',
  iso885910: 'iso885910',
  iso885911: 'iso885911',
  iso885913: 'iso885913',
  iso885914: 'iso885914',
  iso885915: 'iso885915',
  iso885916: 'iso885916',
  cp437: 'cp437',
  cp850: 'cp850',
  cp852: 'cp852',
  cp865: 'cp865',
  cp866: 'cp866',
  cp950: 'big5',
  cp1125: 'cp1125',
  koi8r: 'koi8r',
  koi8u: 'koi8u',
  macroman: 'macroman',
  // CJK
  cp949: 'cp949',
  eucjp: 'eucjp',
  shiftjis: 'shiftjis',
  gb2312: 'gb2312',
  gbk: 'gbk',
  gb18030: 'gb18030',
  big5hkscs: 'big5hkscs',
};

/** VS Code 인코딩 id를 iconv-lite 라벨로 변환한다. 알 수 없으면 원본 id를 그대로 시도한다. */
export function mapVscodeEncodingToIconv(vscodeEncodingId: string): string {
  const normalized = vscodeEncodingId.toLowerCase().replace(/[^a-z0-9]/g, '');
  return VSCODE_TO_ICONV[normalized] ?? normalized;
}

/**
 * 주어진 버퍼를 VS Code 인코딩 id 기준으로 디코딩한다.
 * utf8/utf8bom은 Node 기본 디코더를 사용하고(BOM은 자동 제거되지 않으므로 수동 처리),
 * 그 외에는 iconv-lite로 디코딩한다. 지원하지 않는 인코딩이면 utf8로 폴백한다.
 */
export function decodeBuffer(buffer: Buffer, vscodeEncodingId: string): string {
  const iconvLabel = mapVscodeEncodingToIconv(vscodeEncodingId);

  if (iconvLabel === 'utf8') {
    let text = buffer.toString('utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return text;
  }

  if (!iconv.encodingExists(iconvLabel)) {
    return buffer.toString('utf8');
  }

  return iconv.decode(buffer, iconvLabel);
}
