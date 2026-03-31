/**
 * Duck Agent Desktop — Settings Panel
 *
 * Configuration for gateway, models, providers, channels, skills,
 * and DuckBot-specific settings.
 *
 * Design patterns from: ClawX settings + Open-WebUI Lobster Edition admin
 */

import React, { useState } from 'react';
import { DuckButton } from './components/duck-button';
import { DuckInput } from './components/duck-input';
import { DuckCard } from './components/duck-card';

// ─── Types ───────────────────────────────────────────────────────────────────

type SettingsTab = 'general' | 'models' | 'providers' | 'channels' | 'skills' | 'about';

interface Provider {
  id: string;
  name: string;
  enabled: boolean;
  apiKeyMasked: string;
  models: number;
  status: 'connected' | 'error' | 'pending';
}

interface SettingsPanelProps {
  addToast: (t: { type: string; message: string }) => void;
  gateway: { connected: boolean; url: string; latency: number };
  session: { active: boolean; agentCount: number; messageCount: number };
  setSession: React.Dispatch<React.SetStateAction<{ active: boolean; agentCount: number; messageCount: number }>>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'models', label: 'Models', icon: '🤖' },
  { id: 'providers', label: 'Providers', icon: '🔌' },
  { id: 'channels', label: 'Channels', icon: '📡' },
  { id: 'skills', label: 'Skills', icon: '🛠' },
  { id: 'about', label: 'About', icon: 'ℹ️' },
];

const PROVIDERS: Provider[] = [
  { id: 'minimax', name: 'MiniMax', enabled: true, apiKeyMasked: 'sk-cp-f6P...••••', models: 4, status: 'connected' },
  { id: 'kimi', name: 'Kimi (Moonshot)', enabled: true, apiKeyMasked: 'mo-••••••••', models: 2, status: 'connected' },
  { id: 'openai', name: 'OpenAI (OAuth)', enabled: true, apiKeyMasked: 'OAuth', models: 2, status: 'connected' },
  { id: 'lmstudio', name: 'LM Studio (Local)', enabled: true, apiKeyMasked: 'http://100.116.54.125:1234', models: 16, status: 'connected' },
];

// ─── Component ───────────────────────────────────────────────────────────────

