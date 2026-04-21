#!/usr/bin/env node
/**
 * Agent Hub Tool - Unified access to all agent systems
 */

const http = require('http');
const { execSync } = require('child_process');

const MESH_KEY = process.env.AGENT_MESH_API_KEY || 'openclaw-mesh-default-key';

async function httpGet(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function main() {
    const cmd = process.argv[2] || 'help';
    
    switch(cmd) {
        case 'status':
            console.log('🔍 Agent System Status\n');
            
            // Duck CLI
            try {
                const version = execSync('~/.gitnexus/repos/duck-cli/duck --version 2>/dev/null', {encoding: 'utf8'}).trim();
                console.log('✅ Duck CLI:', version);
            } catch { console.log('❌ Duck CLI: not found'); }
            
            // Agent Teams
            try {
                const status = JSON.parse(await httpGet('http://localhost:3131/api/status'));
                console.log('✅ Agent Teams: running');
            } catch { console.log('❌ Agent Teams: not running'); }
            
            // AI Council
            try {
                const status = JSON.parse(await httpGet('http://localhost:3003/'));
                console.log('✅ AI Council:', status.version || 'running');
            } catch { console.log('❌ AI Council: not running'); }
            
            // Agent Mesh
            try {
                const status = JSON.parse(await httpGet(`http://localhost:4000/api/mesh/status`));
                console.log('✅ Agent Mesh:', status.agents?.length || 0, 'agents');
            } catch { console.log('❌ Agent Mesh: not running'); }
            break;
            
        case 'council':
            const councilors = JSON.parse(await httpGet('http://localhost:3003/api/councilors'));
            console.log(`🏛️ AI Council: ${councilors.councilors?.length || councilors.length} councilors`);
            break;
            
        case 'mesh':
            const mesh = JSON.parse(await httpGet(`http://localhost:4000/api/agents`));
            console.log(`🌐 Agent Mesh: ${mesh.agents?.length || 0} registered agents`);
            break;
            
        case 'help':
        default:
            console.log(`
🤖 Agent Hub - Unified Multi-Agent CLI

Usage: agent-hub <command>

Commands:
  status    - Check all agent systems
  council   - AI Council info
  mesh      - Agent Mesh info
  help      - Show this help
`);
    }
}

main().catch(console.error);
