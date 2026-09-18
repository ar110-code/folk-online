// public/js/main.js
// Main Game Controller and Socket Event Listeners

function initGameView(room) {
  if (room) currentRoom = room;
  if (typeof window.applyTeamTheme === 'function') {
    window.applyTeamTheme(myPlayer.countryId);
  }
  const myCountry = myPlayer.countryId && room.countries ? room.countries[myPlayer.countryId] : null;
  const countryName = myCountry ? myCountry.name : '--';
  const countryColor = myCountry ? myCountry.color : '#64748b';

  // Update Player Meta
  document.getElementById('my-country-badge').textContent = `کشور: ${countryName}${myCountry && myCountry.isEliminated ? ' (حذف‌شده ❌)' : ''}`;
  document.getElementById('my-country-badge').style.borderColor = countryColor;
  document.getElementById('my-role-badge').textContent = `نقش: ${ROLE_NAMES[myPlayer.role] || '--'}`;

  const existingNotice = document.getElementById('eliminated-team-notice');
  if (myCountry && myCountry.isEliminated) {
    if (!existingNotice) {
      const banner = document.createElement('div');
      banner.id = 'eliminated-team-notice';
      banner.style.cssText = 'background: #450a0a; border: 2px solid #ef4444; color: #fca5a5; padding: 12px 18px; border-radius: 8px; margin: 12px auto; max-width: 900px; text-align: center; font-weight: bold; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);';
      banner.innerHTML = '⚠️ این تیم به دلیل عدم تکمیل تمام ۳ نقش (رئیس‌جمهور، وزیر اقتصاد، وزیر جنگ) پیش از شروع، کلاً از بازی حذف گردید و در این دست مشارکتی ندارد (حالت تماشاچی).';
      const gameScreen = document.getElementById('game-screen');
      if (gameScreen) {
        gameScreen.insertBefore(banner, gameScreen.children[1] || gameScreen.firstChild);
      }
    }
  } else if (existingNotice) {
    existingNotice.remove();
  }

  // Activate specific role workspace
  document.querySelectorAll('.role-view').forEach(v => v.classList.add('hidden'));
  const presNav = document.getElementById('president-nav');

  if (myPlayer.role === 'economy') {
    presNav.classList.add('hidden');
    document.getElementById('view-economy').classList.remove('hidden');
    document.querySelector('#view-economy .econ-tab-bar')?.classList.remove('hidden');
    document.getElementById('econ-overwatch-notice')?.classList.add('hidden');
    const activeEconBtn = document.querySelector('#view-economy .dashboard-tab-btn.active');
    const activeEconTarget = activeEconBtn?.dataset.tabTarget || 'econ-tab-market';
    document.querySelectorAll('#view-economy .dash-tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(activeEconTarget)?.classList.remove('hidden');
    initEconBoard();
  } else if (myPlayer.role === 'war') {
    presNav.classList.add('hidden');
    document.getElementById('view-war').classList.remove('hidden');
    document.querySelector('#view-war .war-tab-bar')?.classList.remove('hidden');
    document.getElementById('war-overwatch-notice')?.classList.add('hidden');
    const activeWarBtn = document.querySelector('#view-war .dashboard-tab-btn.active');
    const activeWarTarget = activeWarBtn?.dataset.tabTarget || 'war-tab-controller';
    document.querySelectorAll('#view-war .dash-tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(activeWarTarget)?.classList.remove('hidden');
    initHexMap();
    if (typeof updateWarTurnButtonState === 'function') updateWarTurnButtonState();
  } else if (myPlayer.role === 'president') {
    presNav.classList.remove('hidden');
    document.getElementById('view-president').classList.remove('hidden');
    document.querySelector('#view-president .pres-tab-bar')?.classList.remove('hidden');
    initPresidentApp();
    initHexMap();
    initEconBoard();
  }

  initDashboardTabs();
  initChatComms();
  updateHeaderStats();

  // On mobile screens, collapse the comms sidebar by default so the workspace is immediately visible
  if (window.innerWidth <= 768) {
    const commsPanel = document.querySelector('.comms-panel');
    if (commsPanel && !commsPanel.classList.contains('collapsed')) {
      commsPanel.classList.add('collapsed');
      const toggleText = document.getElementById('comms-toggle-text');
      if (toggleText) toggleText.textContent = 'باز کردن چت و ویس';
      const dockTab = document.getElementById('btn-comms-dock-tab');
      if (dockTab) dockTab.classList.add('visible');
    }
  }
}

let dashboardTabsInitialized = false;
function initDashboardTabs() {
  if (dashboardTabsInitialized) return;
  dashboardTabsInitialized = true;

  document.querySelectorAll('.dashboard-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.tabGroup;
      const targetId = btn.dataset.tabTarget;
      if (!group || !targetId) return;

      // Deactivate all buttons in this group
      document.querySelectorAll(`.dashboard-tab-btn[data-tab-group="${group}"]`).forEach(b => {
        b.classList.remove('active');
      });
      // Activate clicked button
      btn.classList.add('active');

      // Hide all tab contents in this group
      document.querySelectorAll(`.dash-tab-content[data-tab-group="${group}"]`).forEach(content => {
        content.classList.add('hidden');
        content.classList.remove('active');
      });

      // Show targeted content
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.classList.remove('hidden');
        targetEl.classList.add('active');
      }

      if (group === 'war' && typeof updateWarTurnButtonState === 'function') {
        updateWarTurnButtonState();
      }
    });
  });
}

