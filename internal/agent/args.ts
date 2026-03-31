/**
 * Duck CLI - Argument Parser
 */

interface Args {
  run?: string;
  shell?: boolean;
  interactive?: boolean;
  
  // Agent commands
  agentList?: boolean;
  agentSpawn?: string;
  
  // MCP commands
  mcpList?: boolean;
  mcpAdd?: string;
  
  // Skills commands
  skillsList?: boolean;
  skillsSearch?: string;
  
  // Security commands
  securityAudit?: boolean;
  securityDefcon?: boolean;
  
  // Council
  council?: string;
  councilMode?: string;
  
  // Provider
  provider?: string;
  model?: string;
  verbose?: boolean;
}

export function parseArgs(args: string[]): Args {
  const result: Args = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      // Core commands
      case 'run':
        result.run = args[++i];
        break;
      case '-i':
      case '--interactive':
        result.shell = true;
        break;

      // Agent commands
      case 'agent':
        if (args[i + 1] === 'list') {
          result.agentList = true;
          i++;
        } else if (args[i + 1] === 'spawn') {
          result.agentSpawn = args[i + 2];
          i += 2;
        }
        break;

      // MCP commands
      case 'mcp':
        if (args[i + 1] === 'list') {
          result.mcpList = true;
          i++;
        } else if (args[i + 1] === 'add') {
          result.mcpAdd = args[i + 2];
          i += 2;
        }
        break;

      // Skills commands
      case 'skills':
        if (args[i + 1] === 'list') {
          result.skillsList = true;
          i++;
        } else if (args[i + 1] === 'search') {
          result.skillsSearch = args[++i];
        }
        break;

      // Security commands
      case 'security':
        if (args[i + 1] === 'audit') {
          result.securityAudit = true;
          i++;
        } else if (args[i + 1] === 'defcon') {
          result.securityDefcon = true;
          i++;
        }
        break;

      // Council
      case 'council':
        result.council = args[++i];
        if (args[i + 1] === '--mode') {
          result.councilMode = args[i + 2];
          i += 2;
        }
        break;

      // Direct flags (from Go wrapper)
      case '--agent-list':
        result.agentList = true;
        break;
      case '--agent-spawn':
        result.agentSpawn = args[++i];
        break;
      case '--mcp-list':
        result.mcpList = true;
        break;
      case '--mcp-add':
        result.mcpAdd = args[++i];
        break;
      case '--skills-list':
        result.skillsList = true;
        break;
      case '--skills-search':
        result.skillsSearch = args[++i];
        break;
      case '--security-audit':
        result.securityAudit = true;
        break;
      case '--security-defcon':
        result.securityDefcon = true;
        break;
      case '--council':
        result.council = args[++i];
        break;
      case '--shell':
        result.shell = true;
        break;

      // Provider flags
      case '--provider':
      case '-p':
        result.provider = args[++i];
        break;
      case '--model':
      case '-m':
        result.model = args[++i];
        break;
      case '--verbose':
      case '-v':
        result.verbose = true;
        break;

      default:
        if (!arg.startsWith('-')) {
          // Assume it's a prompt
          result.run = arg;
        }
    }

    i++;
  }

  return result;
}
