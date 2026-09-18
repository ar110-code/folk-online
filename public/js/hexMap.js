// public/js/hexMap.js
// Hexagonal Grid Engine matching media_1789074189545.jpg exactly

let selectedArmyBox = null;
let isExpansionMode = false;
const HEX_SIZE = 30; // enlarged battlefield hex size for clearer visualization

function getHexNeighbors(q, r) {
  const isOdd = (r & 1) === 1;
  if (isOdd) {
    return [
      { dq: 1, dr: 0 },
      { dq: 1, dr: -1 },
      { dq: 0, dr: -1 },
      { dq: -1, dr: 0 },
      { dq: 0, dr: 1 },
      { dq: 1, dr: 1 }
    ];
  } else {
    return [
      { dq: 1, dr: 0 },
      { dq: 0, dr: -1 },
      { dq: -1, dr: -1 },
      { dq: -1, dr: 0 },
      { dq: -1, dr: 1 },
      { dq: 0, dr: 1 }
    ];
  }
}

function isExpandableNeutralHex(hex, countryId) {
  if (!currentRoom || !currentRoom.hexMap || !hex || hex.owner !== 'neutral') return false;
  const dirs = getHexNeighbors(hex.q, hex.r);
  return dirs.some(d => {
    const n = currentRoom.hexMap[`hex_${hex.q + d.dq}_${hex.r + d.dr}`];
    return n && n.owner === countryId;
  });
}

const RES_ICONS = {
  wheat: '🌾',
  oven: '🔥',
  brick: '🧱',
  crane: '🏗️',
  cotton: '☁️',
  sewing: '🧵'
};

// Uses global COUNTRY_COLORS defined in lobby.js

function hexToPixel(q, r) {
  // Simple staggered-row offset grid (flat-top hexes, row offset for odd rows)
  const hexW = HEX_SIZE * Math.sqrt(3);
  const hexH = HEX_SIZE * 2;
  const x = hexW * (q + 0.5 * (Math.abs(r) % 2));
  const y = hexH * (3 / 4) * r;
  return { x, y };
}

function getHexPolygonPoints(cx, cy, size) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angleRad = (60 * i - 30) * Math.PI / 180;
    points.push(`${cx + size * Math.cos(angleRad)},${cy + size * Math.sin(angleRad)}`);
  }
  return points.join(' ');
}

let mapView = {
  x: -56,
  y: -56,
  w: 900,
  h: 502,
  origX: -56,
  origY: -56,
  origW: 900,
  origH: 502,
  isInitialized: false,
  isPanning: false,
  startX: 0,
  startY: 0
};

function applyMapView() {
  const svg = document.getElementById('hex-map-svg');
  if (!svg) return;
  svg.setAttribute('viewBox', `${mapView.x} ${mapView.y} ${mapView.w} ${mapView.h}`);
}

function applyZoom(factor) {
  const newW = mapView.w * factor;
  const newH = mapView.h * factor;
  if (newW < 250 || newW > 2500) return;
  mapView.x += (mapView.w - newW) / 2;
  mapView.y += (mapView.h - newH) / 2;
  mapView.w = newW;
  mapView.h = newH;
  applyMapView();
}

function setupPanZoomEvents() {
  const svg = document.getElementById('hex-map-svg');
  if (!svg || svg.dataset.panZoomInitialized) return;
  svg.dataset.panZoomInitialized = 'true';

  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomReset = document.getElementById('btn-zoom-reset');

  if (btnZoomIn) btnZoomIn.onclick = () => applyZoom(0.8);
  if (btnZoomOut) btnZoomOut.onclick = () => applyZoom(1.25);
  if (btnZoomReset) {
    btnZoomReset.onclick = () => {
      mapView.x = mapView.origX;
      mapView.y = mapView.origY;
      mapView.w = mapView.origW;
      mapView.h = mapView.origH;
      applyMapView();
    };
  }

  svg.addEventListener('mousedown', e => {
    if (e.target.closest && e.target.closest('.map-toolbar')) return;
    mapView.isPanning = true;
    mapView.startX = e.clientX;
    mapView.startY = e.clientY;
    svg.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', e => {
    if (!mapView.isPanning) return;
    const dx = e.clientX - mapView.startX;
    const dy = e.clientY - mapView.startY;
    mapView.startX = e.clientX;
    mapView.startY = e.clientY;

    const scaleX = mapView.w / (svg.clientWidth || 900);
    const scaleY = mapView.h / (svg.clientHeight || 500);

    mapView.x -= dx * scaleX;
    mapView.y -= dy * scaleY;
    applyMapView();
  });

  window.addEventListener('mouseup', () => {
    if (mapView.isPanning) {
      mapView.isPanning = false;
      svg.style.cursor = 'grab';
    }
  });

  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 0.85 : 1.15;
    applyZoom(factor);
  }, { passive: false });

  // Mobile Touch Pan & Pinch-to-Zoom Support
  let touchStartDist = null;
  let isTouchDragging = false;
  let touchStartPos = { x: 0, y: 0 };

  function getTouchDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  svg.addEventListener('touchstart', e => {
    if (e.target.closest && e.target.closest('.map-toolbar')) return;
    if (e.touches.length === 1) {
      isTouchDragging = true;
      mapView.isPanning = true;
      mapView.startX = e.touches[0].clientX;
      mapView.startY = e.touches[0].clientY;
      touchStartPos = { x: mapView.startX, y: mapView.startY };
    } else if (e.touches.length === 2) {
      isTouchDragging = true;
      mapView.isPanning = false;
      touchStartDist = getTouchDistance(e.touches[0], e.touches[1]);
    }
  }, { passive: false });

  svg.addEventListener('touchmove', e => {
    if (!isTouchDragging) return;
    e.preventDefault();

    if (e.touches.length === 1 && mapView.isPanning) {
      const dx = e.touches[0].clientX - mapView.startX;
      const dy = e.touches[0].clientY - mapView.startY;
      mapView.startX = e.touches[0].clientX;
      mapView.startY = e.touches[0].clientY;

      const scaleX = mapView.w / (svg.clientWidth || 360);
      const scaleY = mapView.h / (svg.clientHeight || 300);

      mapView.x -= dx * scaleX;
      mapView.y -= dy * scaleY;
      applyMapView();
    } else if (e.touches.length === 2 && touchStartDist) {
      const currentDist = getTouchDistance(e.touches[0], e.touches[1]);
      const factor = touchStartDist / (currentDist || 1);
      if (Math.abs(factor - 1) > 0.02) {
        applyZoom(factor > 1 ? 1.05 : 0.95);
        touchStartDist = currentDist;
      }
    }
  }, { passive: false });

  const endTouch = () => {
    isTouchDragging = false;
    mapView.isPanning = false;
    touchStartDist = null;
  };

  svg.addEventListener('touchend', endTouch);
  svg.addEventListener('touchcancel', endTouch);
}

function initHexMap() {
  renderHexMap();
  setupWarEventListeners();
  setupPanZoomEvents();
}

