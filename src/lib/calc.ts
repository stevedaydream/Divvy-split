/**
 * A tiny arithmetic evaluator for the converter keypad.
 *
 * The previous screen ran the expression through `new Function(...)`, guarded
 * only by a regex. This parses the tokens itself, so nothing typed into the
 * keypad is ever handed to the JS engine as code.
 */

type Operator = '+' | '-' | '*' | '/'
type Token = { kind: 'number'; value: number } | { kind: 'op'; value: Operator }

const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2 } as const

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = []
  let index = 0

  while (index < input.length) {
    const char = input[index]!

    if (char === ' ') {
      index++
      continue
    }

    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ kind: 'op', value: char })
      index++
      continue
    }

    if (/[0-9.]/.test(char)) {
      let literal = ''
      while (index < input.length && /[0-9.]/.test(input[index]!)) literal += input[index++]
      const value = Number.parseFloat(literal)
      if (!Number.isFinite(value)) return null
      tokens.push({ kind: 'number', value })
      continue
    }

    return null
  }

  return tokens
}

function applyOp(op: Operator, a: number, b: number): number {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '/': return b === 0 ? Number.NaN : a / b
  }
}

/**
 * Evaluates `"12 + 3 * 4"` with the usual precedence.
 * Returns `null` for anything malformed, so callers can show an error state.
 */
export function evaluate(expression: string): number | null {
  const tokens = tokenize(expression.trim())
  if (!tokens || tokens.length === 0) return null

  const values: number[] = []
  const operators: Operator[] = []

  function reduce(): boolean {
    const op = operators.pop()
    const b = values.pop()
    const a = values.pop()
    if (op === undefined || a === undefined || b === undefined) return false
    values.push(applyOp(op, a, b))
    return true
  }

  let expectNumber = true

  for (const token of tokens) {
    if (token.kind === 'number') {
      if (!expectNumber) return null
      values.push(token.value)
      expectNumber = false
      continue
    }

    if (expectNumber) return null
    while (operators.length && PRECEDENCE[operators[operators.length - 1]!] >= PRECEDENCE[token.value]) {
      if (!reduce()) return null
    }
    operators.push(token.value)
    expectNumber = true
  }

  if (expectNumber) return null
  while (operators.length) if (!reduce()) return null

  const result = values[0]
  return result !== undefined && values.length === 1 && Number.isFinite(result) ? result : null
}
