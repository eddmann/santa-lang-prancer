/**
 * CLI Integration Tests
 *
 * These tests spawn the actual CLI process and verify stdout/stderr/exit codes,
 * matching the testing approach used in Comet (runtime/cli/src/tests.rs).
 */

import { describe, test, expect } from 'bun:test';
import { join } from 'path';

const CLI_DIR = join(import.meta.dir, '..');
const FIXTURES_DIR = join(CLI_DIR, 'fixtures');

type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

function runCli(args: string[], options?: { stdin?: string }): CliResult {
  const proc = Bun.spawnSync(['bun', 'run', './src/index.ts', ...args], {
    cwd: CLI_DIR,
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: options?.stdin ? new TextEncoder().encode(options.stdin) : undefined,
  });

  return {
    exitCode: proc.exitCode ?? -1,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

// ============================================================================
// Basic Execution
// ============================================================================

describe('basic execution', () => {
  test('script', () => {
    const { exitCode, stdout } = runCli([join(FIXTURES_DIR, 'script.santa')]);
    expect(exitCode).toBe(0);
    expect(stdout).toBe('14\n');
  });

  test('solution', () => {
    const { exitCode, stdout } = runCli([join(FIXTURES_DIR, 'solution.santa')]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Part 1:');
    expect(stdout).toContain('-1');
    expect(stdout).toContain('Part 2:');
    expect(stdout).toContain('5');
  });

  test('eval simple expression', () => {
    const { exitCode, stdout } = runCli(['-e', '1 + 2']);
    expect(exitCode).toBe(0);
    expect(stdout).toBe('3\n');
  });

  test('eval complex expression', () => {
    const { exitCode, stdout } = runCli(['-e', 'map(|x| x * 2, [1, 2, 3])']);
    expect(exitCode).toBe(0);
    expect(stdout).toBe('[2, 4, 6]\n');
  });

  test('eval aoc solution', () => {
    const { exitCode, stdout } = runCli(['-e', 'part_one: { 42 }']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Part 1:');
    expect(stdout).toContain('42');
  });

  test('stdin simple expression', () => {
    const { exitCode, stdout } = runCli([], { stdin: '1 + 2' });
    expect(exitCode).toBe(0);
    expect(stdout).toBe('3\n');
  });

  test('stdin aoc solution', () => {
    const { exitCode, stdout } = runCli([], { stdin: 'part_one: { 42 }' });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Part 1:');
    expect(stdout).toContain('42');
  });
});

// ============================================================================
// Test Mode
// ============================================================================

describe('test mode', () => {
  test('test solution', () => {
    const { exitCode, stdout } = runCli(['-t', join(FIXTURES_DIR, 'solution.santa')]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Testcase #1');
    expect(stdout).toContain('Part 1:');
    expect(stdout).toContain('-1');
    expect(stdout).toContain('Part 2:');
    expect(stdout).toContain('5');
  });

  test('test solution with slow tests included', () => {
    const { exitCode, stdout } = runCli([
      '-t',
      '-s',
      join(FIXTURES_DIR, 'solution_with_slow_test.santa'),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Testcase #1');
    expect(stdout).toContain('Testcase #2');
    expect(stdout).toContain('(slow)');
  });

  test('test solution skips slow tests by default', () => {
    const { exitCode, stdout } = runCli([
      '-t',
      join(FIXTURES_DIR, 'solution_with_slow_test.santa'),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Testcase #1');
    expect(stdout).toContain('Testcase #2');
    expect(stdout).toContain('(skipped)');
  });
});

// ============================================================================
// JSON Output
// ============================================================================

describe('JSON output', () => {
  test('json script simple', () => {
    const { exitCode, stdout } = runCli(['-o', 'json', '-e', '1 + 2']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('"type":"script"');
    expect(stdout).toContain('"status":"complete"');
    expect(stdout).toContain('"value":"3"');
  });

  test('json script with console', () => {
    const { exitCode, stdout } = runCli(['-o', 'json', '-e', 'puts("hello"); 42']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('"type":"script"');
    expect(stdout).toContain('"value":"42"');
    expect(stdout).toContain('"message":"hello"');
  });

  test('json solution', () => {
    const { exitCode, stdout } = runCli(['-o', 'json', join(FIXTURES_DIR, 'solution.santa')]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('"type":"solution"');
    expect(stdout).toContain('"part_one"');
    expect(stdout).toContain('"part_two"');
    expect(stdout).toContain('"status":"complete"');
  });

  test('json solution single part (part_one only)', () => {
    const { exitCode, stdout } = runCli(['-o', 'json', '-e', 'part_one: { 42 }']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('"type":"solution"');
    expect(stdout).toContain('"part_one"');
    expect(stdout).toContain('"value":"42"');
    expect(stdout).not.toContain('"part_two"');
  });

  test('json solution single part (part_two only)', () => {
    const { exitCode, stdout } = runCli(['-o', 'json', '-e', 'part_two: { 99 }']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('"type":"solution"');
    expect(stdout).toContain('"part_two"');
    expect(stdout).toContain('"value":"99"');
    expect(stdout).not.toContain('"part_one"');
  });

  test('json error runtime', () => {
    const { exitCode, stdout } = runCli(['-o', 'json', '-e', '1 * "x"']);
    expect(exitCode).toBe(2);
    expect(stdout).toContain('"type":"error"');
    expect(stdout).toContain('"message"');
    expect(stdout).toContain('"location"');
    expect(stdout).toContain('"line":1');
  });

  test('json error parse', () => {
    const { exitCode, stdout } = runCli(['-o', 'json', '-e', '1 ^ 2']);
    expect(exitCode).toBe(2);
    expect(stdout).toContain('"type":"error"');
    expect(stdout).toContain('"message"');
  });

  test('json test passing', () => {
    const { exitCode, stdout } = runCli(['-o', 'json', '-t', join(FIXTURES_DIR, 'solution.santa')]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('"type":"test"');
    expect(stdout).toContain('"success":true');
    expect(stdout).toContain('"passed":1');
    expect(stdout).toContain('"failed":0');
  });

  test('json test failing', () => {
    const { exitCode, stdout } = runCli([
      '-o',
      'json',
      '-t',
      '-e',
      `
      part_one: { 99 }
      test: {
        input: "x"
        part_one: 42
      }
      `,
    ]);
    expect(exitCode).toBe(3);
    expect(stdout).toContain('"type":"test"');
    expect(stdout).toContain('"success":false');
    expect(stdout).toContain('"passed":false');
    expect(stdout).toContain('"expected":"42"');
    expect(stdout).toContain('"actual":"99"');
  });

  test('json test skipped', () => {
    const { exitCode, stdout } = runCli([
      '-o',
      'json',
      '-t',
      join(FIXTURES_DIR, 'solution_with_slow_test.santa'),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('"type":"test"');
    expect(stdout).toContain('"skipped":1');
    expect(stdout).toContain('"status":"skipped"');
  });

  test('json test skipped included with slow flag', () => {
    const { exitCode, stdout } = runCli([
      '-o',
      'json',
      '-t',
      '-s',
      join(FIXTURES_DIR, 'solution_with_slow_test.santa'),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('"type":"test"');
    expect(stdout).toContain('"skipped":0');
    expect(stdout).toContain('"passed":2');
  });

  test('json test multiple with mixed results', () => {
    const { exitCode, stdout } = runCli([
      '-o',
      'json',
      '-t',
      '-e',
      `
      part_one: { size(input) }

      test: {
        input: "abc"
        part_one: 3
      }

      test: {
        input: "hello"
        part_one: 999
      }
      `,
    ]);
    expect(exitCode).toBe(3);
    expect(stdout).toContain('"type":"test"');
    expect(stdout).toContain('"success":false');
    expect(stdout).toContain('"passed":1');
    expect(stdout).toContain('"failed":1');
  });

  test('json error on multiline source', () => {
    const { exitCode, stdout } = runCli([
      '-o',
      'json',
      '-e',
      `let x = 1;
let y = 2;
let z = 3;
1 * "invalid"`,
    ]);
    expect(exitCode).toBe(2);
    expect(stdout).toContain('"type":"error"');
    expect(stdout).toContain('"message"');
    expect(stdout).toContain('"line":4');
  });
});

// ============================================================================
// JSONL Output
// ============================================================================

describe('JSONL output', () => {
  test('jsonl script simple', () => {
    const { exitCode, stdout } = runCli(['-o', 'jsonl', '-e', '1 + 2']);
    expect(exitCode).toBe(0);
    // First line is initial state
    expect(stdout).toContain('"type":"script"');
    expect(stdout).toContain('"status":"pending"');
    // Patches include running and complete
    expect(stdout).toContain('"op":"replace"');
    expect(stdout).toContain('"/status"');
    expect(stdout).toContain('"running"');
    expect(stdout).toContain('"complete"');
  });

  test('jsonl solution', () => {
    const { exitCode, stdout } = runCli(['-o', 'jsonl', '-e', 'part_one: { 42 }']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('"type":"solution"');
    expect(stdout).toContain('"/part_one/status"');
    expect(stdout).toContain('"/part_one/value"');
  });

  test('jsonl error', () => {
    const { exitCode, stdout } = runCli(['-o', 'jsonl', '-e', '1 * "x"']);
    expect(exitCode).toBe(2);
    expect(stdout).toContain('"type":"script"');
    expect(stdout).toContain('"/error"');
    expect(stdout).toContain('"message"');
  });

  test('jsonl test', () => {
    const { exitCode, stdout } = runCli([
      '-o',
      'jsonl',
      '-t',
      join(FIXTURES_DIR, 'solution.santa'),
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('"type":"test"');
    expect(stdout).toContain('"/tests/0/status"');
    expect(stdout).toContain('"/summary/passed"');
  });
});

// ============================================================================
// Error Handling
// ============================================================================

describe('error handling', () => {
  test('invalid output mode', () => {
    const { exitCode, stderr } = runCli(['-o', 'xml', '-e', '1']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Invalid output format');
  });
});

// ============================================================================
// Help and Version
// ============================================================================

describe('help and version', () => {
  test('help flag', () => {
    const { exitCode, stdout } = runCli(['-h']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('USAGE:');
    expect(stdout).toContain('OPTIONS:');
  });

  test('version flag', () => {
    const { exitCode, stdout } = runCli(['-v']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('santa-lang');
    expect(stdout).toContain('Prancer');
  });
});