function renderHexMap() {
  const svg = document.getElementById('hex-map-svg');
  if (!svg || !currentRoom || !currentRoom.hexMap) return;
  svg.innerHTML = '';

  const hexMap = currentRoom.hexMap;
  const hexList = Object.values(hexMap);
  if (hexList.length === 0) return;

  // Calculate dynamic bounding box of all hexes to ensure 100% visibility
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  hexList.forEach(hex => {
    const { x, y } = hexToPixel(hex.q, hex.r);
    minX = Math.min(minX, x - HEX_SIZE);
    maxX = Math.max(maxX, x + HEX_SIZE);
    minY = Math.min(minY, y - HEX_SIZE);
    maxY = Math.max(maxY, y + HEX_SIZE);
  });

  const width = Math.max(400, maxX - minX + 60);
  const height = Math.max(300, maxY - minY + 60);

  if (!mapView.isInitialized || mapView.currentRoomCode !== currentRoom.roomCode) {
    mapView.currentRoomCode = currentRoom.roomCode;
    mapView.origX = minX - 30;
    mapView.origY = minY - 30;
    mapView.origW = width;
    mapView.origH = height;
    mapView.x = mapView.origX;
    mapView.y = mapView.origY;
    mapView.w = mapView.origW;
    mapView.h = mapView.origH;
    mapView.isInitialized = true;
  }
  applyMapView();

  // 1. Draw Movement Trails first
  if (currentRoom.movementTrails) {
    currentRoom.movementTrails.forEach(trail => {
      const fromH = hexMap[trail.fromHex];
      const toH = hexMap[trail.toHex];
      if (fromH && toH) {
        const p1 = hexToPixel(fromH.q, fromH.r);
        const p2 = hexToPixel(toH.q, toH.r);

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', p1.x);
        line.setAttribute('y1', p1.y);
        line.setAttribute('x2', p2.x);
        line.setAttribute('y2', p2.y);
        line.setAttribute('stroke', COUNTRY_COLORS[trail.country] || '#fff');
        line.setAttribute('stroke-width', '2.5');
        line.setAttribute('stroke-dasharray', '4,4');
        line.setAttribute('opacity', '0.8');
        svg.appendChild(line);
      }
    });
  }

  // 2. Draw Hex Cells
  Object.values(hexMap).forEach(hex => {
    const { x, y } = hexToPixel(hex.q, hex.r);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.style.cursor = 'pointer';
    g.id = `g_${hex.id}`;

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', getHexPolygonPoints(x, y, HEX_SIZE - 1.5));
    polygon.setAttribute('class', 'hex-cell');

    const myCountry = currentRoom && myPlayer && myPlayer.countryId ? currentRoom.countries[myPlayer.countryId] : null;
    const hasExpandedThisTurn = !!(myCountry && myCountry.military && (myCountry.military.fuelExpansionsThisTurn || 0) >= 1);
    const canExpandHere = !hasExpandedThisTurn && isExpansionMode && myPlayer && myPlayer.role === 'war' && isExpandableNeutralHex(hex, myPlayer.countryId);

    let fillColor = '#b48328'; // Rich warm ochre / gold for neutral territory
    let strokeColor = '#1e293b';
    let strokeWidth = '1.2';
    let strokeDash = 'none';

    if (canExpandHere) {
      fillColor = '#854d0e'; // Rich warm amber
      strokeColor = '#00f0ff'; // Glowing cyan
      strokeWidth = '2.5';
      strokeDash = '4,2';
    } else if (hex.owner !== 'neutral' && COUNTRY_COLORS[hex.owner]) {
      fillColor = COUNTRY_COLORS[hex.owner];
      strokeColor = '#ffffff55';
    }

    if (hex.isCapital) {
      // Darker shade for capital
      fillColor = getDarkerShade(COUNTRY_COLORS[hex.owner] || '#e11d48');
      strokeColor = '#fbbf24';
      strokeWidth = '3';
    }

    polygon.setAttribute('fill', fillColor);
    polygon.setAttribute('stroke', strokeColor);
    polygon.setAttribute('stroke-width', strokeWidth);
    if (strokeDash !== 'none') {
      polygon.setAttribute('stroke-dasharray', strokeDash);
    }

    polygon.addEventListener('click', () => onHexClick(hex));
    g.appendChild(polygon);

    if (canExpandHere) {
      const expText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      expText.setAttribute('x', x);
      expText.setAttribute('y', y + 3.5);
      expText.setAttribute('text-anchor', 'middle');
      expText.setAttribute('font-size', '8');
      expText.setAttribute('font-weight', 'bold');
      expText.setAttribute('fill', '#ffffff');
      expText.textContent = '⛽➕';
      g.appendChild(expText);
    }

    // Label Capital
    if (hex.isCapital) {
      const capText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      capText.setAttribute('x', x);
      capText.setAttribute('y', y + 3.5);
      capText.setAttribute('text-anchor', 'middle');
      capText.setAttribute('fill', '#fff');
      capText.setAttribute('font-size', '9');
      capText.setAttribute('font-weight', 'bold');
      capText.textContent = '👑';
      g.appendChild(capText);
    } else if (hex.isResourceZone) {
      // Resource icon
      const iconText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      iconText.setAttribute('x', x);
      iconText.setAttribute('y', y + 3.5);
      iconText.setAttribute('text-anchor', 'middle');
      iconText.setAttribute('font-size', '9');
      iconText.textContent = RES_ICONS[hex.resourceType] || '📦';
      g.appendChild(iconText);
    }

    // Defense garrison badge for 7 main regions
    if (hex.isMainRegion || hex.isCapital || hex.isResourceZone) {
      const defBadge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      defBadge.setAttribute('x', x);
      defBadge.setAttribute('y', y + 14);
      defBadge.setAttribute('text-anchor', 'middle');
      defBadge.setAttribute('font-size', '7.5');
      defBadge.setAttribute('font-weight', 'bold');
      defBadge.setAttribute('fill', '#cbd5e1');
      defBadge.setAttribute('opacity', '0.9');
      defBadge.textContent = '🛡️۱۵';
      g.appendChild(defBadge);
    }

    // Tooltip for quick status inspection
    const tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    let tip = `موقعیت: ${hex.id}`;
    if (hex.isCapital) tip += ` | پایتخت کشور ${COUNTRY_PERSIAN_NAMES[hex.owner] || hex.owner} (دژ مستحکم)`;
    else if (hex.isResourceZone) tip += ` | پایگاه تولید ${hex.resourceName || hex.resourceType} (${COUNTRY_PERSIAN_NAMES[hex.owner] || hex.owner})`;
    else if (hex.owner !== 'neutral') tip += ` | قلمرو ${COUNTRY_PERSIAN_NAMES[hex.owner] || hex.owner}`;
    else tip += ` | اراضی خنثی`;
    if (hex.isMainRegion || hex.isCapital || hex.isResourceZone) {
      tip += ` | دفاع پایه: ۱۵ نفر`;
    }
    tooltip.textContent = tip;
    g.appendChild(tooltip);

    // Render Armies
    renderArmiesOnHex(hex, g, x, y);

    svg.appendChild(g);
  });

  updateWarUIStats();
}

function getDarkerShade(hexColor) {
  const map = {
    '#0284c7': '#0c4a6e',
    '#2563eb': '#1e3a8a',
    '#9333ea': '#581c87',
    '#10b981': '#064e3b',
    '#16a34a': '#14532d',
    '#64748b': '#1e293b',
    '#e11d48': '#881337',
    '#dc2626': '#7f1d1d'
  };
  return map[hexColor] || '#050812';
}

function renderArmiesOnHex(hex, parentGroup, x, y) {
  let offset = 0;
  Object.values(currentRoom.countries).forEach(country => {
    const boxes = country.military.armyBoxes.filter(b => b.hexId === hex.id);
    boxes.forEach(box => {
      // Only Minister of War can select army boxes to move or attack
      const isMine = myPlayer.countryId === country.id && myPlayer.role === 'war';
      const isSelected = selectedArmyBox && selectedArmyBox.id === box.id;

      const armyTag = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      armyTag.style.cursor = isMine ? 'pointer' : 'default';

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x - 16);
      rect.setAttribute('y', y - 18 + offset);
      rect.setAttribute('width', '32');
      rect.setAttribute('height', '14');
      rect.setAttribute('rx', '3');
      rect.setAttribute('fill', isSelected ? '#facc15' : (COUNTRY_COLORS[country.id] || '#ef4444'));
      rect.setAttribute('stroke', isMine ? '#fff' : '#000');
      rect.setAttribute('stroke-width', '1');
      armyTag.appendChild(rect);

      const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      countText.setAttribute('x', x);
      countText.setAttribute('y', y - 8 + offset);
      countText.setAttribute('text-anchor', 'middle');
      countText.setAttribute('fill', isSelected ? '#000' : '#fff');
      countText.setAttribute('font-size', '8');
      countText.setAttribute('font-weight', 'bold');
      countText.textContent = `⚔️${box.soldiers}`;
      armyTag.appendChild(countText);

      if (isSelected) {
        const targetRing = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        targetRing.setAttribute('x', x - 19);
        targetRing.setAttribute('y', y - 21 + offset);
        targetRing.setAttribute('width', '38');
        targetRing.setAttribute('height', '20');
        targetRing.setAttribute('rx', '5');
        targetRing.setAttribute('fill', 'none');
        targetRing.setAttribute('stroke', '#00f0ff');
        targetRing.setAttribute('stroke-width', '2');
        targetRing.setAttribute('stroke-dasharray', '4,2');
        targetRing.setAttribute('class', 'tactical-target-ring');
        armyTag.appendChild(targetRing);
      }

      if (isMine) {
        armyTag.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isExpansionMode) {
            isExpansionMode = false;
            updateExpansionButtonState();
          }
          selectedArmyBox = isSelected ? null : box;
          renderHexMap();
        });
      }

      parentGroup.appendChild(armyTag);
      offset += 16;
    });
  });
}

