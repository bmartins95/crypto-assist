# Quickstart: Facebook Login

## What this feature ships (this PR, in `aws-infra`)

- A `CryptoAssistFacebookIdP` Cognito identity provider block in `stacks/app-stack.ts`, gated behind `config.cognito.facebookEnabled`, mirroring the existing Google block.
- `facebookEnabled: false` added to `apps/crypto-assist/dev.yaml` and `apps/crypto-assist/prod.yaml` (explicit, disabled).
- `AGENTS.md` updated with a "Facebook OAuth per-stage setup" section, mirroring the existing Google one.

Merging this PR changes nothing observable — no environment has `facebookEnabled: true`, so no Facebook button appears anywhere and no new AWS resource is created on the next deploy.

## Turning it on for an environment (manual, done later by a human — not part of this PR)

1. Create a Facebook App at developers.facebook.com with the "Facebook Login for Business" product.
2. Store credentials in SSM for the target stage:
   ```bash
   aws ssm put-parameter --name "/crypto-assist/dev/FacebookClientId" --value "<id>" --type SecureString --overwrite
   aws ssm put-parameter --name "/crypto-assist/dev/FacebookClientSecret" --value "<secret>" --type SecureString --overwrite
   ```
3. Add the Cognito callback URI to the Facebook App's **Valid OAuth Redirect URIs**:
   `https://crypto-assist-dev.auth.us-east-1.amazoncognito.com/oauth2/idpresponse` (dev) or the `prod` equivalent.
4. Flip `facebookEnabled: true` in the corresponding `dev.yaml`/`prod.yaml` and deploy (`npx sst deploy --stage dev`).
5. Verify: "Continuar com Facebook" appears on the Cognito Hosted UI; completing the Facebook consent flow lands the user on the authenticated app.

## Verifying this PR's change without enabling anything

```bash
cd aws-infra
npx sst deploy --stage dev   # should succeed and be a no-op for Cognito (facebookEnabled: false)
```

Confirm no `CryptoAssistFacebookIdP` resource appears in the Pulumi plan output, since the block is gated behind the disabled flag.