// Auto-bind tabs on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboardTabs);
} else {
  initDashboardTabs();
}

window.switchPresidentView = function(viewType) {
  if (myPlayer.role !== 'president') return;
  document.querySelectorAll('.role-view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.pnav-btn').forEach(b => b.classList.remove('active'));

  if (viewType === 'president') {
    document.getElementById('view-president').classList.remove('hidden');
    document.getElementById('pnav-pres').classList.add('active');
    updatePresidentUI();
  } else if (viewType === 'war') {
    document.getElementById('view-war').classList.remove('hidden');
    document.getElementById('pnav-war').classList.add('active');
    // President in Overwatch: Battlefield map is always visible at top; hide war tabs and operational panels
    document.querySelector('#view-war .war-tab-bar')?.classList.add('hidden');
    document.querySelectorAll('#view-war .dash-tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('war-overwatch-notice')?.classList.remove('hidden');
    renderHexMap();
  } else if (viewType === 'economy') {
    document.getElementById('view-economy').classList.remove('hidden');
    document.getElementById('pnav-econ').classList.add('active');
    // President in Overwatch: Flower board is always visible at top; hide econ tabs and operational panels
    document.querySelector('#view-economy .econ-tab-bar')?.classList.add('hidden');
    document.querySelectorAll('#view-economy .dash-tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('econ-overwatch-notice')?.classList.remove('hidden');
    renderFlowerSvg();
  }
};

function updateHeaderStats() {
  if (!currentRoom || !myPlayer.countryId) return;
  const country = currentRoom.countries[myPlayer.countryId];
  if (!country) return;

  const treasuryLabel = document.getElementById('my-treasury-label');
  const treasuryVal = document.getElementById('my-treasury');

  if (myPlayer.role === 'war') {
    if (treasuryLabel) treasuryLabel.textContent = 'بودجه جنگ:';
    if (treasuryVal) treasuryVal.textContent = (country.warBudget || 0).toLocaleString('fa-IR');
  } else if (myPlayer.role === 'economy') {
    if (treasuryLabel) treasuryLabel.textContent = 'بودجه اقتصاد:';
    if (treasuryVal) treasuryVal.textContent = (country.econBudget || 0).toLocaleString('fa-IR');
  } else {
    if (treasuryLabel) treasuryLabel.textContent = 'خزانه ملی:';
    if (treasuryVal) treasuryVal.textContent = country.treasury.toLocaleString('fa-IR');
  }

  const roundEl = document.getElementById('display-round');
  if (roundEl) {
    roundEl.textContent = `${country.isEliminated ? 'حذف شده' : currentRoom.round} از ۸`;
  }

  // Update timer badge immediately
  const timerEl = document.getElementById('display-timer');
  if (timerEl && currentRoom.phaseTimer !== undefined) {
    const min = String(Math.floor(currentRoom.phaseTimer / 60)).padStart(2, '0');
    const sec = String(currentRoom.phaseTimer % 60).padStart(2, '0');
    timerEl.textContent = `${min}:${sec}`;
  }

  // Update phase badge immediately
  const phaseBadge = document.getElementById('display-phase');
  if (phaseBadge && currentRoom.phase) {
    phaseBadge.className = `meta-badge phase-${currentRoom.phase}`;
    if (currentRoom.phase === 'morning') phaseBadge.textContent = 'صبح (برنامه‌ریزی)';
    else if (currentRoom.phase === 'noon') phaseBadge.textContent = 'ظهر (اجرا و نبرد)';
    else if (currentRoom.phase === 'night') phaseBadge.textContent = 'شب (حسابرسی سرور)';
  }

  // Noon indicators
  const noonInd = document.getElementById('noon-indicator');
  if (noonInd) {
    if (currentRoom.phase === 'noon') {
      noonInd.classList.remove('hidden');
      const cycleEl = document.getElementById('display-noon-cycle');
      if (cycleEl) cycleEl.textContent = `${currentRoom.noonCycle || 1} از ۵`;
      const activeCId = currentRoom.activeCountryOrder ? currentRoom.activeCountryOrder[currentRoom.noonActiveCountryIndex] : null;
      const activeC = activeCId ? currentRoom.countries[activeCId] : null;
      const turnEl = document.getElementById('display-active-turn');
      if (turnEl) {
        turnEl.textContent = `نوبت حرکت: ${activeC ? activeC.name : '--'}`;
        turnEl.style.background = activeC ? activeC.color : '#7c2d12';
      }
    } else {
      noonInd.classList.add('hidden');
    }
  }

  // Update National Mini-HUD (Feature 7)
  const hudArmies = document.getElementById('hud-val-armies');
  const hudGoods = document.getElementById('hud-val-goods');
  const hudTech = document.getElementById('hud-val-tech');
  if (hudArmies) {
    const armyList = country.military?.armyBoxes || country.military?.boxes || [];
    const activeArmies = armyList.filter(b => (b.soldiers || 0) > 0).length;
    hudArmies.textContent = `${activeArmies} ارتش`;
  }
  if (hudGoods) {
    const storage = country.economy?.storage || {};
    const totalFinishedGoods = (storage.bread || 0) + (storage.building || 0) + (storage.clothes || 0);
    hudGoods.textContent = `${totalFinishedGoods} کالا`;
  }
  if (hudTech) {
    const mult = country.techMultiplier || 1.0;
    hudTech.textContent = `${mult.toFixed(1)}×`;
  }
}

// Socket Real-time Listeners
let turnModalDismissTimer = null;
let turnProgressBarInterval = null;
let lastAnnouncedTurnKey = null;

function playTurnChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12); // A5
    gain2.gain.setValueAtTime(0.25, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch (e) {
    // AudioContext permission may be restricted before user gesture
  }
}

function showTurnAnnouncementModal(activeCountryId, durationSeconds = 40) {
  const modal = document.getElementById('turn-announcement-modal');
  if (!modal || !currentRoom) return;

  const country = currentRoom.countries[activeCountryId];
  const countryName = COUNTRY_PERSIAN_NAMES[activeCountryId] || (country ? country.name : activeCountryId);
  const countryColor = COUNTRY_COLORS[activeCountryId] || (country ? country.color : '#ef4444');

  const badge = document.getElementById('turn-announcement-country-badge');
  if (badge) {
    badge.textContent = `کشور: ${countryName}`;
    badge.style.borderColor = countryColor;
    badge.style.color = countryColor;
  }

  const timerBox = document.getElementById('turn-announcement-timer');
  if (timerBox) {
    timerBox.textContent = `${durationSeconds} ثانیه`;
  }

  const roleDesc = document.getElementById('turn-announcement-desc');
  if (roleDesc) {
    if (myPlayer.role === 'war') {
      roleDesc.innerHTML = 'فرماندهی محترم جنگ، اکنون <strong>نوبت عملیات نظامی</strong> شماست! می‌توانید با ارتش مانور دهید یا بجنگید، و با مصرف سوخت قلمروهای هم‌مرز را فتح نمایید.';
    } else if (myPlayer.role === 'president') {
      roleDesc.innerHTML = 'رئیس‌جمهور محترم، اکنون <strong>نوبت کشور شما در فاز ظهر</strong> است. وزیر جنگ کشور در حال اجرای عملیات نظامی و فتح اراضی است.';
    } else {
      roleDesc.innerHTML = 'اکنون <strong>نوبت کشور شما در فاز ظهر</strong> است.';
    }
  }

  playTurnChime();
  modal.classList.remove('hidden');

  if (turnModalDismissTimer) clearTimeout(turnModalDismissTimer);
  if (turnProgressBarInterval) clearInterval(turnProgressBarInterval);

  const progressBar = document.getElementById('turn-announcement-progress');
  if (progressBar) {
    progressBar.style.width = '100%';
    const autoDuration = 4500;
    const start = Date.now();
    turnProgressBarInterval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / autoDuration) * 100);
      progressBar.style.width = `${pct}%`;
      if (elapsed >= autoDuration) {
        clearInterval(turnProgressBarInterval);
      }
    }, 50);
  }

  turnModalDismissTimer = setTimeout(() => {
    dismissTurnAnnouncement();
  }, 4500);
}

