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
		unifiedCmd(),
		gatewayCmd(),
		webCmd(),
		kairosCmd(),
		subconsciousCmd(),
		cronCmd(),
		buddyCmd(),
		teamCmd(),
		meshCmd(),
		rlCmd(),
		acpServerCmd(),
		acpSpawnCmd(),
		updateCmd(),
		voiceCmd(),
		speakCmd(),
		channelsCmd(),
		clawhubCmd(),
		soulsCmd(),
		desktopCmd(),
		memoryCmd(),
		thinkCmd(),
	)

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(errorStyle.Render("Error: ") + err.Error())
		os.Exit(1)
	}
}

func checkNode() bool {
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
		Use:   "subconscious [cmd]",
		Short: "Sub-Conscious control (status|enable|disable|stats)",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("subconscious status", cmd)
			}
			return runNodeWithEnv("subconscious "+args[0], cmd)
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

// meshCmd - duck mesh [action]
func meshCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "mesh [action]",
		Short: "Agent Mesh networking (register|list|send|broadcast|inbox|capabilities)",
		Args:  cobra.MaximumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("mesh status", cmd)
			}
			return runNodeWithEnv("mesh "+strings.Join(args, " "), cmd)
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
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) > 0 {
				return runNodeWithEnv("mcp-server "+args[0], cmd)
			}
			return runNodeWithEnv("mcp-server", cmd)
		},
	}
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

// runNode executes the TypeScript agent
func runNode(args ...string) error {
	exePath, _ := os.Executable()
	cmdDir := filepath.Dir(exePath)
	nodeCmd := exec.Command("node", append([]string{filepath.Join(cmdDir, "dist", "cli", "main.js")}, args...)...)
	nodeCmd.Stdout = os.Stdout
	nodeCmd.Stderr = os.Stderr
	nodeCmd.Stdin = os.Stdin
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
		Args:    cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			// If called as 'telegram' or 'discord' subcommand, handle directly
			if cmd.CalledAs() == "telegram" {
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


// runNodeWithEnv runs node with provider/model/priority env vars
func runNodeWithEnv(script string, cobraCmd *cobra.Command) error {
	exePath, _ := os.Executable()
	cmdDir := filepath.Dir(exePath)
	nodeCmd := exec.Command("node", append([]string{filepath.Join(cmdDir, "dist", "cli", "main.js")}, strings.Fields(script)...)...)
	nodeCmd.Stdout = os.Stdout
	nodeCmd.Stderr = os.Stderr
	nodeCmd.Stdin = os.Stdin

	env := os.Environ()
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
	return nodeCmd.Run()
}

// buildRunScript creates the run command script
func buildRunScript(prompt string, interactive bool) string {
	if interactive {
		return "--shell"
	}
	return "--run " + prompt
}
