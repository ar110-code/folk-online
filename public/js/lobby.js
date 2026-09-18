// public/js/lobby.js
// Lobby and Room Management

const socket = io();
let currentRoom = null;
let myPlayer = {
  username: '',
  countryId: null,
  role: null,
  isHost: false
};

const COUNTRY_COLORS = {
  blue: '#0284c7',
  purple: '#9333ea',
  green: '#10b981',
  grey: '#64748b',
  red: '#e11d48'
};
window.COUNTRY_COLORS = COUNTRY_COLORS;

const ROLE_NAMES = {
  president: 'رئیس‌جمهور',
  war: 'وزیر جنگ',
  economy: 'وزیر اقتصاد'
};

// DOM Elements
const lobbyAuth = document.getElementById('lobby-auth');
const lobbyRoom = document.getElementById('lobby-room');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const roomCodeInput = document.getElementById('room-code-input');
const playerNameInput = document.getElementById('player-name');
const displayRoomCode = document.getElementById('display-room-code');
const btnStartGame = document.getElementById('btn-start-game');
const countriesGrid = document.getElementById('countries-grid');

// Dynamic Team / Country UI Theme Switcher
window.applyTeamTheme = function(countryId) {
  const validThemes = ['blue', 'red', 'green', 'purple', 'grey'];
  const theme = (countryId && validThemes.includes(countryId)) ? countryId : 'default';
  
  document.body.setAttribute('data-country-theme', theme);
  const gameScreen = document.getElementById('game-screen');
  if (gameScreen) {
    gameScreen.setAttribute('data-country-theme', theme);
  }
};

// Session Management Helpers for Reliable Reload & Reconnect
function saveSession(extra = {}) {
  const current = getSavedSession() || {};
  const updated = {
    roomCode: extra.roomCode || current.roomCode || (currentRoom ? currentRoom.roomCode : null),
    username: (extra.username !== undefined) ? extra.username : (myPlayer.username || current.username || ''),
    countryId: (extra.countryId !== undefined) ? extra.countryId : (myPlayer.countryId !== undefined ? myPlayer.countryId : current.countryId),
    role: (extra.role !== undefined) ? extra.role : (myPlayer.role !== undefined ? myPlayer.role : current.role),
    isHost: (extra.isHost !== undefined) ? extra.isHost : (myPlayer.isHost !== undefined ? myPlayer.isHost : !!current.isHost),
    isPlaying: (extra.isPlaying !== undefined) ? extra.isPlaying : (currentRoom ? currentRoom.status === 'playing' : !!current.isPlaying)
  };
  if (updated.roomCode) {
    localStorage.setItem('megagame_session', JSON.stringify(updated));
  }
}

