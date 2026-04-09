/**
 * Duck Agent - Onboard CLI
 * CLI interface for onboarding commands
 */

import { OnboardManager } from './onboard-manager.js';

// Colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gold: '\x1b[33m',
};

const logo = `
${c.gold}${c.bold}
   ██╗██╗   ██╗██╗ ██████╗████████╗ ██████╗ ██████╗ ██╗   ██╗██╗
   ██║██║   ██║██║██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗╚██╗ ██╔╝██║
   ██║██║   ██║██║██║        ██║   ██║   ██║██████╔╝ ╚████╔╝ ██║
   ██║╚██╗ ██╔╝██║██║        ██║   ██║   ██║██╔══██╗  ╚██╔╝  ╚═╝
   ██║ ╚████╔╝ ██║╚██████╗   ██║   ╚██████╔╝██║  ██║   ██║   ██╗
   ╚═╝  ╚═══╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝
${c.reset}${c.cyan}  ${c.bold}Onboarding CLI${c.reset}
`;

export type OnboardCommand = 'run' | 'gateway' | 'workspace' | 'skills' | 'status' | 'reset';

interface OnboardCLIOptions {
  command?: OnboardCommand;
  skipGateway?: boolean;
  skipWorkspace?: boolean;
  skipSkills?: boolean;
  skipApiKeys?: boolean;
  dryRun?: boolean;
}

/**
 * Parse onboard command-line arguments.
 * Expected format: duck onboard [gateway|workspace|skills|status|reset]
 */
export function parseOnboardArgs(args: string[]): OnboardCLIOptions {
  const [cmd, ...rest] = args;

  const options: OnboardCLIOptions = {};

  switch (cmd) {
    case 'gateway':
      options.command = 'gateway';
      break;
    case 'workspace':
      options.command = 'workspace';
      break;
    case 'skills':
      options.command = 'skills';
      break;
    case 'status':
      options.command = 'status';
      break;
    case 'reset':
      options.command = 'reset';
      break;
    case 'run':
      options.command = 'run';
      break;
    default:
      // No subcommand → full onboarding
      options.command = 'run';
  }

  // Parse flags
  if (rest.includes('--skip-gateway')) options.skipGateway = true;
  if (rest.includes('--skip-workspace')) options.skipWorkspace = true;
  if (rest.includes('--skip-skills')) options.skipSkills = true;
  if (rest.includes('--skip-api-keys')) options.skipApiKeys = true;
  if (rest.includes('--dry-run')) options.dryRun = true;

  return options;
}

/**
 * Execute the onboard command based on parsed options.
 */
export async function runOnboardCLI(options: OnboardCLIOptions): Promise<void> {
  const manager = new OnboardManager();

  switch (options.command) {
    case 'status':
      manager.printStatus();
      break;

    case 'reset':
      manager.reset();
      break;

    case 'gateway':
      await manager.onboardGateway();
      break;

    case 'workspace':
      await manager.onboardWorkspace();
      break;

    case 'skills':
      await manager.onboardSkills();
      break;

    case 'run':
    default: {
      const result = await manager.onboard();
      if (!result.success) {
        console.error(`${c.red}Error: ${result.error}${c.reset}`);
        process.exit(1);
      }
      break;
    }
  }
}

/**
 * Main entry point — call from main.ts CLI router.
 * Pass process.argv.slice(2) as args.
 */
export async function onboardCLI(args: string[]): Promise<void> {
  const options = parseOnboardArgs(args);
  await runOnboardCLI(options);
}

/**
 * Print onboard help
 */
export function printOnboardHelp(): void {
  console.log(`${logo}`);
  console.log(`${c.bold}Usage:${c.reset}`);
  console.log(`  ${c.green}duck onboard${c.reset}              Run full onboarding wizard`);
  console.log(`  ${c.green}duck onboard gateway${c.reset}       Configure gateway only`);
  console.log(`  ${c.green}duck onboard workspace${c.reset}     Configure workspace only`);
  console.log(`  ${c.green}duck onboard skills${c.reset}        Configure skills only`);
  console.log(`  ${c.green}duck onboard status${c.reset}       Show onboarding status`);
  console.log(`  ${c.green}duck onboard reset${c.reset}        Reset onboarding (re-run wizard)`);
  console.log();
  console.log(`${c.bold}Flags:${c.reset}`);
  console.log(`  ${c.cyan}--skip-gateway${c.reset}    Skip gateway step in full onboarding`);
  console.log(`  ${c.cyan}--skip-workspace${c.reset}  Skip workspace step`);
  console.log(`  ${c.cyan}--skip-skills${c.reset}     Skip skills step`);
  console.log(`  ${c.cyan}--skip-api-keys${c.reset}    Skip API key step`);
  console.log(`  ${c.cyan}--dry-run${c.reset}          Show what would be configured`);
  console.log();
}