const COUNTRY_PERSIAN_NAMES = {
  blue: 'آبی‌پلیس',
  purple: 'بنفشه‌زار',
  green: 'زمردیا',
  grey: 'سیلورلند',
  red: 'سرخستان'
};

const DIRECTION_DEFINITIONS = [
  { key: 'NW', label: '۳۰۰° شمال‌غرب ↖️', dqOdd: 0, drOdd: -1, dqEven: -1, drEven: -1 },
  { key: 'NE', label: '۰۳۰° شمال‌شرق ↗️', dqOdd: 1, drOdd: -1, dqEven: 0, drEven: -1 },
  { key: 'E',  label: '۰۹۰° جبهه شرق ➡️',  dqOdd: 1, drOdd: 0,  dqEven: 1,  drEven: 0 },
  { key: 'SE', label: '۱۵۰° جنوب‌شرق ↘️', dqOdd: 1, drOdd: 1,  dqEven: 0,  drEven: 1 },
  { key: 'SW', label: '۲۱۰° جنوب‌غرب ↙️', dqOdd: 0, drOdd: 1,  dqEven: -1, drEven: 1 },
  { key: 'W',  label: '۲۷۰° جبهه غرب ⬅️',  dqOdd: -1, drOdd: 0, dqEven: -1, drEven: 0 }
];

function updateExpansionButtonState() {
  const btn = document.getElementById('btn-toggle-expand');
  const chipsContainer = document.getElementById('expansion-chips-container');
  const quickStatus = document.getElementById('quick-expand-status');
  const btnQuickExpand = document.getElementById('btn-quick-expand');

  const myCountry = currentRoom && myPlayer && myPlayer.countryId ? currentRoom.countries[myPlayer.countryId] : null;
  const hasExpandedThisTurn = !!(myCountry && myCountry.military && (myCountry.military.fuelExpansionsThisTurn || 0) >= 1);

  if (hasExpandedThisTurn) {
    isExpansionMode = false;
  }

  if (quickStatus) {
    if (hasExpandedThisTurn) {
      quickStatus.textContent = 'سقف نوبت پر شد (۱/۱) 🔒';
    } else {
      quickStatus.textContent = isExpansionMode ? 'روشن 🟢' : 'خاموش ⚪';
    }
  }
  if (btnQuickExpand) {
    btnQuickExpand.classList.toggle('btn-success', isExpansionMode && !hasExpandedThisTurn);
    btnQuickExpand.classList.toggle('btn-secondary', !isExpansionMode || hasExpandedThisTurn);
  }

  if (!btn) return;
  if (hasExpandedThisTurn) {
    btn.classList.remove('btn-success', 'active');
    btn.classList.add('btn-secondary');
    btn.textContent = '🔒 سقف ۱ زمین مصرف شد';
    if (chipsContainer) chipsContainer.style.display = 'none';
  } else if (isExpansionMode) {
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-success', 'active');
    btn.textContent = 'روشن 🟢';
    if (chipsContainer) chipsContainer.style.display = 'block';
  } else {
    btn.classList.remove('btn-success', 'active');
    btn.classList.add('btn-secondary');
    btn.textContent = 'خاموش ⚪';
    if (chipsContainer) chipsContainer.style.display = 'none';
  }
}

let pendingAttackTarget = null;

function executeArmyMove(targetHexId, forceAttack = false) {
  if (myPlayer.role !== 'war') return;
  if (!selectedArmyBox) {
    showToast('لطفاً ابتدا یک باکس ارتش را انتخاب کنید.', 'warning');
    return;
  }
  if (currentRoom.phase !== 'noon') {
    showToast('حرکت ارتش فقط در فاز ظهر امکان‌پذیر است.', 'error');
    return;
  }

  const targetHex = currentRoom.hexMap[targetHexId];
  if (!targetHex) return;

  const isEnemy = targetHex.owner !== 'neutral' && targetHex.owner !== myPlayer.countryId;

  // Intercept enemy attack to show rich tactical battle preview
  if (isEnemy && !forceAttack) {
    openBattleAssessmentModal(selectedArmyBox, targetHex);
    return;
  }

  socket.emit('move_army', {
    countryId: myPlayer.countryId,
    boxId: selectedArmyBox.id,
    targetHexId: targetHexId
  }, res => {
    if (res.success) {
      if (res.combat) {
        showBattleOutcome(res.combat);
      } else {
        showToast(`ارتش به ${targetHexId} منتقل شد (۱ سوخت مصرف شد).`, 'info');
      }
      selectedArmyBox = null;
      renderHexMap();
    } else {
      showToast(res.error, 'error');
    }
  });
}

