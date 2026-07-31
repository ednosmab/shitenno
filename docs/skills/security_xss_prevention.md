---
name: security_xss_prevention
description: >
  Guidelines for preventing XSS in CLI output and web interfaces. Load before any
  feature that renders user-supplied data or external input.
---
category: product
lifecycle: Active

# Security: XSS Prevention

## Core Rules

1. **NEVER** use `innerHTML` or `dangerouslySetInnerHTML` in web UIs.
2. **Sanitize** all user input before rendering in HTML contexts.
3. **Prefer `textContent`** over `innerHTML` for displaying user data.
4. **Escape special characters** in CLI output that may be rendered in terminals (e.g., ANSI sequences, ANSI escape codes).
5. **Validate and sanitize** all data from external sources (files, network, env vars) before display.

## Sanitization Checklist

- [ ] Input is validated against an allowlist (type, length, charset).
- [ ] Output encoding applied (HTML entity encoding for web, ANSI stripping for CLI).
- [ ] No raw user data interpolated into template strings or shell commands.
- [ ] External file contents escaped before rendering.

## References

- `docs/DESDO.md` — Security section
- `docs/FORBIDDEN_OPERATIONS.md` — Production safety rules
