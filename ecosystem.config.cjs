module.exports = {
  apps: [
    {
      name: 'sunnydiamond-cms',
      cwd: '/home/forge/sunnydiamonds-cms-dev.on-forge.com',
      script: 'npm',
      args: 'run start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
