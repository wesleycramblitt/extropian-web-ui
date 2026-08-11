// ── Matrix helpers ──────────────────────────────────────────────────────────

function isMatrix(v: unknown): v is number[][] {
  return Array.isArray(v) && v.length > 0 && Array.isArray(v[0]);
}

function isVector(v: unknown): v is number[] {
  return Array.isArray(v) && v.length > 0 && typeof v[0] === 'number';
}

function matmul(a: unknown, b: unknown): number[][] {
  if (!isMatrix(a) || !isMatrix(b)) throw new Error('matmul requires two matrices');
  const [m, n, p] = [a.length, a[0].length, b[0].length];
  if (n !== b.length) throw new Error(`matmul: shape mismatch (${m}x${n} * ${b.length}x${p})`);
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: p }, (_, j) =>
      a[i].reduce((sum, aik, k) => sum + aik * b[k][j], 0)
    )
  );
}

function transpose(m: unknown): number[][] {
  if (!isMatrix(m)) throw new Error('transpose requires a matrix');
  return m[0].map((_, col) => m.map(row => row[col]));
}

function det2x2(m: number[][]): number {
  return m[0][0] * m[1][1] - m[0][1] * m[1][0];
}

function trace2x2(m: number[][]): number {
  return m[0][0] + m[1][1];
}

function eigen2x2(m: number[][]): { values: number[]; vectors: number[][] } {
  if (m.length !== 2 || m[0].length !== 2) throw new Error('eigen only supports 2×2 matrices');
  const tr = trace2x2(m);
  const d = det2x2(m);
  const disc = Math.sqrt(Math.max(0, tr * tr - 4 * d));
  const l1 = (tr + disc) / 2;
  const l2 = (tr - disc) / 2;
  const vals: number[] = [l1, l2];
  const vecs: number[][] = [];

  for (const l of vals) {
    // (A - λI)x = 0 → solve for nullspace of [[a-l, b], [c, d-l]]
    const a = m[0][0] - l, b = m[0][1], c = m[1][0], d = m[1][1] - l;
    let vx = 1, vy = 1;
    if (Math.abs(b) > 1e-10) {
      vx = 1; vy = -a / b;
    } else if (Math.abs(c) > 1e-10) {
      vy = 1; vx = -d / c;
    } else {
      // Diagonal: pick basis vectors
      vecs.push(Math.abs(a) < 1e-10 ? [1, 0] : [0, 1]);
      continue;
    }
    // Normalize
    const norm = Math.sqrt(vx * vx + vy * vy);
    vecs.push([vx / norm, vy / norm]);
  }
  return { values: vals, vectors: vecs };
}

function normVec(v: unknown): number {
  if (!isVector(v)) throw new Error('norm requires a vector');
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

function dotVec(a: unknown, b: unknown): number {
  if (!isVector(a) || !isVector(b)) throw new Error('dot requires two vectors');
  if (a.length !== b.length) throw new Error('dot: length mismatch');
  return a.reduce((s, x, i) => s + x * b[i], 0);
}

// ── Tokenizer ──────────────────────────────────────────────────────────────

type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'string'; value: string }
  | { type: 'dot' }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'lbracket' }
  | { type: 'rbracket' }
  | { type: 'comma' }
  | { type: 'plus' }
  | { type: 'minus' }
  | { type: 'star' }
  | { type: 'slash' }
  | { type: 'caret' }
  | { type: 'dollar' }
  | { type: 'eof' };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
    if (c === '[') { tokens.push({ type: 'lbracket' }); i++; continue; }
    if (c === ']') { tokens.push({ type: 'rbracket' }); i++; continue; }
    if (c === ',') { tokens.push({ type: 'comma' }); i++; continue; }
    if (c === '+') { tokens.push({ type: 'plus' }); i++; continue; }
    if (c === '-') { tokens.push({ type: 'minus' }); i++; continue; }
    if (c === '*') { tokens.push({ type: 'star' }); i++; continue; }
    if (c === '/') { tokens.push({ type: 'slash' }); i++; continue; }
    if (c === '^') { tokens.push({ type: 'caret' }); i++; continue; }
    if (c === '.') { tokens.push({ type: 'dot' }); i++; continue; }
    if (c === '$') { tokens.push({ type: 'dollar' }); i++; continue; }
    if (/\d/.test(c) || (c === '.' && i + 1 < src.length && /\d/.test(src[i + 1]))) {
      let num = '';
      while (i < src.length && (/\d/.test(src[i]) || src[i] === '.')) num += src[i++];
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let ident = '';
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) ident += src[i++];
      tokens.push({ type: 'ident', value: ident });
      continue;
    }
    // Quote string
    if (c === '"' || c === "'") {
      const quote = c;
      let str = '';
      i++;
      while (i < src.length && src[i] !== quote) str += src[i++];
      i++; // skip closing quote
      tokens.push({ type: 'string', value: str });
      continue;
    }
    i++; // skip unknown
  }
  tokens.push({ type: 'eof' });
  return tokens;
}