function getSavedSession() {
  try {
    const raw = localStorage.getItem('megagame_session');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem('megagame_session');
}

btnCreateRoom.addEventListener('click', () => {
  const username = playerNameInput.value.trim() || 'فرمانده ۱';
  myPlayer.username = username;
  socket.emit('create_room', { username }, res => {
    if (res.success) {
      myPlayer.isHost = true;
      saveSession({ roomCode: res.roomCode, username, isHost: true, isPlaying: false });
      showRoomLobby(res.roomCode);
    }
  });
});

btnJoinRoom.addEventListener('click', () => {
  joinByRoomCode(roomCodeInput.value.trim());
});

function joinByRoomCode(code) {
  const username = playerNameInput.value.trim() || 'فرمانده ۲';
  if (!code) {
    showToast('لطفاً کد اتاق را وارد کنید.', 'error');
    return;
  }
  myPlayer.username = username;
  socket.emit('join_room', { roomCode: code, username }, res => {
    if (res.success) {
      myPlayer.isHost = res.isHost;
      saveSession({ roomCode: res.roomCode, username, isHost: res.isHost, isPlaying: false });
      showRoomLobby(res.roomCode);
    } else {
      showToast(res.error, 'error');
    }
  });
}

// Active Rooms List Logic
socket.on('active_rooms_update', rooms => {
  renderActiveRooms(rooms);
});

const btnRefreshRooms = document.getElementById('btn-refresh-rooms');
if (btnRefreshRooms) {
  btnRefreshRooms.addEventListener('click', () => {
    socket.emit('get_active_rooms', rooms => {
      renderActiveRooms(rooms);
      showToast('لیست اتاق‌ها به‌روزرسانی شد.', 'info');
    });
  });
}

function renderActiveRooms(rooms) {
  const container = document.getElementById('active-rooms-list');
  if (!container) return;
  container.innerHTML = '';

  if (!rooms || rooms.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 8px;">هیچ اتاق فعالی وجود ندارد. اولین اتاق را ایجاد کنید!</div>';
    return;
  }

  rooms.forEach(r => {
    const row = document.createElement('div');
    row.style = 'display: flex; justify-content: space-between; align-items: center; background: #0a0d14; border: 1px solid var(--border-color); padding: 8px 12px; border-radius: 8px;';

    row.innerHTML = `
      <div style="display: flex; gap: 12px; align-items: center;">
        <span class="code-badge" style="font-size: 1rem; padding: 2px 8px;">${r.roomCode}</span>
        <span style="font-size: 0.85rem; color: #94a3b8;">ظرفیت: <strong>${r.playerCount} / ${r.totalSlots}</strong> نفر</span>
      </div>
      <button class="btn btn-primary" style="padding: 4px 12px; font-size: 0.8rem;" onclick="quickJoinRoom('${r.roomCode}')">
        پیوستن به این اتاق 🎮
      </button>
    `;
    container.appendChild(row);
  });
}

window.quickJoinRoom = function(code) {
  roomCodeInput.value = code;
  joinByRoomCode(code);
};

btnStartGame.addEventListener('click', () => {
  socket.emit('start_game', {}, res => {
    if (!res.success) {
      showToast(res.error, 'error');
    }
  });
});

function showRoomLobby(code) {
  lobbyAuth.classList.add('hidden');
  lobbyRoom.classList.remove('hidden');
  displayRoomCode.textContent = code;
  if (myPlayer.isHost) {
    btnStartGame.classList.remove('hidden');
  } else {
    btnStartGame.classList.add('hidden');
  }
}

socket.on('room_state', room => {
  currentRoom = room;
  renderCountriesLobby(room);
});

socket.on('game_started', room => {
  currentRoom = room;
  saveSession({ isPlaying: true });
  document.getElementById('lobby-screen').classList.remove('active');
  document.getElementById('game-screen').classList.add('active');
  if (typeof initGameView === 'function') {
    initGameView(room);
  }
});

function renderCountriesLobby(room) {
  countriesGrid.innerHTML = '';
  Object.values(room.countries).forEach(country => {
    const card = document.createElement('div');
    card.className = 'country-card';
    card.style.borderColor = country.color;
    card.style.boxShadow = `0 6px 24px rgba(0,0,0,0.5), 0 0 18px ${country.color}30`;

    const roleIcons = { president: '🏛️', war: '⚔️', economy: '📈' };
    let rolesHtml = '';
    ['president', 'war', 'economy'].forEach(role => {
      const occupant = country.players[role];
      const isMine = myPlayer.countryId === country.id && myPlayer.role === role;
      const isOccupiedByOther = !!occupant && !isMine && !occupant.disconnected;
      let occupantLabel = 'انتخاب +';
      if (occupant) {
        occupantLabel = occupant.disconnected ? `${occupant.username} (قطع موقت ⏱️)` : occupant.username;
      }

      rolesHtml += `
        <button class="role-slot-btn ${isOccupiedByOther ? 'taken' : ''} ${isMine ? 'active-mine' : ''}"
          onclick="claimRole('${country.id}', '${role}')" ${isOccupiedByOther ? 'disabled' : ''}>
          <span>${roleIcons[role] || ''} ${ROLE_NAMES[role]}</span>
          <span style="font-size: 0.8rem; font-weight: bold; ${isMine ? 'color: #86efac;' : isOccupiedByOther ? 'color: #94a3b8;' : 'color: #38bdf8;'}">${occupantLabel}</span>
        </button>
      `;
    });

    const filledCount = ['president', 'war', 'economy'].filter(role => !!country.players[role]).length;
    const isFull = filledCount === 3;
    const statusBadge = isFull
      ? `<span style="font-size: 0.72rem; background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #86efac; padding: 3px 8px; border-radius: 6px; font-weight: 800; box-shadow: 0 0 8px rgba(16, 185, 129, 0.3);">تکمیل (۳/۳) ✔️</span>`
      : `<span style="font-size: 0.72rem; background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; color: #fef08a; padding: 3px 8px; border-radius: 6px; font-weight: 800;">ناقص (${filledCount}/۳) ⚠️</span>`;

    card.innerHTML = `
      <div class="country-header" style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="country-color-dot" style="background: ${country.color}"></span>
          <span>${country.name}</span>
        </div>
        ${statusBadge}
      </div>
      <div class="role-slots">
        ${rolesHtml}
      </div>
    `;
    countriesGrid.appendChild(card);
  });
}

window.claimRole = function(countryId, role) {
  const username = playerNameInput.value.trim() || myPlayer.username || 'بازیکن';
  myPlayer.username = username;
  socket.emit('claim_slot', { countryId, role, username: myPlayer.username }, res => {
    if (res.success) {
      myPlayer.countryId = countryId;
      myPlayer.role = role;
      if (typeof window.applyTeamTheme === 'function') {
        window.applyTeamTheme(countryId);
      }
      saveSession({ countryId, role, username: myPlayer.username });
      showToast(`شما به عنوان ${ROLE_NAMES[role]} کشور انتخاب شدید.`, 'success');
    } else {
      showToast(res.error, 'error');
    }
  });
};

// Reconnect session on reload or socket reconnect
let isReconnecting = false;
function attemptReconnect() {
  const session = getSavedSession();
  if (!session || !session.roomCode || isReconnecting) return;
  isReconnecting = true;

  if (session.username) myPlayer.username = session.username;
  if (session.countryId) myPlayer.countryId = session.countryId;
  if (session.role) myPlayer.role = session.role;
  if (session.isHost !== undefined) myPlayer.isHost = session.isHost;

  socket.emit('rejoin_session', session, res => {
    isReconnecting = false;
    if (res && res.success) {
      currentRoom = res.room;
      myPlayer.isHost = !!res.isHost;
      if (res.countryId) {
        myPlayer.countryId = res.countryId;
        if (typeof window.applyTeamTheme === 'function') {
          window.applyTeamTheme(res.countryId);
        }
      }
      if (res.role) myPlayer.role = res.role;

      saveSession({
        roomCode: res.room.roomCode,
        username: myPlayer.username,
        countryId: myPlayer.countryId,
        role: myPlayer.role,
        isHost: myPlayer.isHost,
        isPlaying: res.isPlaying
      });

      if (res.isPlaying) {
        document.getElementById('lobby-screen').classList.remove('active');
        document.getElementById('game-screen').classList.add('active');
        if (typeof initGameView === 'function') {
          initGameView(res.room);
        }
        showToast('اتصال مجدد شما به بازی با موفقیت برقرار شد!', 'success');
      } else {
        showRoomLobby(session.roomCode);
        renderCountriesLobby(res.room);
        showToast('به لابی اتاق بازگشتید.', 'success');
      }
    } else {
      clearSession();
      if (res && res.error) {
        showToast(res.error, 'error');
      }
    }
  });
}

socket.on('connect', () => {
  const session = getSavedSession();
  if (session && session.roomCode) {
    attemptReconnect();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const session = getSavedSession();
  if (session && session.countryId && typeof window.applyTeamTheme === 'function') {
    window.applyTeamTheme(session.countryId);
  }
  attemptReconnect();

  // Leave Game Button Handler (in-game)
  const btnLeave = document.getElementById('btn-leave-game');
  if (btnLeave) {
    btnLeave.addEventListener('click', () => {
      if (confirm('آیا مطمئن هستید که می‌خواهید از بازی خارج شوید؟')) {
        socket.emit('leave_game');
        clearSession();
        if (typeof window.applyTeamTheme === 'function') {
          window.applyTeamTheme(null);
        }
        window.location.reload();
      }
    });
  }

  // Leave Lobby Room Handler (before game starts)
  const btnLeaveLobbyRoom = document.getElementById('btn-leave-lobby-room');
  if (btnLeaveLobbyRoom) {
    btnLeaveLobbyRoom.addEventListener('click', () => {
      socket.emit('leave_game');
      clearSession();
      if (typeof window.applyTeamTheme === 'function') {
        window.applyTeamTheme(null);
      }
      myPlayer.countryId = null;
      myPlayer.role = null;
      myPlayer.isHost = false;
      currentRoom = null;
      lobbyRoom.classList.add('hidden');
      lobbyAuth.classList.remove('hidden');
      btnStartGame.classList.add('hidden');
      showToast('از اتاق خارج شدید.', 'info');
      socket.emit('get_active_rooms', rooms => {
        renderActiveRooms(rooms);
      });
    });
  }
});

// Room Closed by Host Handler
socket.on('room_closed', data => {
  clearSession();
  if (typeof window.applyTeamTheme === 'function') {
    window.applyTeamTheme(null);
  }
  myPlayer.countryId = null;
  myPlayer.role = null;
  myPlayer.isHost = false;
  currentRoom = null;

  document.getElementById('game-screen').classList.remove('active');
  document.getElementById('lobby-screen').classList.add('active');
  lobbyRoom.classList.add('hidden');
  lobbyAuth.classList.remove('hidden');
  btnStartGame.classList.add('hidden');

  showToast(data.reason || 'اتاق توسط میزبان بسته شد و حذف گردید.', 'error');
  socket.emit('get_active_rooms', rooms => {
    renderActiveRooms(rooms);
  });
});

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
