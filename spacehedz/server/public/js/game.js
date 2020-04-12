
var config = {
  type: Phaser.AUTO,
    parent: 'game-div',
    width: 800,
    height: 600,
    // I think I need dom.createContainer = true for video?
    dom: {
	createContainer: true
    },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

function webcamVideo(videoelement) {
    var constraints = {
        audio: false,
        video: {width:320, height:240}
    };


    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
	console.log('Got stream'+ stream);
	videoelement.srcObject = stream;
/*	stream.getTracks().forEach(function(track) {
	    console.log('Got track' + track);
	    if (track.kind == 'video') {
		self.video.srcObject = track.streams[0];
	    }
        });*/
    }, function(err) {
        alert('Could not acquire media: ' + err);
    });
}



var game = new Phaser.Game(config);

function preload() {
  this.load.image('ship', 'assets/spaceShips_001.png');
  this.load.image('otherPlayer', 'assets/enemyBlack5.png');
    this.load.image('star', 'assets/star_gold.png');
     //this.load.video('wormhole', 'assets/video/wormhole.mp4', 'loadeddata', false, true);

}

function create() {
  var self = this;
  this.socket = io();
  this.players = this.add.group();

  this.blueScoreText = this.add.text(16, 16, '', { fontSize: '32px', fill: '#0000FF' });
    this.redScoreText = this.add.text(584, 16, '', { fontSize: '32px', fill: '#FF0000' });

    var video = document.createElement('video');
    video.height = 240;
    video.width = 240;
    video.playsinline = true;
    video.autoplay = true;
    self.videoelement = this.add.dom(250, 300, video);
    
    if (true) {
	webcamVideo(video);
    } else {
	startVideo(undefined, self.videoelement);
    }



  this.socket.on('currentPlayers', function (players) {
    Object.keys(players).forEach(function (id) {
      if (players[id].playerId === self.socket.id) {
        displayPlayers(self, players[id], 'ship');
      } else {
        displayPlayers(self, players[id], 'otherPlayer');
      }
    });
  });

  this.socket.on('newPlayer', function (playerInfo) {
    displayPlayers(self, playerInfo, 'otherPlayer');
  });

  this.socket.on('disconnect', function (playerId) {
    self.players.getChildren().forEach(function (player) {
      if (playerId === player.playerId) {
        player.destroy();
      }
    });
  });

  this.socket.on('playerUpdates', function (players) {
    Object.keys(players).forEach(function (id) {
      self.players.getChildren().forEach(function (player) {
        if (players[id].playerId === player.playerId) {
          player.setRotation(players[id].rotation);
          player.setPosition(players[id].x, players[id].y);
        }

	  if (players[id].playerId === self.socket.id) {
	      self.videoelement.setRotation(players[id].rotation);
	      self.videoelement.setPosition(players[id].x, players[id].y);
	  }
      });
    });
  });

  this.socket.on('updateScore', function (scores) {
    self.blueScoreText.setText('Blue: ' + scores.blue);
    self.redScoreText.setText('Red: ' + scores.red);
  });

  this.socket.on('starLocation', function (starLocation) {
    if (!self.star) {
      self.star = self.add.image(starLocation.x, starLocation.y, 'star');
    } else {
      self.star.setPosition(starLocation.x, starLocation.y);
    }
  });

  this.cursors = this.input.keyboard.createCursorKeys();
  this.leftKeyPressed = false;
  this.rightKeyPressed = false;
  this.upKeyPressed = false;
}

function update() {
  const left = this.leftKeyPressed;
  const right = this.rightKeyPressed;
  const up = this.upKeyPressed;

  if (this.cursors.left.isDown) {
    this.leftKeyPressed = true;
  } else if (this.cursors.right.isDown) {
    this.rightKeyPressed = true;
  } else {
    this.leftKeyPressed = false;
    this.rightKeyPressed = false;
  }

  if (this.cursors.up.isDown) {
    this.upKeyPressed = true;
  } else {
    this.upKeyPressed = false;
  }

  if (left !== this.leftKeyPressed || right !== this.rightKeyPressed || up !== this.upKeyPressed) {
    this.socket.emit('playerInput', { left: this.leftKeyPressed , right: this.rightKeyPressed, up: this.upKeyPressed });
  }
}

function displayPlayers(self, playerInfo, sprite) {
  const player = self.add.sprite(playerInfo.x, playerInfo.y, sprite).setOrigin(0.5, 0.5).setDisplaySize(53, 40);
  if (playerInfo.team === 'blue') player.setTint(0x0000ff);
  else player.setTint(0xff0000);
  player.playerId = playerInfo.playerId;
  self.players.add(player);
}
