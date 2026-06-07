// ─── Custom indicators ────────────────────────────────────────────────────────
// User-defined formulas across 1–4 FRED series, evaluated entirely client-side.
// The expression engine is a safe shunting-yard parser — NO eval / new Function —
// because indicators are persisted to localStorage and may eventually be shared.

import type { FredObservation } from './fred';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FormulaVar = 'A' | 'B' | 'C' | 'D';
export const FORMULA_VARS: readonly FormulaVar[] = ['A', 'B', 'C', 'D'];

export interface CustomIndicatorInput {
  /** Variable name used in the formula. */
  var: FormulaVar;
  /** FRED series id. */
  seriesId: string;
}

export interface CustomIndicator {
  /** Stable client-generated id. */
  id: string;
  /** User-friendly name. */
  name: string;
  /** Optional units label (free text — e.g. "%", "ratio", "USD"). */
  units: string;
  /** Expression using A, B, C, D — e.g. "(A - B) / B * 100". */
  formula: string;
  /** Variable → FRED series mapping. */
  inputs: CustomIndicatorInput[];
  /** ISO timestamp. */
  createdAt: string;
}

// ─── Expression engine ────────────────────────────────────────────────────────
// Supported syntax:
//   - Numeric literals:       1, 1.5, .5, 1e3, 1.2e-3
//   - Variables:              A B C D     (single uppercase letters)
//   - Binary operators:       + - * / ^   (^ is right-associative power)
//   - Unary minus / plus:     -A, +(B-C)
//   - Parentheses:            ( ... )
//   - Functions:              abs, sqrt, log, ln, exp
// Everything else throws at parse time.

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'var'; name: FormulaVar }
  | { kind: 'op';  op: '+' | '-' | '*' | '/' | '^' | 'u-' | 'u+' }
  | { kind: 'fn';  name: 'abs' | 'sqrt' | 'log' | 'ln' | 'exp' }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

const FUNCTIONS = new Set(['abs', 'sqrt', 'log', 'ln', 'exp']);

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];

    if (c === ' ' || c === '\t' || c === '\n') {
      i++;
      continue;
    }

    // Number (incl. leading dot, scientific notation)
    if ((c >= '0' && c <= '9') || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = src.slice(i).match(/^[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/);
      if (!m) throw new Error(`Invalid number at position ${i}`);
      tokens.push({ kind: 'num', value: Number(m[0]) });
      i += m[0].length;
      continue;
    }

    // Identifier — variable or function
    if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) {
      const m = src.slice(i).match(/^[A-Za-z]+/)!;
      const ident = m[0];
      if (ident.length === 1 && FORMULA_VARS.includes(ident as FormulaVar)) {
        tokens.push({ kind: 'var', name: ident as FormulaVar });
      } else if (FUNCTIONS.has(ident.toLowerCase())) {
        tokens.push({ kind: 'fn', name: ident.toLowerCase() as 'abs' | 'sqrt' | 'log' | 'ln' | 'exp' });
      } else {
        throw new Error(
          `Unknown identifier "${ident}". Use variables A B C D or functions abs/sqrt/log/ln/exp.`,
        );
      }
      i += ident.length;
      continue;
    }

    if (c === '(') { tokens.push({ kind: 'lparen' }); i++; continue; }
    if (c === ')') { tokens.push({ kind: 'rparen' }); i++; continue; }

    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '^') {
      // Decide unary vs binary based on previous token.
      const prev = tokens[tokens.length - 1];
      const isUnary =
        !prev ||
        prev.kind === 'op' ||
        prev.kind === 'lparen' ||
        prev.kind === 'fn';
      if (isUnary && (c === '+' || c === '-')) {
        tokens.push({ kind: 'op', op: c === '-' ? 'u-' : 'u+' });
      } else {
        tokens.push({ kind: 'op', op: c });
      }
      i++;
      continue;
    }

    throw new Error(`Unexpected character "${c}" at position ${i}.`);
  }
  return tokens;
}

interface OpInfo {
  prec: number;
  rightAssoc: boolean;
  arity: 1 | 2;
}

const OPS: Record<string, OpInfo> = {
  '+':  { prec: 1, rightAssoc: false, arity: 2 },
  '-':  { prec: 1, rightAssoc: false, arity: 2 },
  '*':  { prec: 2, rightAssoc: false, arity: 2 },
  '/':  { prec: 2, rightAssoc: false, arity: 2 },
  '^':  { prec: 4, rightAssoc: true,  arity: 2 },
  'u-': { prec: 3, rightAssoc: true,  arity: 1 },
  'u+': { prec: 3, rightAssoc: true,  arity: 1 },
};

/** Convert tokens into RPN via shunting-yard. */
function toRpn(tokens: Token[]): Token[] {
  const out: Token[] = [];
  const stack: Token[] = [];
  for (const t of tokens) {
    if (t.kind === 'num' || t.kind === 'var') {
      out.push(t);
    } else if (t.kind === 'fn') {
      stack.push(t);
    } else if (t.kind === 'op') {
      const o1 = OPS[t.op];
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.kind === 'op') {
          const o2 = OPS[top.op];
          if (
            (o1.rightAssoc && o1.prec < o2.prec) ||
            (!o1.rightAssoc && o1.prec <= o2.prec)
          ) {
            out.push(stack.pop()!);
            continue;
          }
        } else if (top.kind === 'fn') {
          out.push(stack.pop()!);
          continue;
        }
        break;
      }
      stack.push(t);
    } else if (t.kind === 'lparen') {
      stack.push(t);
    } else if (t.kind === 'rparen') {
      while (stack.length && stack[stack.length - 1].kind !== 'lparen') {
        out.push(stack.pop()!);
      }
      if (!stack.length) throw new Error('Mismatched parenthesis.');
      stack.pop(); // discard '('
      // Pop function preceding the parenthesised group.
      if (stack.length && stack[stack.length - 1].kind === 'fn') {
        out.push(stack.pop()!);
      }
    }
  }
  while (stack.length) {
    const top = stack.pop()!;
    if (top.kind === 'lparen' || top.kind === 'rparen') {
      throw new Error('Mismatched parenthesis.');
    }
    out.push(top);
  }
  return out;
}

