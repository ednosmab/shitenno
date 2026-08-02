---
category: architecture
lifecycle: Active
---

# 25 — QUALITY ATTRIBUTES

> Performance, security, usability, maintainability.

## Performance

### Scoring Engine
- **Small project** (20 files, 3 areas): <20ms
- **Medium project** (100 files, 8 areas): <50ms
- **Large project** (500 files, 20 areas): <150ms
- **Cache hit**: <1ms

### Pipeline
- **Full pipeline** (analyze → score → detect → audit → evolve): <500ms
- **Single stage**: <200ms

### Memory
- **Peak memory**: <100MB for large projects
- **No memory leaks**: All file handles closed

## Security

### File System
- Read-only by default (except reports and cache)
- No arbitrary file writes
- No symlink following outside project root

### Rule Engine
- `run_script` action has 30-second timeout
- No shell injection (params are not interpolated into shell)
- Scripts execute in project context, not system context

### Plugin System
- Plugins run in same process (no sandboxing)
- Plugin errors are caught, not propagated
- No network access from plugins (by convention)

### Data Privacy
- Feedback is stored locally only
- No telemetry sent externally
- No personally identifiable information collected

## Usability

### CLI Output
- Human-readable by default
- `--json` flag for machine consumption
- Color-coded status indicators (✔ ⚠ ✘)
- Progress bars for long operations

### Error Messages
- Clear description of what went wrong
- Suggested fix or next action
- Consistent error format across commands

### Documentation
- Each command has `--help`
- Architecture docs in docs/architecture/
- Examples in each document

## Maintainability

### Code Organization
- Single responsibility per module
- Clear interfaces between modules
- No circular dependencies

### Testing
- Unit tests for all core modules
- Integration tests for CLI commands
- Benchmark tests for performance

### Documentation
- 30 architecture documents
- Each document is self-contained
- Documents reference each other via links

## Reliability

### Error Handling
- Graceful degradation on file system errors
- Cache corruption recovery
- Invalid YAML/JSON handling

### Idempotency
- `shugo init` detects existing initialization
- `shugo upgrade` checks if capability already installed
- `shugo assess` overwrites previous profile cleanly

### Backward Compatibility
- New capabilities don't break existing installations
- New commands don't affect existing workflows
- Report format additions are additive
