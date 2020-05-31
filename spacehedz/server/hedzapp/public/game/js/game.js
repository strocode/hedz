'use strict'

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const MAX_SMILE_HEIGHT = 300;

var config = {
  type: Phaser.AUTO,
  parent: 'game-div',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  // I think I need dom.createContainer = true for video?
  dom: {
    createContainer: true
  },
  physics: {
        default: 'impact',
        impact: {
            setBounds: {
                x: 0,
                y: 0,
                width: GAME_WIDTH,
                height: GAME_HEIGHT,
                thickness: 32
            }
        }
    },
  scene: {
    preload: preload,
    create: create,
    update: update,
    extend: {
            minimap: null,
            player: null,
            cursors: null,
            thrust: null,
            flares: null,
            bullets: null,
            lastFired: 0,
            text: null,
            //createBulletEmitter: createBulletEmitter,
            //createStarfield: createStarfield,
            //createLandscape: createLandscape,
            //createAliens: createAliens,
            createThrustEmitter: createThrustEmitter
        },
  }
};

var game;
var pc;
var webcam_stream = null;
var screen_stream = null;
var resizedDetections = [];
var detections = [];
var last_rect = {};
var webcam_video; // Video element containing whole webcam frame
var cutout_video; // Video element containing cutout copied from webcam frame

class RocketHead {
  constructor(scene, playerInfo, sprite)
  {
    console.log(`Creating player ${playerInfo.playerId} ${sprite}`);
    //super(scene, playerInfo.x, playerInfo.y);
    this.scene = scene;
    scene.add.existing(this);

    this.playerSprite = scene.add.sprite(playerInfo.x, playerInfo.y, sprite).setOrigin(0.5, 0.5).setDisplaySize(128, 128);
    this.playerBorder = scene.add.rectangle(playerInfo.x, playerInfo.y, 128+2, 128+2).setOrigin(0.5,0.5);

    if (playerInfo.team === 'blue') {
      this.playerBorder.setStrokeStyle(2,0x0000ff,1);
    } else {
      this.playerBorder.setStrokeStyle(2,0xff0000,1);
    }

    this.playerSprite.playerId = playerInfo.playerId;
    this.playerSprite.parent = this;
    this.playerInfo = playerInfo;
  }

  set video(thevideo) {
    // Must be a canvas or video element
    console.log(`Setting video for player ${this.playerInfo.playerId}`);
    this._video = thevideo;
    this.videoelement = this.scene.add.dom(this.playerInfo.x, this.playerInfo.y, thevideo);
    this.videoelement.width = 128;
    this.videoelement.height = 128;
  }

  get video() {
    return this._video;
  }

  setRotation(rot) {
    this?.playerSprite.setRotation(rot);
    this?.videoelement.setRotation(rot);
    this?.playerBorder.setRotation(rot);
  }

  setPosition(x, y) {
    console.log(`Setting position of player ${this.playerInfo.playerId} to [${x}, ${y}]`)
    this?.playerSprite.setPosition(x, y);
    this?.videoelement.setPosition(x, y);
    this?.playerBorder.setPosition(x, y);;
  }

  destroy() {
    this?.playerSprite.destroy();
    this?.videoelement.destroy();
    this?.playerBorder.destroy();
  }
}


const MODEL_PATH = '/game/models'

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_PATH),
  faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_PATH),
  faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_PATH),
  faceapi.nets.faceExpressionNet.loadFromUri(MODEL_PATH)
]).then(startGame);

function startGame() {
  game = new Phaser.Game(config);
  pc = createMyPeerConnection();
}


function preload() {
  this.load.image('ship', 'assets/spaceShips_001.png');
  this.load.image('otherPlayer', 'assets/enemyBlack5.png');
  this.load.image('star', 'assets/star_gold.png');
  this.load.image('jets', 'phaser3_assets/particles/blue.png');
  this.load.image('flares', 'phaser3_assets/particles/yellow.png');
}

