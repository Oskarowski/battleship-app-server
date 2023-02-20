import express from "express";
import { Server } from "socket.io";
import * as http from "http";

var app = express();

app.get("/", function (req, res) {
  res.send("Hello World");
});
app.get("/folder", function (req, res) {
  res.send("Folder!");
});

var httpServer = http.createServer(app).listen(8082);

var io = new Server(httpServer, { cors: { origin: "*" } });

const players = [];

function getPlayerIndex(socket) {
  return socket.id;
}

io.on("connection", (socket) => {
  if (Object.keys(players).length == 2) return socket.disconnect(true);
  console.log("Player ✅ connection", socket.id);

  players[socket.id] = {
    socket: socket,
    name: null,
    ships: [],
  };

  socket.emit("yourID", socket.id);

  socket.join("game");

  socket.on("greeting", function (data) {
    players[socket.id].name = data.playerName;
    console.log("Hello from " + data.playerName);
  });

  /**
   *
   */

  socket.on("disconnect", function (reason) {
    delete players[socket.id];
    console.log("Player ❌ disconnected", socket.id);
  });

  socket.on("fieldClicked", function (fieldElement) {
    console.log(fieldElement);
  });
});
