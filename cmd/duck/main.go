package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/joho/godotenv"
	"github.com/spf13/cobra"
)

var (
	version = "0.4.0"

	// Styles
	brandStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FFD700")).
			Bold(true)
	dimStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#888888"))
	successStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#50FA7B"))
	errorStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FF5555"))

	// Global flags
	flagProvider string
	flagPriority string
	flagModel    string
)

func main() {
	// Auto-load .env from: (1) exe dir, (2) ~/.duck-cli/env, (3) CWD
	exePath, _ := filepath.Abs(os.Args[0])
	exeDir := filepath.Dir(exePath)
	for _, p := range []string{
		filepath.Join(exeDir, ".env"),
		filepath.Join(os.Getenv("HOME"), ".duck-cli", "env"),
		".env",
	} {
		if err := godotenv.Load(p); err == nil {
			break
		}
	}

	if !checkNode() {
		fmt.Println(errorStyle.Render("✗ Node.js not found. Duck CLI requires Node.js 20+"))
		fmt.Println(dimStyle.Render("  Install: https://nodejs.org"))
		os.Exit(1)
	}

	rootCmd := &cobra.Command{
		Use:   "duck",
		Short: "🦆 The ultimate AI coding agent",
		Long: `
Duck CLI — Unified super agent combining OpenClaw infrastructure,
Hermes-Agent self-improvement, NeMoClaw security, and Kimi k2p5.

Features:
  • Multi-provider AI (Kimi k2p5, MiniMax M2.7, OpenRouter, LM Studio, ChatGPT)
  • Smart router with auto-failover
  • ACP protocol for parallel sub-agents
  • MCP server + Gateway API
  • KAIROS proactive AI
  • Sub-Conscious self-reflection
  • AI Council (45 councilors)
  • Agent Mesh networking
  • DEFCON security mode
  • Desktop UI + Web UI`,
		Version: version,
	}

	// Global flags
	rootCmd.PersistentFlags().StringVarP(&flagProvider, "provider", "p", "", "AI provider (kimi|minimax|openrouter|lmstudio|anthropic|openai)")
	rootCmd.PersistentFlags().StringVarP(&flagModel, "model", "m", "", "Specific model")
	rootCmd.PersistentFlags().StringVarP(&flagPriority, "priority", "", "", "Provider chain (e.g. kimi,minimax,openrouter)")
	rootCmd.PersistentFlags().BoolP("verbose", "v", false, "Verbose output")

	// All commands
	rootCmd.AddCommand(
		runCmd(),
		shellCmd(),
		agentCmd(),
		mcpCmd(),
		skillsCmd(),
		securityCmd(),
		statusCmd(),
		councilCmd(),
		workflowCmd(),
		androidCmd(),
		flowCmd(),
		unifiedCmd(),
		gatewayCmd(),
		webCmd(),
		kairosCmd(),
		subconsciousCmd(),
		cronCmd(),
		buddyCmd(),
		providersCmd(),
		teamCmd(),
		meshCmd(),

	metaCmd(),		meshdCmd(),
		rlCmd(),
		acpServerCmd(),
		acpSpawnCmd(),
		updateCmd(),
		syncCmd(),
		voiceCmd(),
		speakCmd(),
		channelsCmd(),
		clawhubCmd(),
		soulsCmd(),
		desktopCmd(),
		memoryCmd(),
		thinkCmd(),
		doctorCmd(),
		healthCmd(),
		statsCmd(),
		configCmd(),
		traceCmd(),
		toolsCmd(),
	)

	// No args → start interactive shell (standalone mode for humans)
	rootCmd.Run = func(cmd *cobra.Command, args []string) {
		runNode("shell")
	}

	rootCmd.AddCommand(setupCmd())

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(errorStyle.Render("Error: ") + err.Error())
		os.Exit(1)
	}
}

func checkNode() bool {
	// Check common Node.js locations (LookPath alone may fail in minimal PATH from systemd/Telegram)
	nodePaths := []string{
		"/usr/local/bin/node",
		"/usr/bin/node",
		"/opt/homebrew/bin/node",
		"/opt/bin/node",
		filepath.Join(os.Getenv("HOME"), ".nvm/versions/node/", os.Getenv("NODE_VERSION"), "bin/node"),
	}
	for _, p := range nodePaths {
		if _, err := os.Stat(p); err == nil {
			return true
		}
	}
	// Also try LookPath as fallback
	_, err := exec.LookPath("node")
	return err == nil
}

// runCmd - duck run "task"
func runCmd() *cobra.Command {
	var interactive bool
	var prompt string
	cmd := &cobra.Command{
		Use:   "run [prompt]",
		Short: "Run a task with Duck CLI (auto-routes through smart provider chain)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) > 0 {
				prompt = args[0]
			}
			script := buildRunScript(prompt, interactive)
			return runNodeWithEnv(script, cmd)
		},
	}
	cmd.Flags().BoolVarP(&interactive, "interactive", "i", false, "Interactive mode")
	return cmd
}

// shellCmd - duck shell
// setupCmd - Interactive first-run setup wizard
func setupCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "setup",
		Short: "[32m[1m🦆[0m Configure API keys and settings",
		Long:  "Interactive setup wizard - configure API keys for MiniMax, OpenRouter, Kimi",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNode("setup")
		},
	}
}

func shellCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "shell",
		Short: "Start Duck CLI interactive TUI shell",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("shell", cmd)
		},
	}
}

// unifiedCmd - duck unified (all protocols)
func unifiedCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "unified",
		Short: "Start all protocols: MCP (3850) + ACP (18794) + WS (18796) + Gateway (18792)",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("unified", cmd)
		},
	}
}

// gatewayCmd - duck gateway
func gatewayCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "gateway",
		Short: "Start Duck Gateway API (port 18792)",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("gateway", cmd)
		},
	}
}