function dismissTurnAnnouncement() {
  const modal = document.getElementById('turn-announcement-modal');
  if (modal) modal.classList.add('hidden');
  if (turnModalDismissTimer) {
    clearTimeout(turnModalDismissTimer);
    turnModalDismissTimer = null;
  }
  if (turnProgressBarInterval) {
    clearInterval(turnProgressBarInterval);
    turnProgressBarInterval = null;
  }
}

function checkAndTriggerTurnAnnouncement(phase, activeCountryId, timerSeconds) {
  if (phase !== 'noon' || !activeCountryId) {
    lastAnnouncedTurnKey = null;
    dismissTurnAnnouncement();
    return;
  }
  if (myPlayer.countryId !== activeCountryId) return;

  const cycle = currentRoom?.noonCycle || 1;
  const round = currentRoom?.round || 1;
  const turnKey = `${round}_${cycle}_${activeCountryId}`;

  if (lastAnnouncedTurnKey !== turnKey) {
    lastAnnouncedTurnKey = turnKey;
    showTurnAnnouncementModal(activeCountryId, timerSeconds || currentRoom?.phaseTimer || 40);
  }
}

document.getElementById('btn-dismiss-turn-announcement')?.addEventListener('click', dismissTurnAnnouncement);
document.getElementById('turn-announcement-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'turn-announcement-modal') dismissTurnAnnouncement();
});

