#!/usr/bin/env python3
"""
Duck CLI Android Workflow Automation
Advanced automation scripts for Android device control via duck-cli
"""

import subprocess
import json
import time
import sys
from dataclasses import dataclass
from typing import Optional, List, Dict, Tuple

@dataclass
class Point:
    x: int
    y: int
    
    def __str__(self):
        return f"({self.x}, {self.y})"

class AndroidWorkflow:
    """Workflow automation for Android via duck-cli"""
    
    def __init__(self, serial: Optional[str] = None):
        self.serial = serial
        self.serial_arg = ["--device", serial] if serial else []
    
    def run(self, *args) -> str:
        """Run duck android command"""
        cmd = ["duck", "android"] + list(args) + self.serial_arg
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.stdout.strip() or result.stderr.strip()
    
    def get_devices(self) -> List[Dict]:
        """List connected devices"""
        output = self.run("devices")
        try:
            # Parse JSON output
            return json.loads(output)
        except:
            print(f"Device list: {output}")
            return []
    
    def get_info(self) -> Dict:
        """Get device info"""
        output = self.run("info")
        try:
            return json.loads(output)
        except:
            print(f"Info: {output}")
            return {}
    
    def screenshot(self, path: str = "/tmp/android_screen.png") -> str:
        """Capture screenshot"""
        return self.run("screenshot", path)
    
    def screen_text(self) -> str:
        """Get all visible text"""
        return self.run("screen")
    
    def analyze_screen(self) -> Dict:
        """AI analysis of screen"""
        output = self.run("analyze")
        try:
            return json.loads(output)
        except:
            return {"analysis": output}
    
    def tap(self, x: int, y: int) -> str:
        """Tap at coordinates"""
        return self.run("tap", str(x), str(y))
    
    def type_text(self, text: str) -> str:
        """Type text"""
        return self.run("type", text)
    
    def swipe(self, direction: str, distance: int = 300) -> str:
        """Swipe gesture"""
        return self.run("swipe", direction, str(distance))
    
    def press_key(self, key: str) -> str:
        """Press key (enter, back, home, recent)"""
        return self.run("press", key)
    
    def launch_app(self, package: str) -> str:
        """Launch app by package"""
        return self.run("launch", package)
    
    def kill_app(self, package: str) -> str:
        """Force stop app"""
        return self.run("kill", package)
    
    def get_foreground(self) -> str:
        """Get foreground app"""
        return self.run("foreground").strip()
    
    def get_battery(self) -> Dict:
        """Get battery status"""
        output = self.run("battery")
        try:
            return json.loads(output)
        except:
            return {"raw": output}
    
    def get_notifications(self) -> List[Dict]:
        """Get recent notifications"""
        output = self.run("notifications")
        try:
            return json.loads(output)
        except:
            return []
    
    def dump_ui(self, package: Optional[str] = None) -> str:
        """Dump UI hierarchy"""
        if package:
            return self.run("dump", package)
        return self.run("dump")
    
    def shell(self, command: str) -> str:
        """Run shell command"""
        return self.run("shell", command)
    
    def find_element(self, text: str) -> Optional[Point]:
        """Find element center point by text"""
        xml = self.dump_ui()
        lines = xml.split('\n')
        for line in lines:
            if f'text="{text}"' in line or f'content-desc="{text}"' in line:
                # Parse bounds="[x1,y1][x2,y2]"
                import re
                match = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', line)
                if match:
                    x1, y1, x2, y2 = map(int, match.groups())
                    return Point((x1 + x2) // 2, (y1 + y2) // 2)
        return None
    
    def wait_for_screen(self, text: str, timeout: int = 10) -> bool:
        """Wait for text to appear on screen"""
        for _ in range(timeout):
            if text in self.screen_text():
                return True
            time.sleep(1)
        return False
    
    def scroll_down_until(self, text: str, max_scrolls: int = 10) -> bool:
        """Scroll down until text appears"""
        for _ in range(max_scrolls):
            if text in self.screen_text():
                return True
            self.swipe("down")
            time.sleep(0.5)
        return False


class GrowMonitorWorkflow(AndroidWorkflow):
    """Specialized workflow for grow monitoring"""
    
    def __init__(self, serial: Optional[str] = None):
        super().__init__(serial)
        self.camera_pkg = "com.motorola.camera5"
        self.photos_pkg = "com.google.android.apps.photos"
    
    def capture_grow_photo(self, save_path: str = "/sdcard/DCIM/Camera/grow.jpg") -> str:
        """Capture photo from grow tent camera"""
        # Launch camera
        self.launch_app(self.camera_pkg)
        time.sleep(2)
        
        # Shutter button coordinates (adjust for your device)
        shutter = Point(360, 1353)
        
        # Tap shutter
        self.tap(shutter.x, shutter.y)
        time.sleep(1)
        
        return save_path
    
    def analyze_grow_health(self) -> Dict:
        """Take photo and analyze plant health"""
        # Capture
        self.capture_grow_photo()
        time.sleep(2)
        
        # Open photos
        self.launch_app(self.photos_pkg)
        time.sleep(2)
        
        # Analyze
        return self.analyze_screen()
    
    def check_environment(self) -> Dict:
        """Check grow environment sensors"""
        battery = self.get_battery()
        notifications = self.get_notifications()
        
        return {
            "battery": battery,
            "notifications": notifications,
            "foreground_app": self.get_foreground()
        }


class MessagingWorkflow(AndroidWorkflow):
    """Workflow for messaging automation"""
    
    def send_sms(self, phone: str, message: str) -> bool:
        """Send SMS"""
        # Open messages
        self.launch_app("com.google.android.apps.messaging")
        time.sleep(2)
        
        # Start new message
        new_msg = self.find_element("Start chat") or self.find_element("New message")
        if new_msg:
            self.tap(new_msg.x, new_msg.y)
            time.sleep(1)
        
        # Type number
        self.type_text(phone)
        time.sleep(1)
        
        # Select contact
        self.press_key("enter")
        time.sleep(1)
        
        # Type message
        self.type_text(message)
        time.sleep(0.5)
        
        # Send
        self.press_key("enter")
        
        return True
    
    def check_unread(self) -> int:
        """Count unread messages"""
        output = self.screen_text()
        return output.count("Unread") + output.count("unread")


def main():
    """Example usage"""
    if len(sys.argv) < 2:
        print("Usage: android-workflow.py <command> [args]")
        print("\nCommands:")
        print("  devices              - List connected devices")
        print("  info                - Device info")
        print("  screenshot [path]   - Take screenshot")
        print("  analyze             - Analyze screen with AI")
        print("  screen              - Get screen text")
        print("  battery             - Battery status")
        print("  notifications       - Recent notifications")
        print("  launch <pkg>        - Launch app")
        print("  grow                - Grow monitoring workflow")
        print("  sms <phone> <msg>   - Send SMS")
        sys.exit(1)
    
    cmd = sys.argv[1]
    workflow = AndroidWorkflow()
    
    if cmd == "devices":
        devices = workflow.get_devices()
        print(json.dumps(devices, indent=2))
    
    elif cmd == "info":
        info = workflow.get_info()
        print(json.dumps(info, indent=2))
    
    elif cmd == "screenshot":
        path = sys.argv[2] if len(sys.argv) > 2 else "/tmp/android_screen.png"
        print(workflow.screenshot(path))
    
    elif cmd == "analyze":
        result = workflow.analyze_screen()
        print(json.dumps(result, indent=2))
    
    elif cmd == "screen":
        print(workflow.screen_text())
    
    elif cmd == "battery":
        print(json.dumps(workflow.get_battery(), indent=2))
    
    elif cmd == "notifications":
        print(json.dumps(workflow.get_notifications(), indent=2))
    
    elif cmd == "launch":
        if len(sys.argv) < 3:
            print("Usage: android-workflow.py launch <package>")
            sys.exit(1)
        print(workflow.launch_app(sys.argv[2]))
    
    elif cmd == "grow":
        grow = GrowMonitorWorkflow()
        result = grow.analyze_grow_health()
        print(json.dumps(result, indent=2))
    
    elif cmd == "sms":
        if len(sys.argv) < 4:
            print("Usage: android-workflow.py sms <phone> <message>")
            sys.exit(1)
        messaging = MessagingWorkflow()
        success = messaging.send_sms(sys.argv[2], sys.argv[3])
        print(f"SMS sent: {success}")
    
    elif cmd == "tap":
        if len(sys.argv) < 4:
            print("Usage: android-workflow.py tap <x> <y>")
            sys.exit(1)
        print(workflow.tap(int(sys.argv[2]), int(sys.argv[3])))
    
    elif cmd == "type":
        if len(sys.argv) < 3:
            print("Usage: android-workflow.py type <text>")
            sys.exit(1)
        print(workflow.type_text(sys.argv[2]))
    
    elif cmd == "shell":
        if len(sys.argv) < 3:
            print("Usage: android-workflow.py shell <command>")
            sys.exit(1)
        print(workflow.shell(sys.argv[2]))
    
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
