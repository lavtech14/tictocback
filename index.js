const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Change to your frontend URL in production
    methods: ["GET", "POST"],
  },
});

app.use(cors());

const PORT = 5000;

// Store room state
let rooms = {}; // roomId: { players: [socket.id], board: [], xIsNext: true }

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  socket.on("join-room", (roomId) => {
    console.log(`Socket ${socket.id} attempting to join ${roomId}`);

    // Create room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        board: Array(9).fill(null),
        xIsNext: true,
      };
    }

    const room = rooms[roomId];

    // Prevent more than 2 players
    if (room.players.length >= 2) {
      socket.emit("room-full");
      return;
    }

    // Add player if not already in room
    if (!room.players.includes(socket.id)) {
      room.players.push(socket.id);
      socket.join(roomId);
      console.log(`${socket.id} joined room ${roomId}`);
    }

    // Send room data to all players in room
    io.to(roomId).emit("room-data", {
      players: room.players,
      board: room.board,
      xIsNext: room.xIsNext,
    });
  });

  socket.on("make-move", ({ roomId, index }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.board[index] || room.players.length < 2) return;

    const symbol = room.xIsNext ? "X" : "O";
    room.board[index] = symbol;
    room.xIsNext = !room.xIsNext;

    io.to(roomId).emit("move-made", {
      board: room.board,
      xIsNext: room.xIsNext,
    });
  });

  socket.on("reset-game", (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    room.board = Array(9).fill(null);
    room.xIsNext = true;

    io.to(roomId).emit("move-made", {
      board: room.board,
      xIsNext: room.xIsNext,
    });
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    // Remove player from rooms
    for (let roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter((id) => id !== socket.id);

      // If room is empty, delete it
      if (room.players.length === 0) {
        delete rooms[roomId];
        console.log(`Room ${roomId} deleted`);
      } else {
        // Notify remaining player(s)
        io.to(roomId).emit("room-data", {
          players: room.players,
          board: room.board,
          xIsNext: room.xIsNext,
        });
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
