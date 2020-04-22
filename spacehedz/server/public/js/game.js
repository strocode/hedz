
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

var game = new Phaser.Game(config);
var pc = createMyPeerConnection();
var webcam_stream = null;
var screen_stream = null;

//
Promise.all([
    faceapi.net.tinyFaceDetector.loadFromUri('/models'),
    faceapi.net.faceLandmark68Net.loadFromUri('/models'),
    faceapi.net.faceRecognitionNet.loadFromUri('/models'),
    faceapi.net.faceExpressionNet.loadFromUri('/models'),
]).then(startVideo);

video.addEventListener('play', () => {
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions()
}, 100);
console.log(detections);
{);


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
    video.width = 320;
    video.playsinline = true;
    video.autoplay = true;
    self.videoelement = this.add.dom(250, 300, video);
    self.chatPlayer = null;
    
    if (true) {
	webcamVideo(video);
	//screenVideo();
    } else {
	//startVideo(undefined, video);
    }

    document.getElementById('webcam-button').addEventListener('click', function() {
	webcam_stream.getTracks().forEach(function(track) {
            pc.addTrack(track, webcam_stream);
        });
    });

    document.getElementById('screen-button').addEventListener('click', function() {
	var constraints = {};
	navigator.mediaDevices.getDisplayMedia(constraints).then(function(stream) {
	    addVideo(stream);
	    screen_stream = stream;
	    screen_stream.getTracks().forEach(function(track) {
            pc.addTrack(track, screen_stream);
        });
	}, function(err) {
	    alert('Couldnt open screen' + err);
	});

    });


    pc.addEventListener('icecandidate', function(event) {
	if (self.chatPlayer !== null) {
	    if (event.candidate) {
		self.socket.emit('webrtc', {
		    name:self.socket.id,
		    playerId:self.chatPlayer,
		    type:'new-ice-candidate',
		    candidate:event.candidate
		});
	    } else {
		console.log('All candidates have been sent!');
	    }
	}

    });

    pc.addEventListener('negotiationneeded', function(evt) {
	pc.createOffer().then(function(offer) {
	    return pc.setLocalDescription(offer);
	}).then(function() {
	    if (self.chatPlayer !== null) {
		self.socket.emit('webrtc', {
		    name:self.socket.id,
		    playerId:self.chatPlayer,
		    type:'video-offer',
		    sdp:pc.localDescription});
	    }
	}).catch(function(e) {
	    alert(e);
	});
    });
    
    pc.addEventListener('removetrack', function(evt) {
	console.log('Removetrack called');
    });

    // connect audio / video
    pc.addEventListener('track', function(evt) {
        if (evt.track.kind == 'video') {
	    addVideo(evt.streams[0]);
	} else if (evt.track.kind == 'audio' && audio_target !== undefined) {
            //audio_target.srcObject = evt.streams[0];
	}
    });

    this.socket.on('webrtc', function(webrtcdata) {
	console.log('Got webrtc type' + webrtcdata.type);
	switch(webrtcdata.type) {
	case 'video-offer':
	    handleVideoOffer(self, webrtcdata);
	    break;

	case 'video-answer':
	    handleVideoAnswer(self, webrtcdata);
	    break;

	case 'new-ice-candidate':
	    handleNewIceCandidate(self, webrtcdata);
	    break;

	default:
	    console.log('Unknown type' + webrtcdata.type);
	}
    });
						     


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

    this.socket.on('webrtc', function (webrctdata) {
	
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
    if (player.playerId !== self.socket.id) {
	self.chatPlayer = player.playerId;
	console.log('Set chat player to ' + self.chatPlayer);
    }
}

function handleVideoOffer(self, webrtcdata) {
    
    pc.setRemoteDescription(webrtcdata.sdp).then(function() {
	return pc.createAnswer();
    }).then(function(answer) {
	return pc.setLocalDescription(answer);
    }).then(function() {
	var msg = {
	    name:webrtcdata.playerId,
	    playerId:webrtcdata.name,
	    type:'video-answer',
	    sdp:pc.localDescription
	};
	console.log('Sending video answer'+JSON.stringify(msg));
	self.socket.emit('webrtc', msg);
    });
}

function handleVideoAnswer(self, webrtcdata) {
    pc.setRemoteDescription(webrtcdata.sdp).then(function() {
	console.log('got video answer!');
    });

    
}

function handleNewIceCandidate(self, webrtcdata) {
    pc.addIceCandidate(webrtcdata.candidate).then(function() {
	console.log('Ice candidate added sucessfully!');
    });
}


function webcamVideo(videoelement) {
    var constraints = {
        audio: false,
        video: {width:352, height:288}
    };


    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
	console.log('Got stream'+ stream);
	//videoelement.srcObject = stream;
	addVideo(stream);
	webcam_stream = stream;
    }, function(err) {
        alert('Could not acquire media: ' + err);
    });
}

function screenVideo() {
    var constraints = {};
    navigator.mediaDevices.getDisplayMedia(constraints).then(function(stream) {
	addVideo(stream);
	screen_stream = stream;
    }, function(err) {
	alert('Couldnt open screen' + err);
    });
}

// Use https://webrtchacks.github.io/WebRTC-Camera-Resolution/

function addVideo(stream) {
    var video_div = document.getElementById('videos');
    var v = document.createElement('video');
    v.height = '240';
    v.width = '320';
    v.autoplay = 'true';
    v.playsinline = 'true';
    video_div.appendChild(v)
    v.srcObject = stream;
    return v;
}

function createMyPeerConnection() {
    var config = {
        sdpSemantics: 'unified-plan'
    };

    if (document.getElementById('use-stun').checked) {
        config.iceServers = [{urls: ['stun:stun.l.google.com:19302']}];
    }

    pc = new RTCPeerConnection(config);

    // register some listeners to help debugging
    pc.addEventListener('icegatheringstatechange', function() {
        iceGatheringLog.textContent += ' -> ' + pc.iceGatheringState;
    }, false);
    iceGatheringLog.textContent = pc.iceGatheringState;

    pc.addEventListener('iceconnectionstatechange', function() {
        iceConnectionLog.textContent += ' -> ' + pc.iceConnectionState;
    }, false);
    iceConnectionLog.textContent = pc.iceConnectionState;

    pc.addEventListener('signalingstatechange', function() {
        signalingLog.textContent += ' -> ' + pc.signalingState;
    }, false);
    signalingLog.textContent = pc.signalingState;


    return pc;
}

