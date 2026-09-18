// public/js/presidentApp.js
// President Dashboard: 10-Tier Technology Lab, Espionage Archives & Treasury Management

let latestSolvedPuzzle = null;

function initPresidentApp() {
  setupPresidentEventListeners();
  updatePresidentUI();
}

function copyToClipboard(text, successMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg, 'success');
    }).catch(() => {
      fallbackCopy(text, successMsg);
    });
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast(successMsg, 'success');
  } catch (err) {
    showToast('خطا در کپی متن.', 'error');
  }
  document.body.removeChild(ta);
}

function copySolvedCode(level, answer) {
  const tradePitch = `[اطلاعات محرمانه] رمز معمای فناوری سطح ${level}: ${answer}`;
  copyToClipboard(tradePitch, `📋 رمز سطح ${level} کپی شد: "${answer}" (آماده برای فروش در چت دیپلماسی)`);
}

function setupPresidentEventListeners() {
  const btnUnlock = document.getElementById('btn-unlock-puzzle');
  const btnSubmit = document.getElementById('btn-submit-puzzle');
  const btnCopyCurrent = document.getElementById('btn-copy-current-code');
  const btnTransfer = document.getElementById('btn-transfer-coins');

  if (btnUnlock) {
    btnUnlock.addEventListener('click', () => {
      socket.emit('unlock_puzzle', { countryId: myPlayer.countryId }, res => {
        if (res.success) {
          showToast('معمای فناوری بارگذاری شد.', 'success');
          renderTechPuzzle(res.puzzle);
        } else {
          showToast(res.error, 'error');
        }
      });
    });
  }

  if (btnSubmit) {
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
            latestSolvedPuzzle = res.solvedPuzzle;
            const toolPriceStr = (res.toolPrice || getToolPrice(res.newLevel)).toLocaleString('fa-IR');
            showToast(`🎉 پاسخ کاملاً صحیح بود! سطح فناوری به ${res.newLevel} ارتقا یافت (ضریب ارتش: ${res.multiplier}× | قیمت خرید ابزار: ${toolPriceStr} سکه). ۲٬۰۰۰ سکه برای ثبت کسر شد.`, 'success');
            input.value = '';
            
            if (btnCopyCurrent && latestSolvedPuzzle) {
              btnCopyCurrent.classList.remove('hidden');
              btnCopyCurrent.textContent = `📋 کپی رمز سطح ${latestSolvedPuzzle.level} (${latestSolvedPuzzle.answer}) برای فروش`;
            }
            
            if (res.nextPuzzle) {
              renderTechPuzzle(res.nextPuzzle);
            } else if (res.newLevel > 10) {
              renderTechPuzzle(null);
            }
          } else {
            showToast(res.message || 'پاسخ نادرست بود! ۲٬۰۰۰ سکه از خزانه کسر شد.', 'error');
          }
        } else {
          showToast(res.error, 'error');
        }
      });
    });
  }

  if (btnCopyCurrent) {
    btnCopyCurrent.addEventListener('click', () => {
      if (latestSolvedPuzzle) {
        copySolvedCode(latestSolvedPuzzle.level, latestSolvedPuzzle.answer);
      }
    });
  }

  if (btnTransfer) {
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
          showToast(`${amount.toLocaleString('fa-IR')} سکه با موفقیت به خزانه ${toCountryId} انتقال یافت.`, 'success');
        } else {
          showToast(res.error, 'error');
        }
      });
    });
  }

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
          showToast(`✅ ${amount.toLocaleString('fa-IR')} سکه به وزیر جنگ اختصاص یافت.`, 'success');
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
          showToast(`↩️ ${amount.toLocaleString('fa-IR')} سکه از وزیر جنگ به خزانه بازگشت.`, 'info');
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
          showToast(`✅ ${amount.toLocaleString('fa-IR')} سکه به وزیر اقتصاد اختصاص یافت.`, 'success');
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
          showToast(`↩️ ${amount.toLocaleString('fa-IR')} سکه از وزیر اقتصاد به خزانه بازگشت.`, 'info');
        } else {
          showToast(res.error, 'error');
        }
      });
    });
  }
}

