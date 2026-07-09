// Full two-player game flow debug - run with: node debug_full.mjs
import { io } from "socket.io-client";

const URL = "https://bluff-game-backend-2.onrender.com/";
let capturedRoomCode = null;

function makePlayer(name, onConnected) {
  const s = io(URL, { autoConnect: false });
  s.onAny((event, ...args) => {
    console.log(`\n━━━ [${name}] EVENT: "${event}" ━━━`);
    try { console.log(JSON.stringify(args, null, 2)); } catch(e) { console.log(args); }
  });
  s.on("connect", () => {
    console.log(`\n✅ [${name}] connected. socket.id = ${s.id}`);
    onConnected(s);
  });
  s.connect();
  return s;
}

// Player 1 creates a room
makePlayer("Player1", (s1) => {
  s1.emit("create_room", { playerName: "Alice" });

  s1.on("room_created", (...args) => {
    const data = args[0];
    capturedRoomCode = data?.roomCode || data?.room || (typeof data === "string" ? data : null);
    console.log("\n🏠 Room code captured:", capturedRoomCode);

    // Player 2 joins after 1s
    setTimeout(() => {
      makePlayer("Player2", (s2) => {
        s2.emit("join_room", { playerName: "Bob", roomCode: capturedRoomCode });

        // Start game after 2s
        setTimeout(() => {
          console.log("\n→ Player1 starting game...");
          s1.emit("start_game", { roomCode: capturedRoomCode });
        }, 2000);
      });
    }, 1000);
  });
});
