/**
 * use-handbook-nav.ts — Navigation hook for the interactive handbook
 *
 * Manages tree navigation, topic selection, scroll position,
 * and content display with history stack for back navigation.
 */

import { useState, useCallback, useMemo } from "react";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { HandbookLevel, HandbookTopic, ViewMode } from "../types.js";
import { TOPIC_REGISTRY } from "../data/topic-registry.js";

function findHandbookRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, "docs", "handbook"))) return join(dir, "docs", "handbook");
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(process.cwd(), "docs", "handbook");
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const HANDBOOK_ROOT = findHandbookRoot(__dirname);

// ── Build Levels ───────────────────────────────────────────────────────────

function buildLevels(): HandbookLevel[] {
  const levelMap = new Map<number, HandbookTopic[]>();

  for (const topic of TOPIC_REGISTRY) {
    const existing = levelMap.get(topic.level) || [];
    existing.push(topic);
    levelMap.set(topic.level, existing);
  }

  const levelNames: Record<number, { name: string; description: string }> = {
    1: { name: "Fundamentos", description: "Para qualquer pessoa" },
    2: { name: "Comandos", description: "Para developers" },
    3: { name: "Arquitetura", description: "Para architects" },
  };

  return Array.from(levelMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([number, topics]) => ({
      number,
      name: levelNames[number]?.name || `Nivel ${number}`,
      description: levelNames[number]?.description || "",
      topics,
    }));
}

// ── Read Topic Content ─────────────────────────────────────────────────────

function readTopicContent(topic: HandbookTopic): string | null {
  const filePath = join(HANDBOOK_ROOT, topic.file);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf-8");
}

// ── Navigation Items ───────────────────────────────────────────────────────

export interface NavItem {
  type: "level" | "topic";
  levelNumber: number;
  levelName: string;
  topic?: HandbookTopic;
  isSelected: boolean;
  isExpanded: boolean;
}

function buildNavItems(
  levels: HandbookLevel[],
  expandedLevel: number | null,
  selectedIndex: number
): NavItem[] {
  const items: NavItem[] = [];
  let currentIndex = 0;

  for (const level of levels) {
    const isExpanded = expandedLevel === level.number;
    items.push({
      type: "level",
      levelNumber: level.number,
      levelName: level.name,
      isSelected: currentIndex === selectedIndex,
      isExpanded,
    });
    currentIndex++;

    if (isExpanded) {
      for (const topic of level.topics) {
        items.push({
          type: "topic",
          levelNumber: level.number,
          levelName: level.name,
          topic,
          isSelected: currentIndex === selectedIndex,
          isExpanded: false,
        });
        currentIndex++;
      }
    }
  }

  return items;
}

export interface HandbookNavState {
  viewMode: ViewMode;
  levels: HandbookLevel[];
  expandedLevel: number | null;
  selectedIndex: number;
  sidebarScrollOffset: number;
  selectedTopic: HandbookTopic | null;
  content: string | null;
  navItems: NavItem[];
  totalItems: number;
}

function adjustScroll(selected: number, scroll: number, viewport: number): number {
  if (selected < scroll) return selected;
  if (selected >= scroll + viewport) return selected - viewport + 1;
  return scroll;
}

function expandLevelUpdate(prev: HandbookNavState, levelNumber: number): HandbookNavState {
  const newExpanded = prev.expandedLevel === levelNumber ? null : levelNumber;
  const newNavItems = buildNavItems(prev.levels, newExpanded, 0);
  return {
    ...prev, expandedLevel: newExpanded, selectedIndex: 0, sidebarScrollOffset: 0,
    navItems: newNavItems, totalItems: newNavItems.length, viewMode: "tree",
    selectedTopic: null, content: null,
  };
}

function moveUpdate(prev: HandbookNavState, delta: number, maxVisible: number | undefined): HandbookNavState {
  const newSelected = delta < 0
    ? Math.max(0, prev.selectedIndex + delta)
    : Math.min(prev.totalItems - 1, prev.selectedIndex + delta);
  const viewport = maxVisible ?? Infinity;
  return {
    ...prev,
    selectedIndex: newSelected,
    sidebarScrollOffset: adjustScroll(newSelected, prev.sidebarScrollOffset, viewport),
  };
}

function toggleLevelAt(prev: HandbookNavState, index: number, maxVisible?: number): HandbookNavState {
  const currentItem = prev.navItems[index];
  if (!currentItem || currentItem.type !== "level") return prev;
  const newExpanded = prev.expandedLevel === currentItem.levelNumber ? null : currentItem.levelNumber;
  const newNavItems = buildNavItems(prev.levels, newExpanded, index);
  const viewport = maxVisible ?? Infinity;
  return {
    ...prev,
    selectedIndex: index,
    sidebarScrollOffset: adjustScroll(index, prev.sidebarScrollOffset, viewport),
    expandedLevel: newExpanded,
    navItems: newNavItems,
    totalItems: newNavItems.length,
    viewMode: "tree",
    selectedTopic: null,
    content: null,
  };
}

