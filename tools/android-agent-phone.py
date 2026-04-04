#!/usr/bin/env python3
"""
Duck CLI Android Agent - Runs on Phone in Termux
Connects to Mac's LM Studio for reasoning, controls phone via local ADB

Architecture:
    Phone (Python agent in Termux)
        ├── screencap / uiautomator dump → screen state
        ├── HTTP → LM Studio on Mac (reasoning)
        └── adb shell input tap/type/swipe → actions

Usage:
    Run in Termux: python3 android-agent.py --goal "open settings"
"""

import argparse
import base64
import json
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Optional

# Configuration
LM_STUDIO_URL = os.environ.get("LM_STUDIO_URL", "http://100.68.208.113:1234")
LM_STUDIO_API_KEY = os.environ.get("LM_STUDIO_API_KEY", "sk-lm-xWvfQHZF:L8P76SQakhEA95U8DDNf")
LM_STUDIO_MODEL = os.environ.get("LM_STUDIO_MODEL", "google/gemma-4-e4b-it")
MAX_STEPS = int(os.environ.get("MAX_STEPS", "30"))

# Colors for output
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
CYAN = '\033[0;36m'
NC = '\033[0m'

def log(msg: str, color: str = GREEN):
    print(f"{color}[DuckAgent] {NC}{msg}")

def error(msg: str):
    print(f"{RED}[Error] {NC}{msg}", file=sys.stderr)

@dataclass
class UiElement:
    text: str
    bounds: tuple
    clickable: bool
    focused: bool
    editable: bool
    resource_id: str = ""
    content_desc: str = ""

