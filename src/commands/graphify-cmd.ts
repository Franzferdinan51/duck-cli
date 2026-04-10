/**
 * 🦆 Duck CLI - Graphify Integration
 * Wraps the graphifyy Python package for knowledge graph generation
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function findPython(): string {
  const candidates = [
    process.env.GRAPHIFY_PYTHON,
    '/opt/homebrew/bin/python3.14',
    '/opt/homebrew/bin/python3.13',
    '/opt/homebrew/bin/python3.12',
    '/usr/local/bin/python3.12',
    '/usr/bin/python3.12',
    '/usr/local/bin/python3',
    '/usr/bin/python3',
    'python3',
    'python',
  ];
  // Prefer a Python that already has graphify installed
  for (const py of candidates) {
    if (!py) continue;
    try {
      execSync(`${py} -c "import graphify"`, { stdio: 'pipe' });
      return py;
    } catch {}
  }
  // Fallback: any Python 3.10+
  for (const py of candidates) {
    if (!py) continue;
    try {
      const out = execSync(`${py} --version`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
      const major = parseInt(out.match(/Python\s+(\d+)/)?.[1] || '0');
      const minor = parseInt(out.match(/Python\s+\d+\.(\d+)/)?.[1] || '0');
      if (major > 3 || (major === 3 && minor >= 10)) return py;
    } catch {}
  }
  return 'python3';
}

function ensureGraphify(python: string): boolean {
  try {
    execSync(`${python} -c "import graphify"`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export async function graphifyCommand(args: string[]): Promise<void> {
  const python = findPython();

  if (!ensureGraphify(python)) {
    console.log(`${c.yellow}graphify not found. Installing...${c.reset}`);
    try {
      execSync(`${python} -m pip install graphifyy`, { stdio: 'inherit' });
    } catch {
      try {
        execSync(`${python} -m pip install graphifyy --break-system-packages`, { stdio: 'inherit' });
      } catch (e: any) {
        console.error(`${c.red}Failed to install graphifyy:${c.reset}`, e.message);
        console.log(`${c.dim}Try installing manually:${c.reset}`);
        console.log(`  ${python} -m pip install graphifyy --break-system-packages`);
        return;
      }
    }
  }

  const subcommand = args[0] || '--help';

  // If user just typed `duck graphify`, show helpful usage
  if (subcommand === '--help' || subcommand === '-h') {
    console.log(`\n${c.bold}${c.cyan}🕸️  Graphify — Knowledge Graph for Code & Docs${c.reset}\n`);
    console.log(`${c.dim}Turn any folder into a queryable knowledge graph.${c.reset}\n`);
    console.log(`${c.bold}Usage:${c.reset}`);
    console.log(`  duck graphify <path>                    # build graph from folder`);
    console.log(`  duck graphify .                         # build graph from current dir`);
    console.log(`  duck graphify <path> --mode deep        # thorough extraction`);
    console.log(`  duck graphify <path> --update           # incremental update`);
    console.log(`  duck graphify query "<question>"        # query existing graph`);
    console.log(`  duck graphify path "NodeA" "NodeB"      # shortest path`);
    console.log(`  duck graphify explain "<concept>"       # explain a node`);
    console.log(`  duck graphify status                    # check installation`);
    console.log(`  duck graphify install                   # install OpenClaw skill`);
    console.log(`\n${c.dim}Outputs: graphify-out/graph.json, graph.html, GRAPH_REPORT.md${c.reset}\n`);
    return;
  }

  if (subcommand === 'status') {
    const ok = ensureGraphify(python);
    console.log(ok
      ? `${c.green}✅ graphifyy installed${c.reset} (python: ${python})`
      : `${c.red}❌ graphifyy NOT installed${c.reset}`);
    const skillPath = `${process.env.HOME}/.claw/skills/graphify/SKILL.md`;
    console.log(existsSync(skillPath)
      ? `${c.green}✅ OpenClaw skill installed${c.reset} at ${skillPath}`
      : `${c.yellow}⚠️ OpenClaw skill not installed${c.reset} — run: duck graphify install`);
    return;
  }

  if (subcommand === 'install') {
    try {
      execSync(`${python} -m graphify install --platform claw`, { stdio: 'inherit' });
      console.log(`\n${c.green}✅ Graphify skill installed${c.reset}`);
    } catch (e: any) {
      console.error(`${c.red}Install failed:${c.reset}`, e.message);
    }
    return;
  }

  // Build graph from path
  const maybePath = subcommand;
  if (!maybePath.startsWith('-') && !existsSync(maybePath)) {
    // Could be a path that doesn't exist yet - let python script handle it
  }

  // Detect whether first arg is a known graphify subcommand or a path
  const graphifySubcommands = new Set([
    'install', 'query', 'path', 'explain', 'benchmark',
    'save-result', 'hook', 'gemini', 'cursor', 'claude',
    'codex', 'opencode', 'aider', 'copilot', 'claw',
    'droid', 'trae', 'trae-cn',
  ]);

  const isSubcommand = graphifySubcommands.has(maybePath) || maybePath.startsWith('-');

  if (isSubcommand) {
    // Pass through to graphify CLI directly
    try {
      const rest = args.join(' ');
      execSync(`${python} -m graphify ${rest}`, { stdio: 'inherit' });
    } catch {
      // graphify itself prints errors; exit code is enough
    }
    return;
  }

  // It's a path - run our duck-cli build wrapper
  const { dirname, join } = require('path');
  const buildScript = join(dirname(__filename), '..', '..', 'scripts', 'graphify-build.py');

  try {
    execSync(`${python} "${buildScript}" ${args.join(' ')}`, { stdio: 'inherit' });
  } catch {
    // wrapper prints its own errors
  }
}
