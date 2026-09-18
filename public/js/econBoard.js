// public/js/econBoard.js
// Interactive 6-Petal Geometric Flower Board (Inspired by physical board)

const PETAL_CONFIG = [
  { key: 'wheat', name: 'گندم', pair: 'bread', icon: '🌾', angle: 0 },
  { key: 'oven', name: 'کوره/تنور', pair: 'bread', icon: '🔥', angle: 60 },
  { key: 'brick', name: 'آجر', pair: 'building', icon: '🧱', angle: 120 },
  { key: 'crane', name: 'جرثقیل', pair: 'building', icon: '🏗️', angle: 180 },
  { key: 'cotton', name: 'پنبه', pair: 'clothes', icon: '☁️', angle: 240 },
  { key: 'sewing', name: 'چرخ خیاطی', pair: 'clothes', icon: '🧵', angle: 300 }
];

function calcTier(tokens) {
  if (tokens < 1) return 0;
  if (tokens < 4) return 1;
  if (tokens < 8) return 2;
  if (tokens < 12) return 3;
  return 4;
}

function initEconBoard() {
  renderFlowerSvg();
  setupEconEventListeners();
  initTradeHandlers();
}

function renderFlowerSvg() {
  const svg = document.getElementById('flower-svg');
  if (!svg) return;
  svg.innerHTML = '';

  const country = currentRoom ? currentRoom.countries[myPlayer.countryId] : null;
  const countryColor = country ? country.color : '#00f0ff';
  const petals = country ? country.economy.petals : {};

  // Background central polygon / 6-pointed star
  const starPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  let starPoints = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 - 90) * Math.PI / 180;
    const r = (i % 2 === 0) ? 90 : 45;
    starPoints.push(`${r * Math.cos(angle)},${r * Math.sin(angle)}`);
  }
  starPoly.setAttribute('points', starPoints.join(' '));
  starPoly.setAttribute('fill', '#070d1c');
  starPoly.setAttribute('stroke', countryColor);
  starPoly.setAttribute('stroke-width', '2.5');
  svg.appendChild(starPoly);

  // Render 6 Petals
  PETAL_CONFIG.forEach((p, idx) => {
    const petalGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const angleRad = (p.angle - 90) * Math.PI / 180;
    petalGroup.setAttribute('transform', `rotate(${p.angle})`);

    const pData = petals[p.key] || { toolTokens: 0, popTokens: 0 };
    const toolTier = calcTier(pData.toolTokens);
    const popTier = calcTier(pData.popTokens);
    const output = toolTier * popTier;

    // Petal Outer Curve (concentric arcs)
    const arcRadii = [140, 190, 240, 290];
    arcRadii.forEach((r, tierIdx) => {
      const tierNum = tierIdx + 1;
      const isToolActive = toolTier >= tierNum;
      const isPopActive = popTier >= tierNum;

      // Left Arc (Tools - Cyan)
      const leftArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const dLeft = `M 0,${-r} A ${r * 0.45} ${r * 0.45} 0 0,0 ${-r * 0.4},${-r * 0.65}`;
      leftArc.setAttribute('d', dLeft);
      leftArc.setAttribute('fill', 'none');
      leftArc.setAttribute('stroke', isToolActive ? '#00f0ff' : '#1e293b');
      leftArc.setAttribute('stroke-width', isToolActive ? '4' : '2');
      petalGroup.appendChild(leftArc);

      // Right Arc (Pop - Orange)
      const rightArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const dRight = `M 0,${-r} A ${r * 0.45} ${r * 0.45} 0 0,1 ${r * 0.4},${-r * 0.65}`;
      rightArc.setAttribute('d', dRight);
      rightArc.setAttribute('fill', 'none');
      rightArc.setAttribute('stroke', isPopActive ? '#fb923c' : '#1e293b');
      rightArc.setAttribute('stroke-width', isPopActive ? '4' : '2');
      petalGroup.appendChild(rightArc);
    });

    // Petal Center Divider Line
    const divider = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    divider.setAttribute('x1', '0');
    divider.setAttribute('y1', '-70');
    divider.setAttribute('x2', '0');
    divider.setAttribute('y2', '-310');
    divider.setAttribute('stroke', '#475569');
    divider.setAttribute('stroke-width', '1.5');
    divider.setAttribute('stroke-dasharray', '4,3');
    petalGroup.appendChild(divider);

    // Petal Title & Icon
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', '0');
    label.setAttribute('y', '-320');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#f1f5f9');
    label.setAttribute('font-size', '13');
    label.setAttribute('font-weight', '700');
    label.textContent = `${p.icon} ${p.name}`;
    petalGroup.appendChild(label);

    // Output Badge
    const outputCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    outputCircle.setAttribute('cx', '0');
    outputCircle.setAttribute('cy', '-110');
    outputCircle.setAttribute('r', '18');
    outputCircle.setAttribute('fill', output > 0 ? '#059669' : '#1f2937');
    outputCircle.setAttribute('stroke', '#10b981');
    outputCircle.setAttribute('stroke-width', '2');
    petalGroup.appendChild(outputCircle);

    const outputText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    outputText.setAttribute('x', '0');
    outputText.setAttribute('y', '-105');
    outputText.setAttribute('text-anchor', 'middle');
    outputText.setAttribute('fill', '#fff');
    outputText.setAttribute('font-size', '12');
    outputText.setAttribute('font-weight', 'bold');
    outputText.textContent = output;
    petalGroup.appendChild(outputText);

    // Tool Allocation Controls (Left Side)
    const toolBtnPlus = createSvgButton(-45, -170, '+ ابزار', '#06b6d4', () => modifyPetalTokens(p.key, 'tool', 1));
    const toolBtnMinus = createSvgButton(-45, -145, '- ابزار', '#0891b2', () => modifyPetalTokens(p.key, 'tool', -1));
    const toolCountText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    toolCountText.setAttribute('x', '-45');
    toolCountText.setAttribute('y', '-200');
    toolCountText.setAttribute('text-anchor', 'middle');
    toolCountText.setAttribute('fill', '#67e8f9');
    toolCountText.setAttribute('font-size', '11');
    toolCountText.textContent = `T${toolTier} (${pData.toolTokens})`;
    petalGroup.appendChild(toolCountText);

    // Pop Allocation Controls (Right Side)
    const popCountText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    popCountText.setAttribute('x', '45');
    popCountText.setAttribute('y', '-200');
    popCountText.setAttribute('text-anchor', 'middle');
    popCountText.setAttribute('fill', '#fdba74');
    popCountText.setAttribute('font-size', '11');
    popCountText.textContent = `P${popTier} (${pData.popTokens})`;
    petalGroup.appendChild(popCountText);

    // Only render interactive buttons for Minister of Economy
    if (myPlayer.role === 'economy') {
      const toolBtnPlus = createSvgButton(-45, -170, '+ ابزار', '#06b6d4', () => modifyPetalTokens(p.key, 'tool', 1));
      const toolBtnMinus = createSvgButton(-45, -145, '- ابزار', '#0891b2', () => modifyPetalTokens(p.key, 'tool', -1));
      petalGroup.appendChild(toolBtnPlus);
      petalGroup.appendChild(toolBtnMinus);

      const popBtnPlus = createSvgButton(45, -170, '+ جمعیت', '#f97316', () => modifyPetalTokens(p.key, 'pop', 1));
      const popBtnMinus = createSvgButton(45, -145, '- جمعیت', '#ea580c', () => modifyPetalTokens(p.key, 'pop', -1));
      petalGroup.appendChild(popBtnPlus);
      petalGroup.appendChild(popBtnMinus);
    }

    svg.appendChild(petalGroup);
  });

  // Center Emblem
  const centerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  centerText.setAttribute('x', '0');
  centerText.setAttribute('y', '5');
  centerText.setAttribute('text-anchor', 'middle');
  centerText.setAttribute('fill', countryColor || '#fef08a');
  centerText.setAttribute('font-size', '12');
  centerText.setAttribute('font-weight', 'bold');
  centerText.textContent = '🪙 خزانه و بورس ملی';
  svg.appendChild(centerText);

  updateEconUIStats();
}

