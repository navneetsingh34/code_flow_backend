require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios");
const ACTIONS = require("./actions");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const userSocketMap = {};
const roomLanguageMap = {};
const roomAdmins = {};

function getAllConnectionsClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId],
      };
    }
  );
}

// ─── Code Execution Endpoint (Wandbox API — free, no auth) ───
app.post("/execute", async (req, res) => {
  const { source_code, compiler, stdin } = req.body;

  if (!source_code || !compiler) {
    return res.status(400).json({ error: "source_code and compiler are required" });
  }

  try {
    console.log(`Executing code via Wandbox (${compiler})...`);

    const response = await axios.post(
      "https://wandbox.org/api/compile.json",
      {
        code: source_code,
        compiler,
        stdin: stdin || "",
        "save": false,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    const result = response.data;

    res.json({
      stdout: result.program_output || "",
      stderr: result.program_error || "",
      compile_output: result.compiler_error || result.compiler_output || "",
      status: {
        id: result.status === "0" || result.status === 0 ? 3 : 11,
        description: result.status === "0" || result.status === 0 ? "Accepted" : "Runtime Error",
      },
      time: null,
      memory: null,
    });
  } catch (error) {
    console.error("Code execution error:", error.message);

    if (error.response) {
      return res.status(error.response.status).json({
        error: "Execution service error",
        details: error.response.data?.message || error.response.data,
      });
    }

    res.status(500).json({
      error: "Failed to execute code. Please try again.",
    });
  }
});

// ─── Socket.IO ───
io.on("connection", (socket) => {
  console.log("Socket Connected:", socket.id);

  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);
    
    // Assign admin if room has no admin
    if (!roomAdmins[roomId]) {
      roomAdmins[roomId] = socket.id;
    }

    const clients = getAllConnectionsClients(roomId);

    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });

      // Broadcast current admin
      io.to(socketId).emit(ACTIONS.ROOM_ADMIN, {
        adminSocketId: roomAdmins[roomId]
      });
    });

    // Send the current room language to the newly joined user
    if (roomLanguageMap[roomId]) {
      io.to(socket.id).emit(ACTIONS.LANGUAGE_CHANGE, {
        languageId: roomLanguageMap[roomId],
      });
    }
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.LANGUAGE_CHANGE, ({ roomId, languageId }) => {
    roomLanguageMap[roomId] = languageId;
    socket.in(roomId).emit(ACTIONS.LANGUAGE_CHANGE, { languageId });
  });

  // --- Admin Handling --- //
  socket.on(ACTIONS.LOCK_EDITOR, ({ roomId, isLocked }) => {
    // Only process if sender is the admin
    if (roomAdmins[roomId] === socket.id) {
      socket.in(roomId).emit(ACTIONS.LOCK_EDITOR, { isLocked });
    }
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      // Handle admin reassignment
      if (roomAdmins[roomId] === socket.id) {
        const remainingClients = getAllConnectionsClients(roomId).filter(c => c.socketId !== socket.id);
        if (remainingClients.length > 0) {
          roomAdmins[roomId] = remainingClients[0].socketId;
        } else {
          delete roomAdmins[roomId];
        }
      }

      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });

      // Broadcast new admin
      if (roomAdmins[roomId]) {
        socket.in(roomId).emit(ACTIONS.ROOM_ADMIN, {
          adminSocketId: roomAdmins[roomId]
        });
      }
    });
    delete userSocketMap[socket.id];
    socket.leave();
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
