#!/usr/bin/env bun

import { readFileSync, realpathSync } from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import { run, runTests } from 'santa-lang/runner';
import { Lexer } from 'santa-lang/lexer';
import { Parser } from 'santa-lang/parser';
import { evaluate, O } from 'santa-lang/evaluator';
import printSourcePreview from './printSourcePreview';
import io, { enableConsoleCapture, disableConsoleCapture } from './io';
import {
  type OutputMode,
  formatRunJson,
  formatTestJson,
  formatErrorJson,
  isSolutionSource,
  createSolutionInitial,
  createScriptInitial,
  createTestInitial,
  replacePatch,
  addPatch,
  writeLine,
  writePatches,
  type JsonTestPartResult,
} from './output';
import pkg from '../package.json';

// Parse command line arguments
const args = process.argv.slice(2);

// Read stdin synchronously (returns null if stdin is a TTY or empty)
function readStdinSync(): string | null {
  if (process.stdin.isTTY) {
    return null;
  }

  try {
    // Read stdin synchronously using file descriptor 0
    return readFileSync(0, { encoding: 'utf-8' });
  } catch {
    return null;
  }
}

function printHelp() {
  console.log(`santa-lang CLI - Prancer ${pkg.version}`);
  console.log();
  console.log('USAGE:');
  console.log('    santa-cli <SCRIPT>              Run solution file');
  console.log('    santa-cli -e <CODE>             Evaluate inline script');
  console.log('    santa-cli -t <SCRIPT>           Run test suite');
  console.log('    santa-cli -t -s <SCRIPT>        Run tests including @slow');
  console.log('    santa-cli -o json <SCRIPT>      Output as JSON');
  console.log('    santa-cli -o jsonl <SCRIPT>     Output as JSON Lines (streaming)');
  console.log('    santa-cli -r                    Start REPL');
  console.log('    santa-cli -h                    Show this help');
  console.log('    cat file | santa-cli            Read from stdin');
  console.log();
  console.log('OPTIONS:');
  console.log('    -e, --eval <CODE>    Evaluate inline script');
  console.log('    -o, --output FORMAT  Output format: text (default), json, jsonl');
  console.log('    -t, --test           Run the solution\'s test suite');
  console.log('    -s, --slow           Include @slow tests (use with -t)');
  console.log('    -r, --repl           Start interactive REPL');
  console.log('    -h, --help           Show this help message');
  console.log('    -v, --version        Display version information');
  console.log();
  console.log('ENVIRONMENT:');
  console.log('    SANTA_CLI_SESSION_TOKEN    AOC session token for aoc:// URLs');
}

function runRepl() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '>> ',
  });

  const environment = new O.Environment();
  environment.setIO(io);

  console.log(
    '   ,--.\n  ()   \\\n   /    \\\n _/______\\_\n(__________)\n(/  @  @  \\)\n(`._,()._,\')  Santa REPL\n(  `-\'`-\'  )\n \\        /\n  \\,,,,,,/\n'
  );

  rl.prompt();

  rl.on('line', (line: string) => {
    if (line.trim() === '') {
      rl.prompt();
      return;
    }

    try {
      const lexer = new Lexer(line);
      const parser = new Parser(lexer);
      const result = evaluate(parser.parse(), environment);
      if (result instanceof O.Err) {
        console.log(result.inspect());
      } else {
        console.log(result.inspect());
      }
    } catch (err: any) {
      console.log(err.message || String(err));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('Goodbye');
    process.exit(0);
  });
}

// Check for help flag
if (args.includes('-h') || args.includes('--help')) {
  printHelp();
  process.exit(0);
}

// Parse output mode (needed for version and other commands)
const outputIndex = args.findIndex(arg => arg === '-o' || arg === '--output');
let outputMode: OutputMode = 'text';
if (outputIndex !== -1 && args[outputIndex + 1]) {
  const format = args[outputIndex + 1];
  if (format === 'text' || format === 'json' || format === 'jsonl') {
    outputMode = format;
  } else {
    console.error(`Error: Invalid output format '${format}'. Use: text, json, jsonl`);
    process.exit(1);
  }
}

// Check for version flag
if (args.includes('-v') || args.includes('--version')) {
  if (outputMode === 'text') {
    console.log(`santa-lang Prancer ${pkg.version}`);
  } else {
    console.log(JSON.stringify({
      reindeer: 'Prancer',
      version: pkg.version
    }));
  }
  process.exit(0);
}

