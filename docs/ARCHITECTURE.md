# Prancer Architecture

Prancer is the TypeScript tree-walking interpreter implementation of santa-lang. This document provides a comprehensive overview of the internal architecture, execution model, and design decisions.

## Overview

Prancer is a classic tree-walking interpreter that directly traverses and evaluates the AST without any intermediate compilation step. This approach prioritizes simplicity and debuggability over raw performance.

### Execution Pipeline

```
Source Code → Lexer → Parser → AST → Evaluator → Result
                                        ↓
                                Environment (Scopes)
```

| Stage         | Location                              | Description                                      |
| ------------- | ------------------------------------- | ------------------------------------------------ |
| **Lexer**     | `src/lang/src/lexer/`                 | Tokenizes source into keywords, operators, literals |
| **Parser**    | `src/lang/src/parser/`                | Pratt parser producing an AST                    |
| **Evaluator** | `src/lang/src/evaluator/evaluator.ts` | Tree-walking interpreter executing the AST       |
| **Objects**   | `src/lang/src/evaluator/object/`      | Runtime value representations                    |
| **Builtins**  | `src/lang/src/evaluator/builtins/`    | Built-in function library                        |

## Lexer

**Location:** `src/lang/src/lexer/lexer.ts`

The lexer is a straightforward character-by-character scanner that produces tokens.

### Interface

```typescript
class Lexer {
  nextToken(): Token    // Get next token
  readAll(): Token[]    // Get all tokens (for debugging)
}
```

### Token Structure

```typescript
type Token = {
  kind: TokenKind;      // Token type (e.g., INTEGER, IDENTIFIER)
  literal: string;      // Raw text
  line: number;         // Source line (0-indexed)
  column: number;       // Source column (0-indexed)
};
```

### Key Features

- **Position tracking**: Maintains line/column for error reporting
- **Multi-character tokens**: Handles `==`, `!=`, `|>`, `>>`, `..`, `..=`, `#{`, etc.
- **String escape sequences**: Supports `\n`, `\t`, `\\`, `\"`, etc.
- **Comments**: Single-line `//` comments
- **Numeric literals**: Integers and decimals, with underscore separators (e.g., `1_000_000`)

## Parser

**Location:** `src/lang/src/parser/parser.ts`

The parser uses a Pratt parsing (top-down operator precedence) approach, which elegantly handles operator precedence and associativity.

### Pratt Parser Architecture

The parser associates each token type with:

1. **Precedence level** - Determines binding strength
2. **Prefix parser** - For tokens starting expressions (literals, unary operators)
3. **Infix parser** - For tokens between expressions (binary operators)

```typescript
type ExpressionParser = {
  [K in TokenKind]: {
    precedence: Precedence;
    prefix?: () => AST.Expression;
    infix?: (left: AST.Expression) => AST.Expression;
  };
};
```

### Precedence Levels

From lowest to highest binding:

| Level       | Operators/Constructs                |
| ----------- | ----------------------------------- |
| Lowest      | Default, dictionaries, sets         |
| AndOr       | `&&`, `\|\|`                        |
| Equals      | `==`, `!=`, `=`                     |
| Identifier  | Literals, `if`, `match`             |
| LessGreater | `<`, `>`, `<=`, `>=`                |
| Composition | `>>`, `\|>`, `..`, `..=`            |
| Sum         | `+`, `-`                            |
| Product     | `*`, `/`, `%`, backtick infix       |
| Call        | Function application `()`           |
| Prefix      | Unary `-`, `!`                      |
| Index       | Array/dict access `[]`              |

### AST Structure

**Location:** `src/lang/src/parser/ast.ts`

All AST nodes share common structure:

```typescript
type SourceLocation = { line: number; column: number };

// Example node types
type Program = {
  kind: ASTKind.Program;
  statements: Statement[];
  source: SourceLocation;
};

type FunctionLiteral = {
  kind: ASTKind.FunctionLiteral;
  parameters: Identifiable[];
  body: BlockStatement;
  source: SourceLocation;
};
```

Key node categories:

- **Statements**: `Let`, `Return`, `Break`, `Section`, `ExpressionStatement`
- **Expressions**: Literals, operators, function calls, match expressions
- **Patterns**: For destructuring and pattern matching

## Evaluator

**Location:** `src/lang/src/evaluator/evaluator.ts`

The evaluator is a recursive tree-walker using a visitor-like pattern.

