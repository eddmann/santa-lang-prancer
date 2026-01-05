import { runTests } from './index';
import { IO } from '../evaluator/object/environment';

const mockIO: IO = {
  input: () => '',
  output: () => {},
};

describe('runTests', () => {
  test('runs all tests without @slow by default, slow tests are skipped', () => {
    const source = `
      part_one: { 1 }

      test: {
        part_one: 1
      }

      @slow
      test: {
        part_one: 1
      }
    `;

    const results = runTests(source, mockIO);

    // Should return both tests, with slow test marked as skipped
    expect(results).toHaveLength(2);
    expect(results[0].slow).toBe(false);
    expect(results[0].skipped).toBe(false);
    expect(results[1].slow).toBe(true);
    expect(results[1].skipped).toBe(true);
  });

  test('runs all tests including @slow when includeSlow is true', () => {
    const source = `
      part_one: { 1 }

      test: {
        part_one: 1
      }

      @slow
      test: {
        part_one: 1
      }
    `;

    const results = runTests(source, mockIO, true);

    // Should run both tests
    expect(results).toHaveLength(2);
    expect(results[0].slow).toBe(false);
    expect(results[0].skipped).toBe(false);
    expect(results[1].slow).toBe(true);
    expect(results[1].skipped).toBe(false);
  });

  test('marks slow tests correctly in results', () => {
    const source = `
      part_one: { 1 }

      @slow
      test: {
        part_one: 1
      }
    `;

    const results = runTests(source, mockIO, true);

    expect(results).toHaveLength(1);
    expect(results[0].slow).toBe(true);
    expect(results[0].skipped).toBe(false);
    expect(results[0].partOne?.hasPassed).toBe(true);
  });

  test('handles multiple @slow tests', () => {
    const source = `
      part_one: { 1 }

      test: {
        part_one: 1
      }

      @slow
      test: {
        part_one: 1
      }

      @slow
      test: {
        part_one: 1
      }
    `;

    // Without includeSlow - returns all tests but slow ones are skipped
    const resultsWithoutSlow = runTests(source, mockIO, false);
    expect(resultsWithoutSlow).toHaveLength(3);
    expect(resultsWithoutSlow.filter(r => r.skipped)).toHaveLength(2);
    expect(resultsWithoutSlow.filter(r => !r.skipped)).toHaveLength(1);

    // With includeSlow - all tests run
    const resultsWithSlow = runTests(source, mockIO, true);
    expect(resultsWithSlow).toHaveLength(3);
    expect(resultsWithSlow.filter(r => r.slow)).toHaveLength(2);
    expect(resultsWithSlow.filter(r => r.skipped)).toHaveLength(0);
  });
});
