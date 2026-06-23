# AWS Infrastructure — crypto-assist

Infrastructure for crypto-assist is managed by the `aws-infra` platform repo. This document explains how crypto-assist plugs into that platform and how the deployment pipeline works.

For the full platform guide (adding apps, YAML schema, SSM conventions), see the `aws-migration-guide.md` in the `aws-infra` repo.

---

## How crypto-assist integrates with aws-infra

crypto-assist self-registers by:
1. Maintaining `infra/dev.yaml`, `infra/stg.yaml`, `infra/prd.yaml` in this repo
2. Having its CI pipeline push those files to `aws-infra/apps/crypto-assist/` and trigger the aws-infra pipeline
3. Reading provisioned resource IDs from SSM Parameter Store under `/crypto-assist/<stage>/`

---

## Deployed resources (prod) — as of 2026-06-23

| Resource | Value |
|---|---|
| Cognito User Pool | `us-east-1_viyP4Jgbe` |
| Cognito Domain | `crypto-assist.auth.us-east-1.amazoncognito.com` |
| Web Client ID | `6kgjpokpsck99tu7phcakmi84k` |
| Mobile Client ID | `349nucuq3lupb0p9je5ihrudn6` |
| Google IdP redirect URI | `https://crypto-assist.auth.us-east-1.amazoncognito.com/oauth2/idpresponse` |
| S3 Backup Bucket | `infra-prod-backupsbucket-onzmeohh` |
| RDS Endpoint | `infra-prod-maindbcluster-baeusako.cluster-c2pa2kiqykts.us-east-1.rds.amazonaws.com:5432` |
| RDS Database | `infra` |
| RDS Credentials | Secrets Manager: `rds!cluster-06de2a7d-3128-4d7a-b76b-c23c28d68b8a` |

---

## infra YAML config

```yaml
# infra/prd.yaml
name: crypto-assist
stage: prd

cognito:
  domain: crypto-assist
  googleEnabled: true
  web:
    callbackUrls:
      - https://<cloudfront-url>/callback
      - http://localhost:5173/callback
    logoutUrls:
      - https://<cloudfront-url>
      - http://localhost:5173
  mobile:
    callbackUrls:
      - crypto-assist://callback
    logoutUrls:
      - crypto-assist://logout

database:
  name: crypto_assist

storage:
  backupBucket: true
```

> Update `<cloudfront-url>` once the CloudFront distribution is created. Then run the pipeline to update the Cognito web client callback URLs.

---

## CI pipeline overview

`.github/workflows/deploy.yml`:

1. **Test** — run `npm test` in `backend/` and `web/`
2. **Register infra** — push `infra/prd.yaml` to `aws-infra/apps/crypto-assist/prd.yaml` via GitHub API using `INFRA_GITHUB_TOKEN`
3. **Trigger aws-infra** — fire `repository_dispatch` with `event_type: deploy-app, app: crypto-assist`
4. **Wait** — poll aws-infra workflow run until it completes
5. **Read SSM** — fetch `/crypto-assist/prd/CognitoUserPoolId`, `/crypto-assist/prd/CognitoWebClientId`, etc.
6. **Deploy backend** — `npx sst deploy --stage prod` inside `backend/`
7. **Deploy web** — `npm run build` with Cognito env vars injected, then `aws s3 sync` + CloudFront invalidation

---

## Required GitHub Secrets

| Secret | Where to get it |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM `deploy` user credentials |
| `AWS_SECRET_ACCESS_KEY` | IAM `deploy` user credentials |
| `INFRA_GITHUB_TOKEN` | GitHub PAT with `contents:write` + `actions:write` on `aws-infra` repo |

All other values (Cognito IDs, bucket names, DB URL) are read from SSM at deploy time — no need to store them as GitHub Secrets.

---

## One-time setup checklist (already done for prod)

- [x] AWS account created and secured (MFA on root, `deploy` IAM user)
- [x] AWS CLI configured (`us-east-1`)
- [x] SST bootstrapped in AWS account
- [x] `aws-infra` deployed: VPC, RDS Aurora Serverless v2, S3 bucket
- [x] Cognito User Pool created with Google IdP
- [x] Cognito domain: `crypto-assist.auth.us-east-1.amazoncognito.com`
- [x] Web + mobile app clients created
- [x] Google Cloud Console: Cognito redirect URI added (`/oauth2/idpresponse`)
- [ ] SSM parameters written for prod stage (happens automatically once aws-infra pipeline is wired up)
- [ ] `INFRA_GITHUB_TOKEN` secret added to this repo
- [ ] CloudFront URL known and added to web client callback URLs