const SettingsPanel: React.FC<SettingsPanelProps> = ({ addToast, gateway }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [providers, setProviders] = useState<Provider[]>(PROVIDERS);
  const [gatewayUrl, setGatewayUrl] = useState('ws://localhost:18789');
  const [gatewayKey, setGatewayKey] = useState('');

  // General settings state
  const [settings, setSettings] = useState({
    darkMode: true,
    launchAtStartup: false,
    notifications: true,
    soundEnabled: false,
    speechRate: 1.0,
    defaultModel: 'minimax/MiniMax-M2.7',
    thinkingEnabled: true,
  });

  const toggleProvider = (id: string) => {
    setProviders(prev => prev.map(p =>
      p.id === id ? { ...p, enabled: !p.enabled } : p
    ));
    addToast({ type: 'info', message: 'Provider updated' });
  };

  const handleSaveGateway = () => {
    addToast({ type: 'success', message: '🦆 Gateway settings saved' });
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="duck-settings flex flex-col h-full p-4 space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#1c2333] border border-[#30363d] flex items-center justify-center text-2xl">
          ⚙️
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#e6edf3]" style={{ fontFamily: 'var(--font-display)' }}>
            Settings
          </h2>
          <p className="text-xs text-[#8b949e]">
            Configure DuckBot · Gateway {gateway.connected ? '🟢' : '🔴'}
          </p>
        </div>
      </div>

      {/* ── Tab Bar ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0
              ${activeTab === tab.id
                ? 'bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/30'
                : 'text-[#8b949e] hover:bg-[#1c2333] hover:text-[#e6edf3] border border-transparent'}
            `}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:block">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-4">

        {/* General */}
        {activeTab === 'general' && (
          <>
            {/* Gateway Config */}
            <DuckCard>
              <h3 className="text-sm font-semibold text-[#e6edf3] mb-3 flex items-center gap-2">
                🦆 OpenClaw Gateway
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#8b949e] mb-1 block">Gateway URL</label>
                  <DuckInput
                    value={gatewayUrl}
                    onChange={e => setGatewayUrl(e.target.value)}
                    placeholder="ws://localhost:18789"
                    className="w-full font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#8b949e] mb-1 block">API Key (optional)</label>
                  <DuckInput
                    value={gatewayKey}
                    onChange={e => setGatewayKey(e.target.value)}
                    placeholder="Leave blank if no auth required"
                    type="password"
                    className="w-full font-mono text-sm"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${gateway.connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <span className="text-xs text-[#8b949e]">
                      {gateway.connected ? `Connected · ${gateway.latency}ms` : 'Disconnected'}
                    </span>
                  </div>
                  <DuckButton variant="primary" size="sm" onClick={handleSaveGateway}>
                    Save
                  </DuckButton>
                </div>
              </div>
            </DuckCard>

            {/* Behavior */}
            <DuckCard>
              <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">Behavior</h3>
              <div className="space-y-3">
                {[
                  { key: 'thinkingEnabled', label: 'Show thinking/reasoning', desc: 'Display model reasoning before response' },
                  { key: 'notifications', label: 'Desktop notifications', desc: 'Toast notifications for events' },
                  { key: 'soundEnabled', label: 'Sound effects', desc: 'Play sounds for messages and alerts' },
                  { key: 'launchAtStartup', label: 'Launch at startup', desc: 'Start DuckBot when you log in' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-[#e6edf3]">{item.label}</div>
                      <div className="text-[10px] text-[#484f58]">{item.desc}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings[item.key as keyof typeof settings] as boolean}
                        onChange={e => setSettings(prev => ({ ...prev, [item.key]: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[#21262d] peer-focus:outline-none rounded-full
                                      peer-checked:bg-[#fbbf24] transition-colors
                                      peer-checked:after:translate-x-full
                                      after:content-[''] after:absolute after:top-[2px]
                                      after:left-[2px] after:bg-white after:rounded-full
                                      after:h-4 after:w-4 after:transition-all">
                      </div>
                    </label>
                  </div>
                ))}

                {/* Speech Rate */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm text-[#e6edf3]">Speech Rate</div>
                    <span className="text-xs font-mono text-[#fbbf24]">{settings.speechRate}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={settings.speechRate}
                    onChange={e => setSettings(prev => ({ ...prev, speechRate: parseFloat(e.target.value) }))}
                    className="w-full accent-[#fbbf24]"
                  />
                </div>
              </div>
            </DuckCard>
          </>
        )}

        {/* Models */}
        {activeTab === 'models' && (
          <DuckCard>
            <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">Active Models</h3>
            <div className="space-y-2">
              {[
                { id: 'minimax/MiniMax-M2.7', name: 'MiniMax M2.7', provider: 'MiniMax', context: '196K' },
                { id: 'minimax/glm-5', name: 'GLM-5', provider: 'MiniMax', context: '128K' },
                { id: 'kimi/kimi-k2.5', name: 'Kimi K2.5', provider: 'Kimi', context: '256K' },
                { id: 'openai-codex/gpt-5.4', name: 'GPT-5.4', provider: 'OpenAI', context: 'Large' },
                { id: 'lmstudio/qwen3-vl-8b', name: 'Qwen3 VL 8B', provider: 'LM Studio', context: 'Local' },
              ].map(model => (
                <div key={model.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#21262d] transition-colors">
                  <div className="w-8 h-8 rounded bg-[#1c2333] border border-[#30363d] flex items-center justify-center text-sm">
                    🤖
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#e6edf3] truncate">{model.name}</div>
                    <div className="text-[10px] text-[#484f58]">{model.provider} · Context {model.context}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    settings.defaultModel === model.id
                      ? 'bg-[#fbbf24]/10 text-[#fbbf24]'
                      : 'bg-[#21262d] text-[#484f58]'
                  }`}>
                    {settings.defaultModel === model.id ? 'Default ✓' : 'Set Default'}
                  </span>
                </div>
              ))}
            </div>
          </DuckCard>
        )}

        {/* Providers */}
        {activeTab === 'providers' && (
          <div className="space-y-2">
            {providers.map(provider => (
              <DuckCard key={provider.id} className={!provider.enabled ? 'opacity-50' : ''}>
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    provider.status === 'connected' ? 'bg-emerald-400' :
                    provider.status === 'error' ? 'bg-red-400' : 'bg-amber-400'
                  }`} />

                  <div className="flex-1">
                    <div className="text-sm font-semibold text-[#e6edf3]">{provider.name}</div>
                    <div className="text-[10px] font-mono text-[#484f58]">{provider.apiKeyMasked}</div>
                  </div>

                  <div className="text-xs text-[#8b949e]">
                    {provider.models} models
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={provider.enabled}
                      onChange={() => toggleProvider(provider.id)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#21262d] peer-focus:outline-none rounded-full
                                    peer-checked:bg-[#fbbf24] transition-colors
                                    peer-checked:after:translate-x-full
                                    after:content-[''] after:absolute after:top-[2px]
                                    after:left-[2px] after:bg-white after:rounded-full
                                    after:h-4 after:w-4 after:transition-all">
                    </div>
                  </label>
                </div>
              </DuckCard>
            ))}
          </div>
        )}

        {/* Channels */}
        {activeTab === 'channels' && (
          <DuckCard>
            <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">Communication Channels</h3>
            <div className="space-y-2">
              {[
                { name: 'Telegram', icon: '📱', status: true, account: '@DucketsMcquackin' },
                { name: 'Discord', icon: '💬', status: false, account: 'Not configured' },
                { name: 'WhatsApp', icon: '💬', status: false, account: 'Not configured' },
                { name: 'iMessage', icon: '💬', status: false, account: 'Not configured' },
              ].map(ch => (
                <div key={ch.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#21262d] transition-colors">
                  <span className="text-xl">{ch.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm text-[#e6edf3]">{ch.name}</div>
                    <div className="text-[10px] text-[#484f58]">{ch.account}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    ch.status ? 'bg-emerald-400/10 text-emerald-400' : 'bg-[#21262d] text-[#484f58]'
                  }`}>
                    {ch.status ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          </DuckCard>
        )}

        {/* Skills */}
        {activeTab === 'skills' && (
          <DuckCard>
            <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">Installed Skills</h3>
            <div className="space-y-2">
              {[
                { name: 'DuckDB CLI', icon: '🦆', enabled: true, desc: 'Local DuckDB analytics' },
                { name: 'MiniMax Speech', icon: '🎤', enabled: true, desc: 'TTS & voice generation' },
                { name: 'MiniMax Image', icon: '🖼', enabled: true, desc: 'Image generation' },
                { name: 'Weather NWS', icon: '🌤️', enabled: true, desc: 'National Weather Service' },
                { name: 'BrowserOS', icon: '🌐', enabled: false, desc: 'Browser automation' },
                { name: 'Android Engineer', icon: '📱', enabled: true, desc: 'ADB device control' },
              ].map(skill => (
                <div key={skill.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#21262d] transition-colors">
                  <span className="text-xl">{skill.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm text-[#e6edf3]">{skill.name}</div>
                    <div className="text-[10px] text-[#484f58]">{skill.desc}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={skill.enabled} className="sr-only peer"
                      onChange={() => addToast({ type: 'info', message: `Skill toggled: ${skill.name}` })} />
                    <div className="w-9 h-5 bg-[#21262d] peer-focus:outline-none rounded-full
                                    peer-checked:bg-[#fbbf24] transition-colors
                                    peer-checked:after:translate-x-full
                                    after:content-[''] after:absolute after:top-[2px]
                                    after:left-[2px] after:bg-white after:rounded-full
                                    after:h-4 after:w-4 after:transition-all">
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </DuckCard>
        )}

        {/* About */}
        {activeTab === 'about' && (
          <div className="text-center space-y-4 py-8">
            <div className="text-6xl">🦆</div>
            <div>
              <h2 className="text-2xl font-bold text-[#fbbf24]" style={{ fontFamily: 'var(--font-display)' }}>
                DuckBot Desktop
              </h2>
              <p className="text-[#8b949e] text-sm mt-1">Version 1.0.0 · March 2026</p>
            </div>
            <DuckCard className="text-left max-w-md mx-auto">
              <div className="space-y-2 text-xs text-[#8b949e] font-mono">
                <div>Runtime: {typeof window !== 'undefined' ? navigator.userAgent.split(' ')[0] : 'Server'}</div>
                <div>Gateway: {gateway.url}</div>
                <div>Status: {gateway.connected ? 'Connected' : 'Disconnected'}</div>
                <div>Latency: {gateway.latency}ms</div>
                <div>Theme: Dark (Duck Edition)</div>
              </div>
            </DuckCard>
            <p className="text-[10px] text-[#484f58]">
              Built with 💛 · Powered by OpenClaw · Built on ClawX + Lobster Edition design
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPanel;
