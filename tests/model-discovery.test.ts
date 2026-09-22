import { describe, expect, it } from 'bun:test';
import { NON_CHAT_MODEL_KEYWORDS } from '../src/packages/agents/src/models/discovery.js';

describe('Model Discovery Keyword Filter', () => {
  it('correctly filters out non-chat modalities and specialized endpoints', () => {
    // Non-chat models that MUST be filtered out
    expect(NON_CHAT_MODEL_KEYWORDS.test('text-embedding-3-small')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('text-embedding-ada-002')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('embedding-001')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('gemini-embedding-2')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('dall-e-3')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('imagen-3.0')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('veo-2.0')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('whisper-1')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('tts-1-hd')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('gpt-4o-transcribe')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('gpt-4o-audio-preview')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('grok-imagine-image-2.0')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('grok-imagine-video-1.5')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('mistral-embed')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('mistral-moderation-latest')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('omni-moderation-latest')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('babbage-002')).toBe(true);
    expect(NON_CHAT_MODEL_KEYWORDS.test('davinci-002')).toBe(true);
  });

  it('keeps textual and reasoning chat models across old and future generations', () => {
    // Current and future chat/code/reasoning models that MUST pass
    expect(NON_CHAT_MODEL_KEYWORDS.test('gpt-4o')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('gpt-4.5-preview')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('gpt-5')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('gpt-5.6-sol')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('o1')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('o3-mini')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('o4-high')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('claude-3-7-sonnet-20250219')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('claude-opus-5')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('gemini-2.5-pro')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('gemini-3.0-flash')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('grok-2-1212')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('grok-3')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('deepseek-chat')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('deepseek-reasoner')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('codestral-latest')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('mistral-large-latest')).toBe(false);
    expect(NON_CHAT_MODEL_KEYWORDS.test('qwen2.5-coder:32b')).toBe(false);
  });
});