function openTopicAt(prev: HandbookNavState, index: number): HandbookNavState {
  const currentItem = prev.navItems[index];
  if (!currentItem || currentItem.type !== "topic" || !currentItem.topic) return prev;
  return {
    ...prev,
    selectedIndex: index,
    viewMode: "content",
    selectedTopic: currentItem.topic,
    content: readTopicContent(currentItem.topic),
  };
}

function selectCurrentUpdate(prev: HandbookNavState): HandbookNavState {
  const currentItem = prev.navItems[prev.selectedIndex];
  if (!currentItem) return prev;
  if (currentItem.type === "level") {
    const newExpanded = prev.expandedLevel === currentItem.levelNumber ? null : currentItem.levelNumber;
    const newNavItems = buildNavItems(prev.levels, newExpanded, prev.selectedIndex);
    return { ...prev, expandedLevel: newExpanded, navItems: newNavItems, totalItems: newNavItems.length, sidebarScrollOffset: 0, viewMode: "tree", selectedTopic: null, content: null };
  }
  return openTopicAt(prev, prev.selectedIndex);
}

function goBackUpdate(prev: HandbookNavState): HandbookNavState {
  if (prev.viewMode !== "content") return prev;
  return { ...prev, viewMode: "tree", sidebarScrollOffset: 0, selectedTopic: null, content: null };
}

function jumpToLevelUpdate(prev: HandbookNavState, levelNumber: number): HandbookNavState {
  const level = prev.levels.find((l) => l.number === levelNumber);
  if (!level) return prev;
  const newNavItems = buildNavItems(prev.levels, levelNumber, 0);
  const firstTopicIndex = newNavItems.findIndex((item) => item.type === "level" && item.levelNumber === levelNumber);
  return {
    ...prev,
    expandedLevel: levelNumber,
    selectedIndex: firstTopicIndex >= 0 ? firstTopicIndex : 0,
    sidebarScrollOffset: 0,
    navItems: newNavItems,
    totalItems: newNavItems.length,
    viewMode: "tree",
    selectedTopic: null,
    content: null,
  };
}

function selectTopicByIdUpdate(prev: HandbookNavState, topicId: string): HandbookNavState {
  const topic = TOPIC_REGISTRY.find((t) => t.id === topicId);
  if (!topic) return prev;
  return { ...prev, viewMode: "content", selectedTopic: topic, content: readTopicContent(topic) };
}

function selectAtUpdate(prev: HandbookNavState, index: number, maxVisible?: number): HandbookNavState {
  const currentItem = prev.navItems[index];
  if (!currentItem) return prev;
  if (currentItem.type === "level") return toggleLevelAt(prev, index, maxVisible);
  return openTopicAt(prev, index);
}

export function useHandbookNav() {
  const levels = useMemo(() => buildLevels(), []);

  const [state, setState] = useState<HandbookNavState>(() => ({
    viewMode: "tree", levels, expandedLevel: null, selectedIndex: 0,
    sidebarScrollOffset: 0, selectedTopic: null, content: null,
    navItems: buildNavItems(levels, null, 0), totalItems: levels.length,
  }));

  const expandLevel = useCallback((levelNumber: number) => {
    setState((prev) => expandLevelUpdate(prev, levelNumber));
  }, []);

  const moveUp = useCallback((maxVisible?: number) => {
    setState((prev) => moveUpdate(prev, -1, maxVisible));
  }, []);

  const moveDown = useCallback((maxVisible?: number) => {
    setState((prev) => moveUpdate(prev, 1, maxVisible));
  }, []);

  const selectCurrent = useCallback(() => {
    setState(selectCurrentUpdate);
  }, []);

  const selectAt = useCallback((index: number, maxVisible?: number) => {
    setState((prev) => selectAtUpdate(prev, index, maxVisible));
  }, []);

  const goBack = useCallback(() => {
    setState(goBackUpdate);
  }, []);

  const jumpToLevel = useCallback((levelNumber: number) => {
    setState((prev) => jumpToLevelUpdate(prev, levelNumber));
  }, []);

  const selectTopicById = useCallback((topicId: string) => {
    setState((prev) => selectTopicByIdUpdate(prev, topicId));
  }, []);

  const setSidebarScroll = useCallback((offset: number) => {
    setState((prev) => ({ ...prev, sidebarScrollOffset: Math.max(0, offset) }));
  }, []);

  return {
    ...state,
    expandLevel, moveUp, moveDown, selectCurrent, selectAt,
    goBack, jumpToLevel, selectTopicById, setSidebarScroll,
  };
}