socket.on('timer_tick', data => {
  const min = String(Math.floor(data.timer / 60)).padStart(2, '0');
  const sec = String(data.timer % 60).padStart(2, '0');
  document.getElementById('display-timer').textContent = `${min}:${sec}`;

  if (currentRoom) {
    currentRoom.phase = data.phase;
    currentRoom.phaseTimer = data.timer;
    if (data.round) currentRoom.round = data.round;
    if (data.noonCycle) currentRoom.noonCycle = data.noonCycle;
    if (data.noonActiveCountryIndex !== undefined) {
      currentRoom.noonActiveCountryIndex = data.noonActiveCountryIndex;
    }
  }

  // Phase badge
  const phaseBadge = document.getElementById('display-phase');
  phaseBadge.className = `meta-badge phase-${data.phase}`;
  if (data.phase === 'morning') phaseBadge.textContent = 'صبح (برنامه‌ریزی)';
  else if (data.phase === 'noon') phaseBadge.textContent = 'ظهر (اجرا و نبرد)';
  else if (data.phase === 'night') phaseBadge.textContent = 'شب (حسابرسی سرور)';

  // Noon indicators
  const noonInd = document.getElementById('noon-indicator');
  if (data.phase === 'noon') {
    noonInd.classList.remove('hidden');
    document.getElementById('display-noon-cycle').textContent = `${data.noonCycle} از ۵`;
    const activeCountryName = data.activeCountry && currentRoom ? currentRoom.countries[data.activeCountry].name : '--';
    document.getElementById('display-active-turn').textContent = `نوبت حرکت: ${activeCountryName}`;
    document.getElementById('display-active-turn').style.background = data.activeCountry && currentRoom ? currentRoom.countries[data.activeCountry].color : '#7c2d12';

    checkAndTriggerTurnAnnouncement('noon', data.activeCountry, data.timer);
  } else {
    noonInd.classList.add('hidden');
    lastAnnouncedTurnKey = null;
    dismissTurnAnnouncement();
  }

  // Keep End Turn button state strictly synchronised with the phase and current turn
  if (myPlayer.role === 'war' && window.updateWarTurnButtonState) {
    window.updateWarTurnButtonState();
  }
});

socket.on('phase_changed', data => {
  if (currentRoom) {
    currentRoom.phase = data.phase;
    currentRoom.round = data.round;
    if (data.cycle !== undefined) currentRoom.noonCycle = data.cycle;
    if (data.noonActiveCountryIndex !== undefined) {
      currentRoom.noonActiveCountryIndex = data.noonActiveCountryIndex;
    } else if (data.phase === 'noon') {
      currentRoom.noonActiveCountryIndex = 0;
    }
  }

  if (data.phase === 'noon') {
    const activeCountry = data.activeCountry || (currentRoom?.activeCountryOrder ? currentRoom.activeCountryOrder[0] : null);
    if (activeCountry) checkAndTriggerTurnAnnouncement('noon', activeCountry);
  } else {
    lastAnnouncedTurnKey = null;
    dismissTurnAnnouncement();
  }

  showToast(`🔔 ورود به فاز ${data.phase === 'morning' ? 'صبح' : data.phase === 'noon' ? 'ظهر' : 'شب'} (راند ${data.round})`, 'info');
  refreshChannels();

  if (myPlayer.role === 'economy') renderFlowerSvg();
  if (myPlayer.role === 'war') {
    renderHexMap();
    if (window.updateWarTurnButtonState) window.updateWarTurnButtonState();
  }
  if (myPlayer.role === 'president') updatePresidentUI();
  updateHeaderStats();
});

socket.on('noon_turn_changed', data => {
  if (currentRoom) {
    if (data.cycle !== undefined) currentRoom.noonCycle = data.cycle;
    if (data.noonActiveCountryIndex !== undefined) {
      currentRoom.noonActiveCountryIndex = data.noonActiveCountryIndex;
    } else if (data.activeCountry && currentRoom.activeCountryOrder) {
      currentRoom.noonActiveCountryIndex = currentRoom.activeCountryOrder.indexOf(data.activeCountry);
    }
  }

  if (data.activeCountry) {
    checkAndTriggerTurnAnnouncement('noon', data.activeCountry);
  }

  if (myPlayer.role === 'war') {
    renderHexMap();
    if (window.updateWarTurnButtonState) window.updateWarTurnButtonState();
  } else if (myPlayer.role === 'president') {
    updatePresidentUI();
  }
});

