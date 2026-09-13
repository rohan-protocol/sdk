#!/bin/bash
cd /root/Rohan/sdk
export NODE_OPTIONS=--max-old-space-size=8192
npx tsx scripts/deploy_handshake.ts
