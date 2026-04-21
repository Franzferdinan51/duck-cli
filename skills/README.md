# Duck CLI Skills

## Available Skills

### Desktop Control Skills

These skills are integrated from:
- `/Users/duckets/Desktop/desktop-control-lobster-edition-skill/`
- `~/.openclaw/workspace/skills/clawd-cursor/`
- `~/.openclaw/workspace/skills/computer-use/`

### Skill: desktop-control-lobster

AI Desktop Agent - Autonomous automation for:
- Drawing in MS Paint
- Text entry in Notepad
- Application launching
- Game playing

### Skill: clawd-cursor

AI desktop agent - control any app via REST API:
- Natural language tasks
- Screenshot analysis
- Click, type, drag operations
- Works on macOS/Windows

### Skill: computer-use

General computer automation:
- Browser control
- Desktop app automation
- Cross-app workflows

### Skill: claude-code-mastery

Employee-grade Claude Code overrides:
- Forced verification (tsc + eslint)
- Context decay awareness
- Sub-agent swarming
- File read chunking


### Skill: agent-mesh (v4)

Distributed agent communication mesh — enables agents to register, discover each other, and exchange messages across a mesh network.

- Agent registration + discovery
- Real-time WebSocket messaging
- Task handoffs between agents
- Federated mesh networking

### Skill: agent-council

AI Council deliberation integration — routes complex decisions to the multi-model council at port 3003.

- Complexity scoring (1-10)
- Routes to standard or multi deliberation mode
- Returns verdict + reasoning
- Shared with AgentTeams

## Usage

Skills are loaded from the `skills/` directory. Each skill contains:
- `SKILL.md` - Skill definition
- Supporting files

## Custom Skills

Add skills to `~/.duck/skills/` or `./skills/` directory.
