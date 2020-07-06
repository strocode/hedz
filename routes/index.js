var express = require('express');
const crypto = require('crypto');
var router = express.Router();
const path = require('path');
const jsdom = require('jsdom');
const DatauriParser = require('datauri/parser');
const parser = new DatauriParser();
const { JSDOM } = jsdom;

games = {};

function calcTURNCredentials(name, secret, expire_sec) {
  // From Here: https://www.google.com/search?client=firefox-b-d&q=how+to+use+COTURN+REST+API
    const unixTimeStamp = parseInt(Date.now()/1000) + expire_sec;
    const username = [unixTimeStamp, name].join(':');
    let hmac = crypto.createHmac('sha1', secret);
    hmac.setEncoding('base64');
    hmac.write(username);
    hmac.end();
    const password = hmac.read();
    return {
        username: username,
        password: password
    };
}

function getIceServer(name) {
  // Returns an ice server configuration for the given username
  // That can be plugged straight into a webtrc setup
  // See: https://tools.ietf.org/html/draft-uberti-behave-turn-rest-00
  // See: https://developer.mozilla.org/en-US/docs/Web/API/RTCIceServer
  // turn defualt port: 3478 turns: 5349
  let expire_sec = process.env.TURN_EXPIRE_SEC || 86400;
  let turn_server = process.env.TURN_SERVER || 'localhost';
  let turn_port = process.env.TURN_PORT || 5349;
  let turn_proto = process.env.TURN_PROTO || 'turns'; // 'turn' or 'turns'
  let cred = calcTURNCredentials(name, process.env.TURN_SECRET, expire_sec);
  const iceServer = {
    username:cred.username,
    credential:cred.password,
    urls: [turn_proto + ':' + turn_server + ':' + turn_port + '?transport=udp',
           turn_proto + ':' + turn_server + ':' + turn_port + '?transport=tcp']
  };

  return iceServer;
}

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Welcome to RocketHedz' });
});

/* Go to new game. Rediects to a random game page */
router.get('/newgame', async function(req, res, next) {
  let gameId = req.query.gameId;
  console.log(`newgame query gameid is ${req.query.gameId}`);
  if (gameId === undefined) {
    // Make a number
    let randnum = Math.round(Math.random()*1e9);
    //let randstr = randndatum.toString(36);

    // make some bits bits of randomness
    let randarr = new Uint32Array(2);
    crypto.randomFillSync(randarr);
    // take those numbers and turn them into a base36 string array.
    gameId = randarr.reduce((acc, val) => acc + val.toString(36), '');
  }
  console.log('New game randstr' + gameId);
  res.cookie("gameid", gameId, {
    maxAge: 1000*60*60, // milliseconds
  });

  res.redirect(`/game/${gameId}`);
});


router.get('/game/:gameId', async function(req, res, next) {
    const gameId = req.params.gameId;
    console.log('GameID is ' + gameId);

    let game;
    if (! (gameId in games)) {
      const io = req.app.get('socketio');
      let game = await setupAuthoritativePhaser(gameId, io);
      games[gameId] = game;
    }
    game = games[gameId];

    // send game HTml file to client
    res.sendFile(path.join(__dirname, '../public/game/rockethedz.html'));

});

function setupAuthoritativePhaser(gameId, io) {
  return new Promise((resolve, reject) => {
    JSDOM.fromFile(path.join(__dirname, '../rockethedz_game_server/index.html'), {
      // To run the scripts in the html file
      runScripts: "dangerously",
      // Also load supported external resources
      resources: "usable",
      // So requestAnimatinFrame events fire
      pretendToBeVisual: true
    }).then((dom) => {

      // Add createObjectURL and revokeObjectURL because JSDOM doesn't have implementations
      dom.window.URL.createObjectURL = (blob) => {
        if (blob){
          const content = parser.format(blob.type, blob[Object.getOwnPropertySymbols(blob)[0]]._buffer).content;
          return content;
        }
      };
      const socketNamespace = '/rockethedz/' + gameId;
      dom.window.URL.revokeObjectURL = (objectURL) => {};
      dom.window.io = io.of(socketNamespace);
      dom.window.gameId = gameId;
      dom.window.getIceServer = getIceServer;
      dom.window.onFinished = () => {
        console.log('Game', gameId, 'finished');
        dom.window.close();
        delete games[gameId];
      }

      dom.window.gameLoaded = (game) => {
        let gameobj = {
          dom: dom,
          game: game
        }
        resolve(gameobj);
      };
    }).catch((error) => {
      reject(Error(error.message));
    });
  });
}

module.exports = router;
