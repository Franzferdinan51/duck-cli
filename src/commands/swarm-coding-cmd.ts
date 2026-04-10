/**
 * 🦆 Duck Agent - Swarm Coding Command
 * CLI command for AI Council swarm coding integration
 */

import { Command } from 'commander';
import { SwarmCodingIntegration } from '../council/swarm-coding-integration.js';

export function createSwarmCodingCommand(): Command {
  const cmd = new Command('swarm')
    .description('AI Council Swarm Coding - Multi-agent code generation');

  cmd
    .command('start <prompt>')
    .description('Start a new swarm coding session')
    .option('-r, --roles <roles>', 'Comma-separated list of roles (architect,backend,frontend,security,qa,devops)')
    .option('--auto', 'Auto-mode (no human intervention)', true)
    .option('--no-quality-gates', 'Skip quality gates')
    .option('-i, --max-iterations <n>', 'Maximum iterations per phase', '3')
    .action(async (prompt, options) => {
      const swarm = new SwarmCodingIntegration({
        autoMode: options.auto,
        qualityGates: options.qualityGates,
        maxIterations: parseInt(options.maxIterations)
      });

      await swarm.initialize();

      const roles = options.roles?.split(',') || undefined;
      const session = await swarm.startSession(prompt, { roles });

      console.log(`\n🐝 Swarm Coding Session Started`);
      console.log(`Session ID: ${session.id}`);
      console.log(`Roles: ${session.roles.map(r => r.name).join(', ')}`);
      console.log(`Phases: ${session.phases.map(p => p.name).join(' → ')}`);
      console.log(`\nStatus: ${session.status}`);

      // Listen for events
      swarm.on('phase_started', ({ phase }) => {
        console.log(`\n📍 Phase started: ${phase}`);
      });

      swarm.on('phase_completed', ({ phase }) => {
        console.log(`✅ Phase completed: ${phase}`);
      });

      swarm.on('session_completed', ({ sessionId }) => {
        const s = swarm.getSession(sessionId);
        console.log(`\n🎉 Session completed!`);
        console.log(`Artifacts: ${s?.artifacts.size}`);
        
        if (s?.qualityReport) {
          console.log(`\nQuality Report:`);
          console.log(`  Overall: ${s.qualityReport.overall}`);
          console.log(`  Coverage: ${s.qualityReport.codeCoverage}%`);
          console.log(`  Security: ${s.qualityReport.securityScore}/100`);
        }
      });

      swarm.on('session_failed', ({ reason }) => {
        console.log(`\n❌ Session failed: ${reason}`);
      });

      // Wait for completion
      while (session.status === 'running') {
        await new Promise(r => setTimeout(r, 1000));
      }
    });

  cmd
    .command('list')
    .description('List active swarm sessions')
    .action(async () => {
      const swarm = new SwarmCodingIntegration();
      await swarm.initialize();
      
      const sessions = swarm.getAllSessions();
      console.log(`\n🐝 Active Swarm Sessions: ${sessions.length}`);
      
      for (const session of sessions) {
        console.log(`\n  ${session.id}`);
        console.log(`  Prompt: ${session.prompt.substring(0, 50)}...`);
        console.log(`  Status: ${session.status}`);
        console.log(`  Phase: ${session.phases[session.currentPhase]?.name || 'completed'}`);
        console.log(`  Artifacts: ${session.artifacts.size}`);
      }
    });

  cmd
    .command('status <sessionId>')
    .description('Get session status and artifacts')
    .action(async (sessionId) => {
      const swarm = new SwarmCodingIntegration();
      await swarm.initialize();
      
      const session = swarm.getSession(sessionId);
      if (!session) {
        console.log(`Session not found: ${sessionId}`);
        return;
      }

      console.log(`\n🐝 Swarm Session: ${session.id}`);
      console.log(`Status: ${session.status}`);
      console.log(`Current Phase: ${session.phases[session.currentPhase]?.name || 'completed'}`);
      console.log(`\nPhases:`);
      
      for (const phase of session.phases) {
        const icon = phase.status === 'completed' ? '✅' : 
                     phase.status === 'active' ? '🔄' : 
                     phase.status === 'failed' ? '❌' : '⏳';
        console.log(`  ${icon} ${phase.name}`);
      }

      console.log(`\nArtifacts (${session.artifacts.size}):`);
      for (const [key, value] of session.artifacts) {
        console.log(`  📄 ${key}: ${value.substring(0, 100)}...`);
      }

      if (session.qualityReport) {
        console.log(`\nQuality Report:`);
        console.log(`  Overall: ${session.qualityReport.overall}`);
        console.log(`  Code Coverage: ${session.qualityReport.codeCoverage}%`);
        console.log(`  Complexity: ${session.qualityReport.complexity}/10`);
        console.log(`  Security: ${session.qualityReport.securityScore}/100`);
        console.log(`  Performance: ${session.qualityReport.performanceScore}/100`);
      }
    });

  cmd
    .command('cancel <sessionId>')
    .description('Cancel a swarm session')
    .action(async (sessionId) => {
      const swarm = new SwarmCodingIntegration();
      await swarm.initialize();
      
      await swarm.cancelSession(sessionId);
      console.log(`Session ${sessionId} cancelled`);
    });

  cmd
    .command('artifact <sessionId> <artifactKey>')
    .description('Get a specific artifact')
    .action(async (sessionId, artifactKey) => {
      const swarm = new SwarmCodingIntegration();
      await swarm.initialize();
      
      const artifacts = swarm.getArtifacts(sessionId);
      if (!artifacts || !artifacts.has(artifactKey)) {
        console.log(`Artifact not found: ${artifactKey}`);
        return;
      }

      console.log(artifacts.get(artifactKey));
    });

  return cmd;
}

export default createSwarmCodingCommand;
