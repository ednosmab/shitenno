/**
 * use-navigate.ts — Navigation hook with history stack and scroll
 *
 * Manages tab navigation, section depth, and scroll position.
 * Supports ESC to go back, Tab to cycle tabs, mouse wheel scroll.
 */

import { useState, useCallback } from "react";

export interface NavigationState {
  activeTab: number;
  history: number[];
  expandedItem: string | null;
  scrollOffset: number;
}

function computeGoToTab(prev: NavigationState, index: number, totalTabs: number): NavigationState {
  const clamped = Math.max(0, Math.min(index, totalTabs - 1));
  return {
    ...prev,
    activeTab: clamped,
    history: [...prev.history, clamped],
    expandedItem: null,
    scrollOffset: 0,
  };
}

function computeNextTab(prev: NavigationState, totalTabs: number): NavigationState {
  const next = (prev.activeTab + 1) % totalTabs;
  return {
    ...prev,
    activeTab: next,
    history: [...prev.history, next],
    expandedItem: null,
    scrollOffset: 0,
  };
}

function computePrevTab(prev: NavigationState, totalTabs: number): NavigationState {
  const next = (prev.activeTab - 1 + totalTabs) % totalTabs;
  return {
    ...prev,
    activeTab: next,
    history: [...prev.history, next],
    expandedItem: null,
    scrollOffset: 0,
  };
}

function computeGoBack(prev: NavigationState): NavigationState {
  if (prev.history.length <= 1) return prev;
  const newHistory = prev.history.slice(0, -1);
  const previousTab = newHistory[newHistory.length - 1] ?? 0;
  return {
    ...prev,
    activeTab: previousTab,
    history: newHistory,
    expandedItem: null,
    scrollOffset: 0,
  };
}

function computeExpandItem(prev: NavigationState, itemId: string): NavigationState {
  return { ...prev, expandedItem: prev.expandedItem === itemId ? null : itemId };
}

function computeScrollUp(prev: NavigationState): NavigationState {
  return { ...prev, scrollOffset: Math.max(0, prev.scrollOffset - 1) };
}

function computeScrollDown(prev: NavigationState): NavigationState {
  return { ...prev, scrollOffset: prev.scrollOffset + 1 };
}

function computeResetScroll(prev: NavigationState): NavigationState {
  return { ...prev, scrollOffset: 0 };
}

export function useNavigate(totalTabs: number) {
  const [state, setState] = useState<NavigationState>({
    activeTab: 0,
    history: [0],
    expandedItem: null,
    scrollOffset: 0,
  });
  const goToTab = useCallback((index: number) => {
    setState((prev) => computeGoToTab(prev, index, totalTabs));
  }, [totalTabs]);
  const nextTab = useCallback(() => {
    setState((prev) => computeNextTab(prev, totalTabs));
  }, [totalTabs]);
  const prevTab = useCallback(() => {
    setState((prev) => computePrevTab(prev, totalTabs));
  }, [totalTabs]);
  const goBack = useCallback(() => {
    setState((prev) => computeGoBack(prev));
  }, []);
  const expandItem = useCallback((itemId: string) => {
    setState((prev) => computeExpandItem(prev, itemId));
  }, []);
  const scrollUp = useCallback(() => {
    setState(computeScrollUp);
  }, []);
  const scrollDown = useCallback(() => {
    setState(computeScrollDown);
  }, []);
  const resetScroll = useCallback(() => {
    setState(computeResetScroll);
  }, []);
  const canGoBack = state.history.length > 1;
  return {
    ...state,
    goToTab,
    nextTab,
    prevTab,
    goBack,
    expandItem,
    scrollUp,
    scrollDown,
    resetScroll,
    canGoBack,
  };
}