// webCmd - duck web
func webCmd() *cobra.Command {
	var port int
	cmd := &cobra.Command{
		Use:   "web [port]",
		Short: "Start Duck Web UI (default port 3001)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) > 0 {
				fmt.Sscanf(args[0], "%d", &port)
			}
			if port > 0 {
				return runNodeWithEnv("web "+fmt.Sprintf("%d", port), cmd)
			}
			return runNodeWithEnv("web", cmd)
		},
	}
	cmd.Flags().IntVar(&port, "port", 3001, "Web UI port")
	return cmd
}

// kairosCmd - duck kairos [mode]
func kairosCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "kairos [mode]",
		Short: "KAIROS proactive AI control (aggressive|balanced|conservative|enable|disable|status)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("kairos status", cmd)
			}
			return runNodeWithEnv("kairos "+args[0], cmd)
		},
	}
	return cmd
}

// subconsciousCmd - duck subconscious [cmd]
func subconsciousCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "subconscious [cmd] [args...]",
		Short: "Sub-Conscious control (daemon|status|stats|whisper|recall|council|reset)",
		Args:  cobra.MinimumNArgs(0),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("subconscious status", cmd)
			}
			return runNodeWithEnv("subconscious "+strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// cronCmd - duck cron [action]
func cronCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "cron [action]",
		Short: "Cron automation (list|enable|disable|run)",
		Args:  cobra.MaximumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("cron "+strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// buddyCmd - duck buddy [action]
func buddyCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "buddy [action]",
		Short: "Buddy companion (hatch|list|stats|reroll)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("buddy list", cmd)
			}
			return runNodeWithEnv("buddy "+args[0], cmd)
		},
	}
	return cmd
}

// teamCmd - duck team [action]
func teamCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "team [action]",
		Short: "Multi-agent teams (create|spawn|status|list)",
		Args:  cobra.MaximumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("team "+strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// metaCmd - duck meta [plan|run|learnings]
func metaCmd() *cobra.Command {
	metaCmd := &cobra.Command{
		Use:   "meta",
		Short: "🦆 duck-cli v3 Meta-Agent (LLM-powered orchestration)",
		Long:  "Plan, execute, and learn from tasks with the Meta-Agent loop.",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Pass args as: ["meta", "subcmd", "task part1 part2"]
			// Node: argv[2]="meta", argv[3]="subcmd", argv[4]="task part1 part2"
			// main(): command="meta", args=["subcmd", "task part1 part2"]
			nodeArgs := []string{"meta"}
			if len(args) > 0 {
				if len(args) > 1 {
					// First arg = subcommand, rest joined as single string for task
					nodeArgs = append(nodeArgs, args[0], strings.Join(args[1:], " "))
				} else {
					nodeArgs = append(nodeArgs, args[0])
				}
			}
			return runNodeDirectMulti(nodeArgs, cmd)
		},
	}
	return metaCmd
}

// providersCmd - duck providers [list]
func providersCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "providers",
		Short: "Show available AI providers",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("providers " + strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// meshCmd - duck mesh [action]
func meshCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "mesh [action]",
		Short: "Agent Mesh networking (register|list|send|broadcast|inbox|capabilities)",
		Args:  cobra.MinimumNArgs(0),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("mesh status", cmd)
			}
			return runNodeWithEnv("mesh "+strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// meshdCmd - duck meshd [port]
func meshdCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "meshd [port]",
		Short: "Start built-in mesh server daemon (default port 4000)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("meshd", cmd)
			}
			return runNodeWithEnv("meshd "+args[0], cmd)
		},
	}
	return cmd
}

// rlCmd - duck rl [action]
func rlCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "rl [action]",
		Short: "OpenClaw-RL self-improvement (connect|enable|disable|status|stats)",
		Args:  cobra.MaximumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("rl "+strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// acpServerCmd - duck acp-server
func acpServerCmd() *cobra.Command {
	var port int
	cmd := &cobra.Command{
		Use:   "acp-server [port]",
		Short: "Start ACP Server (default port 18794)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) > 0 {
				fmt.Sscanf(args[0], "%d", &port)
				return runNodeWithEnv(fmt.Sprintf("acp-server %d", port), cmd)
			}
			return runNodeWithEnv("acp-server", cmd)
		},
	}
	cmd.Flags().IntVar(&port, "port", 18794, "ACP server port")
	return cmd
}

// acpSpawnCmd - duck acp <agent> [task]
func acpSpawnCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "acp <agent> [task]",
		Short: "Spawn an ACP agent (codex|claude|pi|gemini)",
		Args:  cobra.RangeArgs(1, 2),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 1 {
				return runNodeWithEnv("acp "+args[0], cmd)
			}
			return runNodeWithEnv("acp "+args[0]+" "+args[1], cmd)
		},
	}
	return cmd
}

// updateCmd - duck update [action]
func updateCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "update [action]",
		Short: "Update Duck CLI (check|install|backup|restore)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("update check", cmd)
			}
			return runNodeWithEnv("update "+args[0], cmd)
		},
	}
	return cmd
}

// syncCmd - duck sync [action] - File watching, upstream syncing, OpenClaw tandem
func syncCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "sync [action] [args]",
		Short: "🦆 Sync & watch (watch|status|openclaw|github|tandem)",
		Args:  cobra.MaximumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println("DEBUG: syncCmd called with args:", args)
			if len(args) == 0 {
				return runNodeWithEnv("sync status", cmd)
			}
			sub := args[0]
			rest := ""
			if len(args) > 1 {
				rest = " " + strings.Join(args[1:], " ")
			}
			return runNodeWithEnv("sync "+sub+rest, cmd)
		},
	}
	return cmd
}

// agentCmd - duck agent
func agentCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "agent",
		Short: "Manage agents and sub-agents",
	}
	cmd.AddCommand(&cobra.Command{
		Use:   "list",
		Short: "List active agents",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNode("agent-list")
		},
	})
	cmd.AddCommand(&cobra.Command{
		Use:   "spawn <name> <task>",
		Short: "Spawn a new agent",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNode("agent-spawn", args[0], args[1])
		},
	})
	return cmd
}

