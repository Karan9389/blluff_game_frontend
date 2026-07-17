/**
 * Live WebSocket diagnostic script.
 * Run with: node diagnose.mjs
 */
import { io } from "socket.io-client";

const URL = "https://bluff-game-backend-2.onrender.com";
const TIMEOUT = 30000; // 30s total test window

console.log("━".repeat(60));
console.log("🔍 Socket.io Connection Diagnostic");
console.log("━".repeat(60));
console.log("Backend:", URL);
console.log("Time:   ", new Date().toISOString());
console.log("━".repeat(60));

function test(label, opts) {
  return new Promise((resolve) => {
    const start = Date.now();
    const s = io(URL, { ...opts, autoConnect: false });
    const timer = setTimeout(() => {
      console.log(`  ❌ [${label}] TIMEOUT after ${Date.now() - start}ms`);
      s.disconnect();
      resolve({ ok: false, ms: Date.now() - start, reason: "timeout" });
    }, 12000);

    s.on("connect", () => {
      clearTimeout(timer);
      const ms = Date.now() - start;
      console.log(`  ✅ [${label}] Connected in ${ms}ms  |  socket.id=${s.id}  |  transport=${s.io.engine.transport.name}`);

      // measure latency
      const ping = Date.now();
      s.emit("ping", () => {
        console.log(`     ↳ round-trip latency: ${Date.now() - ping}ms`);
      });

      setTimeout(() => {
        s.disconnect();
        resolve({ ok: true, ms });
      }, 2000);
    });

    s.on("connect_error", (err) => {
      clearTimeout(timer);
      console.log(`  ❌ [${label}] connect_error: ${err.message}`);
      s.disconnect();
      resolve({ ok: false, ms: Date.now() - start, reason: err.message });
    });

    s.connect();
  });
}

async function run() {
  console.log("\n📡 Test 1: WebSocket only");
  const r1 = await test("ws-only", { transports: ["websocket"] });

  console.log("\n📡 Test 2: Polling only");
  const r2 = await test("polling-only", { transports: ["polling"] });

  console.log("\n📡 Test 3: WebSocket first, polling fallback (default)");
  const r3 = await test("ws+polling", { transports: ["websocket", "polling"] });

  console.log("\n📡 Test 4: Polling first, then upgrade to WebSocket");
  const r4 = await test("polling+ws", { transports: ["polling", "websocket"] });

  console.log("\n📡 Test 5: Keep-alive over 40s (checks server idle timeout)");
  await new Promise((resolve) => {
    const s = io(URL, { transports: ["websocket", "polling"], autoConnect: false });
    let drops = 0;
    s.on("connect", () => {
      console.log(`  ✅ Connected. Holding for 40s…`);
      let elapsed = 0;
      const iv = setInterval(() => {
        elapsed += 5;
        if (s.connected) {
          console.log(`  ⏱ ${elapsed}s — still connected ✅`);
          s.emit("ping");
        } else {
          console.log(`  ⚠️ ${elapsed}s — DISCONNECTED after ${elapsed}s!`);
          drops++;
        }
        if (elapsed >= 40) {
          clearInterval(iv);
          s.disconnect();
          resolve(undefined);
        }
      }, 5000);
    });
    s.on("disconnect", (reason) => {
      drops++;
      console.log(`  ⚠️ disconnect fired! reason="${reason}" drops=${drops}`);
    });
    s.on("connect_error", (e) => console.log(`  ❌ connect_error: ${e.message}`));
    s.connect();
  });

  console.log("\n" + "━".repeat(60));
  console.log("📊 Summary");
  console.log("━".repeat(60));
  [["WebSocket only", r1], ["Polling only", r2], ["WS+Polling", r3], ["Polling+WS", r4]].forEach(([l, r]) => {
    console.log(`  ${r.ok ? "✅" : "❌"} ${l}: ${r.ok ? r.ms + "ms" : r.reason}`);
  });
  console.log("━".repeat(60));
  process.exit(0);
}

run().catch(console.error);
