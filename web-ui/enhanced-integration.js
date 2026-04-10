/**
 * Enhanced Web UI Integration Script
 * Adds Security, MemPalace, Sub-Conscious, Agent Mesh, Provider, and Session panels
 */

// Wait for the main app to load
document.addEventListener('DOMContentLoaded', () => {
  // Add new navigation items
  addNavSection('Security', [
    { id: 'security', icon: '🛡️', label: 'Security & DEFCON' },
    { id: 'mempalace', icon: '🏛️', label: 'MemPalace' },
  ]);
  
  addNavSection('Advanced', [
    { id: 'subconscious', icon: '🧠', label: 'Sub-Conscious' },
    { id: 'mesh', icon: '🕸️', label: 'Agent Mesh' },
    { id: 'providers', icon: '📡', label: 'Providers' },
    { id: 'sessions', icon: '💬', label: 'Sessions' },
  ]);
  
  // Add new panels
  addSecurityPanel();
  addMemPalacePanel();
  addSubConsciousPanel();
  addMeshPanel();
  addProvidersPanel();
  addSessionsPanel();
  
  // Initialize enhanced components
  initEnhancedComponents();
});

function addNavSection(title, items) {
  const sidebar = document.querySelector('.sidebar');
  const nav = document.createElement('nav');
  nav.className = 'nav-section';
  nav.innerHTML = `
    <div class="nav-section-title">${title}</div>
    ${items.map(item => `
      <a class="nav-link" data-panel="${item.id}">
        <span class="icon">${item.icon}</span>
        <span>${item.label}</span>
      </a>
    `).join('')}
  `;
  sidebar.insertBefore(nav, sidebar.querySelector('.nav-section:last-child'));
}

function addSecurityPanel() {
  const main = document.querySelector('.main');
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.id = 'panel-security';
  panel.innerHTML = `
    <div class="panel-title">
      🛡️ Security & DEFCON
      <span class="panel-subtitle">Defense readiness system</span>
    </div>
    
    <div class="card" style="background: linear-gradient(135deg, #ff000022, #ff440022); border: 2px solid #ff4400;">
      <div style="display: flex; align-items: center; gap: 20px; padding: 20px;">
        <span style="font-size: 64px;">🟠</span>
        <div>
          <h2 style="margin: 0; color: #ff8800;">DEFCON 3 - ELEVATED</h2>
          <p style="margin: 5px 0; opacity: 0.8;">Increased readiness - potential threat detected</p>
          <small>Last changed: 2 minutes ago</small>
        </div>
      </div>
      
      <div style="display: flex; gap: 10px; padding: 0 20px 20px; flex-wrap: wrap;">
        <button class="btn" style="background: #ff0000;" onclick="setDefcon(1)">🔴 1</button>
        <button class="btn" style="background: #ff4400;" onclick="setDefcon(2)">🔴 2</button>
        <button class="btn" style="background: #ff8800;" onclick="setDefcon(3)">🟠 3</button>
        <button class="btn" style="background: #ffcc00; color: #000;" onclick="setDefcon(4)">🟡 4</button>
        <button class="btn" style="background: #00ff00; color: #000;" onclick="setDefcon(5)">🟢 5</button>
      </div>
    </div>
    
    <div class="grid-2" style="margin-top: 20px;">
      <div class="card">
        <div class="card-title">Security Actions</div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px;">
          <button class="btn btn-primary" onclick="runSecurityScan()">🔍 Scan</button>
          <button class="btn btn-secondary" onclick="runSecurityAudit()">📊 Audit</button>
          <button class="btn btn-secondary" onclick="viewThreats()">⚠️ Threats</button>
          <button class="btn btn-secondary" onclick="viewLogs()">📋 Logs</button>
        </div>
      </div>
      
      <div class="card">
        <div class="card-title">Auto-Escalation</div>
        <label style="display: flex; align-items: center; gap: 10px; margin-top: 12px; cursor: pointer;">
          <input type="checkbox" id="auto-escalate" checked onchange="toggleAutoEscalate()">
          <span>Automatically escalate on threat detection</span>
        </label>
      </div>
    </div>
    
    <div class="card" style="margin-top: 20px;">
      <div class="card-title">Recent Security Events</div>
      <div id="security-events" style="margin-top: 12px;">
        <div style="padding: 10px; background: #ff880022; border-left: 3px solid #ff8800; margin-bottom: 8px; border-radius: 4px;">
          <strong>⚠️ ELEVATED</strong> - Test elevation<br>
          <small>2 minutes ago</small>
        </div>
      </div>
    </div>
  `;
  main.appendChild(panel);
}

