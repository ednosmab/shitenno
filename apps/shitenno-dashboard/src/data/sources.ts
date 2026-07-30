const SHITENNO_ROOT = '../../../../../shitenno'

export const SOURCES = {
  fingerprint: `${SHITENNO_ROOT}/fingerprint.json`,
  maturityProfile: `${SHITENNO_ROOT}/maturity-profile.json`,
  contextBuffer: `${SHITENNO_ROOT}/governance/context/context_buffer.yaml`,
  backlog: `${SHITENNO_ROOT}/docs/backlog/ACTIVE.md`,
  feedbackSummary: `${SHITENNO_ROOT}/feedback/summary.json`,
  feedbackRecords: `${SHITENNO_ROOT}/feedback/records`,
  operationalState: `${SHITENNO_ROOT}/cognition/memory/MEM-operational-state-v1.json`,
  systemMap: `${SHITENNO_ROOT}/governance/SYSTEM_MAP.md`,
  knowledgeArtifacts: `${SHITENNO_ROOT}/governance/knowledge-graph/artifacts.json`,
  knowledgeRelations: `${SHITENNO_ROOT}/governance/knowledge-graph/relations.json`,
  agentsDir: `${SHITENNO_ROOT}/governance/agents`,
  telemetryDir: `${SHITENNO_ROOT}/telemetry`,
  reportsDir: `${SHITENNO_ROOT}/reports`,
} as const
