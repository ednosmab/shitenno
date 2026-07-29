import type { CommandCategory } from "../help-data.js";

export const CORE_CATEGORIES: CommandCategory[] = [
  {
    name: "Setup & Configuration",
    description: "Initialize and configure your Shugo project",
    commands: [
      {
        name: "init",
        description: "Initialize Shugo ecosystem with maturity-based discovery",
        usage: "shugo init [options]",
        examples: [
          "shugo init                          # Interactive setup",
          "shugo init --dir ./my-project        # Initialize specific directory",
          "shugo init --answers-file config.json # Non-interactive mode",
        ],
        tips: [
          "Run this first to set up governance in your project",
          "If already initialized, re-runs maturity questionnaire",
        ],
      },
      {
        name: "mcp",
        description: "MCP server for AI agents — start server or install globally",
        usage: "shugo mcp [options] [command]",
        examples: [
          "shugo mcp                    # Start MCP server",
          "shugo mcp --project-root .   # Specify project root",
          "shugo mcp install            # Install MCP Filesystem server",
          "shugo mcp install --check    # Check installation status",
          "shugo mcp install --upgrade  # Upgrade to latest version",
        ],
        tips: [
          "Connect your AI agent to this server for live project context",
          "Run 'shugo mcp install' once to fix MCP timeout issues",
        ],
      },
      {
        name: "upgrade",
        description: "Add capabilities to your governance ecosystem",
        usage: "shugo upgrade [options]",
        examples: [
          "shugo upgrade                          # Show available capabilities",
          "shugo upgrade --capability architecture # Install specific capability",
          "shugo upgrade --accept-recommended     # Install all recommended",
        ],
      },
      {
        name: "clean",
        description: "Clear shugo cache and temporary files",
        usage: "shugo clean [options]",
        examples: [
          "shugo clean              # Clear all cache",
          "shugo clean --dry-run    # Preview what would be deleted",
        ],
      },
    ],
  },
  {
    name: "Status & Analysis",
    description: "Check project health, maturity, and patterns",
    commands: [
      {
        name: "status",
        description: "Check governance health status with maturity score",
        usage: "shugo status [options]",
        examples: [
          "shugo status              # Full health report",
          "shugo status --json       # JSON output",
          "shugo status --no-cache   # Skip cache, recalculate",
        ],
      },
      {
        name: "audit",
        description: "Audit governance health, knowledge graph, and issues",
        usage: "shugo audit [options]",
        examples: [
          "shugo audit               # Full audit with health score",
          "shugo audit --json        # JSON output for CI/CD",
        ],
        tips: [
          "Shows health score (0-100), issues, and knowledge graph status",
          "Run periodically to track governance health over time",
        ],
      },
      {
        name: "doctor",
        description: "Engineering mentor — identify risks and suggest improvements",
        usage: "shugo doctor [options]",
        examples: [
          "shugo doctor              # Full diagnostic report",
          "shugo doctor --json       # JSON output",
        ],
      },
      {
        name: "assess",
        description: "Re-evaluate project maturity and recommend new capabilities",
        usage: "shugo assess [options]",
        examples: [
          "shugo assess              # Interactive re-assessment",
          "shugo assess --json       # JSON output",
        ],
        tips: [
          "Run when your project has grown to discover new capabilities",
        ],
      },
      {
        name: "detect",
        description: "Detect patterns in history and propose candidate rules",
        usage: "shugo detect [options]",
        examples: [
          "shugo detect              # Analyze history for patterns",
          "shugo detect --json       # JSON output",
        ],
      },
    ],
  },
  {
    name: "Pipeline & Execution",
    description: "Run analysis pipelines and execute governance actions",
    commands: [
      {
        name: "run",
        description: "Run the full analysis pipeline (analyze → score → detect → audit → evolve)",
        usage: "shugo run [options]",
        examples: [
          "shugo run                 # Run full pipeline",
          "shugo run --json          # JSON output",
        ],
        tips: [
          "Combines all analysis stages in one command",
          "Useful for CI/CD or periodic health checks",
        ],
      },
      {
        name: "evolve",
        description: "Show evolution recommendations and manage feedback",
        usage: "shugo evolve [options]",
        examples: [
          "shugo evolve              # Show recommendations",
          "shugo evolve --json       # JSON output",
        ],
      },
      {
        name: "act",
        description: "Execute actions with idempotency guarantees",
        usage: "shugo act [options]",
        examples: [
          "shugo act create --title 'Fix auth' --action-type bugfix",
          "shugo act list            # List all actions",
        ],
      },
      {
        name: "plan",
        description: "Manage coordinated action sequences (plans)",
        usage: "shugo plan <subcommand> [options]",
        examples: [
          "shugo plan create my-plan           # Create a plan",
          "shugo plan execute <plan-id>        # Execute a plan",
          "shugo plan list                     # List all plans",
          "shugo plan show <plan-id>           # Show plan details",
        ],
      },
    ],
  },
  {
    name: "Governance",
    description: "Manage goals, decisions, and policies",
    commands: [
      {
        name: "goal",
        description: "Manage governance goals",
        usage: "shugo goal <subcommand> [options]",
        examples: [
          "shugo goal create --title 'Improve tests' --priority high",
          "shugo goal list            # List all goals",
          "shugo goal show <id>       # Show goal details",
        ],
      },
      {
        name: "decide",
        description: "Evaluate proposed actions using specialized evaluators",
        usage: "shugo decide <action> [options]",
        examples: [
          'shugo decide "upgrade auth to OAuth2"',
          'shugo decide "add rate limiting" --category security',
          "shugo decide list          # List all decisions",
        ],
        tips: [
          "Evaluates risk, impact, confidence, and goal alignment",
        ],
      },
      {
        name: "policy",
        description: "Manage and evaluate declarative governance policies",
        usage: "shugo policy <subcommand> [options]",
        examples: [
          "shugo policy list          # List all policies",
          "shugo policy evaluate      # Evaluate current state against policies",
        ],
      },
    ],
  },
];
