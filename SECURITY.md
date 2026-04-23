# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | ✅ Active Support  |
| < 0.3   | ❌ End of Life     |

## Reporting a Vulnerability

The Rohan Protocol team takes security seriously. If you discover a vulnerability in the SDK or the Relayer infrastructure, please follow responsible disclosure:

1. **Do NOT open a public issue.**
2. Email us at **security@rohanprotocol.network** with:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
3. We will acknowledge receipt within **48 hours**.
4. A fix will be prioritized and released within **7 business days** for critical issues.

## Scope

The following are in scope for security reports:

- `@rohan-protocol/sdk` (this package)
- Rohan Relayer Node (`@rohan-protocol/relayer-node`)
- ZK-Proof generation and verification logic
- API Key authentication and authorization
- On-chain contract interactions

## Out of Scope

- Third-party dependencies (report upstream)
- Social engineering attacks
- Denial of service attacks against public testnets

## Recognition

We maintain a private Hall of Fame for security researchers who responsibly disclose vulnerabilities. Critical findings may be eligible for a bug bounty (details provided upon request).
