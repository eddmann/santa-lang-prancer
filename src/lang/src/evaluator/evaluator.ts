import { AST } from '../parser';
import O from './object';
import builtins from './builtins';

const isError = (object: O.Obj): object is O.Err => {
  return object instanceof O.Err;
};

const evalProgram = (statements: AST.Statement[], environment: O.Environment): O.Obj => {
  let result: O.Obj = O.NIL;

  for (const statement of statements) {
    if (statement.kind === AST.ASTKind.CommentStatement) {
      continue;
    }

    result = evaluate(statement, environment);

    if (result instanceof O.Err) {
      return result;
    }

    if (result instanceof O.ReturnValue) {
      return result.value;
    }
  }

  return result;
};

const evalExpressions = (expressions: AST.Expression[], environment: O.Environment): O.Obj[] => {
  const result: O.Obj[] = [];

  for (const expression of expressions) {
    const evaluated = evaluate(expression, environment);

    if (isError(evaluated)) {
      return [evaluated];
    }

    if (expression.kind === AST.ASTKind.SpreadElement) {
      if (!(evaluated instanceof O.List)) {
        throw new Error(`Expected ${AST.ASTKind.SpreadElement} to be a list`);
      }

      result.push(...evaluated.items);
      continue;
    }

    result.push(evaluated);
  }

  return result;
};

const evalListExpression = (
  node: AST.ListExpression,
  environment: O.Environment
): O.List | O.Err => {
  const elements = evalExpressions(node.elements, environment);

  const first = elements[0];
  if (isError(first)) {
    return first;
  }

  return new O.List(elements);
};

const evalDictionaryExpression = (
  node: AST.DictionaryExpression,
  environment: O.Environment
): O.Dictionary | O.Err => {
  const pairs: [O.Obj, O.Obj][] = [];

  for (const pair of node.pairs) {
    const evaluatedPair = evalExpressions(pair, environment) as [O.Obj, O.Obj];

    const first = evaluatedPair[0];
    if (isError(first)) {
      return first;
    }

    pairs.push(evaluatedPair);
  }

  return new O.Dictionary(pairs);
};

const evalSetExpression = (node: AST.SetExpression, environment: O.Environment): O.Set | O.Err => {
  const elements = evalExpressions(node.elements, environment);

  const first = elements[0];
  if (isError(first)) {
    return first;
  }

  return new O.Set(elements);
};

const evalRangeExpression = (
  node: AST.RangeExpression,
  environment: O.Environment
): O.Range | O.Err => {
  const start = evaluate(node.start, environment);
  if (isError(start)) {
    return start;
  }

  if (!(start instanceof O.Integer)) {
    return new O.Err('Expected range start value to be an integer', node);
  }

  const end = evaluate(node.end, environment);
  if (isError(end)) {
    return end;
  }

  if (!(end instanceof O.Integer)) {
    return new O.Err('Expected range end value to be an integer', node);
  }

  if (node.isInclusive) {
    return O.Range.fromInclusiveRange(start.value, end.value, 1);
  }

  return O.Range.fromExclusiveRange(start.value, end.value, 1);
};

const evalIdentifier = (node: AST.Identifier, environment: O.Environment): O.Obj => {
  const value = environment.getVariable(node.value);
  if (value) {
    return value;
  }

  const builtin = builtins[node.value];
  if (builtin) {
    return new O.BuiltinFunc(builtin.parameters, builtin.body, environment);
  }

  return new O.Err(`Identifier not found: ${node.value}`, node);
};

const evalStatements = (statements: AST.Statement[], environment: O.Environment): O.Obj => {
  let result = evalStatementsLoop(statements, environment);

  while (result instanceof O.TailCallFunc) {
    result = evalStatementsLoop(result.body.statements, result.environment);
  }

  return result;
};