function openBattleAssessmentModal(attBox, targetHex) {
  const modal = document.getElementById('battle-modal');
  if (!modal || !currentRoom) return;

  const attCountry = currentRoom.countries[myPlayer.countryId];
  const defCountryId = targetHex.owner;
  const defCountry = currentRoom.countries[defCountryId];
  if (!attCountry || !defCountry) return;

  const attSoldiers = attBox.soldiers || 0;
  const attTech = attCountry.techMultiplier || 1.0;
  const attPower = Math.round(attSoldiers * attTech);

  const defBoxes = defCountry.military.armyBoxes.filter(b => b.hexId === targetHex.id);
  const defBoxesSoldiers = defBoxes.reduce((acc, b) => acc + b.soldiers, 0);

  const isCapital = targetHex.isCapital && targetHex.capitalCountry === defCountryId;
  const isMainRegion = !!(targetHex.isMainRegion || targetHex.isCapital || targetHex.isResourceZone);
  const baseDefense = (targetHex.baseDefense !== undefined) ? targetHex.baseDefense : (isMainRegion ? 15 : 0);
  let defSoldiers = defBoxesSoldiers + baseDefense;

  const defCapBonus = isCapital ? 2.0 : 0.0;
  const defTech = defCountry.techMultiplier || 1.0;
  const totalDefMult = defTech + defCapBonus;
  const defPower = Math.round(defSoldiers * totalDefMult);

  document.getElementById('battle-modal-title').textContent = 'اتاق وضعیت جنگ: شبیه‌ساز و ارزیابی نبرد';
  document.getElementById('battle-target-hex-id').textContent = `در موقعیت ${targetHex.id}`;

  // Attacker card
  const attCard = document.getElementById('battle-attacker-card');
  if (attCard) attCard.style.borderColor = COUNTRY_COLORS[myPlayer.countryId] || '#ef4444';
  document.getElementById('battle-att-country-name').textContent = COUNTRY_PERSIAN_NAMES[myPlayer.countryId] || myPlayer.countryId;
  document.getElementById('battle-att-country-name').style.color = COUNTRY_COLORS[myPlayer.countryId] || '#ef4444';
  document.getElementById('battle-att-soldiers').textContent = `${attSoldiers.toLocaleString('fa-IR')} نفر`;
  document.getElementById('battle-att-tech').textContent = `${attTech.toFixed(1)}×`;
  document.getElementById('battle-att-formula').textContent = `${attSoldiers} × ${attTech.toFixed(1)}`;
  document.getElementById('battle-att-power').textContent = attPower.toLocaleString('fa-IR');

  // Defender card
  const defCard = document.getElementById('battle-defender-card');
  if (defCard) defCard.style.borderColor = COUNTRY_COLORS[defCountryId] || '#3b82f6';
  document.getElementById('battle-def-country-name').textContent = COUNTRY_PERSIAN_NAMES[defCountryId] || defCountryId;
  document.getElementById('battle-def-country-name').style.color = COUNTRY_COLORS[defCountryId] || '#3b82f6';
  
  if (defBoxesSoldiers > 0 && baseDefense > 0) {
    document.getElementById('battle-def-soldiers').textContent = `${defSoldiers.toLocaleString('fa-IR')} نفر (${defBoxesSoldiers.toLocaleString('fa-IR')} ارتش + ${baseDefense.toLocaleString('fa-IR')} گارد)`;
  } else if (baseDefense > 0) {
    document.getElementById('battle-def-soldiers').textContent = `${defSoldiers.toLocaleString('fa-IR')} نفر (${baseDefense.toLocaleString('fa-IR')} گارد پایگاه)`;
  } else {
    document.getElementById('battle-def-soldiers').textContent = `${defSoldiers.toLocaleString('fa-IR')} نفر`;
  }
  document.getElementById('battle-def-tech').textContent = `${defTech.toFixed(1)}×`;

  const capBadge = document.getElementById('battle-capital-defense-badge');
  if (capBadge) {
    if (isCapital) {
      capBadge.classList.remove('hidden');
    } else {
      capBadge.classList.add('hidden');
    }
  }

  const mainRegionBadge = document.getElementById('battle-main-region-defense-badge');
  if (mainRegionBadge) {
    if (baseDefense > 0) {
      mainRegionBadge.classList.remove('hidden');
    } else {
      mainRegionBadge.classList.add('hidden');
    }
  }

  let formulaStr = '';
  if (defBoxesSoldiers > 0 && baseDefense > 0) {
    formulaStr = `(${defBoxesSoldiers} + ${baseDefense})`;
  } else {
    formulaStr = `${defSoldiers}`;
  }
  if (isCapital) {
    formulaStr += ` × (${defTech.toFixed(1)} + ۲.۰ دژ)`;
  } else {
    formulaStr += ` × ${defTech.toFixed(1)}`;
  }
  document.getElementById('battle-def-formula').textContent = formulaStr;
  document.getElementById('battle-def-power').textContent = defPower.toLocaleString('fa-IR');

  // Tug-of-war Power Bar
  const totalPower = attPower + defPower;
  const attPercent = totalPower > 0 ? Math.round((attPower / totalPower) * 100) : 50;
  const defPercent = 100 - attPercent;

  document.getElementById('battle-att-bar-label').textContent = `مهاجم (${COUNTRY_PERSIAN_NAMES[myPlayer.countryId]}): ${attPercent}٪`;
  document.getElementById('battle-def-bar-label').textContent = `مدافع (${COUNTRY_PERSIAN_NAMES[defCountryId]}): ${defPercent}٪`;

  const attBar = document.getElementById('battle-att-bar-fill');
  const defBar = document.getElementById('battle-def-bar-fill');
  if (attBar) {
    attBar.style.width = `${attPercent}%`;
    attBar.style.background = COUNTRY_COLORS[myPlayer.countryId] || '#ef4444';
  }
  if (defBar) {
    defBar.style.width = `${defPercent}%`;
    defBar.style.background = COUNTRY_COLORS[defCountryId] || '#3b82f6';
  }

  // Advice assessment
  const adviceEl = document.getElementById('battle-assessment-advice');
  if (adviceEl) {
    if (attPower >= defPower) {
      const excess = attPower - defPower;
      const surviving = Math.floor(excess / attTech);
      adviceEl.className = 'battle-advice-card favorable';
      adviceEl.innerHTML = `✅ <strong>ارزیابی ستاد کل:</strong> شانس پیروزی شما بالاست (${attPercent}٪ برتری قوا). پیش‌بینی بازماندگان: حدود <strong>${surviving.toLocaleString('fa-IR')} سرباز</strong>.${isCapital ? ' 👑 در صورت پیروزی، پایتخت دشمن فتح و کل کشور تسلیم خواهد شد!' : ''}`;
    } else {
      adviceEl.className = 'battle-advice-card dangerous';
      adviceEl.innerHTML = `⚠️ <strong>هشدار فرماندهی دفاعی:</strong> قدرت مدافع (${defPower.toLocaleString('fa-IR')}) از توان حمله شما (${attPower.toLocaleString('fa-IR')}) بیشتر است!${isCapital ? ' (دژ پایتخت ضریب ۲ برابری دارد).' : ''} در صورت صدور دستور حمله، <strong>ارتش شما کاملاً منهدم خواهد شد</strong>.`;
    }
  }

  // Reset modal display state for preview
  document.getElementById('battle-stage-preview').classList.remove('hidden');
  document.querySelector('.battle-power-bar-wrapper').classList.remove('hidden');
  document.getElementById('battle-assessment-advice').classList.remove('hidden');
  document.getElementById('battle-outcome-section').classList.add('hidden');
  document.getElementById('battle-action-buttons').classList.remove('hidden');
  document.getElementById('battle-close-action-buttons').classList.add('hidden');

  pendingAttackTarget = {
    boxId: attBox.id,
    targetHexId: targetHex.id
  };

  modal.classList.remove('hidden');
}

