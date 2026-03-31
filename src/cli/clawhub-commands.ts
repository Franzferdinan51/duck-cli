
// ============ CLAWHUB SKILL MARKETPLACE ============

/**
 * duck clawhub [search|install|list|publish|explore] [args]
 * ClawHub skill marketplace integration
 */
async function clawhubCommand(args: string[]) {
  const [action, ...actionArgs] = args;
  
  console.log(`${c.cyan}🦆 ClawHub Skill Marketplace${c.reset}`);
  console.log(`${c.dim}clawhub.ai - OpenClaw skill registry${c.reset}\n`);

  // Lazy import to avoid circular deps
  const { ClawHubClient, SkillInstaller } = await import('../clawhub/index.js');

  const client = new ClawHubClient();
  const installer = new SkillInstaller();

  switch (action) {
    case 'search': {
      const query = actionArgs.join(' ') || '';
      if (!query) {
        console.log(`${c.yellow}Usage: duck clawhub search <query>${c.reset}`);
        console.log(`\nExample: ${c.green}duck clawhub search "web scraping"${c.reset}`);
        return;
      }
      
      console.log(`${c.cyan}🔍 Searching for: "${query}"${c.reset}\n`);
      
      try {
        const results = await client.searchSkills(query);
        
        if (results.skills.length === 0) {
          console.log(`${c.yellow}No skills found for "${query}"${c.reset}`);
          console.log(`\nTry a different search term or browse the catalog:`);
          console.log(`  ${c.green}duck clawhub explore${c.reset}`);
          return;
        }
        
        console.log(`${c.green}Found ${results.total} skills:${c.reset}\n`);
        
        for (const skill of results.skills.slice(0, 10)) {
          console.log(`  ${c.bold}${skill.name}${c.reset}`);
          console.log(`    ${skill.description}`);
          console.log(`    ${c.dim}by ${skill.author} | v${skill.version} | ${skill.downloads} downloads${c.reset}`);
          console.log();
        }
        
        if (results.total > 10) {
          console.log(`${c.dim}... and ${results.total - 10} more. Use --page to see more.${c.reset}`);
        }
        
        console.log(`\n${c.green}Install a skill:${c.reset}`);
        console.log(`  ${c.cyan}duck clawhub install <skill-name>${c.reset}`);
        
      } catch (e: any) {
        console.log(`${c.red}❌ Search failed: ${e.message}${c.reset}`);
        console.log(`${c.dim}Make sure you have an internet connection.${c.reset}`);
      }
      break;
    }

    case 'install': {
      const skillName = actionArgs[0];
      if (!skillName) {
        console.log(`${c.yellow}Usage: duck clawhub install <skill-name>${c.reset}`);
        console.log(`\nExample: ${c.green}duck clawhub install web-scraping${c.reset}`);
        return;
      }
      
      console.log(`${c.cyan}📦 Installing skill: ${skillName}${c.reset}\n`);
      
      // Check if already installed
      if (await installer.isInstalled(skillName)) {
        console.log(`${c.yellow}⚠ Skill "${skillName}" is already installed${c.reset}`);
        console.log(`Update it with: ${c.cyan}duck clawhub update ${skillName}${c.reset}`);
        return;
      }
      
      try {
        // Try to get skill from registry
        const skill = await client.getSkill(skillName);
        
        const result = await installer.install(skillName, {
          version: skill.version,
          sourceUrl: skill.sourceUrl,
          dependencies: skill.dependencies,
        });
        
        if (result.success) {
          console.log(`${c.green}✅ Successfully installed "${skillName}"!${c.reset}`);
          console.log(`\nSkill installed to: ${result.path}`);
          console.log(`\n${c.green}Activate the skill:${c.reset}`);
          console.log(`  The skill is now available for use by the agent`);
          console.log(`\n${c.dim}Skills are loaded from src/skills/ directory${c.reset}`);
        } else {
          console.log(`${c.red}❌ Installation failed: ${result.error}${c.reset}`);
        }
      } catch (e: any) {
        console.log(`${c.red}❌ Could not find skill "${skillName}"${c.reset}`);
        console.log(`\nSearch for available skills:`);
        console.log(`  ${c.green}duck clawhub search "${skillName}"${c.reset}`);
        console.log(`Or browse the catalog:`);
        console.log(`  ${c.green}duck clawhub explore${c.reset}`);
      }
      break;
    }

    case 'list': {
      console.log(`${c.cyan}📋 Installed Skills${c.reset}\n`);
      
      const skills = await installer.list();
      
      if (skills.length === 0) {
        console.log(`${c.yellow}No skills installed${c.reset}`);
        console.log(`\n${c.green}Browse and install skills:${c.reset}`);
        console.log(`  ${c.cyan}duck clawhub explore${c.reset}  # Browse catalog`);
        console.log(`  ${c.cyan}duck clawhub search <query>${c.reset}  # Search skills`);
        return;
      }
      
      console.log(`${c.green}Installed ${skills.length} skill(s):${c.reset}\n`);
      
      for (const skill of skills) {
        console.log(`  ${c.bold}${skill.name}${c.reset} v${skill.version}`);
        console.log(`    Installed: ${new Date(skill.installedAt).toLocaleDateString()}`);
        if (skill.dependencies?.length) {
          console.log(`    Dependencies: ${skill.dependencies.join(', ')}`);
        }
        console.log();
      }
      
      console.log(`${c.green}Update all skills:${c.reset}`);
      console.log(`  ${c.cyan}duck clawhub update --all${c.reset}`);
      break;
    }

    case 'uninstall': {
      const skillName = actionArgs[0];
      if (!skillName) {
        console.log(`${c.yellow}Usage: duck clawhub uninstall <skill-name>${c.reset}`);
        return;
      }
      
      console.log(`${c.cyan}🗑️ Uninstalling: ${skillName}${c.reset}\n`);
      
      const result = await installer.uninstall(skillName);
      
      if (result.success) {
        console.log(`${c.green}✅ Successfully uninstalled "${skillName}"${c.reset}`);
      } else {
        console.log(`${c.red}❌ Uninstall failed: ${result.error}${c.reset}`);
      }
      break;
    }

    case 'update': {
      const skillName = actionArgs[0];
      
      if (!skillName) {
        console.log(`${c.yellow}Usage: duck clawhub update [skill-name|--all]${c.reset}`);
        return;
      }
      
      if (skillName === '--all') {
        console.log(`${c.cyan}🔄 Updating all skills...${c.reset}\n`);
        const skills = await installer.list();
        
        let updated = 0;
        let failed = 0;
        
        for (const skill of skills) {
          try {
            const result = await installer.update(skill.name);
            if (result.success) {
              console.log(`  ${c.green}✓${c.reset} ${skill.name}`);
              updated++;
            } else {
              console.log(`  ${c.red}✗${c.reset} ${skill.name}`);
              failed++;
            }
          } catch {
            console.log(`  ${c.red}✗${c.reset} ${skill.name}`);
            failed++;
          }
        }
        
        console.log(`\n${c.green}Updated ${updated} skill(s), ${failed} failed${c.reset}`);
      } else {
        console.log(`${c.cyan}🔄 Updating: ${skillName}${c.reset}\n`);
        const result = await installer.update(skillName);
        
        if (result.success) {
          console.log(`${c.green}✅ Successfully updated "${skillName}"${c.reset}`);
        } else {
          console.log(`${c.red}❌ Update failed: ${result.error}${c.reset}`);
        }
      }
      break;
    }

    case 'publish': {
      const skillName = actionArgs[0];
      if (!skillName) {
        console.log(`${c.yellow}Usage: duck clawhub publish <skill-name>${c.reset}`);
        console.log(`\nPublish your skill to ClawHub marketplace.`);
        console.log(`\n${c.cyan}API key required. Set:${c.reset}`);
        console.log(`  export CLAWHUB_API_KEY="your-key"`);
        return;
      }
      
      console.log(`${c.cyan}📤 Publishing: ${skillName}${c.reset}\n`);
      console.log(`${c.yellow}Publishing requires API key. Use ClawHub CLI instead:${c.reset}`);
      console.log(`  npx clawhub publish ${skillName}`);
      break;
    }

    case 'explore': {
      console.log(`${c.cyan}🗂️ ClawHub Skill Catalog${c.reset}`);
      console.log(`${c.dim}clawhub.ai - Browse all available skills${c.reset}\n`);
      
      try {
        // Get featured skills
        const featured = await client.getFeatured();
        
        if (featured.length > 0) {
          console.log(`${c.green}⭐ Featured Skills:${c.reset}\n`);
          
          for (const skill of featured.slice(0, 5)) {
            console.log(`  ${c.bold}${skill.name}${c.reset}`);
            console.log(`    ${skill.description}`);
            console.log(`    ${c.dim}by ${skill.author} | v${skill.version}${c.reset}`);
            console.log();
          }
        }
        
        // Get all skills (catalog)
        const catalog = await client.listSkills({ limit: 20 });
        
        console.log(`${c.green}📚 Latest Skills:${c.reset}\n`);
        
        for (const skill of catalog.skills.slice(0, 10)) {
          console.log(`  ${c.bold}${skill.name}${c.reset}`);
          console.log(`    ${skill.description.substring(0, 60)}${skill.description.length > 60 ? '...' : ''}`);
          console.log(`    ${c.dim}by ${skill.author}${c.reset}`);
          console.log();
        }
        
        console.log(`${c.green}Install a skill:${c.reset}`);
        console.log(`  ${c.cyan}duck clawhub install <skill-name>${c.reset}`);
        console.log(`\n${c.green}Search for specific skills:${c.reset}`);
        console.log(`  ${c.cyan}duck clawhub search "web scraping"${c.reset}`);
        
      } catch (e: any) {
        console.log(`${c.red}❌ Could not load catalog: ${e.message}${c.reset}`);
        console.log(`\nVisit ${c.cyan}https://clawhub.ai${c.reset} to browse skills manually.`);
      }
      break;
    }

    case 'info': {
      const skillName = actionArgs[0];
      if (!skillName) {
        console.log(`${c.yellow}Usage: duck clawhub info <skill-name>${c.reset}`);
        return;
      }
      
      console.log(`${c.cyan}📄 Skill Info: ${skillName}${c.reset}\n`);
      
      try {
        const skill = await client.getSkill(skillName);
        
        console.log(`${c.bold}${skill.name}${c.reset} v${skill.version}`);
        console.log(`${c.dim}by ${skill.author}${c.reset}\n`);
        console.log(skill.description);
        console.log();
        console.log(`${c.green}Downloads:${c.reset} ${skill.downloads}`);
        console.log(`${c.green}Rating:${c.reset} ${skill.rating}/5`);
        
        if (skill.tags?.length) {
          console.log(`${c.green}Tags:${c.reset} ${skill.tags.join(', ')}`);
        }
        
        if (skill.dependencies?.length) {
          console.log(`${c.yellow}Dependencies:${c.reset} ${skill.dependencies.join(', ')}`);
        }
        
        console.log(`\n${c.green}Install:${c.reset} duck clawhub install ${skillName}`);
        
      } catch (e: any) {
        console.log(`${c.red}❌ Could not find skill "${skillName}"${c.reset}`);
      }
      break;
    }

    default: {
      console.log(`${c.bold}🦆 ClawHub Skill Marketplace${c.reset}`);
      console.log(`${c.dim}clawhub.ai - The OpenClaw skill registry${c.reset}\n`);
      console.log(`${c.bold}Commands:${c.reset}`);
      console.log(`  ${c.green}duck clawhub explore${c.reset}         Browse skill catalog`);
      console.log(`  ${c.green}duck clawhub search <query>${c.reset}    Search for skills`);
      console.log(`  ${c.green}duck clawhub install <name>${c.reset}   Install a skill`);
      console.log(`  ${c.green}duck clawhub list${c.reset}              List installed skills`);
      console.log(`  ${c.green}duck clawhub info <name>${c.reset}       Show skill details`);
      console.log(`  ${c.green}duck clawhub update [name]${c.reset}     Update skills`);
      console.log(`  ${c.green}duck clawhub uninstall <name>${c.reset}  Remove a skill`);
      console.log();
      console.log(`${c.bold}Examples:${c.reset}`);
      console.log(`  duck clawhub explore`);
      console.log(`  duck clawhub search "web scraping"`);
      console.log(`  duck clawhub install github`);
      console.log(`  duck clawhub list`);
      console.log();
      console.log(`${c.dim}Note: Aliases: "duck skills" = "duck clawhub"${c.reset}`);
    }
  }
}

