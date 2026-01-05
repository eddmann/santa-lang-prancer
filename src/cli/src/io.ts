import { readFileSync, writeFileSync } from 'fs';
import type { ConsoleEntry } from './output';

const parseUrl = (path: string): URL | null => {
  try {
    return new URL(path);
  } catch (err) {
    return null;
  }
};

// Console capture state
let consoleBuffer: ConsoleEntry[] | null = null;
let captureStartTime: number = 0;

export function enableConsoleCapture(): void {
  captureStartTime = Date.now();
  consoleBuffer = [];
}

export function disableConsoleCapture(): ConsoleEntry[] {
  const entries = consoleBuffer || [];
  consoleBuffer = null;
  return entries;
}

const readAoC = (url: URL, path: string): string => {
  const year = url.host;
  const day = url.pathname.substring(1);
  const filename = `aoc${year}_day${day.padStart(2, '0')}.input`;

  try {
    return readFileSync(filename, { encoding: 'utf-8' });
  } catch (err) {}

  const token = process.env.SANTA_CLI_SESSION_TOKEN;

  if (!token) {
    throw new Error(
      `Unable to read AOC input: ${path}, missing session token within SANTA_CLI_SESSION_TOKEN environment variable`
    );
  }

  const result = Bun.spawnSync([
    'curl',
    '-sfL',
    '-H',
    `Cookie: session=${token}`,
    `https://adventofcode.com/${year}/day/${day}/input`,
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`Unable to read AOC input: ${path}`);
  }

  const content = new TextDecoder().decode(result.stdout).trimEnd();
  writeFileSync(filename, content);
  return content;
};

const readUrl = (path: string): string => {
  const result = Bun.spawnSync(['curl', '-sfL', path]);
  if (result.exitCode !== 0) {
    throw new Error(`Unable to read HTTP input: ${path}`);
  }
  return new TextDecoder().decode(result.stdout);
};

export default {
  input: (path: string): string => {
    const url = parseUrl(path);

    if (!url) {
      try {
        return readFileSync(path, { encoding: 'utf-8' });
      } catch (err) {
        throw new Error(`Unable to read path: ${path}`);
      }
    }

    if (url.protocol === 'aoc:') {
      return readAoC(url, path);
    }

    return readUrl(path);
  },
  output: (args: string[]) => {
    // Spec: no event for puts() with no args
    if (args.length === 0) return;

    const message = args.join(' ');

    if (consoleBuffer !== null) {
      // Capture mode: add to buffer
      consoleBuffer.push({
        timestamp_ms: Date.now() - captureStartTime,
        message,
      });
    } else {
      // Normal mode: print to stdout
      console.log(message);
    }
  },
};
