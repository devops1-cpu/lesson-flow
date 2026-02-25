module.exports = {
  apps: [
    {
      name: 'lessonflow-api',
      script: './api/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      max_memory_restart: '1G',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ],
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'your-ec2-ip-here',
      ref: 'origin/main',
      repo: 'your-git-repo-url',
      path: '/var/www/lesson-flow',
      'post-deploy': 'cd server && npm install && npm run build && pm2 reload ecosystem.config.js --env production'
    }
  }
};
