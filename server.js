const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve frontend files
app.use(express.static(path.join(__dirname, "public")));

// When a user connects
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Receive drawing data from one user
  socket.on("draw", (data) => {
    // Send to all other users
    socket.broadcast.emit("draw", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// IMPORTANT: For global multiplayer
server.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});