// mcpCmd - duck mcp
func mcpCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "mcp [port]",
		Short: "Start MCP server (default port 3850)",
		Long:  "Start MCP server. Use --stdio for LM Studio/Claude Desktop compatibility.",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			stdioFlag, _ := cmd.Flags().GetBool("stdio")
			if stdioFlag {
				return runNodeWithEnv("mcp --stdio", cmd)
			}
			if len(args) > 0 {
				return runNodeWithEnv("mcp-server "+args[0], cmd)
			}
			return runNodeWithEnv("mcp-server", cmd)
		},
	}
	cmd.Flags().BoolP("stdio", "s", false, "Use stdio transport (for LM Studio, Claude Desktop)")
	return cmd
}

// skillsCmd - duck skills
func skillsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "skills [action]",
		Short: "Skills marketplace (list|search|install|info|update|uninstall)",
		Args:  cobra.MaximumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNode("skills-list")
			}
			return runNode("skills-"+strings.Join(args, "-"))
		},
	}
	return cmd
}

// securityCmd - duck security
func securityCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "security [action]",
		Short: "Security operations (audit|defcon)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 || args[0] == "audit" {
				return runNode("security-audit")
			}
			return runNode("security-defcon")
		},
	}
	return cmd
}

// statusCmd - duck status
func statusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show Duck CLI status",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNode("status")
		},
	}
}

// councilCmd - duck council
func councilCmd() *cobra.Command {
	var mode string
	cmd := &cobra.Command{
		Use:   "council <question>",
		Short: "Ask the AI Council (45 deliberative agents)",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			m := mode
			if m == "" {
				m = "decision"
			}
			return runNodeWithEnv("council " + m + " " + strings.Join(args, " "), cmd)
		},
	}
	cmd.Flags().StringVar(&mode, "mode", "decision", "Mode: decision|research|prediction|swarm")
	return cmd
}

// workflowCmd - duck workflow <file> [--flow]
func workflowCmd() *cobra.Command {
	var flowFlag bool
	cmd := &cobra.Command{
		Use:   "workflow <file> [--flow]",
		Short: "Execute a JSON workflow or YAML flow (DroidClaw-style)",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			wfType := "workflow"
			if flowFlag {
				wfType = "flow"
			}
			return runNodeWithEnv(wfType + " " + args[0], cmd)
		},
	}
	cmd.Flags().BoolVar(&flowFlag, "flow", false, "Run as deterministic YAML flow (no LLM)")
	return cmd
}

// flowCmd - duck flow <json-file-or-definition> [start-node]
// ACPX-style TypeScript flow graph runner
// Also handles: duck flow list, duck flow replay <run-id>, duck flow cancel <flow-name>
func flowCmd() *cobra.Command {
	var flowFlag bool
	listCmd := &cobra.Command{
		Use:   "list",
		Short: "List all flow runs in ~/.duck/flows/runs/",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("flow_list", cmd)
		},
	}
	replayCmd := &cobra.Command{
		Use:   "replay <run-id>",
		Short: "Replay a flow run from its trace bundle",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			payload := fmt.Sprintf(`{"recordId":"%s"}`, args[0])
			return runNodeWithEnv("flow_replay "+payload, cmd)
		},
	}
	cancelCmd := &cobra.Command{
		Use:   "cancel <flow-name>",
		Short: "Cancel a running flow",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			payload := fmt.Sprintf(`{"flowName":"%s"}`, args[0])
			return runNodeWithEnv("flow_cancel "+payload, cmd)
		},
	}
	streamsCmd := &cobra.Command{
		Use:   "streams",
		Short: "List NDJSON session streams (~/.duck/sessions/)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("session_stream_list", cmd)
		},
	}

	cmd := &cobra.Command{
		Use:   "flow [file-or-subcommand] [args]",
		Short: "Execute or manage ACPX-style flow graphs",
		Long: `ACPX-style Flow Graph Runner

Commands:
  duck flow <file.json> [start-node]   Execute a JSON/TS flow file
  duck flow list                        List all flow runs (~/.duck/flows/runs/)
  duck flow replay <run-id>             Replay a flow run from trace bundle
  duck flow cancel <flow-name>          Cancel a running flow
  duck flow streams                      List session streams (~/.duck/sessions/)

Flow Node Types: acp, action, compute, checkpoint
Flow Outcomes: ok | timed_out | failed | cancelled

Example flow JSON:
{
  "name": "my-flow",
  "nodes": {
    "start": { "kind": "action", "config": { "shell": "echo hi" } }
  },
  "edges": [
    { "from": "start", "condition": { "type": "always", "to": "end" } }
  ]
}`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return cmd.Help()
			}
			sub := args[0]
			switch sub {
			case "list":
				return runNodeWithEnv("flow_list", cmd)
			case "streams":
				return runNodeWithEnv("session_stream_list", cmd)
			case "replay":
				if len(args) < 2 {
					return fmt.Errorf("Usage: duck flow replay <run-id>")
				}
				payload := fmt.Sprintf(`{"recordId":"%s"}`, args[1])
				return runNodeWithEnv("flow_replay "+payload, cmd)
			case "cancel":
				if len(args) < 2 {
					return fmt.Errorf("Usage: duck flow cancel <flow-name>")
				}
				payload := fmt.Sprintf(`{"flowName":"%s"}`, args[1])
				return runNodeWithEnv("flow_cancel "+payload, cmd)
			}
			// Not a subcommand — treat as file path or inline JSON
			definition := args[0]
			if _, err := os.Stat(definition); err == nil {
				data, err := os.ReadFile(definition)
				if err != nil {
					return fmt.Errorf("cannot read flow file: %v", err)
				}
				definition = string(data)
			}
			startNode := ""
			if len(args) > 1 {
				startNode = args[1]
			}
			payload := fmt.Sprintf(`{"definition":%s,"startNode":"%s"}`, definition, startNode)
			return runNodeWithEnv("flow_ts "+payload, cmd)
		},
	}
	cmd.Flags().BoolVar(&flowFlag, "flow", false, "Run as deterministic YAML flow (no LLM)")
	cmd.AddCommand(listCmd, replayCmd, cancelCmd, streamsCmd)
	return cmd
}

