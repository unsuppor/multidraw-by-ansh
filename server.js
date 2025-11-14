// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("draw", (data) => {
    socket.broadcast.emit("draw", data);
  });

  socket.on("clear", () => {
    socket.broadcast.emit("clear");
  });

  socket.on("bg", (data) => {
    socket.broadcast.emit("bg", data);
  });

  socket.on("fill", (data) => {
    socket.broadcast.emit("fill", data);
  });

  // CHAT SYSTEM
  socket.on("chat", (msg) => {
    io.emit("chat", msg); // send to all users
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () =>
  console.log("Server running on port", PORT)
);
