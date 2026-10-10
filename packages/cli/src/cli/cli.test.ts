import { describe, expect, it } from 'bun:test';
import { createCliProgram } from './program.js';
import { resolveCliConfig } from './options/resolveCliConfig.js';
import { runHeadless } from './headless.js';
import { themeManager } from '../themes/themeManager.js';
import type { ResolvedCliConfig } from './types.js';

describe('Steward CLI Core Engine (Hardcore Integration Test Suite)', () => {
  it('comprehensively validates flag parsing, configuration layering, theme activation, and execution dispatching', async () => {
    // 1. Layered Configuration & Precedence Test (Flags > Env > Settings > Defaults)
    const layeredConfig = await resolveCliConfig({
      flags: {
        model: 'anthropic/claude-3-7-sonnet',
        effort: 'high',
        tool: ['bash=false', 'websearch=on'],
        enableTool: ['read'],
        disableTool: ['glob'],
        autoApprove: true,
        theme: 'github',
        prompt: 'Fix critical bug in agent runner',
      },
      env: {
        STEWARD_MODEL: 'google/gemini-2.5-flash',
        STEWARD_EFFORT: 'low',
        STEWARD_THEME: 'default',
        STEWARD_AUTO_APPROVE: 'false',
      },
      customSettings: {
        version: 1,
        provider: 'openai',
        model: 'gpt-4o',
        theme: 'default',
        reasoningEffort: 'medium',
        tools: {
          read: false,
          glob: true,
          grep: false,
          webfetch: false,
          websearch: false,
          bash: true,
        },
        bash: {
          autoApprove: false,
          timeoutMs: 60000,
        },
      },
    });

    // Flags override environment variables and settings
    expect(layeredConfig.modelRef).toEqual({
      provider: 'anthropic',
      modelId: 'claude-3-7-sonnet',
    });
    expect(layeredConfig.reasoningEffort).toBe('high');
    expect(layeredConfig.theme).toBe('github');
    expect(layeredConfig.bash.autoApprove).toBe(true);
    expect(layeredConfig.prompt).toBe('Fix critical bug in agent runner');

    // Tool combinations:
    // base (customSettings): read=false, glob=true, grep=false, webfetch=false, websearch=false, bash=true
    // flags: bash=false, websearch=on, enableTool: [read], disableTool: [glob]
    expect(layeredConfig.tools).toEqual({
      read: true,
      glob: false,
      grep: false,
      webfetch: false,
      websearch: true,
      bash: false,
    });

    // 2. Headless Mode Dispatch Test with Positional Prompt Arguments
    let capturedHeadlessPrompt: string | undefined;
    let capturedHeadlessConfig: ResolvedCliConfig | undefined;

    const headlessProgram = createCliProgram({
      onHeadless: async (prompt, config) => {
        capturedHeadlessPrompt = prompt;
        capturedHeadlessConfig = config;
      },
    });

    await headlessProgram.parseAsync([
      'node',
      'steward',
      'Explain',
      'how',
      'AgentRunner',
      'works',
      '-m',
      'openrouter/deepseek/deepseek-r1',
      '-e',
      'max',
      '--theme',
      'github',
    ]);

    expect(capturedHeadlessPrompt).toBe('Explain how AgentRunner works');
    expect(capturedHeadlessConfig?.modelRef).toEqual({
      provider: 'openrouter',
      modelId: 'deepseek/deepseek-r1',
    });
    expect(capturedHeadlessConfig?.reasoningEffort).toBe('max');
    expect(capturedHeadlessConfig?.theme).toBe('github');
    expect(themeManager.theme.name).toBe('github');

    // 3. Interactive Mode Dispatch Test
    let capturedInteractiveConfig: ResolvedCliConfig | undefined;

    const interactiveProgram = createCliProgram({
      onInteractive: async (config) => {
        capturedInteractiveConfig = config;
      },
    });

    await interactiveProgram.parseAsync([
      'node',
      'steward',
      '-m',
      'google/gemini-2.5-flash',
      '-e',
      'low',
      '--theme',
      'default',
    ]);

    expect(capturedInteractiveConfig?.prompt).toBeUndefined();
    expect(capturedInteractiveConfig?.modelRef).toEqual({
      provider: 'google',
      modelId: 'gemini-2.5-flash',
    });
    expect(capturedInteractiveConfig?.reasoningEffort).toBe('low');
    expect(capturedInteractiveConfig?.theme).toBe('default');
    expect(themeManager.theme.name).toBe('default');

    // 4. Bare Model Name (no slash) fallback to default provider
    const bareModelConfig = await resolveCliConfig({
      flags: { model: 'gemini-2.5-flash' },
      customSettings: {
        version: 1,
        provider: 'google',
        model: 'gemini-flash-latest',
        theme: 'default',
        reasoningEffort: 'medium',
        tools: { read: true, glob: true, grep: true, webfetch: true, websearch: true, bash: true },
        bash: { autoApprove: false, timeoutMs: 60000 },
      },
    });
    expect(bareModelConfig.modelRef).toEqual({
      provider: 'google',
      modelId: 'gemini-2.5-flash',
    });

    // 5. Invalid option validations throw descriptive errors
    expect(() =>
      resolveCliConfig({
        flags: { effort: 'ultra-high' },
      }),
    ).toThrow(/Invalid reasoning effort/);

    expect(() =>
      resolveCliConfig({
        flags: { theme: 'solarized-dark' },
      }),
    ).toThrow(/Invalid theme/);

    expect(() =>
      resolveCliConfig({
        flags: { tool: ['unknownTool=true'] },
      }),
    ).toThrow(/Unknown tool/);
  });

  it('correctly formats and frames piped stdin with LLM optimizations', async () => {
    const { formatEffectivePrompt } = await import('./headless.js');

    // Case 1: Both user prompt and piped stdin
    const combined = formatEffectivePrompt(
      'Review these changes for regressions',
      'diff --git a/file.ts b/file.ts\n+const x = 1;',
    );
    expect(combined).toBe(
      '<piped_stdin>\ndiff --git a/file.ts b/file.ts\n+const x = 1;\n</piped_stdin>\n\nReview these changes for regressions',
    );

    // Case 2: Only piped stdin (no prompt)
    const pipedOnly = formatEffectivePrompt(undefined, 'error: unhandled exception in main.ts:12');
    expect(pipedOnly).toBe(
      'Please analyze and respond to the following input:\n\n<piped_stdin>\nerror: unhandled exception in main.ts:12\n</piped_stdin>',
    );

    // Case 3: Only user prompt (no piped stdin)
    const promptOnly = formatEffectivePrompt('Explain quantum computing', undefined);
    expect(promptOnly).toBe('Explain quantum computing');

    // Case 4: Neither (empty)
    const empty = formatEffectivePrompt('', '   ');
    expect(empty).toBeUndefined();
  });
});
