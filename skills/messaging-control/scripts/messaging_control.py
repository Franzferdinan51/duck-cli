#!/usr/bin/env python3
"""Messages.app helper for finding, reading, and replying to chats."""

from __future__ import annotations

import argparse
import subprocess
from textwrap import dedent


def run_applescript(script: str) -> str:
    proc = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    if proc.returncode != 0:
        raise SystemExit(proc.stderr.strip() or proc.stdout.strip() or "osascript failed")
    return proc.stdout.strip()


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def list_chats() -> str:
    script = dedent('''
    tell application "Messages"
      set out to ""
      repeat with c in chats
        try
          set out to out & (name of c as text) & linefeed
        end try
      end repeat
      return out
    end tell
    ''')
    return run_applescript(script)


def find_chat(query: str) -> str:
    script = dedent(f'''
    tell application "Messages"
      set queryText to "{esc(query)}"
      repeat with c in chats
        try
          set n to name of c as text
          if n contains queryText or queryText contains n then return id of c as text
        end try
      end repeat
      return ""
    end tell
    ''')
    return run_applescript(script)


def latest_message(chat_id: str) -> str:
    script = dedent(f'''
    tell application "Messages"
      set c to first chat whose id is "{esc(chat_id)}"
      if (count of messages of c) = 0 then return ""
      set m to item -1 of messages of c
      return content of m as text
    end tell
    ''')
    return run_applescript(script)


def send_message(chat_id: str, message: str) -> None:
    script = dedent(f'''
    tell application "Messages"
      set c to first chat whose id is "{esc(chat_id)}"
      send "{esc(message)}" to c
    end tell
    ''')
    run_applescript(script)


def main() -> int:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list")

    f = sub.add_parser("find")
    f.add_argument("query")

    r = sub.add_parser("read")
    r.add_argument("query")

    s = sub.add_parser("send")
    s.add_argument("query")
    s.add_argument("message")

    args = p.parse_args()

    if args.cmd == "list":
      print(list_chats())
      return 0
    if args.cmd == "find":
      print(find_chat(args.query))
      return 0
    if args.cmd == "read":
      chat_id = find_chat(args.query)
      print(latest_message(chat_id) if chat_id else "", end="")
      return 0
    if args.cmd == "send":
      chat_id = find_chat(args.query)
      if not chat_id:
          raise SystemExit(f"No chat found for {args.query!r}")
      send_message(chat_id, args.message)
      print("sent")
      return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
