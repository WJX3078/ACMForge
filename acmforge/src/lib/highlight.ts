/**
 * Minimal, dependency-free C++17 tokenizer.
 *
 * Deliberately not pulling in Prism/Shiki: the payload is one file, the
 * palette is driven by the same design tokens as the rest of the UI, and
 * it renders instantly with no async loading flash.
 */

export type TokenType =
  | 'comment'
  | 'preproc'
  | 'string'
  | 'number'
  | 'keyword'
  | 'type'
  | 'func'
  | 'macro'
  | 'punct'
  | 'ident'
  | 'plain'

export interface Token {
  t: TokenType
  v: string
}

const KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'break', 'continue', 'return', 'switch', 'case', 'default',
  'goto', 'typedef', 'sizeof', 'new', 'delete', 'this', 'class', 'struct', 'union', 'enum',
  'public', 'private', 'protected', 'virtual', 'override', 'final', 'noexcept', 'constexpr',
  'inline', 'static', 'extern', 'const', 'volatile', 'mutable', 'typename', 'template',
  'namespace', 'using', 'operator', 'try', 'catch', 'throw', 'static_cast', 'dynamic_cast',
  'const_cast', 'reinterpret_cast', 'true', 'false', 'nullptr', 'and', 'or', 'not', 'decltype',
  'alignas', 'thread_local', 'explicit', 'friend', 'register', 'typeid', 'co_await', 'co_return',
])

const TYPES = new Set([
  'void', 'bool', 'char', 'short', 'int', 'long', 'float', 'double', 'unsigned', 'signed',
  'size_t', 'ptrdiff_t', 'auto', 'wchar_t', 'char16_t', 'char32_t', 'int8_t', 'int16_t',
  'int32_t', 'int64_t', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int128_t', 'uint128_t',
  'vector', 'string', 'map', 'set', 'multiset', 'multimap', 'unordered_map', 'unordered_set',
  'deque', 'queue', 'priority_queue', 'stack', 'pair', 'tuple', 'array', 'bitset', 'function',
  'shared_ptr', 'unique_ptr', 'optional', 'variant', 'istream', 'ostream', 'stringstream',
  'll', 'ull', 'ld', 'i128',
])

const STDLIB = new Set([
  'sort', 'stable_sort', 'min', 'max', 'swap', 'abs', 'lower_bound', 'upper_bound', 'reverse',
  'unique', 'fill', 'memset', 'memcpy', 'printf', 'scanf', 'puts', 'getchar', 'exit', 'assert',
  'gcd', 'lcm', 'pow', 'sqrt', 'floor', 'ceil', 'round', 'accumulate', 'count', 'find',
  'begin', 'end', 'size', 'resize', 'reserve', 'push_back', 'pop_back', 'emplace_back',
  'emplace', 'insert', 'erase', 'clear', 'empty', 'front', 'back', 'top', 'pop', 'push',
  'make_pair', 'make_tuple', 'tie', 'move', 'forward',
])

const TOKEN_RE = new RegExp(
  [
    '(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)', // 1 comment
    '(^[ \\t]*#[^\\n]*)', // 2 preprocessor
    '("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')', // 3 string / char
    '\\b(0[xX][0-9a-fA-F]+[uUlL]*|\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?[fFlL]*)\\b', // 4 number
    '([A-Za-z_]\\w*)', // 5 identifier
    '([{}()\\[\\];:,.<>+\\-*/%=!&|^~?]+)', // 6 punctuation
  ].join('|'),
  'gm',
)

function classifyIdentifier(word: string, src: string, end: number): TokenType {
  if (KEYWORDS.has(word)) return 'keyword'
  if (TYPES.has(word)) return 'type'
  if (/^[A-Z][A-Z0-9_]{1,}$/.test(word)) return 'macro'
  if (/^\s*\(/.test(src.slice(end, end + 4))) return STDLIB.has(word) || TYPES.has(word) ? 'type' : 'func'
  if (STDLIB.has(word)) return 'func'
  return 'ident'
}

export function tokenize(src: string): Token[] {
  const out: Token[] = []
  let last = 0
  let m: RegExpExecArray | null
  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(src)) !== null) {
    if (m.index > last) out.push({ t: 'plain', v: src.slice(last, m.index) })
    const [full, comment, preproc, str, num, ident, punct] = m
    if (comment) out.push({ t: 'comment', v: full })
    else if (preproc) out.push({ t: 'preproc', v: full })
    else if (str) out.push({ t: 'string', v: full })
    else if (num) out.push({ t: 'number', v: full })
    else if (ident) out.push({ t: classifyIdentifier(ident, src, m.index + full.length), v: full })
    else if (punct) out.push({ t: 'punct', v: full })
    last = m.index + full.length
  }
  if (last < src.length) out.push({ t: 'plain', v: src.slice(last) })
  return out
}

/** Tokenize then split into per-line token arrays, so line numbers stay aligned. */
export function highlightLines(src: string): Token[][] {
  const tokens = tokenize(src)
  const lines: Token[][] = [[]]
  for (const tok of tokens) {
    const parts = tok.v.split('\n')
    parts.forEach((part, i) => {
      if (i > 0) lines.push([])
      if (part.length) lines[lines.length - 1].push({ t: tok.t, v: part })
    })
  }
  return lines
}

export const TOKEN_CLASS: Record<TokenType, string> = {
  comment: 'tok-comment',
  preproc: 'tok-preproc',
  string: 'tok-string',
  number: 'tok-number',
  keyword: 'tok-keyword',
  type: 'tok-type',
  func: 'tok-func',
  macro: 'tok-macro',
  punct: 'tok-punct',
  ident: 'tok-ident',
  plain: 'tok-ident',
}
