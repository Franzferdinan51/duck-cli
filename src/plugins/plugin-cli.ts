/**
 * 🦆 Duck CLI - Plugin Commands
 * CLI interface for plugin management commands
 */

import { PluginManager } from './plugin-manager.js';

// Colors (same as main.ts)
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
  magenta: '\x1b[35m',
};

/**
 * duck plugins [list|install|uninstall|inspect|enable|disable] [args]
 * OpenClaw plugin management
 */
export async function pluginsCommand(args: string[]): Promise<void> {
  const [action, ...actionArgs] = args;
  const manager = new PluginManager();

  console.log(`${c.cyan}🦆 Duck CLI Plugin Manager${c.reset}\n`);

  switch (action) {
    case 'list':
    case 'ls': {
      console.log(`${c.cyan}📋 Installed Plugins${c.reset}\n`);

      const result = await manager.list();

      if (result.plugins.length === 0) {
        console.log(`${c.yellow}No plugins installed${c.reset}`);
        console.log(`\n${c.green}Install a plugin:${c.reset}`);
        console.log(`  ${c.cyan}duck plugins install <path-or-url>${c.reset}`);
        return;
      }

      console.log(`${c.green}Installed ${result.total} plugin(s):${c.reset}\n`);

      for (const plugin of result.plugins) {
        const status = plugin.enabled ? `${c.green}●${c.reset}` : `${c.dim}○${c.reset}`;
        console.log(`  ${status} ${c.bold}${plugin.name}${c.reset} v${plugin.version}`);
        console.log(`    ${plugin.description}`);
        console.log(`    ${c.dim}Installed: ${new Date(plugin.installedAt).toLocaleDateString()}${c.reset}`);
        if (plugin.author) {
          console.log(`    ${c.dim}Author: ${plugin.author}${c.reset}`);
        }
        console.log();
      }

      console.log(`${c.green}Manage plugins:${c.reset}`);
      console.log(`  ${c.cyan}duck plugins inspect <name>${c.reset}   # Show plugin details`);
      console.log(`  ${c.cyan}duck plugins enable <name>${c.reset}    # Enable plugin`);
      console.log(`  ${c.cyan}duck plugins disable <name>${c.reset}   # Disable plugin`);
      console.log(`  ${c.cyan}duck plugins uninstall <name>${c.reset}  # Remove plugin`);
      break;
    }

    case 'install':
    case 'add': {
      const source = actionArgs[0];
      const name = actionArgs[1]; // Optional custom name

      if (!source) {
        console.log(`${c.yellow}Usage: duck plugins install <path-or-url> [name]${c.reset}`);
        console.log(`\nExamples:`);
        console.log(`  ${c.green}duck plugins install /path/to/my-plugin${c.reset}`);
        console.log(`  ${c.green}duck plugins install https://example.com/plugin.tar.gz${c.reset}`);
        console.log(`  ${c.green}duck plugins install /path/to/plugin my-custom-name${c.reset}`);
        return;
      }

      console.log(`${c.cyan}📦 Installing plugin: ${source}${c.reset}\n`);

      const result = await manager.install(source, { name });

      if (result.success) {
        console.log(`${c.green}✅ Successfully installed plugin!${c.reset}`);
        console.log(`\nPlugin installed to: ${result.path}`);
        console.log(`\n${c.green}List plugins:${c.reset}`);
        console.log(`  ${c.cyan}duck plugins list${c.reset}`);
      } else {
        console.log(`${c.red}❌ Installation failed: ${result.error}${c.reset}`);
      }
      break;
    }

    case 'uninstall':
    case 'remove':
    case 'rm': {
      const pluginName = actionArgs[0];

      if (!pluginName) {
        console.log(`${c.yellow}Usage: duck plugins uninstall <name>${c.reset}`);
        return;
      }

      console.log(`${c.cyan}🗑️ Uninstalling plugin: ${pluginName}${c.reset}\n`);

      const result = await manager.uninstall(pluginName);

      if (result.success) {
        console.log(`${c.green}✅ Successfully uninstalled "${pluginName}"${c.reset}`);
      } else {
        console.log(`${c.red}❌ Uninstall failed: ${result.error}${c.reset}`);
      }
      break;
    }

    case 'inspect':
    case 'info':
    case 'show': {
      const pluginName = actionArgs[0];

      if (!pluginName) {
        console.log(`${c.yellow}Usage: duck plugins inspect <name>${c.reset}`);
        return;
      }

      console.log(`${c.cyan}🔍 Plugin Details: ${pluginName}${c.reset}\n`);

      const plugin = await manager.inspect(pluginName);

      if (!plugin) {
        console.log(`${c.red}❌ Plugin "${pluginName}" not found${c.reset}`);
        console.log(`\n${c.green}List installed plugins:${c.reset}`);
        console.log(`  ${c.cyan}duck plugins list${c.reset}`);
        return;
      }

      const status = plugin.enabled ? `${c.green}Enabled${c.reset}` : `${c.yellow}Disabled${c.reset}`;
      console.log(`${c.bold}${plugin.name}${c.reset} v${plugin.version} [${status}]`);
      console.log(`${c.dim}${'─'.repeat(50)}${c.reset}\n`);
      console.log(`${c.bold}Description:${c.reset}`);
      console.log(`  ${plugin.description}`);
      console.log();
      console.log(`${c.bold}Path:${c.reset}`);
      console.log(`  ${c.dim}${plugin.path}${c.reset}`);
      console.log();
      console.log(`${c.bold}Installed:${c.reset} ${new Date(plugin.installedAt).toLocaleString()}`);

      if (plugin.author) {
        console.log(`${c.bold}Author:${c.reset} ${plugin.author}`);
      }

      console.log();

      // Show metadata
      if (plugin.metadata) {
        console.log(`${c.bold}Metadata:${c.reset}`);

        if (plugin.metadata.triggers?.length) {
          console.log(`  ${c.cyan}Triggers:${c.reset} ${plugin.metadata.triggers.join(', ')}`);
        }

        if (plugin.metadata.skills?.length) {
          console.log(`  ${c.cyan}Skills:${c.reset} ${plugin.metadata.skills.join(', ')}`);
        }

        if (plugin.metadata.dependencies && Object.keys(plugin.metadata.dependencies).length > 0) {
          console.log(`  ${c.cyan}Dependencies:${c.reset}`);
          for (const [dep, version] of Object.entries(plugin.metadata.dependencies)) {
            console.log(`    - ${dep}: ${version}`);
          }
        }
        console.log();
      }

      console.log(`${c.green}Manage plugin:${c.reset}`);
      if (plugin.enabled) {
        console.log(`  ${c.cyan}duck plugins disable ${pluginName}${c.reset}  # Disable plugin`);
      } else {
        console.log(`  ${c.cyan}duck plugins enable ${pluginName}${c.reset}   # Enable plugin`);
      }
      console.log(`  ${c.cyan}duck plugins uninstall ${pluginName}${c.reset}  # Remove plugin`);
      break;
    }

    case 'enable': {
      const pluginName = actionArgs[0];

      if (!pluginName) {
        console.log(`${c.yellow}Usage: duck plugins enable <name>${c.reset}`);
        return;
      }

      console.log(`${c.cyan}🔓 Enabling plugin: ${pluginName}${c.reset}\n`);

      const result = await manager.enable(pluginName);

      if (result.success) {
        console.log(`${c.green}✅ Plugin "${pluginName}" enabled${c.reset}`);
      } else {
        console.log(`${c.red}❌ Enable failed: ${result.error}${c.reset}`);
      }
      break;
    }

    case 'disable': {
      const pluginName = actionArgs[0];

      if (!pluginName) {
        console.log(`${c.yellow}Usage: duck plugins disable <name>${c.reset}`);
        return;
      }

      console.log(`${c.cyan}🔒 Disabling plugin: ${pluginName}${c.reset}\n`);

      const result = await manager.disable(pluginName);

      if (result.success) {
        console.log(`${c.green}✅ Plugin "${pluginName}" disabled${c.reset}`);
      } else {
        console.log(`${c.red}❌ Disable failed: ${result.error}${c.reset}`);
      }
      break;
    }

    case 'search': {
      const query = actionArgs.join(' ') || '';

      if (!query) {
        console.log(`${c.yellow}Usage: duck plugins search <query>${c.reset}`);
        return;
      }

      console.log(`${c.cyan}🔍 Searching for plugins: "${query}"${c.reset}\n`);
      console.log(`${c.dim}Note: Plugin search requires ClawHub integration${c.reset}`);
      console.log(`\n${c.green}Browse installed plugins:${c.reset}`);
      console.log(`  ${c.cyan}duck plugins list${c.reset}`);
      break;
    }

    case 'update': {
      const pluginName = actionArgs[0];

      if (!pluginName) {
        console.log(`${c.yellow}Usage: duck plugins update <name>${c.reset}`);
        console.log(`\n${c.dim}Note: Plugin update requires ClawHub integration${c.reset}`);
        return;
      }

      console.log(`${c.cyan}🔄 Updating plugin: ${pluginName}${c.reset}\n`);
      console.log(`${c.yellow}⚠ Update requires ClawHub API key${c.reset}`);
      console.log(`\nTo update, reinstall the plugin:`);
      console.log(`  ${c.cyan}duck plugins uninstall ${pluginName}${c.reset}`);
      console.log(`  ${c.cyan}duck plugins install <source>${c.reset}`);
      break;
    }

    default: {
      console.log(`${c.bold}🦆 Duck CLI Plugin Manager${c.reset}`);
      console.log(`${c.dim}OpenClaw plugin system${c.reset}\n`);
      console.log(`${c.bold}Commands:${c.reset}`);
      console.log(`  ${c.green}duck plugins list${c.reset}              List installed plugins`);
      console.log(`  ${c.green}duck plugins install <source>${c.reset}   Install from path or URL`);
      console.log(`  ${c.green}duck plugins inspect <name>${c.reset}     Show plugin details`);
      console.log(`  ${c.green}duck plugins enable <name>${c.reset}      Enable a plugin`);
      console.log(`  ${c.green}duck plugins disable <name>${c.reset}     Disable a plugin`);
      console.log(`  ${c.green}duck plugins uninstall <name>${c.reset}   Remove a plugin`);
      console.log();
      console.log(`${c.bold}Examples:${c.reset}`);
      console.log(`  duck plugins list`);
      console.log(`  duck plugins install /path/to/plugin`);
      console.log(`  duck plugins install https://example.com/plugin.tar.gz`);
      console.log(`  duck plugins inspect my-plugin`);
      console.log(`  duck plugins uninstall my-plugin`);
      console.log();
      console.log(`${c.dim}Note: Plugins are installed to ~/.duck/plugins/${c.reset}`);
    }
  }
}
