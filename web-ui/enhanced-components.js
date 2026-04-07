/**
 * 🎨 Enhanced Web UI Components for Duck CLI
 * Adds critical missing features:
 * - Security/DEFCON Panel
 * - MemPalace Visualization
 * - Sub-Conscious Panel
 * - Agent Mesh Network
 * - Provider Status
 * - Session Management
 * - Interactive Tool Execution
 */

// Security/DEFCON Panel Component
const SecurityPanel = () => {
  const [defconLevel, setDefconLevel] = React.useState(5);
  const [autoEscalation, setAutoEscalation] = React.useState(true);
  const [threats, setThreats] = React.useState([]);
  const [scanStatus, setScanStatus] = React.useState('idle');

  const defconLevels = [
    { level: 1, color: '#ff0000', name: 'CRITICAL', icon: '🔴', desc: 'Maximum alert - immediate action required' },
    { level: 2, color: '#ff4400', name: 'HIGH', icon: '🔴', desc: 'Elevated security - active threat' },
    { level: 3, color: '#ff8800', name: 'ELEVATED', icon: '🟠', desc: 'Increased readiness - potential threat' },
    { level: 4, color: '#ffcc00', name: 'NORMAL', icon: '🟡', desc: 'Standard security posture' },
    { level: 5, color: '#00ff00', name: 'LOW', icon: '🟢', desc: 'All clear - normal operations' }
  ];

  const runSecurityScan = async () => {
    setScanStatus('scanning');
    try {
      const response = await fetch('/api/security/audit');
      const data = await response.json();
      setThreats(data.findings || []);
      if (data.riskLevel === 'critical') setDefconLevel(1);
      else if (data.riskLevel === 'high') setDefconLevel(2);
      else if (data.riskLevel === 'medium') setDefconLevel(3);
    } catch (e) {
      console.error('Scan failed:', e);
    }
    setScanStatus('idle');
  };

  return React.createElement('div', { className: 'security-panel' },
    React.createElement('h2', null, '🛡️ Security & DEFCON'),
    
    // DEFCON Level Display
    React.createElement('div', { 
      className: 'defcon-display',
      style: { 
        background: `linear-gradient(135deg, ${defconLevels[defconLevel-1].color}22, ${defconLevels[defconLevel-1].color}11)`,
        border: `2px solid ${defconLevels[defconLevel-1].color}`,
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px'
      }
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '15px' } },
        React.createElement('span', { style: { fontSize: '48px' } }, defconLevels[defconLevel-1].icon),
        React.createElement('div', null,
          React.createElement('h3', { style: { margin: 0, color: defconLevels[defconLevel-1].color } },
            `DEFCON ${defconLevel} - ${defconLevels[defconLevel-1].name}`
          ),
          React.createElement('p', { style: { margin: '5px 0', opacity: 0.8 } },
            defconLevels[defconLevel-1].desc
          )
        )
      ),
      
      // DEFCON Level Controls
      React.createElement('div', { style: { display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' } },
        defconLevels.map(l => React.createElement('button', {
          key: l.level,
          onClick: () => setDefconLevel(l.level),
          style: {
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: defconLevel === l.level ? l.color : '#333',
            color: 'white',
            cursor: 'pointer',
            fontWeight: defconLevel === l.level ? 'bold' : 'normal'
          }
        }, `${l.icon} ${l.level}`))
      )
    ),
    
    // Auto-escalation Toggle
    React.createElement('div', { style: { marginBottom: '20px' } },
      React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' } },
        React.createElement('input', {
          type: 'checkbox',
          checked: autoEscalation,
          onChange: (e) => setAutoEscalation(e.target.checked)
        }),
        React.createElement('span', null, 'Auto-escalate on threat detection')
      )
    ),
    
    // Security Actions
    React.createElement('div', { style: { display: 'flex', gap: '10px', marginBottom: '20px' } },
      React.createElement('button', {
        onClick: runSecurityScan,
        disabled: scanStatus === 'scanning',
        style: {
          padding: '12px 24px',
          background: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: scanStatus === 'scanning' ? 'not-allowed' : 'pointer'
        }
      }, scanStatus === 'scanning' ? '🔍 Scanning...' : '🔍 Run Security Audit'),
      
      React.createElement('button', {
        onClick: () => window.location.href = '/api/security/report',
        style: {
          padding: '12px 24px',
          background: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer'
        }
      }, '📊 View Full Report')
    ),
    
    // Threat List
    threats.length > 0 && React.createElement('div', { className: 'threat-list' },
      React.createElement('h4', null, `⚠️ ${threats.length} Threat(s) Detected`),
      threats.map((threat, i) => React.createElement('div', {
        key: i,
        style: {
          padding: '12px',
          marginBottom: '10px',
          background: threat.severity === 'critical' ? '#ff000022' : 
                     threat.severity === 'high' ? '#ff440022' : '#ff880022',
          borderLeft: `4px solid ${threat.severity === 'critical' ? '#ff0000' : 
                                  threat.severity === 'high' ? '#ff4400' : '#ff8800'}`,
          borderRadius: '4px'
        }
      },
        React.createElement('strong', null, `[${threat.severity.toUpperCase()}] ${threat.title}`),
        React.createElement('p', { style: { margin: '5px 0', fontSize: '14px' } }, threat.description),
        threat.remediation && React.createElement('small', { style: { color: '#4CAF50' } },
          `💡 Fix: ${threat.remediation}`
        )
      ))
    )
  );
};