const evalStatementsLoop = (statements: AST.Statement[], environment: O.Environment): O.Obj => {
  let result: O.Obj = O.NIL;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    if (statement.kind === AST.ASTKind.CommentStatement) {
      continue;
    }

    // handle tail-recursive `return` statements
    if (
      statement.kind === AST.ASTKind.Return &&
      statement.returnValue.kind === AST.ASTKind.CallExpression
    ) {
      const fn = evaluate(statement.returnValue.function, environment);

      if (fn instanceof O.Func) {
        return new O.TailCallFunc(
          fn.parameters,
          fn.body,
          extendFunctionEnv(
            fn,
            evalExpressions(statement.returnValue.arguments, environment)
          ).environment
        );
      }
    }

    // handle tail-recursive end statements
    if (
      i == statements.length - 1 &&
      statement.kind === AST.ASTKind.ExpressionStatement &&
      statement.expression.kind === AST.ASTKind.CallExpression
    ) {
      const fn = evaluate(statement.expression.function, environment);

      if (fn instanceof O.Func) {
        return new O.TailCallFunc(
          fn.parameters,
          fn.body,
          extendFunctionEnv(
            fn,
            evalExpressions(statement.expression.arguments, environment)
          ).environment
        );
      }
    }

    result = evaluate(statement, environment);

    if (
      result instanceof O.Err ||
      result instanceof O.ReturnValue ||
      result instanceof O.BreakValue
    ) {
      return result;
    }
  }

  return result;
};

const evalIfExpression = (node: AST.IfExpression, environment: O.Environment): O.Obj => {
  const condition = evaluate(node.condition, environment);

  if (isError(condition)) {
    return condition;
  }

  if (condition.isTruthy()) {
    return evalStatements(node.consequence.statements, environment);
  }

  if (node.alternative) {
    return evalStatements(node.alternative.statements, environment);
  }

  return O.NIL;
};

const evalCallExpression = (node: AST.CallExpression, environment: O.Environment): O.Obj => {
  const fn = evaluate(node.function, environment);

  if (isError(fn)) {
    return fn;
  }

  const args = evalExpressions(node.arguments, environment);
  if (isError(args[0])) {
    return args[0];
  }

  const hasPlaceholder = args.some(arg => arg instanceof O.Placeholder);

  if (fn instanceof O.Func && (args.length < fn.parameters.length || hasPlaceholder)) {
    const { environment, parameters } = extendFunctionEnv(fn, args);
    return new O.Func(parameters, fn.body, environment);
  }

  if (fn instanceof O.BuiltinFunc && (args.length < fn.parameters.length || hasPlaceholder)) {
    const { environment, parameters } = extendFunctionEnv(fn, args);
    return new O.BuiltinFunc(parameters, fn.body, environment);
  }

  return applyFunction(fn, args);
};

const extendFunctionEnv = (
  fn: O.Func | O.BuiltinFunc,
  args: O.Obj[]
): { environment: O.Environment; parameters: AST.Identifiable[] } | O.Err => {
  const environment = new O.Environment(fn.environment);
  const parameters = fn.parameters;

  const placeholderParams: AST.Identifiable[] = [];

  for (let i = 0; i < Math.min(parameters.length, args.length); i++) {
    if (parameters[i].kind === AST.ASTKind.Placeholder) {
      continue;
    }

    if (args[i] instanceof O.Placeholder) {
      placeholderParams.push(parameters[i]);
      continue;
    }

    if (parameters[i].kind === AST.ASTKind.Identifier) {
      environment.declareVariable(parameters[i].value, args[i], false);
      continue;
    }

    if (parameters[i].kind === AST.ASTKind.ListDestructurePattern) {
      destructureListPatternIntoEnv(parameters[i], false, args[i], environment);
      continue;
    }

    if (parameters[i].kind === AST.ASTKind.RestElement) {
      environment.declareVariable(parameters[i].argument.value, new O.List(args.slice(i)), false);
      break;
    }

    throw new Error(`Unable to parse parameter: ${parameters[i].kind}`);
  }

  return { environment, parameters: [...placeholderParams, ...parameters.slice(args.length)] };
};

const unwrapReturnValue = (obj: O.Obj): O.Obj => (obj instanceof O.ReturnValue ? obj.value : obj);

export const applyFunction = (fn: O.Obj, args: O.Obj[]): O.Obj => {
  if (fn instanceof O.Func) {
    const { environment } = extendFunctionEnv(fn, args);
    const evaluated = evaluate(fn.body, environment);
    return unwrapReturnValue(evaluated);
  }

  if (fn instanceof O.BuiltinFunc) {
    const { environment } = extendFunctionEnv(fn, args);
    return fn.body(environment);
  }

  throw new Error(`Not a function: ${fn.inspect()}`);
};

