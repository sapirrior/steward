# READMEDOC Specification Standard (Human-Facing Package & Project READMEs)

The **READMEDOC Specification Standard** defines the mandatory structure, rules, and templates for writing clean, informative, and human-friendly `README.md` files across the repository (including package `README.md` files in `packages/*` and root `README.md`).

---

## 1. Core Philosophy & Separation of Concerns

- **Human-Centric:** `README.md` files are designed for human engineers, contributors, and package consumers. They focus on clear explanations, installation, usage, high-level architecture, and module responsibilities.
- **High-Level Architectural Map:** Instead of exhaustive, line-by-line API dictionaries (which belong exclusively in [NOTEDOC.md](file:///home/nolan/works/steward/NOTEDOC.md) / `NOTE.md`), a `README.md` provides an accessible overview of what major files and subsystems are responsible for.
- **Clean Markdown & Formatting:** Use structured headings, consistent badge styles, clean code snippets, and accessible tables.

---

## 2. Standard `README.md` Template

Every package `README.md` (e.g. `packages/<pkg>/README.md`) must adhere to this standard template:

````markdown
# @steward/<package-name>

<p align="center">
  <strong>Short, impactful one-line summary of what this package does.</strong>
</p>

---

## Overview

<1-2 paragraphs giving a clear, accessible overview of the package's single responsibility, why it exists, and its role within the larger Steward ecosystem.>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Installation & Setup](#installation--setup)
- [Usage & Quick Start](#usage--quick-start)
- [Module & Directory Structure](#module--directory-structure)
- [Deep Technical Documentation](#deep-technical-documentation)

---

## Key Features

- **Feature 1:** High-level description of key capability.
- **Feature 2:** High-level description of key capability.
- **Feature 3:** High-level description of key capability.

---

## Installation & Setup

```bash
bun add @steward/<package-name>
# or
npm install @steward/<package-name>
```

---

## Usage & Quick Start

```typescript
import { createModule } from "@steward/<package-name>";

const instance = createModule({
  /* options */
});
```

---

## Module & Directory Structure

High-level summary of the package's main files and directories and their primary responsibilities:

| Path / File | Responsibility | Description |
| :--- | :--- | :--- |
| `src/index.ts` | Package Entrypoint | Exports public API contracts, factory functions, and types. |
| `src/client.ts` | Core Client | Primary consumer interface for interacting with the subsystem. |
| `src/services/` | Subsystem Services | Manages persistent state, cache, and lifecycle management. |
| `src/utils/` | Helpers & Utilities | Pure helper functions for path formatting, parsing, and diffing. |

---

## Deep Technical Documentation

For complete, machine-actionable technical documentation, TypeScript symbol signatures, ASCII execution graphs, and operational invariants, refer to the agent-first **`NOTE.md`** files located in each subfolder per the **[NOTEDOC Specification](file:///home/nolan/works/steward/NOTEDOC.md)**.
````

---

## 3. Section-by-Section Guidelines

### 1. Title & Header
- Include the exact package or project name.
- Include a bold, focused summary phrase explaining the package's purpose.

### 2. Overview
- Clearly state what the package solves.
- Mention whether the package is zero-dependency or has specific runtime requirements (e.g., Bun, Node).

### 3. Table of Contents
- Keep markdown links clean and synchronized with actual section headings.

### 4. Installation & Usage
- Provide copy-pasteable, verified installation commands.
- Provide minimal, functional TypeScript examples demonstrating common entrypoints.

### 5. Module & Directory Structure
- Outline major directories and primary entrypoint files.
- Summarize what each file/folder is responsible for in plain, accessible language.
- Avoid dumping hundreds of internal functions; keep it focused on structural understanding.

### 6. Deep Technical Docs Pointer
- Always link to the per-folder `NOTE.md` ecosystem as defined in [NOTEDOC.md](file:///home/nolan/works/steward/NOTEDOC.md) for deep internal contracts.

---

## 4. Maintenance Checklist for Maintainers & Agents

When updating a package or adding a new package:
- [ ] Ensure the `README.md` exists and follows the READMEDOC template.
- [ ] Verify that installation and usage code snippets are syntactically valid and match current exports.
- [ ] Keep the Module & Directory Structure table updated with major file responsibilities.
- [ ] Confirm that deep technical notes remain delegated to per-folder `NOTE.md` files.
