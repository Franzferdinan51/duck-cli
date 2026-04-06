#!/usr/bin/env python3
"""
Duck CLI Telegram Bot - PTY streaming version.
Uses a pseudo-terminal for unbuffered streaming output.
Sends thinking message immediately, then streams duck output in real-time.
"""
import os
import sys
import json
import time
import signal
import subprocess
import urllib.request
import urllib.error
import pty
import select
import re

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8296473333:AAENFYdpNdQEegzIWIY-tZHq6SAULm9nzHQ")
CHAT_ID = "588090613"
DUCK_CLI = os.environ.get("DUCK_CLI_PATH", "/Users/duckets/.openclaw/workspace/duck-cli-src/duck")
UPDATE_FILE = "/tmp/telegram_update_id.txt"
MAX_MSG = 3500


def ansi_strip(text):
    """Remove ANSI escape sequences from text."""
    return re.sub(r'\x1b\[[^\x07\x1b]*m', '', text)


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
    """Escape HTML special chars."""
    return (text
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "&#10;"))


def send_voice_message(file_path, chat_id=CHAT_ID, caption=None, reply_to=None):
    """Send an audio file as a Telegram voice message."""
    import re
    
    if not os.path.exists(file_path):
        print(f"⚠️  Voice file not found: {file_path}")
        return False
    
    boundary = f"----DuckCLIBoundary{os.getpid()}{int(time.time() * 1000)}"
    file_data = open(file_path, 'rb').read()
    filename = os.path.basename(file_path)

    body = f"--{boundary}\r\n"
    body += f"Content-Disposition: form-data; name=\"chat_id\"\r\n\r\n{chat_id}\r\n"
    if reply_to:
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"reply_to_message_id\"\r\n\r\n{reply_to}\r\n"
    if caption:
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"caption\"\r\n\r\n{escape(caption)}\r\n"
    body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"voice\"; filename=\"{filename}\"\r\nContent-Type: audio/mpeg\r\n\r\n"

    body_start = body.encode('utf-8')
    body_end = f"\r\n--{boundary}--\r\n".encode('utf-8')
    full_body = body_start + file_data + body_end

    options = {
        'hostname': 'api.telegram.org',
        'path': f'/bot{BOT_TOKEN}/sendVoice',
        'method': 'POST',
        'headers': {
            'Content-Type': f'multipart/form-data; boundary={boundary}',
            'Content-Length': str(len(full_body)),
        },
    }

    try:
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{BOT_TOKEN}/sendVoice",
            data=full_body,
            headers=options['headers'],
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            if result.get('ok'):
                print(f"📤 Sent voice message: {file_path}")
                return True
            else:
                print(f"❌ sendVoice failed: {result.get('description', 'unknown error')}")
                return False
    except Exception as e:
        print(f"❌ sendVoice error: {e}")
        return False


def duck_stream(message, chat_id, reply_to_msg_id):
    """
    Run duck with PTY for unbuffered streaming output.
    Sends '🦆 thinking...' immediately, then streams each chunk to Telegram.
    """
    # Send thinking message immediately
    send_message("🦆 <i>thinking...</i>", chat_id=chat_id, reply_to=reply_to_msg_id)

    chunk_buf = []
    last_send = time.time()
    # Track processed audio files to avoid sending the same one twice
    processed_audio = set()

    def flush_chunk():
        nonlocal chunk_buf, last_send
        if not chunk_buf:
            return
        # Filter non-empty and strip ANSI
        lines_out = []
        audio_markers = []
        for l in chunk_buf:
            l = ansi_strip(l).strip()
            if not l or "thinking..." in l:
                continue
            # Detect [AUDIO:filepath] markers and extract them
            audio_pattern = re.compile(r'\[AUDIO:([^\]]+)\]')
            for match in audio_pattern.finditer(l):
                filepath = match.group(1)
                if filepath and filepath not in processed_audio:
                    audio_markers.append(filepath)
                    processed_audio.add(filepath)
            # Remove [AUDIO:...] from the line for display
            clean_line = audio_pattern.sub('', l).strip()
            if clean_line:
                lines_out.append(clean_line)
        # Send voice messages for any detected audio markers
        for filepath in audio_markers:
            send_voice_message(filepath, chat_id=chat_id, reply_to=reply_to_msg_id)
        if not lines_out:
            chunk_buf = []
            return
        # Take last 10 lines
        text = '\n'.join(lines_out[-10:])
        safe = escape(text[:MAX_MSG])
        send_message(safe, chat_id=chat_id, reply_to=reply_to_msg_id)
        chunk_buf = []
        last_send = time.time()

    try:
        # Use PTY for unbuffered output
        pid, fd = pty.fork()
        if pid == 0:
            # Child: run duck
            os.environ["DUCK_SOURCE_DIR"] = os.path.dirname(DUCK_CLI)
            os.environ["DUCK_BOT_MODE"] = "1"
            os.execv(DUCK_CLI, [DUCK_CLI, "run", message])
            os._exit(1)

        buf = ""
        start = time.time()
        timeout = 300  # 5 min max

        while True:
            elapsed = time.time() - start
            if elapsed > timeout:
                flush_chunk()
                send_message("⏱️ Timed out after 5 min", chat_id=chat_id, reply_to=reply_to_msg_id)
                break

            try:
                ready, _, _ = select.select([fd], [], [], min(1.0, timeout - elapsed))
                if ready:
                    data = os.read(fd, 4096)
                    if not data:
                        break
                    buf += data.decode('utf-8', errors='replace')
                    # Stream complete lines
                    while '\n' in buf:
                        line, buf = buf.split('\n', 1)
                        chunk_buf.append(line + '\n')
                        if len(chunk_buf) >= 8 or (time.time() - last_send) > 5:
                            flush_chunk()
                else:
                    # Timeout - flush any buffered content
                    if buf.strip():
                        chunk_buf.append(buf)
                        buf = ""
                        flush_chunk()
                    elif time.time() - last_send > 5:
                        flush_chunk()

            except OSError:
                break

        # Flush remaining buffer
        if buf.strip():
            chunk_buf.append(buf)
        flush_chunk()

        # Clean up child
        try:
            os.close(fd)
        except:
            pass
        try:
            os.kill(pid, 9)
        except:
            pass

    except Exception as e:
        send_message(f"❌ Error: {e}", chat_id=chat_id, reply_to=reply_to_msg_id)


def main():
    print(f"🦆 Telegram Bot starting (PTY streaming mode)...")
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
            result = api("getUpdates", {
                "offset": offset,
                "limit": 5,
                "allowed_updates": ["message"]
            })

            if not result.get("ok"):
                if poll_count % 30 == 0:
                    print(f"⚠️  API error: {result.get('error', 'unknown')}")
                time.sleep(2)
                poll_count += 1
                continue

            updates = result.get("result", [])
            if not updates:
                poll_count += 1
                if poll_count % 30 == 0:
                    print(f"  ⏳ polling... (offset {offset})")
                    sys.stdout.flush()
                time.sleep(2)
                continue

            poll_count = 0

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

                # Stream response using PTY
                duck_stream(text, chat_id, msg_id)

                # Update offset
                offset = u["update_id"] + 1
                try:
                    open(UPDATE_FILE, "w").write(str(offset))
                except:
                    pass

                print(f"   ✅ Done")
                sys.stdout.flush()

        except KeyboardInterrupt:
            print("\n🦆 Bot stopped.")
            break
        except Exception as e:
            print(f"⚠️  Error: {e}")
            sys.stdout.flush()
            time.sleep(2)


if __name__ == "__main__":
    main()
