const path = require('path');
const root  = __dirname;

module.exports = {
  apps: [
    {
      name:         'web',
      script:       'npm',
      args:         'start',
      cwd:          root,
      env: {
        NODE_ENV: 'production',
        PORT:     '3000',
      },
      restart_delay: 3000,
      max_restarts:  10,
    },
    {
      name:         'scraper',
      script:       path.join(root, 'node_modules', '.bin', 'tsx'),
      args:         'worker/scraper.ts',
      cwd:          root,
      env: {
        NODE_ENV: 'production',
      },
      restart_delay: 5000,
      max_restarts:  10,
    },
    {
      name:         'email-sync',
      script:       path.join(root, 'node_modules', '.bin', 'tsx'),
      args:         'worker/email-sync.ts',
      cwd:          root,
      env: {
        NODE_ENV: 'production',
      },
      restart_delay: 5000,
      max_restarts:  10,
    },
  ],
};
