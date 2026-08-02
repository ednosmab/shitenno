/**
 * Audit types — Governance optimization
 */

/** Sugestão de optimização de governança. */
export interface GovernanceOptimization {
  id: string;
  title: string;
  description: string;
  action:
    | "remove_rule"
    | "rewrite_rule"
    | "promote_to_lint"
    | "add_docs"
    | "fix_dates"
    | "populate_dir"
    | "fix_refs"
    | "add_gitignore"
    | "reconcile_scores"
    | "create_adr"
    | "create_package_json"
    | "fix_bare_refs"
    | "fix_template_dirs"
    | "fix_extensions"
    | "reconcile_system_map"
    | "fix_commands"
    | "reconcile_p0"
    | "fix_triple_score"
    | "fix_stack"
    | "wire_scripts"
    | "fix_contract_refs"
    | "fix_buffer_schema"
    | "fix_typos"
    | "fix_numbering"
    | "fix_doc_counts"
    | "reconcile_p0_cross_doc"
    | "fix_empty_files"
    | "fix_phantom_rule_refs"
    | "add_test"
    | "split_module"
    | "fix_lint"
    | "add_type"
    | "remove_console_log"
    | "fix_empty_catch"
    | "break_cycle"
    | "reduce_complexity"
    | "remove_unused_export"
    | "remove_dead_code"
    | "pin_version"
    | "add_lock_file"
    | "sync_lock_file"
    | "add_missing_dep"
    | "replace_deprecated"
    // Taint analysis actions
    | "sanitize_input"
    | "fix_taint_flow";
  affectedRule: string;
  evidence: string[];
}
