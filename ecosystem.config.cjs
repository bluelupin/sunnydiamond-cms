module.exports = {
  apps: [
    {
      name: "sunnydiamond-cms",
      script: "node_modules/.bin/strapi",
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
      time: true,
    },
  ],
};
