/**
 * Probe which event name the backend actually listens to for playing cards.
 * Run with: node probe_events.mjs
 */
import { io } from "socket.io-client";

const URL = "https://bluff-game-backend-2.onrender.com";

let s1, s2, roomCode, players = [], p1Hand = [];

function makeSocket(name) {
  const s = io(URL, { transports: ["polling", "websocket"], autoConnect: false, reconnection: false });
  s.onAny((event, ...args) => {
    if (["room_updated", "connect", "disconnect"].includes(event)) return;
    const ts = new Date().toISOString().slice(11,19);
    console.log(`[${ts}] [${name}] ← ${event}:`, JSON.stringify(args[0])?.slice(0, 200));
  });
  s.on("disconnect", r => console.log(`[${name}] DISCONNECT reason="${r}"`));
  return s;
}
const wait = ms => new Promise(r => setTimeout(r, ms));

async function tryEvent(sock, name, payload, label) {
  return new Promise(r => {
    const t = setTimeout(() => { console.log(`  ❌ "${label}" — NO RESPONSE after 5s`); r(false); }, 5000);
    sock.once("game_state_changed", (d) => {
      clearTimeout(t);
      console.log(`  ✅ "${label}" — SUCCESS! New turn index: ${d?.gameState?.currentTurnIndex}, pile: ${d?.gameState?.centerPile?.length}`);
      r(true);
    });
    sock.once("error_message", (d) => {
      clearTimeout(t);
      console.log(`  ⚠️ "${label}" — error_message: ${JSON.stringify(d)}`);
      r("error");
    });
    sock.emit(name, payload);
  });
}

async function setup() {
  s1 = makeSocket("P1");
  s2 = makeSocket("P2");
  await new Promise(r => { s1.on("connect", r); s1.connect(); });
  await new Promise(r => { s2.on("connect", r); s2.connect(); });

  await new Promise(r => {
    s1.once("room_created", d => { roomCode = d.roomCode; r(); });
    s1.emit("create_room", { playerName: "Alice" });
  });
  await new Promise(r => {
    s2.once("room_updated", d => { players = d.players || []; r(); });
    s2.emit("join_room", { playerName: "Bob", roomCode });
  });
  await new Promise(r => {
    s1.once("game_started", d => {
      p1Hand = d.yourHand || [];
      players = d.players || [];
      r();
    });
    s2.once("game_started", () => {});
    s1.emit("start_game", { roomCode });
  });
  await wait(300);
  console.log(`\nRoom: ${roomCode} | Alice turn index 0, hand[0]: ${JSON.stringify(p1Hand[0])}`);
}

async function run() {
  console.log("════════════════════════════════════════════════");
  console.log("  Probing correct event name for playing cards");
  console.log("════════════════════════════════════════════════\n");

  await setup();

  const card = p1Hand[0];
  const base = { roomCode, claimedRank: card.rank };

  console.log("\n── Testing event names ─────────────────────────");

  // All plausible event names
  const candidates = [
    // name variants
    ["play_cards",    { ...base, cards: [card] }],
    ["playCards",     { ...base, cards: [card] }],
    ["play_card",     { ...base, cards: [card], card }],
    ["playCard",      { ...base, cards: [card], card }],
    ["play",          { ...base, cards: [card] }],
    // payload shape variants
    ["play_cards",    { ...base, cards: [card], count: 1, rank: card.rank }],
    ["play_cards",    { roomCode, card, claimedRank: card.rank, cards: [card] }],
    // with 'claim' wrapper
    ["play_cards",    { roomCode, cards: [card], claim: { rank: card.rank, count: 1 } }],
  ];

  for (const [evName, payload] of candidates) {
    if (!s1.connected) {
      console.log("\n⚡ Socket disconnected! Reconnecting…");
      await new Promise(r => { s1.once("connect", r); s1.connect(); });
      s1.emit("join_room", { playerName: "Alice", roomCode });
      await wait(1000);
    }
    console.log(`\n▸ emit("${evName}", ${JSON.stringify(payload).slice(0,100)}…)`);
    const result = await tryEvent(s1, evName, payload, evName);
    if (result === true) {
      console.log(`\n🎯 WORKING EVENT NAME: "${evName}"`);
      console.log(`   WORKING PAYLOAD: ${JSON.stringify(payload)}`);
      break;
    }
    await wait(200);
  }

  s1.disconnect();
  s2.disconnect();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
