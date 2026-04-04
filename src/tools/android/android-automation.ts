/**
 * Android Automation Tools for Duck CLI
 * Comprehensive tool suite for Android device control and automation
 * 
 * Uses AndroidTools singleton - auto-selects first connected device
 */

import { AndroidTools } from '../../agent/android-tools.js';

// Get Android tools instance (auto-selects first connected device)
const android = new AndroidTools();

// Helper to ensure device is connected
async function ensureDevice() {
  await android.refreshDevices();
  if (!android.isConnected()) {
    throw new Error('No Android device connected');
  }
}

// Tool definitions with schemas
export const androidTools = [
  // === CORE DEVICE OPERATIONS ===
  {
    name: 'android_device_info',
    description: 'Get detailed Android device information (model, Android version, etc)',
    schema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      await ensureDevice();
      const device = android.getCurrentDevice();
      const { stdout } = await android.shell('getprop ro.product.model');
      const { stdout: androidVer } = await android.shell('getprop ro.build.version.release');
      const { stdout: manufacturer } = await android.shell('getprop ro.product.manufacturer');
      
      return {
        serial: device?.serial,
        model: device?.model || stdout.trim(),
        androidVersion: androidVer.trim(),
        manufacturer: manufacturer.trim(),
        state: device?.state
      };
    }
  },

  {
    name: 'android_device_list',
    description: 'List all connected Android devices',
    schema: { type: 'object', properties: {} },
    handler: async () => {
      const devices = await android.refreshDevices();
      return devices.map(d => ({
        serial: d.serial,
        model: d.model,
        state: d.state
      }));
    }
  },

  // === SCREEN OPERATIONS ===
  {
    name: 'android_screenshot',
    description: 'Capture screenshot from Android device',
    schema: {
      type: 'object',
      properties: {
        savePath: { type: 'string', description: 'Save path (default: /tmp/duck-android/screenshot.png)' }
      }
    },
    handler: async (args: any) => {
      await ensureDevice();
      const savePath = args.savePath || '/tmp/duck-android/screenshot.png';
      const result = await android.captureScreen(savePath);
      return { saved: savePath, ...result };
    }
  },

  {
    name: 'android_screen_text',
    description: 'Extract all visible text from screen using OCR',
    schema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      await ensureDevice();
      const text = await android.readScreen();
      return { text, timestamp: new Date().toISOString() };
    }
  },

  // === UI INTERACTION ===
  {
    name: 'android_tap',
    description: 'Tap at coordinates on screen',
    schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' }
      },
      required: ['x', 'y']
    },
    handler: async (args: any) => {
      await ensureDevice();
      const result = await android.tap(args.x, args.y);
      return { success: result, x: args.x, y: args.y };
    }
  },

  {
    name: 'android_find_and_tap',
    description: 'Find UI element by text/content-desc and tap it',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text or content-desc to find' }
      },
      required: ['query']
    },
    handler: async (args: any) => {
      await ensureDevice();
      const xml = await android.dumpUiXml();
      const elements = android.parseUiXml(xml);
      
      for (const el of elements) {
        if (el.text?.toLowerCase().includes(args.query.toLowerCase()) ||
            el.content_desc?.toLowerCase().includes(args.query.toLowerCase())) {
          if (el.bounds) {
            const x = Math.round((el.bounds.left + el.bounds.right) / 2);
            const y = Math.round((el.bounds.top + el.bounds.bottom) / 2);
            await android.tap(x, y);
            return { found: true, tapped: true, element: el.text || el.content_desc };
          }
        }
      }
      return { found: false, tapped: false, query: args.query };
    }
  },

  {
    name: 'android_type',
    description: 'Type text on Android device keyboard',
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to type' }
      },
      required: ['text']
    },
    handler: async (args: any) => {
      await ensureDevice();
      const result = await android.typeText(args.text);
      return { success: result, text: args.text };
    }
  },

  {
    name: 'android_swipe',
    description: 'Swipe on screen in direction',
    schema: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'Swipe direction' },
        distance: { type: 'number', description: 'Distance in pixels (default: 500)' }
      },
      required: ['direction']
    },
    handler: async (args: any) => {
      await ensureDevice();
      const result = await android.scroll(args.direction, args.distance || 500);
      return { success: result, direction: args.direction };
    }
  },

  {
    name: 'android_press_key',
    description: 'Press Android system key (home, back, enter, etc)',
    schema: {
      type: 'object',
      properties: {
        key: { type: 'string', enum: ['home', 'back', 'enter', 'delete', 'recent', 'power'], description: 'Key to press' }
      },
      required: ['key']
    },
    handler: async (args: any) => {
      await ensureDevice();
      const result = await android.pressKey(args.key);
      return { success: result, key: args.key };
    }
  },

  // === APP MANAGEMENT ===
  {
    name: 'android_launch_app',
    description: 'Launch Android app by package name',
    schema: {
      type: 'object',
      properties: {
        package: { type: 'string', description: 'Package name (e.g., com.instagram.android)' }
      },
      required: ['package']
    },
    handler: async (args: any) => {
      await ensureDevice();
      const result = await android.launchApp(args.package);
      return { success: result, package: args.package };
    }
  },

  {
    name: 'android_kill_app',
    description: 'Force stop Android app',
    schema: {
      type: 'object',
      properties: {
        package: { type: 'string', description: 'Package name' }
      },
      required: ['package']
    },
    handler: async (args: any) => {
      await ensureDevice();
      const result = await android.killApp(args.package);
      return { success: result, package: args.package };
    }
  },

  {
    name: 'android_current_app',
    description: 'Get currently foreground app',
    schema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      await ensureDevice();
      const app = await android.getForegroundApp();
      return { foregroundApp: app };
    }
  },

  {
    name: 'android_list_apps',
    description: 'List installed apps on device',
    schema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Filter packages by name (optional)' }
      }
    },
    handler: async (args: any) => {
      await ensureDevice();
      let packages = await android.listApps();
      if (args.filter) {
        packages = packages.filter(p => p.toLowerCase().includes(args.filter.toLowerCase()));
      }
      return { count: packages.length, packages: packages.slice(0, 100) };
    }
  },

  // === NOTIFICATIONS & CLIPBOARD ===
  {
    name: 'android_notifications',
    description: 'Get recent notifications',
    schema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      await ensureDevice();
      const notifications = await android.getNotifications();
      return { count: notifications.length, notifications };
    }
  },

  {
    name: 'android_clipboard_get',
    description: 'Get clipboard text',
    schema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      await ensureDevice();
      const text = await android.getClipboard();
      return { text };
    }
  },

  {
    name: 'android_clipboard_set',
    description: 'Set clipboard text',
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to copy' }
      },
      required: ['text']
    },
    handler: async (args: any) => {
      await ensureDevice();
      const result = await android.setClipboard(args.text);
      return { success: result, text: args.text };
    }
  },

  // === TERMUX API ===
  {
    name: 'android_termux',
    description: 'Execute Termux API command (battery, clip-get, clip-set, notif, etc)',
    schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Termux API command (without termux- prefix)' }
      },
      required: ['command']
    },
    handler: async (args: any) => {
      await ensureDevice();
      const result = await android.termuxCommand(args.command);
      return { result };
    }
  },

  // === FILE OPERATIONS ===
  {
    name: 'android_push_file',
    description: 'Push file to Android device',
    schema: {
      type: 'object',
      properties: {
        localPath: { type: 'string', description: 'Local file path' },
        remotePath: { type: 'string', description: 'Remote path on device' }
      },
      required: ['localPath', 'remotePath']
    },
    handler: async (args: any) => {
      await ensureDevice();
      const result = await android.pushFile(args.localPath, args.remotePath);
      return { success: result, local: args.localPath, remote: args.remotePath };
    }
  },

  {
    name: 'android_pull_file',
    description: 'Pull file from Android device',
    schema: {
      type: 'object',
      properties: {
        remotePath: { type: 'string', description: 'Remote path on device' },
        localPath: { type: 'string', description: 'Local save path' }
      },
      required: ['remotePath', 'localPath']
    },
    handler: async (args: any) => {
      await ensureDevice();
      const result = await android.pullFile(args.remotePath, args.localPath);
      return { success: result, remote: args.remotePath, local: args.localPath };
    }
  },

  // === SYSTEM INFO ===
  {
    name: 'android_battery',
    description: 'Get battery status',
    schema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      await ensureDevice();
      const battery = await android.getBatteryLevel();
      return battery;
    }
  },

  {
    name: 'android_install_apk',
    description: 'Install APK on Android device',
    schema: {
      type: 'object',
      properties: {
        apkPath: { type: 'string', description: 'APK file path on device' }
      },
      required: ['apkPath']
    },
    handler: async (args: any) => {
      await ensureDevice();
      const result = await android.installApk(args.apkPath);
      return { success: result, apk: args.apkPath };
    }
  },

  // === DUMP UI ===
  {
    name: 'android_dump_ui',
    description: 'Dump UI hierarchy XML from Android screen',
    schema: {
      type: 'object',
      properties: {
        package: { type: 'string', description: 'Filter by package name' }
      }
    },
    handler: async (args: any) => {
      await ensureDevice();
      const xml = await android.dumpUiXml(args.package);
      const elements = android.parseUiXml(xml);
      return { xml, elements, count: elements.length };
    }
  },

  // === SEND MESSAGE ===
  {
    name: 'android_send_message',
    description: 'Send message in messaging app (type + enter)',
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Message to send' }
      },
      required: ['text']
    },
    handler: async (args: any) => {
      await ensureDevice();
      await android.typeText(args.text);
      await android.pressKey('enter');
      return { sent: true, text: args.text };
    }
  },

  // === SHELL ===
  {
    name: 'android_execute_shell',
    description: 'Execute shell command on Android device',
    schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' }
      },
      required: ['command']
    },
    handler: async (args: any) => {
      await ensureDevice();
      const { stdout, stderr } = await android.shell(args.command);
      return { stdout, stderr };
    }
  },

  // === WAIT FOR CONTENT ===
  {
    name: 'android_wait_for_screen',
    description: 'Wait for specific text to appear on screen',
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Text to wait for' },
        timeout: { type: 'number', description: 'Timeout in seconds (default: 10)' }
      },
      required: ['content']
    },
    handler: async (args: any) => {
      await ensureDevice();
      const timeout = (args.timeout || 10) * 1000;
      const start = Date.now();
      
      while (Date.now() - start < timeout) {
        const text = await android.readScreen();
        if (text.toLowerCase().includes(args.content.toLowerCase())) {
          return { found: true, content: args.content };
        }
        await new Promise(r => setTimeout(r, 500));
      }
      return { found: false, content: args.content, timeout: args.timeout };
    }
  },

  // === ANALYZE SCREEN ===
  {
    name: 'android_analyze',
    description: 'Full AI analysis of screen - UI elements, content, and recommendations',
    schema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      await ensureDevice();
      
      // Capture screenshot
      const screenshotPath = '/tmp/duck-android/analyze.png';
      await android.captureScreen(screenshotPath);
      
      // Get UI dump
      const xml = await android.dumpUiXml();
      const elements = android.parseUiXml(xml);
      
      // Get screen text
      const text = await android.readScreen();
      
      // Find actionable elements
      const tappable = elements.filter(e => e.clickable && e.bounds).slice(0, 10);
      
      return {
        screenshot: screenshotPath,
        elementCount: elements.length,
        tappableElements: tappable.map(e => ({
          text: e.text || e.content_desc,
          bounds: e.bounds
        })),
        screenText: text.substring(0, 500),
        timestamp: new Date().toISOString()
      };
    }
  }
];

export default androidTools;