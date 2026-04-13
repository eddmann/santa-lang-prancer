import { Lexer } from '../lexer';
import { Parser } from '../parser';
import { evaluate, O } from '../evaluator';

test('integer', () => {
  const source = '1';

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(1));
});

test('decimal', () => {
  const source = '1.5';

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Decimal(1.5));
});

test('string', () => {
  const source = '"Hello, world!"';

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Str('Hello, world!'));
});

test('true boolean', () => {
  const source = 'true';

  const result = doEvaluate(source);

  expect(result).toEqual(O.TRUE);
});

test('false boolean', () => {
  const source = 'false';

  const result = doEvaluate(source);

  expect(result).toEqual(O.FALSE);
});

test('nil', () => {
  const source = 'nil';

  const result = doEvaluate(source);

  expect(result).toEqual(O.NIL);
});

test('comments', () => {
  const source = `
    let x = || {
      1 // sample comment one
    };
    // sample comment two
    x();
  `;

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(1));
});

test('let assignment', () => {
  const source = 'let x = 1; x';

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(1));
});

test('mutable let assignment', () => {
  const source = `
    let mut x = 1;
    x = 2;
    x
  `;

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(2));
});

test('variable shadowing', () => {
  const source = 'let x = 1; let x = 2;';

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(2));
});

test('unable to assign variable which is not mutable', () => {
  const source = 'let x = 1; x = 2;';

  const result = doEvaluate(source);

  expect(result.inspect()).toEqual('Runtime error: Variable x is not mutable');
});

test('unable to assign variable which has not been declared', () => {
  const source = 'x = 2';

  const result = doEvaluate(source);

  expect(result.inspect()).toEqual('Runtime error: Variable x has not been declared');
});

test('let list destructing', () => {
  const source = `
    let [a, b, [c, d, [e]], ..f] = [1, 2, [3, 4, [5]], 6, 7];
    [a, b, c, d, e, f]
  `;

  const result = doEvaluate(source);

  expect(result.inspect()).toEqual('[1, 2, 3, 4, 5, [6, 7]]');
});

test('mutable let list destructing', () => {
  const source = `
    let mut [x, y, ..z] = [1, 2, 3, 4];
    x = 100;
    [x, y, z]
  `;

  const result = doEvaluate(source);

  expect(result.inspect()).toEqual('[100, 2, [3, 4]]');
});

test('list spread', () => {
  const source = `
    let x = [2, 3];
    [1, ..x, ..["a", "b", "c"]];
  `;

  const result = doEvaluate(source);

  expect(result.inspect()).toEqual('[1, 2, 3, "a", "b", "c"]');
});

test('function literal with block statement', () => {
  const source = '(|x, y| { x + y })(5, 2)';

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(7));
});

test('function literal with expression statement', () => {
  const source = '(|x, y| x + y)(5, 2)';

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(7));
});

test('function literal with parameter destructuring', () => {
  const source = `
    (|a, [b, ..c], ..d| [a, b, c, d])(1, [2, 3, 4], 5, 6);
  `;

  const result = doEvaluate(source);

  expect(result.inspect()).toEqual('[1, 2, [3, 4], [5, 6]]');
});

test('list literal', () => {
  const source = '[1, 2.5, "hello"]';

  const result = doEvaluate(source);

  expect(result).toEqual(new O.List([new O.Integer(1), new O.Decimal(2.5), new O.Str('hello')]));
});

test('dictionary literal', () => {
  const source = `
    let x = 1;
    #{"hello": #{x}, 1: "2", [1, 2]: 1.5};
  `;

  const result = doEvaluate(source);

  const expected = new O.Dictionary([
    [new O.Str('hello'), new O.Dictionary([[new O.Str('x'), new O.Integer(1)]])],
    [new O.Integer(1), new O.Str('2')],
    [new O.List([new O.Integer(1), new O.Integer(2)]), new O.Decimal(1.5)],
  ]);

  expect(result).toEqual(expected);
});

test('set literal', () => {
  const source = '{1, 2, 3, 1, 2, 3}';

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Set([new O.Integer(1), new O.Integer(2), new O.Integer(3)]));
});

test('call expression', () => {
  const source = `
    let add = |x, y| { x + y };
    add(3, 4);
  `;

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(7));
});

test('infix call expression', () => {
  const source = `
    let add = |x, y| { x + y };
    3 \`add\` 4
  `;

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(7));
});