function showBattleOutcome(combat) {
  const modal = document.getElementById('battle-modal');
  if (!modal) return;

  const isMe = combat.winner === myPlayer.countryId;
  const isMeLoser = combat.loser === myPlayer.countryId;
  const winnerName = COUNTRY_PERSIAN_NAMES[combat.winner] || combat.winner;
  const loserName = COUNTRY_PERSIAN_NAMES[combat.loser] || combat.loser;

  document.getElementById('battle-modal-title').textContent = 'گزارش پایان نبرد و تلفات جنگی';
  document.getElementById('battle-target-hex-id').textContent = `در موقعیت ${combat.targetHexId || ''}`;

  // Attacker card
  document.getElementById('battle-att-country-name').textContent = COUNTRY_PERSIAN_NAMES[combat.attCountryId] || combat.attCountryId;
  document.getElementById('battle-att-country-name').style.color = COUNTRY_COLORS[combat.attCountryId] || '#ef4444';
  document.getElementById('battle-att-soldiers').textContent = `${(combat.attSoldiers || 0).toLocaleString('fa-IR')} نفر`;
  document.getElementById('battle-att-tech').textContent = `${(combat.attTechMultiplier || 1.0).toFixed(1)}×`;
  document.getElementById('battle-att-formula').textContent = `${combat.attSoldiers} × ${(combat.attTechMultiplier || 1.0).toFixed(1)}`;
  document.getElementById('battle-att-power').textContent = Math.round(combat.attPower || 0).toLocaleString('fa-IR');

  // Defender card
  document.getElementById('battle-def-country-name').textContent = COUNTRY_PERSIAN_NAMES[combat.defCountryId] || combat.defCountryId;
  document.getElementById('battle-def-country-name').style.color = COUNTRY_COLORS[combat.defCountryId] || '#3b82f6';
  if (combat.defBoxesSoldiers > 0 && combat.baseDefense > 0) {
    document.getElementById('battle-def-soldiers').textContent = `${(combat.defSoldiers || 0).toLocaleString('fa-IR')} نفر (${combat.defBoxesSoldiers.toLocaleString('fa-IR')} ارتش + ${combat.baseDefense.toLocaleString('fa-IR')} گارد)`;
  } else if (combat.baseDefense > 0) {
    document.getElementById('battle-def-soldiers').textContent = `${(combat.defSoldiers || 0).toLocaleString('fa-IR')} نفر (${combat.baseDefense.toLocaleString('fa-IR')} گارد پایگاه)`;
  } else {
    document.getElementById('battle-def-soldiers').textContent = `${(combat.defSoldiers || 0).toLocaleString('fa-IR')} نفر`;
  }
  document.getElementById('battle-def-tech').textContent = `${(combat.defTechMultiplier || 1.0).toFixed(1)}×`;

  const capBadge = document.getElementById('battle-capital-defense-badge');
  if (capBadge) {
    if (combat.isCapital) {
      capBadge.classList.remove('hidden');
    } else {
      capBadge.classList.add('hidden');
    }
  }

  const mainRegionBadge = document.getElementById('battle-main-region-defense-badge');
  if (mainRegionBadge) {
    if (combat.baseDefense > 0 || combat.isMainRegion) {
      mainRegionBadge.classList.remove('hidden');
    } else {
      mainRegionBadge.classList.add('hidden');
    }
  }

  let outFormulaStr = '';
  if (combat.defBoxesSoldiers > 0 && combat.baseDefense > 0) {
    outFormulaStr = `(${combat.defBoxesSoldiers} + ${combat.baseDefense})`;
  } else {
    outFormulaStr = `${combat.defSoldiers}`;
  }
  if (combat.isCapital) {
    outFormulaStr += ` × (${(combat.defTechMultiplier || 1.0).toFixed(1)} + ۲.۰ دژ)`;
  } else {
    outFormulaStr += ` × ${(combat.defTechMultiplier || 1.0).toFixed(1)}`;
  }
  document.getElementById('battle-def-formula').textContent = outFormulaStr;
  document.getElementById('battle-def-power').textContent = Math.round(combat.defPower || 0).toLocaleString('fa-IR');

  // Tug-of-war Bar
  const totalPower = (combat.attPower || 0) + (combat.defPower || 0);
  const attPercent = totalPower > 0 ? Math.round(((combat.attPower || 0) / totalPower) * 100) : 50;
  const defPercent = 100 - attPercent;

  document.getElementById('battle-att-bar-label').textContent = `مهاجم (${COUNTRY_PERSIAN_NAMES[combat.attCountryId]}): ${attPercent}٪`;
  document.getElementById('battle-def-bar-label').textContent = `مدافع (${COUNTRY_PERSIAN_NAMES[combat.defCountryId]}): ${defPercent}٪`;

  const attBar = document.getElementById('battle-att-bar-fill');
  const defBar = document.getElementById('battle-def-bar-fill');
  if (attBar) {
    attBar.style.width = `${attPercent}%`;
    attBar.style.background = COUNTRY_COLORS[combat.attCountryId] || '#ef4444';
  }
  if (defBar) {
    defBar.style.width = `${defPercent}%`;
    defBar.style.background = COUNTRY_COLORS[combat.defCountryId] || '#3b82f6';
  }

  // Outcome banner & stats
  const outcomeBanner = document.getElementById('battle-outcome-banner');
  const outcomeIcon = document.getElementById('battle-outcome-icon');
  const outcomeText = document.getElementById('battle-outcome-text');

  if (isMe) {
    outcomeBanner.className = 'outcome-banner victory';
    outcomeIcon.textContent = '🏆';
    outcomeText.innerHTML = `پیروزی قاطع ارتش ${winnerName}! هکس تحت کنترل شما درآمد.`;
  } else if (isMeLoser) {
    outcomeBanner.className = 'outcome-banner defeat';
    outcomeIcon.textContent = '💀';
    outcomeText.innerHTML = `شکست در نبرد! ارتش پیروز: ${winnerName}.`;
  } else {
    outcomeBanner.className = 'outcome-banner victory';
    outcomeIcon.textContent = '⚔️';
    outcomeText.innerHTML = `پایان نبرد: ارتش ${winnerName} بر ${loserName} غلبه کرد.`;
  }

  document.getElementById('battle-outcome-survivors').textContent = `${(combat.survivingSoldiers || 0).toLocaleString('fa-IR')} سرباز بازمانده`;
  const lossSoldiers = (combat.winner === combat.attCountryId ? combat.defSoldiers : combat.attSoldiers) || 0;
  document.getElementById('battle-outcome-losses').textContent = `${lossSoldiers.toLocaleString('fa-IR')} نفر تلفات قطعی`;

  const capFallenAlert = document.getElementById('battle-capital-fallen-alert');
  if (capFallenAlert) {
    if (combat.isCapitalConquered) {
      capFallenAlert.classList.remove('hidden');
      capFallenAlert.innerHTML = `👑 <strong>سقوط تاریخی پایتخت ${loserName}!</strong> تمام خزاین، منابع و اراضی آن به تصرف ${winnerName} درآمد و کشور مغلوب از بازی حذف گردید.`;
    } else {
      capFallenAlert.classList.add('hidden');
    }
  }

  // Resource Hex Conquest & Warehouse Looting Alert
  const lootAlert = document.getElementById('battle-resource-looted-alert');
  if (lootAlert) {
    if (combat.lootedResource && combat.lootedResource.quantity > 0) {
      lootAlert.classList.remove('hidden');
      lootAlert.innerHTML = `📦 <strong>غنیمت تسخیر انبار ${combat.lootedResource.name}:</strong> تمام موجودی انبار مدافع (<strong>${combat.lootedResource.quantity.toLocaleString('fa-IR')} عدد</strong>) غارت شد و به انبار ارتش فاتح (${winnerName}) انتقال یافت! خط تولید ${combat.lootedResource.name} مدافع متوقف گردید.`;
    } else if (combat.lootedResource && combat.lootedResource.quantity === 0) {
      lootAlert.classList.remove('hidden');
      lootAlert.innerHTML = `🔒 <strong>تسخیر انبار و مرکز تولید ${combat.lootedResource.name}:</strong> انبار مدافع خالی بود، اما خط تولید ${combat.lootedResource.name} دشمن قفل شد و دیگر قادر به تولید آن نخواهد بود!`;
    } else {
      lootAlert.classList.add('hidden');
    }
  }

  // Real-time toast feedback for winner and loser
  if (combat.lootedResource) {
    if (combat.winner === myPlayer.countryId) {
      if (combat.lootedResource.quantity > 0) {
        showToast(`🏆 غنیمت تسخیر انبار! تمام ${combat.lootedResource.quantity} عدد ${combat.lootedResource.name} دشمن به انبار شما اضافه شد و خط تولید دشمن قفل گردید.`, 'success');
      } else {
        showToast(`🏆 مرکز تولید ${combat.lootedResource.name} دشمن تسخیر شد و خط تولید آن قفل گردید!`, 'success');
      }
    } else if (combat.loser === myPlayer.countryId) {
      if (combat.lootedResource.quantity > 0) {
        showToast(`⚠️ انبار ${combat.lootedResource.name} شما سقوط کرد! ${combat.lootedResource.quantity} عدد غارت شد و خط تولید متوقف گردید!`, 'error');
      } else {
        showToast(`⚠️ مرکز تولید ${combat.lootedResource.name} شما توسط ارتش ${winnerName} تصرف و خط تولید قفل شد!`, 'error');
      }
    }
  }

  // Show outcome section, hide assessment advice and attack buttons
  document.getElementById('battle-stage-preview').classList.remove('hidden');
  document.querySelector('.battle-power-bar-wrapper').classList.remove('hidden');
  document.getElementById('battle-assessment-advice').classList.add('hidden');
  document.getElementById('battle-outcome-section').classList.remove('hidden');
  document.getElementById('battle-action-buttons').classList.add('hidden');
  document.getElementById('battle-close-action-buttons').classList.remove('hidden');

  modal.classList.remove('hidden');
}

window.showBattleOutcome = showBattleOutcome;

function executeTerritoryExpansion(targetHexId) {
  if (myPlayer.role !== 'war') return;
  if (currentRoom.phase !== 'noon') {
    showToast('گسترش قلمرو فقط در فاز ظهر امکان‌پذیر است.', 'error');
    return;
  }
  const currentActive = currentRoom.activeCountryOrder && currentRoom.activeCountryOrder[currentRoom.noonActiveCountryIndex];
  if (currentActive && currentActive !== myPlayer.countryId) {
    showToast('اکنون نوبت شما نیست.', 'error');
    return;
  }
  const myCountry = currentRoom.countries[myPlayer.countryId];
  if (!myCountry || (myCountry.military.fuelTokens || 0) < 1) {
    showToast('برای گسترش قلمرو به حداقل ۱ توکن سوخت نیاز دارید (از دکمه‌های خرید سوخت استفاده کنید).', 'error');
    return;
  }
  if ((myCountry.military.fuelExpansionsThisTurn || 0) >= 1) {
    showToast('در هر نوبت فقط می‌توانید ۱ زمین را با سوخت گسترش دهید.', 'warning');
    isExpansionMode = false;
    updateExpansionButtonState();
    renderHexMap();
    return;
  }

  socket.emit('expand_territory', {
    countryId: myPlayer.countryId,
    targetHexId: targetHexId
  }, res => {
    if (res.success) {
      if (myCountry && myCountry.military) {
        myCountry.military.fuelExpansionsThisTurn = (myCountry.military.fuelExpansionsThisTurn || 0) + 1;
        if (res.fuelTokens !== undefined) myCountry.military.fuelTokens = res.fuelTokens;
      }
      showToast(`هکس ${targetHexId} با مصرف ۱ سوخت ضمیمه قلمرو شد! ⛽🗺️ (سقف گسترش این نوبت مصرف شد)`, 'success');
      isExpansionMode = false;
      updateExpansionButtonState();
      renderHexMap();
    } else {
      showToast(res.error, 'error');
      if (res.error && res.error.includes('فقط می‌توانید ۱ زمین')) {
        isExpansionMode = false;
        updateExpansionButtonState();
        renderHexMap();
      }
    }
  });
}