// MemPalace Visualization Component
const MemPalacePanel = () => {
  const [wings, setWings] = React.useState([]);
  const [selectedWing, setSelectedWing] = React.useState(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState([]);

  React.useEffect(() => {
    fetch('/api/mempalace/wings')
      .then(r => r.json())
      .then(setWings);
  }, []);

  const searchMemories = async () => {
    if (!searchQuery) return;
    const response = await fetch(`/api/mempalace/search?q=${encodeURIComponent(searchQuery)}`);
    const data = await response.json();
    setSearchResults(data.results || []);
  };

  return React.createElement('div', { className: 'mempalace-panel' },
    React.createElement('h2', null, '🏛️ MemPalace'),
    React.createElement('p', { style: { opacity: 0.7, fontSize: '14px' } }, 
      '96.6% accuracy • 30x AAAK compression • Agent diaries'
    ),
    
    // Search
    React.createElement('div', { style: { display: 'flex', gap: '10px', marginBottom: '20px' } },
      React.createElement('input', {
        type: 'text',
        placeholder: 'Search memories across palace...',
        value: searchQuery,
        onChange: (e) => setSearchQuery(e.target.value),
        onKeyPress: (e) => e.key === 'Enter' && searchMemories(),
        style: {
          flex: 1,
          padding: '12px',
          borderRadius: '6px',
          border: '1px solid #444',
          background: '#1a1a2e',
          color: 'white'
        }
      }),
      React.createElement('button', {
        onClick: searchMemories,
        style: {
          padding: '12px 24px',
          background: '#9C27B0',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer'
        }
      }, '🔍 Search')
    ),
    
    // Search Results
    searchResults.length > 0 && React.createElement('div', { 
      style: { 
        marginBottom: '20px',
        padding: '15px',
        background: '#1a1a2e',
        borderRadius: '8px'
      }
    },
      React.createElement('h4', null, `📋 ${searchResults.length} Results`),
      searchResults.map((result, i) => React.createElement('div', {
        key: i,
        style: {
          padding: '10px',
          marginBottom: '8px',
          background: '#0f3460',
          borderRadius: '4px',
          fontSize: '14px'
        }
      },
        React.createElement('div', null, result.content.substring(0, 200) + '...'),
        React.createElement('small', { style: { opacity: 0.6 } },
          `Importance: ${(result.importance * 100).toFixed(0)}% • Accessed: ${result.accessCount} times`
        )
      ))
    ),
    
    // Wings (Palace Structure)
    React.createElement('div', { className: 'wings-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' } },
      wings.map(wing => React.createElement('div', {
        key: wing.id,
        onClick: () => setSelectedWing(wing),
        style: {
          padding: '15px',
          background: selectedWing?.id === wing.id ? '#0f3460' : '#1a1a2e',
          borderRadius: '8px',
          cursor: 'pointer',
          border: '1px solid #333',
          transition: 'all 0.2s'
        }
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' } },
          React.createElement('span', { style: { fontSize: '24px' } },
            wing.type === 'agent' ? '🤖' : 
            wing.type === 'project' ? '📁' : 
            wing.type === 'person' ? '👤' : '📚'
          ),
          React.createElement('strong', null, wing.name)
        ),
        React.createElement('div', { style: { fontSize: '12px', opacity: 0.7 } },
          `${wing.halls?.length || 0} halls • ${wing.type}`
        ),
        React.createElement('div', { style: { fontSize: '11px', opacity: 0.5, marginTop: '5px' } },
          `Updated: ${new Date(wing.updatedAt).toLocaleDateString()}`
        )
      ))
    ),
    
    // Selected Wing Detail
    selectedWing && React.createElement('div', { 
      style: { 
        marginTop: '20px',
        padding: '20px',
        background: '#0f3460',
        borderRadius: '8px'
      }
    },
      React.createElement('h3', null, `🏛️ ${selectedWing.name}`),
      React.createElement('div', { style: { display: 'flex', gap: '15px', flexWrap: 'wrap' } },
        selectedWing.halls?.map(hall => React.createElement('div', {
          key: hall.id,
          style: {
            padding: '15px',
            background: '#1a1a2e',
            borderRadius: '6px',
            minWidth: '150px'
          }
        },
          React.createElement('strong', null, hall.name),
          React.createElement('div', { style: { fontSize: '12px', opacity: 0.7, marginTop: '5px' } },
            `${hall.rooms?.length || 0} rooms`
          )
        ))
      )
    )
  );
};

