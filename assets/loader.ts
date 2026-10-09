#!/usr/bin/env bun
import logosData from "./logos.json" with { type: "json" };

const WHITE = "\x1b[97m";
const DIM = "\x1b[90m";
const NC = "\x1b[0m";

interface LogoFont {
  name: string;
  height: number;
  letter_spacing: number;
  chars: Record<string, string[]>;
}

const font = logosData as LogoFont;

function getCharRows(ch: string): string[] {
  const lower = ch.toLowerCase();
  if (font.chars[lower]) {
    return font.chars[lower];
  }
  return font.chars[" "] || Array(font.height).fill("    ");
}

function printSpecimenRow(letters: string[]) {
  const rows: string[] = Array(font.height).fill("");
  let hdr = "";

  for (const ch of letters) {
    const charRows = getCharRows(ch);
    const charWidth = charRows[0]?.length || 4;
    const lblPad = " ".repeat(Math.max(1, charWidth - ch.length + 1));

    hdr += `${ch}${lblPad}`;
    for (let r = 0; r < font.height; r++) {
      rows[r] += `${charRows[r]} `;
    }
  }

  console.log(`${DIM}${hdr}${NC}`);
  for (let r = 0; r < font.height; r++) {
    if ((r === 0 || r === font.height - 1) && !/\S/.test(rows[r])) {
      continue;
    }
    console.log(`${WHITE}${rows[r]}${NC}`);
  }
  console.log();
}

function renderString(text: string) {
  const rows: string[] = Array(font.height).fill("");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const charRows = getCharRows(ch);
    for (let r = 0; r < font.height; r++) {
      rows[r] += `${charRows[r]} `;
    }
  }

  console.log(WHITE);
  for (let r = 0; r < font.height; r++) {
    if ((r === 0 || r === font.height - 1) && !/\S/.test(rows[r])) {
      continue;
    }
    console.log(rows[r]);
  }
  console.log(NC);
}

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--all" || args[0] === "all") {
  console.log(`\n${DIM}=== a to m ===${NC}`);
  printSpecimenRow(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m"]);

  console.log(`${DIM}=== n to z ===${NC}`);
  printSpecimenRow(["n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"]);

  console.log(`${DIM}=== 0 to 9 ===${NC}`);
  printSpecimenRow(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

  console.log(`${DIM}=== Symbols ===${NC}`);
  printSpecimenRow(["-", "_", ".", "!", "?", ":"]);
} else {
  renderString(args.join(" "));
}
