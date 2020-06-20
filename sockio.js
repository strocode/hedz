// Socket IO setup - KB
// I'm not sure if this is the best way to do this but we'll do it this way
// For now.
// This file gets imported and called by bin/www
let io = require('socket.io');
let rhedz = require('./rockethedz_game_server/js/server')

function setServer(server) {
  server.of('/rockethedz/').on('connect', (socket) => {
    console.log(`Socket ${socket.id} connected`);

    socket.on('disconnect', (reason) => {
      const rooms = Object.keys(socket.rooms).join();
      console.log(`Socket ${socket.id} disconnectfor ${reason}. They are in ${rooms}`);
    });

    socket.on('disconnecting', (reason) => {
      const rooms = Object.keys(socket.rooms).join();
      console.log(`Socket ${socket.id} disconnecting for ${reason}. They are in ${rooms}`);
    });

    socket.on('error', (error) => {
      console.log(`Socket ${socket.id} error for ${error}`);
    });

    socket.on('join', (data) => {
        let room = data.room;
        socket.join(room, (err) => {
          if (err == null) {
              console.log(`Socket ${socket.id} joined room ${room}`);
              rhedz(socket, room).then(() => {
                console.log('Game room joined successfully)')
              }).catch( (err) => {
                  console.log(`Error creatign game ${err}`);
              });
          }
        });
    });
  });

  console.log('Configured socket.io server');
};

module.exports = setServer;