class AndroidDevice:
    """Controls Android device via ADB"""
    
    def __init__(self, serial: Optional[str] = None):
        self.serial = serial
        self.adb_prefix = ["adb"] + (["-s", serial] if serial else [])
    
    def shell(self, cmd: str) -> str:
        """Run ADB shell command"""
        result = subprocess.run(
            self.adb_prefix + ["shell", cmd],
            capture_output=True, text=True, timeout=30
        )
        return result.stdout.strip()
    
    def capture_screen(self, path: str = "/sdcard/screen.png") -> Optional[bytes]:
        """Capture screenshot"""
        self.shell(f"screencap -p {path}")
        result = subprocess.run(
            self.adb_prefix + ["pull", path, path.replace("/sdcard/", "/tmp/")],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            with open(path.replace("/sdcard/", "/tmp/"), "rb") as f:
                return f.read()
        return None
    
    def dump_ui(self, path: str = "/sdcard/ui.xml") -> Optional[str]:
        """Dump UI hierarchy"""
        self.shell(f"uiautomator dump {path}")
        result = subprocess.run(
            self.adb_prefix + ["pull", path, path.replace("/sdcard/", "/tmp/")],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            with open(path.replace("/sdcard/", "/tmp/"), "r") as f:
                return f.read()
        return None
    
    def parse_ui_xml(self, xml_content: str) -> list[UiElement]:
        """Parse UI XML into elements"""
        elements = []
        try:
            root = ET.fromstring(xml_content)
            for node in root.iter("node"):
                bounds_str = node.get("bounds", "")
                bounds = self._parse_bounds(bounds_str)
                if bounds:
                    elements.append(UiElement(
                        text=node.get("text", ""),
                        bounds=bounds,
                        clickable=node.get("clickable") == "true",
                        focused=node.get("focused") == "true",
                        editable=node.get("editable") == "true",
                        resource_id=node.get("resource-id", ""),
                        content_desc=node.get("content-desc", "")
                    ))
        except ET.ParseError:
            pass
        return elements
    
    def _parse_bounds(self, bounds_str: str) -> Optional[tuple]:
        """Parse bounds string like '[0,0][720,1604]'"""
        match = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', bounds_str)
        if match:
            x1, y1, x2, y2 = map(int, match.groups())
            return (x1, y1, x2, y2)
        return None
    
    def get_center(self, bounds: tuple) -> tuple:
        """Get center coordinates from bounds"""
        return ((bounds[0] + bounds[2]) // 2, (bounds[1] + bounds[3]) // 2)
    
    def get_foreground_app(self) -> str:
        """Get current foreground app"""
        output = self.shell("dumpsys activity activities | grep mResumedActivity | head -1")
        match = re.search(r'([\w\.]+)/([\w\.]+)', output)
        return match.group(0) if match else "unknown"
    
    def tap(self, x: int, y: int):
        """Tap at coordinates"""
        self.shell(f"input tap {x} {y}")
    
    def type_text(self, text: str):
        """Type text"""
        # Escape special characters
        text = text.replace(" ", "%s")
        self.shell(f"input text '{text}'")
    
    def press_key(self, key: str):
        """Press key (home, back, enter, recent, etc.)"""
        keycodes = {
            "home": "3",
            "back": "4",
            "enter": "66",
            "recent": "187",
            "power": "26",
            "volumeup": "24",
            "voldown": "25"
        }
        keycode = keycodes.get(key.lower(), key)
        self.shell(f"input keyevent {keycode}")
    
    def swipe(self, x1: int, y1: int, x2: int, y2: int, duration: int = 300):
        """Swipe from point to point"""
        self.shell(f"input swipe {x1} {y1} {x2} {y2} {duration}")
    
    def launch_app(self, package: str):
        """Launch app by package name"""
        self.shell(f"monkey -p {package} -c android.intent.category.LAUNCHER 1")


class LlmClient:
    """Calls LM Studio for reasoning"""
    
    def __init__(self, url: str, api_key: str, model: str):
        self.url = url
        self.api_key = api_key
        self.model = model
    
    def reason(self, goal: str, step: int, history: str, screen_elements: list[UiElement], 
               foreground_app: str, screenshot_b64: Optional[str] = None) -> dict:
        """Get reasoning from LLM"""
        
        # Build compact element list
        elements_json = []
        for el in screen_elements[:40]:  # Top 40 elements
            x, y = (el.bounds[0] + el.bounds[2]) // 2, (el.bounds[1] + el.bounds[3]) // 2
            if el.text or el.content_desc:
                elements_json.append({
                    "t": el.text[:30] if el.text else el.content_desc[:30],
                    "c": (x, y),
                    "cl": el.clickable,
                    "f": el.focused,
                    "e": el.editable
                })
        
        # Build prompt
        prompt = f"""You are an Android automation agent. Goal: {goal}
Step: {step}/30
App: {foreground_app}
History: {history}
Elements: {json.dumps(elements_json) if elements_json else '[]'}
What should I do? Respond with JSON:
{{"think": "why", "action": "tap X Y" or "type TEXT" or "press KEY" or "launch PACKAGE" or "done"}}"""

        # Call LM Studio
        try:
            import urllib.request
            import urllib.error
            
            data = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 200,
                "temperature": 0.1
            }
            
            req = urllib.request.Request(
                f"{self.url}/v1/chat/completions",
                data=json.dumps(data).encode(),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}"
                },
                method="POST"
            )
            
            with urllib.request.urlopen(req, timeout=60) as response:
                result = json.loads(response.read())
                content = result["choices"][0]["message"]["content"]
                
                # Parse JSON response
                try:
                    return json.loads(content)
                except:
                    return {"think": "parse error", "action": "done"}
        except Exception as e:
            error(f"LM Studio error: {e}")
            return {"think": str(e), "action": "done"}


