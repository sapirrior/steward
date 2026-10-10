import type { BashCommandAnalysis, CommandSegment, RiskCategory, SafetyScore } from './types.js';
import { parseFullCommand } from './shellParser.js';

const SAFE_INSPECTION_COMMANDS = new Set([
  'ls',
  'dir',
  'pwd',
  'which',
  'where',
  'type',
  'file',
  'stat',
]);

const SAFE_READ_COMMANDS = new Set([
  'cat',
  'head',
  'tail',
  'less',
  'more',
  'nl',
  'wc',
  'od',
  'hexdump',
]);

const SAFE_SEARCH_COMMANDS = new Set(['grep', 'egrep', 'fgrep', 'rg', 'ag', 'find', 'locate']);

const SAFE_SYSTEM_COMMANDS = new Set([
  'uname',
  'whoami',
  'id',
  'date',
  'uptime',
  'hostname',
  'df',
  'du',
  'free',
  'ps',
  'env',
  'printenv',
  'cal',
]);

const SAFE_GIT_SUBCOMMANDS = new Set([
  'status',
  'log',
  'diff',
  'branch',
  'tag',
  'show',
  'remote',
  'rev-parse',
  'describe',
  'version',
  'help',
]);

const KNOWN_FILE_MUTATORS = new Set([
  'rm',
  'mv',
  'cp',
  'mkdir',
  'rmdir',
  'touch',
  'chmod',
  'chown',
  'chgrp',
  'truncate',
  'dd',
  'ln',
  'unlink',
  'tee',
  'shred',
  'wipefs',
  'mkfs',
]);

const KNOWN_SYSTEM_MUTATORS = new Set([
  'sudo',
  'su',
  'kill',
  'pkill',
  'killall',
  'systemctl',
  'service',
  'reboot',
  'shutdown',
  'halt',
  'poweroff',
  'init',
  'useradd',
  'userdel',
  'usermod',
  'groupadd',
  'crontab',
  'iptables',
  'ufw',
]);

interface SegmentEvaluation {
  score: SafetyScore;
  reasons: string[];
  categories: RiskCategory[];
}