function onHexClick(hex) {
  if (myPlayer.role !== 'war') return;

  if (isExpansionMode) {
    const myCountry = currentRoom && myPlayer && myPlayer.countryId ? currentRoom.countries[myPlayer.countryId] : null;
    if (myCountry && myCountry.military && (myCountry.military.fuelExpansionsThisTurn || 0) >= 1) {
      showToast('در هر نوبت فقط می‌توانید ۱ زمین را با سوخت گسترش دهید.', 'warning');
      isExpansionMode = false;
      updateExpansionButtonState();
      renderHexMap();
      return;
    }
    if (hex.owner !== 'neutral') {
      showToast('گسترش با سوخت فقط روی خانه‌های خنثی امکان‌پذیر است.', 'warning');
      return;
    }
    if (!isExpandableNeutralHex(hex, myPlayer.countryId)) {
      showToast('تنها هکس‌های خنثی هم‌مرز با قلمرو خود را می‌توانید گسترش دهید.', 'warning');
      return;
    }
    executeTerritoryExpansion(hex.id);
    return;
  }

  if (!selectedArmyBox) {
    if (isExpandableNeutralHex(hex, myPlayer.countryId)) {
      showToast('برای گسترش این زمین با سوخت، دکمه «گسترش سریع قلمرو» را فعال کنید.', 'info');
    }
    return;
  }

  executeArmyMove(hex.id);
}

let warListenersInitialized = false;
function setupWarEventListeners() {
  if (warListenersInitialized) return;
  warListenersInitialized = true;

  // Fuel quick buy buttons
  const buyFuel = (count) => {
    socket.emit('buy_fuel', { countryId: myPlayer.countryId, count }, res => {
      if (res.success) {
        showToast(`${count} توکن سوخت با موفقیت خریداری شد (هزینه: ${count * 500} سکه). ⛽`, 'success');
      } else {
        showToast(res.error, 'error');
      }
    });
  };

  const btnBuyFuel1 = document.getElementById('btn-buy-fuel-1');
  if (btnBuyFuel1) btnBuyFuel1.addEventListener('click', () => buyFuel(1));

  const btnBuyFuel3 = document.getElementById('btn-buy-fuel-3');
  if (btnBuyFuel3) btnBuyFuel3.addEventListener('click', () => buyFuel(3));

  const btnBuyFuel5 = document.getElementById('btn-buy-fuel-5');
  if (btnBuyFuel5) btnBuyFuel5.addEventListener('click', () => buyFuel(5));

  // Legacy button fallback
  const btnBuyFuelLegacy = document.getElementById('btn-buy-fuel');
  if (btnBuyFuelLegacy) btnBuyFuelLegacy.addEventListener('click', () => buyFuel(1));

  // Floating War Quick Fuel buttons
  const btnQuickFuel1 = document.getElementById('btn-quick-fuel-1');
  if (btnQuickFuel1) btnQuickFuel1.addEventListener('click', () => buyFuel(1));

  const btnQuickFuel3 = document.getElementById('btn-quick-fuel-3');
  if (btnQuickFuel3) btnQuickFuel3.addEventListener('click', () => buyFuel(3));

  // Toggle expansion mode (Standard and Floating button)
  const toggleExpandHandler = () => {
    if (currentRoom && myPlayer && myPlayer.countryId && currentRoom.countries[myPlayer.countryId]) {
      const myCountry = currentRoom.countries[myPlayer.countryId];
      if ((myCountry.military.fuelExpansionsThisTurn || 0) >= 1) {
        showToast('سقف گسترش قلمرو با سوخت در این نوبت مصرف شده است (حداکثر ۱ زمین در هر نوبت).', 'warning');
        return;
      }
    }
    isExpansionMode = !isExpansionMode;
    if (isExpansionMode) {
      selectedArmyBox = null;
      showToast('حالت گسترش سریع قلمرو فعال شد. روی هکس‌های هم‌مرز یا دکمه‌های مقصد کلیک کنید.', 'info');
    }
    updateExpansionButtonState();
    renderHexMap();
  };

  const btnToggleExpand = document.getElementById('btn-toggle-expand');
  if (btnToggleExpand) btnToggleExpand.addEventListener('click', toggleExpandHandler);

  const btnQuickExpand = document.getElementById('btn-quick-expand');
  if (btnQuickExpand) btnQuickExpand.addEventListener('click', toggleExpandHandler);

  // Floating War Quick Buy Army Box
  const btnQuickBuyArmy = document.getElementById('btn-quick-buy-army');
  if (btnQuickBuyArmy) {
    btnQuickBuyArmy.addEventListener('click', () => {
      socket.emit('buy_army_box', { countryId: myPlayer.countryId, soldiers: 30 }, res => {
        if (res.success) {
          showToast('باکس ارتش جدید با ۳۰ سرباز در پایگاه کشور مستقر شد. 🎖️', 'success');
        } else {
          showToast(res.error, 'error');
        }
      });
    });
  }

  // Floating War Quick Reinforce Box (+10 soldiers)
  const btnQuickReinf = document.getElementById('btn-quick-reinf');
  if (btnQuickReinf) {
    btnQuickReinf.addEventListener('click', () => {
      const myCountry = currentRoom?.countries[myPlayer.countryId];
      if (!myCountry || !myCountry.military.armyBoxes || myCountry.military.armyBoxes.length === 0) {
        showToast('هیچ باکس ارتشی برای تقویت وجود ندارد. ابتدا یک باکس ارتش جدید بخرید.', 'warning');
        return;
      }
      const targetBox = selectedArmyBox || myCountry.military.armyBoxes[0];
      socket.emit('reinforce_box', {
        countryId: myPlayer.countryId,
        boxId: targetBox.id,
        soldiers: 10
      }, res => {
        if (res.success) {
          const costStr = (res.cost || 20000).toLocaleString('fa-IR');
          showToast(`۱۰ سرباز به باکس ارتش (${targetBox.hexId}) شارژ شد (هزینه: ${costStr} سکه). ⚡`, 'success');
        } else {
          showToast(res.error, 'error');
        }
      });
    });
  }

  // Cancel army selection (Standard and Floating buttons)
  const cancelArmyHandler = () => {
    selectedArmyBox = null;
    renderHexMap();
  };

  const btnCancel = document.getElementById('btn-cancel-army-select');
  if (btnCancel) btnCancel.addEventListener('click', cancelArmyHandler);

  const btnQuickCancelArmy = document.getElementById('btn-quick-cancel-army');
  if (btnQuickCancelArmy) btnQuickCancelArmy.addEventListener('click', cancelArmyHandler);

  // Recruitment tabs
  const tabBtnNew = document.getElementById('tab-btn-recruit-new');
  const tabBtnReinf = document.getElementById('tab-btn-reinforce-box');
  const tabContentNew = document.getElementById('tab-content-recruit-new');
  const tabContentReinf = document.getElementById('tab-content-reinforce-box');

  if (tabBtnNew && tabBtnReinf && tabContentNew && tabContentReinf) {
    tabBtnNew.addEventListener('click', () => {
      tabBtnNew.classList.add('active');
      tabBtnReinf.classList.remove('active');
      tabContentNew.classList.remove('hidden');
      tabContentReinf.classList.add('hidden');
    });

    tabBtnReinf.addEventListener('click', () => {
      tabBtnReinf.classList.add('active');
      tabBtnNew.classList.remove('active');
      tabContentReinf.classList.remove('hidden');
      tabContentNew.classList.add('hidden');
    });
  }

  // Presets & Cost previews for New Army
  const inputSoldiers = document.getElementById('input-new-army-soldiers');
  const newCostPreview = document.getElementById('new-army-cost-preview');
  const updateNewCost = () => {
    if (!inputSoldiers) return;
    const val = parseInt(inputSoldiers.value, 10) || 0;
    if (newCostPreview) newCostPreview.textContent = `هزینه: ${(val * 1000).toLocaleString('fa-IR')} سکه`;
  };

  document.querySelectorAll('.btn-preset-soldiers').forEach(btn => {
    btn.addEventListener('click', () => {
      if (inputSoldiers) {
        inputSoldiers.value = btn.dataset.count;
        updateNewCost();
      }
    });
  });
  if (inputSoldiers) inputSoldiers.addEventListener('input', updateNewCost);

  // Buy new army
  const btnBuyArmy = document.getElementById('btn-buy-army');
  if (btnBuyArmy) {
    btnBuyArmy.addEventListener('click', () => {
      const soldiers = parseInt(inputSoldiers.value, 10) || 30;
      if (soldiers < 30) {
        showToast('حداقل ۳۰ سرباز برای باکس جدید لازم است.', 'error');
        return;
      }
      socket.emit('buy_army_box', { countryId: myPlayer.countryId, soldiers }, res => {
        if (res.success) {
          showToast(`باکس ارتش با ${soldiers} سرباز در پایگاه کشور مستقر شد. 🎖️`, 'success');
        } else {
          showToast(res.error, 'error');
        }
      });
    });
  }

  // Presets & Cost previews for Reinforce
  const inputReinforce = document.getElementById('input-reinforce-soldiers');
  const reinfCostPreview = document.getElementById('reinf-cost-preview');
  const updateReinfCost = () => {
    if (!inputReinforce) return;
    const val = parseInt(inputReinforce.value, 10) || 0;
    if (reinfCostPreview) reinfCostPreview.textContent = `هزینه: ${(val * 2000).toLocaleString('fa-IR')} سکه`;
  };

  document.querySelectorAll('.btn-preset-reinf').forEach(btn => {
    btn.addEventListener('click', () => {
      if (inputReinforce) {
        inputReinforce.value = btn.dataset.count;
        updateReinfCost();
      }
    });
  });
  if (inputReinforce) inputReinforce.addEventListener('input', updateReinfCost);

  // Reinforce army
  const btnReinforce = document.getElementById('btn-reinforce-army');
  const selectBox = document.getElementById('select-reinforce-box');
  if (btnReinforce && selectBox && inputReinforce) {
    btnReinforce.addEventListener('click', () => {
      const boxId = selectBox.value;
      const soldiers = parseInt(inputReinforce.value, 10) || 0;
      if (!boxId) {
        showToast('لطفاً یک باکس ارتش را انتخاب کنید.', 'error');
        return;
      }
      if (soldiers <= 0) {
        showToast('تعداد سرباز نامعتبر است.', 'error');
        return;
      }

      socket.emit('reinforce_box', {
        countryId: myPlayer.countryId,
        boxId,
        soldiers
      }, res => {
        if (res.success) {
          const costStr = (res.cost || soldiers * 2000).toLocaleString('fa-IR');
          showToast(`${soldiers} سرباز با موفقیت به باکس ارتش در خط مقدم تزریق شد (هزینه: ${costStr} سکه). ⚡`, 'success');
        } else {
          showToast(res.error, 'error');
        }
      });
    });
  }

  // End turn
  const btnEndTurn = document.getElementById('btn-end-turn');
  if (btnEndTurn) {
    btnEndTurn.addEventListener('click', () => {
      socket.emit('end_turn', { countryId: myPlayer.countryId }, res => {
        if (res.success) {
          showToast('نوبت شما به پایان رسید و به کشور بعدی منتقل شد. ⏱️', 'info');
        } else {
          showToast(res.error, 'error');
        }
      });
    });
  }

  // Battle Modal confirmation, retreat and close
  const closeBattleModal = () => {
    const modal = document.getElementById('battle-modal');
    if (modal) modal.classList.add('hidden');
    pendingAttackTarget = null;
  };
  window.clearPendingAttack = closeBattleModal;

  const btnCloseBattle = document.getElementById('btn-close-battle-modal');
  if (btnCloseBattle) btnCloseBattle.addEventListener('click', closeBattleModal);

  const btnRetreat = document.getElementById('btn-retreat-attack');
  if (btnRetreat) btnRetreat.addEventListener('click', closeBattleModal);

  const btnDoneBattle = document.getElementById('btn-done-battle');
  if (btnDoneBattle) btnDoneBattle.addEventListener('click', closeBattleModal);

  const btnConfirmAttack = document.getElementById('btn-confirm-attack');
  if (btnConfirmAttack) {
    btnConfirmAttack.addEventListener('click', () => {
      if (!pendingAttackTarget) return;
      const targetHexId = pendingAttackTarget.targetHexId;
      if (!selectedArmyBox && currentRoom && myPlayer.countryId) {
        const myCountry = currentRoom.countries[myPlayer.countryId];
        if (myCountry) {
          selectedArmyBox = myCountry.military.armyBoxes.find(b => b.id === pendingAttackTarget.boxId);
        }
      }
      closeBattleModal();
      executeArmyMove(targetHexId, true);
    });
  }
}