// Sub-Conscious Panel Component
const SubConsciousPanel = () => {
  const [whispers, setWhispers] = React.useState([]);
  const [stats, setStats] = React.useState({ total: 0, bySource: {} });
  const [isEnabled, setIsEnabled] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/subconscious/whispers')
      .then(r => r.json())
      .then(data => setWhispers(data.whispers || []));
    
    fetch('/api/subconscious/stats')
      .then(r => r.json())
      .then(setStats);
  }, []);

  return React.createElement('div', { className: 'subconscious-panel' },
    React.createElement('h2', null, '🧠 Sub-Conscious'),
    
    // Status
    React.createElement('div', { style: { 
      display: 'flex', 
      alignItems: 'center', 
      gap: '15px',
      marginBottom: '20px',
      padding: '15px',
      background: isEnabled ? '#4CAF5022' : '#f4433622',
      borderRadius: '8px'
    } },
      React.createElement('span', { style: { fontSize: '32px' } }, isEnabled ? '✨' : '💤'),
      React.createElement('div', null,
        React.createElement('strong', null, isEnabled ? 'Active' : 'Paused'),
        React.createElement('div', { style: { fontSize: '12px', opacity: 0.7 } },
          `${stats.total} whispers • Pattern matching enabled`
        )
      ),
      React.createElement('button', {
        onClick: () => setIsEnabled(!isEnabled),
        style: {
          marginLeft: 'auto',
          padding: '8px 16px',
          background: isEnabled ? '#f44336' : '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer'
        }
      }, isEnabled ? 'Pause' : 'Resume')
    ),
    
    // Whispers
    React.createElement('div', { className: 'whispers-list' },
      whispers.slice(0, 10).map((whisper, i) => React.createElement('div', {
        key: i,
        style: {
          padding: '12px',
          marginBottom: '10px',
          background: '#1a1a2e',
          borderRadius: '6px',
          borderLeft: `3px solid ${whisper.confidence > 0.8 ? '#4CAF50' : whisper.confidence > 0.5 ? '#FFC107' : '#f44336'}`
        }
      },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '5px' } },
          React.createElement('span', { style: { fontSize: '12px', opacity: 0.7 } },
            `${whisper.source} • ${new Date(whisper.timestamp).toLocaleTimeString()}`
          ),
          React.createElement('span', { style: { 
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '10px',
            background: whisper.confidence > 0.8 ? '#4CAF50' : whisper.confidence > 0.5 ? '#FFC107' : '#f44336'
          } },
            `${(whisper.confidence * 100).toFixed(0)}%`
          )
        ),
        React.createElement('div', null, whisper.message)
      ))
    )
  );
};

// Agent Mesh Panel Component
const AgentMeshPanel = () => {
  const [agents, setAgents] = React.useState([]);
  const [meshStatus, setMeshStatus] = React.useState({ connected: false, peers: 0 });

  React.useEffect(() => {
    fetch('/api/mesh/agents')
      .then(r => r.json())
      .then(data => setAgents(data.agents || []));
    
    fetch('/api/mesh/status')
      .then(r => r.json())
      .then(setMeshStatus);
  }, []);

  return React.createElement('div', { className: 'mesh-panel' },
    React.createElement('h2', null, '🕸️ Agent Mesh'),
    
    // Mesh Status
    React.createElement('div', { style: { 
      display: 'flex', 
      gap: '20px',
      marginBottom: '20px'
    } },
      React.createElement('div', { style: {
        flex: 1,
        padding: '15px',
        background: meshStatus.connected ? '#4CAF5022' : '#f4433622',
        borderRadius: '8px',
        textAlign: 'center'
      } },
        React.createElement('div', { style: { fontSize: '32px' } }, meshStatus.connected ? '🟢' : '🔴'),
        React.createElement('div', null, meshStatus.connected ? 'Connected' : 'Disconnected'),
        React.createElement('small', { style: { opacity: 0.7 } }, `${meshStatus.peers} peers`)
      ),
      
      React.createElement('div', { style: {
        flex: 1,
        padding: '15px',
        background: '#1a1a2e',
        borderRadius: '8px',
        textAlign: 'center'
      } },
        React.createElement('div', { style: { fontSize: '32px' } }, '🤖'),
        React.createElement('div', null, agents.length),
        React.createElement('small', { style: { opacity: 0.7 } }, 'active agents')
      )
    ),
    
    // Agent List
    React.createElement('div', { className: 'agents-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' } },
      agents.map(agent => React.createElement('div', {
        key: agent.id,
        style: {
          padding: '12px',
          background: agent.status === 'active' ? '#0f3460' : '#1a1a2e',
          borderRadius: '6px',
          border: agent.status === 'active' ? '1px solid #4CAF50' : '1px solid #333'
        }
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          React.createElement('span', null, agent.status === 'active' ? '🟢' : '⚪'),
          React.createElement('strong', null, agent.name)
        ),
        React.createElement('div', { style: { fontSize: '11px', opacity: 0.6, marginTop: '5px' } },
          `${agent.type} • ${agent.capabilities?.length || 0} capabilities`
        )
      ))
    )
  );
};