test('curried call expression', () => {
  const source = `
    let add = |x, y| { x + y };
    add(6)(1);
  `;

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(7));
});

test('call expression with spread', () => {
  const source = `
    let add = |x, y| { x + y };
    let xs = [3, 4]
    add(..xs);
  `;

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(7));
});

test('scoped let re-declaration', () => {
  const source = `
    let total = 1;
    let fn = || { let total = 2; };
    [total, fn()];
  `;

  const result = doEvaluate(source);

  expect(result.inspect()).toEqual('[1, 2]');
});

test('mutable parent variable is modified from within function', () => {
  const source = `
    let mut total = 1;
    let fn = || { total = total + 1; };
    fn();
    total;
  `;

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(2));
});

/*
test('function is unable to access parent variables declared after self', () => {
  const source = `
    let fn = || { total };
    let total = 1;
    fn();
  `;

  const result = doEvaluate(source);

  expect(result.inspect()).toEqual('Runtime error: Identifier not found: total');
});
*/

test('enclosed function variable state', () => {
  const source = `
    let counter = || {
      let mut total = 0;
      || total = total + 1;
    }();
    counter(); counter(); counter();
  `;

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(3));
});

test('function can call self recursively', () => {
  const source = `
    let repeat = |value, times| {
      if times > 1 {
        [value] + repeat(value, times - 1)
      } else {
        [value]
      }
    }
    repeat(1, 3);
  `;

  const result = doEvaluate(source);

  expect(result.inspect()).toEqual('[1, 1, 1]');
});

test('partially applied call expression', () => {
  const source = `
    let add = |x, y| { x + y };
    let inc = add(6);
    inc(1);
  `;

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(7));
});

test('partially applied call using placeholder', () => {
  const source = `
    let inc = _ + 1;
    inc(6);
  `;

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(7));
});

test('if expression', () => {
  const source = 'if 1 < 5 { 1 } else { 2 }';

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(1));
});

test('if expression (with let binding)', () => {
  const source = 'if let x = 1 { x } else { 2 }';

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(1));
});

test('function threading', () => {
  const source = `
    let add = |a, b| { a + b };
    let inc = add(1);
    1 |> add(1) |> |a| { a + 1 } |> inc |> _ + 1;
  `;

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(5));
});

test('function composition', () => {
  const source = `
    let add = |a, b| { a + b };
    let inc = add(1);
    let add4 = add(1) >> |a| { a + 1 } >> inc >> _ + 1;
    add4(1);
  `;

  const result = doEvaluate(source);

  expect(result).toEqual(new O.Integer(5));
});

describe('list indexing', () => {
  const cases = [
    {
      source: 'let list = [1, 2, 3]; list[1]',
      expected: '2',
      description: 'positive list index',
    },
    {
      source: 'let list = [1, 2, 3]; list[-1]',
      expected: '3',
      description: 'negative list index',
    },
    {
      source: 'let list = [1, 2, 3]; list[1..2]',
      expected: '[2]',
      description: 'bounded exclusive range list index',
    },
    {
      source: 'let list = [1, 2, 3]; list[1..=2]',
      expected: '[2, 3]',
      description: 'bounded inclusive range list index',
    },
    {
      source: 'let list = [1, 2, 3]; list[1..-1]',
      expected: '[2]',
      description: 'bounded range negative list index',
    },
    {
      source: 'let list = [1, 2, 3]; list[1..]',
      expected: '[2, 3]',
      description: 'unbounded range list index',
    },
    {
      source: 'let list = [1, 2, 3]; list[-2..]',
      expected: '[2, 3]',
      description: 'unbounded negative range list index',
    },
    {
      source: 'let list = [1, 2, 3]; list[3]',
      expected: 'nil',
      description: 'invalid list index',
    },
  ];

  cases.forEach(({ source, expected, description }) => {
    test(`${description}: ${source}`, () => {
      expect(doEvaluate(source).inspect()).toEqual(expected);
    });
  });
});

