#!/usr/bin/env node
import { setupGlobalErrorHandlers } from '@steward/agent';
import { run } from './cli/index.js';

// Initialize production-grade global error handlers
setupGlobalErrorHandlers();

// Auto-run entrypoint
run();
