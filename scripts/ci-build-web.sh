#!/bin/bash
set -euo pipefail
# STAGE=$1  # available if stage-specific build logic is needed
# Cognito + backend env vars are injected by deploy-stage.yml:
#   VITE_COGNITO_USER_POOL_ID, VITE_COGNITO_CLIENT_ID, VITE_COGNITO_DOMAIN
#   NEXT_PUBLIC_BACKEND_URL
cd web
npm ci
npm run build
