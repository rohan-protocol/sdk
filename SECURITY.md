# Security Policy

Rohan Protocol is dedicated to safeguarding autonomous AI agents and enterprise tool executions against prompt injection, context data exfiltration, and residual memory leakage. We treat security reports with the highest priority and appreciate the responsible disclosure efforts of the security research community.

---

## 📦 Supported Versions

Only the latest major/minor releases receive active security updates and cryptographic patches. All prototype versions prior to v0.6.0 (including legacy mock circuits and deprecated testnet contracts) are obsolete.

| Package / Version | Supported | Notes |
| :--- | :--- | :--- |
| **`@rohan-protocol/* >= 0.6.0`** | :white_check_mark: | Active production release (Contract: `585ac0c...`) |
| `@rohan-protocol/* < 0.6.0` | :x: | Deprecated prototypes & pre-release builds |

---

## 🛡️ Scope of Security Register

We actively investigate vulnerability reports concerning our core architectural threat mitigations:

- **Vector V-01 (Semantic Firewall):** Bypasses or jailbreaks that circumvent prompt injection filters or schema validations in `@rohan-protocol/mcp`.
- **Vector V-02 (Volatile Memory Zeroization):** Memory-scraping attacks or compiler dead-store optimizations that leave plaintext witness buffers ($w$) unscrubbed in client RAM.
- **Vector V-05 (Transport & Socket Resilience):** Resource exhaustion, replay attacks, or stream tampering within our Streamable HTTP (NDJSON) pipeline.
- **Vector V-07 (DOM & WebWorker Isolation):** Steganographic text smuggling, zero-width Unicode injection (`[\u200B-\u200D\uFEFF]`), or thread-boundary bypasses in `@rohan-protocol/webmcp`.
- **Relayer Infrastructure:** Auth-gate circumvention, quota manipulation, or state-root race condition exploits.

### Out of Scope:
- Vulnerabilities in third-party frontier LLM providers (e.g., Anthropic, OpenAI, Google).
- Upstream Substrate/Midnight consensus protocol vulnerabilities (please report directly to IOG/Midnight).
- Denial-of-Service attacks targeting rate-limited unauthenticated sandbox IP limits.

---

## 🚨 Reporting a Vulnerability

**DO NOT file public GitHub Issues for suspected security vulnerabilities.** Public disclosure creates immediate exposure for live agents in production.

Please report all security findings privately via:
- **Email:** [`security@rohanprotocol.network`](mailto:security@rohanprotocol.network)
- **GitHub:** Utilize the [GitHub Private Vulnerability Reporting](https://github.com/rohan-protocol/sdk/security/advisories/new) feature directly within this repository.

### What to Include:
1. Detailed description of the vulnerability and attack vector (referencing Vector IDs where applicable).
2. Minimal, reproducible proof-of-concept (PoC) script or curl trace.
3. Affected package(s) and version.
4. Assessment of exploitability and impact on client-side privacy or relayer availability.

---

## ⏱️ Response Commitments

- **Initial Acknowledgment:** Within **48 hours** of report receipt.
- **Triage & Severity Assessment:** Within **5 business days**.
- **Coordinated Disclosure:** We adhere to standard 90-day responsible disclosure principles. Security patches will be issued via hotfix releases accompanied by public CVE/GHSA advisories crediting the researcher (unless requested otherwise).

---

## 🎖️ Hall of Fame & Recognition

While our community bug bounty program is currently evolving alongside our Mainnet roadmap, we publicly acknowledge all valid security researchers in our official Release Notes and Security Hall of Fame.