// runNode executes the TypeScript agent
// healthCmd - duck health
func healthCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "health",
		Short: "Check system health (Gateway, MiniMax, Android, LM Studio)",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("health", cmd)
		},
	}
}

// statsCmd - duck stats
func statsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "stats [reset|json|export]",
		Short: "Show usage statistics (runs, success rate, token usage)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("stats", cmd)
			}
			return runNodeWithEnv("stats "+args[0], cmd)
		},
	}
}

// configCmd - duck config [get|set|list|reset]
func configCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "config [get|set|list|reset] [key] [value]",
		Short: "Manage Duck CLI configuration",
		Args:  cobra.MinimumNArgs(0),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("config list", cmd)
			}
			return runNodeWithEnv("config "+strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// traceCmd - duck trace [list|show|delete|clear]
func traceCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "trace [list|show|delete|clear] [id]",
		Short: "View execution traces (enable with DUCK_TRACE=1)",
		Args:  cobra.MinimumNArgs(0),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("trace list", cmd)
			}
			return runNodeWithEnv("trace "+strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// toolsCmd - duck tools [list|schema|search|categories|mcp]
func toolsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "tools [list|schema|search|categories|mcp] [args...]",
		Short: "List and search tool registry with JSON schemas",
		Args:  cobra.MinimumNArgs(0),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("tools", cmd)
			}
			return runNodeWithEnv("tools "+strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// runNode executes the TypeScript agent
func runNode(args ...string) error {
	exePath, _ := os.Executable()
	cmdDir := filepath.Dir(exePath)
	nodeCmd := exec.Command("node", append([]string{filepath.Join(cmdDir, "dist", "cli", "main.js")}, args...)...)
	nodeCmd.Stdout = os.Stdout
	nodeCmd.Stderr = os.Stderr
	nodeCmd.Stdin = os.Stdin
	env := os.Environ()
	env = ensureNodePath(env)
	nodeCmd.Env = env
	nodeCmd.Env = append(nodeCmd.Env, "DUCK_SOURCE_DIR="+cmdDir)
	return nodeCmd.Run()
}


// voiceCmd - duck voice [text]
func voiceCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "voice [text]",
		Short: "Text-to-speech with MiniMax",
		Args:  cobra.MinimumNArgs(0),
		RunE: func(cmd *cobra.Command, args []string) error {
			text := strings.Join(args, " ")
			return runNodeWithEnv("voice " + text, cmd)
		},
	}
}

// speakCmd - duck speak [text] / duck tts [text] - aliases for voice
func speakCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "speak [text]",
		Aliases: []string{"tts"},
		Short:   "Text-to-speech with MiniMax",
		Args:    cobra.MinimumNArgs(0),
		RunE: func(cmd *cobra.Command, args []string) error {
			text := strings.Join(args, " ")
			return runNodeWithEnv("voice " + text, cmd)
		},
	}
	return cmd
}

// channelsCmd - duck channels / duck telegram / duck discord
func channelsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "channels [subcommand]",
		Aliases: []string{"telegram", "discord"},
		Short:   "Start Telegram/Discord channels",
		Args:    cobra.ArbitraryArgs, // Forward all args to node script
		RunE: func(cmd *cobra.Command, args []string) error {
			// If called as 'telegram' or 'discord' subcommand, handle directly
			if cmd.CalledAs() == "telegram" {
				if len(args) > 0 {
					return runNodeWithEnv("channels telegram "+strings.Join(args, " "), cmd)
				}
				return runNodeWithEnv("channels telegram", cmd)
			}
			if cmd.CalledAs() == "discord" {
				return runNodeWithEnv("channels discord", cmd)
			}
			if len(args) > 0 {
				return runNodeWithEnv("channels "+args[0], cmd)
			}
			return runNodeWithEnv("channels", cmd)
		},
	}
	return cmd
}

// desktopCmd - duck desktop [action]
func desktopCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "desktop [action]",
		Short: "Desktop control",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) > 0 {
				return runNodeWithEnv("desktop "+args[0], cmd)
			}
			return runNodeWithEnv("desktop status", cmd)
		},
	}
}

// clawhubCmd - duck clawhub [action]
func clawhubCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "clawhub [action]",
		Short: "ClawHub skill marketplace",
		Args:  cobra.MaximumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			script := "clawhub"
			if len(args) > 0 {
				script += " " + strings.Join(args, " ")
			}
			return runNodeWithEnv(script, cmd)
		},
	}
}

// soulsCmd - duck souls [action]
func soulsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "souls [action]",
		Short: "SOUL registry - AI personas",
		Args:  cobra.MaximumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			script := "souls"
			if len(args) > 0 {
				script += " " + strings.Join(args, " ")
			}
			return runNodeWithEnv(script, cmd)
		},
	}
}

// memoryCmd - duck memory [action]
func memoryCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "memory [action]",
		Short: "Memory system commands",
		Args:  cobra.MaximumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			script := "memory"
			if len(args) > 0 {
				script += " " + strings.Join(args, " ")
			}
			return runNodeWithEnv(script, cmd)
		},
	}
}

// thinkCmd - duck think [prompt]
func thinkCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "think [prompt]",
		Short: "Reasoning mode",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			prompt := strings.Join(args, " ")
			return runNodeWithEnv("think "+prompt, cmd)
		},
	}
}



// doctorCmd - duck doctor
func doctorCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "doctor",
		Short:   "Run system diagnostics",
		Long:    "Check environment, API keys, services, and dependencies",
		Args:    cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNode("doctor")
		},
	}
	return cmd
}

