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
    const vpcPrivateSubnets = aws.ssm.getParameterOutput({ name: `${platformBase}/VpcPrivateSubnetIds` });
    const lambdaSgId = aws.ssm.getParameterOutput({ name: `${platformBase}/LambdaSgId` });

    const fn = new sst.aws.Function("BackendApi", {
      handler: "app/main.handler",
      runtime: "python3.12",
      url: { cors: false },
      timeout: "30 seconds",
      memory: "512 MB",
      vpc: {
        privateSubnets: vpcPrivateSubnets.value.apply(v => v.split(",")),
        securityGroups: lambdaSgId.value.apply(id => [id]),
      },
      permissions: [{
        actions: ["secretsmanager:GetSecretValue"],
        resources: [dbSecretArn.value],
      }],
      environment: {
        STAGE: stage,
        DB_SECRET_ARN: dbSecretArn.value,
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