function createSvgButton(x, y, text, color, onClick) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.style.cursor = 'pointer';
  g.addEventListener('click', onClick);

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', x - 22);
  rect.setAttribute('y', y - 10);
  rect.setAttribute('width', '44');
  rect.setAttribute('height', '18');
  rect.setAttribute('rx', '4');
  rect.setAttribute('fill', color);
  g.appendChild(rect);

  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', x);
  label.setAttribute('y', y + 3);
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('fill', '#fff');
  label.setAttribute('font-size', '9');
  label.setAttribute('font-weight', 'bold');
  label.textContent = text;
  g.appendChild(label);

  return g;
}

function modifyPetalTokens(petalKey, type, delta) {
  if (myPlayer.role !== 'economy') {
    showToast('تنها وزیر اقتصاد اختیار جابه‌جایی مهره‌ها را دارد.', 'error');
    return;
  }
  if (!currentRoom || currentRoom.phase !== 'morning') {
    showToast('جابه‌جایی مهره‌ها فقط در فاز صبح مجاز است.', 'error');
    return;
  }
  const country = currentRoom.countries[myPlayer.countryId];
  const p = country.economy.petals[petalKey];
  let newTool = p.toolTokens;
  let newPop = p.popTokens;

  if (type === 'tool') {
    newTool = Math.max(0, newTool + delta);
  } else {
    newPop = Math.max(0, newPop + delta);
  }

  socket.emit('update_petal', {
    countryId: myPlayer.countryId,
    petalKey,
    toolTokens: newTool,
    popTokens: newPop
  }, res => {
    if (!res.success) {
      showToast(res.error, 'error');
    }
  });
}

