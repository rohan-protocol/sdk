# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Nur SDK und MCP kopieren
COPY packages/sdk ./packages/sdk
COPY packages/mcp ./packages/mcp

# 1. SDK bauen und als lokales Tarball (.tgz) packen
WORKDIR /app/packages/sdk
RUN npm install && npm run build && npm pack

# 2. MCP bauen und das lokale SDK-Tarball einbinden
WORKDIR /app/packages/mcp
RUN npm install && npm install /app/packages/sdk/rohan-protocol-sdk-*.tgz && npm run build

# Stage 2: Minimaler Runner für Glama & Smithery
FROM node:22-alpine AS runner

WORKDIR /app/packages/mcp

# Nur das fertige MCP-Paket mit seinen gebauten Abhängigkeiten kopieren
COPY --from=builder /app/packages/mcp ./

ENV NODE_ENV=production
ENV ROHAN_CONTRACT_ADDRESS=585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e
ENV ROHAN_RELAYER_URL=https://api.rohanprotocol.network/api/v1/handshake
ENV ROHAN_FIREWALL_LEVEL=V-01_STRICT

ENTRYPOINT ["node", "dist/server.js"]
