/**
 * Android Agent Protocol - Shared types between duck-cli and Android apps
 *
 * Sources:
 * - DroidClaw Protocol.kt (unitedbyai/droidclaw)
 * - OpenClaw OpenClawProtocolConstants.kt (openclaw/openclaw)
 * - OpenClaw InvokeCommandRegistry.kt
 */

// ─── UI Element Types ────────────────────────────────────────────────────────

export interface UiBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface UiElement {
  text?: string;
  content_desc?: string;
  hint?: string;
  resource_id?: string;
  class?: string;
  package?: string;
  clickable?: boolean;
  long_clickable?: boolean;
  enabled?: boolean;
  focused?: boolean;
  bounds?: UiBounds;
}

// ─── DroidClaw WebSocket Messages ────────────────────────────────────────────

export interface AuthMessage {
  type: "auth";
  apiKey: string;
  deviceInfo?: DeviceInfoMsg;
}

export interface DeviceInfoMsg {
  model: string;
  manufacturer: string;
  androidVersion: string;
  screenWidth: number;
  screenHeight: number;
  batteryLevel: number;
  isCharging: boolean;
}

export interface ScreenResponse {
  type: "screen";
  requestId: string;
  elements: UiElement[];
  screenHash?: string;
  screenshot?: string; // base64
  packageName?: string;
}

export interface ResultResponse {
  type: "result";
  requestId: string;
  success: boolean;
  error?: string;
  data?: string;
}

export interface PongMessage {
  type: "pong";
}

export interface GoalMessage {
  type: "goal";
  text: string;
}

export interface GoalStartedMessage {
  type: "goal_started";
  sessionId: string;
  goal: string;
}

export interface GoalCompletedMessage {
  type: "goal_completed";
  success: boolean;
  stepsUsed: number;
  message?: string;
}

export interface StepMessage {
  type: "step";
  step: number;
  action: string;
  reasoning: string;
}

export interface TranscriptPartialMessage {
  type: "transcript_partial";
  text: string;
}

export interface TranscriptFinalMessage {
  type: "transcript_final";
  text: string;
}

export interface HeartbeatMessage {
  type: "heartbeat";
  batteryLevel: number;
  isCharging: boolean;
}

export interface ServerMessage {
  type: string;
  requestId?: string;
  deviceId?: string;
  message?: string;
  sessionId?: string;
  goal?: string;
  success?: boolean;
  stepsUsed?: number;
  step?: number;
  action?: Record<string, unknown>;
  reasoning?: string;
  screenHash?: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  duration?: number;
  text?: string;
  packageName?: string;
  url?: string;
  code?: number;
  intentAction?: string;
  intentUri?: string;
  intentType?: string;
  intentExtras?: Record<string, string>;
  setting?: string;
}

// ─── Action Types ─────────────────────────────────────────────────────────────

export type DroidClawAction =
  | "tap" | "type" | "enter" | "back" | "home" | "notifications"
  | "recents" | "split_screen" | "longpress" | "swipe" | "launch"
  | "clear" | "clipboard_set" | "clipboard_get" | "paste" | "open_url"
  | "switch_app" | "keyevent" | "open_settings" | "wait" | "intent"
  | "screenshot" | "get_screen";

export interface ActionDecision {
  action: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  duration?: number;
  text?: string;
  packageName?: string;
  url?: string;
  code?: number;
  intentAction?: string;
  intentUri?: string;
  intentType?: string;
  intentExtras?: Record<string, string>;
  setting?: string;
}

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: string;
}

// ─── OpenClaw Gateway Node Messages ──────────────────────────────────────────

export interface OpenClawInvokeRequest {
  command: string;
  paramsJson?: string;
  timeoutMs?: number;
}

