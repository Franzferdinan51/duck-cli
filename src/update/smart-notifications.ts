/**
 * 🦆 Smart Notifications - Intelligent notification system for update alerts
 */
import { ClassifiedUpdate } from './update-classifier';
import { SuccessPrediction } from './success-predictor';
import { UpdateStrategy } from './adaptive-strategy';

export type NotificationUrgency = 'critical' | 'important' | 'info';
export type NotificationAction = 'update-now' | 'review' | 'ignore' | 'schedule';

export interface UpdateNotification {
  id: string;
  source: string;
  version: string;
  urgency: NotificationUrgency;
  message: string;
  action: NotificationAction;
  timestamp: Date;
  deadline?: Date;
  classification?: string;
  risk?: string;
  canAutoUpdate?: boolean;
  details?: { changes?: number; dependencies?: number; successRate?: number };
}

export interface NotificationPreferences {
  enabled: boolean;
  critical: boolean;
  important: boolean;
  info: boolean;
  securityOverride: boolean;
  digestMode: boolean;
  digestTime: string;
  quietHours: { enabled: boolean; start: string; end: string };
}

const DEFAULT_PREFS: NotificationPreferences = {
  enabled: true, critical: true, important: true, info: true,
  securityOverride: true, digestMode: false, digestTime: '09:00',
  quietHours: { enabled: true, start: '22:00', end: '08:00' }
};

interface NotificationStoreData {
  notifications: UpdateNotification[];
  sent: UpdateNotification[];
  dismissed: string[];
  digest: UpdateNotification[];
}

class NotificationStore {
  private store: NotificationStoreData = { notifications: [], sent: [], dismissed: [], digest: [] };
  private path: string;

  constructor() {
    this.path = `${process.env.HOME}/.duck/update-notifications.json`;
    this.load();
  }

  private load(): void {
    try {
      const { existsSync, readFileSync } = require('fs');
      if (existsSync(this.path)) {
        const data = JSON.parse(readFileSync(this.path, 'utf-8'));
        this.store = {
          notifications: (data.notifications || []).map((n: any) => ({ ...n, timestamp: new Date(n.timestamp), deadline: n.deadline ? new Date(n.deadline) : undefined })),
          sent: (data.sent || []).map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) })),
          dismissed: data.dismissed || [],
          digest: []
        };
      }
    } catch (error) {
      console.error('[NotificationStore] Failed to load:', error);
    }
  }

  private save(): void {
    try {
      const { existsSync, mkdirSync, writeFileSync } = require('fs');
      const dir = require('path').dirname(this.path);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.path, JSON.stringify({ notifications: this.store.notifications, sent: this.store.sent.slice(-100), dismissed: this.store.dismissed.slice(-500) }, null, 2), 'utf-8');
    } catch (error) {
      console.error('[NotificationStore] Failed to save:', error);
    }
  }

  add(n: UpdateNotification): void { this.store.notifications.push(n); this.save(); }
  dismiss(id: string): void { this.store.dismissed.push(id); this.store.notifications = this.store.notifications.filter(n => n.id !== id); this.save(); }
  getAll(): UpdateNotification[] { return this.store.notifications.filter(n => !this.store.dismissed.includes(n.id)); }
  getPending(): UpdateNotification[] { return this.getAll().filter(n => n.action !== 'ignore'); }
  addToDigest(n: UpdateNotification): void { this.store.digest.push(n); }
  getDigest(): UpdateNotification[] { return this.store.digest; }
  clearDigest(): void { this.store.digest = []; this.save(); }
  markSent(n: UpdateNotification): void { this.store.sent.push(n); this.store.notifications = this.store.notifications.filter(x => x.id !== n.id); this.save(); }
}

export class SmartNotificationEngine {
  private store: NotificationStore;
  private prefs: NotificationPreferences;

  constructor() {
    this.store = new NotificationStore();
    this.prefs = { ...DEFAULT_PREFS };
    this.loadPrefs();
  }

  private loadPrefs(): void {
    try {
      const { existsSync, readFileSync } = require('fs');
      const path = `${process.env.HOME}/.duck/update-notification-prefs.json`;
      if (existsSync(path)) this.prefs = { ...DEFAULT_PREFS, ...JSON.parse(readFileSync(path, 'utf-8')) };
    } catch (error) {
      console.error('[SmartNotification] Failed to load prefs:', error);
    }
  }

  savePrefs(): void {
    try {
      const { existsSync, mkdirSync, writeFileSync } = require('fs');
      const path = `${process.env.HOME}/.duck/update-notification-prefs.json`;
      const dir = require('path').dirname(path);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(path, JSON.stringify(this.prefs, null, 2), 'utf-8');
    } catch (error) {
      console.error('[SmartNotification] Failed to save prefs:', error);
    }
  }