// Provider Status Panel
const ProviderPanel = () => {
  const [providers, setProviders] = React.useState([]);

  React.useEffect(() => {
    fetch('/api/providers')
      .then(r => r.json())
      .then(data => setProviders(data.providers || []));
  }, []);

  return React.createElement('div', { className: 'provider-panel' },
    React.createElement('h2', null, '📡 Providers'),
    
    React.createElement('div', { style: { display: 'grid', gap: '10px' } },
      providers.map(provider => React.createElement('div', {
        key: provider.name,
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px',
          background: provider.available ? '#0f3460' : '#1a1a2e',
          borderRadius: '6px',
          borderLeft: `4px solid ${provider.available ? '#4CAF50' : '#f44336'}`
        }
      },
        React.createElement('div', null,
          React.createElement('strong', null, provider.name),
          React.createElement('div', { style: { fontSize: '12px', opacity: 0.7 } },
            provider.model || 'No model set'
          )
        ),
        React.createElement('span', { style: { 
          padding: '4px 12px',
          borderRadius: '12px',
          background: provider.available ? '#4CAF50' : '#f44336',
          fontSize: '12px'
        } },
          provider.available ? '✅ Online' : '❌ Offline'
        )
      ))
    )
  );
};

// Session Management Panel
const SessionPanel = () => {
  const [sessions, setSessions] = React.useState([]);
  const [currentSession, setCurrentSession] = React.useState(null);

  React.useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then(data => setSessions(data.sessions || []));
    
    fetch('/api/session/current')
      .then(r => r.json())
      .then(setCurrentSession);
  }, []);

  return React.createElement('div', { className: 'session-panel' },
    React.createElement('h2', null, '💬 Sessions'),
    
    React.createElement('div', { style: { marginBottom: '15px' } },
      React.createElement('button', {
        onClick: () => fetch('/api/session/new', { method: 'POST' }).then(() => window.location.reload()),
        style: {
          padding: '10px 20px',
          background: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          marginRight: '10px'
        }
      }, '➕ New Session'),
      
      React.createElement('button', {
        onClick: () => fetch('/api/session/clear', { method: 'POST' }).then(() => window.location.reload()),
        style: {
          padding: '10px 20px',
          background: '#f44336',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer'
        }
      }, '🗑️ Clear History')
    ),
    
    React.createElement('div', { style: { maxHeight: '300px', overflow: 'auto' } },
      sessions.map(session => React.createElement('div', {
        key: session.id,
        onClick: () => fetch(`/api/session/switch/${session.id}`).then(() => window.location.reload()),
        style: {
          padding: '10px',
          marginBottom: '8px',
          background: currentSession?.id === session.id ? '#0f3460' : '#1a1a2e',
          borderRadius: '6px',
          cursor: 'pointer',
          border: currentSession?.id === session.id ? '1px solid #2196F3' : '1px solid transparent'
        }
      },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between' } },
          React.createElement('strong', null, session.name || `Session ${session.id.slice(0, 8)}`),
          React.createElement('span', { style: { fontSize: '12px', opacity: 0.6 } },
            `${session.messageCount} msgs`
          )
        ),
        React.createElement('div', { style: { fontSize: '11px', opacity: 0.5 } },
          new Date(session.lastActive).toLocaleString()
        )
      ))
    )
  );
};

// Export all components
window.EnhancedWebUI = {
  SecurityPanel,
  MemPalacePanel,
  SubConsciousPanel,
  AgentMeshPanel,
  ProviderPanel,
  SessionPanel
};