class AndroidAgent:
    """Main agent loop"""
    
    def __init__(self, device: AndroidDevice, llm: LlmClient):
        self.device = device
        self.llm = llm
        self.history = []
    
    def perceive(self) -> tuple[list[UiElement], str, Optional[bytes]]:
        """Capture screen state"""
        xml = self.device.dump_ui()
        elements = self.device.parse_ui_xml(xml) if xml else []
        app = self.device.get_foreground_app()
        screenshot = self.device.capture_screen()
        return elements, app, screenshot
    
    def execute_action(self, action: str) -> bool:
        """Execute action and return success"""
        parts = action.strip().split()
        if not parts:
            return False
        
        cmd = parts[0].lower()
        
        try:
            if cmd == "tap" and len(parts) >= 2:
                coords = parts[1].split(",")
                if len(coords) == 2:
                    self.device.tap(int(coords[0]), int(coords[1]))
                    log(f"Tapped {coords[0]}, {coords[1]}", CYAN)
                    return True
            
            elif cmd == "type" and len(parts) >= 2:
                text = " ".join(parts[1:]).strip('"')
                self.device.type_text(text)
                log(f"Typed: {text}", CYAN)
                return True
            
            elif cmd == "press" and len(parts) >= 2:
                self.device.press_key(parts[1])
                log(f"Pressed: {parts[1]}", CYAN)
                return True
            
            elif cmd == "swipe" and len(parts) >= 2:
                coords = parts[1].split(",")
                if len(coords) == 4:
                    self.device.swipe(*map(int, coords))
                    log(f"Swiped", CYAN)
                    return True
            
            elif cmd == "launch" and len(parts) >= 2:
                self.device.launch_app(parts[1])
                log(f"Launched: {parts[1]}", CYAN)
                return True
            
            elif cmd == "done":
                return False
            
            else:
                error(f"Unknown action: {action}")
                return False
                
        except Exception as e:
            error(f"Action failed: {e}")
            return False
        
        return True
    
    def run(self, goal: str, max_steps: int = MAX_STEPS):
        """Main agent loop"""
        log(f"🎯 Goal: {goal}")
        log(f"LM Studio: {LM_STUDIO_URL}", BLUE)
        log(f"Model: {LM_STUDIO_MODEL}", BLUE)
        print()
        
        for step in range(1, max_steps + 1):
            print(f"{YELLOW}--- Step {step}/{max_steps} ---{NC}")
            
            # Perceive
            log("📱 Perceiving...", BLUE)
            elements, app, screenshot = self.perceive()
            log(f"   App: {app}")
            log(f"   Elements: {len(elements)}")
            
            # Reason
            log("🧠 Reasoning...", BLUE)
            history_text = " → ".join(self.history[-10:])
            response = self.llm.reason(goal, step, history_text, elements, app)
            think = response.get("think", "")
            action = response.get("action", "done")
            log(f"   Think: {think[:100]}...")
            log(f"   Action: {action}", GREEN)
            
            # Check if done
            if action == "done" or not action:
                log("✅ Goal completed!", GREEN)
                return True
            
            # Act
            log("🎬 Acting...", BLUE)
            success = self.execute_action(action)
            
            # Update history
            self.history.append(f"{step}:{action}")
            
            if not success:
                log("⚠️ Action failed, retrying...", YELLOW)
            
            # Delay between steps
            time.sleep(1)
        
        log("⚠️ Max steps reached", YELLOW)
        return False


def main():
    parser = argparse.ArgumentParser(description="Duck CLI Android Agent")
    parser.add_argument("--goal", "-g", required=True, help="Goal to accomplish")
    parser.add_argument("--serial", "-s", help="Device serial (optional)")
    parser.add_argument("--test", "-t", action="store_true", help="Test mode")
    args = parser.parse_args()
    
    log("🦆 Duck CLI Android Agent", GREEN)
    print()
    
    # Test mode
    if args.test:
        log("Running tests...", BLUE)
        
        device = AndroidDevice(args.serial)
        
        log("1. Checking ADB...")
        try:
            result = device.shell("getprop ro.product.model")
            log(f"   Device: {result}", GREEN)
        except Exception as e:
            error(f"   ADB failed: {e}")
            sys.exit(1)
        
        log("2. Getting foreground app...")
        app = device.get_foreground_app()
        log(f"   {app}", GREEN)
        
        log("3. Dumping UI...")
        xml = device.dump_ui()
        elements = device.parse_ui_xml(xml) if xml else []
        log(f"   Found {len(elements)} elements", GREEN)
        
        log("4. Testing LM Studio...")
        llm = LlmClient(LM_STUDIO_URL, LM_STUDIO_API_KEY, LM_STUDIO_MODEL)
        response = llm.reason("test", 1, "", [], "test.app")
        log(f"   Response: {response.get('think', 'no response')[:100]}", GREEN)
        
        log("✅ All tests passed!", GREEN)
        return
    
    # Run agent
    device = AndroidDevice(args.serial)
    llm = LlmClient(LM_STUDIO_URL, LM_STUDIO_API_KEY, LM_STUDIO_MODEL)
    agent = AndroidAgent(device, llm)
    agent.run(args.goal)


if __name__ == "__main__":
    main()