const evalInfixExpression = (node: AST.InfixExpression, environment: O.Environment): O.Obj => {
  // Short-circuit evaluation for && and ||
  if (node.function.value === '&&') {
    const left = evaluate(node.arguments[0], environment);
    if (isError(left)) return left;
    if (!left.isTruthy()) return O.FALSE;
    const right = evaluate(node.arguments[1], environment);
    if (isError(right)) return right;
    return right.isTruthy() ? O.TRUE : O.FALSE;
  }

  if (node.function.value === '||') {
    const left = evaluate(node.arguments[0], environment);
    if (isError(left)) return left;
    if (left.isTruthy()) return O.TRUE;
    const right = evaluate(node.arguments[1], environment);
    if (isError(right)) return right;
    return right.isTruthy() ? O.TRUE : O.FALSE;
  }

  const fn = evaluate(node.function, environment);

  if (isError(fn)) {
    return fn;
  }

  const args = evalExpressions(node.arguments, environment);
  if (isError(args[0])) {
    return args[0];
  }

  const hasPlaceholder = args.some(arg => arg instanceof O.Placeholder);

  if (fn instanceof O.Func && (args.length < fn.parameters.length || hasPlaceholder)) {
    const { environment, parameters } = extendFunctionEnv(fn, args);
    return new O.Func(parameters, fn.body, environment);
  }

  if (fn instanceof O.BuiltinFunc && (args.length < fn.parameters.length || hasPlaceholder)) {
    const { environment, parameters } = extendFunctionEnv(fn, args);
    return new O.BuiltinFunc(parameters, fn.body, environment);
  }

  return applyFunction(fn, args);
};

const evalPrefixExpression = (node: AST.PrefixExpression, environment: O.Environment): O.Obj => {
  const fn = evaluate(node.function, environment);
  if (isError(fn)) {
    return fn;
  }

  const arg = evaluate(node.argument, environment);
  if (isError(arg)) {
    return arg;
  }

  return applyFunction(fn, [arg]);
};

const evalMatchExpression = (node: AST.MatchExpression, environment: O.Environment): O.Obj => {
  const subject = evaluate(node.subject, environment);

  if (isError(subject)) {
    return subject;
  }

  for (const case_ of node.cases) {
    if (case_.pattern.kind === AST.ASTKind.Identifier) {
      const matchEnvironment = new O.Environment(environment);
      matchEnvironment.declareVariable(case_.pattern.value, subject, false);

      if (case_.guard) {
        const result = evaluate(case_.guard, matchEnvironment);
        if (isError(result)) return result;
        if (!result.isTruthy()) continue;
      }

      return evaluate(case_.consequence, matchEnvironment);
    }

    if (case_.pattern.kind === AST.ASTKind.Placeholder) {
      const matchEnvironment = new O.Environment(environment);

      if (case_.guard) {
        const result = evaluate(case_.guard, matchEnvironment);
        if (isError(result)) return result;
        if (!result.isTruthy()) continue;
      }

      return evaluate(case_.consequence, matchEnvironment);
    }

    if (case_.pattern.kind === AST.ASTKind.ListMatchPattern) {
      try {
        const matchEnvironment = new O.Environment(environment);
        matchListPatternIntoEnv(case_.pattern, subject, matchEnvironment);

        if (case_.guard) {
          const result = evaluate(case_.guard, matchEnvironment);
          if (isError(result)) return result;
          if (!result.isTruthy()) continue;
        }

        return evaluate(case_.consequence, matchEnvironment);
      } catch (err) {
        if (err instanceof NoPatternMatchError) {
          continue;
        }

        if (isError(err)) {
          return err;
        }

        throw err;
      }

      continue;
    }

    const value = evaluate(case_.pattern, environment);

    if (isError(value)) return value;

    if (value instanceof O.Range) {
      if (!value.includes(subject).value) {
        continue;
      }
    } else if (!subject.equals(value)) continue;

    const matchEnvironment = new O.Environment(environment);

    if (case_.guard) {
      const result = evaluate(case_.guard, matchEnvironment);
      if (isError(result)) return result;
      if (!result.isTruthy()) continue;
    }

    return evaluate(case_.consequence, matchEnvironment);
  }

  return O.NIL;
};

const evalIndexExpression = (node: AST.IndexExpression, environment: O.Environment): O.Obj => {
  const item = evaluate(node.item, environment);
  if (isError(item)) {
    return item;
  }

  if (!item.get) {
    return new O.Err('This value is not indexable', node);
  }

  const index = evaluate(node.index, environment);
  if (isError(index)) {
    return index;
  }

  return item.get(index);
};

