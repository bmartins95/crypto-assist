#!/bin/bash
set -euo pipefail
# Cognito + backend env vars injected by deploy-stage.yml:
#   VITE_COGNITO_USER_POOL_ID, VITE_COGNITO_CLIENT_ID, VITE_COGNITO_DOMAIN
#   NEXT_PUBLIC_BACKEND_URL
# CloudFront env vars (set when web.cloudFront: true in infra YAML):
#   WEB_BUCKET_NAME, WEB_DISTRIBUTION_ID
cd web
npm ci
npm run build
if [ -n "${WEB_BUCKET_NAME:-}" ]; then
  aws s3 sync dist/ "s3://$WEB_BUCKET_NAME" --delete
  aws cloudfront create-invalidation --distribution-id "$WEB_DISTRIBUTION_ID" --paths "/*"
fi
