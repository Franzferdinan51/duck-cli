/**
 * Duck Agent Desktop — KAIROS Control Panel
 *
 * Time-series task scheduling, cron management, and autonomous
 * task orchestration visualization.
 */

import React, { useState, useCallback } from 'react';
import { DuckButton } from '../components/duck-button';
import { DuckInput } from '../components/duck-input';
import { DuckCard } from '../components/duck-card';
import { StatusIndicator } from '../components/status-indicator';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScheduledTask {
  id: string;
  name: string;
  schedule: string;
  scheduleLabel: string;
  lastRun: Date | null;
  nextRun: Date | null;
  status: 'active' | 'paused' | 'error' | 'running';
  taskType: 'heartbeat' | 'cron' | 'monitor' | 'autonomous' | 'DEFCON';
  lastResult?: 'success' | 'error' | 'warning';
  log?: string;
}

interface KairosPanelProps {
  addToast: (t: { type: string; message: string }) => void;
  gateway: { connected: boolean; url: string; latency: number };
  session: { active: boolean; agentCount: number; messageCount: number };
  setSession: React.Dispatch<React.SetStateAction<{ active: boolean; agentCount: number; messageCount: number }>>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRESET_SCHEDULES = [
  { label: 'Every 5 min', value: '*/5 * * * *' },
  { label: 'Every 15 min', value: '*/15 * * * *' },
  { label: 'Hourly', value: '0 * * * *' },
  { label: 'Twice daily (9AM/9PM)', value: '0 9,21 * * *' },
  { label: 'Daily 8AM', value: '0 8 * * *' },
  { label: 'Nightly 2AM', value: '0 2 * * *' },
];

const TASK_TYPES: Record<ScheduledTask['taskType'], { emoji: string; color: string }> = {
  heartbeat: { emoji: '💓', color: 'text-pink-400' },
  cron: { emoji: '⏰', color: 'text-amber-400' },
  monitor: { emoji: '👁️', color: 'text-cyan-400' },
  autonomous: { emoji: '🤖', color: 'text-emerald-400' },
  DEFCON: { emoji: '🚨', color: 'text-red-400' },
};

// ─── Component ───────────────────────────────────────────────────────────────

const KairosPanel: React.FC<KairosPanelProps> = ({ addToast, gateway }) => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([
    {
      id: 'heartbeat',
      name: 'System Heartbeat',
      schedule: '*/5 * * * *',
      scheduleLabel: 'Every 5 min',
      lastRun: new Date(Date.now() - 180000),
      nextRun: new Date(Date.now() + 120000),
      status: 'active',
      taskType: 'heartbeat',
      lastResult: 'success',
    },
    {
      id: 'defcon',
      name: 'DEFCON Status Check',
      schedule: '0 7,12,18 * * *',
      scheduleLabel: '3x daily',
      lastRun: new Date(Date.now() - 3600000),
      nextRun: new Date(Date.now() + 7200000),
      status: 'active',
      taskType: 'DEFCON',
      lastResult: 'success',
    },
    {
      id: 'twice-daily',
      name: 'Grow Monitor (Twice Daily)',
      schedule: '0 9,21 * * *',
      scheduleLabel: '9AM / 9PM',
      lastRun: new Date(Date.now() - 43200000),
      nextRun: new Date(Date.now() + 43200000),
      status: 'active',
      taskType: 'monitor',
      lastResult: 'success',
    },
    {
      id: 'nightly',
      name: 'Nightly Self-Improvement',
      schedule: '0 2 * * *',
      scheduleLabel: 'Nightly 2AM',
      lastRun: new Date(Date.now() - 7200000),
      nextRun: new Date(Date.now() + 7200000),
      status: 'active',
      taskType: 'autonomous',
      lastResult: 'warning',
    },
  ]);

  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskSchedule, setNewTaskSchedule] = useState('*/5 * * * *');
  const [newTaskType, setNewTaskType] = useState<ScheduledTask['taskType']>('cron');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);

  const toggleTask = useCallback((id: string) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, status: t.status === 'active' ? 'paused' : 'active' } : t
    ));
    addToast({ type: 'info', message: 'Task schedule updated' });
  }, [addToast]);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    addToast({ type: 'success', message: 'Task removed' });
  }, [addToast]);

  const addTask = useCallback(() => {
    if (!newTaskName.trim()) return;
    const task: ScheduledTask = {
      id: `task-${Date.now()}`,
      name: newTaskName.trim(),
      schedule: newTaskSchedule,
      scheduleLabel: PRESET_SCHEDULES.find(s => s.value === newTaskSchedule)?.label || newTaskSchedule,
      lastRun: null,
      nextRun: new Date(Date.now() + 300000),
      status: 'active',
      taskType: newTaskType,
    };
    setTasks(prev => [...prev, task]);
    setNewTaskName('');
    setShowNewTaskForm(false);
    addToast({ type: 'success', message: `⏰ Task "${task.name}" scheduled` });
  }, [newTaskName, newTaskSchedule, newTaskType, addToast]);

  const getStatusMeta = (status: ScheduledTask['status']) => {
    switch (status) {
      case 'active':   return { dot: 'bg-[#22c55e]', text: 'text-emerald-400', label: 'Active' };
      case 'paused':   return { dot: 'bg-[#fbbf24]', text: 'text-amber-400', label: 'Paused' };
      case 'error':    return { dot: 'bg-[#ef4444]', text: 'text-red-400', label: 'Error' };
      case 'running':  return { dot: 'bg-[#06b6d4] animate-pulse', text: 'text-cyan-400', label: 'Running' };
      default:         return { dot: 'bg-[#484f58]', text: 'text-slate-400', label: 'Unknown' };
    }
  };

  const formatRelative = (date: Date | null): string => {
    if (!date) return 'Never';
    const diff = date.getTime() - Date.now();
    if (diff < 0) return 'Overdue';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `in ${hours}h`;
    return `in ${Math.floor(hours / 24)}d`;
  };

  const activeCount = tasks.filter(t => t.status === 'active').length;

  return (
    <div className="duck-kairos p-4 space-y-4">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1c2333] border border-[#30363d] flex items-center justify-center text-2xl">
            ⏱️
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#e6edf3]" style={{ fontFamily: 'var(--font-display)' }}>
              KAIROS Scheduler
            </h2>
            <p className="text-xs text-[#8b949e]">
              {activeCount} active tasks · Gateway {gateway.connected ? '🟢' : '🔴'}
            </p>
          </div>
        </div>

        <DuckButton
          variant="primary"
          size="sm"
          onClick={() => setShowNewTaskForm(!showNewTaskForm)}
        >
          + New Task
        </DuckButton>
      </div>

      {/* ── New Task Form ─────────────────────────────────────────────── */}
      {showNewTaskForm && (
        <DuckCard className="border-[#fbbf24]/30 animate-panel-enter">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#8b949e] mb-1 block">Task Name</label>
              <DuckInput
                value={newTaskName}
                onChange={e => setNewTaskName(e.target.value)}
                placeholder="e.g., Daily Report Generator"
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#8b949e] mb-1 block">Schedule</label>
                <select
                  value={newTaskSchedule}
                  onChange={e => setNewTaskSchedule(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-sm rounded-lg px-3 py-2 focus:border-[#fbbf24] outline-none"
                >
                  {PRESET_SCHEDULES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                  <option value="custom">Custom...</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-[#8b949e] mb-1 block">Type</label>
                <select
                  value={newTaskType}
                  onChange={e => setNewTaskType(e.target.value as ScheduledTask['taskType'])}
                  className="w-full bg-[#0d1117] border border-[#30363d] text-[#e6edf3] text-sm rounded-lg px-3 py-2 focus:border-[#fbbf24] outline-none"
                >
                  <option value="cron">Cron Job</option>
                  <option value="heartbeat">Heartbeat</option>
                  <option value="monitor">Monitor</option>
                  <option value="autonomous">Autonomous</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <DuckButton variant="ghost" size="sm" onClick={() => setShowNewTaskForm(false)}>Cancel</DuckButton>
              <DuckButton variant="primary" size="sm" onClick={addTask} disabled={!newTaskName.trim()}>Create Task</DuckButton>
            </div>
          </div>
        </DuckCard>
      )}

      {/* ── Task List ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {tasks.map(task => {
          const meta = getStatusMeta(task.status);
          const typeMeta = TASK_TYPES[task.taskType];

          return (
            <DuckCard
              key={task.id}
              className={`
                transition-all duration-150 hover:border-[#fbbf24]/30
                ${task.status === 'active' ? '' : 'opacity-60'}
              `}
            >
              <div className="flex items-center gap-3">
                {/* Status dot */}
                <div className={`w-2.5 h-2.5 rounded-full ${meta.dot} shrink-0`} />

                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#e6edf3] truncate">{task.name}</span>
                    <span className={`text-base ${typeMeta.color}`}>{typeMeta.emoji}</span>
                    {task.lastResult && (
                      <span className={`text-[10px] ${
                        task.lastResult === 'success' ? 'text-emerald-400' :
                        task.lastResult === 'error' ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {task.lastResult === 'success' ? '✓' : task.lastResult === 'error' ? '✗' : '⚠'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-[#8b949e]">
                    <span className="font-mono">{task.scheduleLabel}</span>
                    {task.lastRun && (
                      <>
                        <span>Last: {formatRelative(task.lastRun)}</span>
                        <span>Next: {formatRelative(task.nextRun)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status Badge */}
                <div className={`text-xs ${meta.text} font-medium px-2 py-1 rounded bg-white/5`}>
                  {meta.label}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`
                      w-7 h-7 rounded-md flex items-center justify-center transition-colors text-xs
                      ${task.status === 'active'
                        ? 'bg-[#fbbf24]/10 text-[#fbbf24] hover:bg-[#fbbf24]/20'
                        : 'bg-[#22c55e]/10 text-emerald-400 hover:bg-[#22c55e]/20'}
                    `}
                    title={task.status === 'active' ? 'Pause' : 'Resume'}
                  >
                    {task.status === 'active' ? '⏸' : '▶'}
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="w-7 h-7 rounded-md bg-[#ef4444]/10 text-red-400 hover:bg-[#ef4444]/20
                               flex items-center justify-center transition-colors"
                    title="Delete task"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Mini log preview */}
              {task.log && (
                <div className="mt-2 p-2 bg-[#0d1117] rounded text-[10px] font-mono text-[#8b949e] truncate">
                  {task.log}
                </div>
              )}
            </DuckCard>
          );
        })}
      </div>

      {/* ── Stats Footer ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active', value: activeCount, color: 'text-emerald-400' },
          { label: 'Total', value: tasks.length, color: 'text-[#e6edf3]' },
          { label: 'Overdue', value: tasks.filter(t => t.nextRun && t.nextRun.getTime() < Date.now()).length, color: 'text-red-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 text-center">
            <div className={`text-xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
            <div className="text-[10px] text-[#484f58] uppercase tracking-wider">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KairosPanel;
