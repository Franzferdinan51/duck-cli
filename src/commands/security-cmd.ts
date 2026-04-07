/**
 * 🛡️ Duck Agent - Security Command
 * CLI interface for security agent operations
 */

import { Command } from 'commander';
import { SecurityAgent } from '../agent/security-agent.js';

export function createSecurityCommand(): Command {
  const cmd = new Command('security')
    .description('Security operations - scan, audit, and monitor');

  const agent = new SecurityAgent();

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

  return cmd;
}

export default createSecurityCommand;