describe('set indexing', () => {
  const cases = [
    {
      source: 'let set = {1, 1.5, "hello", true, [1, 2, 3]}; set[1]',
      expected: '1',
      description: 'integer value',
    },
    {
      source: 'let set = {1, 1.5, "hello", true, [1, 2, 3]}; set[1.5]',
      expected: '1.5',
      description: 'decimal value',
    },
    {
      source: 'let set = {1, 1.5, "hello", true, [1, 2, 3]}; set["hello"]',
      expected: '"hello"',
      description: 'string value',
    },
    {
      source: 'let set = {1, 1.5, "hello", true, [1, 2, 3]}; set[true]',
      expected: 'true',
      description: 'boolean value',
    },
    {
      source: 'let set = {1, 1.5, "hello", true, [1, 2, 3]}; set[[1, 2, 3]]',
      expected: '[1, 2, 3]',
      description: 'list value',
    },
  ];

  cases.forEach(({ source, expected, description }) => {
    test(`${description}: ${source}`, () => {
      expect(doEvaluate(source).inspect()).toEqual(expected);
    });
  });
});

describe('dictionary indexing', () => {
  const cases = [
    {
      source:
        'let dictionary = #{1: "integer", 1.5: [1, 2, 3], "hello": "world", [3, 2, 1]: true}; dictionary[1]',
      expected: '"integer"',
      description: 'integer key',
    },
    {
      source:
        'let dictionary = #{1: "integer", 1.5: [1, 2, 3], "hello": "world", [3, 2, 1]: true}; dictionary[1.5]',
      expected: '[1, 2, 3]',
      description: 'decimal key',
    },
    {
      source:
        'let dictionary = #{1: "integer", 1.5: [1, 2, 3], "hello": "world", [3, 2, 1]: true}; dictionary["hello"]',
      expected: '"world"',
      description: 'string key',
    },
    {
      source:
        'let dictionary = #{1: "integer", 1.5: [1, 2, 3], "hello": "world", [3, 2, 1]: true}; dictionary[[3, 2, 1]]',
      expected: 'true',
      description: 'list key',
    },
    {
      source: 'let dictionary = #{}; dictionary["unknown"]',
      expected: 'nil',
      description: 'unknown key',
    },
  ];

  cases.forEach(({ source, expected, description }) => {
    test(`${description}: ${source}`, () => {
      expect(doEvaluate(source).inspect()).toEqual(expected);
    });
  });
});

describe('string indexing', () => {
  const cases = [
    {
      source: 'let string = "hello"; string[1]',
      expected: '"e"',
      description: 'positive string index',
    },
    {
      source: 'let string = "hello"; string[-1]',
      expected: '"o"',
      description: 'negative string index',
    },
    {
      source: 'let string = "hello"; string[1..2]',
      expected: '"e"',
      description: 'bounded exclusive range string index',
    },
    {
      source: 'let string = "hello"; string[1..=2]',
      expected: '"el"',
      description: 'bounded inclusive range string index',
    },
    {
      source: 'let string = "hello"; string[1..-1]',
      expected: '"ell"',
      description: 'bounded range negative string index',
    },
    {
      source: 'let string = "hello"; string[1..]',
      expected: '"ello"',
      description: 'unbounded range string index',
    },
    {
      source: 'let string = "hello"; string[-2..]',
      expected: '"lo"',
      description: 'unbounded negative range string index',
    },
    {
      source: 'let string = "hello"; string[5]',
      expected: 'nil',
      description: 'invalid string index',
    },
  ];

  cases.forEach(({ source, expected, description }) => {
    test(`${description}: ${source}`, () => {
      expect(doEvaluate(source).inspect()).toEqual(expected);
    });
  });
});

