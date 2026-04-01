package main

import (
	"fmt"
	"os"
	"path/filepath"
	"os/exec"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/joho/godotenv"
	"github.com/spf13/cobra"
)

var (
	version = "0.1.0"

	// Styles
	brandStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FFD700")). // Gold
			Bold(true)

	dimStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#888888"))

	successStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#50FA7B"))

	errorStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FF5555"))

	// Global flags (set by cobra)
	flagProvider  string
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

	// Check for Node.js (for TypeScript agent)
	if !checkNode() {
		fmt.Println(errorStyle.Render("✗ Node.js not found. Duck CLI requires Node.js 20+"))
		fmt.Println(dimStyle.Render("  Install: https://nodejs.org"))
		os.Exit(1)
	}

	rootCmd := &cobra.Command{
		Use:   "duck",
		Short: "🦆 The ultimate AI coding agent",
		Long: `
Duck CLI - The ultimate AI coding CLI combining the best of Claude Code,
OpenCode, Gemini CLI, and OpenClaw.

Features:
  • Multi-provider AI (Anthropic, OpenAI, Gemini, LM Studio)
  • MCP server integration
  • Multi-agent swarm coordination
  • Persistent semantic memory
  • DEFCON security mode
  • AI Council deliberation`,
		Version: version,
	}

	// Global flags
	rootCmd.PersistentFlags().StringVarP(&flagProvider, "provider", "p", "", "AI provider (kimi|minimax|openrouter|lmstudio|anthropic|openai|moonshot)")
	rootCmd.PersistentFlags().StringVarP(&flagModel, "model", "m", "", "Specific model to use")
	rootCmd.PersistentFlags().StringVarP(&flagPriority, "priority", "", "", "Provider priority chain (e.g. kimi,minimax,openrouter)")
	rootCmd.PersistentFlags().BoolP("verbose", "v", false, "Verbose output")
	rootCmd.PersistentFlags().Bool("no-color", false, "Disable colors")

	// Commands
	rootCmd.AddCommand(runCmd())
	rootCmd.AddCommand(agentCmd())
	rootCmd.AddCommand(mcpCmd())
	rootCmd.AddCommand(skillsCmd())
	rootCmd.AddCommand(securityCmd())
	rootCmd.AddCommand(statusCmd())
	rootCmd.AddCommand(councilCmd())
	rootCmd.AddCommand(shellCmd())

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(errorStyle.Render("Error: ") + err.Error())
		os.Exit(1)
	}
}

func checkNode() bool {
	_, err := exec.LookPath("node")
	return err == nil
}

// runCmd - Interactive or prompt-based run
func runCmd() *cobra.Command {
	var interactive bool
	var prompt string

	cmd := &cobra.Command{
		Use:   "run [prompt]",
		Short: "Run a task with Duck CLI",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) > 0 {
				prompt = args[0]
			}

			// Run TypeScript agent with provider/model env vars
			script := buildRunScript(prompt, interactive)
			return runNodeWithEnv(script, cmd)
		},
	}

	cmd.Flags().BoolVarP(&interactive, "interactive", "i", false, "Interactive REPL mode")
	return cmd
}

// agentCmd - Multi-agent management
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

// mcpCmd - MCP server management
func mcpCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "mcp",
		Short: "Manage MCP servers",
	}

	cmd.AddCommand(&cobra.Command{
		Use:   "list",
		Short: "List configured MCP servers",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNode("mcp-list")
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "add <name> <command>",
		Short: "Add an MCP server",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNode("mcp-add", args[0], args[1])
		},
	})

	return cmd
}

// skillsCmd - Skills management
func skillsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "skills",
		Short: "Manage skills",
	}

	cmd.AddCommand(&cobra.Command{
		Use:   "list",
		Short: "List available skills",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNode("skills-list")
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "search <query>",
		Short: "Search skills",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNode("skills-search", args[0])
		},
	})

	return cmd
}

// securityCmd - Security operations
func securityCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "security",
		Short: "Security operations",
	}

	cmd.AddCommand(&cobra.Command{
		Use:   "audit",
		Short: "Run security audit",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNode("security-audit")
		},
	})

	cmd.AddCommand(&cobra.Command{
		Use:   "defcon",
		Short: "Show DEFCON level",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNode("security-defcon")
		},
	})

	return cmd
}

// statusCmd - Show agent status
func statusCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "status",
		Short: "Show Duck Agent status",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNode("status")
		},
	}
	return cmd
}

// councilCmd - AI Council deliberation
func councilCmd() *cobra.Command {
	var mode string

	cmd := &cobra.Command{
		Use:   "council <question>",
		Short: "Ask the AI Council",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNode("council", mode, strings.Join(args, " "))
		},
	}

	cmd.Flags().StringVar(&mode, "mode", "decision", "Mode: decision|research|prediction")
	return cmd
}

// shellCmd - Shell REPL
func shellCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "shell",
		Short: "Start Duck CLI shell",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("shell", cmd)
		},
	}
	return cmd
}

// runNode executes the TypeScript agent
func runNode(args ...string) error {
	// Find the actual executable directory, following symlinks
    exePath, _ := os.Executable()
    cmdDir := filepath.Dir(exePath)
	cmd := exec.Command("node", append([]string{filepath.Join(cmdDir, "dist", "cli", "main.js")}, args...)...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	return cmd.Run()
}

// runNodeWithEnv runs node with DUCK_PROVIDER and DUCK_MODEL env vars set
func runNodeWithEnv(script string, cobraCmd *cobra.Command) error {
	// Find the actual executable directory, following symlinks
    exePath, _ := os.Executable()
    cmdDir := filepath.Dir(exePath)
	cmd := exec.Command("node", append([]string{filepath.Join(cmdDir, "dist", "cli", "main.js")}, strings.Fields(script)...)...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	// Pass provider and model as env vars
	env := os.Environ()
	// Set NODE_PATH so native modules like better-sqlite3 are found
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
	cmd.Env = env
	return cmd.Run()
}

// buildRunScript creates the run command script
func buildRunScript(prompt string, interactive bool) string {
	if interactive {
		return "--shell"
	}
	return "--run " + prompt
}
