/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "crypto-assist-backend",
      removal: input?.stage === "prod" ? "retain" : "remove",
      home: "aws",
      providers: { aws: { region: "us-east-1" } },
    };
  },
  async run() {
    const stage = $app.stage;
    const appName = "crypto-assist";
    const paramBase = `/${appName}/${stage}`;
    const platformBase = `/platform/${stage}`;

    // App-level params
    const coingeckoApiKey = aws.ssm.getParameterOutput({
      name: `${paramBase}/CoingeckoApiKey`,
      withDecryption: true,
    });
    const cognitoUserPoolId = aws.ssm.getParameterOutput({
      name: `${paramBase}/CognitoUserPoolId`,
    });
    const webUrl = aws.ssm.getParameterOutput({ name: `${paramBase}/WebUrl` });

    // Platform VPC + DB params (set by aws-infra platform stack)
    const dbSecretArn = aws.ssm.getParameterOutput({ name: `${platformBase}/DbSecretArn` });
    const dbHost = aws.ssm.getParameterOutput({ name: `${platformBase}/DbHost` });
    const dbPort = aws.ssm.getParameterOutput({ name: `${platformBase}/DbPort` });
    const vpcPrivateSubnets = aws.ssm.getParameterOutput({ name: `${platformBase}/VpcPrivateSubnetIds` });
    const lambdaSgId = aws.ssm.getParameterOutput({ name: `${platformBase}/LambdaSgId` });

    // Read DB credentials at deploy time (machine has internet access) and inject as DB_DSN.
    // This avoids a Secrets Manager API call from the Lambda at runtime, which would hang
    // because private VPC subnets have no NAT Gateway or Secrets Manager VPC endpoint.
    const dbSecret = aws.secretsmanager.getSecretVersionOutput({ secretId: dbSecretArn.value });
    const dbDsn = $util.all([dbHost.value, dbPort.value, dbSecret.secretString]).apply(
      ([host, port, secretStr]) => {
        const c = JSON.parse(secretStr);
        return `host=${host} port=${port} dbname=postgres user=${c.username} password=${c.password}`;
      }
    );

    const fn = new sst.aws.Function("BackendApi", {
      handler: "app/main.handler",
      runtime: "python3.12",
      url: { cors: false },
      timeout: "30 seconds",
      memory: "512 MB",
      copyFiles: [{ from: "db" }],
      vpc: {
        privateSubnets: vpcPrivateSubnets.value.apply(v => v.split(",")),
        securityGroups: lambdaSgId.value.apply(id => [id]),
      },
      environment: {
        STAGE: stage,
        DB_DSN: dbDsn,
        COGNITO_USER_POOL_ID: cognitoUserPoolId.value,
        COGNITO_REGION: "us-east-1",
        COINGECKO_API_KEY: coingeckoApiKey.value,
        FRONTEND_ORIGIN: webUrl.value,
      },
    });

    new aws.ssm.Parameter("BackendApiUrl", {
      name: `${paramBase}/BackendApiUrl`,
      type: "String",
      value: fn.url,
      overwrite: true,
    });

    return { apiUrl: fn.url };
  },
});
