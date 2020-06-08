const players = {};

const config = {
  type: Phaser.HEADLESS,
  parent: 'phaser-example',
  width: 800,
  height: 600,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: {
        y: 0
      }
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  },
  autoFocus: false
};

function preload() {
  this.load.image('ship', 'assets/spaceShips_001.png');
  this.load.image('star', 'assets/star_gold.png');
}

function create() {
  const self = this;
  this.players = this.physics.add.group();
  this.gameId = document.gameId;

  this.scores = {
    blue: 0,
    red: 0
  };

  this.star = this.physics.add.image(randomPosition(700), randomPosition(500), 'star');
  this.physics.add.collider(this.players);

  this.physics.add.overlap(this.players, this.star, function(star, player) {
    if (players[player.playerId].team === 'red') {
      self.scores.red += 10;
    } else {
      self.scores.blue += 10;
    }
    self.star.setPosition(randomPosition(700), randomPosition(500));
    io.emit('updateScore', self.scores);
    io.emit('starLocation', {
      x: self.star.x,
      y: self.star.y
    });
  });

  io.on('connection', function(socket) {
    // create a new player and add it to our players object
    const nplayers = Object.keys(players).length;
    var team = (nplayers + 1) % 2 == 0 ? 'red' : 'blue'
    console.log(`${self.gameId}: New user team=${team} nplayers before= ${nplayers}`);

    players[socket.id] = {
      rotation: 0,
      x: Math.floor(Math.random() * 700) + 50,
      y: Math.floor(Math.random() * 500) + 50,
      playerId: socket.id,
      team: team,
      input: {
        left: false,
        right: false,
        up: false,
        boostLevel: 0,
        smileLevel:0,
      },

    };
    // add player to server
    addPlayer(self, players[socket.id]);
    // send the players object to the new player
    socket.emit('currentPlayers', players);
    // update all other players of the new player
    socket.broadcast.emit('newPlayer', players[socket.id]);
    // send the star object to the new player
    socket.emit('starLocation', {
      x: self.star.x,
      y: self.star.y
    });
    // send the current scores
    socket.emit('updateScore', self.scores);

    socket.on('disconnect', function() {
      // remove player from server
      removePlayer(self, socket.id);
      // remove this player from our players object
      delete players[socket.id];
      console.log(`${this.gameId}: user disconnected. Got ${players.length} left`);

      // emit a message to all players to remove this player
      io.emit('disconnect', socket.id);

      if (players.length == 0) {
          window.onFinished();
      }
    });
    // when a player moves, update the player data
    socket.on('playerInput', function(inputData) {
      handlePlayerInput(self, socket.id, inputData);
    });

    // send webrtc chat data to the requested player
    socket.on('webrtc', function(webrtcdata) {
      console.log('Got webrtc' + JSON.stringify(webrtcdata));
      var playerId = webrtcdata.playerId;
      socket.broadcast.to(playerId).emit('webrtc', webrtcdata);
    });
  });
}

function update() {
  this.players.getChildren().forEach((player) => {
    const input = players[player.playerId].input;

    if (input.left) {
      player.setAngularVelocity(-300);
    } else if (input.right) {
      player.setAngularVelocity(300);
    } else {
      player.setAngularVelocity(0);
    }

    if (input.up) {
      // Boost level controls how big your thrusters are
      const thrust = input.boostLevel === 1 ? 400 : 50;
      this.physics.velocityFromRotation(player.rotation + Phaser.Math.TAU, -thrust, player.body.acceleration);
    } else {
      player.setAcceleration(0);
    }

    players[player.playerId].x = player.x;
    players[player.playerId].y = player.y;
    players[player.playerId].rotation = player.rotation;
    players[player.playerId].thrusting = Boolean(input.up);
    players[player.playerId].smileLevel = input.smileLevel;
    players[player.playerId].boostLevel = input.boostLevel;


  });
  this.physics.world.wrap(this.players, 5);
  io.emit('playerUpdates', players);
}

function randomPosition(max) {
  return Math.floor(Math.random() * max) + 50;
}

function handlePlayerInput(self, playerId, input) {
  self.players.getChildren().forEach((player) => {
    if (playerId === player.playerId) {
      players[player.playerId].input = input;
    }
  });
}

function addPlayer(self, playerInfo) {
  const player = self.physics.add.image(playerInfo.x, playerInfo.y, 'ship').setOrigin(0.5, 0.5).setDisplaySize(128, 128);
  player.setDrag(100);
  player.setAngularDrag(100);
  player.setMaxVelocity(200);
  player.playerId = playerInfo.playerId;
  self.players.add(player);
}

function removePlayer(self, playerId) {
  self.players.getChildren().forEach((player) => {
    if (playerId === player.playerId) {
      player.destroy();
    }
  });
}

const game = new Phaser.Game(config);
window.gameLoaded(game);