// getFirstDevice returns the first connected ADB device serial
func getFirstDevice() string {
	out, err := exec.Command("sh", "-c", "adb devices 2>/dev/null | tail -n +2 | head -1 | awk '{print $1}'").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

// runNodeWithEnv runs node with provider/model/priority env vars
func runNodeDirect(script string, cobraCmd *cobra.Command) error {
	// Like runNodeWithEnv but passes script as a SINGLE argument (no space-splitting)
	exePath, _ := os.Executable()
	cmdDir := filepath.Dir(exePath)
	distPath := filepath.Join(cmdDir, "dist")
	if realDist, err := filepath.EvalSymlinks(distPath); err == nil {
		cmdDir = filepath.Dir(realDist)
	}
	nodeArgs := []string{filepath.Join(cmdDir, "dist", "cli", "main.js"), script}
	nodeCmd := exec.Command("node", nodeArgs...)
	nodeCmd.Stdout = os.Stdout
	nodeCmd.Stderr = os.Stderr
	nodeCmd.Stdin = os.Stdin
	env := os.Environ()
	env = ensureNodePath(env)
	env = ensureNodePath(env)
	nodeModulesPath := filepath.Join(cmdDir, "node_modules")
	if _, err := os.Stat(nodeModulesPath); err == nil {
		env = append(env, "NODE_PATH="+nodeModulesPath)
	}
	if flagProvider != "" { env = append(env, "DUCK_PROVIDER="+flagProvider) }
	if flagModel != "" { env = append(env, "DUCK_MODEL="+flagModel) }
	if flagPriority != "" { env = append(env, "DUCK_PRIORITY="+flagPriority) }
	nodeCmd.Env = env
	nodeCmd.Env = append(nodeCmd.Env, "DUCK_SOURCE_DIR="+cmdDir)
	return nodeCmd.Run()
}

func runNodeDirectMulti(args []string, cobraCmd *cobra.Command) error {
	// Pass args as individual argv elements so "echo hello" stays together.
	// Node main() needs: argv[2]="meta", argv[3]="run", argv[4]="echo hello"
	return runNodeDirectList(args, cobraCmd)
}

func runNodeDirectList(args []string, cobraCmd *cobra.Command) error {
	exePath, _ := os.Executable()
	cmdDir := filepath.Dir(exePath)
	distPath := filepath.Join(cmdDir, "dist")
	if realDist, err := filepath.EvalSymlinks(distPath); err == nil {
		cmdDir = filepath.Dir(realDist)
	}
	nodeArgs := append([]string{filepath.Join(cmdDir, "dist", "cli", "main.js")}, args...)
	nodeCmd := exec.Command("node", nodeArgs...)
	nodeCmd.Stdout = os.Stdout
	nodeCmd.Stderr = os.Stderr
	nodeCmd.Stdin = os.Stdin
	env := os.Environ()
	env = ensureNodePath(env)
	env = ensureNodePath(env)
	nodeModulesPath := filepath.Join(cmdDir, "node_modules")
	if _, err := os.Stat(nodeModulesPath); err == nil {
		env = append(env, "NODE_PATH="+nodeModulesPath)
	}
	if flagProvider != "" { env = append(env, "DUCK_PROVIDER="+flagProvider) }
	if flagModel != "" { env = append(env, "DUCK_MODEL="+flagModel) }
	if flagPriority != "" { env = append(env, "DUCK_PRIORITY="+flagPriority) }
	nodeCmd.Env = env
	nodeCmd.Env = append(nodeCmd.Env, "DUCK_SOURCE_DIR="+cmdDir)
	return nodeCmd.Run()
}


// ensureNodePath ensures the PATH contains known Node.js locations
// so "node" resolves even in minimal-PATH environments (LaunchAgents, Telegram subprocess, etc.)
func ensureNodePath(env []string) []string {
	// Always add common Node.js paths - these are checked first so existing PATH is preserved
	extraPaths := "/usr/local/bin" + string(os.PathListSeparator) +
		"/opt/homebrew/bin" + string(os.PathListSeparator) +
		"/usr/bin"
	// Also try to find node via LookPath to add its directory first
	if nodePath, err := exec.LookPath("node"); err == nil {
		extraPaths = filepath.Dir(nodePath) + string(os.PathListSeparator) + extraPaths
	}
	// Prepend extraPaths to existing PATH
	for i, e := range env {
		if strings.HasPrefix(e, "PATH=") {
			env[i] = "PATH=" + extraPaths + string(os.PathListSeparator) + strings.TrimPrefix(e, "PATH=")
			return env
		}
	}
	env = append(env, "PATH="+extraPaths)
	return env
}


func runNodeWithEnv(script string, cobraCmd *cobra.Command) error {
	exePath, _ := os.Executable()
	cmdDir := filepath.Dir(exePath)
	// Resolve symlinks in dist/ path so DUCK_SOURCE_DIR points to real source dir
	distPath := filepath.Join(cmdDir, "dist")
	if realDist, err := filepath.EvalSymlinks(distPath); err == nil {
		// realDist is the real path of dist/, so go up one level to get the project root
		cmdDir = filepath.Dir(realDist)
	}
	parts := strings.Split(script, " ")
	nodeArgs := []string{filepath.Join(cmdDir, "dist", "cli", "main.js")}
	for _, p := range parts { nodeArgs = append(nodeArgs, p) }
	nodeCmd := exec.Command("node", nodeArgs...)
	nodeCmd.Stdout = os.Stdout
	nodeCmd.Stderr = os.Stderr
	nodeCmd.Stdin = os.Stdin

	env := os.Environ()
	env = ensureNodePath(env)
	env = ensureNodePath(env)
	nodeModulesPath := filepath.Join(cmdDir, "node_modules")
	if _, err := os.Stat(nodeModulesPath); err == nil {
		env = append(env, "NODE_PATH="+nodeModulesPath)
	}
	if flagProvider != "" {
		env = append(env, "DUCK_PROVIDER="+flagProvider)
	}
	if flagModel != "" {
		env = append(env, "DUCK_MODEL="+flagModel)
	}
	if flagPriority != "" {
		env = append(env, "DUCK_PRIORITY="+flagPriority)
	}
	nodeCmd.Env = env
	// Pass the source directory (where dist/ is) so Node can find .env
	nodeCmd.Env = append(nodeCmd.Env, "DUCK_SOURCE_DIR="+cmdDir)
	return nodeCmd.Run()
}

// buildRunScript creates the run command script
func buildRunScript(prompt string, interactive bool) string {
	if interactive {
		return "--shell"
	}
	return "--run " + prompt
}
// androidCmd - duck android <command> [args]
// DroidClaw-style Android ADB automation
func androidCmd() *cobra.Command {
	devicesCmd := &cobra.Command{
		Use:   "devices",
		Short: "List connected Android devices via ADB",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("android devices", cmd)
		},
	}
	screenshotCmd := &cobra.Command{
		Use:   "screenshot [filename]",
		Short: "Capture Android device screen",
		Args:  cobra.RangeArgs(0, 1),
		RunE: func(cmd *cobra.Command, args []string) error {
			fname := ""
			if len(args) > 0 {
				fname = args[0]
			}
			payload := fmt.Sprintf(`{"filename":"%s"}`, fname)
			return runNodeWithEnv("android screenshot "+payload, cmd)
		},
	}
	tapCmd := &cobra.Command{
		Use:   "tap <x> <y>",
		Short: "Tap at coordinates on Android screen",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			payload := fmt.Sprintf(`{"x":%s,"y":%s}`, args[0], args[1])
			return runNodeWithEnv("android tap "+payload, cmd)
		},
	}
	typeCmd := &cobra.Command{
		Use:   "type <text>",
		Short: "Type text on Android device",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			text := strings.Join(args, " ")
			payload := fmt.Sprintf(`{"text":"%s"}`, strings.ReplaceAll(text, `"`, `\"`))
			return runNodeWithEnv("android type "+payload, cmd)
		},
	}
	shellCmdLocal := &cobra.Command{
		Use:   "shell <command>",
		Short: "Execute ADB shell command on Android device",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			cmdStr := strings.Join(args, " ")
			payload := fmt.Sprintf(`{"command":"%s"}`, strings.ReplaceAll(cmdStr, `"`, `\"`))
			return runNodeWithEnv("android shell "+payload, cmd)
		},
	}
	dumpCmd := &cobra.Command{
		Use:   "dump [query]",
		Short: "Dump Android UI hierarchy (XML)",
		Args:  cobra.RangeArgs(0, 1),
		RunE: func(cmd *cobra.Command, args []string) error {
			query := ""
			if len(args) > 0 {
				query = args[0]
			}
			payload := fmt.Sprintf(`{"query":"%s"}`, query)
			return runNodeWithEnv("android dump "+payload, cmd)
		},
	}
	findCmd := &cobra.Command{
		Use:   "find <text-or-id>",
		Short: "Find UI element and tap it (DroidClaw-style)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			payload := fmt.Sprintf(`{"query":"%s"}`, args[0])
			return runNodeWithEnv("android find "+payload, cmd)
		},
	}
	swipeCmd := &cobra.Command{
		Use:   "swipe <direction> [distance]",
		Short: "Swipe on screen (up|down|left|right)",
		Args:  cobra.RangeArgs(1, 2),
		RunE: func(cmd *cobra.Command, args []string) error {
			dist := "500"
			if len(args) > 1 {
				dist = args[1]
			}
			payload := fmt.Sprintf(`{"direction":"%s","distance":%s}`, args[0], dist)
			return runNodeWithEnv("android swipe "+payload, cmd)
		},
	}
	pressCmd := &cobra.Command{
		Use:   "press <key>",
		Short: "Press Android key (enter|back|home|recent)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			payload := fmt.Sprintf(`{"key":"%s"}`, args[0])
			return runNodeWithEnv("android press "+payload, cmd)
		},
	}
	appCmd := &cobra.Command{
		Use:   "app <action> <package>",
		Short: "Launch/kill Android app (launch|kill|foreground)",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			payload := fmt.Sprintf(`{"action":"%s","package":"%s"}`, args[0], args[1])
			return runNodeWithEnv("android app "+payload, cmd)
		},
	}
	screenCmd := &cobra.Command{
		Use:   "screen",
		Short: "Read all visible text on Android screen (OCR-style)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			serial := getFirstDevice()
			payload := fmt.Sprintf(`{"serial":"%s"}`, serial)
			return runNodeWithEnv("android screen " + payload, cmd)
		},
	}
	batteryCmd := &cobra.Command{
		Use:   "battery",
		Short: "Get Android battery level",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			serial := getFirstDevice()
			payload := fmt.Sprintf(`{"serial":"%s"}`, serial)
			return runNodeWithEnv("android battery " + payload, cmd)
		},
	}
	infoCmd := &cobra.Command{
		Use:   "info",
		Short: "Get full device info (model, Android, SDK, screen, battery, IP)",
		Args:  cobra.RangeArgs(0, 1),
		RunE: func(cmd *cobra.Command, args []string) error {
			serial := ""
			if len(args) > 0 { serial = args[0] }
			payload := fmt.Sprintf(`{"serial":"%s"}`, serial)
			return runNodeWithEnv("android info "+payload, cmd)
		},
	}
	installCmd := &cobra.Command{
		Use:   "install <apk-path>",
		Short: "Install APK on Android device",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			payload := fmt.Sprintf(`{"apk":"%s"}`, args[0])
			return runNodeWithEnv("android install "+payload, cmd)
		},
	}
	packagesCmd := &cobra.Command{
		Use:   "packages",
		Short: "List installed packages",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			serial := getFirstDevice()
			payload := fmt.Sprintf(`{"serial":"%s"}`, serial)
			return runNodeWithEnv("android packages " + payload, cmd)
		},
	}
	termuxCmd := &cobra.Command{
		Use:   "termux <command>",
		Short: "Run Termux API (battery|clip-get|notif|sensors|location|wifi|toast|vibrate|torch)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			payload := fmt.Sprintf(`{"command":"%s"}`, args[0])
			return runNodeWithEnv("android termux "+payload, cmd)
		},
	}
	analyzeCmd := &cobra.Command{
		Use:   "analyze",
		Short: "Full vision pipeline: screenshot + UI + app + battery",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			serial := getFirstDevice()
			payload := fmt.Sprintf(`{"serial":"%s"}`, serial)
			return runNodeWithEnv("android analyze " + payload, cmd)
		},
	}
	clipboardCmd := &cobra.Command{
		Use:   "clipboard <get|set> [text]",
		Short: "Get or set Android clipboard",
		Args:  cobra.RangeArgs(1, 2),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 1 {
				payload := fmt.Sprintf(`{"action":"get"}`)
				return runNodeWithEnv("android clipboard "+payload, cmd)
			}
			payload := fmt.Sprintf(`{"action":"set","text":"%s"}`, strings.ReplaceAll(args[1], `"`, `"`))
			return runNodeWithEnv("android clipboard "+payload, cmd)
		},
	}
	notificationsCmd := &cobra.Command{
		Use:   "notifications",
		Short: "Get recent Android notifications",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			serial := getFirstDevice()
			payload := fmt.Sprintf(`{"serial":"%s"}`, serial)
			return runNodeWithEnv("android notifications " + payload, cmd)
		},
	}
	statusCmd := &cobra.Command{
		Use:   "status",
		Short: "Show device status (model, Android, battery, screen, IP)",
		Args:  cobra.RangeArgs(0, 1),
		RunE: func(cmd *cobra.Command, args []string) error {
			serial := ""
			if len(args) > 0 { serial = args[0] }
			payload := fmt.Sprintf(`{"serial":"%s"}`, serial)
			return runNodeWithEnv("android status "+payload, cmd)
		},
	}
	forwardCmd := &cobra.Command{
		Use:   "forward <local> <remote>",
		Short: "Setup ADB port forwarding (e.g. tcp:18789 tcp:18789)",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			payload := fmt.Sprintf(`{"local":"%s","remote":"%s"}`, args[0], args[1])
			return runNodeWithEnv("android forward "+payload, cmd)
		},
	}
	pushCmd := &cobra.Command{
		Use:   "push",
		Short: "Push duck-android binary to device at /data/local/tmp/duck",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("android push ", cmd)
		},
	}
	agentCmd := &cobra.Command{
		Use:   "agent <goal>",
		Short: "🦆 Run DroidClaw-style AI agent loop on Android",
		Long:  `DroidClaw-style perceive→reason→act loop with duck-cli LLM routing.

Examples:
  duck android agent "open WhatsApp and send the message hi"
  duck android agent "search for pizza on Google Maps"
  duck android agent "open settings and turn on WiFi"

Uses Gemma 4 (LM Studio) by default — vision + Android tool-calling trained!
Other models: set GEMMA_MODEL, DUCK_PRIORITY, or DUCK_CLI_MODEL env vars.`,
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			goal := strings.Join(args, " ")
			return runNodeWithEnv("android-agent "+goal, cmd)
		},
	}

	cmd := &cobra.Command{
		Use:     "android [command] [args]",
		Short:   "DroidClaw-style Android ADB automation",
		Long:    `DroidClaw-style Android ADB automation.\n\nDevice:\n  duck android devices                List connected devices\n  duck android status [serial]          Device status (model, battery, screen, IP)\n  duck android info                   Full device info (model, Android, IP)\n  duck android forward <local> <remote> ADB port forwarding\n  duck android push                    Push duck-android binary to device\n\nControl:\n  duck android tap <x> <y>             Tap coordinates\n  duck android swipe <dir> [dist]     Swipe (up|down|left|right)\n  duck android type <text>            Type text\n  duck android press <key>            Key (enter|back|home|recent|power)\n  duck android clipboard <get|set>    Clipboard operations\n\nScreen:\n  duck android screenshot [fname]      Capture screen\n  duck android screen                  Read visible text (OCR-style)\n  duck android dump [query]           Dump UI hierarchy\n  duck android find <text>            Find element and tap\n  duck android analyze                 Full vision: screenshot + UI + app + battery\n\nApps:\n  duck android app launch <pkg>       Launch app\n  duck android app kill <pkg>          Force-stop app\n  duck android app foreground           Get foreground app\n  duck android install <apk>           Install APK\n  duck android packages                List packages\n\nSystem:\n  duck android shell <cmd>            Run ADB shell command\n  duck android battery                 Battery level\n  duck android notifications           Recent notifications\n  duck android termux <cmd>            Termux API (battery|clip|notif|sensors|location|wifi|torch)\n\nDroidClaw:\n  duck android droidclaw [ws-url]      DroidClaw protocol (remote AI control)\n  duck android node [gateway]          OpenClaw Node on Android`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return cmd.Help()
			}
			sub := args[0]
			switch sub {
			case "devices":
				return runNodeWithEnv("android devices", cmd)
			case "screenshot":
				fname := ""
				if len(args) > 1 {
					fname = args[1]
				}
				serial := getFirstDevice()
				payload := fmt.Sprintf(`{"filename":"%s","serial":"%s"}`, fname, serial)
				return runNodeWithEnv("android screenshot " + payload, cmd)
			case "tap":
				if len(args) < 3 {
					return fmt.Errorf("Usage: duck android tap <x> <y>")
				}
				serial := getFirstDevice()
				payload := fmt.Sprintf(`{"x":%s,"y":%s,"serial":"%s"}`, args[1], args[2], serial)
				return runNodeWithEnv("android tap " + payload, cmd)
			case "type":
				if len(args) < 2 {
					return fmt.Errorf("Usage: duck android type <text>")
				}
				text := strings.Join(args[1:], " ")
				payload := fmt.Sprintf(`{"text":"%s"}`, strings.ReplaceAll(text, `"`, `\"`))
				return runNodeWithEnv("android type "+payload, cmd)
			case "shell":
				if len(args) < 2 {
					return fmt.Errorf("Usage: duck android shell <command>")
				}
				shellCmd := strings.Join(args[1:], " ")
				payload := fmt.Sprintf(`{"command":"%s"}`, strings.ReplaceAll(shellCmd, `"`, `\"`))
				return runNodeWithEnv("android shell "+payload, cmd)
			case "dump":
				query := ""
				if len(args) > 1 {
					query = args[1]
				}
				serial := getFirstDevice()
				payload := fmt.Sprintf(`{"query":"%s","serial":"%s"}`, query, serial)
				return runNodeWithEnv("android dump " + payload, cmd)
			case "find":
				if len(args) < 2 {
					return fmt.Errorf("Usage: duck android find <text-or-id>")
				}
				serial := getFirstDevice()
				payload := fmt.Sprintf(`{"query":"%s","serial":"%s"}`, args[1], serial)
				return runNodeWithEnv("android find " + payload, cmd)
			case "swipe":
				if len(args) < 2 {
					return fmt.Errorf("Usage: duck android swipe <direction> [distance]")
				}
				dist := "500"
				if len(args) > 2 {
					dist = args[2]
				}
				serial := getFirstDevice()
				payload := fmt.Sprintf(`{"direction":"%s","distance":%s,"serial":"%s"}`, args[1], dist, serial)
				return runNodeWithEnv("android swipe " + payload, cmd)
			case "press":
				if len(args) < 2 {
					return fmt.Errorf("Usage: duck android press <key>")
				}
				serial := getFirstDevice()
				payload := fmt.Sprintf(`{"key":"%s","serial":"%s"}`, args[1], serial)
				return runNodeWithEnv("android press " + payload, cmd)
			case "app":
				if len(args) < 3 {
					return fmt.Errorf("Usage: duck android app <action> <package>")
				}
				serial := getFirstDevice()
				payload := fmt.Sprintf(`{"action":"%s","package":"%s","serial":"%s"}`, args[1], args[2], serial)
				return runNodeWithEnv("android app " + payload, cmd)
			case "screen":
				serial := getFirstDevice()
			payload := fmt.Sprintf(`{"serial":"%s"}`, serial)
			return runNodeWithEnv("android screen " + payload, cmd)
			case "battery":
				serial := getFirstDevice()
			payload := fmt.Sprintf(`{"serial":"%s"}`, serial)
			return runNodeWithEnv("android battery " + payload, cmd)
			case "info":
				serial := ""
				if len(args) > 1 { serial = args[1] }
				payload := fmt.Sprintf(`{"serial":"%s"}`, serial)
				return runNodeWithEnv("android info "+payload, cmd)
			case "install":
				if len(args) < 2 { return fmt.Errorf("Usage: duck android install <apk-path>") }
				payload := fmt.Sprintf(`{"apk":"%s"}`, args[1])
				return runNodeWithEnv("android install "+payload, cmd)
			case "packages":
				serial := getFirstDevice()
			payload := fmt.Sprintf(`{"serial":"%s"}`, serial)
			return runNodeWithEnv("android packages " + payload, cmd)
			case "termux":
				if len(args) < 2 { return fmt.Errorf("Usage: duck android termux <command>") }
				payload := fmt.Sprintf(`{"command":"%s"}`, args[1])
				return runNodeWithEnv("android termux "+payload, cmd)
			case "analyze":
				serial := getFirstDevice()
			payload := fmt.Sprintf(`{"serial":"%s"}`, serial)
			return runNodeWithEnv("android analyze " + payload, cmd)
			case "clipboard":
				if len(args) < 2 { return fmt.Errorf("Usage: duck android clipboard <get|set> [text]") }
				if len(args) == 2 {
					payload := fmt.Sprintf(`{"action":"get"}`)
					return runNodeWithEnv("android clipboard "+payload, cmd)
				}
				payload := fmt.Sprintf(`{"action":"set","text":"%s"}`, strings.ReplaceAll(args[2], `"`, `"`))
				return runNodeWithEnv("android clipboard "+payload, cmd)
			case "notifications", "notifs":
				serial := getFirstDevice()
			payload := fmt.Sprintf(`{"serial":"%s"}`, serial)
			return runNodeWithEnv("android notifications " + payload, cmd)
			case "status":
				serial := ""
				if len(args) > 1 { serial = args[1] }
				payload := fmt.Sprintf(`{"serial":"%s"}`, serial)
				return runNodeWithEnv("android status "+payload, cmd)
			case "forward":
				if len(args) < 3 {
					return fmt.Errorf("Usage: duck android forward <local> <remote>")
				}
				payload := fmt.Sprintf(`{"local":"%s","remote":"%s"}`, args[1], args[2])
				return runNodeWithEnv("android forward "+payload, cmd)
			case "push":
				return runNodeWithEnv("android push ", cmd)
			default:
				return fmt.Errorf("unknown android command: %s. Run 'duck android' for help.", sub)
			}
		},
	}
	cmd.AddCommand(devicesCmd, screenshotCmd, tapCmd, typeCmd, shellCmdLocal, dumpCmd, findCmd, swipeCmd, pressCmd, appCmd, screenCmd, batteryCmd, infoCmd, installCmd, packagesCmd, termuxCmd, analyzeCmd, clipboardCmd, notificationsCmd, statusCmd, forwardCmd, pushCmd, agentCmd)
	return cmd
}
