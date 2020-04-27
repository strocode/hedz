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

var game;
var pc;
var webcam_stream = null;
var screen_stream = null;
var resizedDetections = [];
var detections = [];
var last_rect = {};
var webcam_video;
var cutout_video;

class RocketHead {
  constructor(scene, playerInfo, sprite)
  {
    this.playerInfo = playerInfo
    this.playerSprite = scene.add.sprite(playerInfo.x, playerInfo.y, sprite).setOrigin(0.5, 0.5).setDisplaySize(128, 128);
    const player = this;
    const video = document.createElement('video');
    video.height = 128;
    video.width = 128;
    video.playsinline = true;
    video.autoplay = true;
    const videoelement = scene.add.dom(player.x, player.y, video);
    player.video = video;
    player.videoelement = videoelement;
    this.playerBorder = scene.add.rectangle(playerInfo.x, playerInfo.y, 128+2, 128+2).setOrigin(0.5,0.5);

    if (playerInfo.team === 'blue') {
      this.playerBorder.setStrokeStyle(2,0x0000ff,1);
    } else {
      this.playerBorder.setStrokeStyle(2,0xff0000,1);
    }

    // hack because I'm too scared to use containers
    // Used by the player updates to move things around
    this.playerSprite.playerId = playerInfo.playerId;
    this.playerSprite.parent = this;
  }

  setRotation(rot) {
    this.playerSprite.setRotation(rot);
    this.videoelement.setRotation(rot);
    this.playerBorder.setRotation(rot);
  }

  setPosition(x, y) {
    this.playerSprite.setPosition(x, y);
    this.videoelement.setPosition(x, y);
    this.playerBorder.setPosition(x, y);;
  }
}

//
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
  faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
  faceapi.nets.faceExpressionNet.loadFromUri('/models')
]).then(startGame);

function startGame() {
  game = new Phaser.Game(config);
  pc = createMyPeerConnection();
}


function preload() {
  this.load.image('ship', 'assets/spaceShips_001.png');
  this.load.image('otherPlayer', 'assets/enemyBlack5.png');
  this.load.image('star', 'assets/star_gold.png');
}

