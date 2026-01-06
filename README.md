<p align="center"><a href="https://eddmann.com/santa-lang/"><img src="./docs/logo.png" alt="santa-lang" width="400px" /></a></p>

# santa-lang Prancer

Tree-walking interpreter implementation of [santa-lang](https://eddmann.com/santa-lang/), written in TypeScript.

## Overview

santa-lang is a functional, expression-oriented programming language designed for solving Advent of Code puzzles. This TypeScript implementation provides a tree-walking interpreter.

All santa-lang implementations support the same language features:

- First-class functions and closures with tail-call optimization
- Pipeline and composition operators for expressive data flow
- Persistent immutable data structures
- Lazy sequences and infinite ranges
- Pattern matching with guards
- [Rich built-in function library](https://eddmann.com/santa-lang/builtins/)
- AoC runner with automatic input fetching

Multiple runtime targets are available: CLI and AWS Lambda.

## Architecture

```
Source Code → Lexer → Parser → Evaluator → Result
                                   ↓
                           Environment (Scopes)
```

| Component       | Description                                          |
| --------------- | ---------------------------------------------------- |
| **Lexer**       | Tokenizes source into keywords, operators, literals  |
| **Parser**      | Builds an Abstract Syntax Tree (AST)                 |
| **Evaluator**   | Tree-walking interpreter that executes the AST       |
| **Environment** | Manages variable bindings and closures across scopes |

For detailed implementation internals, see [ARCHITECTURE.md](docs/ARCHITECTURE.md).

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

# Build web application
make web/build

# Build Lambda layer
make lambda/build
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
│   │   ├── evaluator/     # Tree-walking interpreter
│   │   └── runner/        # AoC runner support
│   ├── cli/               # Command-line interface
│   ├── web/               # Web application (Next.js)
│   └── lambda/            # AWS Lambda runtime
└── examples/              # Example AoC solutions
```

## Other Reindeer

The language has been implemented multiple times to explore different execution models and technologies.

| Codename | Type | Language |
|----------|------|----------|
| [Comet](https://github.com/eddmann/santa-lang-comet) | Tree-walking interpreter | Rust |
| [Blitzen](https://github.com/eddmann/santa-lang-blitzen) | Bytecode VM | Rust |
| [Dasher](https://github.com/eddmann/santa-lang-dasher) | LLVM native compiler | Rust |
| [Donner](https://github.com/eddmann/santa-lang-donner) | JVM bytecode compiler | Kotlin |
| [Vixen](https://github.com/eddmann/santa-lang-vixen) | Embedded bytecode VM | C |
| [Prancer](https://github.com/eddmann/santa-lang-prancer) | Tree-walking interpreter | TypeScript |
