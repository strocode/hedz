module.exports = {
  apps: [{
    name: 'rockethedz',
    script: 'bin/www',
    watch: true,
    env: {
      "NODE_ENV": "development",
      "TURN_SERVER":"freya.bannister.id.au",
    },
    env_production: {
      "NODE_ENV": "production",
      "TURN_SERVER":"freya.bannister.id.au",
    }
  }],

  deploy: {
    production: {
      user: 'keith',
      host: 'freya.bannister.id.au',
      ref: 'origin/master',
      repo: 'git@github.com:strocode/hedz.git',
      path: '/home/keith/RocketHedz/',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pwd && pushd public/game && npm install && popd && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
