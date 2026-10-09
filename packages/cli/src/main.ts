#!/usr/bin/env node
/**
 * Steward CLI Entrypoint
 */
import { createCliProgram } from './cli/index.js';

const program = createCliProgram();
await program.parseAsync(process.argv);
