#!/bin/bash
set -euo pipefail
STAGE=$1
cd backend
npx sst deploy --stage "$STAGE"
