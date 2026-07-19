/**
 * Full game-play diagnostic — simulates 2 players, starts game, plays a card.
 * Run with: node diagnose_play.mjs
 */
import { io } from "socket.io-client";

const URL = "https://bluff-game-backend-2.onrender.com";

let s1, s2;
let roomCode;
let p1Hand = [], p2Hand = [];
let gameState;
let players = [];

const log = (who, msg, data) => {
  const ts = new Date().toISOString().slice(11,23);
  if (data !== undefined) {
    console.log(`[${ts}] [${who}] ${msg}`, typeof data === "object" ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`[${ts}] [${who}] ${msg}`);
  }
};

function makeSocket(name) {
  const s = io(URL, {
    transports: ["polling", "websocket"],
    autoConnect: false,
    reconnection: false, // no auto-reconnect so we see raw drops
  });
  s.onAny((event, ...args) => {
    if (event === "game_state_changed" || event === "room_updated") return; // too noisy
    log(name, `← ${event}`, args[0]);
  });
  s.on("disconnect", (reason) => {
    log(name, `⚡ DISCONNECTED — reason: "${reason}"`);
    if (reason === "io server disconnect") {
      log(name, "🔴 SERVER FORCEFULLY CLOSED THE SOCKET — this means the backend crashed or threw an error!");
    }
  });
  s.on("connect_error", (err) => log(name, `❌ connect_error: ${err.message}`));
  return s;
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log("═".repeat(70));
  console.log(" BLUFF GAME — Full Play Diagnostic");
  console.log("═".repeat(70));

  // ── Step 1: Connect both players ─────────────────────────────────────
  console.log("\n[1/6] Connecting Player1 (Alice)…");
  s1 = makeSocket("Alice");
  await new Promise(r => { s1.on("connect", r); s1.connect(); });
  log("Alice", `✅ connected, id=${s1.id}`);

  console.log("\n[2/6] Connecting Player2 (Bob)…");
  s2 = makeSocket("Bob  ");
  await new Promise(r => { s2.on("connect", r); s2.connect(); });
  log("Bob", `✅ connected, id=${s2.id}`);

  // ── Step 2: Alice creates a room ─────────────────────────────────────
  console.log("\n[3/6] Alice creating room…");
  await new Promise(r => {
    s1.once("room_created", (data) => {
      roomCode = data.roomCode;
      log("Alice", `✅ Room created: ${roomCode}`);
      r();
    });
    s1.emit("create_room", { playerName: "Alice" });
  });

  // ── Step 3: Bob joins ─────────────────────────────────────────────────
  console.log("\n[4/6] Bob joining room…");
  await new Promise(r => {
    s2.once("room_updated", (data) => {
      players = data.players || [];
      log("Bob", `✅ Joined. Players: ${players.map(p=>p.name).join(", ")}`);
      r();
    });
    s2.emit("join_room", { playerName: "Bob", roomCode });
  });
  await wait(500);

  // ── Step 4: Alice starts the game ────────────────────────────────────
  console.log("\n[5/6] Alice starting game…");
  await new Promise(r => {
    let got1 = false, got2 = false;
    const check = () => { if (got1 && got2) r(); };
    s1.once("game_started", (data) => {
      gameState = data.gameState;
      players = data.players;
      p1Hand = data.yourHand || [];
      log("Alice", `✅ Game started. My hand: ${p1Hand.length} cards. Turn index: ${gameState.currentTurnIndex}`);
      log("Alice", `   Players: ${players.map((p,i)=>`[${i}]${p.name}(${p.id.slice(0,6)})`).join(" ")}  Alice id: ${s1.id.slice(0,6)}`);
      got1 = true; check();
    });
    s2.once("game_started", (data) => {
      p2Hand = data.yourHand || [];
      log("Bob  ", `✅ Game started. My hand: ${p2Hand.length} cards`);
      got2 = true; check();
    });
    s1.emit("start_game", { roomCode });
  });
  await wait(500);

  // ── Step 5: Determine whose turn it is and play a card ───────────────
  console.log("\n[6/6] Playing a card…");
  const currentPlayer = players[gameState.currentTurnIndex];
  const isAliceTurn = currentPlayer?.id === s1.id;
  const activeSock = isAliceTurn ? s1 : s2;
  const activeHand = isAliceTurn ? p1Hand : p2Hand;
  const activeName = isAliceTurn ? "Alice" : "Bob  ";

  log("INFO", `Current turn: ${currentPlayer?.name} (index ${gameState.currentTurnIndex})`);
  log("INFO", `${activeName} will play`);

  if (activeHand.length === 0) {
    log("ERROR", "No cards in hand — cannot test play_cards");
    process.exit(1);
  }

  // Try playing 1 card
  const cardToPlay = activeHand[0];
  const payload = {
    roomCode,
    cards: [cardToPlay],
    claimedRank: cardToPlay.rank,
  };

  log(activeName, `Emitting play_cards with payload:`, payload);

  await new Promise(r => {
    const timeout = setTimeout(() => {
      log(activeName, "⏱ 10s timeout — no response from server after play_cards");
      r();
    }, 10000);

    // Listen for game state change (success) or error
    activeSock.once("game_state_changed", (data) => {
      clearTimeout(timeout);
      log(activeName, "✅ SUCCESS — game_state_changed received after play_cards!", {
        newTurnIndex: data.gameState?.currentTurnIndex,
        centerPileSize: data.gameState?.centerPile?.length,
        claim: data.gameState?.currentClaim,
      });
      r();
    });
    activeSock.once("error_message", (data) => {
      clearTimeout(timeout);
      log(activeName, "⚠️ error_message received:", data);
      r();
    });

    activeSock.emit("play_cards", payload);
  });

  await wait(2000);

  // ── Check: are both sockets still connected? ──────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log(" POST-PLAY CONNECTION STATUS");
  console.log("═".repeat(70));
  log("Alice", `connected: ${s1.connected}`);
  log("Bob  ", `connected: ${s2.connected}`);

  if (!s1.connected || !s2.connected) {
    console.log("\n🔴 AT LEAST ONE SOCKET DISCONNECTED AFTER play_cards!");
    console.log("   This confirms a server-side crash on handling play_cards.");
    console.log("   Check your backend logs for an uncaught exception.");
  } else {
    console.log("\n✅ Both sockets still connected — play_cards processed OK!");
  }

  s1.disconnect();
  s2.disconnect();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