function evaluateSegment(segment: CommandSegment): SegmentEvaluation {
  const reasons: string[] = [];
  const categories: RiskCategory[] = [];
  const cmd = segment.command.toLowerCase();

  // 1. Check for output redirections (e.g. >, >>, &>)
  const outputRedirs = segment.redirections.filter((r) => r.includes('>'));
  if (outputRedirs.length > 0) {
    reasons.push(`Output redirection "${outputRedirs.join(', ')}" mutates files`);
    categories.push('redirection');
  }

  // 2. Check for subshells (e.g. $(rm -rf /))
  if (segment.hasSubshell) {
    for (const sub of segment.subcommands) {
      const subAnalysis = classifyCommand(sub);
      if (subAnalysis.score === 1) {
        reasons.push(`Subshell command "$(${sub})" is mutating or unsafe`);
        categories.push(...subAnalysis.categories);
      }
    }
  }

  // 3. Known File Mutators
  if (KNOWN_FILE_MUTATORS.has(cmd)) {
    if (cmd === 'rm' || cmd === 'rmdir' || cmd === 'unlink' || cmd === 'shred') {
      reasons.push(`Command "${cmd}" deletes files or directories`);
      categories.push('file-delete');
    } else {
      reasons.push(`Command "${cmd}" creates or mutates files`);
      categories.push('file-write');
    }
  }

  // 4. Known System Mutators
  if (KNOWN_SYSTEM_MUTATORS.has(cmd)) {
    reasons.push(`Command "${cmd}" executes privileged or system-altering actions`);
    categories.push('system-exec');
  }

  // 5. Sed with in-place flag (-i or --in-place)
  if (cmd === 'sed') {
    const hasInPlace = segment.args.some(
      (a) => a === '-i' || a.startsWith('-i') || a.includes('--in-place'),
    );
    if (hasInPlace) {
      reasons.push('Command "sed -i" modifies files in place');
      categories.push('file-modify');
    }
  }

  // 6. Git commands
  if (cmd === 'git') {
    // Flags before subcommand (e.g. git -C path status)
    const effectiveSub = segment.args.find((a) => !a.startsWith('-'))?.toLowerCase() || '';

    if (!SAFE_GIT_SUBCOMMANDS.has(effectiveSub)) {
      reasons.push(
        `Git command "git ${effectiveSub || 'mutation'}" alters repository state or history`,
      );
      categories.push('git-mutation');
    } else {
      // Check mutating flags within safe subcommands
      if (effectiveSub === 'branch') {
        const hasMutateFlag = segment.args.some(
          (a) =>
            a === '-d' ||
            a === '-D' ||
            a === '-m' ||
            a === '-M' ||
            a.includes('--delete') ||
            a.includes('--move'),
        );
        if (hasMutateFlag) {
          reasons.push('Git command "git branch -d/-D/-m" deletes or modifies branches');
          categories.push('git-mutation');
        }
      } else if (effectiveSub === 'remote') {
        const subIndex = segment.args.indexOf(effectiveSub);
        const subSub = (segment.args[subIndex + 1] || '').toLowerCase();
        if (subSub && subSub !== '-v' && subSub !== '--verbose') {
          reasons.push(`Git command "git remote ${subSub}" alters remote configurations`);
          categories.push('git-mutation');
        }
      } else if (effectiveSub === 'tag') {
        const hasTagDelete = segment.args.some((a) => a === '-d' || a.includes('--delete'));
        if (hasTagDelete) {
          reasons.push('Git command "git tag -d" deletes tags');
          categories.push('git-mutation');
        }
      }
    }
  }

  // 7. Package managers (bun, npm, yarn, pnpm, pip, cargo, etc.)
  if (
    cmd === 'bun' ||
    cmd === 'npm' ||
    cmd === 'yarn' ||
    cmd === 'pnpm' ||
    cmd === 'pip' ||
    cmd === 'cargo'
  ) {
    const subCmd = (segment.args[0] || '').toLowerCase();
    if (
      subCmd === 'test' ||
      (subCmd === 'run' && segment.args[1] === 'test') ||
      subCmd === '--version' ||
      subCmd === '-v'
    ) {
      // Safe test execution
    } else {
      reasons.push(
        `Package manager "${cmd} ${subCmd}" may install, modify, or execute arbitrary dependencies`,
      );
      categories.push('package-install');
    }
  }

  // 8. Safe-list checks (only if no reasons yet)
  if (reasons.length === 0) {
    if (
      SAFE_INSPECTION_COMMANDS.has(cmd) ||
      SAFE_READ_COMMANDS.has(cmd) ||
      SAFE_SEARCH_COMMANDS.has(cmd) ||
      SAFE_SYSTEM_COMMANDS.has(cmd) ||
      cmd === 'echo' ||
      cmd === 'printf' ||
      cmd === 'awk' ||
      cmd === 'sort' ||
      cmd === 'uniq' ||
      cmd === 'cut' ||
      cmd === 'tr' ||
      cmd === 'fmt' ||
      cmd === 'wc' ||
      cmd === 'git' ||
      cmd === 'bun' ||
      cmd === 'npm' ||
      (cmd === 'sed' && !segment.args.some((a) => a.includes('-i'))) ||
      (cmd === 'tsc' && segment.args.includes('--noEmit'))
    ) {
      // Confirmed safe
      return { score: 0, reasons: [], categories: [] };
    }

    // 9. DEFAULT-DENY POLICY: Any unrecognized binary is classified as NOT SAFE (1)
    reasons.push(`Unrecognized or unverified command "${cmd}" (default-deny security policy)`);
    categories.push('unknown-binary');
  }

  const score: SafetyScore = reasons.length > 0 ? 1 : 0;
  return { score, reasons, categories };
}

/**
 * Classifies a full compound bash command into a binary safety score:
 * 0 = Safe / Read-Only (Auto-allowed)
 * 1 = Mutating / Destructive / Unknown (Prompts Permission Dock)
 */
export function classifyCommand(fullCommand: string): BashCommandAnalysis {
  const segments = parseFullCommand(fullCommand);

  if (segments.length === 0) {
    return {
      rawCommand: fullCommand,
      score: 0,
      isMutating: false,
      reasons: [],
      categories: [],
      segments: [],
    };
  }

  const allReasons: string[] = [];
  const allCategories: Set<RiskCategory> = new Set();
  let maxScore: SafetyScore = 0;

  for (const seg of segments) {
    const evalResult = evaluateSegment(seg);
    if (evalResult.score === 1) {
      maxScore = 1;
      allReasons.push(...evalResult.reasons);
      for (const cat of evalResult.categories) {
        allCategories.add(cat);
      }
    }
  }

  return {
    rawCommand: fullCommand,
    score: maxScore,
    isMutating: maxScore === 1,
    reasons: allReasons,
    categories: Array.from(allCategories),
    segments,
  };
}