describe('string grapheme clusters', () => {
  const cases = [
    {
      source: '"👨‍👩‍👧‍👦"[0]',
      expected: '"👨‍👩‍👧‍👦"',
      description: 'family emoji is single grapheme',
    },
    {
      source: 'size("👨‍👩‍👧‍👦")',
      expected: '1',
      description: 'family emoji has size 1',
    },
    {
      source: '"a👨‍👩‍👧‍👦b"[1]',
      expected: '"👨‍👩‍👧‍👦"',
      description: 'emoji in middle of string',
    },
    {
      source: 'size("a👨‍👩‍👧‍👦b")',
      expected: '3',
      description: 'mixed ascii and emoji size',
    },
    {
      source: '"🇬🇧"[0]',
      expected: '"🇬🇧"',
      description: 'flag emoji is single grapheme',
    },
    {
      source: 'size("🇬🇧🇺🇸")',
      expected: '2',
      description: 'two flag emojis',
    },
    {
      source: 'first("👨‍👩‍👧‍👦abc")',
      expected: '"👨‍👩‍👧‍👦"',
      description: 'first returns entire emoji',
    },
    {
      source: 'last("abc👨‍👩‍👧‍👦")',
      expected: '"👨‍👩‍👧‍👦"',
      description: 'last returns entire emoji',
    },
    {
      source: 'rest("👨‍👩‍👧‍👦abc")',
      expected: '"abc"',
      description: 'rest skips entire emoji',
    },
    {
      source: 'take(2, "👨‍👩‍👧‍👦ab")',
      expected: '"👨‍👩‍👧‍👦a"',
      description: 'take with graphemes',
    },
    {
      source: 'skip(1, "👨‍👩‍👧‍👦ab")',
      expected: '"ab"',
      description: 'skip with graphemes',
    },
    {
      source: 'size("🇬🇧🇺🇸🇫🇷")',
      expected: '3',
      description: 'multiple flag emojis',
    },
    {
      source: 'list("👨‍👩‍👧‍👦🇬🇧a")',
      expected: '["👨‍👩‍👧‍👦", "🇬🇧", "a"]',
      description: 'list conversion preserves graphemes',
    },
    {
      source: '"é"[0]',
      expected: '"é"',
      description: 'combining character as single grapheme',
    },
    {
      source: 'size("café")',
      expected: '4',
      description: 'word with combining character',
    },
  ];

  cases.forEach(({ source, expected, description }) => {
    test(`${description}: ${source}`, () => {
      expect(doEvaluate(source).inspect()).toEqual(expected);
    });
  });
});

describe('ranges', () => {
  const cases = [
    {
      source: '1..5',
      expected: '[1, 2, 3, 4]',
      description: 'positive exclusive bounded',
    },
    {
      source: '1..=5',
      expected: '[1, 2, 3, 4, 5]',
      description: 'positive inclusive bounded',
    },
    {
      source: '1..',
      expected: '[1, 2, 3, ..∞]',
      description: 'unbound positive',
    },
    {
      source: '-5..5',
      expected: '[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4]',
      description: 'bounded exclusive negative to positive',
    },
    {
      source: '-5..=5',
      expected: '[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]',
      description: 'bounded inclusive negative to positive',
    },
    {
      source: '5..-5',
      expected: '[5, 4, 3, 2, 1, 0, -1, -2, -3, -4]',
      description: 'bounded exlusive positive to negative',
    },
    {
      source: '5..=-5',
      expected: '[5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5]',
      description: 'bounded inclusive positive to negative',
    },
  ];

  cases.forEach(({ source, expected, description }) => {
    test(`${description}: ${source}`, () => {
      expect(doEvaluate(source).inspect()).toEqual(expected);
    });
  });
});

describe('literal match expression', () => {
  const sut = `
    let sut = |x| match x {
      "1" { "1" }
      2 { "2" }
      3.5 { "3" }
      x { ["4", x] }
    };
  `;

  const cases = [
    {
      source: 'sut("1")',
      expected: '"1"',
    },
    {
      source: 'sut(2)',
      expected: '"2"',
    },
    {
      source: 'sut(3.5)',
      expected: '"3"',
    },
    {
      source: 'sut([4])',
      expected: '["4", [4]]',
    },
  ];

  cases.forEach(({ source, expected }) => {
    test(source, () => {
      expect(doEvaluate(`${sut} ${source}`).inspect()).toEqual(expected);
    });
  });
});

describe('list match expression', () => {
  const sut = `
    let sut = |x| match x {
      [] { ["1"] }
      [[1], [x], [y]] { ["2", 1, [x], [y]] }
      [[x], [y], [z]] { ["3", [x], [y], [z]] }
      [1] { ["4", 1] }
      [x] { ["5", x] }
      [1, x] { ["6", 1, x] }
      [x, y] { ["7", x, y] }
      [x, 1, ..y] { ["8", x, 1, y] }
      [x, y, ..z] { ["9", x, y, z] }
      _ { "10" }
    };
  `;

  const cases = [
    {
      source: 'sut([])',
      expected: '["1"]',
    },
    {
      source: 'sut([[1], [2], [3]])',
      expected: '["2", 1, [2], [3]]',
    },
    {
      source: 'sut([[2], [3], [4]])',
      expected: '["3", [2], [3], [4]]',
    },
    {
      source: 'sut([1])',
      expected: '["4", 1]',
    },
    {
      source: 'sut([2])',
      expected: '["5", 2]',
    },
    {
      source: 'sut([1, 2])',
      expected: '["6", 1, 2]',
    },
    {
      source: 'sut([2, 3])',
      expected: '["7", 2, 3]',
    },
    {
      source: 'sut([2, 1, 3, 4])',
      expected: '["8", 2, 1, [3, 4]]',
    },
    {
      source: 'sut([1, 2, 3, 4])',
      expected: '["9", 1, 2, [3, 4]]',
    },
    {
      source: 'sut("")',
      expected: '"10"',
    },
  ];

  cases.forEach(({ source, expected }) => {
    test(source, () => {
      expect(doEvaluate(`${sut} ${source}`).inspect()).toEqual(expected);
    });
  });
});