function addMemPalacePanel() {
  const main = document.querySelector('.main');
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.id = 'panel-mempalace';
  panel.innerHTML = `
    <div class="panel-title">
      🏛️ MemPalace
      <span class="panel-subtitle">96.6% accuracy • 30x AAAK compression</span>
    </div>
    
    <div class="card">
      <div style="display: flex; gap: 10px;">
        <input type="text" class="form-input" id="palace-search" placeholder="Search memories across palace..." style="flex: 1;">
        <button class="btn btn-primary" onclick="searchPalace()">🔍 Search</button>
        <button class="btn btn-secondary" onclick="createWing()">➕ New Wing</button>
      </div>
    </div>
    
    <div class="grid-3" style="margin-top: 20px;">
      <div class="stat-card">
        <div class="stat-value">12</div>
        <div class="stat-label">Wings</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">847</div>
        <div class="stat-label">Memories</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">30x</div>
        <div class="stat-label">Compression</div>
      </div>
    </div>
    
    <div class="card" style="margin-top: 20px;">
      <div class="card-title">🏛️ Palace Structure</div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 12px;">
        <div style="padding: 15px; background: #0f3460; border-radius: 8px; cursor: pointer;" onclick="openWing('projects')">
          <div style="font-size: 32px; margin-bottom: 8px;">📁</div>
          <strong>Projects</strong>
          <div style="font-size: 12px; opacity: 0.7; margin-top: 5px;">5 halls • 234 memories</div>
        </div>
        <div style="padding: 15px; background: #0f3460; border-radius: 8px; cursor: pointer;" onclick="openWing('people')">
          <div style="font-size: 32px; margin-bottom: 8px;">👤</div>
          <strong>People</strong>
          <div style="font-size: 12px; opacity: 0.7; margin-top: 5px;">3 halls • 89 memories</div>
        </div>
        <div style="padding: 15px; background: #0f3460; border-radius: 8px; cursor: pointer;" onclick="openWing('agents')">
          <div style="font-size: 32px; margin-bottom: 8px;">🤖</div>
          <strong>Agent Diaries</strong>
          <div style="font-size: 12px; opacity: 0.7; margin-top: 5px;">4 halls • 524 memories</div>
        </div>
      </div>
    </div>
  `;
  main.appendChild(panel);
}

function addSubConsciousPanel() {
  const main = document.querySelector('.main');
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.id = 'panel-subconscious';
  panel.innerHTML = `
    <div class="panel-title">
      🧠 Sub-Conscious
      <span class="panel-subtitle">Self-reflection system</span>
    </div>
    
    <div class="card" style="background: #4CAF5022;">
      <div style="display: flex; align-items: center; gap: 15px;">
        <span style="font-size: 48px;">✨</span>
        <div>
          <strong>Active</strong>
          <div style="font-size: 13px; opacity: 0.8;">127 whispers • Pattern matching enabled</div>
        </div>
        <label class="toggle" style="margin-left: auto;">
          <input type="checkbox" checked onchange="toggleSubConscious()">
          <div class="toggle-track"><div class="toggle-thumb"></div></div>
        </label>
      </div>
    </div>
    
    <div class="card" style="margin-top: 20px;">
      <div class="card-title">Recent Whispers</div>
      <div id="whispers-list" style="margin-top: 12px;">
        <div style="padding: 12px; background: #1a1a2e; border-left: 3px solid #4CAF50; margin-bottom: 8px; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span style="font-size: 12px; opacity: 0.7;">pattern_match • 2 min ago</span>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #4CAF50;">87%</span>
          </div>
          User frequently asks about security - suggest proactive security tips
        </div>
        <div style="padding: 12px; background: #1a1a2e; border-left: 3px solid #FFC107; margin-bottom: 8px; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span style="font-size: 12px; opacity: 0.7;">session_analysis • 15 min ago</span>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #FFC107;">62%</span>
          </div>
          Conversation context suggests interest in memory systems
        </div>
      </div>
    </div>
  `;
  main.appendChild(panel);
}

