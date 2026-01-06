const { Server } = require('socket.io');

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: '*', // Allow all for now, lock down for production later
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // Join a specific channel room
    socket.on('join_channel', (channelId) => {
      socket.join(channelId);
      console.log(`User ${socket.id} joined channel: ${channelId}`);
    });

    // Send message event (received from client)
    socket.on('send_message', (data) => {
      // Broadcast to others in the room
      socket.to(data.channelId).emit('receive_message', data);
    });

    socket.on('disconnect', () => {
      console.log('User Disconnected', socket.id);
    });
  });

  return io;
};

module.exports = initializeSocket;
