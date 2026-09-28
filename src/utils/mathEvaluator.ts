/**
 * Safe Mathematical Expression Evaluator for Okane
 * Parses and evaluates arithmetic expressions (+, -, *, /, %, parentheses)
 * without using eval() or Function().
 */

export interface MathEvalResult {
  isValid: boolean;
  result: number | null;
  formatted: string;
  hasOperator: boolean;
  error?: string;
}

const OPERATOR_REGEX = /[+\-xX*×/÷%()]/;

/**
 * Checks if a string contains any mathematical operators.
 */
export function hasMathOperators(str: string): boolean {
  if (!str) return false;
  // Ignore leading unary minus if it's just a negative number (e.g., "-50")
  const trimmed = str.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return false;
  return OPERATOR_REGEX.test(str);
}

/**
 * Clean and normalize mathematical operators into standard symbols.
 */
export function normalizeMathExpression(expr: string): string {
  if (!expr) return '';
  return expr
    .replace(/[×xX]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/,/g, '') // remove thousands separators
    .replace(/,/g, '.')
    .replace(/\s+/g, '');
}

type TokenType = 'NUMBER' | 'OP' | 'LPAREN' | 'RPAREN' | 'PERCENT';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(normalized: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  let expectUnary = true;

  while (i < normalized.length) {
    const char = normalized[i];

    if (/\d|\./.test(char)) {
      let numStr = '';
      let hasDot = false;
      while (i < normalized.length && (/\d/.test(normalized[i]) || normalized[i] === '.')) {
        if (normalized[i] === '.') {
          if (hasDot) return null; // multiple decimal dots
          hasDot = true;
        }
        numStr += normalized[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: numStr });
      expectUnary = false;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      expectUnary = true;
      i++;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      expectUnary = false;
      i++;
      continue;
    }

    if (char === '%') {
      tokens.push({ type: 'PERCENT', value: '%' });
      expectUnary = false;
      i++;
      continue;
    }

    if (char === '+' || char === '-' || char === '*' || char === '/') {
      if (expectUnary && (char === '+' || char === '-')) {
        // Unary operator attached to next number
        if (char === '-') {
          tokens.push({ type: 'NUMBER', value: '-1' });
          tokens.push({ type: 'OP', value: '*' });
        }
        i++;
        continue;
      }

      tokens.push({ type: 'OP', value: char });
      expectUnary = true;
      i++;
      continue;
    }

    // Invalid character
    return null;
  }

  return tokens;
}

/**
 * Shunting-Yard Algorithm to convert Infix to Postfix (RPN)
 */
function toRPN(tokens: Token[]): Token[] | null {
  const outputQueue: Token[] = [];
  const operatorStack: Token[] = [];

  const precedence: Record<string, number> = {
    '+': 1,
    '-': 1,
    '*': 2,
    '/': 2,
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'NUMBER') {
      outputQueue.push(token);
    } else if (token.type === 'PERCENT') {
      outputQueue.push(token);
    } else if (token.type === 'OP') {
      while (
        operatorStack.length > 0 &&
        operatorStack[operatorStack.length - 1].type === 'OP' &&
        precedence[operatorStack[operatorStack.length - 1].value] >= precedence[token.value]
      ) {
        outputQueue.push(operatorStack.pop()!);
      }
      operatorStack.push(token);
    } else if (token.type === 'LPAREN') {
      operatorStack.push(token);
    } else if (token.type === 'RPAREN') {
      let foundMatching = false;
      while (operatorStack.length > 0) {
        const top = operatorStack.pop()!;
        if (top.type === 'LPAREN') {
          foundMatching = true;
          break;
        }
        outputQueue.push(top);
      }
      if (!foundMatching) return null; // mismatched parens
    }
  }

  while (operatorStack.length > 0) {
    const op = operatorStack.pop()!;
    if (op.type === 'LPAREN' || op.type === 'RPAREN') return null; // mismatched parens
    outputQueue.push(op);
  }

  return outputQueue;
}

/**
 * Evaluate Postfix (RPN) Queue
 */
function evaluateRPN(rpn: Token[]): number | null {
  const stack: number[] = [];

  for (const token of rpn) {
    if (token.type === 'NUMBER') {
      const num = parseFloat(token.value);
      if (isNaN(num)) return null;
      stack.push(num);
    } else if (token.type === 'PERCENT') {
      if (stack.length === 0) return null;
      const val = stack.pop()!;
      stack.push(val / 100);
    } else if (token.type === 'OP') {
      if (stack.length < 2) return null;
      const b = stack.pop()!;
      const a = stack.pop()!;

      switch (token.value) {
        case '+':
          stack.push(a + b);
          break;
        case '-':
          stack.push(a - b);
          break;
        case '*':
          stack.push(a * b);
          break;
        case '/':
          if (Math.abs(b) < 1e-12) return null; // divide by zero
          stack.push(a / b);
          break;
        default:
          return null;
      }
    }
  }

  if (stack.length !== 1) return null;
  const finalVal = stack[0];
  if (!isFinite(finalVal) || isNaN(finalVal)) return null;

  // Round floating point issues (e.g., 0.1 + 0.2 -> 0.3)
  return Math.round(finalVal * 100000000) / 100000000;
}

/**
 * Safe expression evaluation for live user input.
 * Also handles partial expressions while typing (e.g. "45 + " -> trims trailing operator for live preview).
 */
export function evaluateMathExpression(input: string): MathEvalResult {
  const raw = (input || '').trim();
  if (!raw) {
    return { isValid: false, result: null, formatted: '', hasOperator: false };
  }

  const hasOp = hasMathOperators(raw);
  if (!hasOp) {
    const num = parseFloat(raw);
    if (!isNaN(num) && isFinite(num)) {
      return {
        isValid: true,
        result: num,
        formatted: String(Math.round(num * 100) / 100),
        hasOperator: false,
      };
    }
    return { isValid: false, result: null, formatted: '', hasOperator: false };
  }

  let normalized = normalizeMathExpression(raw);

  // If ends with trailing operator, try evaluating without it for live typing preview
  if (/[+\-*/]$/.test(normalized)) {
    const trimmed = normalized.slice(0, -1);
    const tokens = tokenize(trimmed);
    if (tokens) {
      const rpn = toRPN(tokens);
      if (rpn) {
        const val = evaluateRPN(rpn);
        if (val !== null) {
          const rounded = Math.round(val * 100) / 100;
          return {
            isValid: true,
            result: rounded,
            formatted: String(rounded),
            hasOperator: true,
          };
        }
      }
    }
  }

  // Handle open parentheses while typing by auto-closing them for preview
  const openParens = (normalized.match(/\(/g) || []).length;
  const closeParens = (normalized.match(/\)/g) || []).length;
  if (openParens > closeParens) {
    normalized += ')'.repeat(openParens - closeParens);
  }

  const tokens = tokenize(normalized);
  if (!tokens || tokens.length === 0) {
    return { isValid: false, result: null, formatted: '', hasOperator: true, error: 'Invalid expression' };
  }

  const rpn = toRPN(tokens);
  if (!rpn) {
    return { isValid: false, result: null, formatted: '', hasOperator: true, error: 'Mismatched parentheses' };
  }

  const res = evaluateRPN(rpn);
  if (res === null) {
    return { isValid: false, result: null, formatted: '', hasOperator: true, error: 'Math error' };
  }

  const rounded = Math.round(res * 100) / 100;
  return {
    isValid: true,
    result: rounded,
    formatted: String(rounded),
    hasOperator: true,
  };
}
