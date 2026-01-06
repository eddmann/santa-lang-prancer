/**
 * CLI output formatting for JSON and JSONL modes.
 *
 * This module implements the CLI Output Format Specification (Section 16 of lang.txt).
 * It provides machine-readable output formats for integration with editors, CI systems,
 * and other tools.
 */

// ============================================================================
// Types
// ============================================================================

export type OutputMode = 'text' | 'json' | 'jsonl';

export type ConsoleEntry = {
  timestamp_ms: number;
  message: string;
};

export type ErrorLocation = {
  line: number;
  column: number;
};

export type StackFrame = {
  function: string;
  line: number;
  column: number;
};

export type JsonPartResult = {
  status: 'complete';
  value: string;
  duration_ms: number;
};

export type JsonTestPartResult = {
  passed: boolean;
  expected: string;
  actual: string;
};

export type JsonTestCase = {
  index: number;
  slow: boolean;
  status: 'complete' | 'skipped';
  part_one?: JsonTestPartResult;
  part_two?: JsonTestPartResult;
};

export type TestSummary = {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
};

export type JsonSolutionOutput = {
  type: 'solution';
  status: 'complete';
  part_one?: JsonPartResult;
  part_two?: JsonPartResult;
  console: ConsoleEntry[];
};

export type JsonScriptOutput = {
  type: 'script';
  status: 'complete';
  value: string;
  duration_ms: number;
  console: ConsoleEntry[];
};

export type JsonTestOutput = {
  type: 'test';
  status: 'complete';
  success: boolean;
  summary: TestSummary;
  tests: JsonTestCase[];
  console: ConsoleEntry[];
};

export type JsonErrorOutput = {
  type: 'error';
  message: string;
  location: ErrorLocation;
  stack: StackFrame[];
};

// ============================================================================
// Result Types (from runner)
// ============================================================================

type ResultValue = {
  value: string;
  duration: number;
};

type SolutionResult = {
  partOne?: ResultValue;
  partTwo?: ResultValue;
};

type ScriptResult = {
  value: string;
  duration: number;
};

type RunResult = SolutionResult | ScriptResult;

export type TestCaseResult = {
  expected: string;
  actual: string;
  hasPassed: boolean;
};

export type TestCase = {
  partOne?: TestCaseResult;
  partTwo?: TestCaseResult;
  slow: boolean;
  skipped: boolean;
};

// ============================================================================
// JSON Formatting Functions
// ============================================================================

function isScriptResult(result: RunResult): result is ScriptResult {
  return 'value' in result && 'duration' in result;
}

export function formatRunJson(result: RunResult, console: ConsoleEntry[]): JsonSolutionOutput | JsonScriptOutput {
  if (isScriptResult(result)) {
    return {
      type: 'script',
      status: 'complete',
      value: result.value,
      duration_ms: result.duration,
      console,
    };
  }

  const output: JsonSolutionOutput = {
    type: 'solution',
    status: 'complete',
    console,
  };

  if (result.partOne) {
    output.part_one = {
      status: 'complete',
      value: result.partOne.value,
      duration_ms: result.partOne.duration,
    };
  }

  if (result.partTwo) {
    output.part_two = {
      status: 'complete',
      value: result.partTwo.value,
      duration_ms: result.partTwo.duration,
    };
  }

  return output;
}

