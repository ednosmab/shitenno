/**
 * index.tsx — ShitennoConsole main component
 *
 * Root component that manages tab navigation, keyboard input,
 * mouse events, and screen reader accessibility.
 */

import React, { useRef } from "react";
import { Box, Text, useInput } from "ink";
import { MouseProvider, useOnWheel } from "@ink-tools/ink-mouse";
import { TabBar } from "./components/tab-bar.js";
import { Footer, DEFAULT_HINTS } from "./components/footer.js";
import { useNavigate } from "./hooks/use-navigate.js";
import { useRefresh } from "./hooks/use-refresh.js";
import { OverviewTab } from "./tabs/overview.js";
import { EngineeringTab } from "./tabs/engineering.js";
import { ArchitectureTab } from "./tabs/architecture.js";
import { KnowledgeTab } from "./tabs/knowledge.js";
import { HealthTab } from "./tabs/health.js";
import { GoalsTab } from "./tabs/goals.js";
import { DecisionsTab } from "./tabs/decisions.js";
import { SessionsTab } from "./tabs/sessions.js";
import { EventsTab } from "./tabs/events.js";
import { LifecycleTab } from "./tabs/lifecycle.js";
import { CommandsTab } from "./tabs/commands.js";
import { ErrorBoundary } from "./components/error-boundary.js";


// ── Tab Definitions ────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", shortcut: "1" },
  { id: "engineering", label: "Engineering", shortcut: "2" },
  { id: "architecture", label: "Architecture", shortcut: "3" },
  { id: "knowledge", label: "Knowledge", shortcut: "4" },
  { id: "health", label: "Health", shortcut: "5" },
  { id: "goals", label: "Goals", shortcut: "6" },
  { id: "decisions", label: "Decisions", shortcut: "7" },
  { id: "sessions", label: "Sessions", shortcut: "8" },
  { id: "events", label: "Events", shortcut: "9" },
  { id: "lifecycle", label: "Lifecycle", shortcut: "0" },
  { id: "commands", label: "Commands", shortcut: "c" },
];

// ── Props ──────────────────────────────────────────────────────────────────

