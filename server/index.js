const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Allow your frontend origin
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
    
    // Notify others in the room about the new user
    socket.to(roomId).emit("user-connected", socket.id);
  });

  socket.on("offer", (roomId, offer) => {
    // Send the offer to all other users in the room except the sender
    socket.to(roomId).emit("offer", socket.id, offer);
  });

  socket.on("answer", (roomId, answer) => {
    // Send the answer to all other users in the room except the sender
    socket.to(roomId).emit("answer", socket.id, answer);
  });

  socket.on("ice-candidate", (roomId, candidate) => {
    // Forward ICE candidates to other users in the room
    socket.to(roomId).emit("ice-candidate", socket.id, candidate);
  });

  // Notify others in the room when the user is disconnecting
  socket.on("disconnecting", () => {
    const rooms = Array.from(socket.rooms); // List of rooms the socket is connected to
    rooms.forEach((roomId) => {
      if (roomId !== socket.id) {
        socket.to(roomId).emit("user-disconnected", socket.id);
        console.log(`User ${socket.id} is leaving room ${roomId}`);
      }
    });
  });

  // Log user disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(5000, () => {
  console.log("Server is running on http://localhost:5000");
});
