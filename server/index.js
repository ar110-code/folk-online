// server/index.js
// Main Express & Socket.io Server for Megagame V4

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { MegagameRoom, COUNTRY_DEFINITIONS } = require('./gameEngine');
const { CommsRouter } = require('./commsRouter');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  next();
});
app.use(express.static(path.join(__dirname, '../public'), { etag: false, maxAge: 0 }));

// Store active rooms
const rooms = {}; // roomCode -> { room: MegagameRoom, comms: CommsRouter }

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getActiveRoomsList() {
  const list = [];
  for (const code in rooms) {
    const { room } = rooms[code];
    if (room.status === 'lobby') {
      let playerCount = 0;
      Object.values(room.countries).forEach(c => {
        if (c.players.president) playerCount++;
        if (c.players.war) playerCount++;
        if (c.players.economy) playerCount++;
      });
      list.push({
        roomCode: code,
        playerCount,
        totalSlots: 15
      });
    }
  }
  return list;
}

// Game Ticker Loop (runs every second)
setInterval(() => {
  for (const code in rooms) {
    const { room, comms } = rooms[code];
    if (room.status !== 'playing') continue;

    if (room.phaseTimer > 0) {
      room.phaseTimer--;
    } else {
      // Timer expired: handle transitions
      if (room.phase === 'morning') {
        room.startNoonPhase();
        io.to(code).emit('phase_changed', {
          phase: 'noon',
          cycle: room.noonCycle,
          round: room.round,
          activeCountry: room.activeCountryOrder[room.noonActiveCountryIndex],
          noonActiveCountryIndex: room.noonActiveCountryIndex
        });
      } else if (room.phase === 'noon') {
        room.nextNoonTurn();
        if (room.phase === 'night') {
          io.to(code).emit('phase_changed', { phase: 'night', round: room.round });
        } else {
          io.to(code).emit('noon_turn_changed', {
            cycle: room.noonCycle,
            activeCountry: room.activeCountryOrder[room.noonActiveCountryIndex],
            noonActiveCountryIndex: room.noonActiveCountryIndex
          });
        }
      } else if (room.phase === 'night') {
        room.nextRoundOrEnd();
        if (room.status === 'finished') {
          const finalScores = room.calculateFinalScores();
          io.to(code).emit('game_finished', { scores: finalScores });
        } else {
          io.to(code).emit('phase_changed', { phase: 'morning', round: room.round });
        }
      }
    }

    // Broadcast tick
    io.to(code).emit('timer_tick', {
      phase: room.phase,
      timer: room.phaseTimer,
      round: room.round,
      noonCycle: room.noonCycle,
      activeCountry: room.activeCountryOrder[room.noonActiveCountryIndex] || null
    });
  }
}, 1000);

// Room Disconnect Grace Period Timers
// roomCode -> { hostTimer, playerTimers: { username: timer } }
const roomDisconnectTimers = {};

function cancelHostDisconnectTimer(roomCode) {
  if (roomDisconnectTimers[roomCode]?.hostTimer) {
    clearTimeout(roomDisconnectTimers[roomCode].hostTimer);
    delete roomDisconnectTimers[roomCode].hostTimer;
  }
}

function cancelPlayerDisconnectTimer(roomCode, username) {
  if (roomDisconnectTimers[roomCode]?.playerTimers?.[username]) {
    clearTimeout(roomDisconnectTimers[roomCode].playerTimers[username]);
    delete roomDisconnectTimers[roomCode].playerTimers[username];
  }
}

