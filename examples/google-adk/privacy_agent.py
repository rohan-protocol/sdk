"""
Google Agent Development Kit (ADK) — Privacy-Preserving Agent with Rohan Protocol (v0.8.3)
Demonstrates Ed25519 did:key request signing, local RFC 8785 SHA-256 commitments,
and gas-free Midnight Preprod (Ledger v9) anchoring via @rohan-protocol/mcp.
"""

import os
from google.adk.agents import LlmAgent
from google.adk.tools.mcp_tool import McpToolset, StdioConnectionParams
from mcp import StdioServerParameters


def create_rohan_shielded_agent() -> LlmAgent:
    # 1. Connect to local Rohan MCP Server (local RAM hashing + ~/.rohan/agent-identity.json)
    env_vars = {
        **os.environ,
        "ROHAN_NETWORK": os.getenv("ROHAN_NETWORK", "preprod"),
        "ROHAN_CONTRACT_ADDRESS": os.getenv(
            "ROHAN_CONTRACT_ADDRESS",
            "585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e",
        ),
        "ROHAN_RELAYER_URL": os.getenv(
            "ROHAN_RELAYER_URL",
            "https://api.rohanprotocol.network/api/v1/handshake",
        ),
    }

    rohan_toolset = McpToolset(
        connection_params=StdioConnectionParams(
            server_params=StdioServerParameters(
                command="npx",
                args=["-y", "--package", "@rohan-protocol/mcp@0.8.3", "rohan-shield"],
                env=env_vars,
            )
        )
    )

    # 2. Instantiate Gemini Agent with strict privacy boundary instructions
    return LlmAgent(
        name="RohanShieldedAgent",
        model="gemini-2.5-pro",
        instruction=(
            "You are a privacy-first autonomous B2B agent using Rohan Protocol. "
            "When negotiating deals, procurements, or cross-agent commitments, "
            "NEVER place sensitive figures, counterparties, or PII inside `actionSummary` — "
            "keep `actionSummary` generic and put all confidential fields inside `confidentialPayload`. "
            "Use `rohan_execute_handshake` (omit `agentId` so the local Ed25519 did:key signer is used) "
            "to anchor commitments on Midnight Preprod, and `rohan_verify_commitment` to audit bundles offline."
        ),
        tools=[rohan_toolset],
    )


root_agent = create_rohan_shielded_agent()

if __name__ == "__main__":
    print("🛡️ Google ADK Agent initialized with Rohan Protocol MCP (v0.8.3).")
    print("   Run interactively with: adk web examples/google-adk  (or adk run examples/google-adk)")