// Render dynamic graphical puzzle interfaces
function renderTechPuzzle(puzzle) {
  const lockedState = document.getElementById('puzzle-locked-state');
  const activeState = document.getElementById('puzzle-active-state');
  const maxLevelState = document.getElementById('puzzle-max-level');
  const iconEl = document.getElementById('puzzle-icon');
  const titleEl = document.getElementById('puzzle-level-title');
  const badgeEl = document.getElementById('puzzle-level-badge');
  const phaseTagEl = document.getElementById('tech-phase-tag');
  const promptEl = document.getElementById('puzzle-prompt-text');
  const interactiveArea = document.getElementById('puzzle-interactive-area');
  const answerInput = document.getElementById('puzzle-answer-input');

  if (!puzzle) {
    if (activeState) activeState.classList.add('hidden');
    if (lockedState) lockedState.classList.add('hidden');
    if (maxLevelState) maxLevelState.classList.remove('hidden');
    return;
  }

  if (maxLevelState) maxLevelState.classList.add('hidden');
  if (lockedState) lockedState.classList.add('hidden');
  if (activeState) activeState.classList.remove('hidden');

  if (iconEl) iconEl.textContent = puzzle.icon || '⚡';
  if (titleEl) titleEl.textContent = `سطح ${puzzle.level}: ${puzzle.title}`;
  if (badgeEl) badgeEl.textContent = `سطح ${puzzle.level} از ۱۰`;
  if (phaseTagEl) phaseTagEl.textContent = puzzle.phaseName || 'فاز تحقیقات استراتژیک';
  if (promptEl) promptEl.textContent = puzzle.prompt;
  if (answerInput) {
    answerInput.placeholder = puzzle.placeholder || 'پاسخ را وارد کنید...';
  }

  if (!interactiveArea) return;
  interactiveArea.innerHTML = '';

  const vData = puzzle.visualData;
  if (!vData) return;

  switch (puzzle.visualType) {
    case 'grid3x3': {
      // 3x3 Grid with col sums and row sums
      let tableHtml = `
        <div style="display: inline-block; background: rgba(2, 6, 23, 0.7); padding: 16px; border-radius: 12px; border: 1px solid rgba(56, 189, 248, 0.3);">
          <table style="border-collapse: collapse; margin: 0 auto; text-align: center; font-family: monospace;">
            <tr>
              <th style="padding: 6px 12px; color: #64748b; font-size: 0.75rem;">مجموع ستون ⬇️</th>
              <th style="padding: 6px 12px; color: #38bdf8; font-weight: bold; border-bottom: 2px solid #38bdf8;">${vData.colSums[0]}</th>
              <th style="padding: 6px 12px; color: #38bdf8; font-weight: bold; border-bottom: 2px solid #38bdf8;">${vData.colSums[1]}</th>
              <th style="padding: 6px 12px; color: #38bdf8; font-weight: bold; border-bottom: 2px solid #38bdf8;">${vData.colSums[2]}</th>
              <th></th>
            </tr>
      `;
      vData.grid.forEach((row, r) => {
        tableHtml += `<tr><td style="padding: 6px 12px; color: #64748b; font-size: 0.8rem;">سطر ${r + 1}</td>`;
        row.forEach(cell => {
          const isUnknown = ['X', 'Y', 'Z'].includes(cell);
          const cellStyle = isUnknown 
            ? 'background: rgba(245, 158, 11, 0.25); color: #fbbf24; font-weight: 800; font-size: 1.2rem; border: 2px solid #f59e0b; border-radius: 6px;'
            : 'background: rgba(30, 41, 59, 0.8); color: #f8fafc; font-size: 1.1rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;';
          tableHtml += `<td style="padding: 12px 18px; ${cellStyle}">${cell}</td>`;
        });
        tableHtml += `<td style="padding: 6px 14px; color: #34d399; font-weight: bold; border-right: 2px solid #10b981; font-size: 1rem;">= ${vData.rowSums[r]}</td></tr>`;
      });
      tableHtml += `
          </table>
          <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 10px; text-align: center;">
            فرمت پاسخ: <strong style="color: #fbbf24;">X-Y-Z</strong> (مثال: 4-7-2)
          </div>
        </div>
      `;
      interactiveArea.innerHTML = tableHtml;
      break;
    }

    case 'mastermind': {
      // 3 Signal rows with green / yellow indicators
      let mmHtml = `
        <div style="display: flex; flex-direction: column; gap: 10px; max-width: 480px; margin: 0 auto; background: rgba(2, 6, 23, 0.7); padding: 14px; border-radius: 10px; border: 1px solid rgba(56, 189, 248, 0.25);">
      `;
      vData.clues.forEach((clue, idx) => {
        mmHtml += `
          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(15, 23, 42, 0.8); padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
            <div style="font-size: 0.85rem; color: #94a3b8;">سیگنال ${idx + 1}:</div>
            <div style="display: flex; gap: 6px; font-family: monospace; font-size: 1.2rem; font-weight: bold; letter-spacing: 4px; color: #38bdf8; background: #090d16; padding: 4px 10px; border-radius: 6px;">
              ${clue.guess}
            </div>
            <div style="display: flex; gap: 8px;">
              <span style="background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; font-size: 0.78rem; padding: 2px 8px; border-radius: 6px;">
                🟢 ${clue.green} دقیق
              </span>
              <span style="background: rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; color: #fbbf24; font-size: 0.78rem; padding: 2px 8px; border-radius: 6px;">
                🟡 ${clue.yellow} جابجا
              </span>
            </div>
          </div>
        `;
      });
      mmHtml += `
          <div style="display: flex; justify-content: space-around; font-size: 0.78rem; color: #64748b; margin-top: 4px;">
            <span>🟢 سبز: رقم و جایگاه کاملاً درست</span>
            <span>🟡 زرد: رقم در رمز وجود دارد ولی جایش غلط است</span>
          </div>
        </div>
      `;
      interactiveArea.innerHTML = mmHtml;
      break;
    }

    case 'equation': {
      // 2 equations
      let eqHtml = `
        <div style="display: flex; flex-direction: column; gap: 10px; max-width: 420px; margin: 0 auto; text-align: center;">
          <div style="background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 10px; padding: 14px;">
            <div style="font-family: monospace; font-size: 1.25rem; font-weight: bold; color: #c084fc; margin-bottom: 8px;">
              ${vData.equations[0]}
            </div>
            <div style="font-family: monospace; font-size: 1.25rem; font-weight: bold; color: #c084fc;">
              ${vData.equations[1]}
            </div>
          </div>
          <div style="font-size: 0.85rem; color: #94a3b8;">
            کاتالیزورهای مجهول را به فرمت <strong style="color: #38bdf8;">X-Y</strong> وارد کنید (مثال: 3-5).
          </div>
        </div>
      `;
      interactiveArea.innerHTML = eqHtml;
      break;
    }

    case 'networkGraph': {
      // 5 Stations graph
      let gHtml = `
        <div style="background: rgba(2, 6, 23, 0.7); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 12px; padding: 16px; max-width: 520px; margin: 0 auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;">
            <span style="font-size: 0.85rem; color: #94a3b8;">مبدا: <strong>A</strong> ➔ مقصد: <strong>E</strong></span>
            <span style="background: rgba(56, 189, 248, 0.2); border: 1px solid #38bdf8; color: #38bdf8; font-weight: bold; font-size: 0.85rem; padding: 2px 10px; border-radius: 10px;">
              فرکانس هدف: ${vData.targetBandwidth} GHz
            </span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; font-family: monospace;">
      `;
      vData.edges.forEach(e => {
        gHtml += `
          <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #f1f5f9; font-weight: bold;">${e.from} ➔ ${e.to}</span>
            <span style="color: #38bdf8; font-weight: bold;">${e.bw} G</span>
          </div>
        `;
      });
      gHtml += `
          </div>
          <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 10px; text-align: center;">
            مسیر پیوسته از A به E که مجموع پهنای باند آن دقیقاً برابر ${vData.targetBandwidth} باشد را تایپ کنید (مثال: ABDE).
          </div>
        </div>
      `;
      interactiveArea.innerHTML = gHtml;
      break;
    }

    case 'enigma': {
      // Enigma Cipher
      let enHtml = `
        <div style="background: rgba(2, 6, 23, 0.7); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 16px; max-width: 440px; margin: 0 auto; text-align: center;">
          <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 8px;">پیام رمزشده مخابراتی نظامی:</div>
          <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 14px;">
      `;
      for (let char of vData.cipher) {
        enHtml += `
          <div style="width: 44px; height: 50px; background: #090d16; border: 2px solid #a855f7; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: bold; color: #c084fc; font-family: monospace;">
            ${char}
          </div>
        `;
      }
      enHtml += `
          </div>
          <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 12px;">
      `;
      vData.rotors.forEach(r => {
        enHtml += `
          <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px 8px; font-size: 0.75rem; color: #cbd5e1;">
            روتور ${r.rotor}: <strong style="color: #38bdf8;">${r.shift}-</strong>
          </div>
        `;
      });
      enHtml += `
          </div>
          <div style="font-size: 0.8rem; color: #94a3b8;">
            ${vData.hint}
          </div>
        </div>
      `;
      interactiveArea.innerHTML = enHtml;
      break;
    }

    case 'fluxVector': {
      // Vector Compass
      let flHtml = `
        <div style="background: rgba(2, 6, 23, 0.7); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 12px; padding: 16px; max-width: 380px; margin: 0 auto; text-align: center;">
          <div style="display: flex; justify-content: center; margin-bottom: 8px;">
            <div style="background: rgba(30, 41, 59, 0.9); border: 1px solid #38bdf8; border-radius: 8px; padding: 8px 16px;">
              ⬆️ شمال (N): <strong style="color: #38bdf8;">${vData.north} T</strong>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin: 12px 0;">
            <div style="background: rgba(30, 41, 59, 0.9); border: 1px solid #38bdf8; border-radius: 8px; padding: 8px 16px;">
              ⬅️ غرب (W): <strong style="color: #38bdf8;">${vData.west} T</strong>
            </div>
            <div style="font-size: 1.5rem; color: #f59e0b;">🛡️</div>
            <div style="background: rgba(245, 158, 11, 0.2); border: 2px dashed #f59e0b; border-radius: 8px; padding: 8px 16px; color: #fbbf24;">
              شرق (E): <strong>?</strong>
            </div>
          </div>
          <div style="display: flex; justify-content: center; margin-top: 8px;">
            <div style="background: rgba(245, 158, 11, 0.2); border: 2px dashed #f59e0b; border-radius: 8px; padding: 8px 16px; color: #fbbf24;">
              ⬇️ جنوب (S): <strong>?</strong>
            </div>
          </div>
          <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 12px;">
            فرمت پاسخ: <strong style="color: #fbbf24;">S-E</strong> (مقادیر لازم برای برقراری تعادل صفر)
          </div>
        </div>
      `;
      interactiveArea.innerHTML = flHtml;
      break;
    }

    case 'hexMatrix': {
      // Cyberpunk Hex 4x4 matrix
      let hxHtml = `
        <div style="display: flex; flex-direction: column; gap: 12px; background: rgba(2, 6, 23, 0.85); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 12px; padding: 16px; max-width: 480px; margin: 0 auto;">
          <table style="border-collapse: collapse; margin: 0 auto; font-family: monospace; font-size: 1.1rem; text-align: center;">
            <tr>
              <th></th>
              <th style="color: #64748b; font-size: 0.75rem; padding: 4px 8px;">C1</th>
              <th style="color: #64748b; font-size: 0.75rem; padding: 4px 8px;">C2</th>
              <th style="color: #64748b; font-size: 0.75rem; padding: 4px 8px;">C3</th>
              <th style="color: #64748b; font-size: 0.75rem; padding: 4px 8px;">C4</th>
            </tr>
      `;
      vData.matrix.forEach((row, r) => {
        hxHtml += `<tr><td style="color: #64748b; font-size: 0.75rem; padding: 4px 8px;">R${r + 1}</td>`;
        row.forEach(b => {
          hxHtml += `<td style="padding: 10px 14px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(56, 189, 248, 0.2); color: #38bdf8; font-weight: bold; border-radius: 4px;">${b}</td>`;
        });
        hxHtml += `</tr>`;
      });
      hxHtml += `
          </table>
          <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px; font-size: 0.82rem; color: #cbd5e1;">
            <div style="font-weight: bold; color: #f59e0b; margin-bottom: 4px;">مسیر نفوذ بافر:</div>
            <div>${vData.steps[0]}</div>
            <div>${vData.steps[1]}</div>
            <div>${vData.steps[2]}</div>
          </div>
          <div style="font-size: 0.8rem; color: #94a3b8; text-align: center;">
            فرمت پاسخ: <strong style="color: #38bdf8;">XX-YY-ZZ</strong> (مثال: 1C-55-BD)
          </div>
        </div>
      `;
      interactiveArea.innerHTML = hxHtml;
      break;
    }

    case 'centrifuge': {
      // Centrifuge periods
      let cfHtml = `
        <div style="background: rgba(2, 6, 23, 0.7); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 12px; padding: 16px; max-width: 440px; margin: 0 auto; text-align: center;">
          <div style="display: flex; justify-content: center; gap: 12px; margin-bottom: 12px;">
      `;
      vData.periods.forEach((p, idx) => {
        cfHtml += `
          <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 8px; padding: 10px 16px;">
            <div style="font-size: 1.2rem; margin-bottom: 2px;">⚛️</div>
            <div style="font-size: 0.75rem; color: #94a3b8;">روتور ${idx + 1}</div>
            <div style="font-size: 1.2rem; font-weight: bold; color: #c084fc; font-family: monospace;">${p} ثانیه</div>
          </div>
        `;
      });
      cfHtml += `
          </div>
          <div style="font-size: 0.85rem; color: #94a3b8;">
            کوچکترین مضرب مشترک (ک.م.م) برای رزونانس همزمان را به صورت یک عدد وارد کنید (مثال: 60).
          </div>
        </div>
      `;
      interactiveArea.innerHTML = cfHtml;
      break;
    }

    case 'triangulation': {
      // Triangulation strike
      let trHtml = `
        <div style="background: rgba(2, 6, 23, 0.7); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 12px; padding: 16px; max-width: 440px; margin: 0 auto;">
          <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
            <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px; display: flex; justify-content: space-between;">
              <span style="color: #f87171;">📡 دکل غربی:</span>
              <strong style="color: #fff; font-family: monospace;">${vData.radarWest}</strong>
            </div>
            <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px; display: flex; justify-content: space-between;">
              <span style="color: #f87171;">📡 دکل جنوبی:</span>
              <strong style="color: #fff; font-family: monospace;">${vData.radarSouth}</strong>
            </div>
          </div>
          <div style="font-size: 0.85rem; color: #94a3b8; text-align: center;">
            مختصات دقیق مرکز پرتاب را به فرمت <strong style="color: #f87171;">X-Y</strong> وارد کنید (مثال: 42-88).
          </div>
        </div>
      `;
      interactiveArea.innerHTML = trHtml;
      break;
    }

    case 'omegaCore': {
      // Omega AI Core
      let omHtml = `
        <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(88, 28, 135, 0.3)); border: 2px solid #a855f7; border-radius: 12px; padding: 20px; max-width: 460px; margin: 0 auto; text-align: center;">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">🤖</div>
          <div style="font-size: 1.1rem; font-weight: bold; color: #c084fc; margin-bottom: 8px;">هسته مرکزی هوش مصنوعی نظامی امگا</div>
          <div style="font-family: monospace; font-size: 1.3rem; letter-spacing: 3px; color: #facc15; background: rgba(0,0,0,0.5); padding: 8px; border-radius: 6px; border: 1px dashed #f59e0b; margin-bottom: 12px;">
            ${vData.format}
          </div>
          <div style="font-size: 0.85rem; color: #cbd5e1;">
            کد امنیتی فوق را دقیقاً به همین صورت تایپ کنید تا آخرین و قدرتمندترین ارتقای بازی فعال شود.
          </div>
        </div>
      `;
      interactiveArea.innerHTML = omHtml;
      break;
    }

    default:
      interactiveArea.innerHTML = `<div style="color: #cbd5e1;">${puzzle.prompt}</div>`;
      break;
  }
}

