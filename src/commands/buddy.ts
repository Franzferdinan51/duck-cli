/**
 * 🦆 Duck Agent - Buddy CLI Commands
 */

import { Command } from 'commander';
import {
  rollCompanion,
  getCompanion,
  hatchCompanion,
  getBuddyComment,
  formatCompanionCard,
  loadBuddyConfig,
  setCompanionMuted,
  isMuted,
  RARITIES,
  STAT_NAMES,
} from '../buddy/types.js';
import { renderCompanion, renderSprite } from '../buddy/sprites.js';

export function createBuddyCommand(): Command {
  const buddy = new Command('buddy')
    .description('🐤 Buddy Companion - Virtual pet companion system');

  // Show companion
  buddy
    .command('show')
    .description('Show your buddy')
    .action(() => {
      const companion = getCompanion();
      
      if (!companion) {
        console.log('\n  🐤 You don\'t have a buddy yet!');
        console.log('  Use "duck buddy hatch" to hatch one!\n');
        return;
      }
      
      const sprite = renderCompanion(
        {
          species: companion.species,
          eye: companion.eye,
          hat: companion.hat,
          shiny: companion.shiny,
        },
        companion.name,
        companion.personality.slice(0, 20)
      );
      
      console.log(sprite);
    });

  // Hatch a new buddy
  buddy
    .command('hatch <name>')
    .description('Hatch a new buddy')
    .option('-p, --personality <text>', 'Buddy personality', 'A helpful coding companion')
    .action((name, options) => {
      // Roll for companion
      const { bones } = rollCompanion(name);
      const companion = hatchCompanion(name, options.personality);
      
      console.log('\n  🥚 Hatching your buddy...\n');
      
      // Small delay for effect
      setTimeout(() => {
        const sprite = renderCompanion(
          {
            species: companion.species,
            eye: companion.eye,
            hat: companion.hat,
            shiny: companion.shiny,
          },
          companion.name,
          companion.personality.slice(0, 20)
        );
        
        console.log(sprite);
        console.log(formatCompanionCard(companion));
        console.log('  Welcome to the world,', companion.name, '!\n');
      }, 500);
    });

  // Reroll (get a new species while keeping name)
  buddy
    .command('reroll')
    .description('Re-roll your buddy\'s species and stats')
    .action(() => {
      const current = getCompanion();
      if (!current) {
        console.log('\n  🐤 You don\'t have a buddy yet!\n');
        return;
      }
      
      const { bones } = rollCompanion(current.name + '-reroll');
      const newCompanion = hatchCompanion(
        current.name,
        current.personality
      );
      
      console.log('\n  🎲 Rerolling...\n');
      
      setTimeout(() => {
        const sprite = renderCompanion(
          {
            species: newCompanion.species,
            eye: newCompanion.eye,
            hat: newCompanion.hat,
            shiny: newCompanion.shiny,
          },
          newCompanion.name,
          newCompanion.personality.slice(0, 20)
        );
        
        console.log(sprite);
        console.log(formatCompanionCard(newCompanion));
        
        if (newCompanion.rarity !== current.rarity) {
          console.log(`  ${current.rarity.toUpperCase()} → ${newCompanion.rarity.toUpperCase()}!\n`);
        }
      }, 500);
    });

  // Stats
  buddy
    .command('stats')
    .description('Show buddy stats')
    .action(() => {
      const companion = getCompanion();
      if (!companion) {
        console.log('\n  🐤 You don\'t have a buddy yet!\n');
        return;
      }
      
      console.log(formatCompanionCard(companion));
    });

  // Set personality
  buddy
    .command('personality <text>')
    .description('Set buddy personality')
    .action((text) => {
      const companion = getCompanion();
      if (!companion) {
        console.log('\n  🐤 You don\'t have a buddy yet!\n');
        return;
      }
      
      hatchCompanion(companion.name, text);
      console.log(`\n  ✅ ${companion.name}'s personality is now: "${text}"\n`);
    });

  // Mute/unmute
  buddy
    .command('mute')
    .description('Mute buddy comments')
    .action(() => {
      setCompanionMuted(true);
      console.log('\n  🔇 Buddy muted\n');
    });

  buddy
    .command('unmute')
    .description('Unmute buddy comments')
    .action(() => {
      setCompanionMuted(false);
      console.log('\n  🔊 Buddy unmuted\n');
    });

  // Check if muted
  buddy
    .command('status')
    .description('Check buddy status')
    .action(() => {
      const companion = getCompanion();
      const muted = isMuted();
      
      if (!companion) {
        console.log('\n  🐤 No buddy yet\n');
        return;
      }
      
      const muteStatus = muted ? '🔇 MUTED' : '🔊 Active';
      console.log(`\n  🐤 ${companion.name} - ${muteStatus}\n`);
    });

  // Preview species
  buddy
    .command('preview <species>')
    .description('Preview a species sprite')
    .option('-f, --frame <n>', 'Animation frame', (val) => parseInt(val), 0)
    .action((species, options) => {
      const validSpecies = ['duck', 'blob', 'cat', 'dragon', 'owl', 'ghost', 'robot', 'rabbit', 'cactus', 'snail'];
      if (!validSpecies.includes(species)) {
        console.log(`\n  ❌ Unknown species: ${species}`);
        console.log(`  Available: ${validSpecies.join(', ')}\n`);
        return;
      }
      
      const sprite = renderSprite({
        species: species as any,
        eye: '◉',
        hat: 'none',
        shiny: false,
        frame: options.frame,
      });
      
      console.log(`\n  Species: ${species}`);
      console.log(`  Frame: ${options.frame}`);
      console.log(sprite);
      console.log('');
    });

  // Comment
  buddy
    .command('comment [type]')
    .description('Get a buddy comment')
    .option('-t, --type <type>', 'Comment type', 'idle')
    .action((type, options) => {
      const validTypes = ['idle', 'working', 'success', 'error', 'waiting'];
      const t = (type || options.type) as any;
      if (!validTypes.includes(t)) {
        console.log(`\n  ❌ Unknown type: ${t}`);
        console.log(`  Available: ${validTypes.join(', ')}\n`);
        return;
      }
      
      const comment = getBuddyComment(t);
      const companion = getCompanion();
      const name = companion?.name || 'Buddy';
      
      console.log(`\n  🐤 ${name}: "${comment}"\n`);
    });

  // List species
  buddy
    .command('species')
    .description('List all available species')
    .action(() => {
      const species = [
        { name: 'duck', desc: 'Classic waddle buddy' },
        { name: 'blob', desc: 'Squishy and adorable' },
        { name: 'cat', desc: 'Independent coder' },
        { name: 'dragon', desc: 'Fire-breathing debugger' },
        { name: 'owl', desc: 'Wise and watchful' },
        { name: 'ghost', desc: 'Spooky but helpful' },
        { name: 'robot', desc: 'Binary bestie' },
        { name: 'rabbit', desc: 'Fast hopper' },
        { name: 'cactus', desc: 'Prickly but sweet' },
        { name: 'snail', desc: 'Slow and steady' },
      ];
      
      console.log('\n  📋 Available Species:\n');
      for (const s of species) {
        console.log(`  ${s.name.padEnd(10)} ${s.desc}`);
      }
      console.log('');
    });

  return buddy;
}

export default createBuddyCommand;
