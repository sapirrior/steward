import { describe, it, expect } from 'bun:test';
import { Box, Text, Newline, Spacer, Transform, renderElement } from '../../src/elements/index.js';
import { visibleWidth } from '../../src/text/width.js';
import { stripAnsi } from '../../src/text/ansi.js';

describe('Phase 5: Declarative Element Layer Acceptance Tests (5.5)', () => {
  it('1 (I) <Box width={4}><Text>X</Text></Box>', () => {
    const el = Box({ width: 4 }, [Text('X')]);
    const lines = renderElement(el, { width: 10 });
    expect(lines[0]).toBe('X   ');
  });

  it('2 (I) <Box width={10}><Box width="50%"><Text>X</Text></Box><Text>Y</Text></Box>', () => {
    const el = Box({ width: 10 }, [Box({ width: '50%' }, [Text('X')]), Text('Y')]);
    const lines = renderElement(el, { width: 20 });
    expect(lines[0]?.trimEnd()).toBe('X    Y');
  });

  it('3 (I) <Box height={4}><Text>X</Text></Box>', () => {
    const el = Box({ height: 4 }, [Text('X')]);
    const lines = renderElement(el, { width: 10 });
    expect(lines.length).toBe(4);
    expect(lines[0]?.trimEnd()).toBe('X');
    expect(lines[1]?.trim()).toBe('');
    expect(lines[2]?.trim()).toBe('');
    expect(lines[3]?.trim()).toBe('');
  });

  it('4 (I) <Box height={6} flexDirection="column"><Box height="50%"><Text>X</Text></Box><Text>Y</Text></Box>', () => {
    const el = Box({ height: 6, flexDirection: 'column' }, [
      Box({ height: '50%' }, [Text('X')]),
      Text('Y'),
    ]);
    const lines = renderElement(el, { width: 10, height: 6 });
    expect(lines.length).toBe(6);
    expect(lines[0]?.trim()).toBe('X');
    expect(lines[1]?.trim()).toBe('');
    expect(lines[2]?.trim()).toBe('');
    expect(lines[3]?.trim()).toBe('Y');
    expect(lines[4]?.trim()).toBe('');
    expect(lines[5]?.trim()).toBe('');
  });

  it('5 (I) <Box width={7}><Text>Hello World</Text></Box>', () => {
    const el = Box({ width: 7 }, [Text('Hello World')]);
    const lines = renderElement(el, { width: 20 });
    expect(lines[0]?.trim()).toBe('Hello');
    expect(lines[1]?.trim()).toBe('World');
  });

  it('6 (I) <Box width={7}><Text wrap="hard">Hello World</Text></Box>', () => {
    const el = Box({ width: 7 }, [Text({ wrap: 'hard' }, 'Hello World')]);
    const lines = renderElement(el, { width: 20 });
    expect(lines[0]?.trim()).toBe('Hello W');
    expect(lines[1]?.trim()).toBe('orld');
  });

  it('7 (I) wrap="truncate" / "truncate-middle" / "truncate-start"', () => {
    const elEnd = Text({ wrap: 'truncate' }, 'Hello World');
    const linesEnd = renderElement(elEnd, { width: 6 });
    expect(linesEnd[0]).toBe('Hello…');

    const elMid = Text({ wrap: 'truncate-middle' }, 'Hello World');
    const linesMid = renderElement(elMid, { width: 6 });
    expect(linesMid[0]).toBe('He…rld');

    const elStart = Text({ wrap: 'truncate-start' }, 'Hello World');
    const linesStart = renderElement(elStart, { width: 6 });
    expect(linesStart[0]).toBe('…World');
  });

  it('8 (I) <Box flexDirection="column" rowGap={1}><Text>A</Text><Text>B</Text></Box>', () => {
    const el = Box({ flexDirection: 'column', rowGap: 1 }, [Text('A'), Text('B')]);
    const lines = renderElement(el, { width: 10 });
    expect(lines.length).toBe(3);
    expect(lines[0]?.trim()).toBe('A');
    expect(lines[1]?.trim()).toBe('');
    expect(lines[2]?.trim()).toBe('B');
  });

  it('9 (I) <Box columnGap={1}><Text>A</Text><Text>B</Text></Box>', () => {
    const el = Box({ columnGap: 1 }, [Text('A'), Text('B')]);
    const lines = renderElement(el, { width: 10 });
    expect(lines[0]?.trim()).toBe('A B');
  });

  it('10 (I) <Box width={6}><Box flexBasis={3}><Text>X</Text></Box><Text>Y</Text></Box>', () => {
    const el = Box({ width: 6 }, [Box({ flexBasis: 3 }, [Text('X')]), Text('Y')]);
    const lines = renderElement(el, { width: 10 });
    expect(lines[0]?.trimEnd()).toBe('X  Y');
  });

  it('11 (I) <Box flexDirection="row-reverse"><Text>X</Text><Box marginRight={1}><Text>Y</Text></Box></Box>', () => {
    const el = Box({ flexDirection: 'row-reverse' }, [
      Text('X'),
      Box({ marginRight: 1 }, [Text('Y')]),
    ]);
    const lines = renderElement(el, { width: 10 });
    expect(lines[0]?.trimEnd()).toBe('Y X');
  });

  it('12 (I) flexDirection="column-reverse" with X, Y', () => {
    const el = Box({ flexDirection: 'column-reverse' }, [Text('X'), Text('Y')]);
    const lines = renderElement(el, { width: 10 });
    expect(lines[0]?.trim()).toBe('Y');
    expect(lines[1]?.trim()).toBe('X');
  });

  it('13 (S) <Box width={7} justifyContent="center"><Text>X</Text></Box>', () => {
    const el = Box({ width: 7, justifyContent: 'center' }, [Text('X')]);
    const lines = renderElement(el, { width: 10 });
    expect(lines[0]).toBe('   X   ');
  });

  it('14 (S) <Box width={8} justifyContent="space-between"><Text>X</Text><Text>Y</Text></Box>', () => {
    const el = Box({ width: 8, justifyContent: 'space-between' }, [Text('X'), Text('Y')]);
    const lines = renderElement(el, { width: 10 });
    expect(lines[0]).toBe('X      Y');
  });

  it('15 (S) <Box width={8} justifyContent="flex-end"><Text>X</Text></Box>', () => {
    const el = Box({ width: 8, justifyContent: 'flex-end' }, [Text('X')]);
    const lines = renderElement(el, { width: 10 });
    expect(lines[0]).toBe('       X');
  });

  it('16 (S) <Box><Text>Label:</Text><Box flexGrow={1}><Text>fill</Text></Box></Box> at width 20', () => {
    const el = Box({ width: 20 }, [Text('Label:'), Box({ flexGrow: 1 }, [Text('fill')])]);
    const lines = renderElement(el, { width: 20 });
    expect(lines[0]).toBe('Label:fill          ');
  });

  it('17 (I) alignItems="center" with 1-line and 3-line children', () => {
    const el = Box({ alignItems: 'center' }, [
      Text('X'),
      Box({ flexDirection: 'column' }, [Text('1'), Text('2'), Text('3')]),
    ]);
    const lines = renderElement(el, { width: 10 });
    expect(lines.length).toBe(3);
    expect(lines[1]?.startsWith('X')).toBe(true);
  });

  it('18 (I) <Text>Hello<Newline/>World</Text>', () => {
    const el = Box({ flexDirection: 'column' }, [Text('Hello'), Newline(), Text('World')]);
    const lines = renderElement(el, { width: 10 });
    expect(lines.length).toBe(3);
    expect(lines[0]?.trim()).toBe('Hello');
    expect(lines[1]?.trim()).toBe('');
    expect(lines[2]?.trim()).toBe('World');
  });

  it('19 (I) <Box><Text>Left</Text><Spacer/><Text>Right</Text></Box> at width 12', () => {
    const el = Box({ width: 12 }, [Text('Left'), Spacer(), Text('Right')]);
    const lines = renderElement(el, { width: 12 });
    expect(lines[0]).toBe('Left   Right');
  });

  it('20 (I) <Transform transform={(l,i)=> i===0 ? l : "    "+l}>', () => {
    const el = Transform(
      { transform: (l, i) => (i === 0 ? l : '    ' + l) },
      Text('Row1\nRow2\nRow3'),
    );
    const lines = renderElement(el, { width: 20 });
    expect(lines[0]).toBe('Row1');
    expect(lines[1]).toBe('    Row2');
    expect(lines[2]).toBe('    Row3');
  });

  it('21 (S) multi-line child inside a row (defect D4 fix)', () => {
    const el = Box({}, [
      Box({ flexDirection: 'column' }, [Text('Left A'), Text('Left B')]),
      Box({ flexDirection: 'column' }, [Text('Right A'), Text('Right B')]),
    ]);
    const lines = renderElement(el, { width: 30 });
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('Left A');
    expect(lines[0]).toContain('Right A');
    expect(lines[1]).toContain('Left B');
    expect(lines[1]).toContain('Right B');
  });

  it('22 (S) nested <Text color="red">a<Text bold>b</Text>c</Text>', () => {
    const el = Text({ color: 'red' }, ['a', Text({ bold: true }, 'b'), 'c']);
    const lines = renderElement(el, { width: 10 });
    // Strip escape sequences to verify characters, and check ANSI styling
    expect(stripAnsi(lines[0]!)).toBe('abc');
    expect(lines[0]).toContain('\x1b[31m');
    expect(lines[0]).toContain('\x1b[1m');
  });

  it('23 (S) border "round" on a 10-wide box with a 1-line child', () => {
    const el = Box({ width: 10, borderStyle: 'round' }, [Text('Content')]);
    const lines = renderElement(el, { width: 10 });
    expect(lines.length).toBe(3);
    expect(stripAnsi(lines[0]!)).toBe('╭────────╮');
    expect(stripAnsi(lines[1]!)).toBe('│Content │');
    expect(stripAnsi(lines[2]!)).toBe('╰────────╯');
    expect(visibleWidth(lines[0]!)).toBe(10);
  });

  it('24 (S) wide (CJK/emoji) content in a bordered/padded box stays aligned', () => {
    const el = Box({ width: 12, borderStyle: 'single', padding: 1 }, [Text('你好👋')]);
    const lines = renderElement(el, { width: 12 });
    for (const line of lines) {
      expect(visibleWidth(line)).toBe(12);
    }
  });

  it('25 (S) any element at width 1 never throws', () => {
    const el = Box({ borderStyle: 'single', padding: 1 }, [
      Text('Very long paragraph of text that should safely adapt to 1 col'),
    ]);
    const lines = renderElement(el, { width: 1 });
    expect(lines.length).toBeGreaterThan(0);
  });

  it('Property test: Random element trees never exceed target width', () => {
    // Seeded pseudorandom generator (LCG)
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let iteration = 0; iteration < 20; iteration++) {
      const targetWidth = Math.floor(random() * 50) + 5;
      const tree = Box(
        {
          width: targetWidth,
          flexDirection: random() > 0.5 ? 'row' : 'column',
          gap: Math.floor(random() * 2),
        },
        [
          Text('Random item ' + Math.floor(random() * 100)),
          Box({ flexGrow: 1 }, [Text('Growing child')]),
        ],
      );

      const lines = renderElement(tree, { width: targetWidth });
      for (const line of lines) {
        expect(visibleWidth(line)).toBeLessThanOrEqual(targetWidth);
      }
    }
  });
});
