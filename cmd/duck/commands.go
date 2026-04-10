package main

import (
	"strings"

	"github.com/spf13/cobra"
)

// nodeCmd - duck node [action]
func nodeCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "node [action]",
		Short: "Node management (status|run|install|uninstall)",
		Long: `Manage OpenClaw nodes.

Commands:
  duck node status              Check node status
  duck node run <id>            Run node instance
  duck node install <name>      Install new node
  duck node uninstall <id>      Uninstall node`,
		Args: cobra.MinimumNArgs(0),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("node status", cmd)
			}
			return runNodeWithEnv("node "+strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// nodesCmd - duck nodes [action]
func nodesCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "nodes [action]",
		Short: "Gateway node queries (list|describe|approve|reject)",
		Long: `Query and manage gateway nodes.

Commands:
  duck nodes list               List all nodes
  duck nodes describe <id>      Get node details
  duck nodes approve <id>       Approve pending node
  duck nodes reject <id>        Reject node`,
		Args: cobra.MinimumNArgs(0),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("nodes list", cmd)
			}
			return runNodeWithEnv("nodes "+strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// devicesCmd - duck devices [action]
func devicesCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "devices [action]",
		Short: "Device pairing management (list|approve|reject|rotate)",
		Long: `Manage device pairing.

Commands:
  duck devices list             List paired devices
  duck devices approve <id>     Approve device
  duck devices reject <id>      Reject device
  duck devices rotate <id>      Rotate device token`,
		Args: cobra.MinimumNArgs(0),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("devices list", cmd)
			}
			return runNodeWithEnv("devices "+strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// qrCmd - duck qr [gateway-url]
func qrCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "qr [gateway-url]",
		Short: "Generate pairing QR code",
		Long: `Generate a QR code for OpenClaw pairing.

Examples:
  duck qr                     Use default gateway
  duck qr http://192.168.1.5:18789  Use specific gateway`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("qr", cmd)
			}
			return runNodeWithEnv("qr "+args[0], cmd)
		},
	}
	return cmd
}

// graphifyCmd - duck graphify [args...]
func graphifyCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "graphify [args...]",
		Short: "Knowledge graph generation for code, docs, and images",
		Long: `Turn any folder into a navigable knowledge graph.

Examples:
  duck graphify .                    # graph current directory
  duck graphify ./src --mode deep    # thorough extraction
  duck graphify query "explain auth" # query existing graph
  duck graphify status               # check installation`,
		Args:               cobra.MinimumNArgs(0),
		DisableFlagParsing: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("graphify "+strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// mmxCmd - duck mmx [args...]
func mmxCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "mmx [args...]",
		Short: "MiniMax AI Platform CLI wrapper",
		Long: `Access MiniMax text, image, video, speech, music, vision, and search.

Examples:
  duck mmx text chat --message "Hello"
  duck mmx image "A cat in a spacesuit"
  duck mmx speech synthesize --text "Hi" --out hi.mp3
  duck mmx video generate --prompt "Sunset waves" --async
  duck mmx vision photo.jpg
  duck mmx search "MiniMax AI latest news"
  duck mmx quota`,
		Args:               cobra.MinimumNArgs(0),
		DisableFlagParsing: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("mmx "+strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// capabilityCmd - duck capability [action]
func capabilityCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "capability [action]",
		Aliases: []string{"infer"},
		Short:   "Provider-backed inference commands (list|run|test|set-engine|set-temp|set-max-tokens|config)",
		Long: `Run inference with various AI providers.

Commands:
  duck capability list              List available capabilities
  duck capability run <prompt>      Run inference with prompt
  duck capability test <model>      Test a specific model
  duck capability set-engine <e>    Set default engine
  duck capability set-temp <t>      Set temperature
  duck capability set-max-tokens <n> Set max tokens
  duck capability config            Show current config`,
		Args: cobra.MinimumNArgs(0),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("capability list", cmd)
			}
			return runNodeWithEnv("capability "+strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// onboardCmd - duck onboard [action]
func onboardCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "onboard [action]",
		Short: "Interactive onboarding wizard (gateway|workspace|skills|status|reset)",
		Long: `First-time setup wizard for Duck CLI.

Commands:
  duck onboard                    Run full onboarding wizard
  duck onboard gateway            Configure gateway only
  duck onboard workspace          Configure workspace only
  duck onboard skills             Configure skills only
  duck onboard status             Show onboarding status
  duck onboard reset              Reset onboarding`,
		Args: cobra.MinimumNArgs(0),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("onboard", cmd)
			}
			return runNodeWithEnv("onboard "+strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// pluginsCmd - duck plugins [action]
func pluginsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "plugins [action]",
		Short: "Plugin management (list|install|uninstall|inspect|enable|disable)",
		Long: `Manage Duck CLI plugins.

Commands:
  duck plugins list               List installed plugins
  duck plugins install <source>   Install from path/URL
  duck plugins uninstall <name>   Remove a plugin
  duck plugins inspect <name>     Show plugin details
  duck plugins enable <name>      Enable a plugin
  duck plugins disable <name>     Disable a plugin`,
		Args: cobra.MinimumNArgs(0),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				return runNodeWithEnv("plugins list", cmd)
			}
			return runNodeWithEnv("plugins "+strings.Join(args, " "), cmd)
		},
	}
	return cmd
}

// securityAuditCmd - duck security-audit [run|categories|check]
func securityAuditCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "security-audit [command]",
		Short: "🛡️ Full security audit (findings, severity, remediation)",
		Args:  cobra.MaximumNArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			script := "security-audit"
			if len(args) > 0 {
				script += " " + strings.Join(args, " ")
			} else {
				script += " run"
			}
			return runNodeWithEnv(script, cmd)
		},
	}
	cmd.AddCommand(&cobra.Command{
		Use:   "run",
		Short: "Run the full security audit",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("security-audit run "+strings.Join(args, " "), cmd)
		},
	})
	cmd.AddCommand(&cobra.Command{
		Use:   "categories",
		Short: "List available audit categories",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("security-audit categories", cmd)
		},
	})
	cmd.AddCommand(&cobra.Command{
		Use:   "check <category>",
		Short: "Run a specific audit category",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runNodeWithEnv("security-audit check "+args[0], cmd)
		},
	})
	return cmd
}