function addMeshPanel() {
  const main = document.querySelector('.main');
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.id = 'panel-mesh';
  panel.innerHTML = `
    <div class="panel-title">
      🕸️ Agent Mesh
      <span class="panel-subtitle">Networked agent coordination</span>
    </div>
    
    <div class="grid-2" style="margin-bottom: 20px;">
      <div class="card" style="background: #4CAF5022; text-align: center;">
        <div style="font-size: 48px;">🟢</div>
        <div><strong>Connected</strong></div>
        <small>3 peers online</small>
      </div>
      <div class="card" style="text-align: center;">
        <div style="font-size: 48px;">🤖</div>
        <div><strong>5 Agents</strong></div>
        <small>2 active, 3 idle</small>
      </div>
    </div>
    
    <div class="card">
      <div class="card-title">Connected Agents</div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 12px;">
        <div style="padding: 12px; background: #0f3460; border-radius: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>🟢</span>
            <strong>Coder-1</strong>
          </div>
          <small style="opacity: 0.7;">implementation • 5 tools</small>
        </div>
        <div style="padding: 12px; background: #0f3460; border-radius: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>🟢</span>
            <strong>Reviewer-2</strong>
          </div>
          <small style="opacity: 0.7;">code_review • 3 tools</small>
        </div>
        <div style="padding: 12px; background: #1a1a2e; border-radius: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>⚪</span>
            <strong>Researcher-1</strong>
          </div>
          <small style="opacity: 0.7;">research • idle</small>
        </div>
      </div>
    </div>
  `;
  main.appendChild(panel);
}

function addProvidersPanel() {
  const main = document.querySelector('.main');
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.id = 'panel-providers';
  panel.innerHTML = `
    <div class="panel-title">
      📡 Providers
      <span class="panel-subtitle">AI model providers</span>
    </div>
    
    <div id="providers-list">
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: #0f3460; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #4CAF50;">
        <div>
          <strong>MiniMax</strong>
          <div style="font-size: 12px; opacity: 0.7;">MiniMax-M2.7 • 196K context</div>
        </div>
        <span style="padding: 4px 12px; border-radius: 12px; background: #4CAF50; font-size: 12px;">✅ Online</span>
      </div>
      
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: #0f3460; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #4CAF50;">
        <div>
          <strong>Kimi</strong>
          <div style="font-size: 12px; opacity: 0.7;">kimi-k2.5 • Vision + Coding</div>
        </div>
        <span style="padding: 4px 12px; border-radius: 12px; background: #4CAF50; font-size: 12px;">✅ Online</span>
      </div>
      
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: #1a1a2e; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #FFC107;">
        <div>
          <strong>OpenRouter</strong>
          <div style="font-size: 12px; opacity: 0.7;">qwen3.6-plus • Free tier</div>
        </div>
        <span style="padding: 4px 12px; border-radius: 12px; background: #FFC107; color: #000; font-size: 12px;">⏳ Standby</span>
      </div>
      
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: #1a1a2e; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #4CAF50;">
        <div>
          <strong>LM Studio</strong>
          <div style="font-size: 12px; opacity: 0.7;">gemma-4-e4b-it • Local</div>
        </div>
        <span style="padding: 4px 12px; border-radius: 12px; background: #4CAF50; font-size: 12px;">✅ Online</span>
      </div>
    </div>
  `;
  main.appendChild(panel);
}

