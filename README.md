<p align="center"><a href="https://eddmann.com/santa-lang/"><img src="./docs/logo.png" alt="santa-lang" width="400px" /></a></p>

# santa-lang Prancer

Tree-walking interpreter implementation of [santa-lang](https://eddmann.com/santa-lang/), written in TypeScript.

## Overview

santa-lang is a functional, expression-oriented programming language designed for solving Advent of Code puzzles. This TypeScript implementation provides:

- Tree-walking interpreter with tail-call optimization (TCO)
- Persistent immutable data structures
- First-class functions and closures
- Lazy sequences and infinite ranges
- Pattern matching with guards
- [70+ built-in functions](https://eddmann.com/santa-lang/builtins/)
- AoC runner with automatic input fetching

## Installation

### Docker

```bash
docker pull ghcr.io/eddmann/santa-lang-prancer:cli-latest
docker run --rm ghcr.io/eddmann/santa-lang-prancer:cli-latest --help
```

### Release Binaries

Download pre-built binaries from [GitHub Releases](https://github.com/eddmann/santa-lang-prancer/releases):

| Platform              | Artifact                                       |
| --------------------- | ---------------------------------------------- |
| Linux (x86_64)        | `santa-lang-prancer-cli-{version}-linux-amd64` |
| Linux (ARM64)         | `santa-lang-prancer-cli-{version}-linux-arm64` |
| macOS (Intel)         | `santa-lang-prancer-cli-{version}-macos-amd64` |
| macOS (Apple Silicon) | `santa-lang-prancer-cli-{version}-macos-arm64` |

### Web Editor

Try santa-lang in your browser: [eddmann.com/santa-lang-prancer](https://eddmann.com/santa-lang-prancer/)

### AWS Lambda

Lambda layer available: `santa-lang-prancer-lambda-{version}.zip`

## Usage

```bash
# Run a solution
santa-cli solution.santa

# Run tests defined in a solution
santa-cli -t solution.santa

# Evaluate inline code
santa-cli -e '1 + 2'

# Interactive REPL
santa-cli -r
```

## Example

Here's a complete Advent of Code solution (2015 Day 1):

```santa
input: read("aoc://2015/1")

part_one: {
  input |> fold(0) |floor, direction| {
    if direction == "(" { floor + 1 } else { floor - 1 };
  }
}

part_two: {
  zip(1.., input) |> fold(0) |floor, [index, direction]| {
    let next_floor = if direction == "(" { floor + 1 } else { floor - 1 };
    if next_floor < 0 { break index } else { next_floor };
  }
}

test: {
  input: "()())"
  part_one: -1
  part_two: 5
}
```

Key language features shown:

- **`input:`** / **`part_one:`** / **`part_two:`** - AoC runner sections
- **`|>`** - Pipeline operator (thread value through functions)
- **`fold`** - Reduce with early exit support via `break`
- **`test:`** - Inline test cases with expected values

## Building

Requires [Bun](https://bun.sh/) or use Docker:

```bash
# Install dependencies
make lang/install
make cli/install

# Run tests
make lang/test
make cli/test

# Build CLI binaries
make cli/build
```

## Development

Run `make help` to see all available targets:

```bash
make help          # Show all targets
make shell         # Interactive shell in Docker build environment
make lang/test     # Run language tests
make cli/test      # Run CLI tests
make cli/build     # Build CLI binaries
make web/build     # Build web application
make lambda/build  # Build Lambda layer
```

## Project Structure

```
├── src/
│   ├── lang/              # Core language library
│   │   ├── lexer/         # Tokenization
│   │   ├── parser/        # AST construction
│   │   └── evaluator/     # Tree-walking interpreter
│   ├── cli/               # Command-line interface
│   ├── web/               # Web application (Next.js)
│   └── lambda/            # AWS Lambda runtime
└── examples/              # Example AoC solutions
```

## See Also

- [eddmann/santa-lang](https://github.com/eddmann/santa-lang) - Language specification/documentation
- [eddmann/santa-lang-editor](https://github.com/eddmann/santa-lang-editor) - Web-based editor
- [eddmann/santa-lang-prancer](https://github.com/eddmann/santa-lang-prancer) - Tree-walking interpreter in TypeScript (Prancer)
- [eddmann/santa-lang-comet](https://github.com/eddmann/santa-lang-comet) - Tree-walking interpreter in Rust (Comet)
- [eddmann/santa-lang-blitzen](https://github.com/eddmann/santa-lang-blitzen) - Bytecode VM in Rust (Blitzen)