function setupEconEventListeners() {
  const btnBuyTool = document.getElementById('btn-buy-tool');
  const btnHarvest = document.getElementById('btn-harvest-products');

  btnBuyTool.addEventListener('click', () => {
    socket.emit('buy_tool', { countryId: myPlayer.countryId, count: 1 }, res => {
      if (res.success) {
        showToast('۱ ابزار دائمی خریداری شد.', 'success');
      } else {
        showToast(res.error, 'error');
      }
    });
  });

  if (btnHarvest) {
    btnHarvest.addEventListener('click', () => {
      socket.emit('sell_products', { countryId: myPlayer.countryId }, res => {
        if (res.success) {
          const p = res.produced;
          showToast(`برداشت انجام شد! 🌾${p.wheat} 🔥${p.oven} 🧱${p.brick} 🏗️${p.crane} ☁️${p.cotton} 🧵${p.sewing}`, 'success');
        } else {
          showToast(res.error, 'error');
        }
      });
    });
  }

  ['bread', 'building', 'clothes'].forEach(type => {
    const handleCraft = () => {
      socket.emit('craft_product', { countryId: myPlayer.countryId, productType: type }, res => {
        if (res.success) {
          showToast(`🛠️ ۱ واحد ${type === 'bread' ? 'نان' : type === 'building' ? 'ساختمان' : 'لباس'} برای انبار ساخته شد (موجودی: ${res.quantity})`, 'success');
        } else {
          showToast(res.error, 'error');
        }
      });
    };

    const craftBtnId = type === 'bread' ? 'btn-craft-bread' : type === 'building' ? 'btn-craft-building' : 'btn-craft-clothes';
    const craftBtn = document.getElementById(craftBtnId);
    if (craftBtn) craftBtn.addEventListener('click', handleCraft);

    const quickCraftBtn = document.getElementById(`btn-quick-craft-${type}`);
    if (quickCraftBtn) quickCraftBtn.addEventListener('click', handleCraft);

    const handleSell = () => {
      socket.emit('sell_product', { countryId: myPlayer.countryId, productType: type }, res => {
        if (res.success) {
          showToast(`✅ فروش ۱ ${type === 'bread' ? 'نان' : type === 'building' ? 'ساختمان' : 'لباس'} — درآمد: ${res.revenue} سکه به خزانه ملی واریز شد`, 'success');
        } else {
          showToast(res.error, 'error');
        }
      });
    };

    const sellBtnId = type === 'bread' ? 'btn-sell-bread' : type === 'building' ? 'btn-sell-building' : 'btn-sell-clothes';
    const sellBtn = document.getElementById(sellBtnId);
    if (sellBtn) sellBtn.addEventListener('click', handleSell);

    const quickSellBtn = document.getElementById(`btn-quick-sell-${type}`);
    if (quickSellBtn) quickSellBtn.addEventListener('click', handleSell);
  });

  const btnEconTransfer = document.getElementById('btn-econ-transfer');
  if (btnEconTransfer) {
    btnEconTransfer.addEventListener('click', () => {
      const targetSelect = document.getElementById('econ-transfer-target');
      const amountInput = document.getElementById('econ-transfer-amount');
      const targetCountryId = targetSelect ? targetSelect.value : '';
      const amount = parseInt(amountInput.value, 10) || 0;

      if (!targetCountryId || amount <= 0) {
        showToast('لطفاً مقصد و مبلغ معتبر وارد کنید.', 'error');
        return;
      }

      if (targetCountryId === 'treasury') {
        socket.emit('transfer_budget_to_treasury', {
          countryId: myPlayer.countryId,
          ministry: 'economy',
          amount
        }, res => {
          if (res && res.success) {
            showToast(`✅ مبلغ ${amount.toLocaleString('fa-IR')} سکه با موفقیت به خزانه ملی واریز شد.`, 'success');
          } else {
            showToast(res ? res.error : 'خطا در انتقال بودجه به خزانه ملی.', 'error');
          }
        });
        return;
      }

      if (currentRoom.phase !== 'morning' && currentRoom.phase !== 'night') {
        showToast('تقسیم و انتقال بودجه به سایر کشورها فقط در فاز صبح یا شب مجاز است.', 'error');
        return;
      }

      socket.emit('transfer_econ_budget', {
        countryId: myPlayer.countryId,
        targetCountryId,
        amount
      }, res => {
        if (res.success) {
          showToast(`${amount} سکه با موفقیت انتقال یافت.`, 'success');
        } else {
          showToast(res.error, 'error');
        }
      });
    });
  }
}