// ── Recursive descent parser ───────────────────────────────────────────────

class Parser {
  pos = 0;
  constructor(private tokens: Token[]) {}

  peek(): Token { return this.tokens[this.pos] ?? { type: 'eof' }; }
  advance(): Token { return this.tokens[this.pos++] ?? { type: 'eof' }; }
  expect(type: Token['type']): Token {
    const t = this.advance();
    if (t.type !== type) throw new Error(`Expected ${type}, got ${t.type}`);
    return t;
  }

  parse(): Expr { return this.expr(); }

  expr(): Expr {
    let left = this.term();
    while (this.peek().type === 'plus' || this.peek().type === 'minus') {
      const op = this.advance().type as 'plus' | 'minus';
      const right = this.term();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  term(): Expr {
    let left = this.factor();
    while (this.peek().type === 'star' || this.peek().type === 'slash') {
      const op = this.advance().type as 'star' | 'slash';
      const right = this.factor();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  factor(): Expr {
    let left = this.primary();
    if (this.peek().type === 'caret') {
      this.advance();
      const right = this.factor();
      left = { type: 'binary', op: 'caret', left, right };
    }
    return left;
  }

  primary(): Expr {
    const t = this.peek();
    if (t.type === 'number') {
      this.advance();
      return { type: 'literal', value: t.value };
    }
    if (t.type === 'string') {
      this.advance();
      return { type: 'literal', value: t.value };
    }
    if (t.type === 'dollar') {
      return this.refExpr();
    }
    if (t.type === 'minus') {
      this.advance();
      return { type: 'unary', op: 'neg', arg: this.primary() };
    }
    if (t.type === 'lparen') {
      this.advance();
      const e = this.expr();
      this.expect('rparen');
      return e;
    }
    if (t.type === 'ident') {
      const name = t.value;
      this.advance();
      // Function call?
      if (this.peek().type === 'lparen') {
        this.advance();
        const args: Expr[] = [];
        if (this.peek().type !== 'rparen') {
          args.push(this.expr());
          while (this.peek().type === 'comma') { this.advance(); args.push(this.expr()); }
        }
        this.expect('rparen');
        return { type: 'funcall', name, args };
      }
      return { type: 'ref', name };
    }
    throw new Error(`Unexpected token: ${t.type} at position ${this.pos}`);
  }

  refExpr(): Expr {
    this.advance(); // consume $
    const name = (this.expect('ident') as { type: 'ident'; value: string }).value;
    let ref: Expr = { type: 'ref', name };
    // Dot access
    while (this.peek().type === 'dot') {
      this.advance();
      const prop = (this.expect('ident') as { type: 'ident'; value: string }).value;
      ref = { type: 'dotAccess', obj: ref, prop };
    }
    // Bracket index
    while (this.peek().type === 'lbracket') {
      this.advance();
      const index = this.expr();
      this.expect('rbracket');
      ref = { type: 'bracketAccess', obj: ref, index };
    }
    return ref;
  }
}

type Expr =
  | { type: 'literal'; value: number | string }
  | { type: 'ref'; name: string }
  | { type: 'funcall'; name: string; args: Expr[] }
  | { type: 'binary'; op: 'plus' | 'minus' | 'star' | 'slash' | 'caret'; left: Expr; right: Expr }
  | { type: 'unary'; op: 'neg'; arg: Expr }
  | { type: 'dotAccess'; obj: Expr; prop: string }
  | { type: 'bracketAccess'; obj: Expr; index: Expr };

// ── Evaluator ──────────────────────────────────────────────────────────────

function evaluate(expr: Expr, scope: Record<string, unknown>): unknown {
  switch (expr.type) {
    case 'literal': return expr.value;
    case 'ref': {
      if (!(expr.name in scope)) throw new Error(`Undefined: ${expr.name}`);
      return scope[expr.name];
    }
    case 'binary': {
      const l = toNum(evaluate(expr.left, scope));
      const r = toNum(evaluate(expr.right, scope));
      switch (expr.op) {
        case 'plus': return l + r;
        case 'minus': return l - r;
        case 'star': return l * r;
        case 'slash': return l / r;
        case 'caret': return Math.pow(l, r);
      }
    }
    case 'unary': return -toNum(evaluate(expr.arg, scope));
    case 'dotAccess': {
      const obj = evaluate(expr.obj, scope);
      if (obj === null || obj === undefined) throw new Error(`Cannot access .${expr.prop} on null`);
      return (obj as Record<string, unknown>)[expr.prop];
    }
    case 'bracketAccess': {
      const obj = evaluate(expr.obj, scope);
      const idx = toNum(evaluate(expr.index, scope));
      if (Array.isArray(obj)) return obj[idx];
      throw new Error('Bracket access on non-array');
    }
    case 'funcall': {
      const args = expr.args.map(a => evaluate(a, scope));
      return callBuiltin(expr.name, args);
    }
  }
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  throw new Error(`Expected number, got ${typeof v}`);
}

function callBuiltin(name: string, args: unknown[]): unknown {
  switch (name) {
    case 'matmul': return matmul(args[0], args[1]);
    case 'eigen': return eigen2x2(args[0] as number[][]);
    case 'det':
      if (!isMatrix(args[0])) throw new Error('det requires a matrix');
      if (args[0].length === 2 && args[0][0].length === 2) return det2x2(args[0]);
      throw new Error('det only supports 2×2 matrix');
    case 'trace':
      if (!isMatrix(args[0])) throw new Error('trace requires a matrix');
      return args[0].reduce((s, r, i) => s + (r[i] ?? 0), 0);
    case 'transpose': return transpose(args[0] as number[][]);
    case 'sin': return Math.sin(toNum(args[0]));
    case 'cos': return Math.cos(toNum(args[0]));
    case 'tan': return Math.tan(toNum(args[0]));
    case 'sqrt': return Math.sqrt(toNum(args[0]));
    case 'abs': return Math.abs(toNum(args[0]));
    case 'exp': return Math.exp(toNum(args[0]));
    case 'log': return Math.log(toNum(args[0]));
    case 'norm': return normVec(args[0]);
    case 'dot': return dotVec(args[0], args[1]);
    case 'identity': {
      const n = toNum(args[0]);
      return Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    }
    default:
      throw new Error(`Unknown function: ${name}`);
  }
}

// ── $ref resolution ────────────────────────────────────────────────────────

function parseRef(ref: string): Expr | null {
  try {
    const tokens = tokenize(ref);
    const parser = new Parser(tokens);
    const expr = parser.parse();
    if (parser.peek().type !== 'eof') return null;
    return expr;
  } catch {
    return null;
  }
}

/**
 * Walk any value recursively, resolving `$ref` strings and numeric fields
 * that start with `$`. Modifies in place.
 */
export function resolveRefs(obj: unknown, state: Record<string, unknown>, derived: Record<string, unknown>): unknown {
  if (obj === null || obj === undefined) return obj;

  // Full scope: state + derived, with derived shadowing state.
  const scope = { ...state, ...derived };

  // String starting with $ is a ref expression
  if (typeof obj === 'string' && obj.startsWith('$') && obj.length > 1) {
    const expr = parseRef(obj.slice(1)); // strip $
    if (expr) {
      try {
        return evaluate(expr, scope);
      } catch { /* fall through to original string */ }
    }
    // Fallback: simple $name lookup
    const key = obj.slice(1);
    if (key in scope) return scope[key];
    return obj; // unresolvable — keep as string
  }

  // Recurse into arrays
  if (Array.isArray(obj)) {
    return obj.map(v => resolveRefs(v, state, derived));
  }

  // Recurse into objects (but not DOM elements, dates, etc.)
  if (typeof obj === 'object' && obj.constructor === Object) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = resolveRefs(val, state, derived);
    }
    return result;
  }

  return obj;
}

/**
 * Evaluate all derive expressions from state.
 */
export function evaluateDerived(
  derive: Record<string, string>,
  state: Record<string, unknown>
): Record<string, unknown> {
  const derived: Record<string, unknown> = {};
  const scope = { ...state };

  // Simple topological-like evaluation: iterate multiple times
  // since derive expressions may reference each other.
  let changed = true;
  let iterations = 0;
  const maxIterations = 10;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    for (const [name, exprStr] of Object.entries(derive)) {
      if (name in derived) continue; // already computed
      try {
        const tokens = tokenize(exprStr);
        const parser = new Parser(tokens);
        const expr = parser.parse();
        if (parser.peek().type !== 'eof') continue; // parse failed
        const value = evaluate(expr, scope);
        derived[name] = value;
        scope[name] = value;
        changed = true;
      } catch {
        // Skip this one for now, try again next iteration
      }
    }
  }

  return derived;
}

/** Type guard: is this a VisualDoc? */
export function isVisualDoc(input: unknown): input is import('./types.js').VisualDoc {
  if (!input || typeof input !== 'object') return false;
  const d = input as Record<string, unknown>;
  return ('state' in d || 'derive' in d || 'layout' in d || 'views' in d || 'controls' in d);
}