### Main Entry Point

```typescript
function evaluate(node: AST.Node, environment: O.Environment): O.Obj {
  switch (node.kind) {
    case AST.ASTKind.Program:
      return evalProgram(node.statements, environment);
    case AST.ASTKind.Integer:
      return new O.Integer(node.value);
    case AST.ASTKind.FunctionLiteral:
      return new O.Func(node.parameters, node.body, new O.Environment(environment));
    // ... ~40 node types handled
  }
}
```

### Key Evaluation Functions

| Function                 | Purpose                                       |
| ------------------------ | --------------------------------------------- |
| `evalProgram`            | Evaluate top-level statements                 |
| `evalStatements`         | Execute statement blocks (handles TCO)        |
| `evalStatementsLoop`     | Inner loop for statement evaluation           |
| `evalExpressions`        | Evaluate argument lists                       |
| `evalCallExpression`     | Function/method invocation                    |
| `evalIfExpression`       | Conditional branching                         |
| `evalMatchExpression`    | Pattern matching                              |
| `evalInfixExpression`    | Binary operators (with short-circuit for &&/\|\|) |
| `applyFunction`          | Execute function body with extended environment |
| `extendFunctionEnv`      | Bind parameters to arguments                  |

### Short-Circuit Evaluation

Logical operators `&&` and `||` are special-cased to avoid evaluating the right operand unnecessarily:

```typescript
if (node.function.value === '&&') {
  const left = evaluate(node.arguments[0], environment);
  if (!left.isTruthy()) return O.FALSE;
  const right = evaluate(node.arguments[1], environment);
  return right.isTruthy() ? O.TRUE : O.FALSE;
}
```

## Object System

**Location:** `src/lang/src/evaluator/object/`

### Type Hierarchy

```typescript
// Base interface for all runtime values
interface Obj {
  inspect(): string;    // String representation
  isTruthy(): boolean;  // Boolean coercion
  getName(): string;    // Type name for errors
}

// Extended interface for hashable/comparable values
interface ValueObj extends Obj {
  hashCode(): number;   // For use as dict/set keys
  equals(that: Obj): boolean;
}
```

### Runtime Types

| Type           | TypeScript Class | Description                           |
| -------------- | ---------------- | ------------------------------------- |
| Integer        | `O.Integer`      | Arbitrary-precision integers          |
| Decimal        | `O.Decimal`      | Floating-point numbers                |
| String         | `O.Str`          | Unicode strings                       |
| Boolean        | `O.Bool`         | `true`/`false` (singleton instances)  |
| Nil            | `O.Nil`          | Null value (singleton `O.NIL`)        |
| List           | `O.List`         | Immutable sequence                    |
| Dictionary     | `O.Dictionary`   | Immutable key-value map               |
| Set            | `O.Set`          | Immutable unique collection           |
| Range          | `O.Range`        | Bounded/unbounded numeric range       |
| Sequence       | `O.Sequence`     | Lazy infinite sequence                |
| Function       | `O.Func`         | User-defined function (closure)       |
| BuiltinFunc    | `O.BuiltinFunc`  | Built-in function                     |
| Placeholder    | `O.Placeholder`  | `_` for partial application           |
| ReturnValue    | `O.ReturnValue`  | Control flow for `return` statements  |
| BreakValue     | `O.BreakValue`   | Control flow for `break` statements   |
| Section        | `O.Section`      | AoC runner section (part_one, etc.)   |

### Singleton Optimization

Common values are pre-allocated:

```typescript
export const TRUE = new Bool(true);
export const FALSE = new Bool(false);
export const NIL = new Nil();
export const PLACEHOLDER = new Placeholder();
```

## Immutable.js Integration

**Critical Architecture Decision**

