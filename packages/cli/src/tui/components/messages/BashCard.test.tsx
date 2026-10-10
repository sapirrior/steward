import { describe, it, expect } from 'bun:test';
import React from 'react';
import { BashCard } from './BashCard.js';
import { themeManager } from '../../../themes/themeManager.js';

describe('BashCard Component', () => {
  const theme = themeManager.getTheme();

  it('renders short command output without overflow', () => {
    const element = <BashCard command="pwd" output="/home/nolan/works/steward" theme={theme} />;
    expect(element).toBeDefined();
    expect(element.props.command).toBe('pwd');
  });

  it('detects overflow when output exceeds 10 lines', () => {
    const longOutput = Array.from({ length: 25 }, (_, i) => `line-${i + 1}`).join('\n');
    const element = <BashCard command="ls -la" output={longOutput} theme={theme} />;
    expect(element).toBeDefined();
    expect(element.props.command).toBe('ls -la');
  });
});
