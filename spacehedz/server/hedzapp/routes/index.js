var express = require('express');
const crypto = require('crypto');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/* Go to new game. Rediects to a random game page */
router.get('/newgame', function(req, res, next) {
  // Make a number
  let randnum = Math.round(Math.random()*1e9);
  //let randstr = randnum.toString(36);

  // make some bits bits of randomness
  let randarr = new Uint32Array(2);
  crypto.randomFillSync(randarr);

  // take those numbers and turn them into a base36 string array.
  let randstr = randarr.reduce((acc, val) => acc + val.toString(36), '');
  console.log('New game randstr' + randstr);
  res.cookie("gameid", randstr, {
    maxAge: 1000*60*60*24*30, // 30 days in milliseconds
  });
  res.redirect(`/game/${randstr}`);
});

router.get('/game/:gameId', function(req, res, next) {
    const gameId = req.params.gameId;
    console.log('GameID is ' + gameId);

    // send game HTml file to client
    res.send(gameId);
});

module.exports = router;
