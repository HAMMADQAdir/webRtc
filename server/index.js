// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] },
});

const rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    rooms[roomId] = rooms[roomId] || [];
    rooms[roomId].push(socket.id);
    io.to(roomId).emit("user-list", rooms[roomId].filter((id) => id !== socket.id));
  });

  socket.on("offer", (targetUserId, offer) => {
    io.to(targetUserId).emit("offer", socket.id, offer);
  });

  socket.on("answer", (targetUserId, answer) => {
    io.to(targetUserId).emit("answer", socket.id, answer);
  });

  socket.on("ice-candidate", (targetUserId, candidate) => {
    io.to(targetUserId).emit("ice-candidate", socket.id, candidate);
  });

  socket.on("disconnecting", () => {
    const roomsJoined = Array.from(socket.rooms);
    roomsJoined.forEach((roomId) => {
      rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);
      io.to(roomId).emit("user-list", rooms[roomId]);
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(5000, () => console.log("Server is running on http://localhost:5000"));