const evalFunctionThread = (node: AST.FunctionThread, environment: O.Environment): O.Obj => {
  let value = evaluate(node.initial, environment);
  if (isError(value)) {
    return value;
  }

  for (const fn of node.functions) {
    const fnResult = evaluate(fn, environment);
    if (isError(fnResult)) {
      return fnResult;
    }

    value = applyFunction(fnResult, [value]);
    if (isError(value)) {
      return value;
    }
  }

  return value;
};

const evalFunctionComposition = (
  node: AST.FunctionComposition,
  environment: O.Environment
): O.Obj =>
  new O.BuiltinFunc(
    [
      {
        kind: AST.ASTKind.Identifier,
        value: 'a',
      },
    ],
    (environment: O.Environment) => {
      let value = environment.getVariable('a');

      for (const fn of node.functions) {
        const fnResult = evaluate(fn, environment);
        if (isError(fnResult)) {
          return fnResult;
        }

        value = applyFunction(fnResult, [value]);
        if (isError(value)) {
          return value;
        }
      }

      return value;
    },
    environment
  );

const destructureListPatternIntoEnv = (
  { elements }: AST.ListDestructurePattern,
  isMutable: boolean,
  value: O.List,
  environment: O.Environment
): O.Err | O.List => {
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].kind === AST.ASTKind.Placeholder) {
      continue;
    }

    if (elements[i].kind === AST.ASTKind.Identifier) {
      environment.declareVariable(elements[i].value, value.get(new O.Integer(i)), isMutable);
      continue;
    }

    if (elements[i].kind === AST.ASTKind.ListDestructurePattern) {
      destructureListPatternIntoEnv(
        elements[i],
        isMutable,
        value.get(new O.Integer(i)),
        environment
      );
      continue;
    }

    if (elements[i].kind === AST.ASTKind.RestElement) {
      environment.declareVariable(
        elements[i].argument.value,
        value.get(O.Range.fromExclusiveRange(i, Infinity, 1)),
        isMutable
      );
      break;
    }

    throw new Error(`Unable to destructure list item: ${elements[i].kind}`);
  }

  return value;
};

class NoPatternMatchError extends Error {}

const matchSinglePattern = (
  pattern: AST.Node,
  value: O.Obj,
  environment: O.Environment
): void => {
  if (pattern.kind === AST.ASTKind.Placeholder) {
    return;
  }

  if (pattern.kind === AST.ASTKind.Identifier) {
    environment.declareVariable(pattern.value, value, false);
    return;
  }

  if (pattern.kind === AST.ASTKind.ListMatchPattern) {
    matchListPatternIntoEnv(pattern, value, environment);
    return;
  }

  const literal = evaluate(pattern, environment);

  if (isError(literal)) {
    throw new Error(literal);
  }

  if (literal instanceof O.Range && literal.includes(value).value) return;
  else if (value.equals(literal)) return;

  throw new NoPatternMatchError();
};

const matchListPatternIntoEnv = (
  { elements }: AST.ListMatchPattern,
  value: O.Obj,
  environment: O.Environment
): void => {
  if (!(value instanceof O.List)) {
    throw new NoPatternMatchError();
  }

  if (elements.length === 0 && value.items.size === 0) {
    return;
  }

  if (elements.length === 0 && value.items.size > 0) {
    throw new NoPatternMatchError();
  }

  if (elements.length > 0 && value.items.size === 0) {
    throw new NoPatternMatchError();
  }

  // Find the rest element position (if any)
  const restIndex = elements.findIndex(el => el.kind === AST.ASTKind.RestElement);

  if (restIndex === -1) {
    // No rest pattern - exact match required
    if (elements.length !== value.items.size) {
      throw new NoPatternMatchError();
    }

    for (let i = 0; i < elements.length; i++) {
      matchSinglePattern(elements[i], value.get(new O.Integer(i)), environment);
    }
    return;
  }

  // Rest pattern exists - calculate how many elements go before and after
  const patternsBefore = restIndex;
  const patternsAfter = elements.length - restIndex - 1;
  const minRequired = patternsBefore + patternsAfter;

  if (value.items.size < minRequired) {
    throw new NoPatternMatchError();
  }

  // Match patterns before the rest
  for (let i = 0; i < patternsBefore; i++) {
    matchSinglePattern(elements[i], value.get(new O.Integer(i)), environment);
  }

  // Match patterns after the rest (from the end)
  const valueSize = value.items.size;
  for (let i = 0; i < patternsAfter; i++) {
    const patternIdx = restIndex + 1 + i;
    const valueIdx = valueSize - patternsAfter + i;
    matchSinglePattern(elements[patternIdx], value.get(new O.Integer(valueIdx)), environment);
  }

  // Bind the rest element to remaining middle elements
  const restElement = elements[restIndex] as AST.RestElement;
  const restStart = patternsBefore;
  const restEnd = valueSize - patternsAfter;
  environment.declareVariable(
    restElement.argument.value,
    value.get(O.Range.fromExclusiveRange(restStart, restEnd, 1)),
    false
  );
};

