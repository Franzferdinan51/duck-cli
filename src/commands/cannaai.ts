/**
 * 🦆 Duck CLI - CannaAI Command
 * CLI commands for CannaAI grow monitoring integration
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';

const CANNAAI_URL = process.env.CANNAAI_URL || 'http://localhost:3007';
const AI_COUNCIL_URL = process.env.AI_COUNCIL_URL || 'http://localhost:3006';

async function apiFetch(path: string, opts: any = {}) {
  const url = `${CANNAAI_URL}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal as any, ...opts });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function councilFetch(path: string, body: any) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${AI_COUNCIL_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal as any,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export function createCannaaiCommand(): Command {
  const cannaai = new Command('cannaai')
    .description('🌿 CannaAI grow monitoring commands');

  // Status
  cannaai
    .command('status')
    .description('Show CannaAI system status')
    .action(async () => {
      console.log('\n🌿 CannaAI Status\n');
      try {
        const data = await apiFetch('/api/status');
        console.log(`  ✅ Server: Online`);
        console.log(`  🌡️  Environment: ${data.environment || 'N/A'}`);
        console.log(`  🌱 Plants: ${data.plantCount || data.plants || 'N/A'}`);
        console.log(`  📡 Sensors: ${data.sensorCount || data.sensors || 'N/A'}`);
        console.log(`  🚨 Alerts: ${data.alertCount || data.alerts || 'N/A'}`);
        console.log(`  ⏱️  Uptime: ${data.uptime || 'N/A'}`);
      } catch {
        console.log(`  ❌ Server: Offline (is CannaAI running on ${CANNAAI_URL}?)`);
      }
      console.log('');
    });

  // Monitor env
  cannaai
    .command('monitor')
    .description('Show current environmental data')
    .action(async () => {
      console.log('\n🌡️ Environment Monitor\n');
      try {
        const data = await apiFetch('/api/environment/current');
        if (typeof data === 'object' && data !== null) {
          if (data.temperature) console.log(`  🌡️  Temperature: ${data.temperature}°F`);
          if (data.humidity) console.log(`  💧 Humidity: ${data.humidity}%`);
          if (data.vpd) console.log(`  🌬️  VPD: ${data.vpd} kPa`);
          if (data.ppm || data.ec) console.log(`  🧪 PPM: ${data.ppm || data.ec}`);
          if (data.ph) console.log(`  ⚗️  pH: ${data.ph}`);
          if (data.light) console.log(`  💡 Light: ${data.light}`);
        } else {
          console.log('  ' + JSON.stringify(data));
        }
      } catch (e: any) {
        console.log(`  ❌ Error: ${e.message}`);
      }
      console.log('');
    });

  // Analyze plant photo
  cannaai
    .command('analyze <imagePath>')
    .description('Analyze a plant photo')
    .option('-c, --council', 'Run through AI Council for expert deliberation')
    .action(async (imagePath: string, options: any) => {
      console.log(`\n🔍 Analyzing: ${imagePath}\n`);
      try {
        const imageBuffer = readFileSync(imagePath);
        const base64 = imageBuffer.toString('base64');
        const ext = imagePath.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const imageData = `data:${mimeType};base64,${base64}`;

        if (options.council) {
          console.log('🏛️  Consulting the AI Council...\n');
          const result = await councilFetch('/api/council/deliberate', {
            prompt: `As a cannabis cultivation expert council, analyze this plant photo and provide detailed advice: ${imageData}`,
            mode: 'deliberation',
            councilors: ['cultivator', 'trichome-inspector', 'nutrient-manager', 'ipm-specialist'],
          });
          console.log('🏛️  Council Verdict:\n');
          if (result.response) console.log('  ' + result.response.substring(0, 800));
          else console.log('  ' + JSON.stringify(result).substring(0, 500));
        } else {
          const data = await apiFetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData }),
          });
          console.log('🌿 Analysis Result:\n');
          console.log(`  Health: ${data.health || data.overallHealth || data.analysis || 'N/A'}`);
          if (data.issues?.length) console.log(`  Issues: ${data.issues.join(', ')}`);
          if (data.confidence) console.log(`  Confidence: ${(data.confidence * 100).toFixed(0)}%`);
          if (data.recommendations?.length) {
            console.log('\n  Recommendations:');
            data.recommendations.forEach((r: string, i: number) => console.log(`    ${i + 1}. ${r}`));
          }
        }
      } catch (e: any) {
        console.log(`  ❌ Analysis failed: ${e.message}`);
      }
      console.log('');
    });

  // Alerts
  cannaai
    .command('alerts')
    .description('List active alerts')
    .option('-a, --all', 'Show all alerts (not just active)')
    .action(async (options: any) => {
      console.log('\n🚨 Active Alerts\n');
      try {
        const path = options.all ? '/api/alerts' : '/api/alerts?status=active';
        const data = await apiFetch(path);
        const alerts = Array.isArray(data) ? data : data.alerts || [];
        if (alerts.length === 0) {
          console.log('  No alerts ✅');
        } else {
          alerts.forEach((alert: any, i: number) => {
            const emoji = alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵';
            console.log(`  ${emoji} [${(alert.severity || 'info').toUpperCase()}] ${alert.message || alert.title || alert.description || JSON.stringify(alert).substring(0, 60)}`);
          });
        }
      } catch (e: any) {
        console.log(`  ❌ Error: ${e.message}`);
      }
      console.log('');
    });

  // Plants list
  cannaai
    .command('plants')
    .description('List all plants')
    .action(async () => {
      console.log('\n🌱 Plants\n');
      try {
        const data = await apiFetch('/api/plants');
        const plants = Array.isArray(data) ? data : data.plants || [];
        if (plants.length === 0) {
          console.log('  No plants found');
        } else {
          plants.forEach((plant: any) => {
            const health = plant.health || plant.status || 'N/A';
            const emoji = health.includes('good') || health.includes('healthy') ? '✅' : health.includes('warning') || health.includes('stress') ? '⚠️' : '❓';
            console.log(`  ${emoji} ${plant.name || plant.id} — ${health}`);
          });
        }
      } catch (e: any) {
        console.log(`  ❌ Error: ${e.message}`);
      }
      console.log('');
    });

  // AI Council deliberation
  cannaai
    .command('council <question>')
    .description('Ask the AI Council for grow advice')
    .option('-m, --mode <mode>', 'Deliberation mode', 'deliberation')
    .option('-c, --councilors <ids>', 'Comma-separated councilor IDs', 'cultivator,trichome-inspector,nutrient-manager,ipm-specialist')
    .action(async (question: string, options: any) => {
      console.log(`\n🏛️ AI Council: "${question}"`);
      console.log(`   Mode: ${options.mode}\n`);
      try {
        const result = await councilFetch('/api/council/deliberate', {
          prompt: question,
          mode: options.mode,
          councilors: options.councilors.split(','),
        });
        console.log('🏛️  Council Verdict:\n');
        const text = result.response || result.result || result.summary || JSON.stringify(result).substring(0, 1000);
        console.log('  ' + text.substring(0, 1000));
        if (text.length > 1000) console.log('  ... (truncated)');
      } catch (e: any) {
        console.log(`  ❌ Council error: ${e.message}`);
        console.log('  💡 Make sure AI Council is running on ' + AI_COUNCIL_URL);
      }
      console.log('');
    });

  // Schedule
  cannaai
    .command('schedule')
    .description('Show nutrient and water schedules')
    .action(async () => {
      console.log('\n📅 Grow Schedule\n');
      try {
        const data = await apiFetch('/api/schedule');
        console.log('  ' + JSON.stringify(data, null, 2).substring(0, 500));
      } catch (e: any) {
        console.log(`  ❌ Error: ${e.message}`);
      }
      console.log('');
    });

  return cannaai;
}
