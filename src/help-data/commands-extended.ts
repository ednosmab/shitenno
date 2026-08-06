import type { CommandCategory } from "../domain/types/help-data.js";

export const EXTENDED_CATEGORIES: CommandCategory[] = [
  {
    name: "Reports & Dashboards",
    description: "View reports, dashboards, and digests",
    commands: [
      {
        name: "console",
        description: "Token economy console with session metrics",
        usage: "shugo console [options]",
        examples: [
          "shugo console              # Full console",
          "shugo console --days 30    # Last 30 days",
        ],
      },
      {
        name: "report",
        description: "Generate performance report for the user",
        usage: "shugo report [options]",
        examples: [
          "shugo report               # Full report",
          "shugo report --json        # JSON output",
        ],
      },
      {
        name: "digest",
        description: "Daily digest of project health and recent changes",
        usage: "shugo digest [options]",
        examples: [
          "shugo digest               # Today's digest",
          "shugo digest --json        # JSON output",
        ],
      },
      {
        name: "bench",
        description: "Benchmark token economy and Context Pipeline performance",
        usage: "shugo bench [options]",
        examples: [
          "shugo bench                # Run benchmark",
        ],
      },
    ],
  },
  {
    name: "AI Integration",
    description: "Briefings, feedback, and AI agent tools",
    commands: [
      {
        name: "briefing",
        description: "Pre-session briefing for AI agents (Context Pipeline)",
        usage: "shugo briefing [options]",
        examples: [
          "shugo briefing             # Full briefing",
          "shugo briefing --summary   # One-line summary",
          "shugo briefing --write     # Write to .shugo/BRIEFING.md",
          "shugo briefing --json      # JSON output",
        ],
        tips: [
          "Run at the start of each AI session for context",
        ],
      },
      {
        name: "feedback",
        description: "Report session outcome for the Context Pipeline feedback loop",
        usage: "shugo feedback [options]",
        examples: [
          'shugo feedback --outcome success',
          'shugo feedback --outcome failure --notes "type error in auth"',
        ],
      },
      {
        name: "profile",
        description: "View and update your user profile for personalized feedback",
        usage: "shugo profile [options]",
        examples: [
          "shugo profile              # Show current profile",
          "shugo profile --update     # Update profile interactively",
        ],
      },
      {
        name: "dashboard",
        description: "Interactive engineering dashboard with tabs, mouse, and accessibility",
        usage: "shugo dashboard [options]",
        examples: [
          "shugo dashboard            # Open interactive dashboard",
          "shugo dashboard --json     # JSON snapshot",
          "shugo dashboard --live 5   # Auto-refresh every 5s",
        ],
        tips: [
          "Navigate with arrow keys, Tab, numbers, or mouse",
          "Press 'q' to quit, 'r' to refresh",
        ],
      },
      {
        name: "reminders",
        description: "List, add, remove, and manage session reminders with priority and category",
        usage: "shugo reminders [options] [command]",
        examples: [
          "shugo reminders                                              # List all active reminders",
          'shugo reminders add "Run audit"                              # Add reminder (default: medium, feature)',
          'shugo reminders add "Fix auth bug" --priority high --category bug  # Add with priority and category',
          'shugo reminders add "Security review" --notify               # Add with desktop notification',
          "shugo reminders rm 1                                         # Remove reminder by index",
          'shugo reminders rm --message "audit"                         # Remove by partial match',
          "shugo reminders clear                                        # Remove all reminders",
          "shugo reminders --json                                       # Output as JSON",
        ],
        tips: [
          "Priorities: high (🔴), medium (🟡), low (🟢) — default is medium",
          "Categories: bug (🐛), feature (✨), debt (🔧), security (🔒), docs (📝), infra (⚙️)",
          "High priority reminders trigger desktop notifications on session start",
          "Reminders appear in the briefing sorted by priority (high → low)",
        ],
      },
    ],
  },
  {
    name: "System",
    description: "Shell integration and system utilities",
    commands: [
      {
        name: "validate",
        description: "Validate session integrity and governance rules",
        usage: "shugo validate [options]",
        examples: [
          "shugo validate             # Validate current session",
          "shugo validate --json      # JSON output",
        ],
      },
      {
        name: "shell-init",
        description: "Output shell hooks for session tracking",
        usage: "shugo shell-init [options]",
        examples: [
          "shugo shell-init           # Show shell hooks",
          "Add to .bashrc/.zshrc: eval $(shugo shell-init)",
        ],
      },
      {
        name: "handbook",
        description: "Exibe o handbook de referência do Shugo",
        usage: "shugo handbook [options]",
        examples: [
          "shugo handbook              # Show full handbook index",
          "shugo handbook --level 1    # Apenas fundamentos",
          "shugo handbook --level 2    # Apenas comandos",
          "shugo handbook --level 3    # Apenas arquitetura",
          "shugo handbook --topic init # Buscar por tópico",
          "shugo handbook --list       # Listar todos os tópicos",
        ],
        tips: [
          "Nível 1: Para qualquer pessoa (o que é, instalação, primeiros passos)",
          "Nível 2: Para developers (referência de comandos)",
          "Nível 3: Para architects (arquitetura interna)",
        ],
      },
      {
        name: "daemon",
        description: "Manage the Shugo background daemon (start/stop/status)",
        usage: "shugo daemon [options] [command]",
        examples: [
          "shugo daemon start          # Start the daemon in the background",
          "shugo daemon stop           # Stop the daemon gracefully",
          "shugo daemon status         # Show daemon status and uptime",
          "shugo daemon restart        # Restart the daemon",
        ],
        tips: [
          "O daemon é opcional — todos os comandos funcionam sem ele",
          "Use 'shugo daemon status' para verificar se está a correr",
          "Monitoriza ficheiros, sessões, saúde e desafios em tempo real",
        ],
      },
    ],
  },
  {
    name: "Documentation",
    description: "Manage documentation lifecycle and organization",
    commands: [
      {
        name: "docs-audit",
        description: "Audit documentation lifecycle status and propose organization",
        usage: "shugo docs-audit [options]",
        examples: [
          "shugo docs-audit              # Dry-run: show proposed moves",
          "shugo docs-audit --apply      # Apply moves with confirmation",
          "shugo docs-audit --json       # Output as JSON",
        ],
        tips: [
          "Run this periodically to keep documentation organized",
          "Use --apply only after reviewing the dry-run report",
          "Documents are classified as: planned, in_progress, completed, superseded, stale",
        ],
      },
    ],
  },
];
