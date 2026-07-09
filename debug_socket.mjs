// Quick socket debug script - run with: node debug_socket.mjs
import { io } from "socket.io-client";

const socket = io("https://bluff-game-backend-2.onrender.com/", { autoConnect: false });

socket.onAny((event, ...args) => {
  console.log(`\n[EVENT: ${event}]`);
  console.log(JSON.stringify(args, null, 2));
});

socket.on("connect", () => {
  console.log("\n✅ Connected. socket.id =", socket.id);
  
  // Step 1: Create a room
  console.log("\n→ Emitting create_room...");
  socket.emit("create_room", { playerName: "DebugPlayer1" });
});

socket.connect();

// After 3 seconds connect a second player and start the game
setTimeout(() => {
  const socket2 = io("https://bluff-game-backend-2.onrender.com/", { autoConnect: false });
  socket2.onAny((event, ...args) => {
    console.log(`\n[PLAYER2 EVENT: ${event}]`);
    console.log(JSON.stringify(args, null, 2));
  });
  socket2.on("connect", () => {
    console.log("\n✅ Player2 connected. socket.id =", socket2.id);
    // We need room code from room_created event
  });
  socket2.connect();
}, 3000);