export function formatTestJson(
  testCases: TestCase[],
  hasPartOne: boolean,
  hasPartTwo: boolean,
  console: ConsoleEntry[]
): JsonTestOutput {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  const tests: JsonTestCase[] = testCases.map((tc, i) => {
    if (tc.skipped) {
      skipped++;
      return {
        index: i + 1,
        slow: tc.slow,
        status: 'skipped' as const,
      };
    }

    // Determine if test passed (all parts must pass)
    const partOnePassed = tc.partOne === undefined || tc.partOne.hasPassed;
    const partTwoPassed = tc.partTwo === undefined || tc.partTwo.hasPassed;
    const allPassed = partOnePassed && partTwoPassed;

    if (allPassed) {
      passed++;
    } else {
      failed++;
    }

    const testCase: JsonTestCase = {
      index: i + 1,
      slow: tc.slow,
      status: 'complete',
    };

    if (hasPartOne && tc.partOne) {
      testCase.part_one = {
        passed: tc.partOne.hasPassed,
        expected: tc.partOne.expected,
        actual: tc.partOne.actual,
      };
    }

    if (hasPartTwo && tc.partTwo) {
      testCase.part_two = {
        passed: tc.partTwo.hasPassed,
        expected: tc.partTwo.expected,
        actual: tc.partTwo.actual,
      };
    }

    return testCase;
  });

  return {
    type: 'test',
    status: 'complete',
    success: failed === 0,
    summary: {
      total: testCases.length,
      passed,
      failed,
      skipped,
    },
    tests,
    console,
  };
}

export type ErrorInfo = {
  message: string;
  line: number;
  column: number;
};

export function formatErrorJson(error: ErrorInfo): JsonErrorOutput {
  return {
    type: 'error',
    message: error.message,
    location: {
      line: error.line + 1, // Convert to 1-indexed
      column: error.column + 1, // Convert to 1-indexed
    },
    stack: [], // Stack traces not available in current Prancer implementation
  };
}

export function isSolutionSource(source: string): { hasPartOne: boolean; hasPartTwo: boolean } {
  // Simple heuristic: check if source contains part_one: or part_two:
  // This matches the runner's behavior
  const hasPartOne = source.includes('part_one:');
  const hasPartTwo = source.includes('part_two:');
  return { hasPartOne, hasPartTwo };
}

// ============================================================================
// JSONL Streaming Support
// ============================================================================

export type JsonPatch = {
  op: 'replace' | 'add';
  path: string;
  value: unknown;
};

export type JsonlPartInitial = {
  status: 'pending';
  value: null;
  duration_ms: null;
};

export type JsonlSolutionInitial = {
  type: 'solution';
  status: 'pending';
  part_one?: JsonlPartInitial;
  part_two?: JsonlPartInitial;
  console: ConsoleEntry[];
};

export type JsonlScriptInitial = {
  type: 'script';
  status: 'pending';
  value: null;
  duration_ms: null;
  console: ConsoleEntry[];
};

export type JsonlTestCaseInitial = {
  index: number;
  slow: boolean;
  status: 'pending';
  part_one: null;
  part_two: null;
};

export type JsonlTestInitial = {
  type: 'test';
  status: 'pending';
  success: null;
  summary: TestSummary;
  tests: JsonlTestCaseInitial[];
  console: ConsoleEntry[];
};

export function createSolutionInitial(hasPartOne: boolean, hasPartTwo: boolean): JsonlSolutionInitial {
  const initial: JsonlSolutionInitial = {
    type: 'solution',
    status: 'pending',
    console: [],
  };

  if (hasPartOne) {
    initial.part_one = { status: 'pending', value: null, duration_ms: null };
  }

  if (hasPartTwo) {
    initial.part_two = { status: 'pending', value: null, duration_ms: null };
  }

  return initial;
}

export function createScriptInitial(): JsonlScriptInitial {
  return {
    type: 'script',
    status: 'pending',
    value: null,
    duration_ms: null,
    console: [],
  };
}

export function createTestInitial(testCases: TestCase[]): JsonlTestInitial {
  return {
    type: 'test',
    status: 'pending',
    success: null,
    summary: {
      total: testCases.length,
      passed: 0,
      failed: 0,
      skipped: 0,
    },
    tests: testCases.map((tc, i) => ({
      index: i + 1,
      slow: tc.slow,
      status: 'pending' as const,
      part_one: null,
      part_two: null,
    })),
    console: [],
  };
}

export function replacePatch(path: string, value: unknown): JsonPatch {
  return { op: 'replace', path, value };
}

export function addPatch(path: string, value: unknown): JsonPatch {
  return { op: 'add', path, value };
}

export function writeLine(obj: unknown): void {
  console.log(JSON.stringify(obj));
}

export function writePatches(patches: JsonPatch[]): void {
  console.log(JSON.stringify(patches));
}