function create() {
  var self = this;
  const url_bits = window.location.href.split('/');
  this.gameId = url_bits[url_bits.length - 1];
  this.socketNamespace = '/rockethedz/' + this.gameId
  this.socket = io(this.socketNamespace);
  this.playerId = this.socket.id;
  this.players = this.add.group();
  this.playerMap = {};

  this.blueScoreText = this.add.text(16, 16, '', {
    fontSize: '32px',
    fill: '#0000FF'
  });
  this.redScoreText = this.add.text(584, 16, '', {
    fontSize: '32px',
    fill: '#FF0000'
  });

  this.statusText = this.add.text(16, 600-16-4, '', {
    fontSize:'16px',
    fill:'#FF0000'
  });

  this.smileMeter = this.add.rectangle(20,GAME_HEIGHT-20, 20, 100, 0x00ff00, 0.5).setOrigin(0.5,1.0);
  this.boostMeter = this.add.rectangle(50,GAME_HEIGHT-20, 20, 100, 0x00ff00, 0.5).setOrigin(0.5,1.0);

  self.chatPlayer = null;
  self.mediaMaster = null;
  self.mediaSent = false;

  this.createThrustEmitter();

  self.cutout_video = document.createElement('canvas');
  self.cutout_video.height = 128;
  self.cutout_video.width = 128;
  webcamVideo(self, self.cutout_video);

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
    console.log('Track event' + event.track.kind);
    if (evt.track.kind == 'video') {
      addVideo(evt.streams[0]);
      self.players.getChildren().forEach(function(player) {
        // TODO: work out from the event which player video this is
        if (player.playerId !== self.socket.id) {
          player.parent.video.srcObject = evt.streams[0];
          sendCutout(self);
          //player.videoelement.play();
          //player.parent.video.play();
        }
      });
    } else if (evt.track.kind == 'audio') {
      var audio_elem = document.createElement("audio");
      // var audio_elem = document.getElementById("audio");
      audio_elem.srcObject = evt.streams[0];
      audio_elem.play();
      // This is the trigger to send my media back if we haven't already
      sendAudio(self);
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



  // called when first connected to notify client of list of existing players
  this.socket.on('currentPlayers', function(players) {
    console.log(`Current players: + ${Object.keys(players).length} My socket ${self.socket.id}`);
    Object.keys(players).forEach(function(id) {
      if (players[id].playerId === self.socket.id) {
        displayPlayers(self, players[id], 'myheadvideo');
      } else {
        displayPlayers(self, players[id], 'otherPlayer');
      }
    });
  });

  // Called when already connected and a new player arrives
  this.socket.on('newPlayer', function(playerInfo) {
    console.log('New player'+playerInfo.playerId);
    displayPlayers(self, playerInfo, 'otherPlayer');
    setChatPlayer(self, playerInfo);
    // send send our media to the new player. The new player doesn't
    // get the newPlayer event so they have to wait until they
    // have received our media before they start sending theirs back

    // We're the media mediaMaster
    self.mediaMaster = true;
    sendMedia(self);
  });

  this.socket.on('disconnect', function(playerId) {
    console.log(`Player ${playerId} disconnected`);
    self.players.getChildren().forEach(function(player) {
      if (playerId === player.playerId) {
        player.parent.destroy();
      }
      delete self.playerMap[playerId];
      if (playerId == self.chatPlayer) {
        self.chatPlayer = null;
        self.mediaSent = false;
        // TODO: Send video to another player?
      }
    });
  });

  this.socket.on('playerUpdates', function(players) {
    Object.keys(players).forEach(function(id) {
      self.players.getChildren().forEach(function(player) {
        const pli = players[id];
        if (players[id].playerId === player.playerId) {
          player.parent.setRotation(pli.rotation);
          player.parent.setPosition(pli.x, pli.y);
          if (pli.thrusting) {
            self.thrust.setPosition(pli.x, pli.y);
            const deg = Phaser.Math.RadToDeg(pli.rotation);
            const thrustCone = pli.boostLevel === 1 ? 20 : 10;
            self.thrust.setAngle({
              min:deg-thrustCone+90,
              max:deg+thrustCone+90
            });
            self.thrust.setSpeed(pli.boostLevel === 1 ? 1000 : 500);
            //self.thrust.setLifeSpan(pli.boostLevel === 1 ? 250 : 100);
            self.thrust.emitParticle(32);
          }

        }
        setChatPlayer(self, player);
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

function setChatPlayer(self, player) {
  // send video to the first player we see that isnt us
  if (player.playerId !== self.socket.id && self.chatPlayer === null) {
      self.chatPlayer = player.playerId;
      console.log('Set chat player to ' + self.chatPlayer);

    }
  }
  function sendMedia(self) {
    // send video to the first player we see that isnt us
    if (self.chatPlayer !== null && ! self.mediaSent) {
      self.mediaSent = true;
      sendAudio(self);
      sendCutout(self);
    }

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
    sendPlayerStatus(this);
  }
  //this.physics.world.wrap(this.thrust, 5);

}

function sendPlayerStatus(self) {
    self.socket.emit('playerInput', {
      left: self.leftKeyPressed,
      right: self.rightKeyPressed,
      up: self.upKeyPressed,
      smileLevel: self.smileMeter.displayHeight / MAX_SMILE_HEIGHT,
      boostLevel: self.boostMeter.displayHeight / MAX_SMILE_HEIGHT,
    });
}


function displayPlayers(self, playerInfo, sprite) {
  if (!(playerInfo.playerId in self.playerMap)) {
    const player = new RocketHead(self, playerInfo, sprite);
    if (sprite === 'myheadvideo') {
      player.video = self.cutout_video;
    } else {
      let video = document.createElement('video');
      video.autoplay = true;
      video.playsinline = true;
      player.video = video;
    }
      //self.add.existing(player); - I think this already happens in the construtor?
    self.players.add(player.playerSprite);
    self.playerMap[playerInfo.playerId] = player;
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


function webcamVideo(self, headCanvas) {
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
    const video = addVideo(stream);
    // set global variable
    webcam_video = video;
    cutout_video = headCanvas;

    // Send cutout if we got a new player before we got the video to open
    sendCutout(self);
    video.addEventListener('canplay', () => {
        const showOverlay = false;
        if (showOverlay) {
          const canvas = faceapi.createCanvasFromMedia(video)
          document.body.append(canvas)
          const displaySize = {
            width: video.width,
            height: video.height
          }
          faceapi.matchDimensions(canvas, displaySize);
        }

        setInterval(async () => {
          //console.time('detections');
          const tstart = performance.now();
          detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions();
          const tend = performance.now();
          detections.tstart = tstart;
          detections.tend = tend;
          const tdiff = Math.round(tend - tstart);
          const ndet = detections.length;
          let txt = `Detection time ${tdiff}ms ndet=${ndet}`
          //console.timeEnd('detections');
          //resizedDetections = faceapi.resizeResults(detections, displaySize)

          if (detections.length === 1) {
            const smileValue = detections[0].expressions.happy;
            const maxh = MAX_SMILE_HEIGHT;
            self.smileMeter.displayHeight = maxh*smileValue;
            let h = self.boostMeter.displayHeight;
            if (smileValue >= 0.8) {
              h += 10;
              if (h > maxh) {
                h = maxh;
                // make boost happen for 3 seconds()
              }
            } else {
              h -= 10;
              if (h < 0) {
                h = 0;
              }
            }

            self.boostMeter.displayHeight = h;
            if (h == MAX_SMILE_HEIGHT) {
                startBoost(self);
            }

            txt = txt + ` smile=${smileValue}`
          }

          self.statusText.setText(txt);

          if (showOverlay) {
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

// start copying cutout
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
  //v.play(); // cant do unless interacted first
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
    var ctx = cutcanvas.getContext("2d");
    ctx.drawImage(webcam_video,
      last_rect.sx,
      last_rect.sy,
      last_rect.sw,
      last_rect.sh,
      last_rect.dx,
      last_rect.dy,
      last_rect.dw,
      last_rect.dh);
      // update() is really slow. because it calls getImageData()
    //cutcanvas.update();

    // Let's try this one - which doesnt call getImageData but does refres the
    // texture. Note the phaser sources says this is slow too, so we should maybe
    // be doing something completely different
    //https://github.com/photonstorm/phaser/blob/v3.22.0/src/textures/CanvasTexture.js
    //cutcanvas.refresh();
  }
  window.requestAnimationFrame(copyCutout);
}

function sendAudio(self) {
  if (self.audioSent) {
    return;
  }
  var constraints = {
    audio: {
      echo_cancellation: true
    }
  };

  navigator.mediaDevices.getUserMedia(constraints).then(stream => {
    var audio_track = stream.getAudioTracks()[0];
    pc.addTrack(audio_track, stream);
    self.audioSent = true;
  });
}

function sendCutout(self) {
  if (self.cutoutSent) {
    return;
  }
  if (self.chatPlayer == undefined) {
    console.log('Requested cutout but now chat player');
  }
  if (cutout_video !== undefined) {
    console.log('Adding cutout video track to peer connection');
    var stream = cutout_video.captureStream(30);
    var track = stream.getVideoTracks()[0];
    pc.addTrack(track, stream);
    self.cutoutSent = true;
  } else {
    console.log("Cutout video not yet defined!");
  }
}

function startBoost(self) {
  sendPlayerStatus(self);
}

function createThrustEmitter ()
{
    this.thrust = this.add.particles('jets').createEmitter({
        x: 1600,
        y: 200,
        angle: { min: 160, max: 200 },
        scale: { start: 0.5, end: 0 },
        lifespan: 250,
        blendMode: 'ADD',
        on: false
    });
}