Prancer uses [Immutable.js](https://immutable-js.com/) for all collection types. This provides:

1. **Structural sharing** - Efficient memory use when deriving new collections
2. **Persistent data structures** - Original collections unchanged when modified
3. **Lazy sequences** - Infinite ranges and deferred computation
4. **Built-in hash/equality** - Proper value semantics for dict/set keys

### Collection Wrappers

Each collection type wraps an Immutable.js structure:

```typescript
class List implements ValueObj {
  public items: Immutable.List<Obj>;

  constructor(items: Iterable<Obj> | ArrayLike<Obj>) {
    this.items = Immutable.List(items);
  }

  // Delegate operations to Immutable.js
  public get(index: Obj): Obj {
    if (index instanceof Integer) {
      return this.items.get(index.value) || NIL;
    }
    if (index instanceof Range) {
      return new List(this.items.slice(index.start, index.end));
    }
  }
}
```

### Mutable/Immutable Duality

Collections can be temporarily made mutable for performance-critical operations:

```typescript
class List {
  public asMutable() {
    return new List(this.items.asMutable());
  }

  public asImmutable() {
    return new List(this.items.asImmutable());
  }

  public isImmutable(): boolean {
    return !this.items.__ownerID;  // Immutable.js internal check
  }
}
```

Built-in functions enforce mutability expectations:

- `push(value, list)` - Requires immutable input
- `push!(value, list)` - Requires mutable input (note the `!` suffix)

### Lazy Sequences

Ranges and sequences leverage Immutable.js's lazy evaluation:

```typescript
class Range {
  static fromExclusiveRange(start: number, end: number, step: number) {
    return new Range(
      start, end,
      Immutable.Range(start, end, step).map(v => new Integer(v)),
      false
    );
  }
}

class Sequence {
  static iterate(fn: (previous: Obj) => Obj, initial: Obj) {
    return new Sequence(
      Immutable.Seq(function* () {
        let current = initial;
        while (true) {
          yield current;
          current = fn(current);
        }
      }())
    );
  }
}
```

This enables infinite sequences like `1..` or `iterate(_ + 1, 0)` that only compute values on demand.

## Environment

**Location:** `src/lang/src/evaluator/object/environment.ts`

The environment manages variable bindings with lexical scoping.

### Structure

```typescript
class Environment {
  sections: { [key: string]: Section[] };
  variables: { [key: string]: { value: Obj; isMutable: boolean } };
  io?: IO;
  parent: Environment | null;

  // Variable operations
  getVariable(name: string): Obj | undefined;
  declareVariable(name: string, value: Obj, isMutable: boolean): Obj;
  setVariable(name: string, value: Obj): Obj;

  // Section operations (for AoC runner)
  addSection(name: string, value: Section): Section;
  getSection(name: string): Section[];

  // I/O operations
  setIO(io: IO): void;
  getIO(): IO;
}
```

### Lexical Scoping

The parent chain enables nested scopes:

```typescript
getVariable(name: string): Obj | undefined {
  const value = this.variables[name];
  if (value) return value.value;
  if (this.parent) return this.parent.getVariable(name);
  return undefined;
}
```

### IO Interface

Runtime-specific I/O is injected via the `IO` interface:

```typescript
type IO = {
  input: (path: string) => string;   // Read file/URL/AoC input
  output: (args: string[]) => void;  // Print to stdout
};
```

## Tail Call Optimization (TCO)

Prancer implements TCO via trampolining to prevent stack overflow in recursive functions.

### Detection

Tail calls are detected in `evalStatementsLoop()`:

```typescript
// Explicit return in tail position
if (statement.kind === AST.ASTKind.Return &&
    statement.returnValue.kind === AST.ASTKind.CallExpression) {
  const fn = evaluate(statement.returnValue.function, environment);
  if (fn instanceof O.Func) {
    return new O.TailCallFunc(fn.parameters, fn.body, extendedEnv);
  }
}

// Implicit return (last expression)
if (i === statements.length - 1 &&
    statement.kind === AST.ASTKind.ExpressionStatement &&
    statement.expression.kind === AST.ASTKind.CallExpression) {
  // Same treatment
}
```

### Trampolining Loop

Instead of recursing, `TailCallFunc` is returned and processed in a loop:

```typescript
const evalStatements = (statements: AST.Statement[], environment: O.Environment): O.Obj => {
  let result = evalStatementsLoop(statements, environment);

  // Trampoline: keep processing tail calls until we get a real result
  while (result instanceof O.TailCallFunc) {
    result = evalStatementsLoop(result.body.statements, result.environment);
  }

  return result;
};
```

This transforms recursive stack frames into loop iterations, enabling arbitrary recursion depth.

## Built-in Functions

**Location:** `src/lang/src/evaluator/builtins/`

### Module Organization

| Module              | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `collection.ts`     | List/Dict/Set operations                 |
| `comparision.ts`    | Equality and comparison operators        |
| `math.ts`           | Mathematical operations                  |
| `primitive.ts`      | String/type operations                   |
| `io.ts`             | I/O functions (puts, read)               |
| `evaluate.ts`       | Runtime evaluation                       |

### BuiltinFuncTemplate Pattern

Built-ins use a declarative pattern:

```typescript
type BuiltinFuncTemplate = {
  parameters: AST.Identifiable[];
  body: (environment: Environment) => Obj;
};

const map: BuiltinFuncTemplate = {
  parameters: [
    { kind: AST.ASTKind.Identifier, value: 'mapper' },
    { kind: AST.ASTKind.Identifier, value: 'collection' },
  ],
  body: (environment: Environment) => {
    const mapper = environment.getVariable('mapper');
    const passKey = mapper.parameters.length >= 2;  // Smart arity detection
    return environment.getVariable('collection')
      .map((v, k) => applyFunction(mapper, passKey ? [v, k] : [v]));
  },
};
```

### Smart Callback Application

Built-ins inspect callback arity to optionally pass additional context:

```typescript
// If mapper expects 2+ args, pass both value and key/index
const passKey = (mapper instanceof O.Func || mapper instanceof O.BuiltinFunc)
  && mapper.parameters.length >= 2;
```

This allows both:

- `map(_ * 2, [1, 2, 3])` - Simple transformation
- `map(|v, i| v + i, [1, 2, 3])` - Access to index

### Partial Application

Functions support automatic currying via placeholders:

```typescript
const evalCallExpression = (node, environment) => {
  const fn = evaluate(node.function, environment);
  const args = evalExpressions(node.arguments, environment);
  const hasPlaceholder = args.some(arg => arg instanceof O.Placeholder);

  // Partial application when not all args provided
  if (fn instanceof O.Func && (args.length < fn.parameters.length || hasPlaceholder)) {
    const { environment, parameters } = extendFunctionEnv(fn, args);
    return new O.Func(parameters, fn.body, environment);
  }
  // Full application
  return applyFunction(fn, args);
};
```

## Multi-Runtime Architecture

Prancer targets multiple runtime environments from a shared language core.

### Project Structure

```
src/
├── lang/           # Core language (lexer, parser, evaluator, builtins)
├── cli/            # Command-line interface
├── web/            # Browser-based editor (Next.js)
└── lambda/         # AWS Lambda runtime
```

### CLI Runtime

**Location:** `src/cli/src/index.ts`

The CLI provides:

- **File execution**: `santa-cli solution.santa`
- **Inline evaluation**: `santa-cli -e '1 + 2'`
- **Test runner**: `santa-cli -t solution.santa`
- **REPL**: `santa-cli -r`
- **Output formats**: text (default), JSON, JSONL (streaming)
- **Stdin support**: `cat file | santa-cli`

#### CLI I/O Implementation

```typescript
const io = {
  input: (path: string) => {
    // Handle aoc:// URLs for puzzle input
    if (path.startsWith('aoc://')) {
      const url = buildAocUrl(path);
      return fetchWithSession(url);
    }
    // Handle http/https URLs
    if (path.startsWith('http')) {
      return fetch(path).then(r => r.text());
    }
    // Local file
    return readFileSync(path, { encoding: 'utf-8' });
  },
  output: (args: string[]) => console.log(...args),
};
```

### Web Runtime

**Location:** `src/web/`

A Next.js 12.x application providing an in-browser editor with:

- **Web Worker evaluation**: Non-blocking execution
- **CodeMirror editor**: Syntax highlighting
- **Live output**: Results displayed in real-time

#### Worker Architecture

```typescript
// worker.ts - runs in Web Worker
addEventListener('message', event => {
  const request = event.data as Request;
  try {
    switch (request.type) {
      case 'run':
        postMessage({ type: 'run', result: run(event.data.source, io) });
        return;
      case 'test':
        postMessage({ type: 'test', testCases: runTests(event.data.source, io) });
        return;
    }
  } catch (error) {
    postMessage({ type: request.type, error });
  }
});
```

#### Web I/O Implementation

```typescript
const io = {
  input: (path: string): string => {
    // Convert aoc:// to GitHub raw URL
    if (path.startsWith('aoc://')) {
      // Format: aoc://YEAR/DAY -> fetches cached puzzle input
      path = `https://raw.githubusercontent.com/eddmann/advent-of-code/master/${year}/santa-lang/aoc${year}_day${day}.input`;
    }
    // Synchronous XMLHttpRequest (Web Worker allows this)
    const request = new XMLHttpRequest();
    request.open('GET', path, false);
    request.send(null);
    return request.responseText.trimEnd();
  },
  output: (args: string[]) => console.log(...args),
};
```

### Lambda Runtime

**Location:** `src/lambda/src/index.ts`

Custom AWS Lambda runtime implementing the Lambda Runtime API:

```typescript
async function start() {
  const handler = getHandler();  // Parse santa-lang file and extract handler section

  while (true) {
    const { event, context } = await nextInvocation();
    try {
      const result = await handler(event, context);
      await invokeResponse(result, context);
    } catch (e) {
      await invokeError(e, context);
    }
  }
}
```

#### Event Encoding

Lambda events (JSON) are converted to/from santa-lang objects:

```typescript
// encode.ts
function encode(value: any): O.Obj {
  if (typeof value === 'number') return new O.Integer(value);
  if (typeof value === 'string') return new O.Str(value);
  if (Array.isArray(value)) return new O.List(value.map(encode));
  // ...
}