socket.on('country_updated', data => {
  if (currentRoom) {
    currentRoom.countries[data.countryId] = data.country;
  }
  updateHeaderStats();
  if (myPlayer.role === 'economy') renderFlowerSvg();
  if (myPlayer.role === 'war') renderHexMap();
  if (myPlayer.role === 'president') updatePresidentUI();
});

socket.on('map_updated', data => {
  if (currentRoom) {
    currentRoom.hexMap = data.hexMap;
    if (data.trails) currentRoom.movementTrails = data.trails;
  }
  if (myPlayer.role === 'war') renderHexMap();
});

socket.on('game_finished', data => {
  showGameOverModal(data.scores);
});

function showGameOverModal(scores) {
  const modal = document.getElementById('game-over-modal');
  const tbody = document.getElementById('ranking-table-body');
  tbody.innerHTML = '';

  scores.forEach((s, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${idx + 1}</strong></td>
      <td style="color: ${s.color}; font-weight: bold;">${s.name} ${s.isEliminated ? '(مغلوب)' : ''}</td>
      <td><span class="code-badge" style="font-size: 1rem;">${s.totalPoints} امتیاز</span></td>
      <td>سطح ${s.techScore}</td>
      <td>${s.militaryScore}</td>
      <td>${s.econScore.toLocaleString('fa-IR')} سکه</td>
      <td>${s.popScore} نفر</td>
    `;
    tbody.appendChild(tr);
  });

  modal.classList.remove('hidden');
}

socket.on('battle_occurred', data => {
  if (window.showBattleOutcome && data?.combat) {
    window.showBattleOutcome(data.combat);
  }
});

// Global close handler for battle modal across all roles
const dismissBattleModal = () => {
  const modal = document.getElementById('battle-modal');
  if (modal) modal.classList.add('hidden');
  if (window.clearPendingAttack) window.clearPendingAttack();
};

document.getElementById('btn-close-battle-modal')?.addEventListener('click', dismissBattleModal);
document.getElementById('btn-retreat-attack')?.addEventListener('click', dismissBattleModal);
document.getElementById('btn-done-battle')?.addEventListener('click', dismissBattleModal);
document.getElementById('battle-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'battle-modal') dismissBattleModal();
});

document.getElementById('btn-restart-game').addEventListener('click', () => {
  window.location.reload();
});

/* ==========================================================================
   FEATURE 5: THEATER / FOCUS MODE (Fullscreen distraction-free)
   ========================================================================== */
window.toggleTheaterMode = function(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const isTheater = container.classList.toggle('theater-active');
  const exitBtn = container.querySelector('.btn-exit-theater');
  if (exitBtn) {
    if (isTheater) exitBtn.classList.remove('hidden');
    else exitBtn.classList.add('hidden');
  }
  const toggleBtn = container.querySelector('.btn-theater-toggle');
  if (toggleBtn) {
    toggleBtn.textContent = isTheater ? '❌ خروج از تمرکز' : '⛶ نمای متمرکز';
  }

  // Trigger resize / re-render for SVG maps
  if (containerId === 'war-map-container') {
    if (typeof renderHexMap === 'function') renderHexMap();
  } else if (containerId === 'econ-flower-board-container') {
    if (typeof renderFlowerSvg === 'function') renderFlowerSvg();
  }
};

window.exitAllTheaterModes = function() {
  document.querySelectorAll('.theater-active').forEach(container => {
    container.classList.remove('theater-active');
    const exitBtn = container.querySelector('.btn-exit-theater');
    if (exitBtn) exitBtn.classList.add('hidden');
    const toggleBtn = container.querySelector('.btn-theater-toggle');
    if (toggleBtn) toggleBtn.textContent = '⛶ نمای متمرکز';
  });
  if (typeof renderHexMap === 'function') renderHexMap();
  if (typeof renderFlowerSvg === 'function') renderFlowerSvg();
};

document.getElementById('btn-theater-war')?.addEventListener('click', () => {
  window.toggleTheaterMode('war-map-container');
});
document.getElementById('btn-theater-econ')?.addEventListener('click', () => {
  window.toggleTheaterMode('econ-flower-board-container');
});

// Escape key to exit theater mode
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.exitAllTheaterModes();
  }
});

/* ==========================================================================
   FEATURE 6: COLLAPSIBLE CARDS
   ========================================================================== */
window.toggleCardCollapse = function(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  card.classList.toggle('is-collapsed');
};

/* ==========================================================================
   FEATURE 9: QUICK BUDGET REQUEST (Modal & Toast)
   ========================================================================== */
let activeBudgetReqMinistry = null;
let currentPendingBudgetReq = null;

window.openBudgetRequestModal = function(ministry) {
  activeBudgetReqMinistry = ministry;
  const modal = document.getElementById('budget-request-modal');
  const title = document.getElementById('budget-request-modal-title');
  if (title) {
    title.textContent = ministry === 'war'
      ? '🔔 درخواست بودجه اضطراری وزارت جنگ از رئیس‌جمهور'
      : '🔔 درخواست بودجه اضطراری وزارت اقتصاد از رئیس‌جمهور';
  }
  const input = document.getElementById('budget-req-amount-input');
  if (input) input.value = 5000;
  const noteInput = document.getElementById('budget-req-note-input');
  if (noteInput) noteInput.value = '';

  // Preset button highlighting
  document.querySelectorAll('.btn-preset-breq').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.amount === '5000');
  });

  if (modal) modal.classList.remove('hidden');
};

window.closeBudgetRequestModal = function() {
  const modal = document.getElementById('budget-request-modal');
  if (modal) modal.classList.add('hidden');
};

// Preset buttons
document.querySelectorAll('.btn-preset-breq').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-preset-breq').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const amount = btn.dataset.amount;
    const input = document.getElementById('budget-req-amount-input');
    if (input && amount) input.value = amount;
  });
});

// Open modal triggers from War and Economy
document.getElementById('btn-req-budget-war')?.addEventListener('click', () => {
  window.openBudgetRequestModal('war');
});
document.getElementById('btn-req-budget-econ')?.addEventListener('click', () => {
  window.openBudgetRequestModal('economy');
});

// Submit budget request to President
document.getElementById('btn-send-budget-request')?.addEventListener('click', () => {
  if (!currentRoom || !myPlayer.countryId || !activeBudgetReqMinistry) return;
  const input = document.getElementById('budget-req-amount-input');
  const amount = parseInt(input?.value) || 5000;
  const noteInput = document.getElementById('budget-req-note-input');
  const note = noteInput ? noteInput.value.trim() : '';

  socket.emit('request_ministry_budget', {
    countryId: myPlayer.countryId,
    ministry: activeBudgetReqMinistry,
    amount,
    note
  }, res => {
    if (res && res.success) {
      alert(`درخواست واریز ${amount.toLocaleString('fa-IR')} سکه به رئیس‌جمهور ارسال گردید.`);
      window.closeBudgetRequestModal();
    } else {
      alert(res?.error || 'خطا در ارسال درخواست بودجه.');
    }
  });
});

// President Toast Controls
window.closeBudgetRequestToast = function() {
  const toast = document.getElementById('budget-request-toast');
  if (toast) toast.classList.add('hidden');
  currentPendingBudgetReq = null;
};

document.getElementById('btn-dismiss-budget-toast')?.addEventListener('click', window.closeBudgetRequestToast);

document.getElementById('btn-budget-toast-accept')?.addEventListener('click', () => {
  if (!currentPendingBudgetReq || !currentRoom) return;
  const { countryId, ministry, amount } = currentPendingBudgetReq;
  socket.emit('allocate_ministry_budget', {
    countryId,
    ministry,
    amount
  }, res => {
    if (res && res.success) {
      window.closeBudgetRequestToast();
      alert(`مبلغ ${amount.toLocaleString('fa-IR')} سکه با موفقیت به بودجه وزارت ${ministry === 'war' ? 'جنگ' : 'اقتصاد'} واریز گردید.`);
    } else {
      alert(res?.error || 'خطا در تخصیص بودجه.');
    }
  });
});

document.getElementById('btn-budget-toast-reject')?.addEventListener('click', () => {
  if (!currentPendingBudgetReq || !currentRoom) return;
  const { countryId, id, ministry } = currentPendingBudgetReq;
  socket.emit('reject_ministry_budget', {
    countryId,
    reqId: id,
    ministry
  }, res => {
    window.closeBudgetRequestToast();
  });
});

// Incoming Budget Request Listener
socket.on('ministry_budget_requested', req => {
  if (!currentRoom || !myPlayer.countryId) return;
  if (req.countryId !== myPlayer.countryId) return;

  // Only the President sees the interactive approval toast
  if (myPlayer.role === 'president') {
    currentPendingBudgetReq = req;
    const toast = document.getElementById('budget-request-toast');
    const toastText = document.getElementById('budget-toast-text');
    const minName = req.ministry === 'war' ? 'وزیر جنگ' : 'وزیر اقتصاد';
    if (toastText) {
      toastText.innerHTML = `<strong>${minName}</strong> درخواست واریز فوری <strong>${(req.amount || 0).toLocaleString('fa-IR')} سکه</strong> از خزانه کل دارد.${req.note ? '<br><small style="color: #cbd5e1;">علت: ' + req.note + '</small>' : ''}`;
    }
    if (toast) toast.classList.remove('hidden');
  }
});

socket.on('ministry_budget_rejected', data => {
  if (!currentRoom || !myPlayer.countryId) return;
  if (data.countryId !== myPlayer.countryId) return;

  if (myPlayer.role === data.ministry) {
    alert('❌ درخواست بودجه اضطراری شما توسط رئیس‌جمهور رد شد.');
  }
});

// --- Budget Transfer to Treasury Modal Logic (For War & Economy Ministers) ---
let activeBudgetTransferMinistry = null;

window.openBudgetTransferModal = function(ministry) {
  activeBudgetTransferMinistry = ministry;
  const modal = document.getElementById('budget-transfer-modal');
  const title = document.getElementById('budget-transfer-modal-title');
  if (title) {
    title.textContent = ministry === 'war'
      ? '🏛️ انتقال بودجه وزارت جنگ به خزانه ملی'
      : '🏛️ انتقال بودجه وزارت اقتصاد به خزانه ملی';
  }

  const country = currentRoom && myPlayer.countryId ? currentRoom.countries[myPlayer.countryId] : null;
  const currentBudget = country ? (ministry === 'war' ? (country.warBudget || 0) : (country.econBudget || 0)) : 0;
  const treasury = country ? (country.treasury || 0) : 0;

  const budgetDisplay = document.getElementById('transfer-modal-current-budget');
  if (budgetDisplay) budgetDisplay.textContent = currentBudget.toLocaleString('fa-IR');

  const treasuryDisplay = document.getElementById('transfer-modal-treasury');
  if (treasuryDisplay) treasuryDisplay.textContent = treasury.toLocaleString('fa-IR');

  const input = document.getElementById('budget-transfer-amount-input');
  if (input) {
    input.max = currentBudget;
    input.value = Math.min(2000, currentBudget > 0 ? currentBudget : 500);
  }

  // Preset button highlighting
  document.querySelectorAll('.btn-preset-btransfer').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.amount === '2000');
  });

  if (modal) modal.classList.remove('hidden');
};

window.closeBudgetTransferModal = function() {
  const modal = document.getElementById('budget-transfer-modal');
  if (modal) modal.classList.add('hidden');
  activeBudgetTransferMinistry = null;
};

// Preset buttons for budget transfer
document.querySelectorAll('.btn-preset-btransfer').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-preset-btransfer').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const amountAttr = btn.dataset.amount;
    const input = document.getElementById('budget-transfer-amount-input');
    if (!input) return;

    if (amountAttr === 'all') {
      const country = currentRoom && myPlayer.countryId ? currentRoom.countries[myPlayer.countryId] : null;
      const currentBudget = country ? (activeBudgetTransferMinistry === 'war' ? (country.warBudget || 0) : (country.econBudget || 0)) : 0;
      input.value = currentBudget;
    } else {
      input.value = amountAttr;
    }
  });
});

// Trigger buttons for budget transfer modal
document.getElementById('btn-return-budget-war')?.addEventListener('click', () => {
  window.openBudgetTransferModal('war');
});
document.getElementById('btn-return-budget-econ')?.addEventListener('click', () => {
  window.openBudgetTransferModal('economy');
});
document.getElementById('btn-quick-transfer-treasury-war')?.addEventListener('click', () => {
  window.openBudgetTransferModal('war');
});

// Submit transfer to treasury
document.getElementById('btn-confirm-transfer-to-treasury')?.addEventListener('click', () => {
  if (!currentRoom || !myPlayer.countryId || !activeBudgetTransferMinistry) return;
  const input = document.getElementById('budget-transfer-amount-input');
  const amount = parseInt(input?.value, 10) || 0;

  if (amount <= 0) {
    if (typeof showToast === 'function') showToast('لطفاً یک مبلغ معتبر وارد کنید.', 'error');
    else alert('لطفاً یک مبلغ معتبر وارد کنید.');
    return;
  }

  const country = currentRoom.countries[myPlayer.countryId];
  const currentBudget = country ? (activeBudgetTransferMinistry === 'war' ? (country.warBudget || 0) : (country.econBudget || 0)) : 0;
  if (amount > currentBudget) {
    const err = `موجودی بودجه وزارتخانه شما (${currentBudget.toLocaleString('fa-IR')} سکه) کمتر از مبلغ درخواستی است.`;
    if (typeof showToast === 'function') showToast(err, 'error');
    else alert(err);
    return;
  }

  socket.emit('transfer_budget_to_treasury', {
    countryId: myPlayer.countryId,
    ministry: activeBudgetTransferMinistry,
    amount
  }, res => {
    if (res && res.success) {
      if (typeof showToast === 'function') {
        showToast(`✅ مبلغ ${amount.toLocaleString('fa-IR')} سکه با موفقیت به خزانه ملی واریز شد.`, 'success');
      } else {
        alert(`✅ مبلغ ${amount.toLocaleString('fa-IR')} سکه با موفقیت به خزانه ملی واریز شد.`);
      }
      window.closeBudgetTransferModal();
    } else {
      const err = res?.error || 'خطا در انتقال بودجه به خزانه.';
      if (typeof showToast === 'function') showToast(err, 'error');
      else alert(err);
    }
  });
});

// Broadcast listener for transfer to treasury
socket.on('ministry_budget_transferred_to_treasury', data => {
  if (myPlayer && myPlayer.countryId === data.countryId) {
    if (typeof showToast === 'function') {
      showToast(data.message, 'info');
    }
  }
});

/* ==========================================================================
   COMPACT & HIDEABLE DASHBOARD CONTROLS SYSTEM
   ========================================================================== */
window.toggleBottomDashboard = function(role) {
  if (!role) {
    const warView = document.getElementById('view-war');
    const econView = document.getElementById('view-economy');
    if (warView && !warView.classList.contains('hidden')) {
      role = 'war';
    } else if (econView && !econView.classList.contains('hidden')) {
      role = 'econ';
    } else {
      return;
    }
  }

  const body = document.getElementById(`${role}-controls-body`);
  const btn = document.getElementById(`btn-toggle-dashboard-${role}`);
  if (!body) return;

  const isHidden = body.classList.toggle('is-hidden');
  if (btn) {
    const arrow = btn.querySelector('.dock-arrow');
    const hint = btn.querySelector('.dock-status-hint');
    if (arrow) arrow.textContent = isHidden ? '▴' : '▾';
    if (hint) hint.textContent = isHidden ? '(کلیک یا کلید D برای نمایش)' : '(کلیک یا کلید D برای مخفی‌سازی)';
    btn.classList.toggle('is-collapsed-btn', isHidden);
  }

  // Toggle expanded-full on the corresponding map/board container
  if (role === 'war') {
    const mapContainer = document.getElementById('war-map-container');
    if (mapContainer) {
      mapContainer.classList.toggle('expanded-full', isHidden);
      if (typeof renderHexMap === 'function') {
        setTimeout(renderHexMap, 50);
      }
    }
  } else if (role === 'econ') {
    const flowerContainer = document.getElementById('econ-flower-board-container');
    if (flowerContainer) {
      flowerContainer.classList.toggle('expanded-full', isHidden);
      if (typeof renderFlowerSvg === 'function') {
        setTimeout(renderFlowerSvg, 50);
      }
    }
  }
};

/* ==========================================================================
   COMMS SIDEBAR COLLAPSE / HIDE
   ========================================================================== */
window.toggleCommsSidebar = function() {
  const commsPanel = document.querySelector('.comms-panel');
  if (!commsPanel) return;

  const isCollapsed = commsPanel.classList.toggle('collapsed');
  const toggleBtn = document.getElementById('btn-toggle-comms');
  const toggleText = document.getElementById('comms-toggle-text');
  const unreadDot = document.getElementById('comms-unread-dot');
  const dockUnreadDot = document.getElementById('dock-unread-dot');
  const dockTab = document.getElementById('btn-comms-dock-tab');

  if (toggleText) {
    toggleText.textContent = isCollapsed ? 'باز کردن چت و ویس' : 'بستن چت و ویس';
  }
  if (toggleBtn) {
    toggleBtn.title = isCollapsed ? 'باز کردن سایدبار گفتگو و ویس (کلید C)' : 'بستن سایدبار گفتگو و ویس (کلید C)';
  }

  if (dockTab) {
    dockTab.classList.toggle('visible', isCollapsed);
  }

  if (!isCollapsed) {
    if (unreadDot) unreadDot.classList.add('hidden');
    if (dockUnreadDot) dockUnreadDot.classList.add('hidden');
  }

  // Trigger resize re-render of map / flower board so they fill the new horizontal space
  setTimeout(() => {
    if (typeof renderHexMap === 'function') renderHexMap();
    if (typeof renderFlowerSvg === 'function') renderFlowerSvg();
  }, 350);
};

// Event listeners for closing & opening comms panel
document.getElementById('btn-toggle-comms')?.addEventListener('click', window.toggleCommsSidebar);
document.getElementById('btn-comms-collapse')?.addEventListener('click', window.toggleCommsSidebar);
document.getElementById('btn-comms-close-panel')?.addEventListener('click', window.toggleCommsSidebar);
document.getElementById('btn-comms-dock-tab')?.addEventListener('click', window.toggleCommsSidebar);

// Voice sub-panel collapsible toggle
document.getElementById('btn-toggle-voice-widget')?.addEventListener('click', () => {
  const voiceWidget = document.getElementById('voice-chat-widget');
  if (voiceWidget) {
    voiceWidget.classList.toggle('compact-voice');
  }
});

/* ==========================================================================
   GLOBAL KEYBOARD SHORTCUTS (D = Toggle Dashboard, C = Toggle Comms)
   ========================================================================== */
document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

  if (e.key === 'd' || e.key === 'D' || e.key === 'ی') {
    window.toggleBottomDashboard();
  } else if (e.key === 'c' || e.key === 'C' || e.key === 'ژ') {
    window.toggleCommsSidebar();
  }
});
