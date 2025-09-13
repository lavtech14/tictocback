const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000", // local frontend
      "https://tictocfront.vercel.app", // deployed frontend
    ],
    methods: ["GET", "POST"],
  },
});

app.use(cors());

const PORT = process.env.PORT || 5000;

// In-memory room store
// roomId: { players: [socketId], board: [], xIsNext: true, size: 3 or 10 }
const rooms = {};

io.on("connection", (socket) => {
  console.log("📡 New connection:", socket.id);

  // Join a room (with board size)
  socket.on("join-room", ({ roomId, size }) => {
    console.log(
      `➡️ ${socket.id} attempting to join room ${roomId} (size: ${size})`
    );

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        board: Array(size * size).fill(null),
        xIsNext: true,
        size,
      };
    }

    const room = rooms[roomId];

    if (room.players.length >= 2) {
      socket.emit("room-full");
      return;
    }

    if (!room.players.includes(socket.id)) {
      room.players.push(socket.id);
      socket.join(roomId);
      console.log(`✅ ${socket.id} joined room ${roomId}`);
    }

    // Send room data
    io.to(roomId).emit("room-data", {
      players: room.players,
      board: room.board,
      xIsNext: room.xIsNext,
      size: room.size,
    });
  });

  // Handle move
  socket.on("make-move", ({ roomId, index }) => {
    const room = rooms[roomId];
    if (!room || room.board[index] || room.players.length < 2) return;

    const symbol = room.xIsNext ? "X" : "O";
    room.board[index] = symbol;
    room.xIsNext = !room.xIsNext;

    io.to(roomId).emit("move-made", {
      board: room.board,
      xIsNext: room.xIsNext,
    });
  });

  // Reset game
  socket.on("reset-game", (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    room.board = Array(room.size * room.size).fill(null);
    room.xIsNext = true;

    io.to(roomId).emit("move-made", {
      board: room.board,
      xIsNext: room.xIsNext,
    });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);

    for (const roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter((id) => id !== socket.id);

      if (room.players.length === 0) {
        delete rooms[roomId];
        console.log(`🧹 Deleted empty room ${roomId}`);
      } else {
        io.to(roomId).emit("room-data", {
          players: room.players,
          board: room.board,
          xIsNext: room.xIsNext,
          size: room.size,
        });
      }
    }
  });
});

// Simple health check
app.get("/", (req, res) => {
  res.send("🟢 TicTacToe Server is running!");
});

// Start server
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
nod;
