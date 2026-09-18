// public/js/presidentApp.js
// President Dashboard: Tech Puzzles & Treasury Management

function initPresidentApp() {
  setupPresidentEventListeners();
  updatePresidentUI();
}

function setupPresidentEventListeners() {
  const btnUnlock = document.getElementById('btn-unlock-puzzle');
  const btnSubmit = document.getElementById('btn-submit-puzzle');
  const btnTransfer = document.getElementById('btn-transfer-coins');

  btnUnlock.addEventListener('click', () => {
    socket.emit('unlock_puzzle', { countryId: myPlayer.countryId }, res => {
      if (res.success) {
        showToast('پازل فناوری با ۵۰۰۰ سکه باز شد!', 'success');
        renderTechPuzzle(res.puzzle);
      } else {
        showToast(res.error, 'error');
      }
    });
  });

  btnSubmit.addEventListener('click', () => {
    const input = document.getElementById('puzzle-answer-input');
    const answer = input.value.trim();
    if (!answer) {
      showToast('لطفاً پاسخ را وارد کنید.', 'error');
      return;
    }
    socket.emit('submit_puzzle', { countryId: myPlayer.countryId, answer }, res => {
      if (res.success) {
        if (res.isCorrect) {
          showToast(`پاسخ صحیح بود! فناوری کشور به سطح ${res.newLevel} و ضریب ${res.multiplier}× ارتقا یافت.`, 'success');
          input.value = '';
        } else {
          showToast(res.message, 'error');
        }
      } else {
        showToast(res.error, 'error');
      }
    });
  });

  btnTransfer.addEventListener('click', () => {
    const targetSelect = document.getElementById('transfer-target-country');
    const amountInput = document.getElementById('transfer-amount');
    const toCountryId = targetSelect.value;
    const amount = parseInt(amountInput.value, 10) || 0;

    if (!toCountryId || amount <= 0) {
      showToast('مقدار معتبر وارد کنید.', 'error');
      return;
    }

    socket.emit('transfer_coins', {
      fromCountryId: myPlayer.countryId,
      toCountryId,
      amount
    }, res => {
      if (res.success) {
        showToast(`${amount} سکه با موفقیت به خزانه ${toCountryId} انتقال یافت.`, 'success');
      } else {
        showToast(res.error, 'error');
      }
    });
  });

  // Ministry Budget Allocation Events (President Only)
  const btnAllocWar = document.getElementById('btn-allocate-war');
  const btnReclaimWar = document.getElementById('btn-reclaim-war');
  const btnAllocEcon = document.getElementById('btn-allocate-econ');
  const btnReclaimEcon = document.getElementById('btn-reclaim-econ');

  if (btnAllocWar) {
    btnAllocWar.addEventListener('click', () => {
      const amount = parseInt(document.getElementById('input-allocate-war').value, 10) || 0;
      if (amount <= 0) { showToast('مبلغ معتبر وارد کنید.', 'error'); return; }
      socket.emit('allocate_ministry_budget', { countryId: myPlayer.countryId, ministry: 'war', amount }, res => {
        if (res.success) {
          showToast(`✅ ${amount.toLocaleString()} سکه به وزیر جنگ اختصاص یافت.`, 'success');
        } else {
          showToast(res.error, 'error');
        }
      });
    });
  }

  if (btnReclaimWar) {
    btnReclaimWar.addEventListener('click', () => {
      const amount = parseInt(document.getElementById('input-allocate-war').value, 10) || 0;
      if (amount <= 0) { showToast('مبلغ معتبر وارد کنید.', 'error'); return; }
      socket.emit('reclaim_ministry_budget', { countryId: myPlayer.countryId, ministry: 'war', amount }, res => {
        if (res.success) {
          showToast(`↩️ ${amount.toLocaleString()} سکه از وزیر جنگ به خزانه بازگشت.`, 'info');
        } else {
          showToast(res.error, 'error');
        }
      });
    });
  }

  if (btnAllocEcon) {
    btnAllocEcon.addEventListener('click', () => {
      const amount = parseInt(document.getElementById('input-allocate-econ').value, 10) || 0;
      if (amount <= 0) { showToast('مبلغ معتبر وارد کنید.', 'error'); return; }
      socket.emit('allocate_ministry_budget', { countryId: myPlayer.countryId, ministry: 'economy', amount }, res => {
        if (res.success) {
          showToast(`✅ ${amount.toLocaleString()} سکه به وزیر اقتصاد اختصاص یافت.`, 'success');
        } else {
          showToast(res.error, 'error');
        }
      });
    });
  }

  if (btnReclaimEcon) {
    btnReclaimEcon.addEventListener('click', () => {
      const amount = parseInt(document.getElementById('input-allocate-econ').value, 10) || 0;
      if (amount <= 0) { showToast('مبلغ معتبر وارد کنید.', 'error'); return; }
      socket.emit('reclaim_ministry_budget', { countryId: myPlayer.countryId, ministry: 'economy', amount }, res => {
        if (res.success) {
          showToast(`↩️ ${amount.toLocaleString()} سکه از وزیر اقتصاد به خزانه بازگشت.`, 'info');
        } else {
          showToast(res.error, 'error');
        }
      });
    });
  }
}

