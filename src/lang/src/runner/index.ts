import { Lexer } from '../lexer';
import { AST, Parser } from '../parser';
import { O, evaluate } from '../evaluator';

const unwrapReturnValue = (obj: O.Obj): O.Obj => (obj instanceof O.ReturnValue ? obj.value : obj);

const evaluateNode = (node: AST.Node, environment: O.Environment): O.Obj =>
  unwrapReturnValue(evaluate(node, environment));

const evaluateSection = (
  section: O.Section,
  environment: O.Enviornment,
  input: O.Obj | null = null
): O.Obj => {
  const sectionEnvironment = new O.Environment(environment);

  if (input) {
    sectionEnvironment.declareVariable('input', input, false);
  }

  const result = evaluateNode(section.section, sectionEnvironment);

  if (result instanceof O.Err) {
    throw {
      message: result.inspect(),
      line: result.node.source.line,
      column: result.node.source.column,
    };
  }

  return result;
};

const evaluateSource = (
  source: string,
  io: O.IO
): {
  environment: O.Enviornment;
  result: O.Obj;
  partOne?: O.Section;
  partTwo?: O.Section;
} => {
  const lexer = new Lexer(source);

  let ast: AST.Program;
  try {
    ast = new Parser(lexer).parse();
  } catch (err) {
    throw {
      message: `Parser error: ${err.message}`,
      line: err.token.line,
      column: err.token.column,
    };
  }

  const environment = new O.Environment();
  environment.setIO(io);

  const result = evaluateNode(ast, environment);
  if (result instanceof O.Err) {
    throw {
      message: result.inspect(),
      line: result.node.source.line,
      column: result.node.source.column,
    };
  }

  const partOne = environment.getSection('part_one');
  const partTwo = environment.getSection('part_two');

  if (partOne.length === 0 && partTwo.length === 0) {
    return { environment, result };
  }

  if (partOne.length > 1) {
    throw {
      message: 'Runtime error: Expected a single `part_one` section',
      line: partOne[1].name.source.line,
      column: partOne[1].name.source.column,
    };
  }

  if (partTwo.length > 1) {
    throw {
      message: 'Runtime error: Expected a single `part_two` section',
      line: partTwo[1].name.source.line,
      column: partTwo[1].name.source.column,
    };
  }

  return {
    environment,
    result,
    partOne: partOne.length === 1 ? partOne[0] : undefined,
    partTwo: partTwo.length === 1 ? partTwo[0] : undefined,
  };
};

type ResultValue = {
  value: string;
  duration: number;
};

type Result =
  | {
      partOne?: ResultValue;
      partTwo?: ResultValue;
    }
  | ResultValue;

export const run = (source: string, io: O.IO): Result => {
  const start = new Date().getTime();

  const { environment, result, partOne, partTwo } = evaluateSource(source, io);

  if (!partOne && !partTwo) {
    return { value: result.inspect(), duration: new Date().getTime() - start };
  }

  const input = environment.getSection('input');
  if (input.length > 1) {
    throw {
      message: 'Runtime error: Expected a single `input` section',
      line: input[1].name.source.line,
      column: input[1].name.source.column,
    };
  }

  const inputResult = input.length === 1 ? evaluateNode(input[0].section, environment) : null;
  if (inputResult instanceof O.Err) {
    throw {
      message: inputResult.inspect(),
      line: inputResult.node.source.line,
      column: inputResult.node.source.column,
    };
  }

  let partOneResult: ResultValue | undefined;
  if (partOne) {
    const start = new Date().getTime();
    const value = evaluateSection(partOne, environment, inputResult).inspect();
    partOneResult = {
      value,
      duration: new Date().getTime() - start,
    };
  }

  let partTwoResult: ResultValue | undefined;
  if (partTwo) {
    const start = new Date().getTime();
    const value = evaluateSection(partTwo, environment, inputResult).inspect();
    partTwoResult = {
      value,
      duration: new Date().getTime() - start,
    };
  }

  return {
    partOne: partOneResult,
    partTwo: partTwoResult,
  };
};

type TestCase = {
  partOne?: TestCaseResult;
  partTwo?: TestCaseResult;
  slow: boolean;
  skipped: boolean;
};

type TestCaseResult = {
  expected: string;
  actual: string;
  hasPassed: boolean;
};

export const runTests = (source: string, io: O.IO, includeSlow: boolean = false): TestCase[] => {
  const { environment, partOne, partTwo } = evaluateSource(source, io);

  const results: TestCase[] = [];

  for (const test of environment.getSection('test')) {
    const isSlow = test.hasAttribute('slow');

    // Return slow tests as skipped unless explicitly requested
    if (isSlow && !includeSlow) {
      results.push({ slow: true, skipped: true });
      continue;
    }

    const testEnvironment = new O.Environment(environment);

    const testResult = evaluateNode(test.section, testEnvironment);
    if (testResult instanceof O.Err) {
      throw {
        message: testResult.inspect(),
        line: testResult.node.source.line,
        column: testResult.node.source.column,
      };
    }

    const partOneExpected = testEnvironment.getSection('part_one');
    const partTwoExpected = testEnvironment.getSection('part_two');

    if (partOneExpected.length === 0 && partTwoExpected.length === 0) {
      continue;
    }

    if (partOneExpected.length > 1) {
      throw {
        message: 'Runtime error: Expected a single testcase `part_one` section',
        line: partOneExpected[1].name.source.line,
        column: partOneExpected[1].name.source.column,
      };
    }

    if (partTwoExpected.length > 1) {
      throw {
        message: 'Runtime error: Expected a single testcase `part_two` section',
        line: partTwoExpected[1].name.source.line,
        column: partTwoExpected[1].name.source.column,
      };
    }

    const testInput = testEnvironment.getSection('input');
    if (testInput.length > 1) {
      throw {
        message: 'Runtime error: Expected a single testcase `input` section',
        line: testInput[1].name.source.line,
        column: testInput[1].name.source.column,
      };
    }

    const testInputResult =
      testInput.length === 1 ? evaluateSection(testInput[0], testEnvironment) : null;

    const testCase: TestCase = { slow: isSlow, skipped: false };

    if (partOne && partOneExpected.length === 1) {
      const partOneExpectedResult = evaluateSection(partOneExpected[0], testEnvironment);
      const partOneActualResult = evaluateSection(partOne, testEnvironment, testInputResult);

      testCase.partOne = {
        expected: partOneExpectedResult.inspect(),
        actual: partOneActualResult.inspect(),
        hasPassed: partOneExpectedResult.equals(partOneActualResult),
      };
    }

    if (partTwo && partTwoExpected.length === 1) {
      const partTwoExpectedResult = evaluateSection(partTwoExpected[0], testEnvironment);
      const partTwoActualResult = evaluateSection(partTwo, testEnvironment, testInputResult);

      testCase.partTwo = {
        expected: partTwoExpectedResult.inspect(),
        actual: partTwoActualResult.inspect(),
        hasPassed: partTwoExpectedResult.equals(partTwoActualResult),
      };
    }

    results.push(testCase);
  }

  return results;
};