function addSessionsPanel() {
  const main = document.querySelector('.main');
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.id = 'panel-sessions';
  panel.innerHTML = `
    <div class="panel-title">
      💬 Sessions
      <span class="panel-subtitle">Conversation history</span>
    </div>
    
    <div style="margin-bottom: 15px;">
      <button class="btn btn-primary" onclick="newSession()">➕ New Session</button>
      <button class="btn btn-secondary" onclick="clearAllSessions()">🗑️ Clear All</button>
    </div>
    
    <div id="sessions-list">
      <div style="padding: 15px; background: #0f3460; border-radius: 8px; margin-bottom: 10px; cursor: pointer; border: 1px solid #2196F3;" onclick="switchSession('current')">
        <div style="display: flex; justify-content: space-between;">
          <strong>Current Session</strong>
          <span style="font-size: 12px; opacity: 0.7;">24 messages</span>
        </div>
        <small style="opacity: 0.5;">Active now</small>
      </div>
      
      <div style="padding: 15px; background: #1a1a2e; border-radius: 8px; margin-bottom: 10px; cursor: pointer;" onclick="switchSession('prev1')">
        <div style="display: flex; justify-content: space-between;">
          <strong>Security Discussion</strong>
          <span style="font-size: 12px; opacity: 0.7;">156 messages</span>
        </div>
        <small style="opacity: 0.5;">2 hours ago</small>
      </div>
      
      <div style="padding: 15px; background: #1a1a2e; border-radius: 8px; margin-bottom: 10px; cursor: pointer;" onclick="switchSession('prev2')">
        <div style="display: flex; justify-content: space-between;">
          <strong>Web UI Enhancements</strong>
          <span style="font-size: 12px; opacity: 0.7;">89 messages</span>
        </div>
        <small style="opacity: 0.5;">Yesterday</small>
      </div>
    </div>
  `;
  main.appendChild(panel);
}

// Panel action functions
function setDefcon(level) {
  const colors = ['#ff0000', '#ff4400', '#ff8800', '#ffcc00', '#00ff00'];
  const names = ['CRITICAL', 'HIGH', 'ELEVATED', 'NORMAL', 'LOW'];
  const icons = ['🔴', '🔴', '🟠', '🟡', '🟢'];
  
  alert(`DEFCON set to ${level} - ${names[level-1]}`);
}

function runSecurityScan() {
  alert('🔍 Running security scan...');
}

function runSecurityAudit() {
  alert('📊 Running full security audit...');
}

function viewThreats() {
  alert('⚠️ Viewing threats...');
}

function toggleAutoEscalate() {
  const enabled = document.getElementById('auto-escalate')?.checked;
  alert(`Auto-escalation ${enabled ? 'enabled' : 'disabled'}`);
}

function searchPalace() {
  const query = document.getElementById('palace-search')?.value;
  alert(`🔍 Searching palace for: ${query}`);
}

function createWing() {
  const name = prompt('Enter wing name:');
  if (name) alert(`🏛️ Created wing: ${name}`);
}

function openWing(id) {
  alert(`🏛️ Opening wing: ${id}`);
}

function toggleSubConscious() {
  alert('🧠 Sub-Conscious toggled');
}

function newSession() {
  if (confirm('Start a new session?')) {
    alert('💬 New session started');
  }
}

function clearAllSessions() {
  if (confirm('Clear all session history?')) {
    alert('🗑️ All sessions cleared');
  }
}

function switchSession(id) {
  alert(`💬 Switched to session: ${id}`);
}

function initEnhancedComponents() {
  // Add click handlers for new nav links
  document.querySelectorAll('.nav-link[data-panel="security"], .nav-link[data-panel="mempalace"], .nav-link[data-panel="subconscious"], .nav-link[data-panel="mesh"], .nav-link[data-panel="providers"], .nav-link[data-panel="sessions"]').forEach(link => {
    link.addEventListener('click', () => {
      const panel = link.dataset.panel;
      
      // Update active nav
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      // Show panel
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`panel-${panel}`)?.classList.add('active');
      
      // Update title
      const titles = {
        security: '🛡️ Security & DEFCON',
        mempalace: '🏛️ MemPalace',
        subconscious: '🧠 Sub-Conscious',
        mesh: '🕸️ Agent Mesh',
        providers: '📡 Providers',
        sessions: '💬 Sessions'
      };
      document.getElementById('panel-title').innerHTML = titles[panel] || panel;
    });
  });
}

console.log('✅ Enhanced Web UI components loaded');