describe('prefix rest pattern match expression', () => {
  const sut = `
    let sut = |x| match x {
      [..init, last] { ["prefix", init, last] }
      _ { "no match" }
    };
  `;

  const cases = [
    {
      source: 'sut([1])',
      expected: '["prefix", [], 1]',
    },
    {
      source: 'sut([1, 2])',
      expected: '["prefix", [1], 2]',
    },
    {
      source: 'sut([1, 2, 3])',
      expected: '["prefix", [1, 2], 3]',
    },
    {
      source: 'sut([1, 2, 3, 4, 5])',
      expected: '["prefix", [1, 2, 3, 4], 5]',
    },
    {
      source: 'sut([])',
      expected: '"no match"',
    },
  ];

  cases.forEach(({ source, expected }) => {
    test(source, () => {
      expect(doEvaluate(`${sut} ${source}`).inspect()).toEqual(expected);
    });
  });
});

describe('prefix rest pattern with nested destructuring', () => {
  const sut = `
    let sut = |x| match x {
      [..init, [a, b]] { ["nested", init, a, b] }
      _ { "no match" }
    };
  `;

  const cases = [
    {
      source: 'sut([[1, 2]])',
      expected: '["nested", [], 1, 2]',
    },
    {
      source: 'sut([1, 2, [3, 4]])',
      expected: '["nested", [1, 2], 3, 4]',
    },
    {
      source: 'sut([[1, 2], [3, 4], [5, 6]])',
      expected: '["nested", [[1, 2], [3, 4]], 5, 6]',
    },
  ];

  cases.forEach(({ source, expected }) => {
    test(source, () => {
      expect(doEvaluate(`${sut} ${source}`).inspect()).toEqual(expected);
    });
  });
});

describe('prefix rest pattern with guard', () => {
  const sut = `
    let sut = |x| match x {
      [..init, last] if last > 10 { ["big", init, last] }
      [..init, last] { ["small", init, last] }
      _ { "no match" }
    };
  `;

  const cases = [
    {
      source: 'sut([1, 2, 15])',
      expected: '["big", [1, 2], 15]',
    },
    {
      source: 'sut([1, 2, 5])',
      expected: '["small", [1, 2], 5]',
    },
  ];

  cases.forEach(({ source, expected }) => {
    test(source, () => {
      expect(doEvaluate(`${sut} ${source}`).inspect()).toEqual(expected);
    });
  });
});

describe('middle rest pattern match expression', () => {
  const sut = `
    let sut = |x| match x {
      [first, ..middle, last] { ["middle", first, middle, last] }
      _ { "no match" }
    };
  `;

  const cases = [
    {
      source: 'sut([1, 2])',
      expected: '["middle", 1, [], 2]',
    },
    {
      source: 'sut([1, 2, 3])',
      expected: '["middle", 1, [2], 3]',
    },
    {
      source: 'sut([1, 2, 3, 4, 5])',
      expected: '["middle", 1, [2, 3, 4], 5]',
    },
    {
      source: 'sut([1])',
      expected: '"no match"',
    },
  ];

  cases.forEach(({ source, expected }) => {
    test(source, () => {
      expect(doEvaluate(`${sut} ${source}`).inspect()).toEqual(expected);
    });
  });
});

describe('middle rest pattern with multiple after elements', () => {
  const sut = `
    let sut = |x| match x {
      [first, ..middle, second_last, last] { ["multi", first, middle, second_last, last] }
      _ { "no match" }
    };
  `;

  const cases = [
    {
      source: 'sut([1, 2, 3])',
      expected: '["multi", 1, [], 2, 3]',
    },
    {
      source: 'sut([1, 2, 3, 4])',
      expected: '["multi", 1, [2], 3, 4]',
    },
    {
      source: 'sut([1, 2, 3, 4, 5])',
      expected: '["multi", 1, [2, 3], 4, 5]',
    },
    {
      source: 'sut([1, 2])',
      expected: '"no match"',
    },
  ];

  cases.forEach(({ source, expected }) => {
    test(source, () => {
      expect(doEvaluate(`${sut} ${source}`).inspect()).toEqual(expected);
    });
  });
});

