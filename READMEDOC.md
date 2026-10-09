# READMEDOC Specification Standard

The **READMEDOC Specification Standard** defines the mandatory architectural documentation protocol for codebases in the Steward repository.

It supersedes and replaces fragmented per-folder note conventions (such as `NOTEDOC.md` and `NOTE.md`) with a unified, comprehensive, package-level documentation model.

---

## 1. Core Philosophy: One Unified Doc for Both AI and Humans

> **"One Doc to Rule Them All"**: Technical documentation must not be fragmented into dozens of artificial, isolated `NOTE.md` files. A package must provide a single, exhaustive, master `README.md` that enables **anyone—human engineer or autonomous AI agent—to completely master the package from start to finish without needing any other documentation.**

### Why `NOTE.md` Fragmentation Was Deprecated
- **Context Fragmentation:** Scattering notes across dozens of leaf folders forces AI agents and human developers to traverse multiple files just to understand a single subsystem.
- **Maintenance Drift:** When every folder has its own note, subtle changes to cross-cutting concerns frequently leave child notes stale, inaccurate, and neglected.
- **Poor Developer Experience:** Human developers read `README.md` files; they do not browse nested `NOTE.md` files. Having separate docs creates a dual-reality where humans and AI operate on divergent mental models.

### The READMEDOC Solution
- **Single Source of Truth:** The package `README.md` (e.g. `packages/tui/README.md`) is the authoritative guide, architecture manual, API reference, and troubleshooting cookbook.
- **Deep & Actionable:** Instead of a superficial overview, the `README.md` is deeply technical, featuring ASCII architectural diagrams, full TypeScript signatures, copy-pasteable examples, and edge-case guides.
- **Deterministic for AI Agents:** AI agents read the package `README.md` at the start of a task to gain full context on design invariants, module boundaries, hooks, elements, and operational constraints in one single read.

---

## 2. Universal Invariants

### Invariant 1: Package-Level Authority
Every workspace package (e.g., `packages/tui`, `packages/ai`, `packages/agent`, etc.) **MUST** maintain an exhaustive, top-level `README.md`. There are no per-folder `NOTE.md` files permitted.

### Invariant 2: Complete Self-Containment
A package's `README.md` must be self-contained. Anyone reading it must be able to understand:
1. Why the package exists and its core philosophy.
2. Architecture, data flow, and runtime mechanics (via ASCII diagrams).
3. Public API reference (components, elements, hooks, classes, functions, options).
4. Code examples ranging from Hello World to advanced real-world patterns.
5. Known edge cases, terminal UX gotchas, and practical engineering tips (e.g., fast paste handling, cursor sync, resize reflow).
6. Directory structure and internal module boundaries.

### Invariant 3: Mandatory ASCII Modeling
Every package `README.md` must visually articulate its architecture, data pipeline, and state transitions using character-based ASCII diagrams. ASCII is universally readable across terminal pagers, Markdown previewers, and AI tokenizers.

### Invariant 4: Zero Documentation Drift
Whenever public APIs, internal flows, hooks, elements, or behavioral edge cases are added, modified, or fixed, the package's `README.md` **MUST** be updated within the same commit/turn.

---

## 3. Standard Schema for Package `README.md`

Every package `README.md` should adhere to this standard, guide-driven structure:

```markdown
# Package Name (`@steward/<package>`)

<One-sentence elevator pitch and key badges / metrics>

---

## 1. Overview & Architecture

### High-Level Mental Model
<What problem does this package solve? Why does it exist?>

### Architecture & Data Flow (ASCII Diagram)
<Clear ASCII diagram showing components, flow of data, reconciliation, rendering, etc.>

### Key Technical Invariants
<List of guaranteed invariants, e.g. zero external dependencies, flicker-free alternate screen, etc.>

---

## 2. Quick Start & Basic Usage

<Minimal, copy-pasteable runnable example with imports and runner execution.>

---

## 3. Core Concepts & Mental Model

<Explain the lifecycle, rendering pipeline, scheduling, state model, or protocol in depth.>

---

## 4. API & Component / Element Reference

<Comprehensive catalog of every exported element/component/class.>
- Props table with types, defaults, descriptions.
- Behavior, layout rules, inheritance, and styling.
- Runnable snippets for each component.

---

## 5. Hooks / Utilities Reference

<Comprehensive catalog of every exported hook or utility function.>
- Signature, parameter breakdown, return value.
- Constraints, lifecycle behavior, re-render rules.
- Practical usage examples.

---

## 6. Advanced Patterns & Practical Guides

<Detailed guides for complex scenarios.>
- State management, context trees, error boundaries.
- Static history reflow, multi-column layouts, custom render loops.

---

## 7. Real-World Gotchas, Tips & Edge Cases

<Crucial practical learnings that save hours of debugging.>
- Example: Fast paste & bracketed paste buffer handling.
- Example: Terminal cursor synchronization with mutable ref mirrors.
- Example: Line-break normalization to prevent premature submission.
- Example: Resize reflow and terminal coordinate boundaries.

---

## 8. Directory & Module Map

<Clean directory tree mapping source files to their responsibilities and module boundaries.>

---

## 9. Verification & Testing

<Commands to test, lint, and verify the package.>
```

---

## 4. Guide Writing Principles

1. **Be Specific, Not Abstract:** Show real TypeScript types and complete code snippets rather than pseudocode.
2. **Explain the "Why":** Document the rationale behind architectural choices (e.g. why 1D flex math is used instead of external Yoga layout).
3. **Document Failure Modes & Edge Cases:** Every terminal or async system has gotchas (paste tearing, race conditions, escape sequences). Document these prominently in the "Real-World Gotchas & Tips" section.
4. **Keep Tests and Documentation Colocated with Code:** Unit tests remain colocated alongside source files (`*.test.ts`), while `README.md` serves as the living manual.

---

## 5. Verification Protocol for AI Coding Agents

When working on any package in this repository:
1. **Read Package `README.md` First:** Before writing or editing code, read the package's `README.md` to understand its architecture, exported APIs, and invariants.
2. **Do Not Create `NOTE.md` Files:** Never create per-folder `NOTE.md` files. If you see old `NOTE.md` files in a package, migrate any unique insights into the package's `README.md` and delete them.
3. **Synchronize On Change:** Any code change that affects exported types, component props, hooks, layout behavior, or terminal interactions must immediately update the package `README.md` in the same commit.
4. **Follow Conventional Commits:** When updating documentation, use `docs(<package>): ...`.