function updateEconUIStats() {
  if (!currentRoom || !myPlayer.countryId) return;
  const country = currentRoom.countries[myPlayer.countryId];
  if (!country) return;

  const econ = country.economy;
  const toolsEl = document.getElementById('econ-tools-inv');
  const popEl = document.getElementById('econ-pop-inv');
  const taxEl = document.getElementById('econ-unpaid-taxes');
  const econBudgetEl = document.getElementById('econ-budget-display');
  if (econBudgetEl) econBudgetEl.textContent = (country.econBudget || 0).toLocaleString('fa-IR');
  if (toolsEl) toolsEl.textContent = econ.toolsInventory;
  if (popEl) popEl.textContent = econ.populationInventory;
  if (taxEl) taxEl.textContent = econ.unpaidTaxes;

  // Individual raw resource display
  const rawResources = ['wheat', 'oven', 'brick', 'crane', 'cotton', 'sewing'];
  rawResources.forEach(key => {
    const el = document.getElementById(`storage-${key}`);
    if (el) el.textContent = econ.storage[key] || 0;
  });

  // Finished goods
  const breadEl = document.getElementById('storage-bread');
  const buildEl = document.getElementById('storage-building');
  const clothEl = document.getElementById('storage-clothes');
  if (breadEl) breadEl.textContent = econ.storage.bread || 0;
  if (buildEl) buildEl.textContent = econ.storage.building || 0;
  if (clothEl) clothEl.textContent = econ.storage.clothes || 0;

  // Floating Mini-Storage HUD
  const qBreadEl = document.getElementById('quick-storage-bread');
  const qBuildEl = document.getElementById('quick-storage-building');
  const qClothEl = document.getElementById('quick-storage-clothes');
  if (qBreadEl) qBreadEl.textContent = econ.storage.bread || 0;
  if (qBuildEl) qBuildEl.textContent = econ.storage.building || 0;
  if (qClothEl) qClothEl.textContent = econ.storage.clothes || 0;

  // Populate transfer targets
  const targetSelect = document.getElementById('econ-transfer-target');
  if (targetSelect) {
    const prevVal = targetSelect.value;
    targetSelect.innerHTML = '';

    // First and default option: National Treasury
    const treasuryOpt = document.createElement('option');
    treasuryOpt.value = 'treasury';
    treasuryOpt.textContent = '🏛️ خزانه ملی کشور خودمان';
    targetSelect.appendChild(treasuryOpt);

    Object.values(currentRoom.countries).forEach(c => {
      if (c.id !== myPlayer.countryId && !c.isEliminated) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `کشور ${c.name}`;
        targetSelect.appendChild(opt);
      }
    });

    if (prevVal && targetSelect.querySelector(`option[value="${prevVal}"]`)) {
      targetSelect.value = prevVal;
    }
  }

  // Populate trade targets (Including 'all' for broadcast to all nations)
  const tradeTargetSelect = document.getElementById('trade-target-country');
  if (tradeTargetSelect) {
    const prevVal = tradeTargetSelect.value;
    tradeTargetSelect.innerHTML = '';

    // Broadcast option
    const broadcastOpt = document.createElement('option');
    broadcastOpt.value = 'all';
    broadcastOpt.textContent = '📢 همه کشورها (پیشنهاد عمومی)';
    tradeTargetSelect.appendChild(broadcastOpt);

    // Individual countries
    Object.values(currentRoom.countries).forEach(c => {
      if (c.id !== myPlayer.countryId && !c.isEliminated) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `کشور ${c.name}`;
        tradeTargetSelect.appendChild(opt);
      }
    });

    if (prevVal && tradeTargetSelect.querySelector(`option[value="${prevVal}"]`)) {
      tradeTargetSelect.value = prevVal;
    }
  }
}

// Active incoming trades map for toast & modal
window.activeIncomingTrades = window.activeIncomingTrades || new Map();
let currentViewingTradeId = null;
let tradeHandlersInitialized = false;

function playTradeNotificationChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.12);
    gain2.gain.setValueAtTime(0.22, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch (e) {
    // Ignore audio error
  }
}

function updateTradeFormUI() {
  const inputTradeType = document.getElementById('trade-action-type');
  const targetCountrySelect = document.getElementById('trade-target-country');
  const targetCountryLabel = document.getElementById('trade-target-country-label');
  const tradeDesc = document.getElementById('trade-mode-desc');
  const btnPropose = document.getElementById('btn-propose-trade');

  const tradeType = inputTradeType ? inputTradeType.value : 'sell';
  const targetVal = targetCountrySelect ? targetCountrySelect.value : 'all';
  const isBroadcast = targetVal === 'all';

  if (targetCountryLabel) {
    if (isBroadcast) {
      targetCountryLabel.textContent = 'طرف معامله (عمومی):';
    } else {
      targetCountryLabel.textContent = tradeType === 'buy' ? 'کشور فروشنده (تأمین‌کننده):' : 'کشور خریدار (مقصد فروش):';
    }
  }

  if (tradeDesc) {
    if (tradeType === 'buy') {
      tradeDesc.textContent = isBroadcast
        ? '📢 درخواست عمومی خرید کالا: ارسال درخواست خرید به تمامی کشورها در ازای پرداخت سکه. اولین کشوری که آن را تأیید کند کالا را تحویل داده و سکه دریافت می‌کند.'
        : '📥 درخواست خرید کالا از کشور مشخص در ازای پرداخت سکه از خزانه ملی به آن‌ها. پس از تأیید طرف مقابل، کالا وارد انبار شما می‌شود.';
    } else {
      tradeDesc.textContent = isBroadcast
        ? '📢 پیشنهاد عمومی فروش کالا: انتشار پیشنهاد فروش کالا به تمامی کشورها در ازای دریافت سکه. اولین کشوری که آن را بپذیرد کالا را دریافت کرده و سکه پرداخت می‌کند.'
        : '📤 پیشنهاد فروش کالا از انبار خود به کشور مشخص در ازای دریافت سکه با قیمت توافقی. پس از تأیید طرف مقابل، کالا تحویل و سکه واریز می‌شود.';
    }
  }

  if (btnPropose) {
    if (isBroadcast) {
      btnPropose.textContent = tradeType === 'buy' ? '📢 انتشار درخواست خرید به همه' : '📢 انتشار پیشنهاد فروش به همه';
    } else {
      btnPropose.textContent = tradeType === 'buy' ? '📥 ارسال درخواست خرید' : '📤 ارسال پیشنهاد فروش';
    }
  }
}

