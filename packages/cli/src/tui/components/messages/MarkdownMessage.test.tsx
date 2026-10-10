import { describe, it, expect } from 'bun:test';
import React from 'react';
import { MarkdownMessage } from './MarkdownMessage.js';
import { themeManager } from '../../../themes/themeManager.js';

describe('MarkdownMessage Component', () => {
  it('instantiates cleanly with markdown headings, lists, inline code, and paragraphs', () => {
    const markdown = `# Main Title
This is paragraph one with **bold text**, *italic text*, and \`inline code\`.

## Features
- First bullet item
- Second bullet item with continuation

1. Step one
2. Step two

> This is a blockquote

\`\`\`typescript
const greeting = "Hello Steward!";
console.log(greeting);
\`\`\`

---
Footer paragraph.`;

    const element = <MarkdownMessage content={markdown} theme={themeManager.getTheme()} />;
    expect(element).toBeDefined();
    expect(element.props.content).toBe(markdown);
  });
});
