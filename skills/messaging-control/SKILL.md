---
name: messaging-control
description: Send or manage iMessage/SMS conversations on the Mac using the Messages app with Desktop Control. Use when the user asks to text, DM, reply, or send a message to anyone, including phrases like text [name], send a message, iMessage, SMS, or Messages app tasks that need contact search or manual UI navigation.
---

# Messaging Control

Use the Messages app on macOS to send texts to any recipient.

## Workflow

1. Open Messages.
2. Find the contact or conversation.
3. Compose the exact message.
4. Send it.
5. Confirm success to the user.

## Guardrails

- Verify the recipient before sending.
- Preserve the user's requested wording and signature.
- If Messages is not available or the contact is ambiguous, ask for clarification.

## Notes

- Prefer Desktop Control for the GUI path.
- Keep the interaction concise and explicit.
- For repeated patterns, add helper scripts under `scripts/`.

## Helper Script

- `scripts/send_message.sh`: send a message by recipient + text.
