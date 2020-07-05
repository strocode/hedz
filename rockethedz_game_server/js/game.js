const players = {};

const config = {
  type: Phaser.HEADLESS,
  parent: 'phaser-example',
  width: 800,
  height: 600,
  physics: {
    default: 'matter',
    arcade: {
      debug: false,
      gravity: {
        y: 0
      }
    },
    matter: {
        enableSleeping: false, // https://rexrainbow.github.io/phaser3-rex-notes/docs/site/matterjs-gameobject/
        gravity: {
            y: 0
        },
        debug: {
            showBody: true,
            showStaticBody: true
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
  this.load.image('rocket1', '../public/game/assets/rocket-297573h300.png');
  // From: https://www.codeandweb.com/physicseditor/tutorials/how-to-create-physics-shapes-for-phaser-3-and-matterjs
  this.load.json('shapes', '../public/game/assets/rocket-physics.json');
}

function create() {
  const self = this;
  //this.players = this.physics.add.group();
  this.players = {};
  this.playerPhysics = {};
  this.gameId = document.gameId;
  console.log(`creating game ${this.gameID}`);

  this.scores = {
    blue: 0,
    red: 0
  };

  if (this.physics === undefined) {
    this.physics = this.matter;
  }
  let shapes = this.cache.json.get('shapes');
  this.star = this.physics.add.image(
    randomPosition(700),
    randomPosition(500),
    'star', null);
  this.star.setSensor(true); // Star doesn't collide, but does detect collisions
  this.star.setCollisionGroup(0);
  this.star.setOnCollide(pair => {
    console.log('Pair collided', pair);
    const playerId = pair.bodyA.gameObject.playerId !== undefined ?
      pair.bodyA.gameObject.playerId : pair.bodyB.gameObject.playerId;

    const player = self.players[playerId];
    const team = player.team;
    self.scores[team] += 10;
    self.star.setPosition(randomPosition(700), randomPosition(500));
    io.emit('updateScore', self.scores);
    io.emit('starLocation', {
      x: self.star.x,
      y: self.star.y
    });
  });

  io.on('connection', function(socket) {
    // create a new player and add it to our players object
    let players = self.players;
    const playersByTeam = Object.values(players).reduce((acc, player) => {acc[player.team] += 1; return acc;}, {'red':0,'blue':0});
    const nplayers = Object.values(players).length;
    var team = playersByTeam['red'] < playersByTeam['blue'] ? 'red':'blue';
    console.log(self.gameId, 'New user team=', team, 'nplayers before', nplayers, 'by team', playersByTeam);

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
      console.log(`${self.gameId}: user disconnected. Got ${self.players.length} left`);

      // emit a message to all players to remove this player
      io.emit('disconnect', socket.id);

      // tell outside world wehave no more players
      if (Object.keys(self.players).length == 0) {
          window.onFinished();
      }
    });
    // when a player moves, update the player data
    socket.on('playerInput', function(inputData) {
      handlePlayerInput(self, socket.id, inputData);
    });

    // send webrtc chat data to the requested player
    socket.on('webrtc', function(webrtcdata) {
      //console.log('Got webrtc:', webrtcdata);
      var playerId = webrtcdata.playerId;
      socket.broadcast.to(playerId).emit('webrtc', webrtcdata);
    });
  });
}

function wrap(p) {
    if (p.x < 0) {
      p.x = config.width;
    } else if (p.x > config.width) {
      p.x = 0;
    }

    if (p.y < 0) {
      p.y = config.height;
    } else if (p.y > config.height) {
      p.y = 0;
    }
}

function update() {
  const self = this;
  const players = self.players;
  for(let [playerId, player] of Object.entries(players)) {
    const input = player.input;
    const playerPhysics = self.playerPhysics[playerId];

    if (input.left) {
      playerPhysics.setAngularVelocity(-0.3/4);
    } else if (input.right) {
      playerPhysics.setAngularVelocity(0.3/4);
    } else {
      playerPhysics.setAngularVelocity(0);
    }

    if (input.up) {
      // Boost level controls how big your thrusters are
      const thrust = input.boostLevel === 1 ? 1 : 0.25;
      //this.physics.velocityFromRotation(player.rotation + Phaser.Math.TAU, -thrust, player.body.acceleration);
      playerPhysics.thrustLeft(thrust);
    } else {
      //player.setAcceleration(0);
    }

    wrap(playerPhysics);

    players[player.playerId].x = playerPhysics.x;
    players[player.playerId].y = playerPhysics.y;
    players[player.playerId].rotation = playerPhysics.rotation;
    players[player.playerId].thrusting = Boolean(input.up);
    players[player.playerId].smileLevel = input.smileLevel;
    players[player.playerId].boostLevel = input.boostLevel;


  }
  //this.physics.world.wrap(this.players, 5);
  io.emit('playerUpdates', players);
}

function randomPosition(max) {
  return Math.floor(Math.random() * max) + 50;
}

function handlePlayerInput(self, playerId, input) {
  self.players[playerId].input = input;
}

function addPlayer(self, playerInfo) {
  let shapes = self.cache.json.get('shapes');
  let options = {shape:shapes['rocket-297573h300']};
  const player = self.physics.add.sprite(
      playerInfo.x,
      playerInfo.y,
      'rocket1', null, options); //.setDisplaySize(256*1.5, 256);

  // player.setDrag(100);
  // player.setAngularDrag(100);
  // player.setMaxVelocity(200);
  player.setFrictionAir(0.1);
  player.setCollisionGroup(0);
  player.setCollidesWith(0xffffffff);

  console.log('Player collision filter', player.body.collisionFilter, 'star collision', self.star.body.collisionFilter, 'options', options);

  player.playerId = playerInfo.playerId;
  self.playerPhysics[player.playerId] = player;
}

function removePlayer(self, playerId) {
  self.playerPhysics[playerId].destroy();
  delete self.playerPhysics[playerId];
}

const game = new Phaser.Game(config);
window.gameLoaded(game);
