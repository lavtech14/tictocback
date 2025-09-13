const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000", // for local development
      "https://tictocfront.vercel.app", // your deployed frontend
    ], // Frontend URL for dev only
    methods: ["GET", "POST"],
  },
});

app.use(cors());

const PORT = process.env.PORT || 5000;

// In-memory room store
const rooms = {}; // roomId: { players: [socketId], board: [], xIsNext: true }

io.on("connection", (socket) => {
  console.log("📡 New connection:", socket.id);

  // Join room
  socket.on("join-room", (roomId) => {
    console.log(`➡️  ${socket.id} trying to join room ${roomId}`);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        board: Array(9).fill(null),
        xIsNext: true,
      };
    }

    const room = rooms[roomId];

    if (room.players.length >= 2) {
      console.log(`🚫 Room ${roomId} is full.`);
      socket.emit("room-full");
      return;
    }

    if (!room.players.includes(socket.id)) {
      room.players.push(socket.id);
      socket.join(roomId);
      console.log(`✅ ${socket.id} joined room ${roomId}`);
    }

    // Send room data to clients
    io.to(roomId).emit("room-data", {
      players: room.players,
      board: room.board,
      xIsNext: room.xIsNext,
    });
  });

  // Handle move
  socket.on("make-move", ({ roomId, index }) => {
    const room = rooms[roomId];
    if (!room || room.players.length < 2 || room.board[index]) return;

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

    room.board = Array(9).fill(null);
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
        // Update remaining player(s)
        io.to(roomId).emit("room-data", {
          players: room.players,
          board: room.board,
          xIsNext: room.xIsNext,
        });
      }
    }
  });
});

// Serve React static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "tictoc/build")));

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "tictoc", "build", "index.html"));
  });
}

// Start server
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
