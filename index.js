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

const PORT = process.env.PORT || 8082;

var httpServer = http.createServer(app).listen(PORT);

var io = new Server(httpServer, { cors: { origin: "*" } });

const allRooms = [];
const players = []; // table which stores players obj

io.on("connection", (socket) => {
  console.log("Player ✅ connection", socket.id);

  players[socket.id] = {
    socket: socket,
    name: null,
    ships: [],
    roomID: null,
    hasPickedShips: false,
  };

  if (allRooms.length === 0) {
    generateNewRoom();
  }

  for (var room in allRooms) {
    const currentRoom = allRooms[room];
    const currentRoomID = currentRoom.id;
    if (currentRoom.playersIn < 2) {
      if (players[socket.id].roomID == null) {
        currentRoom.playersIn++;
        players[socket.id].roomID = String(currentRoomID);
        currentRoom.playersInRoom.push(socket.id);
        break;
      }
    }
  }
  if (players[socket.id].roomID == null) {
    generateNewRoom();
    for (var room in allRooms) {
      const currentRoom = allRooms[room];
      const currentRoomID = currentRoom.id;
      if (currentRoom.playersIn < 2) {
        if (players[socket.id].roomID == null) {
          currentRoom.playersIn++;
          players[socket.id].roomID = String(currentRoomID);
          currentRoom.playersInRoom.push(socket.id);
          break;
        }
      }
    }
  }

  /**
   * Prevents the user from starting the game if there is no opponent in the room to play against. Prevents the error "Trouble getting opponent index";
   * returns false if there are less then 2 players in the room
   * returns true if there are exactly 2 players in the room
   */
  socket.on("playBtnClicked", (data, callback) => {
    // console.log(data); // "Checking for opponent in room"
    const neededRoomID = Number(players[socket.id].roomID);
    var isThereEnoughPlayersToStart = null;
    for (var room in allRooms) {
      const currentRoom = allRooms[room];
      if (currentRoom.id === neededRoomID) {
        if (Number(currentRoom.playersIn) === 2)
          isThereEnoughPlayersToStart = true;
        else isThereEnoughPlayersToStart = false;
        break;
      }
    }
    if (isThereEnoughPlayersToStart === null)
      throw "Trouble getting quantity of players in room";
    callback(isThereEnoughPlayersToStart);
  });

  socket.emit("yourID", socket.id);

  socket.join(players[socket.id].roomID);

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

  socket.on("fieldClicked", function (fieldElement) {
    // console.log(fieldElement);
  });

  socket.on("allShipsPicked", function (shipsPickedData) {
    // console.log(
    //   "Player " + socket.id + " ready",
    //   JSON.stringify(shipsPickedData)
    // );
    socket.emit("blockClickingOnBoard", true);

    const playerIndex = getPlayerIndex(socket);
    const opponentIndex = getOpponentIndex(playerIndex);

    for (const [index, p] of Object.entries(players)) {
      if (p.socket.id == socket.id) {
        p.ships = shipsPickedData;
        p.hasPickedShips = true;
      } else {
        players[opponentIndex].socket.emit("opponentIsReady", {
          id: socket.id,
          name: players[playerIndex].name,
        });
      }
    }

    if (
      players[playerIndex].ships.length > 0 &&
      players[opponentIndex].ships.length > 0
    ) {
      io.to(players[socket.id].roomID).emit("theGameIsOn", true);

      const indexWhoIsStarting = Math.round(Math.random());
      const whichRoomToServe = Number(players[socket.id].roomID);
      var whichPlayerStarts = null;
      for (var room in allRooms) {
        const currentRoom = allRooms[room];
        if (currentRoom.id === whichRoomToServe) {
          whichPlayerStarts = currentRoom.playersInRoom[indexWhoIsStarting];
          break;
        }
      }
      players[whichPlayerStarts].socket.emit("yourTurn", true);
    }
  });

  socket.on("shotFired", (data) => {
    var fieldElement = data.fieldElement;

    var playerIndex = getPlayerIndex(socket);
    var opponentIndex = getOpponentIndex(playerIndex);

    if (checkIfPlayerHitShip(opponentIndex, fieldElement)) {
      io.to(players[socket.id].roomID).emit("shotHit", {
        shotHitBy: playerIndex,
        fieldElement: fieldElement,
      });

      var shipCheckedForHit = checkAndGetSunkShip(opponentIndex, fieldElement);

      if (shipCheckedForHit) {
        io.to(players[socket.id].roomID).emit("hitAndSunk", {
          hitBy: playerIndex,
          ship: shipCheckedForHit,
        });
        players[opponentIndex].ships.find(
          (ship) => ship.id == shipCheckedForHit.id
        ).isSunk = true;

        if (getShipsLeftOnBoard(opponentIndex) === 0) {
          io.to(players[socket.id].roomID).emit("theGameIsOver", true);
          players[playerIndex].socket.emit("youWin");
          players[opponentIndex].socket.emit("youLoose");
        }
      }
    } else {
      io.to(players[socket.id].roomID).emit("shotMissed", {
        missedBy: playerIndex,
        fieldElement: fieldElement,
      });
      socket.emit("blockClickingOnBoard", true);
      players[opponentIndex].socket.emit("yourTurn", true);
    }
  });

  socket.on("theGameIsOver", (data) => {
    const playerIndex = getPlayerIndex(socket);
    players[playerIndex].ships = [];
    players[playerIndex].hasPickedShips = false;
  });

  socket.on("disconnect", function (reason) {
    // console.log("⚗ Process of disconnecting ...");
    const roomLeft = players[socket.id].roomID;
    for (var room in allRooms) {
      const currentRoom = allRooms[room];
      const currentRoomID = Number(currentRoom.id);
      if (currentRoomID === Number(roomLeft)) {
        // io.to(players[socket.id].roomID).emit("theGameIsOver", true);
        io.to(roomLeft).emit("opponentDisconnected", true);
        currentRoom.playersIn--;
        for (var i = 0; i < currentRoom.playersInRoom.length; i++) {
          if (currentRoom.playersInRoom[i] === socket.id) {
            var arrOfPla = currentRoom.playersInRoom;
            arrOfPla.splice(i, 1);
          }
        }
        if (currentRoom.playersIn === 0) {
          delete allRooms[room];
        }
      }
    }

    delete players[socket.id];
    console.log("Player ❌ disconnected", socket.id);
    // console.log("allRooms", allRooms);
  });
});

// No connection needed functions:

function getPlayerIndex(socket) {
  return socket.id;
}

function getOpponentIndex(playerIndex) {
  var opponentIndex = null;
  for (const [index, p] of Object.entries(players)) {
    if (
      playerIndex != index &&
      players[playerIndex].roomID === players[index].roomID
    ) {
      opponentIndex = index;
    }
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

function getPlayerRoom(justPlayerIndex) {
  return players[justPlayerIndex].roomID;
}

function generateNewRoom() {
  const generatedRoomID = Math.floor(Math.random() * 100) + 1;
  for (var room in allRooms) {
    const currentRoom = allRooms[room];
    if (currentRoom.id === generatedRoomID) {
      generateNewRoom();
    }
  }
  allRooms.push({ id: generatedRoomID, playersIn: 0, playersInRoom: [] });
}