function updateWarUIStats() {
  setupWarEventListeners();
  if (!currentRoom || !myPlayer.countryId) return;
  const country = currentRoom.countries[myPlayer.countryId];
  if (!country) return;

  // Basic stats
  const fuelCount = country.military.fuelTokens || 0;
  const fuelEl = document.getElementById('war-fuel-count');
  if (fuelEl) fuelEl.textContent = fuelCount;
  const fuelDisplayEl = document.getElementById('war-fuel-count-display');
  if (fuelDisplayEl) fuelDisplayEl.textContent = fuelCount;
  const quickFuelEl = document.getElementById('quick-war-fuel-count');
  if (quickFuelEl) quickFuelEl.textContent = fuelCount;

  const techEl = document.getElementById('war-tech-mult');
  if (techEl) techEl.textContent = country.techMultiplier.toFixed(1) + '×';

  const budgetEl = document.getElementById('war-budget-display');
  if (budgetEl) budgetEl.textContent = (country.warBudget || 0).toLocaleString('fa-IR');

  // Update Turn Status Banner & End Turn Button
  updateWarTurnButtonState();
  _populateWarCarouselsAndDpad();
}

function updateWarTurnButtonState() {
  if (!currentRoom || !myPlayer.countryId) return;

  const statusDot = document.getElementById('war-turn-pulse-dot');
  const statusText = document.getElementById('war-turn-status-text');
  const btnEndTurn = document.getElementById('btn-end-turn');

  const isNoon = currentRoom.phase === 'noon';
  const activeCountry = currentRoom.activeCountryOrder && currentRoom.activeCountryOrder[currentRoom.noonActiveCountryIndex];
  const isMyTurn = isNoon && activeCountry === myPlayer.countryId;

  if (statusDot && statusText) {
    if (isNoon) {
      if (isMyTurn) {
        statusDot.className = 'status-pulse-dot';
        statusText.innerHTML = '🟢 <strong>نوبت عملیات نظامی شماست (فاز ظهر)</strong> — صدور فرمان حرکت، حمله و گسترش آزاد است.';
      } else {
        statusDot.className = 'status-pulse-dot waiting';
        const activeCountryName = COUNTRY_PERSIAN_NAMES[activeCountry] || activeCountry || 'کشور دیگر';
        statusText.innerHTML = `⏳ <strong>در انتظار نوبت ${activeCountryName}...</strong> (رصد زنده نقشه عملیات)`;
      }
    } else {
      statusDot.className = 'status-pulse-dot waiting';
      const phaseName = currentRoom.phase === 'morning' ? 'صبح' : 'شب';
      statusText.innerHTML = `🌙 <strong>فاز ${phaseName} فعال است</strong> — نوبت‌های حرکت ارتش و جنگ در فاز ظهر برگزار می‌شوند.`;
    }
  }

  // End Turn button visibility:
  // Strictly hidden in morning and night.
  // In noon, only visible when it's your turn and role is war!
  if (btnEndTurn) {
    if (isNoon && isMyTurn && myPlayer.role === 'war') {
      btnEndTurn.classList.remove('hidden');
      btnEndTurn.style.display = 'inline-flex';
      btnEndTurn.disabled = false;
      btnEndTurn.style.opacity = '1';
    } else {
      btnEndTurn.classList.add('hidden');
      btnEndTurn.style.display = 'none';
      btnEndTurn.disabled = true;
    }
  }
}
window.updateWarTurnButtonState = updateWarTurnButtonState;

