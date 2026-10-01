# Dockerfile for Smithery and containerized MCP clients
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root manifest and workspaces
COPY package*.json ./
COPY packages ./packages

# Install dependencies and build
RUN npm install
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app /app

ENV NODE_ENV=production
ENV ROHAN_CONTRACT_ADDRESS=585ac0c4448257507d8ffa2a89e2aa00abd86ec9e94bdb6f553bc83e05f4dd0e
ENV ROHAN_RELAYER_URL=https://api.rohanprotocol.network/api/v1/handshake
ENV ROHAN_FIREWALL_LEVEL=V-01_STRICT

ENTRYPOINT ["node", "packages/mcp/dist/server.js"]
