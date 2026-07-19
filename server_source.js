const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Enable CORS so your frontend can communicate with the backend
const allowedOrigin = process.env.FRONTEND_URL || "*";
app.use(cors({
  origin: allowedOrigin,
  methods: ["GET", "POST"]
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"]
  }
});

// Memory store for game rooms 
// In a production production app, you'd use Redis, but in-memory is perfect and fast for playing with friends.
const rooms = new Map();

// Helper function to generate a unique 4-character room code
function generateRoomCode() {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 6).toUpperCase();
  } while (rooms.has(code));
  return code;
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // ==========================================
  // 1. ROOM MANAGEMENT EVENTS
  // ==========================================

  // Handle Host creating a room
  socket.on('create_room', ({ playerName }) => {
    const roomCode = generateRoomCode();
    
    const newRoom = {
      roomCode,
      players: [{ id: socket.id, name: playerName, isHost: true, cardCount: 0, hand: [] }],
      messages: [],
      gameState: {
        status: 'LOBBY', // LOBBY, PLAYING, GAME_OVER
        currentTurnIndex: 0,
        currentClaim: { rank: '', count: 0 },
        centerPile: [], // Array of actual card objects hidden from players
        lastPlayedPlayerId: null
      }
    };

    rooms.set(roomCode, newRoom);
    socket.join(roomCode);
    
    // Send room details back to the creator
    socket.emit('room_created', { 
      roomCode, 
      players: newRoom.players, 
      gameState: newRoom.gameState 
    });
    
    console.log(`Room ${roomCode} created by ${playerName}`);
  });

  // Handle Players joining an existing room
  socket.on('join_room', ({ roomCode, playerName }) => {
    const code = roomCode?.toUpperCase();
    
    if (!rooms.has(code)) {
      return socket.emit('error_message', 'Room not found. Check the code and try again.');
    }

    const room = rooms.get(code);
    
    if (room.gameState.status !== 'LOBBY') {
      return socket.emit('error_message', 'This game has already started.');
    }
    if (room.players.length >= 8) { // Cap at 8 players for gameplay balance
      return socket.emit('error_message', 'Room is full.');
    }

    // Add new player
    room.players.push({ id: socket.id, name: playerName, isHost: false, cardCount: 0, hand: [] });
    socket.join(code);

    // Broadcast updated player list and existing messages to everyone in the room
    io.to(code).emit('room_updated', { 
      players: room.players, 
      messages: room.messages,
      gameState: room.gameState
    });
    
    console.log(`${playerName} joined room ${code}`);
  });

  // ==========================================
  // 2. LIVE GAMEPLAY ENGINE
  // ==========================================

  // Handle game start (Host only)
  socket.on('start_game', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.players[0].id !== socket.id) return; // Verify host identity

    // 1. Build and shuffle a standard deck of 52 cards
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let deck = [];
    for (let suit of suits) {
      for (let rank of ranks) {
        deck.push({ suit, rank });
      }
    }
    // Fisher-Yates Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // 2. Deal cards evenly to all players
    let playerIndex = 0;
    while (deck.length > 0) {
      room.players[playerIndex].hand.push(deck.pop());
      playerIndex = (playerIndex + 1) % room.players.length;
    }

    // Update public card counts for safety
    room.players.forEach(p => p.cardCount = p.hand.length);

    room.gameState.status = 'PLAYING';
    room.gameState.currentTurnIndex = 0;
    room.gameState.centerPile = [];
    room.gameState.currentClaim = { rank: '', count: 0 };

    // Send personalized data. Each player gets their unique hand, but general updates go to all.
    room.players.forEach(player => {
      io.to(player.id).emit('game_started', {
        gameState: room.gameState,
        players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, cardCount: p.cardCount })),
        yourHand: player.hand
      });
    });
  });

  // Handle playing cards (Bluff action)
  socket.on('play_cards', ({ roomCode, cardsPlayed, claimedRank }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    const activePlayer = room.players[room.gameState.currentTurnIndex];
    
    if (player.id !== activePlayer.id) return; // Turn enforcement safety check

    // Remove cards from player's server-side hand
    player.hand = player.hand.filter(card => 
      !cardsPlayed.some(played => played.rank === card.rank && played.suit === card.suit)
    );
    player.cardCount = player.hand.length;

    // Push cards into the facedown center pile
    room.gameState.centerPile.push(...cardsPlayed);
    room.gameState.currentClaim = {
      rank: claimedRank,
      count: (room.gameState.currentClaim.count || 0) + cardsPlayed.length
    };
    room.gameState.lastPlayedPlayerId = socket.id;

    // Advance turn to next player
    room.gameState.currentTurnIndex = (room.gameState.currentTurnIndex + 1) % room.players.length;

    // Broadcast update
    sendGameStateUpdate(roomCode);
  });

  // Handle Calling a Bluff
  socket.on('call_bluff', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || !room.gameState.lastPlayedPlayerId) return;

    const challenger = room.players.find(p => p.id === socket.id);
    const accused = room.players.find(p => p.id === room.gameState.lastPlayedPlayerId);
    
    const centerCards = room.gameState.centerPile;
    const currentClaimRank = room.gameState.currentClaim.rank;
    
    // Check the last batch of cards added to see if they match the claim
    const lastBatchCount = room.gameState.currentClaim.count; 
    const lastPlayedCards = centerCards.slice(-lastBatchCount);
    
    const wasBluffing = lastPlayedCards.some(card => card.rank !== currentClaimRank);
    let loser = wasBluffing ? accused : challenger;

    // Loser absorbs the entire center pile
    loser.hand.push(...centerCards);
    loser.cardCount = loser.hand.length;

    // Send a system chat message announcing the outcome
    const systemText = wasBluffing 
      ? `🚨 BLUFF CALLED! ${accused.name} was lying! They take all ${centerCards.length} cards.`
      : `❌ WRONG CALL! ${accused.name} was telling the truth! ${challenger.name} takes all ${centerCards.length} cards.`;

    sendSystemMessage(room, systemText);

    // Reset center tracking parameters
    room.gameState.centerPile = [];
    room.gameState.currentClaim = { rank: '', count: 0 };
    room.gameState.lastPlayedPlayerId = null;
    
    // Set turn to the loser of the challenge
    room.gameState.currentTurnIndex = room.players.findIndex(p => p.id === loser.id);

    // Check Win Conditions
    const winner = room.players.find(p => p.cardCount === 0);
    if (winner) {
      room.gameState.status = 'GAME_OVER';
      sendSystemMessage(room, `👑 GAME OVER! ${winner.name} won the game by clearing their hand!`);
    }

    sendGameStateUpdate(roomCode);
  });

  // ==========================================
  // 3. LIVE CHAT ENGINE
  // ==========================================
  socket.on('send_message', ({ roomCode, text, senderName }) => {
    const room = rooms.get(roomCode);
    if (room) {
      const newMessage = {
        id: Math.random().toString(36).substring(7),
        sender: senderName,
        text: text,
        type: 'user',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      room.messages.push(newMessage);
      io.to(roomCode).emit('new_message', newMessage);
    }
  });

  // ==========================================
  // DISCONNECTION CLEANUP
  // ==========================================
  socket.on('disconnect', () => {
    rooms.forEach((room, roomCode) => {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const leavingPlayer = room.players[playerIndex];
        room.players.splice(playerIndex, 1);
        
        if (room.players.length === 0) {
          rooms.delete(roomCode);
          console.log(`Room ${roomCode} deleted (empty)`);
        } else {
          // If host left, reassign host status to next player
          if (leavingPlayer.isHost) {
            room.players[0].isHost = true;
          }
          sendSystemMessage(room, `👋 ${leavingPlayer.name} left the room.`);
          io.to(roomCode).emit('room_updated', { players: room.players });
        }
      }
    });
  });
});

// Helper: Broadcast global state securely (strips private player hand data)
function sendGameStateUpdate(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.players.forEach(player => {
    io.to(player.id).emit('game_state_changed', {
      gameState: room.gameState,
      players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, cardCount: p.cardCount })),
      yourHand: player.hand // Send back their private hand preserved
    });
  });
}

// Helper: Append system logs seamlessly to chat windows
function sendSystemMessage(room, text) {
  const sysMsg = {
    id: Math.random().toString(36).substring(7),
    sender: 'System',
    text,
    type: 'system',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  room.messages.push(sysMsg);
  io.to(room.roomCode).emit('new_message', sysMsg);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Bluff game server online on port ${PORT}`);
});