function renderTechPuzzle(puzzle) {
  const lockedState = document.getElementById('puzzle-locked-state');
  const activeState = document.getElementById('puzzle-active-state');
  const promptText = document.getElementById('puzzle-prompt-text');

  lockedState.classList.add('hidden');
  activeState.classList.remove('hidden');

  promptText.innerHTML = `
    <strong>[سطح ${puzzle.level}] ${puzzle.prompt}</strong>
    ${puzzle.type === 'memory' ? `<div style="font-size: 1.5rem; font-weight: 800; letter-spacing: 5px; color: #facc15; margin-top: 10px;">${puzzle.sequence}</div>` : ''}
    ${puzzle.type === 'circuit' ? `<div style="display: flex; gap: 10px; justify-content: center; margin-top: 12px; flex-wrap: wrap;">
      <span class="stat-badge" style="border-color: #38bdf8; font-family: monospace;">گره ۱ ⚡</span>
      <span class="stat-badge" style="border-color: #38bdf8; font-family: monospace;">گره ۲ ⚡</span>
      <span class="stat-badge" style="border-color: #38bdf8; font-family: monospace;">گره ۳ ⚡</span>
      <span class="stat-badge" style="border-color: #38bdf8; font-family: monospace;">گره ۴ ⚡</span>
    </div>` : ''}
  `;
}

function updatePresidentUI() {
  if (!currentRoom || !myPlayer.countryId) return;
  const country = currentRoom.countries[myPlayer.countryId];
  if (!country) return;

  document.getElementById('pres-tech-level').textContent = country.techLevel;
  document.getElementById('pres-tech-mult').textContent = country.techMultiplier.toFixed(1) + '×';

  // Update ministry budget displays
  const warBudgetEl = document.getElementById('pres-display-war-budget');
  const econBudgetEl = document.getElementById('pres-display-econ-budget');
  if (warBudgetEl) warBudgetEl.textContent = (country.warBudget || 0).toLocaleString('fa-IR') + ' سکه';
  if (econBudgetEl) econBudgetEl.textContent = (country.econBudget || 0).toLocaleString('fa-IR') + ' سکه';

  // Target country select for external coin transfer
  const select = document.getElementById('transfer-target-country');
  if (select) {
    select.innerHTML = '';
    Object.values(currentRoom.countries).forEach(c => {
      if (c.id !== myPlayer.countryId && !c.isEliminated) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.id})`;
        select.appendChild(opt);
      }
    });
  }

  // Bilateral Secret President Hotline List
  const dipList = document.getElementById('president-diplomacy-list');
  if (dipList) {
    dipList.innerHTML = '';
    Object.values(currentRoom.countries).forEach(c => {
      if (c.id !== myPlayer.countryId && !c.isEliminated) {
        const presPlayer = c.players.president;
        const presName = presPlayer ? presPlayer.username : 'بدون بازیکن';
        const pairId = [myPlayer.countryId, c.id].sort().join('_');
        const channelSecretId = `pres_secret_${pairId}`;

        const card = document.createElement('div');
        card.style.cssText = `background: #0f172a; border: 1px solid ${c.color}; border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 240px; flex: 1;`;
        card.innerHTML = `
          <div>
            <div style="font-weight: bold; color: ${c.color};">کشور ${c.name}</div>
            <div style="font-size: 0.8rem; color: #94a3b8;">رئیس‌جمهور: <strong style="color: #f1f5f9;">${presName}</strong></div>
          </div>
          <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem; white-space: nowrap;">
            🔒 اتصال به خط امن
          </button>
        `;

        card.querySelector('button').addEventListener('click', () => {
          if (typeof switchChannel === 'function') {
            switchChannel(channelSecretId);
            showToast(`🔒 اتصال امن به خط رئیس‌جمهور ${c.name} (${presName}) برقرار شد.`, 'success');
          }
        });

        dipList.appendChild(card);
      }
    });
  }

  // Puzzle lock/unlock status
  const lockedState = document.getElementById('puzzle-locked-state');
  const activeState = document.getElementById('puzzle-active-state');
  if (country.puzzleUnlocked) {
    lockedState.classList.add('hidden');
    activeState.classList.remove('hidden');
    renderTechPuzzle(country.currentPuzzle);
  } else {
    lockedState.classList.remove('hidden');
    activeState.classList.add('hidden');
  }
}
