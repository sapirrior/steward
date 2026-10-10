/** @jsxImportSource stitchable */
import { Box, Text } from 'stitchable';
import type { Theme } from '../../themes/themeTypes.js';

export interface MarkdownMessageProps {
  content: string;
  theme: Theme;
}

type Block =
  | { type: 'code'; language: string; content: string }
  | { type: 'heading'; level: number; content: string }
  | { type: 'unordered_list'; items: string[] }
  | { type: 'ordered_list'; items: string[]; startNumber: number }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'divider' }
  | { type: 'paragraph'; text: string };

/**
 * Parses raw markdown text into structural terminal layout blocks.
 */
function parseMarkdownBlocks(rawText: string): Block[] {
  const lines = rawText.split(/\r?\n/);
  const blocks: Block[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code Fence (```)
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing ```
      blocks.push({
        type: 'code',
        language,
        content: codeLines.join('\n'),
      });
      continue;
    }

    // 2. Empty line
    if (trimmed.length === 0) {
      i++;
      continue;
    }

    // 3. Horizontal Rule
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'divider' });
      i++;
      continue;
    }

    // 4. Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 5. Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'blockquote',
        lines: quoteLines,
      });
      continue;
    }

    // 6. Unordered List (- , * , + )
    const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
    if (ulMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\s*)([-*+])\s+(.*)$/);
        if (itemMatch) {
          items.push(itemMatch[3]);
          i++;
        } else if (
          lines[i].trim().length > 0 &&
          !lines[i].startsWith('#') &&
          !lines[i].startsWith('```') &&
          !lines[i].trim().startsWith('>') &&
          !lines[i].match(/^\s*\d+\.\s+/)
        ) {
          // Continuation of current list item
          if (items.length > 0) {
            items[items.length - 1] += ' ' + lines[i].trim();
          }
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: 'unordered_list', items });
      continue;
    }

    // 7. Ordered List (1. , 2. )
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (olMatch) {
      const startNumber = parseInt(olMatch[2], 10);
      const items: string[] = [];
      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\s*)\d+\.\s+(.*)$/);
        if (itemMatch) {
          items.push(itemMatch[2]);
          i++;
        } else if (
          lines[i].trim().length > 0 &&
          !lines[i].startsWith('#') &&
          !lines[i].startsWith('```') &&
          !lines[i].trim().startsWith('>') &&
          !lines[i].match(/^(\s*)([-*+])\s+/)
        ) {
          // Continuation of current list item
          if (items.length > 0) {
            items[items.length - 1] += ' ' + lines[i].trim();
          }
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: 'ordered_list', items, startNumber });
      continue;
    }

    // 8. Paragraph (aggregate consecutive text lines until blank line or special block)
    const pLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim().length > 0 &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !/^(\-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !lines[i].match(/^\s*[-*+]\s+/) &&
      !lines[i].match(/^\s*\d+\.\s+/)
    ) {
      pLines.push(lines[i]);
      i++;
    }
    if (pLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: pLines.join('\n'),
      });
    }
  }

  return blocks;
}

/**
 * Renders inline styled markdown tokens (bold, italic, inline code, links).
 */
function renderInlineText(text: string, theme: Theme) {
  const colors = theme.colors;
  const elements: any[] = [];

  // Regex matches `code`, **bold**, *italic*, or [link](url)
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      elements.push(
        <Text key={`plain-${keyIndex++}`} color={colors.text}>
          {plain}
        </Text>,
      );
    }

    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      // Inline Code: highlighted with success (green) or accent
      elements.push(
        <Text key={`code-${keyIndex++}`} color={colors.success}>
          {token.slice(1, -1)}
        </Text>,
      );
    } else if (
      (token.startsWith('**') && token.endsWith('**')) ||
      (token.startsWith('__') && token.endsWith('__'))
    ) {
      // Bold
      elements.push(
        <Text key={`bold-${keyIndex++}`} bold color={colors.text}>
          {token.slice(2, -2)}
        </Text>,
      );
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      // Italic
      elements.push(
        <Text key={`italic-${keyIndex++}`} italic color={colors.text}>
          {token.slice(1, -1)}
        </Text>,
      );
    } else if (token.startsWith('[')) {
      // Link: [text](url)
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        elements.push(
          <Text key={`link-${keyIndex++}`} underline color={colors.accent}>
            {linkMatch[1]}
          </Text>,
        );
      } else {
        elements.push(
          <Text key={`tok-${keyIndex++}`} color={colors.text}>
            {token}
          </Text>,
        );
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(
      <Text key={`plain-${keyIndex++}`} color={colors.text}>
        {text.slice(lastIndex)}
      </Text>,
    );
  }

  return elements.length > 0 ? elements : text;
}

