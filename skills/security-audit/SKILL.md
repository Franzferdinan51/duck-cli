---
name: security-audit
description: "Security vulnerability scanning for dependencies, secrets, and supply chain"
license: MIT
triggers:
  - "/security"
  - "security audit"
  - "scan for vulnerabilities"
  - "check CVE"
bins:
  - npm
  - yarn
  - python
  - pip
env:
  SNYK_TOKEN: "Optional Snyk API token for enhanced scanning"
metadata:
  author: duck-cli
  version: "1.0"
---

# Security Audit Skill

Proactive security scanning for Duck CLI projects.

## Features

- **Dependency Scanning**: npm/yarn audit, Snyk integration
- **Secret Detection**: API keys, passwords, tokens in code
- **Supply Chain**: Package health, maintainer analysis
- **CVE Monitoring**: Real-time vulnerability alerts

## DEFCON Levels

| Level | Meaning | Action |
|-------|---------|--------|
| 🟢 5 | All clear | No action needed |
| 🟡 4 | Minor issues | Review recommended |
| 🟠 3 | Significant | Fix soon |
| 🔴 2 | High risk | Fix immediately |
| 🔴🔴 1 | Critical | Emergency response |

## Usage

```
/security audit
/security scan --full
/security check <package>
```

## Environment

- `SNYK_TOKEN`: Optional Snyk API key for enhanced scanning