export const evaluate = (node: AST.Node, environment: O.Environment): O.Obj => {
  try {
    switch (node.kind) {
      case AST.ASTKind.Program:
        return evalProgram(node.statements, environment);

      case AST.ASTKind.Section:
        return environment.addSection(
          node.name.value,
          new O.Section(node.name, node.section, new O.Environment(environment), node.attributes)
        );

      case AST.ASTKind.Integer:
        return new O.Integer(node.value);

      case AST.ASTKind.Decimal:
        return new O.Decimal(node.value);

      case AST.ASTKind.Bool:
        return node.value ? O.TRUE : O.FALSE;

      case AST.ASTKind.Str:
        return new O.Str(node.value);

      case AST.ASTKind.Placeholder:
        return O.PLACEHOLDER;

      case AST.ASTKind.Nil:
        return O.NIL;

      case AST.ASTKind.ListExpression:
        return evalListExpression(node, environment);

      case AST.ASTKind.DictionaryExpression:
        return evalDictionaryExpression(node, environment);

      case AST.ASTKind.SetExpression:
        return evalSetExpression(node, environment);

      case AST.ASTKind.RangeExpression:
        return evalRangeExpression(node, environment);

      case AST.ASTKind.IndexExpression:
        return evalIndexExpression(node, environment);

      case AST.ASTKind.FunctionLiteral:
        return new O.Func(node.parameters, node.body, new O.Environment(environment));

      case AST.ASTKind.Return: {
        const value = evaluate(node.returnValue, environment);
        return isError(value) ? value : new O.ReturnValue(value);
      }

      case AST.ASTKind.Break: {
        const value = node.value ? evaluate(node.value, environment) : O.NIL;
        return isError(value) ? value : new O.BreakValue(value);
      }

      case AST.ASTKind.Let: {
        const value = evaluate(node.value, environment);

        if (isError(value)) {
          return value;
        }

        if (node.name.kind === AST.ASTKind.ListDestructurePattern) {
          return destructureListPatternIntoEnv(node.name, node.isMutable, value, environment);
        }

        if (value instanceof O.Func) {
          value.environment.declareVariable(node.name.value, value, false);
        }

        return environment.declareVariable(node.name.value, value, node.isMutable);
      }

      case AST.ASTKind.Assignment: {
        const value = evaluate(node.value, environment);

        if (isError(value)) {
          return value;
        }

        return environment.setVariable(node.name.value, value);
      }

      case AST.ASTKind.Identifier:
        return evalIdentifier(node, environment);

      case AST.ASTKind.BlockStatement:
        return evalStatements(node.statements, environment);

      case AST.ASTKind.ExpressionStatement:
        return evaluate(node.expression, environment);

      case AST.ASTKind.IfExpression:
        return evalIfExpression(node, environment);

      case AST.ASTKind.CallExpression:
        return evalCallExpression(node, environment);

      case AST.ASTKind.InfixExpression:
        return evalInfixExpression(node, environment);

      case AST.ASTKind.PrefixExpression:
        return evalPrefixExpression(node, environment);

      case AST.ASTKind.MatchExpression:
        return evalMatchExpression(node, environment);

      case AST.ASTKind.FunctionThread:
        return evalFunctionThread(node, environment);

      case AST.ASTKind.FunctionComposition:
        return evalFunctionComposition(node, environment);

      case AST.ASTKind.SpreadElement:
        return evaluate(node.value, environment);

      default:
        return new O.Err(`Unknown node type: ${node.kind}`, node);
    }
  } catch (err) {
    return new O.Err(err.message, node);
  }
};