test('unexhaustive match returns nil', () => {
  const source = `
    match "unknown" {
      "hello" { "1" }
      1 { "2" }
      2.0 { "3" }
    };
  `;

  expect(doEvaluate(source).inspect()).toEqual('nil');
});

test('match negative value', () => {
  const source = `
    match -1 {
      -1 { "-" }
      1 { "+" }
    };
  `;

  expect(doEvaluate(source).inspect()).toEqual('"-"');
});

describe('match expression with range', () => {
  const sut = `
    let sut = |x| match x {
      [2..4, 1] { "1" },
      [2.., -1] { "2" },
      2..4 { "3" }
      2.. { "4" }
    };
  `;

  const cases = [
    {
      source: 'sut([3, 1])',
      expected: '"1"',
    },
    {
      source: 'sut([5, -1])',
      expected: '"2"',
    },
    {
      source: 'sut(2)',
      expected: '"3"',
    },
    {
      source: 'sut(5)',
      expected: '"4"',
    },
  ];

  cases.forEach(({ source, expected }) => {
    test(source, () => {
      expect(doEvaluate(`${sut} ${source}`).inspect()).toEqual(expected);
    });
  });
});

describe('match expression with guards', () => {
  const sut = `
    let sut = |x| match x {
      [x] if x == 10 { "1" }
      [x, y] if x < y { ["2", x, y] }
      [x, y, ..z] if size(z) == 2 { ["3", x, y, z] }
      x if x > 10 { ["4", x] }
      _ { ["5"] }
    };
  `;

  const cases = [
    {
      source: 'sut([10])',
      expected: '"1"',
    },
    {
      source: 'sut([1, 2])',
      expected: '["2", 1, 2]',
    },
    {
      source: 'sut([1, 2, 3, 4])',
      expected: '["3", 1, 2, [3, 4]]',
    },
    {
      source: 'sut(15)',
      expected: '["4", 15]',
    },
    {
      source: 'sut(5)',
      expected: '["5"]',
    },
  ];

  cases.forEach(({ source, expected }) => {
    test(source, () => {
      expect(doEvaluate(`${sut} ${source}`).inspect()).toEqual(expected);
    });
  });
});

test('match expression followed by list literal', () => {
  const source = `
    let a = 1;
    let b = match a { 1 { 2 }, _ { 3 } };
    [a, b]
  `;

  const result = doEvaluate(source);

  expect(result.inspect()).toEqual('[1, 2]');
});

test('match case scoping does not leak variables', () => {
  const source = `
    let x = "outer";
    let result = match 1 {
      1 {
        let x = "inner";
        x
      }
    };
    [result, x]
  `;

  const result = doEvaluate(source);

  expect(result.inspect()).toEqual('["inner", "outer"]');
});

test('ensure that multiple placeholders are ignored', () => {
  const source = `
    let [_, _, value] = [1, 2, 3];
    value;
  `;

  const result = doEvaluate(source);

  expect(result.inspect()).toEqual('3');
});

describe('tail recursive function calls', () => {
  test('explicit return statement', () => {
    const source = `
      let fibonacci = |n| {
        let recur = |a, b, n| {
          if (n > 0) { return recur(b, a + b, n - 1) } else { a }
        };
        recur(0, 1, n);
      };
      fibonacci(50);
    `;

    const result = doEvaluate(source);

    expect(result.inspect()).toEqual('12586269025');
  });

  test('implicit end statement', () => {
    const source = `
      let fibonacci = |n| {
        let recur = |a, b, n| {
          if (n > 0) { recur(b, a + b, n - 1) } else { a }
        };
        recur(0, 1, n);
      };
      fibonacci(50);
    `;

    const result = doEvaluate(source);

    expect(result.inspect()).toEqual('12586269025');
  });
});

test('trailing lambda without call expression', () => {
  const source = `
    let mut sum = 0;
    [1, 2, 3] |> each |n| {
      sum = sum + n;
    }
    sum
  `;

  const result = doEvaluate(source);

  expect(result.inspect()).toEqual('6');
});

