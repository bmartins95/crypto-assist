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

    const supabaseUrl = aws.ssm.getParameterOutput({ name: `${paramBase}/SupabaseUrl` });
    const supabaseSecretKey = aws.ssm.getParameterOutput({
      name: `${paramBase}/SupabaseSecretKey`,
      withDecryption: true,
    });
    const coingeckoApiKey = aws.ssm.getParameterOutput({
      name: `${paramBase}/CoingeckoApiKey`,
      withDecryption: true,
    });
    const cognitoUserPoolId = aws.ssm.getParameterOutput({
      name: `${paramBase}/CognitoUserPoolId`,
    });
    const webUrl = aws.ssm.getParameterOutput({ name: `${paramBase}/WebUrl` });

    const fn = new sst.aws.Function("BackendApi", {
      handler: "app/main.handler",
      runtime: "python3.12",
      url: { cors: false },
      timeout: "30 seconds",
      memory: "512 MB",
      environment: {
        STAGE: stage,
        SUPABASE_URL: supabaseUrl.value,
        SUPABASE_SECRET_KEY: supabaseSecretKey.value,
        COINGECKO_API_KEY: coingeckoApiKey.value,
        COGNITO_USER_POOL_ID: cognitoUserPoolId.value,
        COGNITO_REGION: "us-east-1",
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
