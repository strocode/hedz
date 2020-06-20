const path = require('path');

module.exports = {
  entry: './rockethedz_game_server/js/game.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist/rockethedz'),
  },
};