// Tool price discounts
function getToolPrice(techLevel = 1) {
  let discount = 0;
  if (techLevel >= 2) discount += 1000;
  if (techLevel >= 5) discount += 1000;
  if (techLevel >= 7) discount += 1000;
  if (techLevel >= 10) discount += 1000;
  return Math.max(1000, 5000 - discount);
}

function updatePresidentUI() {
  if (!currentRoom || !myPlayer.countryId) return;
  const country = currentRoom.countries[myPlayer.countryId];
  if (!country) return;

  const techLvl = country.techLevel || 1;
  const presTechLevelEl = document.getElementById('pres-tech-level');
  const presTechMultEl = document.getElementById('pres-tech-mult');
  const presToolPriceEl = document.getElementById('pres-tool-price');

  if (presTechLevelEl) presTechLevelEl.textContent = techLvl;
  if (presTechMultEl) presTechMultEl.textContent = (country.techMultiplier || 1.0).toFixed(1) + '×';
  if (presToolPriceEl) presToolPriceEl.textContent = getToolPrice(techLvl).toLocaleString('fa-IR');

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

  // Render Solved Puzzles Archive (For diplomatic trading & selling)
  const archiveList = document.getElementById('tech-solved-archive-list');
  if (archiveList) {
    const solved = country.solvedPuzzles || [];
    if (solved.length === 0) {
      archiveList.innerHTML = `
        <div style="color: #64748b; font-size: 0.85rem; font-style: italic; padding: 10px; text-align: center; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
          هنوز هیچ مرحله‌ای حل نشده است. پس از حل اولین پازل، کد محرمانه آن برای فروش در اینجا ذخیره می‌شود.
        </div>
      `;
    } else {
      archiveList.innerHTML = '';
      solved.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.style.cssText = `display: flex; align-items: center; justify-content: space-between; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; padding: 10px 14px; gap: 10px; flex-wrap: wrap;`;
        itemEl.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="background: rgba(168, 85, 247, 0.2); color: #c084fc; font-size: 0.8rem; font-weight: bold; padding: 2px 8px; border-radius: 6px;">سطح ${item.level}</span>
            <span style="font-size: 0.9rem; color: #f1f5f9;">${item.title}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <code style="color: #38bdf8; font-weight: bold; background: #090d16; padding: 4px 10px; border-radius: 6px; font-family: monospace; letter-spacing: 1px;">${item.answer}</code>
            <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem; white-space: nowrap; border-color: #a855f7; color: #c084fc;">
              📋 کپی جهت فروش
            </button>
          </div>
        `;
        itemEl.querySelector('button').addEventListener('click', () => {
          copySolvedCode(item.level, item.answer);
        });
        archiveList.appendChild(itemEl);
      });
    }
  }

  // Render current active puzzle
  renderTechPuzzle(country.currentPuzzle);
}

if (typeof window !== 'undefined') {
  window.copySolvedCode = copySolvedCode;
}