export function MarkdownMessage({ content, theme }: MarkdownMessageProps) {
  const colors = theme.colors;
  const blocks = parseMarkdownBlocks(content);

  return (
    <Box flexDirection="column" width="100%">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const prefix = '#'.repeat(block.level) + ' ';
            return (
              <Box key={`h-${idx}`} marginTop={idx > 0 ? 1 : 0} marginBottom={1}>
                <Text bold color={colors.accent}>
                  {prefix}
                </Text>
                <Text bold color={colors.text}>
                  {block.content}
                </Text>
              </Box>
            );
          }

          case 'unordered_list': {
            return (
              <Box key={`ul-${idx}`} flexDirection="column" marginBottom={1}>
                {block.items.map((item, itemIdx) => (
                  <Box key={`item-${itemIdx}`} flexDirection="row">
                    <Text color={colors.accent}>• </Text>
                    <Box flexGrow={1}>
                      <Text color={colors.text} wrap="wrap">
                        {renderInlineText(item, theme)}
                      </Text>
                    </Box>
                  </Box>
                ))}
              </Box>
            );
          }

          case 'ordered_list': {
            return (
              <Box key={`ol-${idx}`} flexDirection="column" marginBottom={1}>
                {block.items.map((item, itemIdx) => (
                  <Box key={`item-${itemIdx}`} flexDirection="row">
                    <Text color={colors.accent}>{block.startNumber + itemIdx}. </Text>
                    <Box flexGrow={1}>
                      <Text color={colors.text} wrap="wrap">
                        {renderInlineText(item, theme)}
                      </Text>
                    </Box>
                  </Box>
                ))}
              </Box>
            );
          }

          case 'blockquote': {
            return (
              <Box
                key={`quote-${idx}`}
                flexDirection="column"
                marginBottom={1}
                marginLeft={1}
                paddingLeft={1}
              >
                {block.lines.map((line, lIdx) => (
                  <Box key={`qline-${lIdx}`} flexDirection="row">
                    <Text color={colors.accent}>│ </Text>
                    <Text italic color={colors.textMuted} wrap="wrap">
                      {line}
                    </Text>
                  </Box>
                ))}
              </Box>
            );
          }

          case 'code': {
            return (
              <Box
                key={`code-${idx}`}
                flexDirection="column"
                backgroundColor={colors.cardBackground}
                borderStyle="round"
                borderColor={colors.border}
                paddingX={1}
                paddingY={0}
                marginTop={1}
                marginBottom={1}
              >
                {block.language ? (
                  <Box marginBottom={0}>
                    <Text bold color={colors.textDim}>
                      {block.language}
                    </Text>
                  </Box>
                ) : null}
                <Box flexDirection="column">
                  {block.content.split('\n').map((codeLine, cIdx) => (
                    <Text key={`c-${cIdx}`} color={colors.text}>
                      {codeLine.length > 0 ? codeLine : ' '}
                    </Text>
                  ))}
                </Box>
              </Box>
            );
          }

          case 'divider': {
            return (
              <Box key={`div-${idx}`} marginY={1}>
                <Text color={colors.border}>────────────────────────────────────────</Text>
              </Box>
            );
          }

          case 'paragraph':
          default: {
            return (
              <Box
                key={`p-${idx}`}
                flexDirection="column"
                marginBottom={idx < blocks.length - 1 ? 1 : 0}
              >
                <Text color={colors.text} wrap="wrap">
                  {renderInlineText(block.text, theme)}
                </Text>
              </Box>
            );
          }
        }
      })}
    </Box>
  );
}
