## santa-lang Implementation

This is **Prancer**, a santa-lang reindeer implementation. santa-lang is a functional programming language designed for solving Advent of Code puzzles. Multiple implementations exist to explore different execution models.

## Project Overview

- **Prancer**: Tree-walking interpreter written in TypeScript
- Modular packages: `lang` (core), `cli` (binary), `web` (Next.js UI), `lambda` (AWS)
- Batteries-included standard library for AoC patterns

## Makefile

**Always use Makefile targets.** Never run build tools directly.

- Run `make help` to see all available targets
- `make lang/test` for running language tests
- `make can-release` before submitting a PR (runs all tests)
- All builds run inside Docker for reproducibility

This ensures consistent, reproducible builds across all environments.

## Setup

```bash
make lang/install       # Install lang dependencies
make cli/install        # Install CLI dependencies
make web/install        # Install web dependencies
make shell              # Enter Docker build environment
```

## Common Commands

```bash
make help               # Show available targets
make lang/test          # Run language tests
make cli/test           # Run CLI tests
make web/test           # Run web linting (ESLint)
make cli/build          # Build cross-platform CLI binaries
make web/build          # Build Next.js static site
make lambda/build       # Build Lambda layer
make can-release        # Run before submitting PR (all tests)
```

## Code Conventions

- **TypeScript**: Strict mode, ES2020 target
- **Testing**: Bun test framework, `.test.ts` suffix, colocated with source
- **Packages**: Bun workspaces with `file:` dependencies
- **Object System**: `O.Integer`, `O.Str`, `O.List`, `O.Dict`, `O.Set`, `O.Function`, `O.Err`
- **CLI Output**: text/json/jsonl modes per specification
- **Error Handling**: Return `O.Err` instances, no exceptions for user code

## Tests & CI

- **CI** (`test.yml`): Runs `make can-release` on ubuntu-24.04
- **Build** (`build.yml`): CLI binaries, Docker, web static, Lambda layer
- Auto-updates `draft-release` branch after tests pass

## PR & Workflow Rules

- **Branches**: `main` for development, `draft-release` auto-updated
- **Commit format**: Conventional commits (feat:, fix:, refactor:, etc.)
- **Release**: release-drafter generates notes, publishes Docker to ghcr.io

## Security & Gotchas

- **Bun runtime**: CLI uses `bun build --compile` for standalone binaries
- **AOC session**: `SANTA_CLI_SESSION_TOKEN` env var for `aoc://` URL support
- **Docker builds**: All builds run inside Docker for reproducibility
- **Web build**: Next.js 12.2.4 with transpile-modules for local lang package
- **File dependencies**: Each subpackage has separate node_modules; lang is `file:` dependency

## Related Implementations

Other santa-lang reindeer (for cross-reference and consistency checks):

| Codename | Type | Language | Local Path | Repository |
|----------|------|----------|------------|------------|
| **Comet** | Tree-walking interpreter | Rust | `~/Projects/santa-lang-comet` | `github.com/eddmann/santa-lang-comet` |
| **Blitzen** | Bytecode VM | Rust | `~/Projects/santa-lang-blitzen` | `github.com/eddmann/santa-lang-blitzen` |
| **Dasher** | LLVM native compiler | Rust | `~/Projects/santa-lang-dasher` | `github.com/eddmann/santa-lang-dasher` |
| **Donner** | JVM bytecode compiler | Kotlin | `~/Projects/santa-lang-donner` | `github.com/eddmann/santa-lang-donner` |
| **Prancer** | Tree-walking interpreter | TypeScript | `~/Projects/santa-lang-prancer` | `github.com/eddmann/santa-lang-prancer` |
| **Vixen** | Embedded bytecode VM | C | `~/Projects/santa-lang-vixen` | `github.com/eddmann/santa-lang-vixen` |

Language specification and documentation: `~/Projects/santa-lang` or `github.com/eddmann/santa-lang`