  createNotification(source: string, version: string, classification: ClassifiedUpdate, prediction: SuccessPrediction, strategy: UpdateStrategy): UpdateNotification | null {
    const existing = this.store.getAll().find(n => n.source === source && n.version === version);
    if (existing) return null;

    const urgency = this.determineUrgency(classification, prediction, strategy);
    if (!this.shouldNotify(urgency, classification)) return null;

    const icons: Record<NotificationUrgency, string> = { critical: '🚨', important: '⚠️', info: 'ℹ️' };
    const typeEmoji: Record<string, string> = { security: '🔒', breaking: '⚠️', feature: '✨', default: '📦' };

    let emoji = typeEmoji[classification.type] || typeEmoji.default;
    let message = `${emoji} ${classification.type} update v${version}`;

    if (prediction.confidence >= 0.8) message += ' - High confidence';
    else if (prediction.confidence < 0.5) message += ' - Uncertain';

    const action = this.determineAction(classification, prediction, strategy);

    const notification: UpdateNotification = {
      id: `${source}-${version}-${Date.now()}`,
      source, version, urgency, message, action, timestamp: new Date(),
      classification: classification.type, risk: classification.risk,
      canAutoUpdate: classification.autoUpdate,
      details: { changes: strategy.steps.length, dependencies: classification.dependencies.length, successRate: Math.round(prediction.confidence * 100) }
    };

    if (urgency === 'critical') notification.deadline = new Date(Date.now() + 60 * 60 * 1000);
    else if (urgency === 'important') notification.deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return notification;
  }

  private determineUrgency(classification: ClassifiedUpdate, prediction: SuccessPrediction, strategy: UpdateStrategy): NotificationUrgency {
    if (classification.type === 'security') return 'critical';
    if (classification.risk === 'high' && prediction.confidence < 0.5) return 'important';
    if (classification.type === 'breaking') return 'important';
    if (strategy.estimatedRisk > 0.7) return 'important';
    return 'info';
  }

  private shouldNotify(urgency: NotificationUrgency, classification: ClassifiedUpdate): boolean {
    if (!this.prefs.enabled) return false;
    if (classification.type === 'security' && this.prefs.securityOverride) return true;
    if (urgency === 'critical') return this.prefs.critical;
    if (urgency === 'important') return this.prefs.important;
    return this.prefs.info;
  }

  private determineAction(classification: ClassifiedUpdate, prediction: SuccessPrediction, strategy: UpdateStrategy): NotificationAction {
    if (classification.type === 'security') return 'update-now';
    if (!strategy.shouldUpdate) return 'ignore';
    if (strategy.estimatedRisk > 0.7) return 'review';
    if (strategy.approach === 'auto') return 'schedule';
    return 'review';
  }

  queue(notification: UpdateNotification): void {
    if (notification.urgency !== 'critical' && this.isQuietHours()) {
      this.store.addToDigest(notification);
      return;
    }
    if (notification.urgency === 'critical') { this.send(notification); return; }
    if (this.prefs.digestMode && notification.urgency === 'info') { this.store.addToDigest(notification); return; }
    this.send(notification);
  }

  send(notification: UpdateNotification): void {
    this.store.add(notification);
    this.formatForOutput(notification);
    this.store.markSent(notification);
  }

  private isQuietHours(): boolean {
    if (!this.prefs.quietHours.enabled) return false;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = this.prefs.quietHours.start.split(':').map(Number);
    const [eh, em] = this.prefs.quietHours.end.split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (start <= end) return mins >= start && mins < end;
    return mins >= start || mins < end;
  }

  private formatForOutput(n: UpdateNotification): void {
    const icons: Record<NotificationUrgency, string> = { critical: '🚨', important: '⚠️', info: 'ℹ️' };
    console.log('\n' + '='.repeat(60));
    console.log(`${icons[n.urgency]} ${n.urgency.toUpperCase()}`);
    console.log('='.repeat(60));
    console.log(`Source: ${n.source}`);
    console.log(`Version: ${n.version}`);
    console.log(`Type: ${n.classification}`);
    console.log(`Risk: ${n.risk}`);
    console.log(`Action: ${n.action}`);
    if (n.canAutoUpdate) console.log('Auto-update: ✓ Supported');
    if (n.deadline) console.log(`Deadline: ${Math.round((n.deadline.getTime() - Date.now()) / 60000)} minutes`);
    console.log('-'.repeat(60));
    console.log(n.message);
    console.log('='.repeat(60) + '\n');
  }

  printDigest(): void {
    const digest = this.store.getDigest();
    if (digest.length === 0) { console.log('[smart-notifications] No pending digest items'); return; }
    console.log('\n' + '='.repeat(60));
    console.log('📬 UPDATE DIGEST');
    console.log(`(${digest.length} pending updates)`);
    console.log('='.repeat(60));
    digest.forEach((n, i) => {
      console.log(`\n${i + 1}. ${n.source} v${n.version}`);
      console.log(`   Type: ${n.classification} | Risk: ${n.risk}`);
      console.log(`   ${n.message}`);
    });
    console.log('\n' + '='.repeat(60) + '\n');
  }

  sendDigest(): void {
    if (this.store.getDigest().length === 0) return;
    this.printDigest();
    this.store.clearDigest();
  }

  getPending(): UpdateNotification[] { return this.store.getPending(); }
  dismiss(id: string): void { this.store.dismiss(id); }
  updatePrefs(updates: Partial<NotificationPreferences>): void { this.prefs = { ...this.prefs, ...updates }; this.savePrefs(); }
  getPrefs(): NotificationPreferences { return { ...this.prefs }; }
  checkDigest(): void {
    if (!this.prefs.digestMode) return;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    if (time === this.prefs.digestTime) this.sendDigest();
  }
  getStats(): { pending: number; sent: number; dismissed: number } {
    return { pending: this.store.getPending().length, sent: this.store.getAll().length, dismissed: 0 };
  }
}

export const smartNotifications = new SmartNotificationEngine();