export interface CompiledFormula {
  rpn: Token[];
  /** Variables actually referenced by the formula. */
  usedVars: FormulaVar[];
}

/** Parse + validate a formula. Throws on syntax errors. */
export function compileFormula(formula: string): CompiledFormula {
  if (!formula.trim()) throw new Error('Formula is empty.');
  const tokens = tokenize(formula);
  const rpn = toRpn(tokens);
  const usedVars: FormulaVar[] = [];
  for (const t of rpn) {
    if (t.kind === 'var' && !usedVars.includes(t.name)) usedVars.push(t.name);
  }
  // Test-evaluate with all variables = 1 to surface arity errors immediately.
  evaluateRpn(rpn, { A: 1, B: 1, C: 1, D: 1 });
  return { rpn, usedVars };
}

function evaluateRpn(rpn: Token[], vars: Record<FormulaVar, number>): number {
  const stack: number[] = [];
  for (const t of rpn) {
    if (t.kind === 'num') {
      stack.push(t.value);
    } else if (t.kind === 'var') {
      stack.push(vars[t.name]);
    } else if (t.kind === 'op') {
      if (t.op === 'u-' || t.op === 'u+') {
        const a = stack.pop();
        if (a === undefined) throw new Error('Malformed expression.');
        stack.push(t.op === 'u-' ? -a : a);
      } else {
        const b = stack.pop();
        const a = stack.pop();
        if (a === undefined || b === undefined) {
          throw new Error('Malformed expression.');
        }
        switch (t.op) {
          case '+': stack.push(a + b); break;
          case '-': stack.push(a - b); break;
          case '*': stack.push(a * b); break;
          case '/': stack.push(b === 0 ? NaN : a / b); break;
          case '^': stack.push(Math.pow(a, b)); break;
        }
      }
    } else if (t.kind === 'fn') {
      const a = stack.pop();
      if (a === undefined) throw new Error(`Function ${t.name} missing argument.`);
      switch (t.name) {
        case 'abs':  stack.push(Math.abs(a)); break;
        case 'sqrt': stack.push(a < 0 ? NaN : Math.sqrt(a)); break;
        case 'log':  stack.push(a <= 0 ? NaN : Math.log10(a)); break;
        case 'ln':   stack.push(a <= 0 ? NaN : Math.log(a)); break;
        case 'exp':  stack.push(Math.exp(a)); break;
      }
    }
  }
  if (stack.length !== 1) throw new Error('Malformed expression.');
  return stack[0];
}

// ─── Series alignment + evaluation ────────────────────────────────────────────

/**
 * Align observations from multiple series by date. For dates where one series
 * has no value, the most-recent prior value is carried forward (forward-fill).
 * This handles the common case of mixing daily/monthly/quarterly series.
 *
 * Only dates >= the earliest "everyone has at least one prior point" date
 * are returned, so the output never contains NaN at the start.
 */
export function alignByDate(
  inputs: { var: FormulaVar; observations: FredObservation[] }[],
): { date: string; values: Record<FormulaVar, number> }[] {
  const valueMaps = new Map<FormulaVar, Map<string, number>>();
  const allDates = new Set<string>();
  let latestStart = '';

  for (const { var: v, observations } of inputs) {
    const m = new Map<string, number>();
    let firstValid = '';
    for (const o of observations) {
      if (o.value === '.' || o.value === '') continue;
      const n = parseFloat(o.value);
      if (isNaN(n)) continue;
      m.set(o.date, n);
      allDates.add(o.date);
      if (!firstValid) firstValid = o.date;
    }
    valueMaps.set(v, m);
    if (firstValid > latestStart) latestStart = firstValid;
  }

  const sortedDates = [...allDates].sort();
  const carry: Partial<Record<FormulaVar, number>> = {};
  const out: { date: string; values: Record<FormulaVar, number> }[] = [];

  for (const date of sortedDates) {
    for (const { var: v } of inputs) {
      const m = valueMaps.get(v)!;
      if (m.has(date)) carry[v] = m.get(date)!;
    }
    if (date < latestStart) continue;
    if (inputs.some(({ var: v }) => carry[v] === undefined)) continue;
    out.push({
      date,
      values: { ...carry } as Record<FormulaVar, number>,
    });
  }
  return out;
}

/** Evaluate a compiled formula across aligned dates. NaN/Infinity rows are dropped. */
export function evaluateAcrossDates(
  compiled: CompiledFormula,
  aligned: { date: string; values: Record<FormulaVar, number> }[],
): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];
  for (const row of aligned) {
    const v = evaluateRpn(compiled.rpn, row.values);
    if (Number.isFinite(v)) out.push({ date: row.date, value: v });
  }
  return out;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

export const CUSTOM_INDICATORS_STORAGE_KEY = 'econoMonitor:customIndicators';

export function newIndicatorId(): string {
  return `ci_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
