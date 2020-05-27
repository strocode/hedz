var express = require('express');
const crypto = require('crypto');
var router = express.Router();
const path = require('path');
const jsdom = require('jsdom');
const DatauriParser = require('datauri/parser');
const parser = new DatauriParser();
const { JSDOM } = jsdom;


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
  const io = req.app.get('socketio');
  let dom = await setupAuthoritativePhaser(gameId, io);
  res.redirect(`/game/${gameId}`);
});

router.get('/game/:gameId', function(req, res, next) {
    const gameId = req.params.gameId;
    console.log('GameID is ' + gameId);

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
      dom.window.gameLoaded = () => {
        resolve(dom);
      };
    }).catch((error) => {
      reject(Error(error.message));
    });
  });
}

module.exports = router;