interface ShitennoConsoleProps {
  projectRoot: string;
  shitennoDir: string;
  refreshInterval?: number;
  isScreenReaderEnabled?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

// ── Inner Component (inside MouseProvider) ──────────────────────────────────

function ShitennoConsoleInner({
  projectRoot,
  shitennoDir,
  refreshInterval,
  isScreenReaderEnabled,
}: ShitennoConsoleProps): React.ReactElement {
  const { data, refresh, } = useRefresh(projectRoot, shitennoDir, refreshInterval);
  const nav = useNavigate(TABS.length);

  const contentRef = useRef(null);

  // Show loading state while data is being fetched
  if (!data) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan">Loading dashboard data...</Text>
      </Box>
    );
  }

  // Mouse wheel scroll
  useOnWheel(contentRef, (event) => {
    if (event.button === "wheel-up") {
      nav.scrollUp();
    } else if (event.button === "wheel-down") {
      nav.scrollDown();
    }
  });

  // Keyboard navigation
  useInput((input, key) => {
    // Quit
    if (input === "q" || (key.ctrl && input === "c")) {
      process.exit(0);
    }

    // Refresh
    if (input === "r") {
      refresh();
      return;
    }

    // Tab navigation (left/right arrows)
    if (key.leftArrow) {
      nav.prevTab();
      return;
    }
    if (key.rightArrow) {
      nav.nextTab();
      return;
    }

    // Tab cycling
    if (key.tab) {
      if (key.shift) {
        nav.prevTab();
      } else {
        nav.nextTab();
      }
      return;
    }

    // Escape — go back or exit
    if (key.escape) {
      if (nav.canGoBack) {
        nav.goBack();
      } else {
        process.exit(0);
      }
      return;
    }

    // Enter — expand/select
    if (key.return) {
      // Expand item based on current tab
      const expandMap: Record<number, string> = {
        5: "goal",
        6: "decision",
        7: "session-metrics",
      };
      const prefix = expandMap[nav.activeTab];
      if (prefix) {
        const itemId = `${prefix}-${nav.scrollOffset}`;
        nav.expandItem(itemId);
      }
      return;
    }

    // Arrow keys for scrolling within a tab
    if (key.upArrow) {
      nav.scrollUp();
      return;
    }
    if (key.downArrow) {
      nav.scrollDown();
      return;
    }

    // Number keys for direct tab access
    if (input >= "0" && input <= "9") {
      const index = input === "0" ? 9 : parseInt(input) - 1;
      if (index < TABS.length) {
        nav.goToTab(index);
      }
      return;
    }

    // 'c' key for commands tab
    if (input === "c" || input === "C") {
      nav.goToTab(10);
      return;
    }
  });

  // Render the active tab with error boundary
  const renderTab = (): React.ReactElement => {
    const tabName = TABS[nav.activeTab]?.label ?? "Unknown";
    let content: React.ReactElement;

    switch (nav.activeTab) {
      case 0: content = <OverviewTab data={data} scrollOffset={nav.scrollOffset} />; break;
      case 1: content = <EngineeringTab data={data} scrollOffset={nav.scrollOffset} />; break;
      case 2: content = <ArchitectureTab data={data} scrollOffset={nav.scrollOffset} />; break;
      case 3: content = <KnowledgeTab data={data} scrollOffset={nav.scrollOffset} />; break;
      case 4: content = <HealthTab data={data} scrollOffset={nav.scrollOffset} />; break;
      case 5: content = <GoalsTab data={data} scrollOffset={nav.scrollOffset} expandedItem={nav.expandedItem} onExpandItem={nav.expandItem} />; break;
      case 6: content = <DecisionsTab data={data} scrollOffset={nav.scrollOffset} expandedItem={nav.expandedItem} onExpandItem={nav.expandItem} />; break;
      case 7: content = <SessionsTab data={data} scrollOffset={nav.scrollOffset} expandedItem={nav.expandedItem} onExpandItem={nav.expandItem} />; break;
      case 8: content = <EventsTab data={data} scrollOffset={nav.scrollOffset} />; break;
      case 9: content = <LifecycleTab data={data} scrollOffset={nav.scrollOffset} />; break;
      case 10: content = <CommandsTab projectRoot={projectRoot} />; break;
      default: content = <OverviewTab data={data} scrollOffset={nav.scrollOffset} />;
    }

    return <ErrorBoundary tabName={tabName}>{content}</ErrorBoundary>;
  };

  // Screen reader mode: linearized output
  if (isScreenReaderEnabled) {
    const currentTab = TABS[nav.activeTab];
    const tabLabel = currentTab?.label ?? "Overview";
    return (
      <Box flexDirection="column" aria-label="Shugo Console Dashboard">
        <Box aria-label={`Current tab: ${tabLabel}`}>
          <Text>
            Tab {nav.activeTab + 1} of {TABS.length}: {tabLabel}
          </Text>
        </Box>
        {renderTab()}
        <Box aria-label="Navigation: Use arrow keys to switch tabs. Press q to quit.">
          <Text>
            Navigation: Left/Right arrows to switch tabs. Number keys 1-0 for direct access.
            Press q to quit. Press r to refresh.
          </Text>
        </Box>
      </Box>
    );
  }

  // Normal mode: rich visual output
  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box
        borderStyle="double"
        borderColor="cyan"
        paddingX={1}
        justifyContent="space-between"
      >
        <Box>
          <Text bold color="cyan">SHUGO CONSOLE v0.1.0</Text>
        </Box>
        <Box>
          <Text dimColor>{data.timestamp.slice(0, 16).replace("T", " ")}</Text>
          <Text> │ </Text>
          <Text color="green">{data.lifecycle}</Text>
        </Box>
      </Box>

      {/* Tab Bar */}
      <TabBar
        tabs={TABS}
        activeIndex={nav.activeTab}
        onSelect={nav.goToTab}
        ariaLabel="Navigation tabs"
      />

      {/* Main Content */}
      <Box ref={contentRef} flexGrow={1} padding={1} flexDirection="column">
        {renderTab()}
      </Box>

      {/* Footer */}
      <Footer
        hints={DEFAULT_HINTS}
        mode={refreshInterval && refreshInterval > 0 ? `Live (${refreshInterval / 1000}s)` : undefined}
      />
    </Box>
  );
}

// ── Root Component (with MouseProvider) ─────────────────────────────────────

export function ShitennoConsole(props: ShitennoConsoleProps): React.ReactElement {
  return (
    <MouseProvider autoEnable={true}>
      <ShitennoConsoleInner {...props} />
    </MouseProvider>
  );
}
