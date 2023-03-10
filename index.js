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

  socket.on("setPlayerName", function (recivedName) {
    var playerIndex = getPlayerIndex(socket);
    var opponentIndex = getOpponentIndex(playerIndex);

    if (socket.id == playerIndex) {
      players[playerIndex].name = recivedName;
      players[opponentIndex].socket.emit(
        "setOpponentName",
        players[playerIndex].name
      );
    } else {
      players[opponentIndex].name = recivedName;
      players[playerIndex].socket.emit(
        "setOpponentName",
        players[opponentIndex].name
      );
    }
  });

  /**
   *
   */

  socket.on("fieldClicked", function (fieldElement) {
    // console.log(fieldElement);
  });

  socket.on("allShipsPicked", function (shipsPickedData) {
    // console.log(
    //   "Player " + socket.id + " ready",
    //   JSON.stringify(shipsPickedData)
    // );
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

  socket.on("shotFired", (data) => {
    var fieldElement = data.fieldElement;

    var playerIndex = getPlayerIndex(socket);
    var opponentIndex = getOpponentIndex(playerIndex);

    if (checkIfPlayerHitShip(opponentIndex, fieldElement)) {
      io.to("game").emit("shotHit", {
        shotHitBy: playerIndex,
        fieldElement: fieldElement,
      });

      var shipCheckedForHit = checkAndGetSunkShip(opponentIndex, fieldElement);

      if (shipCheckedForHit) {
        io.to("game").emit("hitAndSunk", {
          hitBy: playerIndex,
          ship: shipCheckedForHit,
        });
        players[opponentIndex].ships.find(
          (ship) => ship.id == shipCheckedForHit.id
        ).isSunk = true;

        if (getShipsLeftOnBoard(opponentIndex) === 0) {
          io.to("game").emit("theGameIsOver", true);
          players[playerIndex].socket.emit("youWin");
          players[opponentIndex].socket.emit("youLoose");
        }
      }
    } else {
      io.to("game").emit("shotMissed", {
        missedBy: playerIndex,
        fieldElement: fieldElement,
      });
      socket.emit("blockClickingOnBoard", true);
      players[opponentIndex].socket.emit("yourTurn", true);
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

function checkIfPlayerHitShip(justPlayerIndex, fieldElement) {
  var allPlayerShips = players[justPlayerIndex].ships;
  var isFieldHit = false;

  allPlayerShips.forEach((individualShip, whichShip) => {
    individualShip.pickedNodes.forEach((individualShipNode, whichNode) => {
      if (
        fieldElement.fieldRow == individualShipNode.fieldRow &&
        fieldElement.fieldColumn == individualShipNode.fieldColumn
      ) {
        players[justPlayerIndex].ships[whichShip].pickedNodes[
          whichNode
        ].isFieldHit = true;
        isFieldHit = true;
      }
    });
  });
  return isFieldHit;
}

function checkAndGetSunkShip(justPlayerIndex, fieldElement) {
  var allPlayerShips = players[justPlayerIndex].ships;
  var eHitShip = null;

  allPlayerShips.forEach((individualShip) => {
    individualShip.pickedNodes.forEach((shipNode) => {
      if (
        shipNode.fieldColumn == fieldElement.fieldColumn &&
        shipNode.fieldRow == fieldElement.fieldRow
      ) {
        eHitShip = individualShip;
      }
    });
  });

  var alreadyHitShipNodes = 0;

  if (eHitShip) {
    eHitShip.pickedNodes.forEach((shipNode) => {
      if (shipNode.isFieldHit) ++alreadyHitShipNodes;
    });

    if (eHitShip.pickedNodes.length == alreadyHitShipNodes) {
      return eHitShip;
    }
  }

  return false;
}

function getShipsLeftOnBoard(justPlayerIndex) {
  var amountOfShipsLeft = 0;

  players[justPlayerIndex].ships.forEach((individualShip) => {
    if (!individualShip.isSunk) ++amountOfShipsLeft;
  });
  return amountOfShipsLeft;
}
