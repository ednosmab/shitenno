import type { EngineeringState, AssetType } from "../../engineering-state.js";
import { MAX_PENDING_DELTAS, type StateDelta } from "./types.js";

export class IncrementalConsolidator {
  private version = 0;
  private _lastConsolidated: string = "";
  private pendingDeltas: StateDelta[] = [];

  getLastConsolidated(): string { return this._lastConsolidated; }

  private diffDimensionsChanges(
    previous: EngineeringState | null,
    current: EngineeringState,
  ): StateDelta["dimensionsChanged"] {
    if (!previous?.maturity?.dimensions || !current.maturity?.dimensions) return [];
    const prevDims = previous.maturity.dimensions as unknown as Record<string, number>;
    const currDims = current.maturity.dimensions as unknown as Record<string, number>;
    const changes: StateDelta["dimensionsChanged"] = [];
    for (const key of Object.keys(currDims)) {
      const prev = prevDims[key] ?? 0;
      const curr = currDims[key] ?? 0;
      if (prev !== curr) {
        changes.push({ dimension: key, previousScore: prev, newScore: curr, delta: curr - prev });
      }
    }
    return changes;
  }

  private diffAssets(
    previous: EngineeringState | null,
    current: EngineeringState,
  ): { assetsAdded: EngineeringState["assets"]; assetsRemoved: string[] } {
    const prevAssetIds = new Set((previous?.assets ?? []).map((a) => a.id));
    const currAssetIds = new Set(current.assets.map((a) => a.id));
    return {
      assetsAdded: current.assets.filter((a) => !prevAssetIds.has(a.id)),
      assetsRemoved: (previous?.assets ?? []).filter((a) => !currAssetIds.has(a.id)).map((a) => a.id),
    };
  }

  computeDelta(
    previous: EngineeringState | null,
    current: EngineeringState
  ): StateDelta {
    const { assetsAdded, assetsRemoved } = this.diffAssets(previous, current);
    const dimensionsChanged = this.diffDimensionsChanges(previous, current);
    const prevHealth = previous?.healthScores?.overall ?? 0;
    const currHealth = current.healthScores?.overall ?? 0;

    return {
      timestamp: new Date().toISOString(),
      assetsAdded,
      assetsRemoved,
      dimensionsChanged,
      capabilitiesChanged: [],
      healthChanges: {
        previous: prevHealth,
        current: currHealth,
        delta: currHealth - prevHealth,
      },
    };
  }

  applyDelta(
    current: EngineeringState,
    delta: StateDelta
  ): { state: EngineeringState; version: number } {
    this.version++;
    this._lastConsolidated = delta.timestamp;
    this.pendingDeltas.push(delta);
    if (this.pendingDeltas.length > MAX_PENDING_DELTAS) {
      this.pendingDeltas = this.pendingDeltas.slice(-MAX_PENDING_DELTAS);
    }

    const newAssets = [...current.assets, ...delta.assetsAdded];
    const removedIds = new Set(delta.assetsRemoved);
    const filteredAssets = newAssets.filter((a) => !removedIds.has(a.id));

    const assetsByType: Record<string, number> = {};
    for (const asset of filteredAssets) {
      assetsByType[asset.type] = (assetsByType[asset.type] ?? 0) + 1;
    }

    return {
      state: {
        ...current,
        assets: filteredAssets,
        assetsByType: assetsByType as Record<AssetType, number>,
        consolidatedAt: delta.timestamp,
      },
      version: this.version,
    };
  }

  getVersion(): number {
    return this.version;
  }

  getPendingDeltas(): StateDelta[] {
    return [...this.pendingDeltas];
  }

  clearPendingDeltas(): void {
    this.pendingDeltas = [];
  }
}