function decode(obj: O.Obj): any {
  if (obj instanceof O.Integer) return obj.value;
  if (obj instanceof O.Str) return obj.value;
  if (obj instanceof O.List) return obj.items.map(decode);
  // ...
}
```

## Build System

**Location:** `Makefile`

Prancer uses a Docker-based build system with Bun for reproducible builds.

### Build Commands

| Target           | Description                             |
| ---------------- | --------------------------------------- |
| `make lang/test` | Run language core tests                 |
| `make cli/test`  | Run CLI tests                           |
| `make cli/build` | Build CLI binaries for all platforms    |
| `make web/build` | Build Next.js web application           |
| `make lambda/build` | Build Lambda layer                   |

### Cross-Platform CLI Builds

The CLI is compiled to standalone binaries using Bun's compile feature:

- Linux x86_64 (`linux-amd64`)
- Linux ARM64 (`linux-arm64`)
- macOS Intel (`macos-amd64`)
- macOS Apple Silicon (`macos-arm64`)

### Monorepo Structure

Bun workspaces manage the multi-package structure:

```json
// package.json (root or lang)
{
  "workspaces": ["src/lang", "src/cli", "src/web", "src/lambda"]
}
```

## Error Handling

### Parser Errors

```typescript
class ParserError extends Error {
  constructor(message: string, public token: Token) {
    super(message);
  }
}
```

Parser errors include token position for precise error reporting.

### Runtime Errors

The `O.Err` type represents runtime errors with source location:

```typescript
class Err implements Obj {
  constructor(
    public message: string,
    public node: AST.Node
  ) {}

