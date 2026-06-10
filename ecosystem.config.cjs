module.exports = {
  apps: [
    {
      name: "xuantai-portfolio",
      script: "./dist/server.cjs",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 2000
      }
    }
  ]
};
