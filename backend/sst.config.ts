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

    // Credentials stored in SSM as SecureString (one-time manual setup)
    const supabaseUrl = aws.ssm.getParameterOutput({ name: `${paramBase}/SupabaseUrl` });
    const supabasePublishableKey = aws.ssm.getParameterOutput({
      name: `${paramBase}/SupabasePublishableKey`,
      withDecryption: true,
    });
    const supabaseSecretKey = aws.ssm.getParameterOutput({
      name: `${paramBase}/SupabaseSecretKey`,
      withDecryption: true,
    });
    const coingeckoApiKey = aws.ssm.getParameterOutput({
      name: `${paramBase}/CoingeckoApiKey`,
      withDecryption: true,
    });

    const fn = new sst.aws.Function("BackendApi", {
      handler: "app/main.handler",
      runtime: "python3.12",
      url: { cors: false },
      timeout: "30 seconds",
      memory: "512 MB",
      environment: {
        STAGE: stage,
        SUPABASE_URL: supabaseUrl.value,
        SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey.value,
        SUPABASE_SECRET_KEY: supabaseSecretKey.value,
        COINGECKO_API_KEY: coingeckoApiKey.value,
        FRONTEND_ORIGIN: "http://localhost:3000",
      },
    });

    // Publish Lambda URL to SSM so the frontend build can read NEXT_PUBLIC_BACKEND_URL
    new aws.ssm.Parameter("BackendApiUrl", {
      name: `${paramBase}/BackendApiUrl`,
      type: "String",
      value: fn.url,
      overwrite: true,
    });

    return { apiUrl: fn.url };
  },
});
