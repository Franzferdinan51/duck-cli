/**
 * 🛡️ Duck Agent - Security Command
 * CLI interface for security agent operations
 */

import { Command } from 'commander';
import { SecurityAgent } from '../agent/security-agent.js';
import { DefconSystem } from '../security/defcon-system.js';

export function createSecurityCommand(): Command {
  const cmd = new Command('security')
    .description('Security operations - scan, audit, monitor, and DEFCON');

  const agent = new SecurityAgent();
  const defcon = new DefconSystem();

  cmd
    .command('scan')
    .description('Scan for vulnerabilities')
    .argument('<target>', 'Target to scan (code, file, or command)')
    .option('-t, --type <type>', 'Scan type: code, file, command', 'code')
    .action(async (target, options) => {
      console.log(`🔍 Scanning ${options.type}: ${target.substring(0, 50)}...`);
      
      const result = await agent.scanVulnerabilities(target, options.type);
      
      console.log(`\n📊 Scan Results (${result.riskLevel.toUpperCase()} RISK)`);
      console.log(`Found ${result.findings.length} issue(s)\n`);
      
      for (const finding of result.findings) {
        const icon = finding.severity === 'critical' ? '🔴' :
                     finding.severity === 'high' ? '🟠' :
                     finding.severity === 'medium' ? '🟡' : '🔵';
        console.log(`${icon} [${finding.severity.toUpperCase()}] ${finding.title}`);
        console.log(`   ${finding.description}`);
        if (finding.location) console.log(`   Location: ${finding.location}`);
        if (finding.remediation) console.log(`   Fix: ${finding.remediation}`);
        console.log();
      }
      
      if (result.recommendations.length > 0) {
        console.log('💡 Recommendations:');
        result.recommendations.forEach(r => console.log(`   • ${r}`));
      }
    });

  cmd
    .command('audit')
    .description('Run full system security audit')
    .action(async () => {
      console.log('🔍 Running system security audit...\n');
      
      const result = await agent.auditSystem();
      
      console.log(`📊 Audit Results (${result.riskLevel.toUpperCase()} RISK)`);
      console.log(`Found ${result.findings.length} issue(s)\n`);
      
      for (const finding of result.findings) {
        const icon = finding.severity === 'critical' ? '🔴' :
                     finding.severity === 'high' ? '🟠' :
                     finding.severity === 'medium' ? '🟡' : '🔵';
        console.log(`${icon} [${finding.severity.toUpperCase()}] ${finding.title}`);
        console.log(`   ${finding.description}`);
        if (finding.location) console.log(`   Location: ${finding.location}`);
        if (finding.remediation) console.log(`   Fix: ${finding.remediation}`);
        console.log();
      }
      
      if (result.recommendations.length > 0) {
        console.log('💡 Recommendations:');
        result.recommendations.forEach(r => console.log(`   • ${r}`));
      }
    });

  cmd
    .command('check')
    .description('Check permissions for a file or directory')
    .argument('<path>', 'Path to check')
    .action(async (path) => {
      const findings = await agent.checkPermissions(path);
      
      if (findings.length === 0) {
        console.log(`✅ No permission issues found for ${path}`);
      } else {
        console.log(`⚠️  Found ${findings.length} permission issue(s) for ${path}:\n`);
        for (const finding of findings) {
          console.log(`   [${finding.severity.toUpperCase()}] ${finding.title}`);
          console.log(`   ${finding.description}`);
          if (finding.remediation) console.log(`   Fix: ${finding.remediation}`);
          console.log();
        }
      }
    });

  cmd
    .command('logs')
    .description('Analyze logs for security events')
    .option('-f, --file <path>', 'Log file to analyze')
    .action(async (options) => {
      console.log('🔍 Analyzing logs for security events...\n');
      
      const findings = await agent.analyzeLogs(options.file);
      
      if (findings.length === 0) {
        console.log('✅ No suspicious activity detected');
      } else {
        console.log(`⚠️  Found ${findings.length} security event(s):\n`);
        for (const finding of findings) {
          const icon = finding.severity === 'critical' ? '🔴' :
                       finding.severity === 'high' ? '🟠' :
                       finding.severity === 'medium' ? '🟡' : '🔵';
          console.log(`${icon} [${finding.severity.toUpperCase()}] ${finding.title}`);
          console.log(`   ${finding.description}`);
          if (finding.location) console.log(`   Location: ${finding.location}`);
          console.log();
        }
      }
    });

  cmd
    .command('status')
    .description('Show security status summary')
    .action(() => {
      const status = agent.getStatus();
      
      console.log('🛡️  Security Status\n');
      console.log(`Total Scans:     ${status.totalScans}`);
      console.log(`Total Events:    ${status.totalEvents}`);
      console.log(`Last Scan:       ${status.lastScan ? status.lastScan.toISOString() : 'Never'}`);
      console.log(`Critical Issues: ${status.criticalFindings}`);
      console.log(`High Issues:     ${status.highFindings}`);
    });

  cmd
    .command('history')
    .description('Show scan history')
    .action(() => {
      const history = agent.getScanHistory();
      
      if (history.length === 0) {
        console.log('No scan history');
        return;
      }
      
      console.log('📜 Scan History\n');
      for (const scan of history.slice(-10)) {
        const icon = scan.riskLevel === 'critical' ? '🔴' :
                     scan.riskLevel === 'high' ? '🟠' :
                     scan.riskLevel === 'medium' ? '🟡' : '🟢';
        console.log(`${icon} ${scan.timestamp.toISOString()} - ${scan.scanType} (${scan.findings.length} findings)`);
      }
    });

  cmd
    .command('defcon')
    .description('DEFCON level management')
    .argument('[level]', 'Set DEFCON level (1-5), or omit to show status')
    .option('-r, --reason <reason>', 'Reason for level change')
    .option('--auto <enabled>', 'Enable/disable auto-escalation (true/false)')
    .action(async (level, options) => {
      // Show status if no level provided
      if (!level) {
        const status = defcon.getStatus();
        const current = status.current;
        
        console.log('\n🚨 DEFCON Status\n');
        console.log(`Current Level: ${current.name}`);
        console.log(`Description:   ${current.description}`);
        console.log(`Status:        ${current.level <= 3 ? '⚠️  ELEVATED' : '✅ NORMAL'}`);
        console.log(`Auto-Escalate: ${status.autoEscalation ? '✅ ON' : '❌ OFF'}`);
        console.log(`Last Changed:  ${current.timestamp.toISOString()}`);
        console.log(`Triggered By:  ${current.triggeredBy}`);
        console.log(`Reason:        ${current.reason}`);
        
        if (status.history.length > 0) {
          console.log('\n📜 Recent History:');
          for (const entry of status.history.slice(-5)) {
            const icon = entry.level <= 2 ? '🔴' : entry.level <= 3 ? '🟠' : '🟡';
            console.log(`  ${icon} ${entry.name} - ${entry.timestamp.toISOString()}`);
          }
        }
        return;
      }

      // Handle auto-escalation toggle
      if (options.auto !== undefined) {
        const enabled = options.auto === 'true' || options.auto === true;
        defcon.setAutoEscalation(enabled);
        console.log(`✅ Auto-escalation ${enabled ? 'enabled' : 'disabled'}`);
        return;
      }

      // Set DEFCON level
      const newLevel = parseInt(level, 10);
      if (isNaN(newLevel) || newLevel < 1 || newLevel > 5) {
        console.error('❌ Invalid DEFCON level. Must be 1-5.');
        process.exit(1);
      }

      const reason = options.reason || 'Manual level change';
      await defcon.setLevel(newLevel as 1|2|3|4|5, reason, 'manual');
      
      const newState = defcon.getCurrentLevel();
      console.log(`\n🚨 DEFCON Level Changed`);
      console.log(`New Level: ${newState.name}`);
      console.log(`Reason:    ${newState.reason}`);
      console.log(`Time:      ${newState.timestamp.toISOString()}`);
      
      if (newLevel <= 3) {
        console.log('\n⚠️  WARNING: DEFCON level is now ELEVATED');
        console.log('Security measures have been increased.');
      }
    });

  cmd
    .command('threat')
    .description('Report a security threat for DEFCON assessment')
    .requiredOption('-c, --category <category>', 'Threat category: cyber, physical, weather, health, financial, infrastructure')
    .requiredOption('-s, --severity <severity>', 'Severity: low, medium, high, critical')
    .requiredOption('-d, --description <description>', 'Threat description')
    .option('--source <source>', 'Threat source', 'manual-report')
    .action(async (options) => {
      const threat = {
        category: options.category,
        severity: options.severity,
        description: options.description,
        source: options.source,
        recommendedLevel: 5 as 1|2|3|4|5
      };

      console.log('\n🚨 Threat Reported');
      console.log(`Category: ${threat.category}`);
      console.log(`Severity: ${threat.severity}`);
      console.log(`Description: ${threat.description}`);
      
      await defcon.assessThreat(threat);
      
      const current = defcon.getCurrentLevel();
      console.log(`\nCurrent DEFCON: ${current.name}`);
      
      if (defcon.isElevated()) {
        console.log('\n⚠️  Security measures are now active.');
      }
    });

  return cmd;
}

export default createSecurityCommand;