export interface OpenClawInvokeResult {
  ok: boolean;
  payloadJson?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface OpenClawNodeEvent {
  event: string;
  payloadJSON?: string;
}

// ─── OpenClaw Capabilities ────────────────────────────────────────────────────

export enum OpenClawCapability {
  Canvas = "canvas",
  Camera = "camera",
  Sms = "sms",
  VoiceWake = "voiceWake",
  Location = "location",
  Device = "device",
  Notifications = "notifications",
  System = "system",
  Photos = "photos",
  Contacts = "contacts",
  Calendar = "calendar",
  Motion = "motion",
  CallLog = "callLog",
}

export enum OpenClawCanvasCommand {
  Present = "canvas.present",
  Hide = "canvas.hide",
  Navigate = "canvas.navigate",
  Eval = "canvas.eval",
  Snapshot = "canvas.snapshot",
}

export enum OpenClawCameraCommand {
  List = "camera.list",
  Snap = "camera.snap",
  Clip = "camera.clip",
}

export enum OpenClawSmsCommand {
  Send = "sms.send",
  Search = "sms.search",
}

export enum OpenClawLocationCommand {
  Get = "location.get",
}

export enum OpenClawDeviceCommand {
  Status = "device.status",
  Info = "device.info",
  Permissions = "device.permissions",
  Health = "device.health",
}

export enum OpenClawNotificationsCommand {
  List = "notifications.list",
  Actions = "notifications.actions",
}

export enum OpenClawContactsCommand {
  Search = "contacts.search",
  Add = "contacts.add",
}

export enum OpenClawCalendarCommand {
  Events = "calendar.events",
  Add = "calendar.add",
}

export enum OpenClawMotionCommand {
  Activity = "motion.activity",
  Pedometer = "motion.pedometer",
}

export enum OpenClawCallLogCommand {
  Search = "callLog.search",
}

// ─── Termux API Methods ───────────────────────────────────────────────────────

export type TermuxApiMethod =
  | "AudioInfo" | "BatteryStatus" | "Brightness"
  | "CameraInfo" | "CameraPhoto" | "CallLog"
  | "Clipboard" | "ContactList" | "Dialog"
  | "Download" | "Fingerprint" | "InfraredFrequencies"
  | "InfraredTransmit" | "JobScheduler" | "Keystore"
  | "Location" | "MediaPlayer" | "MediaScanner"
  | "MicRecorder" | "Nfc" | "Notification"
  | "NotificationChannel" | "NotificationList"
  | "NotificationRemove" | "NotificationReply"
  | "SAF" | "Sensor" | "Share"
  | "SmsInbox" | "SmsSend" | "SpeechToText"
  | "StorageGet" | "TelephonyCall" | "TelephonyCellInfo"
  | "TelephonyDeviceInfo" | "TextToSpeech" | "Toast"
  | "Torch" | "Usb" | "Vibrate" | "Volume"
  | "Wallpaper" | "WifiConnectionInfo" | "WifiEnable" | "WifiScanInfo";

// ─── Agent State ─────────────────────────────────────────────────────────────

export interface AgentLoopState {
  goal: string;
  step: number;
  maxSteps: number;
  screenHash: string;
  consecutiveNoop: number;
  reasoning: string;
  lastAction?: ActionDecision;
  startTime: number;
}

export type AgentStatus = "idle" | "running" | "completed" | "failed";

// ─── Workflow Types ───────────────────────────────────────────────────────────

export interface WorkflowStep {
  goal: string;
  app?: string;
  maxSteps?: number;
  formData?: Record<string, string>;
}

export interface Workflow {
  name: string;
  steps: WorkflowStep[];
}

export interface StepResult {
  goal: string;
  app?: string;
  success: boolean;
  stepsUsed: number;
  error?: string;
}

export interface WorkflowResult {
  name: string;
  steps: StepResult[];
  success: boolean;
}

// ─── YAML Flow Types (Maestro-style) ─────────────────────────────────────────

export interface FlowFrontmatter {
  appId?: string;
  name?: string;
  timeout?: number;
}

export type FlowStep =
  | string
  | { tap?: string }
  | { longpress?: string }
  | { swipe?: [number, number, number, number] | string }
  | { type?: { text: string; target?: string } }
  | { launch?: string }
  | { input?: string }
  | { back?: boolean }
  | { home?: boolean }
  | { enter?: boolean }
  | { wait?: number }
  | { done?: string };

export interface ParsedFlow {
  frontmatter: FlowFrontmatter;
  steps: FlowStep[];
  name?: string;
}