  get line() { return this.node.source?.line ?? 0; }
  get column() { return this.node.source?.column ?? 0; }
}
```

### Error Propagation

Errors bubble up through evaluation:

```typescript
const result = evaluate(node, environment);
if (result instanceof O.Err) {
  return result;  // Propagate error
}
```

## Performance Considerations

### Strengths

1. **Simple mental model**: Direct AST interpretation is easy to understand and debug
2. **Immutable by default**: Eliminates mutation bugs
3. **Structural sharing**: Efficient memory use for persistent data
4. **Lazy evaluation**: Infinite sequences don't consume infinite memory

### Limitations

1. **No compilation**: Every execution re-parses and re-traverses the AST
2. **Interpreter overhead**: Each AST node requires a function call
3. **No JIT**: Cannot optimize hot paths at runtime

### Optimization Opportunities

1. **TCO**: Enables efficient recursion
2. **Mutable collections**: Opt-in mutability for performance-critical code
3. **Lazy sequences**: Deferred computation avoids unnecessary work

## Testing

### Test Locations

- `src/lang/src/lexer/lexer.test.ts` - Lexer tests
- `src/lang/src/parser/parser.test.ts` - Parser tests
- `src/lang/src/evaluator/evaluator.test.ts` - Evaluator tests
- `src/lang/src/evaluator/builtins/*.test.ts` - Built-in function tests
- `src/cli/src/cli.test.ts` - CLI integration tests

### Running Tests

```bash
make lang/test    # Core language tests
make cli/test     # CLI tests
```

## Further Reading

- [santa-lang Documentation](https://eddmann.com/santa-lang/) - Language reference
- [Immutable.js Documentation](https://immutable-js.com/) - Collection library
- [Pratt Parsing](https://journal.stuffwithstuff.com/2011/03/19/pratt-parsers-expression-parsing-made-easy/) - Parser technique
