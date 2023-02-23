import express from "express";
import { Server } from "socket.io";
import * as http from "http";

var app = express();

app.get("/", function (req, res) {
  res.send("Hello it's me battleship-app-server 🔥");
});
app.get("/folder", function (req, res) {
  res.send("Folder!");
});

var httpServer = http.createServer(app).listen(8082);

var io = new Server(httpServer, { cors: { origin: "*" } });

const players = [];

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

  socket.on("fieldClicked", function (fieldElement) {
    // console.log(fieldElement);
  });

  socket.on("allShipsPicked", function (shipsPickedData) {
    console.log(
      "Player " + socket.id + " ready",
      JSON.stringify(shipsPickedData)
    );
    socket.emit("blockClickingOnBoard", true);

    var playerIndex = getPlayerIndex(socket);
    var opponentIndex = getOpponentIndex(playerIndex);

    for (const [index, p] of Object.entries(players)) {
      if (p.socket.id == socket.id) {
        p.ships = shipsPickedData;
      } else {
        p.socket.emit("opponentIsReady", {
          id: socket.id,
          name: players[playerIndex].name,
        });
      }
    }

    if (
      players[playerIndex].ships.length > 0 &&
      players[opponentIndex].ships.length > 0
    ) {
      io.to("game").emit("theGameIsOn", true);

      var playerId = Object.keys(players)[Math.round(Math.random())];
      players[playerId].socket.emit("yourTurn", true);
    }
  });

  socket.on("disconnect", function (reason) {
    delete players[socket.id];
    console.log("Player ❌ disconnected", socket.id);
  });
});

function getPlayerIndex(socket) {
  return socket.id;
}

function getOpponentIndex(playerIndex) {
  var opponentIndex = null;
  for (const [index, p] of Object.entries(players)) {
    if (playerIndex != index) opponentIndex = index;
  }

  if (!opponentIndex) throw "Trouble getting opponent index";

  return opponentIndex;
}