// ============ SOUL REGISTRY (onlycrabs.ai) ============

/**
 * duck souls [search|install|list|activate] [args]
 * SOUL.md registry for AI personas
 */
async function soulsCommand(args: string[]) {
  const [action, ...actionArgs] = args;
  
  console.log(`${c.cyan}🦆 SOUL Registry${c.reset}`);
  console.log(`${c.dim}onlycrabs.ai - AI persona registry${c.reset}\n`);

  const { SoulRegistry } = await import('../clawhub/index.js');

  const registry = new SoulRegistry();

  switch (action) {
    case 'search': {
      const query = actionArgs.join(' ') || '';
      if (!query) {
        console.log(`${c.yellow}Usage: duck souls search <query>${c.reset}`);
        console.log(`\nExample: ${c.green}duck souls search "helpful assistant"${c.reset}`);
        return;
      }
      
      console.log(`${c.cyan}🔍 Searching SOULs: "${query}"${c.reset}\n`);
      
      try {
        const results = await registry.search(query);
        
        if (results.souls.length === 0) {
          console.log(`${c.yellow}No SOULs found for "${query}"${c.reset}`);
          return;
        }
        
        console.log(`${c.green}Found ${results.total} SOUL(s):${c.reset}\n`);
        
        for (const soul of results.souls.slice(0, 10)) {
          console.log(`  ${c.bold}${soul.name}${c.reset}`);
          console.log(`    ${soul.description}`);
          console.log(`    ${c.dim}by ${soul.author} | v${soul.version}${c.reset}`);
          console.log();
        }
        
        console.log(`${c.green}Install a SOUL:${c.reset}`);
        console.log(`  ${c.cyan}duck souls install <soul-name>${c.reset}`);
        
      } catch (e: any) {
        console.log(`${c.red}❌ Search failed: ${e.message}${c.reset}`);
      }
      break;
    }

    case 'install': {
      const soulName = actionArgs[0];
      if (!soulName) {
        console.log(`${c.yellow}Usage: duck souls install <soul-name>${c.reset}`);
        console.log(`\nExample: ${c.green}duck souls install helpful-assistant${c.reset}`);
        return;
      }
      
      console.log(`${c.cyan}📦 Installing SOUL: ${soulName}${c.reset}\n`);
      
      if (await registry.isInstalled(soulName)) {
        console.log(`${c.yellow}⚠ SOUL "${soulName}" is already installed${c.reset}`);
        console.log(`Activate it with: ${c.cyan}duck souls activate ${soulName}${c.reset}`);
        return;
      }
      
      const result = await registry.install(soulName);
      
      if (result.success) {
        console.log(`${c.green}✅ Successfully installed "${soulName}"!${c.reset}`);
        console.log(`\n${c.green}Activate the SOUL:${c.reset}`);
        console.log(`  ${c.cyan}duck souls activate ${soulName}${c.reset}`);
      } else {
        console.log(`${c.red}❌ Installation failed: ${result.error}${c.reset}`);
      }
      break;
    }

    case 'activate': {
      const soulName = actionArgs[0];
      if (!soulName) {
        console.log(`${c.yellow}Usage: duck souls activate <soul-name>${c.reset}`);
        return;
      }
      
      console.log(`${c.cyan}🎭 Activating SOUL: ${soulName}${c.reset}\n`);
      
      const result = await registry.activate(soulName);
      
      if (result.success) {
        console.log(`${c.green}✅ SOUL "${soulName}" activated!${c.reset}`);
        console.log(`\nThe agent will now use this persona.`);
        console.log(`Restart the agent for changes to take effect.`);
      } else {
        console.log(`${c.red}❌ Activation failed: ${result.error}${c.reset}`);
      }
      break;
    }

    case 'list': {
      console.log(`${c.cyan}📋 Installed SOULs${c.reset}\n`);
      
      const souls = await registry.list();
      
      if (souls.length === 0) {
        console.log(`${c.yellow}No SOULs installed${c.reset}`);
        console.log(`\n${c.green}Browse available SOULs:${c.reset}`);
        console.log(`  ${c.cyan}duck souls search "assistant"${c.reset}`);
        return;
      }
      
      console.log(`${c.green}Installed ${souls.length} SOUL(s):${c.reset}\n`);
      
      for (const soul of souls) {
        console.log(`  ${c.bold}${soul.name}${c.reset} v${soul.version}`);
        console.log(`    Installed: ${new Date(soul.installedAt).toLocaleDateString()}`);
        console.log();
      }
      break;
    }

    case 'featured': {
      console.log(`${c.cyan}⭐ Featured SOULs${c.reset}\n`);
      
      try {
        const souls = await registry.featured();
        
        for (const soul of souls.slice(0, 10)) {
          console.log(`  ${c.bold}${soul.name}${c.reset}`);
          console.log(`    ${soul.description}`);
          console.log(`    ${c.dim}by ${soul.author}${c.reset}`);
          console.log();
        }
        
        console.log(`${c.green}Install a SOUL:${c.reset}`);
        console.log(`  ${c.cyan}duck souls install <soul-name>${c.reset}`);
        
      } catch (e: any) {
        console.log(`${c.red}❌ Failed to load featured: ${e.message}${c.reset}`);
      }
      break;
    }

    case 'uninstall': {
      const soulName = actionArgs[0];
      if (!soulName) {
        console.log(`${c.yellow}Usage: duck souls uninstall <soul-name>${c.reset}`);
        return;
      }
      
      console.log(`${c.cyan}🗑️ Uninstalling: ${soulName}${c.reset}\n`);
      
      const result = await registry.uninstall(soulName);
      
      if (result.success) {
        console.log(`${c.green}✅ Successfully uninstalled "${soulName}"${c.reset}`);
      } else {
        console.log(`${c.red}❌ Uninstall failed: ${result.error}${c.reset}`);
      }
      break;
    }

    default: {
      console.log(`${c.bold}🦆 SOUL Registry${c.reset}`);
      console.log(`${c.dim}onlycrabs.ai - AI persona registry${c.reset}\n`);
      console.log(`${c.bold}Commands:${c.reset}`);
      console.log(`  ${c.green}duck souls featured${c.reset}           Show featured SOULs`);
      console.log(`  ${c.green}duck souls search <query>${c.reset}      Search for SOULs`);
      console.log(`  ${c.green}duck souls install <name>${c.reset}      Install a SOUL`);
      console.log(`  ${c.green}duck souls list${c.reset}                List installed SOULs`);
      console.log(`  ${c.green}duck souls activate <name>${c.reset}      Activate a SOUL`);
      console.log(`  ${c.green}duck souls uninstall <name>${c.reset}   Remove a SOUL`);
      console.log();
      console.log(`${c.bold}Examples:${c.reset}`);
      console.log(`  duck souls featured`);
      console.log(`  duck souls search "helpful assistant"`);
      console.log(`  duck souls install my-persona`);
      console.log(`  duck souls activate my-persona`);
    }
  }
}

export { clawhubCommand, soulsCommand };