function _populateWarCarouselsAndDpad() {
  if (!currentRoom || !myPlayer.countryId) return;
  const country = currentRoom.countries[myPlayer.countryId];
  if (!country) return;

  // Populate army boxes carousel
  const carousel = document.getElementById('army-boxes-carousel');
  const selectBox = document.getElementById('select-reinforce-box');
  const armySelectionSummary = document.getElementById('army-selection-summary');

  if (carousel) {
    carousel.innerHTML = '';
    const boxes = country.military.armyBoxes || [];
    if (boxes.length === 0) {
      carousel.innerHTML = '<div style="font-size: 0.8rem; color: #64748b; padding: 6px;">هیچ باکسی در ارتش وجود ندارد. از پادگان استخدام برای ایجاد باکس جدید استفاده کنید.</div>';
    } else {
      boxes.forEach((b, idx) => {
        const isSelected = selectedArmyBox && selectedArmyBox.id === b.id;
        const card = document.createElement('div');
        card.className = `army-card ${isSelected ? 'selected' : ''}`;
        card.innerHTML = `
          <div class="army-card-title">
            <span class="army-title-name">🎖️ تیپ #${idx + 1}</span>
            <span class="army-card-tag" style="background: ${b.movementRemaining > 0 ? '#14532d; color: #86efac; border: 1px solid #22c55e;' : '#450a0a; color: #fca5a5; border: 1px solid #ef4444;'}">
              ${b.movementRemaining > 0 ? 'آماده رزم 🟢' : 'پایان مانور 🔴'}
            </span>
          </div>
          <div class="army-card-soldiers">⚔️ ${b.soldiers} رزمنده</div>
          <div class="army-card-loc">📍 موضع: ${b.hexId}</div>
          <div class="army-card-moves ${b.movementRemaining > 0 ? '' : 'exhausted'}">
            🧭 مانور باقی‌مانده: ${b.movementRemaining} گام
          </div>
        `;
        card.addEventListener('click', () => {
          if (isExpansionMode) {
            isExpansionMode = false;
            updateExpansionButtonState();
          }
          selectedArmyBox = isSelected ? null : b;
          renderHexMap();
        });
        carousel.appendChild(card);
      });
    }
  }

  // Populate reinforcement dropdown
  if (selectBox) {
    const currentVal = selectBox.value;
    selectBox.innerHTML = '<option value="">انتخاب باکس ارتش...</option>';
    country.military.armyBoxes.forEach((b, idx) => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `باکس ${idx + 1} (${b.soldiers} سرباز در ${b.hexId})`;
      selectBox.appendChild(opt);
    });
    if (selectedArmyBox) {
      selectBox.value = selectedArmyBox.id;
    } else if (currentVal) {
      selectBox.value = currentVal;
    }
  }

  // Update D-Pad & Unit Selection
  const dpadLabel = document.getElementById('dpad-selected-unit-label');
  const dpadGrid = document.getElementById('dpad-directions-grid');
  const btnCancel = document.getElementById('btn-cancel-army-select');
  const quickUnitLabel = document.getElementById('quick-selected-unit-label');
  const btnQuickCancel = document.getElementById('btn-quick-cancel-army');

  if (selectedArmyBox) {
    const boxIndex = country.military.armyBoxes.findIndex(b => b.id === selectedArmyBox.id);
    if (armySelectionSummary) {
      armySelectionSummary.innerHTML = `<span style="color: #facc15; font-weight: bold;">🎯 باکس انتخابی #${boxIndex + 1} (${selectedArmyBox.soldiers} سرباز در ${selectedArmyBox.hexId})</span>`;
    }
    if (dpadLabel) {
      dpadLabel.textContent = `🧭 هدایت باکس #${boxIndex + 1} از موقعیت ${selectedArmyBox.hexId}:`;
    }
    if (btnCancel) btnCancel.classList.remove('hidden');
    if (quickUnitLabel) {
      quickUnitLabel.textContent = `ارتش #${boxIndex + 1}: ${selectedArmyBox.soldiers} سرباز (${selectedArmyBox.hexId}) - ${selectedArmyBox.movementRemaining} گام`;
    }
    if (btnQuickCancel) btnQuickCancel.classList.remove('hidden');

    // Build 6-directional D-Pad tiles
    if (dpadGrid) {
      dpadGrid.innerHTML = '';
      const currentHex = currentRoom.hexMap[selectedArmyBox.hexId];
      if (currentHex) {
        const isOdd = (currentHex.r & 1) === 1;
        DIRECTION_DEFINITIONS.forEach(dir => {
          const nq = isOdd ? currentHex.q + dir.dqOdd : currentHex.q + dir.dqEven;
          const nr = isOdd ? currentHex.r + dir.drOdd : currentHex.r + dir.drEven;
          const targetHex = currentRoom.hexMap[`hex_${nq}_${nr}`];

          const tile = document.createElement('div');
          tile.className = 'dpad-tile';

          if (!targetHex) {
            tile.classList.add('disabled');
            tile.innerHTML = `
              <span class="dpad-tile-dir">${dir.label}</span>
              <span class="dpad-tile-info">🌊 خارج نقشه</span>
            `;
          } else {
            const isFriendly = targetHex.owner === myPlayer.countryId;
            const isNeutral = targetHex.owner === 'neutral';

            if (isFriendly) {
              tile.classList.add('friendly');
              tile.innerHTML = `
                <span class="dpad-tile-dir">${dir.label}</span>
                <span class="dpad-tile-info" style="color: #93c5fd;">🛡️ خودی (${targetHex.id})</span>
              `;
            } else if (isNeutral) {
              tile.classList.add('neutral');
              tile.innerHTML = `
                <span class="dpad-tile-dir">${dir.label}</span>
                <span class="dpad-tile-info" style="color: #fde047;">🏳️ خنثی (${targetHex.id})</span>
              `;
            } else {
              tile.classList.add('enemy');
              const enemyName = COUNTRY_PERSIAN_NAMES[targetHex.owner] || targetHex.owner;
              tile.innerHTML = `
                <span class="dpad-tile-dir">${dir.label}</span>
                <span class="dpad-tile-info" style="color: #fca5a5; font-weight: bold;">⚔️ حمله (${enemyName})</span>
              `;
            }

            tile.addEventListener('click', () => {
              executeArmyMove(targetHex.id);
            });
          }
          dpadGrid.appendChild(tile);
        });
      }
    }
  } else {
    if (armySelectionSummary) {
      armySelectionSummary.textContent = 'هیچ باکسی انتخاب نشده است';
    }
    if (dpadLabel) {
      dpadLabel.textContent = '👆 برای هدایت، یک باکس را از بالا انتخاب کنید یا روی نقشه بزنید';
    }
    if (btnCancel) btnCancel.classList.add('hidden');
    if (quickUnitLabel) {
      quickUnitLabel.textContent = 'ارتش: انتخابی نشده';
    }
    if (btnQuickCancel) btnQuickCancel.classList.add('hidden');
    if (dpadGrid) {
      dpadGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: #64748b; font-size: 0.8rem; padding: 12px;">
          جهت فعال‌شدن جهت‌های حرکت، یکی از باکس‌های ارتش بالا را انتخاب کنید.
        </div>
      `;
    }
  }

  // Populate dynamic expansion destination chips
  const chipsList = document.getElementById('expansion-chips-list');
  if (chipsList && isExpansionMode) {
    chipsList.innerHTML = '';
    const expandableHexes = Object.values(currentRoom.hexMap).filter(h => isExpandableNeutralHex(h, myPlayer.countryId));
    if (expandableHexes.length === 0) {
      chipsList.innerHTML = '<span style="font-size: 0.8rem; color: #64748b;">هیچ هکس خنثی هم‌مرزی در دسترس نیست.</span>';
    } else {
      expandableHexes.forEach(h => {
        const chip = document.createElement('button');
        chip.className = 'expand-chip';
        chip.innerHTML = `<span>⛽ ${h.id}</span> <span style="font-size: 0.7rem; opacity: 0.8;">(۱ سوخت)</span>`;
        chip.addEventListener('click', () => {
          executeTerritoryExpansion(h.id);
        });
        chip.addEventListener('mouseenter', () => {
          const poly = document.querySelector(`#g_${h.id} polygon`);
          if (poly) poly.setAttribute('stroke', '#ffffff');
        });
        chip.addEventListener('mouseleave', () => {
          const poly = document.querySelector(`#g_${h.id} polygon`);
          if (poly) poly.setAttribute('stroke', '#4ade80');
        });
        chipsList.appendChild(chip);
      });
    }
  }
}