io.on('connection', socket => {
  let currentRoomCode = null;
  let currentUsername = null;

  socket.on('create_room', ({ username }, callback) => {
    let code = generateRoomCode();
    while (rooms[code]) code = generateRoomCode();

    const hostName = (username || 'میزبان').trim();
    if (!hostName) {
      return callback({ success: false, error: 'لطفاً نام کاربری معتبر وارد کنید.' });
    }
    currentUsername = hostName;
    const room = new MegagameRoom(code, socket.id, hostName);
    room.addMember(socket.id, hostName);
    const comms = new CommsRouter(room);
    rooms[code] = { room, comms };

    currentRoomCode = code;
    socket.join(code);

    callback({
      success: true,
      roomCode: code,
      isHost: true,
      countries: COUNTRY_DEFINITIONS
    });

    socket.emit('room_state', room);
    io.emit('active_rooms_update', getActiveRoomsList());
  });

  socket.on('join_room', ({ roomCode, username }, callback) => {
    const code = (roomCode || '').toUpperCase();
    const roomData = rooms[code];
    if (!roomData) {
      return callback({ success: false, error: 'اتاق یافت نشد. کد را بررسی کنید.' });
    }

    const trimmed = (username || 'بازیکن').trim();
    if (!trimmed) {
      return callback({ success: false, error: 'لطفاً نام معتبر وارد کنید.' });
    }

    // Check if another player in this room is already using this username
    if (roomData.room.isUsernameTaken(trimmed, socket.id)) {
      return callback({
        success: false,
        error: `نام "${trimmed}" قبلاً توسط بازیکن دیگری در این اتاق انتخاب شده است. لطفاً نام دیگری انتخاب کنید.`
      });
    }

    currentRoomCode = code;
    currentUsername = trimmed;
    socket.join(currentRoomCode);

    roomData.room.addMember(socket.id, trimmed);

    const isHost = (socket.id === roomData.room.hostId) || (currentUsername && currentUsername === roomData.room.hostUsername);

    callback({
      success: true,
      roomCode: currentRoomCode,
      isHost,
      countries: COUNTRY_DEFINITIONS
    });

    socket.emit('room_state', roomData.room);
  });

  socket.on('rejoin_session', ({ roomCode, countryId, role, username }, callback) => {
    const code = (roomCode || '').toUpperCase();
    const roomData = rooms[code];
    if (!roomData) {
      return callback({ success: false, error: 'اتاق یافت نشد یا منقضی شده است.' });
    }

    currentRoomCode = code;
    if (username) currentUsername = username.trim();
    socket.join(code);

    // Cancel any pending disconnect timeouts
    cancelHostDisconnectTimer(code);
    if (currentUsername) cancelPlayerDisconnectTimer(code, currentUsername);

    // If reconnecting player was the room host, transfer hostId to new socket
    const isHostByUsername = (currentUsername && roomData.room.hostUsername === currentUsername);
    const isHostByOldSocket = (socket.id === roomData.room.hostId);
    if (isHostByUsername || isHostByOldSocket) {
      roomData.room.hostId = socket.id;
      if (currentUsername) roomData.room.hostUsername = currentUsername;
    }

    if (currentUsername) {
      roomData.room.addMember(socket.id, currentUsername);
    }

    const result = roomData.room.reconnectSlot(socket.id, currentUsername, countryId, role);
    const isHost = (socket.id === roomData.room.hostId) || (currentUsername && currentUsername === roomData.room.hostUsername);

    callback({
      success: result.success,
      error: result.error,
      room: roomData.room,
      isHost,
      isPlaying: roomData.room.status === 'playing',
      countryId: result.countryId,
      role: result.role
    });

    if (result.success) {
      io.to(code).emit('room_state', roomData.room);
    }
  });

  socket.on('leave_game', (callback) => {
    if (currentRoomCode && rooms[currentRoomCode]) {
      const { room } = rooms[currentRoomCode];
      const isHost = (socket.id === room.hostId) || (currentUsername && currentUsername === room.hostUsername);

      cancelHostDisconnectTimer(currentRoomCode);
      if (currentUsername) cancelPlayerDisconnectTimer(currentRoomCode, currentUsername);

      // If host explicitly leaves in lobby before game start, close room immediately
      if (room.status === 'lobby' && isHost) {
        io.to(currentRoomCode).emit('room_closed', { reason: 'میزبان اتاق را بست و از بازی خارج شد.' });
        delete rooms[currentRoomCode];
        delete roomDisconnectTimers[currentRoomCode];
        io.emit('active_rooms_update', getActiveRoomsList());
      } else {
        room.leaveSlot(socket.id);
        room.removeMember(socket.id);
        io.to(currentRoomCode).emit('room_state', room);
        io.emit('active_rooms_update', getActiveRoomsList());
      }

      socket.leave(currentRoomCode);
      currentRoomCode = null;
      currentUsername = null;
    }
    if (callback) callback({ success: true });
  });

  socket.on('claim_slot', ({ countryId, role, username }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    if (username) currentUsername = username.trim();

    const result = room.joinSlot(socket.id, currentUsername, countryId, role);
    if (callback) callback({ ...result, room });

    if (result.success) {
      io.to(currentRoomCode).emit('room_state', room);
      io.emit('active_rooms_update', getActiveRoomsList());
    }
  });

  socket.on('start_game', (data, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    if (socket.id !== room.hostId) {
      return callback({ success: false, error: 'فقط میزبان می‌تواند بازی را شروع کند.' });
    }

    const result = room.startGame();
    callback(result);

    if (result.success) {
      io.to(currentRoomCode).emit('game_started', room);
      io.emit('active_rooms_update', getActiveRoomsList());
    }
  });

  // --- Economy Events ---
  socket.on('update_petal', ({ countryId, petalKey, toolTokens, popTokens }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || player.role !== 'economy') {
      return callback({ success: false, error: 'تنها وزیر اقتصاد مجاز به جابه‌جایی مهره‌ها است.' });
    }
    const res = room.updatePetalTokens(countryId, petalKey, toolTokens, popTokens);
    callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('country_updated', { countryId, country: room.countries[countryId] });
    }
  });

  socket.on('buy_tool', ({ countryId, count }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || player.role !== 'economy') {
      return callback({ success: false, error: 'تنها وزیر اقتصاد مجاز به خرید ابزار است.' });
    }
    const res = room.buyTool(countryId, count);
    callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('country_updated', { countryId, country: room.countries[countryId] });
    }
  });

  socket.on('sell_products', ({ countryId }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || player.role !== 'economy') {
      return callback({ success: false, error: 'تنها وزیر اقتصاد مجاز به برداشت محصولات است.' });
    }
    const res = room.harvestProducts(countryId);
    callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('country_updated', { countryId, country: room.countries[countryId] });
    }
  });

  socket.on('craft_product', ({ countryId, productType }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || player.role !== 'economy') {
      return callback({ success: false, error: 'تنها وزیر اقتصاد مجاز به ساخت کالا است.' });
    }
    const res = room.craftProduct(countryId, productType);
    callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('country_updated', { countryId, country: room.countries[countryId] });
    }
  });

  socket.on('sell_product', ({ countryId, productType }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || player.role !== 'economy') {
      return callback({ success: false, error: 'تنها وزیر اقتصاد مجاز به فروش محصولات است.' });
    }
    const res = room.sellProduct(countryId, productType);
    callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('country_updated', { countryId, country: room.countries[countryId] });
    }
  });

  socket.on('propose_trade', ({ fromCountryId, toCountryId, goodType, quantity, price, tradeType }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== fromCountryId || (player.role !== 'economy' && player.role !== 'president')) {
      return callback && callback({ success: false, error: 'تنها وزیر اقتصاد یا رئیس‌جمهور مجاز به ثبت معامله هستند.' });
    }
    const res = room.proposeTrade(fromCountryId, toCountryId, goodType, quantity, price, tradeType);
    if (callback) callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('trade_proposed', res.trade);
    }
  });

  socket.on('accept_trade', ({ tradeId, acceptingCountryId }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== acceptingCountryId || (player.role !== 'economy' && player.role !== 'president')) {
      return callback && callback({ success: false, error: 'تنها وزیر اقتصاد یا رئیس‌جمهور مجاز به قبول معامله هستند.' });
    }
    const res = room.acceptTrade(tradeId, acceptingCountryId);
    if (callback) callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('country_updated', { countryId: res.trade.fromCountryId, country: room.countries[res.trade.fromCountryId] });
      io.to(currentRoomCode).emit('country_updated', { countryId: acceptingCountryId, country: room.countries[acceptingCountryId] });
      io.to(currentRoomCode).emit('trade_accepted', res.trade);
    }
  });

  socket.on('reject_trade', ({ tradeId, rejectingCountryId }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== rejectingCountryId || (player.role !== 'economy' && player.role !== 'president')) {
      return callback && callback({ success: false, error: 'تنها وزیر اقتصاد یا رئیس‌جمهور مجاز به رد معامله هستند.' });
    }
    const res = room.rejectTrade(tradeId, rejectingCountryId);
    if (callback) callback(res);
    if (res.success) {
      if (res.dismissedLocally) {
        socket.emit('trade_dismissed', { tradeId });
      } else {
        io.to(currentRoomCode).emit('trade_rejected', { tradeId, cancelledByProposer: res.cancelledByProposer });
      }
    }
  });

  socket.on('transfer_econ_budget', ({ countryId, targetCountryId, amount }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || player.role !== 'economy') {
      return callback && callback({ success: false, error: 'تنها وزیر اقتصاد مجاز به انتقال بودجه اقتصادی است.' });
    }
    const res = room.transferEconBudget(countryId, targetCountryId, amount);
    callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('country_updated', { countryId, country: room.countries[countryId] });
      if (targetCountryId && targetCountryId !== 'treasury' && targetCountryId !== countryId && room.countries[targetCountryId]) {
        io.to(currentRoomCode).emit('country_updated', { countryId: targetCountryId, country: room.countries[targetCountryId] });
      }
    }
  });

  // --- Military Events ---
  socket.on('buy_fuel', ({ countryId, count }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || player.role !== 'war') {
      return callback && callback({ success: false, error: 'تنها وزیر جنگ مجاز به خرید سوخت است.' });
    }
    const res = room.buyFuel(countryId, count);
    callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('country_updated', { countryId, country: room.countries[countryId] });
    }
  });

  socket.on('buy_army_box', ({ countryId, soldiers }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || player.role !== 'war') {
      return callback && callback({ success: false, error: 'تنها وزیر جنگ مجاز به خرید باکس ارتش است.' });
    }
    const res = room.buyArmyBox(countryId, soldiers);
    callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('country_updated', { countryId, country: room.countries[countryId] });
      io.to(currentRoomCode).emit('map_updated', { hexMap: room.hexMap });
    }
  });

  socket.on('reinforce_box', ({ countryId, boxId, soldiers }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || player.role !== 'war') {
      return callback && callback({ success: false, error: 'تنها وزیر جنگ مجاز به شارژ ارتش است.' });
    }
    const res = room.reinforceBox(countryId, boxId, soldiers);
    callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('country_updated', { countryId, country: room.countries[countryId] });
    }
  });

  socket.on('move_army', ({ countryId, boxId, targetHexId }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || player.role !== 'war') {
      return callback && callback({ success: false, error: 'تنها وزیر جنگ مجاز به حرکت ارتش و نبرد است.' });
    }
    const res = room.moveArmyBox(countryId, boxId, targetHexId);
    callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('map_updated', { hexMap: room.hexMap, trails: room.movementTrails });
      io.to(currentRoomCode).emit('country_updated', { countryId, country: room.countries[countryId] });
      if (res.combat) {
        const otherCountryId = res.combat.defCountryId || (res.combat.winner === countryId ? res.combat.loser : res.combat.winner);
        if (otherCountryId && room.countries[otherCountryId]) {
          io.to(currentRoomCode).emit('country_updated', { countryId: otherCountryId, country: room.countries[otherCountryId] });
        }
        io.to(currentRoomCode).emit('battle_occurred', { combat: res.combat });
      }
    }
  });

  socket.on('expand_territory', ({ countryId, targetHexId }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || player.role !== 'war') {
      return callback && callback({ success: false, error: 'تنها وزیر جنگ مجاز به گسترش قلمرو با سوخت است.' });
    }
    const res = room.expandTerritory(countryId, targetHexId);
    if (callback) callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('map_updated', { hexMap: room.hexMap, trails: room.movementTrails });
      io.to(currentRoomCode).emit('country_updated', { countryId, country: room.countries[countryId] });
    }
  });

  socket.on('end_turn', ({ countryId }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || player.role !== 'war') {
      return callback && callback({ success: false, error: 'تنها وزیر جنگ مجاز به پایان دادن نوبت است.' });
    }
    const currentActive = room.activeCountryOrder[room.noonActiveCountryIndex];
    if (currentActive === countryId) {
      room.nextNoonTurn();
      callback({ success: true });
      if (room.phase === 'night') {
        io.to(currentRoomCode).emit('phase_changed', { phase: 'night', round: room.round });
      } else {
        io.to(currentRoomCode).emit('noon_turn_changed', {
          cycle: room.noonCycle,
          activeCountry: room.activeCountryOrder[room.noonActiveCountryIndex],
          noonActiveCountryIndex: room.noonActiveCountryIndex
        });
      }
    } else {
      callback({ success: false, error: 'اکنون نوبت شما نیست.' });
    }
  });

  // --- President Ministry Budget Allocation ---
  socket.on('allocate_ministry_budget', ({ countryId, ministry, amount }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || player.role !== 'president') {
      return callback && callback({ success: false, error: 'تنها رئیس‌جمهور مجاز به تخصیص بودجه است.' });
    }
    const res = room.allocateMinistryBudget(countryId, ministry, amount);
    if (callback) callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('country_updated', { countryId, country: room.countries[countryId] });
    }
  });

  socket.on('reclaim_ministry_budget', ({ countryId, ministry, amount }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId) {
      return callback && callback({ success: false, error: 'دسترسی غیرمجاز.' });
    }
    const isPresident = player.role === 'president';
    const isOwnerMinister = (player.role === 'war' && ministry === 'war') || (player.role === 'economy' && ministry === 'economy');
    if (!isPresident && !isOwnerMinister) {
      return callback && callback({ success: false, error: 'تنها رئیس‌جمهور یا وزیر مربوطه مجاز به بازگرداندن بودجه به خزانه هستند.' });
    }
    const res = room.reclaimMinistryBudget(countryId, ministry, amount);
    if (callback) callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('country_updated', { countryId, country: room.countries[countryId] });
      const ministryFa = ministry === 'war' ? 'جنگ' : 'اقتصاد';
      const actorFa = player.role === 'president' ? 'رئیس‌جمهور' : `وزیر ${ministryFa}`;
      io.to(currentRoomCode).emit('ministry_budget_transferred_to_treasury', {
        countryId,
        ministry,
        amount,
        treasury: res.treasury,
        warBudget: res.warBudget,
        econBudget: res.econBudget,
        actorRole: player.role,
        message: `💰 مبلغ ${amount.toLocaleString('fa-IR')} سکه از بودجه وزارت ${ministryFa} توسط ${actorFa} به خزانه ملی واریز شد.`
      });
    }
  });

  socket.on('transfer_budget_to_treasury', ({ countryId, ministry, amount }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId) {
      return callback && callback({ success: false, error: 'دسترسی غیرمجاز.' });
    }
    const isPresident = player.role === 'president';
    const isOwnerMinister = (player.role === 'war' && ministry === 'war') || (player.role === 'economy' && ministry === 'economy');
    if (!isPresident && !isOwnerMinister) {
      return callback && callback({ success: false, error: 'تنها رئیس‌جمهور یا وزیر مربوطه مجاز به انتقال بودجه به خزانه هستند.' });
    }
    const res = room.reclaimMinistryBudget(countryId, ministry, amount);
    if (callback) callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('country_updated', { countryId, country: room.countries[countryId] });
      const ministryFa = ministry === 'war' ? 'جنگ' : 'اقتصاد';
      const actorFa = player.role === 'president' ? 'رئیس‌جمهور' : `وزیر ${ministryFa}`;
      io.to(currentRoomCode).emit('ministry_budget_transferred_to_treasury', {
        countryId,
        ministry,
        amount,
        treasury: res.treasury,
        warBudget: res.warBudget,
        econBudget: res.econBudget,
        actorRole: player.role,
        message: `💰 مبلغ ${amount.toLocaleString('fa-IR')} سکه از بودجه وزارت ${ministryFa} توسط ${actorFa} به خزانه ملی واریز شد.`
      });
    }
  });

  // Minister requesting quick budget from President
  socket.on('request_ministry_budget', ({ countryId, ministry, amount, note }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || (player.role !== 'war' && player.role !== 'economy')) {
      return callback && callback({ success: false, error: 'تنها وزرای جنگ و اقتصاد مجاز به ارسال درخواست بودجه هستند.' });
    }
    const country = room.countries[countryId];
    if (!country) return callback && callback({ success: false, error: 'کشور نامعتبر است.' });

    const reqId = `breq_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const budgetReq = {
      id: reqId,
      countryId,
      ministry,
      amount: parseInt(amount) || 5000,
      note: note || '',
      requestedAt: Date.now()
    };

    if (callback) callback({ success: true, budgetReq });
    io.to(currentRoomCode).emit('ministry_budget_requested', budgetReq);
  });

  socket.on('reject_ministry_budget', ({ countryId, reqId, ministry }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || player.role !== 'president') {
      return callback && callback({ success: false, error: 'تنها رئیس‌جمهور مجاز به رد این درخواست است.' });
    }
    if (callback) callback({ success: true });
    io.to(currentRoomCode).emit('ministry_budget_rejected', { countryId, reqId, ministry });
  });

  // --- President Tech & Treasury Events ---
  socket.on('transfer_coins', ({ fromCountryId, toCountryId, amount }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== fromCountryId || player.role !== 'president') {
      return callback && callback({ success: false, error: 'تنها رئیس‌جمهور مجاز به انتقال ارز از خزانه است.' });
    }
    const res = room.transferCoins(fromCountryId, toCountryId, amount);
    callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('country_updated', { countryId: fromCountryId, country: room.countries[fromCountryId] });
      io.to(currentRoomCode).emit('country_updated', { countryId: toCountryId, country: room.countries[toCountryId] });
    }
  });

  socket.on('unlock_puzzle', ({ countryId }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || player.role !== 'president') {
      return callback && callback({ success: false, error: 'تنها رئیس‌جمهور مجاز به باز کردن پازل فناوری است.' });
    }
    const res = room.unlockTechPuzzle(countryId);
    callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('country_updated', { countryId, country: room.countries[countryId] });
    }
  });

  socket.on('submit_puzzle', ({ countryId, answer }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const player = room.findPlayer(socket.id);
    if (!player || player.countryId !== countryId || player.role !== 'president') {
      return callback && callback({ success: false, error: 'تنها رئیس‌جمهور مجاز به ثبت پاسخ پازل است.' });
    }
    const res = room.submitTechPuzzle(countryId, answer);
    callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('country_updated', { countryId, country: room.countries[countryId] });
    }
  });

  // --- Comms & Chat Events ---
  socket.on('get_channels', ({ countryId, role }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { comms } = rooms[currentRoomCode];
    const channels = comms.getAvailableChannels(countryId, role);
    const messages = comms.getMessagesForUser(countryId, role);
    callback({ channels, messages });
  });

  socket.on('send_message', ({ senderCountry, senderRole, senderName, channelId, text }, callback) => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { comms } = rooms[currentRoomCode];
    const res = comms.postMessage(senderCountry, senderRole, senderName, channelId, text);
    if (callback) callback(res);
    if (res.success) {
      io.to(currentRoomCode).emit('new_message', res.message);
    }
  });

  // --- Active Rooms List ---
  socket.emit('active_rooms_update', getActiveRoomsList());

  socket.on('get_active_rooms', (callback) => {
    if (callback) callback(getActiveRoomsList());
  });

  // --- Audio Streaming via Socket.io (no WebRTC, works through NAT/Cloudflare) ---
  socket.on('set_voice_channel', ({ channelId }) => {
    socket.activeVoiceChannel = channelId;
  });

  function notifyDirectLineConnection(rCode, channelId, clientSocket) {
    if (!rCode || !channelId || !rooms[rCode]) return;
    const { room, comms } = rooms[rCode];
    const caller = room.findPlayer(clientSocket.id);
    if (!caller || !caller.countryId || !caller.role) return;

    let targetCountryIds = [];
    let targetRoles = [];
    let lineType = 'خط مستقیم';

    if (channelId.startsWith('pres_secret_')) {
      const parts = channelId.replace('pres_secret_', '').split('_');
      const otherCountryId = parts.find(cid => cid !== caller.countryId);
      if (otherCountryId) {
        targetCountryIds.push(otherCountryId);
        targetRoles.push('president');
        lineType = 'خط محرمانه رؤسای جمهور';
      }
    } else if (channelId.startsWith('war_secret_')) {
      const parts = channelId.replace('war_secret_', '').split('_');
      const otherCountryId = parts.find(cid => cid !== caller.countryId);
      if (otherCountryId) {
        targetCountryIds.push(otherCountryId);
        targetRoles.push('war');
        lineType = 'خط مستقیم وزرای جنگ';
      }
    } else if (channelId.startsWith('trade_secret_')) {
      const parts = channelId.replace('trade_secret_', '').split('_');
      const otherCountryId = parts.find(cid => cid !== caller.countryId);
      if (otherCountryId) {
        targetCountryIds.push(otherCountryId);
        targetRoles.push('economy');
        lineType = 'خط مستقیم وزرای اقتصاد';
      }
    } else if (channelId.startsWith('internal_')) {
      const cId = channelId.replace('internal_', '');
      if (cId === caller.countryId) {
        targetCountryIds.push(cId);
        if (caller.role === 'president') {
          targetRoles.push('war', 'economy');
          lineType = 'خط داخلی دفتر ریاست‌جمهوری';
        } else {
          targetRoles.push('president');
          lineType = 'خط مستقیم گزارش به رئیس‌جمهور';
        }
      }
    }

    if (targetCountryIds.length === 0) return;

    const callerCountry = room.countries[caller.countryId];
    const roleLabels = { president: 'رئیس‌جمهور', war: 'وزیر جنگ', economy: 'وزیر اقتصاد' };
    const payload = {
      channelId,
      lineType,
      callerSocketId: clientSocket.id,
      callerName: caller.username,
      callerCountry: caller.countryId,
      callerCountryName: callerCountry ? callerCountry.name : caller.countryId,
      callerCountryColor: callerCountry ? callerCountry.color : '#3b82f6',
      callerRole: caller.role,
      callerRoleName: roleLabels[caller.role] || caller.role,
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
    };

    targetCountryIds.forEach(tCid => {
      const tCountry = room.countries[tCid];
      if (!tCountry || tCountry.isEliminated) return;

      targetRoles.forEach(tRole => {
        const targetPlayer = tCountry.players[tRole];
        if (targetPlayer && targetPlayer.socketId && targetPlayer.socketId !== clientSocket.id) {
          const targetSocket = io.sockets.sockets.get(targetPlayer.socketId);
          if (targetSocket) {
            targetSocket.emit('direct_line_incoming', payload);
          }
        }
      });
    });

    // Record system message in chat
    const sysText = `📞 ${payload.callerRoleName} ${caller.username} (${payload.callerCountryName}) به خط مستقیم متصل شد.`;
    const sysMsg = comms.postMessage(caller.countryId, caller.role, 'مرکز ارتباطات', channelId, sysText);
    if (sysMsg.success) {
      io.to(rCode).emit('new_message', sysMsg.message);
    }
  }

  socket.on('direct_line_connect', ({ roomCode, channelId }) => {
    const rCode = currentRoomCode || roomCode;
    notifyDirectLineConnection(rCode, channelId, socket);
  });

  socket.on('join_voice', ({ roomCode, channelId }) => {
    const rCode = currentRoomCode || roomCode;
    if (!rCode || !channelId) return;
    socket.activeVoiceChannel = channelId;
    const voiceRoom = `voice_${rCode}_${channelId}`;
    socket.join(voiceRoom);
    if (channelId.startsWith('pres_secret_') || channelId.startsWith('war_secret_') || channelId.startsWith('trade_secret_') || channelId.startsWith('internal_')) {
      notifyDirectLineConnection(rCode, channelId, socket);
    }
  });

  socket.on('leave_voice', ({ roomCode, channelId }) => {
    const rCode = currentRoomCode || roomCode;
    if (!rCode || !channelId) return;
    const voiceRoom = `voice_${rCode}_${channelId}`;
    socket.leave(voiceRoom);
    if (socket.activeVoiceChannel === channelId) {
      socket.activeVoiceChannel = null;
    }
  });

  socket.on('voice_audio', ({ roomCode, channelId, audioData, sampleRate }) => {
    const rCode = currentRoomCode || roomCode;
    const chId = channelId || socket.activeVoiceChannel;
    if (!rCode || !chId || !rooms[rCode]) return;

    const { room } = rooms[rCode];
    const player = room ? room.findPlayer(socket.id) : null;
    if (player && player.countryId && room.countries[player.countryId] && room.countries[player.countryId].isEliminated) {
      return; // Eliminated team has no voice comms
    }
    const senderName = player ? player.username : 'هم‌تیمی';
    const voiceRoom = `voice_${rCode}_${chId}`;

    // 1. Relay to everyone else in this voice room
    socket.to(voiceRoom).emit('voice_audio', {
      senderSocketId: socket.id,
      senderName,
      channelId: chId,
      sampleRate: sampleRate || 44100,
      audioData
    });

    // 2. Also relay to any socket in current room that has activeVoiceChannel === chId but hasn't joined voiceRoom yet
    const roomSockets = io.sockets.adapter.rooms.get(rCode);
    if (roomSockets) {
      roomSockets.forEach(sid => {
        if (sid !== socket.id) {
          const s = io.sockets.sockets.get(sid);
          if (s && s.activeVoiceChannel === chId && !s.rooms.has(voiceRoom)) {
            s.emit('voice_audio', {
              senderSocketId: socket.id,
              senderName,
              channelId: chId,
              sampleRate: sampleRate || 44100,
              audioData
            });
          }
        }
      });
    }
  });

  socket.on('disconnect', () => {
    if (!currentRoomCode || !rooms[currentRoomCode]) return;
    const { room } = rooms[currentRoomCode];
    const isHost = (socket.id === room.hostId) || (currentUsername && currentUsername === room.hostUsername);

    if (!roomDisconnectTimers[currentRoomCode]) {
      roomDisconnectTimers[currentRoomCode] = { playerTimers: {} };
    }

    if (room.status === 'lobby') {
      if (isHost) {
        // Host reloaded in lobby: grant 60 seconds grace period
        cancelHostDisconnectTimer(currentRoomCode);
        roomDisconnectTimers[currentRoomCode].hostTimer = setTimeout(() => {
          if (rooms[currentRoomCode] && rooms[currentRoomCode].room.status === 'lobby') {
            io.to(currentRoomCode).emit('room_closed', { reason: 'میزبان اتاق را بست و از بازی خارج شد.' });
            delete rooms[currentRoomCode];
            delete roomDisconnectTimers[currentRoomCode];
            io.emit('active_rooms_update', getActiveRoomsList());
          }
        }, 60000);
      } else {
        // Non-host player in lobby: reserve slot for 60 seconds if they claimed one
        const pInfo = room.disconnectPlayer(socket.id);
        const uName = pInfo?.player?.username || currentUsername;
        if (uName && pInfo) {
          cancelPlayerDisconnectTimer(currentRoomCode, uName);
          roomDisconnectTimers[currentRoomCode].playerTimers[uName] = setTimeout(() => {
            if (rooms[currentRoomCode]) {
              rooms[currentRoomCode].room.vacatePlayerSlot(pInfo.countryId, pInfo.role, uName);
              io.to(currentRoomCode).emit('room_state', rooms[currentRoomCode].room);
              io.emit('active_rooms_update', getActiveRoomsList());
            }
          }, 60000);
        } else {
          // Player was in lobby without a slot
          room.removeMember(socket.id);
        }
        io.to(currentRoomCode).emit('room_state', room);
      }
    } else {
      // Game in progress (playing): do NOT destroy room or clear slot immediately!
      const pInfo = room.disconnectPlayer(socket.id);
      const uName = pInfo?.player?.username || currentUsername;
      if (uName && pInfo) {
        cancelPlayerDisconnectTimer(currentRoomCode, uName);
        // 90 seconds grace period for in-game reconnects
        roomDisconnectTimers[currentRoomCode].playerTimers[uName] = setTimeout(() => {
          if (rooms[currentRoomCode]) {
            rooms[currentRoomCode].room.vacatePlayerSlot(pInfo.countryId, pInfo.role, uName);
            io.to(currentRoomCode).emit('room_state', rooms[currentRoomCode].room);
          }
        }, 90000);
      }
      io.to(currentRoomCode).emit('room_state', room);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Megagame Server running on http://127.0.0.1:${PORT}`);
});