// Trade system event handlers
function initTradeHandlers() {
  if (tradeHandlersInitialized) return;
  tradeHandlersInitialized = true;

  // Toggle Trade Action Mode (Sell vs Buy)
  const btnModeSell = document.getElementById('btn-trade-mode-sell');
  const btnModeBuy = document.getElementById('btn-trade-mode-buy');
  const inputTradeType = document.getElementById('trade-action-type');
  const targetCountrySelect = document.getElementById('trade-target-country');
  const btnPropose = document.getElementById('btn-propose-trade');

  if (btnModeSell && btnModeBuy) {
    btnModeSell.addEventListener('click', () => {
      btnModeSell.classList.add('active-trade-mode');
      btnModeBuy.classList.remove('active-trade-mode');
      if (inputTradeType) inputTradeType.value = 'sell';
      updateTradeFormUI();
    });

    btnModeBuy.addEventListener('click', () => {
      btnModeBuy.classList.add('active-trade-mode');
      btnModeSell.classList.remove('active-trade-mode');
      if (inputTradeType) inputTradeType.value = 'buy';
      updateTradeFormUI();
    });
  }

  if (targetCountrySelect) {
    targetCountrySelect.addEventListener('change', () => {
      updateTradeFormUI();
    });
  }

  // Submit Trade Proposal
  if (btnPropose) {
    btnPropose.addEventListener('click', () => {
      const toCountryId = document.getElementById('trade-target-country')?.value || 'all';
      const goodType = document.getElementById('trade-good-type')?.value;
      const quantity = parseInt(document.getElementById('trade-quantity')?.value) || 1;
      const price = parseInt(document.getElementById('trade-price')?.value) || 0;
      const tradeType = inputTradeType ? inputTradeType.value : 'sell';

      if (!toCountryId) { 
        showToast('لطفاً کشور طرف معامله را انتخاب کنید.', 'error'); 
        return; 
      }
      if (quantity <= 0 || price < 0) {
        showToast('تعداد یا مبلغ معامله نامعتبر است.', 'error');
        return;
      }

      socket.emit('propose_trade', {
        fromCountryId: myPlayer.countryId,
        toCountryId,
        goodType,
        quantity,
        price,
        tradeType
      }, res => {
        if (res && res.success) {
          const actionText = tradeType === 'buy' ? 'درخواست خرید' : 'پیشنهاد فروش';
          const targetText = toCountryId === 'all' ? 'همه کشورها' : `کشور ${toCountryId}`;
          showToast(`📬 ${actionText} کالا به ${targetText} ارسال شد.`, 'success');
        } else if (res) {
          showToast(res.error, 'error');
        }
      });
    });
  }

  // Bottom notification toast click handler
  const btnOpenToast = document.getElementById('btn-open-trade-modal');
  const bottomToast = document.getElementById('trade-bottom-toast');
  const btnDismissToast = document.getElementById('btn-dismiss-trade-toast');

  if (btnOpenToast) {
    btnOpenToast.addEventListener('click', (e) => {
      e.stopPropagation();
      const lastTradeId = Array.from(window.activeIncomingTrades.keys()).pop();
      if (lastTradeId) {
        window.openTradeDetailModal(lastTradeId);
      }
    });
  }

  if (bottomToast) {
    bottomToast.addEventListener('click', () => {
      const lastTradeId = Array.from(window.activeIncomingTrades.keys()).pop();
      if (lastTradeId) {
        window.openTradeDetailModal(lastTradeId);
      }
    });
  }

  if (btnDismissToast) {
    btnDismissToast.addEventListener('click', (e) => {
      e.stopPropagation();
      bottomToast?.classList.add('hidden');
    });
  }

  // Incoming trade proposals event (Sent to Economy Minister and President)
  socket.on('trade_proposed', trade => {
    // Proposer does not receive as incoming proposal
    if (trade.fromCountryId === myPlayer.countryId) return;

    // Must be targeted to us specifically or broadcast to 'all'
    if (trade.toCountryId !== 'all' && trade.toCountryId !== myPlayer.countryId) return;

    if (myPlayer.role !== 'economy' && myPlayer.role !== 'president') return;

    window.activeIncomingTrades.set(trade.id, trade);
    updateIncomingTradeUI(trade);
    playTradeNotificationChime();
  });

  // Trade accepted event
  socket.on('trade_accepted', trade => {
    window.activeIncomingTrades.delete(trade.id);
    document.getElementById(`trade_offer_${trade.id}`)?.remove();

    if (currentViewingTradeId === trade.id) {
      window.closeTradeModal();
    }
    updateBottomToastState();

    if (trade.fromCountryId === myPlayer.countryId) {
      const acceptedBy = currentRoom?.countries?.[trade.acceptedByCountryId]?.name || trade.acceptedByCountryId || 'مقابل';
      showToast(`🎉 معامله توسط کشور ${acceptedBy} تأیید شد و منابع مبادله گردید!`, 'success');
    } else if (trade.acceptedByCountryId === myPlayer.countryId) {
      showToast(`✅ معامله تجاری با موفقیت منعقد و انجام شد.`, 'success');
    } else if (trade.toCountryId === 'all') {
      showToast(`ℹ️ یک آگهی عمومی توسط کشور دیگری منعقد و بسته شد.`, 'info');
    }
  });

  // Trade rejected / cancelled event
  socket.on('trade_rejected', ({ tradeId, cancelledByProposer }) => {
    window.activeIncomingTrades.delete(tradeId);
    document.getElementById(`trade_offer_${tradeId}`)?.remove();

    if (currentViewingTradeId === tradeId) {
      window.closeTradeModal();
    }
    updateBottomToastState();

    if (cancelledByProposer) {
      showToast('یک آگهی معامله توسط فرستنده لغو گردید.', 'info');
    } else {
      showToast('پیشنهاد معامله رد شد.', 'info');
    }
  });

  // Trade dismissed locally
  socket.on('trade_dismissed', ({ tradeId }) => {
    window.activeIncomingTrades.delete(tradeId);
    document.getElementById(`trade_offer_${tradeId}`)?.remove();

    if (currentViewingTradeId === tradeId) {
      window.closeTradeModal();
    }
    updateBottomToastState();
    showToast('آگهی معامله بسته شد.', 'info');
  });

  // Run initial form UI update
  updateTradeFormUI();
}