function create() {
  var self = this;
  this.socket = io();
  this.playerId = this.socket.id;
  this.players = this.add.group();

  this.blueScoreText = this.add.text(16, 16, '', {
    fontSize: '32px',
    fill: '#0000FF'
  });
  this.redScoreText = this.add.text(584, 16, '', {
    fontSize: '32px',
    fill: '#FF0000'
  });

  /*
    var video = document.createElement('video');
      video.height = 240;
      video.width = 320;
      video.playsinline = true;
      video.autoplay = true;
      self.videoelement = this.add.dom(250, 300, video);
      */
  self.chatPlayer = null;


  var myHeadVideoCanvas = this.textures.createCanvas('myheadvideo', 256, 256);
  webcamVideo(myHeadVideoCanvas);

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

  document.getElementById('audio-button').addEventListener('click', () => {
    // add webcam audio track to streams
    var constraints = {
      audio: {
        echo_cancellation: true
      }
    };

    navigator.mediaDevices.getUserMedia(constraints).then(stream => {
      var audio_track = stream.getAudioTracks()[0];
      pc.addTrack(audio_track, stream);
    });
  });


  document.getElementById('cutout-button').addEventListener('click', () => {
    // Add cutout canvas to Track
    var stream = myHeadVideoCanvas.canvas.captureStream(30);
    var track = stream.getVideoTracks()[0];
    pc.addTrack(track, stream);
  });


  pc.addEventListener('icecandidate', function(event) {
    if (self.chatPlayer !== null) {
      if (event.candidate) {
        self.socket.emit('webrtc', {
          name: self.socket.id,
          playerId: self.chatPlayer,
          type: 'new-ice-candidate',
          candidate: event.candidate
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
          name: self.socket.id,
          playerId: self.chatPlayer,
          type: 'video-offer',
          sdp: pc.localDescription
        });
      }
    }).catch(function(e) {
      alert(e);
    });
  });

  pc.addEventListener('removetrack', function(evt) {
    console.log('Removetrack called');
  });

  // connect audio / video
  pc.addEventListener('track', evt => {
    if (evt.track.kind == 'video') {
      addVideo(evt.streams[0]);
      self.players.getChildren().forEach(function(player) {
        // TODO: work out from the event which player video this is
        if (player.playerId !== self.socket.id) {
          player.video.srcObject = evt.streams[0];
          //player.videoelement.play();
          player.video.play();
        }
      });
    } else if (evt.track.kind == 'audio') {
      var audio_elem = document.createElement("audio");
      // var audio_elem = document.getElementById("audio");
      audio_elem.srcObject = evt.streams[0];
      audio_elem.play();
    }
  });

  this.socket.on('webrtc', function(webrtcdata) {
    console.log('Got webrtc type' + webrtcdata.type);
    switch (webrtcdata.type) {
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



  this.socket.on('currentPlayers', function(players) {
    Object.keys(players).forEach(function(id) {
      if (players[id].playerId === self.socket.id) {
        // use 'ship' for a fixed image or 'myheadvideo' for a cutout of your head
        displayPlayers(self, players[id], 'myheadvideo');
      } else {
        displayPlayers(self, players[id], 'otherPlayer');
      }
    });
  });

  this.socket.on('newPlayer', function(playerInfo) {
    displayPlayers(self, playerInfo, 'otherPlayer');
  });

  this.socket.on('disconnect', function(playerId) {
    self.players.getChildren().forEach(function(player) {
      if (playerId === player.playerId) {
        player.destroy();
      }
    });
  });

  this.socket.on('playerUpdates', function(players) {
    Object.keys(players).forEach(function(id) {
      self.players.getChildren().forEach(function(player) {
        if (players[id].playerId === player.playerId) {
          player.parent.setRotation(players[id].rotation);
          player.parent.setPosition(players[id].x, players[id].y);
        }
      });
    });
  });

  this.socket.on('updateScore', function(scores) {
    self.blueScoreText.setText('Blue: ' + scores.blue);
    self.redScoreText.setText('Red: ' + scores.red);
  });

  this.socket.on('starLocation', function(starLocation) {
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
    this.socket.emit('playerInput', {
      left: this.leftKeyPressed,
      right: this.rightKeyPressed,
      up: this.upKeyPressed
    });
  }
}

function displayPlayers(self, playerInfo, sprite) {
  const player = new RocketHead(self, playerInfo, sprite);
  self.add.existing(player);
  self.players.add(player.playerSprite);
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
      name: webrtcdata.playerId,
      playerId: webrtcdata.name,
      type: 'video-answer',
      sdp: pc.localDescription
    };
    console.log('Sending video answer' + JSON.stringify(msg));
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


function webcamVideo(headCanvas) {
  var constraints = {
    audio: false,
    video: {
      width: 352,
      height: 288
    }
  };


  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    console.log('Got stream' + stream);
    //videoelement.srcObject = stream;
    webcam_stream = stream;
    video = addVideo(stream);
    // set global variable
    webcam_video = video;
    cutout_video = headCanvas;
    video.addEventListener('canplay', () => {
        const canvas = faceapi.createCanvasFromMedia(video)
        document.body.append(canvas)
        const displaySize = {
          width: video.width,
          height: video.height
        }
        faceapi.matchDimensions(canvas, displaySize)
        setInterval(async () => {
          detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions()
          //const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());

          resizedDetections = faceapi.resizeResults(detections, displaySize)
          if (false) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            faceapi.draw.drawDetections(canvas, resizedDetections)
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
            faceapi.draw.drawFaceExpressions(canvas, resizedDetections)

            if (resizedDetections.length >= 1) {
              var det = resizedDetections[0];
              var box = det.detection.box;
              ctx.strokeStyle = 'green';
              ctx.strokeRect(box.x, box.y, box.width, box.height);
            }
          }
        }, 250)

        window.requestAnimationFrame(copyCutout);

      }

    );

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
  v.srcObject = stream;
  video_div.appendChild(v)
  v.play();
  return v;
}

function createMyPeerConnection() {
  var config = {
    sdpSemantics: 'unified-plan'
  };

  if (document.getElementById('use-stun').checked) {
    config.iceServers = [{
      urls: ['stun:stun.l.google.com:19302']
    }];
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

function copyCutout() {
  //var cutcanvas = document.getElementById('cutout');

  //var video = document.getElementById('video');
  // rescaledDetections has weird offsets - don't understand why but
  // Just don't use them and eeeevrything will be fiiiiine

  var cutcanvas = cutout_video;

  if (detections.length == 1) {
    var det = detections[0];
    var box = det.detection.box;

    var detw = box.width;
    var deth = box.height;
    var detx = box.x;
    var dety = box.y;

    // middle of the box
    var mx = detx + detw / 2;
    var my = dety + deth / 2;

    var extra_height = 0.0;
    var extra_height_pix = extra_height * deth;
    deth = deth + extra_height_pix;
    dety = dety - extra_height_pix;


    // source width and height
    var sw = detw;
    var sh = deth;

    // Possition of the larger box
    //var sx = mx - w/2;
    //var sy = my - h/2;

    var sx = detx;
    var sy = dety;

    var dw = detw;
    var dh = deth;

    dw = cutout_video.width;
    dh = cutout_video.height;
    sh = detw;
    sw = deth;
    sx = detx;
    sy = dety;

    // Destination x and y = 0,0 for top left of the box
    var dx = 0;
    var dy = 0;
    last_rect = {
      sx: sx,
      sy: sy,
      sw: sw,
      sh: sh,
      dx: dx,
      dy: dy,
      dw: dw,
      dh: dh
    };
  }
  if (last_rect.sx != undefined) {
    var ctx = cutcanvas.getContext();
    ctx.drawImage(webcam_video,
      last_rect.sx,
      last_rect.sy,
      last_rect.sw,
      last_rect.sh,
      last_rect.dx,
      last_rect.dy,
      last_rect.dw,
      last_rect.dh);
    cutcanvas.update();
  }
  window.requestAnimationFrame(copyCutout);
}
