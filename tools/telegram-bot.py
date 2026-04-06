#!/usr/bin/env python3
"""
Duck CLI Telegram Bot - Simple short polling version.
No long polling, no timeouts. Just poll every 2 seconds.
"""
import os
import sys
import json
import time
import subprocess
import urllib.request
import urllib.error

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8296473333:AAENFYdpNdQEegzIWIY-tZHq6SAULm9nzHQ")
CHAT_ID = "588090613"
DUCK_CLI = os.environ.get("DUCK_CLI_PATH", "/Users/duckets/.openclaw/workspace/duck-cli-src/duck")
UPDATE_FILE = "/tmp/telegram_update_id.txt"

def api(method, data=None):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    body = json.dumps(data or {}).encode() if data else None
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": f"HTTP {e.code}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def send_message(text, chat_id=CHAT_ID, reply_to=None):
    data = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_to:
        data["reply_to_message_id"] = reply_to
    result = api("sendMessage", data)
    return result.get("ok", False)

def escape(text):
    return (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))

def duck_run(message):
    try:
        result = subprocess.run(
            [DUCK_CLI, "run", message],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=os.path.dirname(DUCK_CLI),
            env={**os.environ, "DUCK_SOURCE_DIR": os.path.dirname(DUCK_CLI),
                "PATH": os.environ.get("PATH","") + ":/usr/local/bin:/opt/homebrew/bin:/opt/local/bin"}
        )
        out = result.stdout.strip() or result.stderr.strip() or "(no output)"
        return out[-4000:]  # last 4000 chars
    except subprocess.TimeoutExpired:
        return "⏱️ Timed out after 120s"
    except FileNotFoundError:
        return f"❌ duck not found at {DUCK_CLI}"
    except Exception as e:
        return f"❌ Error: {e}"

def main():
    print(f"🦆 Bot starting...")
    print(f"   Duck: {DUCK_CLI}")
    
    # Load offset
    offset = 1
    if os.path.exists(UPDATE_FILE):
        try:
            offset = int(open(UPDATE_FILE).read().strip())
        except:
            offset = 1
    
    print(f"   Starting from offset {offset}")
    print(f"   Polling every 2s...\n")
    sys.stdout.flush()
    
    poll_count = 0
    while True:
        try:
            # Short poll - no timeout parameter
            result = api("getUpdates", {
                "offset": offset,
                "limit": 5,
                "allowed_updates": ["message"]
            })
            
            if not result.get("ok"):
                if poll_count % 30 == 0:  # log every minute
                    print(f"⚠️  API error: {result.get('error', 'unknown')}")
                time.sleep(2)
                poll_count += 1
                continue
            
            updates = result.get("result", [])
            if updates:
                for u in updates:
                    msg = u.get("message", {})
                    if not msg:
                        continue
                    
                    chat_id = str(msg["chat"]["id"])
                    if chat_id != CHAT_ID:
                        continue
                    
                    text = msg.get("text", "").strip()
                    if not text:
                        continue
                    
                    msg_id = msg["message_id"]
                    first = msg.get("from", {}).get("first_name", "friend")
                    
                    print(f"📩 {first}: {text[:60]}")
                    sys.stdout.flush()
                    
                    # Send typing action
                    api("sendChatAction", {"chat_id": chat_id, "action": "typing"})
                    
                    # Process
                    response = duck_run(text)
                    
                    # Reply
                    chunks = [response[i:i+3500] for i in range(0, len(response), 3500)]
                    for i, chunk in enumerate(chunks):
                        reply_to = msg_id if i == 0 else None
                        ok = send_message(escape(chunk), chat_id=chat_id, reply_to=reply_to)
                        if not ok and i == 0:
                            print(f"   ❌ Failed to send reply")
                    
                    print(f"   ✅ Replied ({len(chunks)} part(s))")
                    sys.stdout.flush()
                    
                    # Update offset
                    offset = u["update_id"] + 1
                    try:
                        open(UPDATE_FILE, "w").write(str(offset))
                    except:
                        pass
            else:
                poll_count += 1
                if poll_count % 30 == 0:
                    print(f"  ⏳ polling... (offset {offset})")
                    sys.stdout.flush()
            
            time.sleep(2)
            
        except KeyboardInterrupt:
            print("\n🛑 Stopped")
            break
        except Exception as e:
            print(f"⚠️  Error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