test('trailing lambda with call expression', () => {
  const source = `
    let fn = |greeting, fn| { fn(greeting) };
    fn("hello") |greeting| {
      greeting + "!" 
    };
  `;

  const result = doEvaluate(source);

  expect(result.inspect()).toEqual('"hello!"');
});

const doEvaluate = (source: string): O.Obj => {
  const lexer = new Lexer(source);
  const parser = new Parser(lexer);
  return evaluate(parser.parse(), new O.Environment());
};

describe('section attributes', () => {
  test('section stores attributes', () => {
    const source = '@slow test: { 1 }';
    const environment = new O.Environment();

    const lexer = new Lexer(source);
    const parser = new Parser(lexer);
    evaluate(parser.parse(), environment);

    const sections = environment.getSection('test');
    expect(sections).toHaveLength(1);
    expect(sections[0].hasAttribute('slow')).toBe(true);
    expect(sections[0].hasAttribute('fast')).toBe(false);
  });

  test('section without attributes has empty array', () => {
    const source = 'test: { 1 }';
    const environment = new O.Environment();

    const lexer = new Lexer(source);
    const parser = new Parser(lexer);
    evaluate(parser.parse(), environment);

    const sections = environment.getSection('test');
    expect(sections).toHaveLength(1);
    expect(sections[0].attributes).toEqual([]);
    expect(sections[0].hasAttribute('slow')).toBe(false);
  });

  test('section with multiple attributes', () => {
    const source = '@slow @experimental test: { 1 }';
    const environment = new O.Environment();

    const lexer = new Lexer(source);
    const parser = new Parser(lexer);
    evaluate(parser.parse(), environment);

    const sections = environment.getSection('test');
    expect(sections).toHaveLength(1);
    expect(sections[0].hasAttribute('slow')).toBe(true);
    expect(sections[0].hasAttribute('experimental')).toBe(true);
  });
});

describe('range iteration', () => {
  test('ascending non-inclusive range', () => {
    expect(doEvaluate('1..3 |> list').inspect()).toEqual('[1, 2]');
  });

  test('ascending inclusive range', () => {
    expect(doEvaluate('1..=3 |> list').inspect()).toEqual('[1, 2, 3]');
  });

  test('descending non-inclusive range', () => {
    expect(doEvaluate('3..1 |> list').inspect()).toEqual('[3, 2]');
  });

  test('descending inclusive range', () => {
    expect(doEvaluate('3..=1 |> list').inspect()).toEqual('[3, 2, 1]');
  });

  test('crossing zero descending non-inclusive', () => {
    expect(doEvaluate('1..-1 |> list').inspect()).toEqual('[1, 0]');
  });

  test('crossing zero descending inclusive', () => {
    expect(doEvaluate('1..=-1 |> list').inspect()).toEqual('[1, 0, -1]');
  });

  test('crossing zero ascending non-inclusive', () => {
    expect(doEvaluate('-1..1 |> list').inspect()).toEqual('[-1, 0]');
  });

  test('crossing zero ascending inclusive', () => {
    expect(doEvaluate('-1..=1 |> list').inspect()).toEqual('[-1, 0, 1]');
  });

  test('empty non-inclusive range', () => {
    expect(doEvaluate('3..3 |> list').inspect()).toEqual('[]');
  });
});

describe('range map iteration', () => {
  test('ascending non-inclusive with map', () => {
    expect(doEvaluate('1..3 |> map(|x| x * 2)').inspect()).toEqual('[2, 4]');
  });

  test('ascending inclusive with map', () => {
    expect(doEvaluate('1..=3 |> map(|x| x * 2)').inspect()).toEqual('[2, 4, 6]');
  });

  test('descending non-inclusive with map', () => {
    expect(doEvaluate('3..1 |> map(|x| x * 2)').inspect()).toEqual('[6, 4]');
  });

  test('descending inclusive with map', () => {
    expect(doEvaluate('3..=1 |> map(|x| x * 2)').inspect()).toEqual('[6, 4, 2]');
  });

  test('crossing zero descending with map', () => {
    expect(doEvaluate('1..-1 |> map(|x| x * 2)').inspect()).toEqual('[2, 0]');
  });

  test('crossing zero ascending with map', () => {
    expect(doEvaluate('-1..1 |> map(|x| x * 2)').inspect()).toEqual('[-2, 0]');
  });
});
