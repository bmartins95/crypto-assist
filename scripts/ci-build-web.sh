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
  # Hashed assets are immutable and deliberately never deleted: a browser
  # holding a cached index.html must keep resolving its old asset URLs.
  # index.html itself is no-cache so deploys reach browsers immediately.
  aws s3 sync dist/assets/ "s3://$WEB_BUCKET_NAME/assets/" \
    --cache-control "public,max-age=31536000,immutable"
  aws s3 sync dist/ "s3://$WEB_BUCKET_NAME" --delete \
    --exclude "assets/*" --exclude "index.html" \
    --cache-control "public,max-age=3600"
  aws s3 cp dist/index.html "s3://$WEB_BUCKET_NAME/index.html" \
    --cache-control "no-cache"
  aws cloudfront create-invalidation --distribution-id "$WEB_DISTRIBUTION_ID" --paths "/*"
fi