function updateIncomingTradeUI(latestTrade) {
  const goodNames = { bread: 'نان 🍞', building: 'ساختمان 🏛️', clothes: 'لباس 👔' };
  const fromCountry = currentRoom?.countries?.[latestTrade.fromCountryId];
  const fromName = fromCountry ? fromCountry.name : latestTrade.fromCountryId;
  const isBuy = latestTrade.tradeType === 'buy';
  const isBroadcast = latestTrade.toCountryId === 'all';

  // 1. Update Floating Bottom Toast
  const bottomToast = document.getElementById('trade-bottom-toast');
  const toastBadge = document.getElementById('trade-toast-badge');
  const toastSummary = document.getElementById('trade-toast-summary');

  if (bottomToast && toastBadge && toastSummary) {
    if (isBroadcast) {
      toastBadge.textContent = isBuy ? '📢 درخواست خرید عمومی' : '📢 پیشنهاد فروش عمومی';
      toastBadge.style.background = isBuy ? '#2563eb' : '#7c3aed';
      toastSummary.textContent = isBuy
        ? `کشور ${fromName} به همه کشورها درخواست خرید ${latestTrade.quantity} ${goodNames[latestTrade.goodType]} به قیمت ${latestTrade.price.toLocaleString('fa-IR')} سکه داده است.`
        : `کشور ${fromName} به همه کشورها پیشنهاد فروش ${latestTrade.quantity} ${goodNames[latestTrade.goodType]} به قیمت ${latestTrade.price.toLocaleString('fa-IR')} سکه داده است.`;
    } else {
      if (isBuy) {
        toastBadge.textContent = '📥 درخواست خرید';
        toastBadge.style.background = '#2563eb';
        toastSummary.textContent = `کشور ${fromName} درخواست خرید ${latestTrade.quantity} ${goodNames[latestTrade.goodType]} به قیمت ${latestTrade.price.toLocaleString('fa-IR')} سکه دارد.`;
      } else {
        toastBadge.textContent = '📤 پیشنهاد فروش';
        toastBadge.style.background = '#7c3aed';
        toastSummary.textContent = `کشور ${fromName} پیشنهاد فروش ${latestTrade.quantity} ${goodNames[latestTrade.goodType]} به قیمت ${latestTrade.price.toLocaleString('fa-IR')} سکه دارد.`;
      }
    }
    bottomToast.classList.remove('hidden');
  }

  // 2. Update In-Card List in Trade Tab
  const container = document.getElementById('trade-offers-list');
  const incoming = document.getElementById('incoming-trades');
  if (container && incoming) {
    incoming.style.display = 'block';

    const existingCard = document.getElementById(`trade_offer_${latestTrade.id}`);
    if (!existingCard) {
      const offerDiv = document.createElement('div');
      offerDiv.id = `trade_offer_${latestTrade.id}`;
      offerDiv.style.cssText = 'background: #1e1b4b; border: 1px solid #7c3aed; border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;';
      
      let badgeHtml = '';
      if (isBroadcast) {
        badgeHtml = isBuy
          ? `<span style="background: #2563eb; color: #fff; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px;">📢 خرید عمومی (از همه)</span>`
          : `<span style="background: #7c3aed; color: #fff; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px;">📢 فروش عمومی (به همه)</span>`;
      } else {
        badgeHtml = isBuy
          ? `<span style="background: #2563eb; color: #fff; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px;">📥 درخواست خرید</span>`
          : `<span style="background: #7c3aed; color: #fff; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px;">📤 پیشنهاد فروش</span>`;
      }

      offerDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          ${badgeHtml}
          <span style="font-size:0.85rem; color:#e2e8f0;">
            کشور <strong>${fromName}</strong>: ${latestTrade.quantity} عدد ${goodNames[latestTrade.goodType]} به قیمت <strong>${latestTrade.price.toLocaleString('fa-IR')}</strong> سکه
          </span>
        </div>
        <div style="display:flex; gap:6px;">
          <button onclick="window.openTradeDetailModal('${latestTrade.id}')" class="btn btn-primary" style="padding:4px 10px; font-size:0.8rem;">👁️ بررسی جزئیات</button>
          <button onclick="acceptTradeOffer('${latestTrade.id}')" class="btn btn-success" style="padding:4px 10px; font-size:0.8rem;">✅ قبول</button>
          <button onclick="rejectTradeOffer('${latestTrade.id}')" class="btn btn-secondary" style="padding:4px 10px; font-size:0.8rem;">❌ رد</button>
        </div>
      `;
      container.appendChild(offerDiv);
    }
  }
}

function updateBottomToastState() {
  const bottomToast = document.getElementById('trade-bottom-toast');
  if (!bottomToast) return;

  if (window.activeIncomingTrades.size === 0) {
    bottomToast.classList.add('hidden');
    const incomingCard = document.getElementById('incoming-trades');
    if (incomingCard && document.getElementById('trade-offers-list')?.children.length === 0) {
      incomingCard.style.display = 'none';
    }
  } else {
    const nextTrade = Array.from(window.activeIncomingTrades.values())[0];
    if (nextTrade) updateIncomingTradeUI(nextTrade);
  }
}

// Modal management
window.openTradeDetailModal = function(tradeId) {
  const trade = window.activeIncomingTrades.get(tradeId);
  if (!trade) {
    showToast('اطلاعات معامله در دسترس نیست یا منقضی شده است.', 'error');
    return;
  }

  currentViewingTradeId = tradeId;
  const goodNames = { bread: 'نان 🍞', building: 'ساختمان 🏛️', clothes: 'لباس 👔' };
  const fromCountry = currentRoom?.countries?.[trade.fromCountryId];
  const myCountry = currentRoom?.countries?.[myPlayer.countryId];
  const fromName = fromCountry ? fromCountry.name : trade.fromCountryId;
  const isBuy = trade.tradeType === 'buy';
  const isBroadcast = trade.toCountryId === 'all';

  const modal = document.getElementById('trade-detail-modal');
  const banner = document.getElementById('trade-modal-direction-banner');
  const typeDesc = document.getElementById('trade-modal-type-desc');
  const goodDesc = document.getElementById('trade-modal-good-desc');
  const qtyDesc = document.getElementById('trade-modal-qty-desc');
  const priceDesc = document.getElementById('trade-modal-price-desc');
  const explanation = document.getElementById('trade-modal-explanation');
  const balanceAlert = document.getElementById('trade-modal-balance-status');
  const btnAccept = document.getElementById('btn-modal-accept-trade');
  const btnReject = document.getElementById('btn-modal-reject-trade');

  if (!modal) return;

  // Direction Banner
  if (banner) {
    if (isBroadcast) {
      banner.innerHTML = `
        <span class="country-pill" style="border-color: #818cf8;">کشور فرستنده: ${fromName}</span>
        <span style="color: #facc15; font-size: 1.1rem;">➔ 📢 آگهی عمومی به همه ➔</span>
        <span class="country-pill" style="border-color: #34d399;">شما (${myCountry?.name || ''})</span>
      `;
    } else {
      banner.innerHTML = `
        <span class="country-pill" style="border-color: #818cf8;">کشور فرستنده: ${fromName}</span>
        <span style="color: #facc15; font-size: 1.1rem;">➔</span>
        <span class="country-pill" style="border-color: #34d399;">کشور شما (${myCountry?.name || ''})</span>
      `;
    }
  }

  if (typeDesc) {
    if (isBroadcast) {
      typeDesc.textContent = isBuy ? '📢 درخواست خرید عمومی (از تمام کشورها)' : '📢 پیشنهاد فروش عمومی (به تمام کشورها)';
    } else {
      typeDesc.textContent = isBuy ? '📥 درخواست خرید کالا از شما' : '📤 پیشنهاد فروش کالا به شما';
    }
    typeDesc.style.color = isBuy ? '#60a5fa' : '#c084fc';
  }
  if (goodDesc) goodDesc.textContent = goodNames[trade.goodType] || trade.goodType;
  if (qtyDesc) qtyDesc.textContent = `${trade.quantity} عدد`;
  if (priceDesc) priceDesc.textContent = `${trade.price.toLocaleString('fa-IR')} سکه`;

  // Feasibility Check
  if (isBuy) {
    // Other country wants to buy from our storage: we are seller
    const myStorage = myCountry?.economy?.storage?.[trade.goodType] || 0;
    const canDeliver = myStorage >= trade.quantity;

    if (explanation) {
      explanation.textContent = `کشور ${fromName} درخواست دارد این کالا را از انبار شما خریداری نماید. در صورت پذیرش، مبلغ ${trade.price.toLocaleString('fa-IR')} سکه به خزانه ملی شما واریز و کالا تحویل داده می‌شود.`;
      if (isBroadcast) {
        explanation.textContent += ' (💡 توجه: این یک آگهی به تمامی کشورهاست؛ اولین کشوری که تأیید کند معامله را انجام خواهد داد).';
      }
    }

    if (balanceAlert) {
      if (canDeliver) {
        balanceAlert.className = 'trade-balance-alert ok';
        balanceAlert.innerHTML = `✅ موجودی کالای شما در انبار: <strong>${myStorage} عدد</strong> (کافی برای انجام معامله)`;
        if (btnAccept) btnAccept.disabled = false;
      } else {
        balanceAlert.className = 'trade-balance-alert insufficient';
        balanceAlert.innerHTML = `❌ موجودی کالای شما در انبار: <strong>${myStorage} عدد</strong> (کسری موجودی؛ حداقل ${trade.quantity} عدد لازم است)`;
        if (btnAccept) btnAccept.disabled = true;
      }
    }
  } else {
    // Other country wants to sell goods to us: we are buyer
    const myTreasury = myCountry?.treasury || 0;
    const canAfford = myTreasury >= trade.price;

    if (explanation) {
      explanation.textContent = `کشور ${fromName} به شما پیشنهاد داده است که این کالا را خریداری کنید. در صورت پذیرش، مبلغ ${trade.price.toLocaleString('fa-IR')} سکه از خزانه شما پرداخت شده و کالا به انبار اضافه می‌شود.`;
      if (isBroadcast) {
        explanation.textContent += ' (💡 توجه: این یک آگهی به تمامی کشورهاست؛ اولین کشوری که تأیید کند معامله را انجام خواهد داد).';
      }
    }

    if (balanceAlert) {
      if (canAfford) {
        balanceAlert.className = 'trade-balance-alert ok';
        balanceAlert.innerHTML = `✅ موجودی خزانه ملی شما: <strong>${myTreasury.toLocaleString('fa-IR')} سکه</strong> (سکه کافی است)`;
        if (btnAccept) btnAccept.disabled = false;
      } else {
        balanceAlert.className = 'trade-balance-alert insufficient';
        balanceAlert.innerHTML = `❌ موجودی خزانه ملی شما: <strong>${myTreasury.toLocaleString('fa-IR')} سکه</strong> (کسری بودجه خزانه؛ حداقل ${trade.price.toLocaleString('fa-IR')} سکه لازم است)`;
        if (btnAccept) btnAccept.disabled = true;
      }
    }
  }

  // Bind Buttons
  if (btnAccept) {
    btnAccept.onclick = () => {
      window.acceptTradeOffer(trade.id);
    };
  }
  if (btnReject) {
    btnReject.onclick = () => {
      window.rejectTradeOffer(trade.id);
    };
  }

  modal.classList.remove('hidden');
};

window.closeTradeModal = function() {
  document.getElementById('trade-detail-modal')?.classList.add('hidden');
  currentViewingTradeId = null;
};

window.acceptTradeOffer = function(tradeId) {
  socket.emit('accept_trade', { tradeId, acceptingCountryId: myPlayer.countryId }, res => {
    if (res && res.success) {
      showToast('✅ معامله قبول شد و مبادله با موفقیت انجام گرفت.', 'success');
      window.closeTradeModal();
      window.activeIncomingTrades.delete(tradeId);
      document.getElementById(`trade_offer_${tradeId}`)?.remove();
      updateBottomToastState();
    } else if (res) {
      showToast(res.error, 'error');
    }
  });
};

window.rejectTradeOffer = function(tradeId) {
  socket.emit('reject_trade', { tradeId, rejectingCountryId: myPlayer.countryId }, res => {
    if (res && res.success) {
      showToast('معامله رد شد.', 'info');
      window.closeTradeModal();
      window.activeIncomingTrades.delete(tradeId);
      document.getElementById(`trade_offer_${tradeId}`)?.remove();
      updateBottomToastState();
    } else if (res) {
      showToast(res.error, 'error');
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTradeHandlers);
} else {
  initTradeHandlers();
}
