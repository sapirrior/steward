import { describe, it, expect } from 'bun:test';
import { buildSystemPrompt } from '../src/packages/agents/src/engine/system-prompt.js';

describe('System Prompt Structure & Invariants', () => {
  it('should contain concise agent identity and core operating principles', () => {
    const prompt = buildSystemPrompt({
      cwd: '/workspace/steward',
    });

    expect(prompt).toContain('You are Steward, an interactive software-engineering agent');
    expect(prompt).toContain('Assist with defensive security tasks only');
    expect(prompt).toContain('# Operating Principles');
    expect(prompt).toContain('Inspect before editing');
    expect(prompt).toContain('Minimal and idiomatic');
    expect(prompt).toContain('Verify your changes');
    expect(prompt).toContain(
      'Never commit git changes unless the user explicitly requests you to commit',
    );
    expect(prompt).toContain('file_path:line_number');
  });

  it('does not contain legacy todo or plan policy sections', () => {
    const prompt = buildSystemPrompt({
      cwd: '/workspace/steward',
    });

    expect(prompt).not.toContain('Task and Plan Management (Todos)');
    expect(prompt).not.toContain('TodoWrite');
    expect(prompt).not.toContain('TodoUpdate');
    expect(prompt).not.toContain('TodoRead');
    expect(prompt).not.toContain('.steward/plans/');
    expect(prompt).not.toContain('◉');
    expect(prompt).not.toContain('WebFetch');
  });

  it('should contain on-demand skill policy and not dynamically inject skill catalogs', () => {
    const prompt = buildSystemPrompt({
      cwd: '/workspace/steward',
    });

    expect(prompt).toContain('# Specialized Skills Policy');
    expect(prompt).toContain('SkillList');
    expect(prompt).toContain('SkillRead');
    expect(prompt).not.toContain('<skills>');
    expect(prompt).not.toContain('using read_file before proceeding');
  });

  it('should correctly format runtime environment block with provided cwd and platform', () => {
    const testCwd = '/custom/test/project';
    const prompt = buildSystemPrompt({
      cwd: testCwd,
    });

    expect(prompt).toContain(`Working directory: ${testCwd}`);
    expect(prompt).toContain(`Platform: ${process.platform}`);
    expect(prompt).toContain("Today's date:");
  });

  it('should append user_defined_rules when configured', () => {
    const prompt = buildSystemPrompt({
      cwd: '/workspace/steward',
      userRules: ['Always format with prettier', 'Never use console.log in prod'],
    });

    expect(prompt).toContain('<user_defined_rules>');
    expect(prompt).toContain('- Always format with prettier');
    expect(prompt).toContain('- Never use console.log in prod');
  });

  it('should append additional_instructions when provided', () => {
    const prompt = buildSystemPrompt({
      cwd: '/workspace/steward',
      extraInstructions: 'Session specific context goes here.',
    });

    expect(prompt).toContain('<additional_instructions>');
    expect(prompt).toContain('Session specific context goes here.');
  });

  it('should keep prompt size well under the 10KB ceiling', () => {
    const prompt = buildSystemPrompt({
      cwd: '/workspace/steward',
    });

    const byteLength = Buffer.byteLength(prompt, 'utf-8');
    expect(byteLength).toBeLessThan(10 * 1024);
  });
});
