/**
 * Audit module — Dimension Mapping
 *
 * Maps HealthIssueType to audit dimensions for the Health Card report.
 * Dimensions: security, reliability, complexity, hygiene, coverage, governance.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type AuditDimension = "security" | "reliability" | "complexity" | "hygiene" | "coverage" | "governance";

// ── Dimension Mapping ───────────────────────────────────────────────────────

/**
 * Maps each HealthIssueType to its corresponding dimension.
 * Types without a mapping fall back to "hygiene" by default.
 */
export const DIMENSION_BY_TYPE: Partial<Record<string, AuditDimension>> = {
  // Security (SEC-*)
  hardcoded_secret: "security",
  sql_injection: "security",
  xss_risk: "security",
  command_injection: "security",
  weak_crypto: "security",
  insecure_cors: "security",
  insecure_cookie: "security",
  weak_randomness: "security",
  unsafe_eval: "security",
  console_secret: "security",
  proto_pollution: "security",
  regex_dos: "security",
  unsafe_deserialize: "security",
  dep_confusion: "security",
  tainted_input: "security",
  open_redirect: "security",
  ssrf: "security",
  log_injection: "security",
  code_injection: "security",
  path_traversal: "security",
  config_secret: "security",
  config_secrets: "security",
  missing_encryption: "security",
  weak_access_controls: "security",
  missing_auth: "security",
  missing_sbom: "security",
  unverified_provenance: "security",
  typosquatting_risk: "security",
  license_conflict: "security",
  transitive_vuln: "security",
  malware_pattern: "security",

  // Reliability (REL-*)
  missing_circuit_breaker: "reliability",
  race_condition_risk: "reliability",
  deadlock_risk: "reliability",
  missing_retry_policy: "reliability",
  missing_timeout: "reliability",
  missing_health_check: "reliability",
  no_graceful_degradation: "reliability",

  // Complexity (CMP-*)
  high_complexity: "complexity",
  god_function: "complexity",
  deep_nesting: "complexity",
  duplicate_code: "complexity",
  long_params: "complexity",

  // Hygiene (HYG-*)
  console_log_outside_cmd: "hygiene",
  empty_catch: "hygiene",
  dead_code: "hygiene",
  unused_export: "hygiene",
  unused_import: "hygiene",
  magic_numbers: "hygiene",
  missing_jsdoc: "hygiene",
  unsafe_type_assertion: "hygiene",
  unreachable_code: "hygiene",
  import_order_violation: "hygiene",
  barrel_file_bloat: "hygiene",
  high_coupling: "hygiene",
  layer_violation: "hygiene",
  srp_violation: "hygiene",
  dip_violation: "hygiene",
  flat_test_structure: "hygiene",
  oversized_file: "hygiene",
  orphan_module: "hygiene",

  // Coverage (COV-*)
  missing_test: "coverage",
  low_coverage_threshold: "coverage",
  test_failure: "coverage",

  // Governance (GOV-*)
  dead_rule: "governance",
  broken_ref: "governance",
  adr_coverage_gap: "governance",
  system_map_mismatch: "governance",
  cross_doc_p0_contradiction: "governance",
  missing_docs: "governance",
  date_placeholder: "governance",
  empty_dir: "governance",
  missing_gitignore: "governance",
  maturity_inconsistency: "governance",
  missing_package_json: "governance",
  bare_word_ref: "governance",
  template_dir_ref: "governance",
  extension_mismatch: "governance",
  broken_command: "governance",
  p0_inconsistency: "governance",
  triple_maturity_score: "governance",
  empty_stack: "governance",
  script_wiring: "governance",
  agent_contract_ref: "governance",
  buffer_schema_mismatch: "governance",
  rule_typo: "governance",
  numbering_gap: "governance",
  doc_count_mismatch: "governance",
  empty_data_file: "governance",
  phantom_rule_ref: "governance",
  violation_hotspot: "governance",
  orphan_dir: "governance",
  broken_manifest_ref: "governance",
  stale_buffer: "governance",
  session_not_closed: "governance",
  buffer_not_pruned: "governance",
  missing_feedback_dir: "governance",
  no_feedback_records: "governance",
  invalid_backlog_state: "governance",
  plan_format_violation: "governance",
  invalid_rule_structure: "governance",
  malformed_rule_json: "governance",
  missing_policies_dir: "governance",
  missing_policy: "governance",
  missing_premortem: "governance",
  no_adrs_created: "governance",
  commit_format_violation: "governance",
  branch_naming_violation: "governance",
  direct_main_commits: "governance",
  force_push_detected: "governance",
  orphan_branches: "governance",
  non_english_commit: "governance",
  secret_in_git_history: "governance",
  missing_quality_gates: "governance",

  // Product/Strategy (ENT-*)
  missing_vision_doc: "governance",
  vision_roadmap_gap: "governance",
  roadmap_stale: "governance",
  missing_kpis: "governance",
  orphan_requirement: "governance",
  broken_traceability: "governance",
  ambiguous_requirement: "governance",

  // Data Architecture (ENT-DATA-*)
  schema_doc_code_mismatch: "governance",
  missing_data_owner: "governance",
  missing_migration: "governance",
  unindexed_query: "governance",

  // Performance (ENT-PERF-*)
  n_plus_one_query: "complexity",
  missing_cache_strategy: "complexity",
  stateful_service: "complexity",
  missing_rate_limit: "complexity",

  // Observability (ENT-OBS-*)
  missing_tracing: "reliability",
  unstructured_logs: "hygiene",
  missing_alerts: "reliability",
  missing_metrics: "reliability",
  missing_dashboard: "reliability",
  missing_log_retention: "governance",
  missing_correlation_id: "reliability",
  missing_slo: "governance",

  // Operations (ENT-OPS-*)
  incomplete_pipeline: "governance",
  missing_rollback: "reliability",
  missing_runbooks: "governance",
  missing_monitoring: "reliability",
  missing_incident_plan: "governance",
  missing_dr_plan: "governance",
  missing_capacity_plan: "governance",
  missing_change_mgmt: "governance",

  // Compliance (ENT-COMP-*)
  owasp_gap: "security",
  cwe_gap: "security",
  soc2_gap: "governance",
  nist_gap: "governance",
  lgpd_gap: "governance",
  missing_retention_policy: "governance",
  missing_consent: "governance",
  missing_audit_log: "governance",
  missing_compliance_report: "governance",

  // Tech Debt (ENT-DEBT-*)
  tech_debt_cost: "complexity",
  high_tdr: "complexity",
  high_remediation_effort: "complexity",
  debt_increasing: "complexity",
  debt_hotspot: "complexity",
  debt_domain_imbalance: "complexity",
  low_roi_refactoring: "complexity",
  debt_accelerating: "complexity",

  // Supply Chain (ENT-SC-*)
  incomplete_sbom: "security",
  outdated_dependencies: "hygiene",
  unused_dependencies: "hygiene",
  missing_lock: "hygiene",
  duplicate_dependencies: "hygiene",
  unaudited_dependencies: "security",

  // Dependency issues
  unpinned_version: "hygiene",
  missing_lock_file: "hygiene",
  lock_file_drift: "hygiene",
  phantom_dep: "hygiene",
  deprecated_package: "hygiene",
  dependency_vulnerability: "security",
  incompatible_license: "governance",

  // Taint analysis
  tainted_file: "security",

  // Context Tier
  tier_promotion_candidate: "governance",
};

// ── Helper Functions ────────────────────────────────────────────────────────

/**
 * Returns the dimension for a given issue type.
 * Falls back to "hygiene" if no mapping exists.
 */
export function dimensionOf(type: string): AuditDimension {
  return DIMENSION_BY_TYPE[type] ?? "hygiene";
}

/**
 * Returns all defined dimensions.
 */
export function getAllDimensions(): AuditDimension[] {
  return ["security", "reliability", "complexity", "hygiene", "coverage", "governance"];
}

/**
 * Returns the icon for each dimension.
 */
export function dimensionIcon(dimension: AuditDimension): string {
  const icons: Record<AuditDimension, string> = {
    security: "🔒",
    reliability: "🛡️",
    complexity: "🧩",
    hygiene: "🧹",
    coverage: "✅",
    governance: "🏛️",
  };
  return icons[dimension];
}

/**
 * Returns the label for each dimension.
 */
export function dimensionLabel(dimension: AuditDimension): string {
  const labels: Record<AuditDimension, string> = {
    security: "Segurança",
    reliability: "Confiabilidade",
    complexity: "Complexidade",
    hygiene: "Higiene",
    coverage: "Cobertura",
    governance: "Governança",
  };
  return labels[dimension];
}