// Check for REPL flag
if (args.includes('-r') || args.includes('--repl')) {
  runRepl();
} else {

  // Run script or tests
  const isTestRun = args.includes('-t') || args.includes('--test');
  const includeSlow = args.includes('-s') || args.includes('--slow');

  // Check for -e/--eval flag
  const evalIndex = args.findIndex(arg => arg === '-e' || arg === '--eval');
  const evalScript = evalIndex !== -1 && args[evalIndex + 1] ? args[evalIndex + 1] : null;

  // Find the script file (argument that ends with .santa)
  const scriptFile = args.find(arg => arg.endsWith('.santa'));

  // Determine source: -e > file > stdin
  let filename: string | null = null;
  let source: string;

  if (evalScript) {
    // Eval mode - use inline script
    source = evalScript;
  } else if (scriptFile) {
    // File mode
    try {
      filename = scriptFile;
      source = readFileSync(filename, { encoding: 'utf-8' });
    } catch {
      console.log('Unable to open source file');
      process.exit(1);
    }
  } else {
    // Try stdin
    const stdinData = readStdinSync();
    if (stdinData !== null) {
      source = stdinData;
    } else {
      printHelp();
      process.exit(1);
    }
  }

  // Only change directory if we have a file path
  if (filename) {
    process.chdir(path.dirname(realpathSync(filename)));
  }

  // Enable console capture for JSON/JSONL modes
  if (outputMode !== 'text') {
    enableConsoleCapture();
  }

  try {
    if (!isTestRun) {
      // Run mode
      const { hasPartOne, hasPartTwo } = isSolutionSource(source);
      const isSolution = hasPartOne || hasPartTwo;

      // For JSONL mode, emit initial state BEFORE running (enables streaming UI)
      if (outputMode === 'jsonl') {
        if (isSolution) {
          const initial = createSolutionInitial(hasPartOne, hasPartTwo);
          writeLine(initial);
          writePatches([replacePatch('/status', 'running')]);
          if (hasPartOne) {
            writePatches([replacePatch('/part_one/status', 'running')]);
          }
          if (hasPartTwo) {
            writePatches([replacePatch('/part_two/status', 'running')]);
          }
        } else {
          const initial = createScriptInitial();
          writeLine(initial);
          writePatches([replacePatch('/status', 'running')]);
        }
      }

      // Now run the code
      const result = run(source, io);

      if (outputMode === 'text') {
        // Text output (existing behavior)
        if ('value' in result) {
          console.log(result.value);
          process.exit(0);
        }

        if (result.partOne) {
          console.log(
            'Part 1: \x1b[32m%s\x1b[0m \x1b[90m%sms\x1b[0m',
            result.partOne.value,
            result.partOne.duration
          );
        }

        if (result.partTwo) {
          console.log(
            'Part 2: \x1b[32m%s\x1b[0m \x1b[90m%sms\x1b[0m',
            result.partTwo.value,
            result.partTwo.duration
          );
        }

        process.exit(0);
      } else if (outputMode === 'json') {
        // JSON output
        const consoleEntries = disableConsoleCapture();
        const output = formatRunJson(result, consoleEntries);
        console.log(JSON.stringify(output));
        process.exit(0);
      } else {
        // JSONL output - emit completion patches (initial state already emitted above)
        const consoleEntries = disableConsoleCapture();

        // Emit console entries
        for (const entry of consoleEntries) {
          writePatches([addPatch('/console/-', entry)]);
        }

        if (isSolution) {
          // Emit part results
          if ('partOne' in result && result.partOne && hasPartOne) {
            writePatches([
              replacePatch('/part_one/status', 'complete'),
              replacePatch('/part_one/value', result.partOne.value),
              replacePatch('/part_one/duration_ms', result.partOne.duration),
            ]);
          }

          if ('partTwo' in result && result.partTwo && hasPartTwo) {
            writePatches([
              replacePatch('/part_two/status', 'complete'),
              replacePatch('/part_two/value', result.partTwo.value),
              replacePatch('/part_two/duration_ms', result.partTwo.duration),
            ]);
          }

          writePatches([replacePatch('/status', 'complete')]);
        } else {
          // Script completion
          if ('value' in result) {
            writePatches([
              replacePatch('/status', 'complete'),
              replacePatch('/value', result.value),
              replacePatch('/duration_ms', result.duration),
            ]);
          }
        }

        process.exit(0);
      }
    } else {
      // Test mode
      const testCases = runTests(source, io, includeSlow);
      const { hasPartOne, hasPartTwo } = isSolutionSource(source);

      if (outputMode === 'text') {
        // Text output (existing behavior)
        let exitCode = 0;

        for (const [idx, testCase] of Object.entries(testCases)) {
          if (Number(idx) > 0) console.log();

          if (testCase.skipped) {
            console.log('\x1b[4mTestcase #%s\x1b[0m \x1b[33m(skipped)\x1b[0m', Number(idx) + 1);
            continue;
          }

          if (testCase.slow) {
            console.log('\x1b[4mTestcase #%s\x1b[0m \x1b[33m(slow)\x1b[0m', Number(idx) + 1);
          } else {
            console.log('\x1b[4mTestcase #%s\x1b[0m', Number(idx) + 1);
          }

          if (!testCase.partOne && !testCase.partTwo) {
            console.log('No expectations');
            continue;
          }

          if (testCase.partOne) {
            if (testCase.partOne.hasPassed) {
              console.log('Part 1: %s \x1b[32m✔\x1b[0m', testCase.partOne.actual);
            } else {
              console.log(
                'Part 1: %s \x1b[31m✘ (Expected: %s)\x1b[0m',
                testCase.partOne.actual,
                testCase.partOne.expected
              );
              exitCode = 3;
            }
          }

          if (testCase.partTwo) {
            if (testCase.partTwo.hasPassed) {
              console.log('Part 2: %s \x1b[32m✔\x1b[0m', testCase.partTwo.actual);
            } else {
              console.log(
                'Part 2: %s \x1b[31m✘ (Expected: %s)\x1b[0m',
                testCase.partTwo.actual,
                testCase.partTwo.expected
              );
              exitCode = 3;
            }
          }
        }

        process.exit(exitCode);
      } else if (outputMode === 'json') {
        // JSON output
        const consoleEntries = disableConsoleCapture();
        const output = formatTestJson(testCases, hasPartOne, hasPartTwo, consoleEntries);
        console.log(JSON.stringify(output));

        // Exit with code 3 if any tests failed
        const hasFailures = testCases.some(
          tc =>
            !tc.skipped &&
            ((tc.partOne && !tc.partOne.hasPassed) || (tc.partTwo && !tc.partTwo.hasPassed))
        );
        process.exit(hasFailures ? 3 : 0);
      } else {
        // JSONL output
        const consoleEntries = disableConsoleCapture();

        // Emit initial state
        const initial = createTestInitial(testCases);
        writeLine(initial);
        writePatches([replacePatch('/status', 'running')]);

        // Emit console entries
        for (const entry of consoleEntries) {
          writePatches([addPatch('/console/-', entry)]);
        }

        // Emit test results
        let passed = 0;
        let failed = 0;
        let skipped = 0;

        for (let i = 0; i < testCases.length; i++) {
          const tc = testCases[i];
          const pathPrefix = `/tests/${i}`;

          if (tc.skipped) {
            skipped++;
            writePatches([
              replacePatch(`${pathPrefix}/status`, 'skipped'),
              replacePatch('/summary/skipped', skipped),
            ]);
          } else {
            // Emit running
            writePatches([replacePatch(`${pathPrefix}/status`, 'running')]);

            // Determine result
            const partOnePassed = tc.partOne === undefined || tc.partOne.hasPassed;
            const partTwoPassed = tc.partTwo === undefined || tc.partTwo.hasPassed;
            const allPassed = partOnePassed && partTwoPassed;

            if (allPassed) {
              passed++;
            } else {
              failed++;
            }

            // Build patches
            const patches = [replacePatch(`${pathPrefix}/status`, 'complete')];

            if (hasPartOne && tc.partOne) {
              const partResult: JsonTestPartResult = {
                passed: tc.partOne.hasPassed,
                expected: tc.partOne.expected,
                actual: tc.partOne.actual,
              };
              patches.push(replacePatch(`${pathPrefix}/part_one`, partResult));
            }

            if (hasPartTwo && tc.partTwo) {
              const partResult: JsonTestPartResult = {
                passed: tc.partTwo.hasPassed,
                expected: tc.partTwo.expected,
                actual: tc.partTwo.actual,
              };
              patches.push(replacePatch(`${pathPrefix}/part_two`, partResult));
            }

            if (allPassed) {
              patches.push(replacePatch('/summary/passed', passed));
            } else {
              patches.push(replacePatch('/summary/failed', failed));
            }

            writePatches(patches);
          }
        }

        // Emit completion
        const success = failed === 0;
        writePatches([replacePatch('/status', 'complete'), replacePatch('/success', success)]);

        process.exit(success ? 0 : 3);
      }
    }
  } catch (err: any) {
    if (outputMode === 'text') {
      // Text error output (existing behavior)
      printSourcePreview(filename || '<stdin>', source, err.line, err.column);
      console.log('\x1b[32m%s\x1b[0m', err.message);
      process.exit(2);
    } else if (outputMode === 'json') {
      // JSON error output
      disableConsoleCapture();
      const output = formatErrorJson(err);
      console.log(JSON.stringify(output));
      process.exit(2);
    } else {
      // JSONL error output
      disableConsoleCapture();
      const { hasPartOne, hasPartTwo } = isSolutionSource(source);
      const isSolution = hasPartOne || hasPartTwo;

      // Emit initial state if not already done
      if (isTestRun) {
        const initial = createTestInitial([]);
        writeLine(initial);
        writePatches([replacePatch('/status', 'running')]);
      } else if (isSolution) {
        const initial = createSolutionInitial(hasPartOne, hasPartTwo);
        writeLine(initial);
        writePatches([replacePatch('/status', 'running')]);
      } else {
        const initial = createScriptInitial();
        writeLine(initial);
        writePatches([replacePatch('/status', 'running')]);
      }

      // Emit error patch
      const errorOutput = {
        message: err.message,
        location: { line: err.line + 1, column: err.column + 1 },
        stack: [],
      };
      writePatches([replacePatch('/status', 'error'), addPatch('/error', errorOutput)]);
      process.exit(2);
    }
  }
}
