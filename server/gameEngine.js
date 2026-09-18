// server/gameEngine.js
// Megagame V4 Core Logic and State Machine - Upgraded with Exact 7-Hex Country Clusters & Encirclement

const TIER_THRESHOLDS = [1, 4, 8, 12]; // Required cumulative tokens for Tier 1, 2, 3, 4 (Per PDF v4.2)

function calculateTier(tokens) {
  if (tokens < 1) return 0;
  if (tokens < 4) return 1;
  if (tokens < 8) return 2;
  if (tokens < 12) return 3;
  return 4;
}

const RESOURCE_KEYS = ['wheat', 'oven', 'brick', 'crane', 'cotton', 'sewing'];

// 5 Countries
const COUNTRY_DEFINITIONS = [
  { id: 'blue', name: 'آبی‌پلیس', color: '#2563eb' },
  { id: 'purple', name: 'بنفشه‌زار', color: '#9333ea' },
  { id: 'green', name: 'زمردیا', color: '#16a34a' },
  { id: 'grey', name: 'سیلورلند', color: '#64748b' },
  { id: 'red', name: 'سرخستان', color: '#dc2626' }
];

// Asymmetrical, Organic Landmass Blueprints (Connected continents with natural bays and peninsulas)
const MAP_BLUEPRINTS = [
  {
    name: 'قاره نامتقارن فالاک',
    rows: [
      { r: 0, ranges: [[4, 7], [13, 16]] },
      { r: 1, ranges: [[3, 8], [11, 16]] },
      { r: 2, ranges: [[1, 9], [11, 17]] },
      { r: 3, ranges: [[1, 17]] },
      { r: 4, ranges: [[0, 18]] },
      { r: 5, ranges: [[0, 17]] },
      { r: 6, ranges: [[1, 17]] },
      { r: 7, ranges: [[1, 17]] },
      { r: 8, ranges: [[2, 16]] },
      { r: 9, ranges: [[3, 15]] },
      { r: 10, ranges: [[6, 12], [14, 15]] }
    ]
  },
  {
    name: 'خلیج بزرگ استراتژیک',
    rows: [
      { r: 0, ranges: [[2, 7], [12, 17]] },
      { r: 1, ranges: [[1, 7], [10, 18]] },
      { r: 2, ranges: [[1, 6], [9, 18]] },
      { r: 3, ranges: [[0, 6], [8, 17]] },
      { r: 4, ranges: [[0, 17]] },
      { r: 5, ranges: [[1, 18]] },
      { r: 6, ranges: [[1, 17]] },
      { r: 7, ranges: [[2, 16]] },
      { r: 8, ranges: [[2, 15]] },
      { r: 9, ranges: [[4, 14]] },
      { r: 10, ranges: [[5, 12]] }
    ]
  },
  {
    name: 'مجمع‌الجزایر و گذرگاه‌ها',
    rows: [
      { r: 0, ranges: [[5, 9], [12, 16]] },
      { r: 1, ranges: [[3, 9], [11, 17]] },
      { r: 2, ranges: [[2, 18]] },
      { r: 3, ranges: [[1, 17]] },
      { r: 4, ranges: [[0, 16]] },
      { r: 5, ranges: [[1, 18]] },
      { r: 6, ranges: [[1, 17]] },
      { r: 7, ranges: [[0, 16]] },
      { r: 8, ranges: [[1, 15]] },
      { r: 9, ranges: [[3, 14]] },
      { r: 10, ranges: [[4, 11], [13, 15]] }
    ]
  }
];

// Odd-r offset coordinate math
function oddRToAxial(q, r) {
  const axialQ = q - Math.floor(r / 2);
  const axialR = r;
  return { q: axialQ, r: axialR, s: -axialQ - axialR };
}

function hexDistance(q1, r1, q2, r2) {
  const a = oddRToAxial(q1, r1);
  const b = oddRToAxial(q2, r2);
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
}

// 6 Adjacent hex directions for odd-r staggered grid
function getOddRNeighbors(q, r) {
  const isOdd = (r & 1) === 1;
  if (isOdd) {
    return [
      { dq: 1, dr: 0, res: 'wheat', name: 'مخزن گندم' },
      { dq: 1, dr: -1, res: 'oven', name: 'مخزن کوره/تنور' },
      { dq: 0, dr: -1, res: 'brick', name: 'مخزن آجر' },
      { dq: -1, dr: 0, res: 'crane', name: 'مخزن جرثقیل' },
      { dq: 0, dr: 1, res: 'cotton', name: 'مخزن پنبه' },
      { dq: 1, dr: 1, res: 'sewing', name: 'مخزن چرخ خیاطی' }
    ];
  } else {
    return [
      { dq: 1, dr: 0, res: 'wheat', name: 'مخزن گندم' },
      { dq: 0, dr: -1, res: 'oven', name: 'مخزن کوره/تنور' },
      { dq: -1, dr: -1, res: 'brick', name: 'مخزن آجر' },
      { dq: -1, dr: 0, res: 'crane', name: 'مخزن جرثقیل' },
      { dq: -1, dr: 1, res: 'cotton', name: 'مخزن پنبه' },
      { dq: 0, dr: 1, res: 'sewing', name: 'مخزن چرخ خیاطی' }
    ];
  }
}

// Legacy constant for backwards compatibility
const HEX_DIRECTIONS = [
  { dq: 1, dr: 0, res: 'wheat', name: 'مخزن گندم' },
  { dq: 1, dr: -1, res: 'oven', name: 'مخزن کوره/تنور' },
  { dq: 0, dr: -1, res: 'brick', name: 'مخزن آجر' },
  { dq: -1, dr: 0, res: 'crane', name: 'مخزن جرثقیل' },
  { dq: -1, dr: 1, res: 'cotton', name: 'مخزن پنبه' },
  { dq: 0, dr: 1, res: 'sewing', name: 'مخزن چرخ خیاطی' }
];

function generateTechPuzzle(level) {
  if (level <= 3) {
    const words = [
      { plain: 'VICTORY', shift: 3, cipher: 'YLFWRUB' },
      { plain: 'ECONOMY', shift: 2, cipher: 'GEQPQOA' },
      { plain: 'SOLDIER', shift: 4, cipher: 'WSPHMIV' },
      { plain: 'DEFENSE', shift: 1, cipher: 'EFGFO TF'.replace(' ', '') },
      { plain: 'EMPIRE', shift: 5, cipher: 'JRUNWJ' }
    ];
    const picked = words[Math.floor(Math.random() * words.length)];
    return {
      type: 'caesar',
      level,
      prompt: `رمزگشایی با الگوریتم سزار (شیفت ${picked.shift}): "${picked.cipher}"`,
      cipher: picked.cipher,
      shift: picked.shift,
      answer: picked.plain
    };
  } else if (level <= 6) {
    const circuits = [
      { prompt: 'مسیر انتقال انرژی از گره ۱ به ۴: زوایای ۴ اتصال را به ترتیب وارد کنید (راهنما: 90-180-0-90)', solution: '90-180-0-90' },
      { prompt: 'برقراری اتصال شبکه رادار ملی: زوایای ۴ مدار انتقال فرکانس را وارد کنید (راهنما: 0-90-180-270)', solution: '0-90-180-270' },
      { prompt: 'تثبیت جریان مدارهای ماهواره‌ای: ترتیب زوایای اتصال فاز را وارد کنید (راهنما: 180-0-90-180)', solution: '180-0-90-180' }
    ];
    const picked = circuits[(level - 4) % circuits.length];
    return {
      type: 'circuit',
      level,
      prompt: picked.prompt,
      nodes: [0, 90, 180, 270],
      solution: picked.solution,
      answer: picked.solution
    };
  } else if (level <= 9) {
    const seq = Array.from({ length: 6 }, () => Math.floor(Math.random() * 9) + 1).join('');
    return {
      type: 'memory',
      level,
      prompt: 'توالی ۶ رقمی نمایش داده شده را در حافظه نگه‌دارید و وارد کنید.',
      sequence: seq,
      answer: seq
    };
  } else {
    return {
      type: 'mega',
      level: 10,
      prompt: 'مگا پازل استراتژیک نهایی: رمز مختصات رادار دفاعی',
      answer: 'ALPHA-77'
    };
  }
}

class MegagameRoom {
  constructor(roomCode, hostId, hostUsername) {
    this.roomCode = roomCode;
    this.hostId = hostId;
    this.hostUsername = hostUsername || null;
    this.status = 'lobby';
    this.round = 1;
    this.phase = 'morning';
    this.phaseTimer = 120;
    this.noonCycle = 1;
    this.noonActiveCountryIndex = 0;
    this.activeCountryOrder = [];
    this.movementTrails = [];
    this.pendingTrades = [];
    this.members = {};
    if (hostId && hostUsername) {
      this.members[hostId] = { username: hostUsername.trim(), joinedAt: Date.now() };
    }

    this.countries = {};
    COUNTRY_DEFINITIONS.forEach(c => {
      this.countries[c.id] = {
        id: c.id,
        name: c.name,
        color: c.color,
        capitalHex: null,
        centerQ: null,
        centerR: null,
        isEliminated: false,
        treasury: 30000,
        warBudget: 5000,
        econBudget: 5000,
        techLevel: 1,
        techMultiplier: 1.0,
        currentPuzzle: generateTechPuzzle(1),
        puzzleUnlocked: false,
        economy: {
          toolsInventory: 6,
          populationInventory: 10,
          petals: {
            wheat: { toolTokens: 0, popTokens: 0, locked: false },
            oven: { toolTokens: 0, popTokens: 0, locked: false },
            brick: { toolTokens: 0, popTokens: 0, locked: false },
            crane: { toolTokens: 0, popTokens: 0, locked: false },
            cotton: { toolTokens: 0, popTokens: 0, locked: false },
            sewing: { toolTokens: 0, popTokens: 0, locked: false }
          },
          // Individual resource inventory
          storage: {
            wheat: 3, oven: 3, brick: 3, crane: 3, cotton: 3, sewing: 3,
            // Finished goods
            bread: 0, building: 0, clothes: 0
          },
          unpaidTaxes: 0,
          hasHarvestedThisNoon: false
        },
        military: {
          fuelTokens: 6,
          armyBoxes: [
            { id: `${c.id}_box_1`, hexId: null, soldiers: 30, movementRemaining: 2 }
          ],
          capitalSoldiers: 15,
          lossesInflicted: 0
        },
        players: {
          president: null,
          war: null,
          economy: null
        }
      };
    });

    this.hexMap = this.initHexMap();
  }

  initHexMap() {
    // 1. Select an asymmetrical, organic continent blueprint
    const blueprint = MAP_BLUEPRINTS[Math.floor(Math.random() * MAP_BLUEPRINTS.length)];
    this.mapLayoutName = blueprint.name;

    const map = {};
    blueprint.rows.forEach(row => {
      row.ranges.forEach(([q1, q2]) => {
        for (let q = q1; q <= q2; q++) {
          const hexId = `hex_${q}_${row.r}`;
          map[hexId] = {
            id: hexId,
            q,
            r: row.r,
            owner: 'neutral',
            isCapital: false,
            isResourceZone: false,
            resourceType: null,
            resourceName: null,
            armyBoxes: []
          };
        }
      });
    });

    // 2. Identify candidate centers with all 6 neighbors inside the landmass
    const candidates = Object.values(map).filter(h => {
      const dirs = getOddRNeighbors(h.q, h.r);
      return dirs.every(d => map[`hex_${h.q + d.dq}_${h.r + d.dr}`]);
    });

    // 3. Pick 5 well-spaced capital centers (minimum distance >= 4, fallback to >= 3)
    let chosenCenters = [];
    for (const minDist of [4, 3]) {
      for (let attempt = 0; attempt < 100; attempt++) {
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const picked = [];
        for (const cand of shuffled) {
          if (picked.every(p => hexDistance(p.q, p.r, cand.q, cand.r) >= minDist)) {
            picked.push(cand);
            if (picked.length === 5) break;
          }
        }
        if (picked.length === 5) {
          chosenCenters = picked;
          break;
        }
      }
      if (chosenCenters.length === 5) break;
    }

    // 4. Randomize which country gets which location
    const shuffledCountryIds = COUNTRY_DEFINITIONS.map(c => c.id).sort(() => Math.random() - 0.5);

    shuffledCountryIds.forEach((cId, idx) => {
      const centerHex = chosenCenters[idx];
      const cq = centerHex.q;
      const cr = centerHex.r;
      const capHexId = centerHex.id;

      // Assign Capital
      map[capHexId].owner = cId;
      map[capHexId].isCapital = true;
      map[capHexId].capitalCountry = cId;

      // Assign 6 Surrounding Resource Petals
      const dirs = getOddRNeighbors(cq, cr);
      dirs.forEach(dir => {
        const nHexId = `hex_${cq + dir.dq}_${cr + dir.dr}`;
        if (map[nHexId]) {
          map[nHexId].owner = cId;
          map[nHexId].isResourceZone = true;
          map[nHexId].resourceCountry = cId;
          map[nHexId].resourceType = dir.res;
          map[nHexId].resourceName = dir.name;
        }
      });

      // Update Country Object
      if (this.countries && this.countries[cId]) {
        this.countries[cId].capitalHex = capHexId;
        this.countries[cId].centerQ = cq;
        this.countries[cId].centerR = cr;
        if (this.countries[cId].military.armyBoxes.length > 0) {
          this.countries[cId].military.armyBoxes[0].hexId = capHexId;
        }
      }
    });

    return map;
  }

  isUsernameTaken(username, requestingSocketId = null) {
    if (!username) return false;
    const norm = username.trim().toLowerCase();
    if (!norm) return false;

    // 1. Check host username if host is connected or in grace period
    if (this.hostUsername && this.hostUsername.trim().toLowerCase() === norm) {
      if (this.hostId && this.hostId !== requestingSocketId) {
        return true;
      }
    }

    // 2. Check all slots across all countries
    for (const cId in this.countries) {
      const country = this.countries[cId];
      for (const role in country.players) {
        const occupant = country.players[role];
        if (occupant && occupant.username) {
          if (occupant.username.trim().toLowerCase() === norm) {
            if (occupant.socketId !== requestingSocketId) {
              return true;
            }
          }
        }
      }
    }

    // 3. Check active room members (e.g. users in lobby before claiming a slot)
    if (this.members) {
      for (const sId in this.members) {
        if (sId !== requestingSocketId) {
          const m = this.members[sId];
          if (m && m.username && m.username.trim().toLowerCase() === norm) {
            return true;
          }
        }
      }
    }

    return false;
  }

  addMember(socketId, username) {
    if (!this.members) this.members = {};
    if (socketId && username) {
      this.members[socketId] = { username: username.trim(), joinedAt: Date.now() };
    }
  }

  removeMember(socketId) {
    if (this.members && this.members[socketId]) {
      delete this.members[socketId];
    }
  }

  joinSlot(socketId, username, countryId, role) {
    const country = this.countries[countryId];
    if (!country) return { success: false, error: 'کشور نامعتبر است.' };
    if (!['president', 'war', 'economy'].includes(role)) return { success: false, error: 'نقش نامعتبر است.' };

    const normUser = (username || '').trim();
    if (!normUser) return { success: false, error: 'نام کاربری معتبر وارد کنید.' };

    // Check if another player is already using this username in this room
    if (this.isUsernameTaken(normUser, socketId)) {
      return { success: false, error: `نام "${normUser}" قبلاً در این اتاق انتخاب شده است. لطفاً نام دیگری انتخاب کنید.` };
    }

    this.leaveSlot(socketId);

    const occupant = country.players[role];
    if (this.status !== 'lobby') {
      // Game in progress: allow rejoin if unoccupied, disconnected, or matching username
      if (!occupant || occupant.username === normUser || occupant.disconnected) {
        country.players[role] = { socketId, username: normUser, disconnected: false };
        this.addMember(socketId, normUser);
        return { success: true, countryId, role, isPlaying: true };
      }
      return { success: false, error: 'بازی در حال اجراست و این جایگاه در اختیار کاربر دیگری است.' };
    }

    if (occupant) {
      if (occupant.username === normUser || occupant.disconnected) {
        country.players[role] = { socketId, username: normUser, disconnected: false };
        this.addMember(socketId, normUser);
        return { success: true, countryId, role, isPlaying: false };
      }
      return { success: false, error: 'این جایگاه قبلاً اشغال شده است.' };
    }

    country.players[role] = { socketId, username: normUser, disconnected: false };
    this.addMember(socketId, normUser);
    return { success: true, countryId, role, isPlaying: false };
  }

  disconnectPlayer(socketId) {
    for (const cId in this.countries) {
      const country = this.countries[cId];
      for (const role in country.players) {
        if (country.players[role] && country.players[role].socketId === socketId) {
          country.players[role].disconnected = true;
          country.players[role].disconnectedAt = Date.now();
          return { countryId: cId, role, player: country.players[role] };
        }
      }
    }
    return null;
  }

  vacatePlayerSlot(countryId, role, username) {
    const country = this.countries[countryId];
    if (country && country.players[role]) {
      if (!username || country.players[role].username === username) {
        const sId = country.players[role].socketId;
        country.players[role] = null;
        if (sId) this.removeMember(sId);
        return true;
      }
    }
    return false;
  }

  reconnectSlot(socketId, username, countryId, role) {
    const normUser = (username || '').trim();
    // If player didn't have a role yet (e.g. joined room but in lobby without selecting role)
    if (!countryId || !role) {
      if (normUser) this.addMember(socketId, normUser);
      return { success: true, countryId: null, role: null, isPlaying: this.status === 'playing' };
    }

    const country = this.countries[countryId];
    if (!country) return { success: false, error: 'کشور نامعتبر است.' };
    if (!['president', 'war', 'economy'].includes(role)) return { success: false, error: 'نقش نامعتبر است.' };

    const currentOccupant = country.players[role];

    // If slot is empty, occupied by same username, or marked disconnected:
    if (!currentOccupant || (normUser && currentOccupant.username.toLowerCase() === normUser.toLowerCase()) || currentOccupant.disconnected) {
      this.leaveSlot(socketId);
      country.players[role] = {
        socketId,
        username: normUser || (currentOccupant ? currentOccupant.username : 'بازیکن'),
        disconnected: false
      };
      if (normUser) this.addMember(socketId, normUser);
      return { success: true, countryId, role, isPlaying: this.status === 'playing' };
    }

    return { success: false, error: 'این جایگاه توسط بازیکن دیگری اشغال شده است.' };
  }

  transferEconBudget(countryId, targetCountryId, amount) {
    if (this.phase !== 'morning' && this.phase !== 'night') {
      return { success: false, error: 'تقسیم و انتقال بودجه فقط در فاز صبح یا شب امکان‌پذیر است.' };
    }
    const from = this.countries[countryId];
    if (!from) return { success: false, error: 'کشور نامعتبر است.' };
    if (amount <= 0) return { success: false, error: 'مبلغ نامعتبر است.' };

    if (targetCountryId === 'treasury' || targetCountryId === countryId) {
      if ((from.econBudget || 0) < amount) {
        return { success: false, error: 'موجودی بودجه وزارت اقتصاد کافی نیست.' };
      }
      from.econBudget -= amount;
      from.treasury = (from.treasury || 0) + amount;
      return { success: true, isToTreasury: true, econBudget: from.econBudget, treasury: from.treasury };
    }

    const to = this.countries[targetCountryId];
    if (!to) return { success: false, error: 'کشور نامعتبر است.' };
    if ((from.econBudget || 0) < amount) {
      return { success: false, error: 'موجودی بودجه وزارت اقتصاد کافی نیست.' };
    }
    from.econBudget -= amount;
    to.treasury = (to.treasury || 0) + amount;
    return { success: true, fromEconBudget: from.econBudget, toTreasury: to.treasury };
  }

  leaveSlot(socketId) {
    for (const cId in this.countries) {
      const country = this.countries[cId];
      for (const role in country.players) {
        if (country.players[role] && country.players[role].socketId === socketId) {
          const removed = { countryId: cId, role, username: country.players[role].username };
          country.players[role] = null;
          return removed;
        }
      }
    }
    return null;
  }

  findPlayer(socketId) {
    for (const cId in this.countries) {
      const country = this.countries[cId];
      for (const role in country.players) {
        if (country.players[role] && country.players[role].socketId === socketId) {
          return { countryId: cId, role, username: country.players[role].username };
        }
      }
    }
    return null;
  }

  isCountryFullyFilled(country) {
    return !!(
      country.players.president && country.players.president.username &&
      country.players.war && country.players.war.username &&
      country.players.economy && country.players.economy.username
    );
  }

  getActiveCountries() {
    return Object.values(this.countries).filter(c => {
      if (c.isEliminated) return false;
      return this.isCountryFullyFilled(c);
    });
  }

  startGame() {
    const readyCountries = Object.values(this.countries).filter(c => this.isCountryFullyFilled(c));
    if (readyCountries.length < 1) {
      return {
        success: false,
        error: 'برای شروع بازی، حداقل یک تیم باید هر ۳ بازیکن (رئیس‌جمهور، وزیر اقتصاد، وزیر جنگ) را تکمیل کرده باشد.'
      };
    }

    // Now eliminate any country that does not have all 3 players filled
    Object.values(this.countries).forEach(c => {
      if (!this.isCountryFullyFilled(c)) {
        c.isEliminated = true;
        c.treasury = 0;
        c.warBudget = 0;
        c.econBudget = 0;
        c.military.armyBoxes = [];
        c.military.capitalSoldiers = 0;

        // Wipe its hexes from the map -> convert into neutral territory
        Object.values(this.hexMap).forEach(h => {
          if (h.owner === c.id) {
            h.owner = 'neutral';
            h.isCapital = false;
            h.isResourceZone = false;
            h.capitalCountry = null;
            h.resourceCountry = null;
            h.resourceType = null;
            h.resourceName = null;
            h.armyBoxes = [];
          }
        });
      }
    });

    this.status = 'playing';
    this.round = 1;
    this.activeCountryOrder = readyCountries.map(c => c.id);
    this.startMorningPhase();
    return { success: true };
  }

  startMorningPhase() {
    this.phase = 'morning';
    this.phaseTimer = 120;

    Object.values(this.countries).forEach(c => {
      c.military.armyBoxes.forEach(b => {
        b.movementRemaining = 2;
      });
    });
  }

  resetTurnMovement(countryId) {
    const country = this.countries[countryId];
    if (country && country.military && country.military.armyBoxes) {
      country.military.armyBoxes.forEach(b => {
        b.movementRemaining = 2;
      });
    }
  }

  startNoonPhase() {
    this.phase = 'noon';
    this.noonCycle = 1;
    this.noonActiveCountryIndex = 0;
    this.phaseTimer = 40;
    Object.values(this.countries).forEach(c => { c.economy.hasHarvestedThisNoon = false; });
    if (this.activeCountryOrder && this.activeCountryOrder.length > 0) {
      this.resetTurnMovement(this.activeCountryOrder[0]);
    }
  }

  nextNoonTurn() {
    this.noonActiveCountryIndex++;
    if (this.noonActiveCountryIndex >= this.activeCountryOrder.length) {
      this.noonActiveCountryIndex = 0;
      this.noonCycle++;
      if (this.noonCycle > 5) {
        this.startNightPhase();
        return;
      }
    }
    this.phaseTimer = 40;
    if (this.activeCountryOrder && this.activeCountryOrder.length > 0) {
      this.resetTurnMovement(this.activeCountryOrder[this.noonActiveCountryIndex]);
    }
  }

  startNightPhase() {
    this.phase = 'night';
    this.phaseTimer = 60;
    this.settleNight();
  }

  settleNight() {
    this.getActiveCountries().forEach(c => {
      const storage = c.economy.storage;
      let missedTaxes = 0;

      if (storage.bread >= 1) storage.bread -= 1;
      else missedTaxes++;

      if (storage.building >= 1) storage.building -= 1;
      else missedTaxes++;

      if (storage.clothes >= 1) storage.clothes -= 1;
      else missedTaxes++;

      c.economy.unpaidTaxes += missedTaxes;

      if (missedTaxes === 0) {
        c.economy.populationInventory += 2;
      }

      // Night Resource Hex Income (1000 coins per controlled resource hex, per PDF v4.2)
      const controlledResourceCount = Object.values(this.hexMap).filter(h => h.isResourceZone && h.owner === c.id).length;
      const resourceIncome = controlledResourceCount * 1000;
      c.treasury += resourceIncome;
    });

    // Check Encirclement Rings
    this.checkEncirclement();
  }

  nextRoundOrEnd() {
    if (this.round >= 8) {
      this.status = 'finished';
      return;
    }
    this.round++;
    this.startMorningPhase();
  }

  // --- Economy Actions ---
  updatePetalTokens(countryId, petalKey, toolTokens, popTokens) {
    if (this.phase !== 'morning') {
      return { success: false, error: 'جابه‌جایی مهره‌ها فقط در فاز صبح مجاز است.' };
    }
    const country = this.countries[countryId];
    if (!country) return { success: false, error: 'کشور یافت نشد.' };

    const petal = country.economy.petals[petalKey];
    if (!petal) return { success: false, error: 'بخش اقتصادی نامعتبر است.' };
    if (petal.locked) {
      return { success: false, error: 'این مخزن توسط دشمن اشغال شده و قفل است!' };
    }

    const toolDelta = toolTokens - petal.toolTokens;
    const popDelta = popTokens - petal.popTokens;

    if (country.economy.toolsInventory < toolDelta) {
      return { success: false, error: 'موجودی توکن ابزار کافی نیست.' };
    }
    if (country.economy.populationInventory < popDelta) {
      return { success: false, error: 'موجودی توکن جمعیت کافی نیست.' };
    }

    country.economy.toolsInventory -= toolDelta;
    country.economy.populationInventory -= popDelta;
    petal.toolTokens = toolTokens;
    petal.popTokens = popTokens;

    return { success: true, economy: country.economy };
  }

  buyTool(countryId, count = 1) {
    const country = this.countries[countryId];
    const cost = count * 5000;
    if ((country.econBudget || 0) < cost) {
      return { success: false, error: 'بودجه وزارت اقتصاد برای خرید ابزار کافی نیست. از رئیس‌جمهور درخواست بودجه کنید.' };
    }
    country.econBudget -= cost;
    country.economy.toolsInventory += count;
    return { success: true, econBudget: country.econBudget, toolsInventory: country.economy.toolsInventory };
  }

  // Called at noon: harvest production from petals into individual resource storage
  harvestProducts(countryId) {
    if (this.phase !== 'noon') {
      return { success: false, error: 'برداشت محصولات فقط در فاز ظهر مجاز است.' };
    }
    const country = this.countries[countryId];
    if (country.economy.hasHarvestedThisNoon) {
      return { success: false, error: 'در این دور ظهر قبلاً برداشت کردهاید. فقط یک بار در هر دور ظهر میتوانید برداشت کنید.' };
    }
    country.economy.hasHarvestedThisNoon = true;
    const p = country.economy.petals;
    const storage = country.economy.storage;

    // Each petal produces its individual resource
    const RESOURCE_KEYS = ['wheat', 'oven', 'brick', 'crane', 'cotton', 'sewing'];
    const produced = {};
    RESOURCE_KEYS.forEach(key => {
      const petal = p[key];
      const out = petal.locked ? 0 : calculateTier(petal.toolTokens) * calculateTier(petal.popTokens);
      storage[key] = (storage[key] || 0) + out;
      produced[key] = out;
    });

    return {
      success: true,
      produced,
      storage: country.economy.storage
    };
  }

  // Craft raw resources into finished goods (bread, building, clothes) for storage/taxes
  craftProduct(countryId, productType) {
    if (this.phase !== 'noon') {
      return { success: false, error: 'تولید محصولات نهایی فقط در فاز ظهر مجاز است.' };
    }
    const country = this.countries[countryId];
    if (!country) return { success: false, error: 'کشور یافت نشد.' };
    const storage = country.economy.storage;

    const RECIPES = {
      bread: { inputs: ['wheat', 'oven'], output: 'bread' },
      building: { inputs: ['brick', 'crane'], output: 'building' },
      clothes: { inputs: ['cotton', 'sewing'], output: 'clothes' }
    };

    const recipe = RECIPES[productType];
    if (!recipe) {
      return { success: false, error: 'نوع محصول نامعتبر است. (bread/building/clothes)' };
    }

    const [r1, r2] = recipe.inputs;
    if ((storage[r1] || 0) < 1 || (storage[r2] || 0) < 1) {
      return {
        success: false,
        error: `موجودی مواد اولیه برای ساخت ${productType} کافی نیست. نیاز: ۱ ${r1} + ۱ ${r2}`
      };
    }

    storage[r1] -= 1;
    storage[r2] -= 1;
    storage[recipe.output] = (storage[recipe.output] || 0) + 1;

    return {
      success: true,
      productType,
      quantity: storage[recipe.output],
      econBudget: country.econBudget,
      storage: country.economy.storage
    };
  }

  // Sell 1 finished good to global market for 5000 coins (Per PDF v4.2)
  sellProduct(countryId, productType) {
    if (this.phase !== 'noon') {
      return { success: false, error: 'فروش محصولات فقط در فاز ظهر مجاز است.' };
    }
    const country = this.countries[countryId];
    if (!country) return { success: false, error: 'کشور یافت نشد.' };
    const storage = country.economy.storage;

    const RECIPES = {
      bread: { inputs: ['wheat', 'oven'], output: 'bread' },
      building: { inputs: ['brick', 'crane'], output: 'building' },
      clothes: { inputs: ['cotton', 'sewing'], output: 'clothes' }
    };

    const recipe = RECIPES[productType];
    if (!recipe) {
      return { success: false, error: 'نوع محصول نامعتبر است. (bread/building/clothes)' };
    }

    // 1. If we already have finished good in storage, sell 1 unit from storage
    if ((storage[recipe.output] || 0) >= 1) {
      storage[recipe.output] -= 1;
      const revenue = 5000;
      country.treasury = (country.treasury || 0) + revenue;

      return {
        success: true,
        productType,
        quantity: 1,
        revenue,
        treasury: country.treasury,
        econBudget: country.econBudget,
        storage: country.economy.storage
      };
    }

    // 2. Otherwise, check if we have enough raw inputs to craft and sell 1 unit directly
    const [r1, r2] = recipe.inputs;
    if ((storage[r1] || 0) < 1 || (storage[r2] || 0) < 1) {
      return {
        success: false,
        error: `محصول نهایی ${productType} در انبار موجود نیست و مواد خام کافی (۱ ${r1} + ۱ ${r2}) نیز ندارید.`
      };
    }

    storage[r1] -= 1;
    storage[r2] -= 1;
    const revenue = 5000;
    country.treasury = (country.treasury || 0) + revenue;

    return {
      success: true,
      productType,
      quantity: 1,
      revenue,
      treasury: country.treasury,
      econBudget: country.econBudget,
      storage: country.economy.storage
    };
  }

  // Legacy - sell all available pairs automatically (kept for backwards compat)
  sellProducts(countryId) {
    return this.harvestProducts(countryId);
  }



  // --- Military Actions ---
  allocateMinistryBudget(countryId, ministry, amount) {
    const country = this.countries[countryId];
    if (!country) return { success: false, error: 'کشور نامعتبر است.' };
    if (amount <= 0) return { success: false, error: 'مبلغ نامعتبر است.' };
    if (country.treasury < amount) {
      return { success: false, error: 'موجودی خزانه ملی برای این تخصیص کافی نیست.' };
    }
    country.treasury -= amount;
    if (ministry === 'war') {
      country.warBudget = (country.warBudget || 0) + amount;
    } else if (ministry === 'economy') {
      country.econBudget = (country.econBudget || 0) + amount;
    } else {
      return { success: false, error: 'وزارتخانه نامعتبر است.' };
    }
    return {
      success: true,
      ministry,
      amount,
      treasury: country.treasury,
      warBudget: country.warBudget,
      econBudget: country.econBudget
    };
  }

  reclaimMinistryBudget(countryId, ministry, amount) {
    const country = this.countries[countryId];
    if (!country) return { success: false, error: 'کشور نامعتبر است.' };
    if (amount <= 0) return { success: false, error: 'مبلغ نامعتبر است.' };
    if (ministry === 'war') {
      if ((country.warBudget || 0) < amount) return { success: false, error: 'موجودی بودجه جنگ کافی نیست.' };
      country.warBudget -= amount;
      country.treasury += amount;
    } else if (ministry === 'economy') {
      if ((country.econBudget || 0) < amount) return { success: false, error: 'موجودی بودجه اقتصاد کافی نیست.' };
      country.econBudget -= amount;
      country.treasury += amount;
    }
    return {
      success: true,
      ministry,
      amount,
      treasury: country.treasury,
      warBudget: country.warBudget,
      econBudget: country.econBudget
    };
  }

  transferMinistryBudgetToTreasury(countryId, ministry, amount) {
    return this.reclaimMinistryBudget(countryId, ministry, amount);
  }

  buyFuel(countryId, count = 1) {
    const country = this.countries[countryId];
    const cost = count * 500;
    if ((country.warBudget || 0) < cost) {
      return { success: false, error: 'بودجه وزارت جنگ برای خرید سوخت کافی نیست. از رئیس‌جمهور درخواست بودجه کنید.' };
    }
    country.warBudget -= cost;
    country.military.fuelTokens += count;
    return { success: true, fuel: country.military.fuelTokens, warBudget: country.warBudget };
  }

  // Buying army: can deploy on any of the country's 6 colored resource zones or capital!
  buyArmyBox(countryId, soldiers, deployHexId = null) {
    if (soldiers < 30) {
      return { success: false, error: 'حداقل تعداد سرباز برای ایجاد باکس جدید ۳۰ نفر است.' };
    }
    const country = this.countries[countryId];
    const cost = soldiers * 1000;
    if ((country.warBudget || 0) < cost) {
      return { success: false, error: 'بودجه وزارت جنگ برای خرید سرباز کافی نیست. از رئیس‌جمهور درخواست بودجه کنید.' };
    }

    // Default to capital if not specified
    let targetHex = deployHexId ? this.hexMap[deployHexId] : this.hexMap[country.capitalHex];
    if (!targetHex || targetHex.owner !== countryId) {
      targetHex = this.hexMap[country.capitalHex];
    }

    country.warBudget -= cost;
    const boxId = `${countryId}_box_${Date.now()}`;
    const newBox = {
      id: boxId,
      hexId: targetHex.id,
      soldiers,
      movementRemaining: 2
    };
    country.military.armyBoxes.push(newBox);
    return { success: true, newBox, warBudget: country.warBudget };
  }

  reinforceBox(countryId, boxId, soldiers) {
    const country = this.countries[countryId];
    const cost = soldiers * 1000; // Per PDF v4.2: 1000 coins per reinforced soldier
    if ((country.warBudget || 0) < cost) {
      return { success: false, error: 'بودجه وزارت جنگ برای شارژ ارتش در خط مقدم کافی نیست. از رئیس‌جمهور درخواست بودجه کنید.' };
    }
    const box = country.military.armyBoxes.find(b => b.id === boxId);
    if (!box) return { success: false, error: 'باکس ارتش یافت نشد.' };

    country.warBudget -= cost;
    box.soldiers += soldiers;
    return { success: true, box, warBudget: country.warBudget };
  }

  moveArmyBox(countryId, boxId, targetHexId) {
    if (this.phase !== 'noon') {
      return { success: false, error: 'حرکت ارتش فقط در فاز ظهر مجاز است.' };
    }
    const currentActiveCountryId = this.activeCountryOrder[this.noonActiveCountryIndex];
    if (currentActiveCountryId !== countryId) {
      return { success: false, error: 'اکنون نوبت حرکت شما نیست.' };
    }

    const country = this.countries[countryId];
    const box = country.military.armyBoxes.find(b => b.id === boxId);
    if (!box) return { success: false, error: 'باکس ارتش یافت نشد.' };

    const currentHex = this.hexMap[box.hexId];
    const targetHex = this.hexMap[targetHexId];
    if (!currentHex || !targetHex) return { success: false, error: 'هکس نامعتبر است.' };

    const isNeighbor = this.getNeighbors(currentHex).some(n => n.id === targetHex.id);
    if (!isNeighbor) {
      return { success: false, error: 'حرکت فقط به هکس‌های مجاور امکان‌پذیر است.' };
    }

    const isFriendly = targetHex.owner === countryId;
    const isEnemy = targetHex.owner !== 'neutral' && targetHex.owner !== countryId;

    // ALL movement costs 1 fuel
    if (country.military.fuelTokens < 1) {
      return { success: false, error: 'برای حرکت نیاز به ۱ سوخت دارید (۵۰۰ سکه).' };
    }
    if (box.movementRemaining <= 0) {
      return { success: false, error: 'این باکس ارتش در این نوبت تمام حرکتهای خود را انجام داده است.' };
    }
    country.military.fuelTokens -= 1;
    box.movementRemaining -= 1;

    // Per PDF v4.2: Movement in friendly & neutral is free; entering enemy hex stops movement
    if (isEnemy) {
      box.movementRemaining = 0;
    }

    this.movementTrails.push({
      country: countryId,
      fromHex: currentHex.id,
      toHex: targetHex.id,
      round: this.round
    });

    if (isEnemy) {
      const combatResult = this.resolveCombat(countryId, box, targetHex);
      this.syncResourceLocks();
      this.checkEncirclement();
      return { success: true, combat: combatResult, trails: this.movementTrails };
    }

    box.hexId = targetHex.id;
    targetHex.owner = countryId;

    this.syncResourceLocks();
    this.checkEncirclement();

    return { success: true, box, targetHex, trails: this.movementTrails };
  }

  expandTerritory(countryId, targetHexId) {
    if (this.phase !== 'noon') {
      return { success: false, error: 'گسترش قلمرو فقط در فاز ظهر مجاز است.' };
    }
    const currentActiveCountryId = this.activeCountryOrder[this.noonActiveCountryIndex];
    if (currentActiveCountryId !== countryId) {
      return { success: false, error: 'اکنون نوبت شما نیست.' };
    }

    const country = this.countries[countryId];
    if (!country || country.isEliminated) {
      return { success: false, error: 'کشور نامعتبر یا حذف شده است.' };
    }

    const targetHex = this.hexMap[targetHexId];
    if (!targetHex) {
      return { success: false, error: 'هکس نامعتبر است.' };
    }

    if (targetHex.owner === countryId) {
      return { success: false, error: 'این هکس در حال حاضر متعلق به کشور شماست.' };
    }

    if (targetHex.owner !== 'neutral') {
      return { success: false, error: 'تنها هکس‌های خنثی را می‌توان با سوخت گسترش داد. برای تصرف هکس دشمن باید با ارتش حمله کنید.' };
    }

    const bordersFriendly = this.getNeighbors(targetHex).some(n => n.owner === countryId);
    if (!bordersFriendly) {
      return { success: false, error: 'تنها هکس‌های خنثی که با قلمرو شما هم‌مرز هستند قابل گسترش می‌باشند.' };
    }

    if (country.military.fuelTokens < 1) {
      return { success: false, error: 'برای گسترش قلمرو به حداقل ۱ توکن سوخت نیاز دارید (۵۰۰ سکه).' };
    }

    country.military.fuelTokens -= 1;
    targetHex.owner = countryId;

    this.syncResourceLocks();
    this.checkEncirclement();

    return {
      success: true,
      targetHex,
      fuelTokens: country.military.fuelTokens
    };
  }

  resolveCombat(attCountryId, attBox, targetHex) {
    const defCountryId = targetHex.owner;
    const attCountry = this.countries[attCountryId];
    const defCountry = this.countries[defCountryId];

    const defBoxes = defCountry.military.armyBoxes.filter(b => b.hexId === targetHex.id);
    let defSoldiers = defBoxes.reduce((acc, b) => acc + b.soldiers, 0);

    const isCapital = targetHex.isCapital && targetHex.capitalCountry === defCountryId;
    if (isCapital) {
      defSoldiers += defCountry.military.capitalSoldiers;
    }

    const initialAttSoldiers = attBox.soldiers;
    const initialDefSoldiers = defSoldiers;
    const attTechMultiplier = attCountry.techMultiplier;
    const defTechMultiplier = defCountry.techMultiplier;
    const defCapMultiplier = isCapital ? 2.0 : 0.0;
    const totalDefMultiplier = defTechMultiplier + defCapMultiplier;

    const attPower = initialAttSoldiers * attTechMultiplier;
    const defPower = initialDefSoldiers * totalDefMultiplier;

    let winner, loser, survivingSoldiers;

    if (attPower >= defPower) {
      winner = attCountryId;
      loser = defCountryId;
      const excess = attPower - defPower;
      survivingSoldiers = Math.floor(excess / attCountry.techMultiplier);

      attCountry.military.lossesInflicted += initialDefSoldiers;
      attBox.soldiers = survivingSoldiers;
      attBox.hexId = targetHex.id;
      targetHex.owner = attCountryId;

      defCountry.military.armyBoxes = defCountry.military.armyBoxes.filter(b => b.hexId !== targetHex.id);

      if (isCapital) {
        defCountry.isEliminated = true;
        attCountry.treasury += defCountry.treasury;
        defCountry.treasury = 0;
        Object.values(this.hexMap).forEach(h => {
          if (h.owner === defCountryId) h.owner = attCountryId;
        });

        // Remove eliminated country from active turn order
        this.activeCountryOrder = this.activeCountryOrder.filter(id => id !== defCountryId);
        if (this.noonActiveCountryIndex >= this.activeCountryOrder.length) {
          this.noonActiveCountryIndex = 0;
        }
      }
    } else {
      winner = defCountryId;
      loser = attCountryId;
      const excess = defPower - attPower;
      survivingSoldiers = Math.floor(excess / totalDefMultiplier);

      defCountry.military.lossesInflicted += initialAttSoldiers;
      attCountry.military.armyBoxes = attCountry.military.armyBoxes.filter(b => b.id !== attBox.id);

      if (defBoxes.length > 0) {
        defBoxes[0].soldiers = survivingSoldiers;
      }
    }

    return {
      winner,
      loser,
      attCountryId,
      defCountryId,
      attSoldiers: initialAttSoldiers,
      defSoldiers: initialDefSoldiers,
      attTechMultiplier,
      defTechMultiplier,
      isCapital: !!isCapital,
      defCapMultiplier,
      totalDefMultiplier,
      attPower,
      defPower,
      survivingSoldiers,
      isCapitalConquered: isCapital && winner === attCountryId,
      targetHexId: targetHex.id
    };
  }

  // Cross-Platform Raiding: Lock/unlock resource petals if enemy captured the hex!
  syncResourceLocks() {
    Object.values(this.hexMap).forEach(hex => {
      if (hex.isResourceZone && hex.resourceCountry) {
        const homeCountry = this.countries[hex.resourceCountry];
        if (homeCountry && homeCountry.economy.petals[hex.resourceType]) {
          // If hex is captured by someone else, petal is locked!
          const isOccupiedByEnemy = hex.owner !== hex.resourceCountry;
          homeCountry.economy.petals[hex.resourceType].locked = isOccupiedByEnemy;
        }
      }
    });
  }

  // Ring Encirclement (رینگ‌کشی و محاصره مناطق خنثی)
  checkEncirclement() {
    // For each country, check if neutral hexes are completely encircled
    COUNTRY_DEFINITIONS.forEach(c => {
      const countryId = c.id;
      // Find all neutral hexes
      const neutralHexes = Object.values(this.hexMap).filter(h => h.owner === 'neutral' && !h.isCapital);

      // Connected components of neutral hexes
      const visited = new Set();
      neutralHexes.forEach(startHex => {
        if (visited.has(startHex.id)) return;

        const component = [];
        const queue = [startHex];
        visited.add(startHex.id);
        let touchesMapEdge = false;
        let ringIsPureCountry = true;

        while (queue.length > 0) {
          const curr = queue.shift();
          component.push(curr);

          const neighbors = this.getNeighbors(curr);
          // If on edge of the map (touches the sea/border of asymmetrical continent)
          if (neighbors.length < 6) {
            touchesMapEdge = true;
          }

          neighbors.forEach(n => {
            if (n.owner === 'neutral') {
              if (!visited.has(n.id)) {
                visited.add(n.id);
                queue.push(n);
              }
            } else if (n.owner !== countryId) {
              ringIsPureCountry = false;
            }
          });
        }

        // If this neutral enclave does not touch map edge and all surrounding boundaries are owned by countryId:
        if (!touchesMapEdge && ringIsPureCountry && component.length > 0 && component.length <= 12) {
          component.forEach(h => {
            h.owner = countryId;
          });
        }
      });
    });
  }

  getNeighbors(hex) {
    const directions = getOddRNeighbors(hex.q, hex.r);
    return directions.map(d => this.hexMap[`hex_${hex.q + d.dq}_${hex.r + d.dr}`]).filter(Boolean);
  }

  transferCoins(fromCountryId, toCountryId, amount) {
    const from = this.countries[fromCountryId];
    const to = this.countries[toCountryId];
    if (!from || !to || from.isEliminated || to.isEliminated) {
      return { success: false, error: 'کشور مبدا یا مقصد نامعتبر است یا از بازی حذف شده است.' };
    }
    if (amount <= 0 || from.treasury < amount) {
      return { success: false, error: 'موجودی سکه کافی نیست.' };
    }
    from.treasury -= amount;
    to.treasury += amount;
    return { success: true, fromTreasury: from.treasury, toTreasury: to.treasury };
  }

  unlockTechPuzzle(countryId) {
    const country = this.countries[countryId];
    if (!country || country.isEliminated) {
      return { success: false, error: 'این کشور از بازی حذف شده است.' };
    }
    if (country.treasury < 5000) {
      return { success: false, error: 'برای باز کردن پازل به ۵۰۰۰ سکه نیاز دارید.' };
    }
    country.treasury -= 5000;
    country.puzzleUnlocked = true;
    return { success: true, puzzle: country.currentPuzzle, treasury: country.treasury };
  }

  submitTechPuzzle(countryId, answer) {
    const country = this.countries[countryId];
    if (!country || country.isEliminated) {
      return { success: false, error: 'این کشور از بازی حذف شده است.' };
    }
    if (country.treasury < 2000) {
      return { success: false, error: 'ثبت پاسخ نیازمند ۲۰۰۰ سکه است.' };
    }
    country.treasury -= 2000;

    const puzzle = country.currentPuzzle;
    const isCorrect = String(answer).trim().toUpperCase() === String(puzzle.answer).trim().toUpperCase();

    if (isCorrect) {
      country.techLevel += 1;
      // Per PDF v4.2: +0.1 Tech Multiplier per puzzle solved
      country.techMultiplier = Number((1.0 + (country.techLevel - 1) * 0.1).toFixed(1));

      country.currentPuzzle = generateTechPuzzle(country.techLevel);
      country.puzzleUnlocked = false;

      return {
        success: true,
        isCorrect: true,
        newLevel: country.techLevel,
        multiplier: country.techMultiplier,
        treasury: country.treasury
      };
    } else {
      return {
        success: true,
        isCorrect: false,
        message: 'پاسخ نادرست بود. دوباره تلاش کنید.',
        treasury: country.treasury
      };
    }
  }

  // --- End of Game Scoring ---
  calculateFinalScores() {
    const scores = [];
    Object.values(this.countries).forEach(c => {
      // 1. Economic Score: 1 pt per 1000 coins + 5 pts per finished good (bread, building, clothes)
      const coinPoints = Math.floor(c.treasury / 1000);
      const goodsPoints = ((c.economy.storage.bread || 0) + (c.economy.storage.building || 0) + (c.economy.storage.clothes || 0)) * 5;
      const econScore = coinPoints + goodsPoints;

      // 2. Military Score: 10 pts per owned hex + 20 pts per controlled enemy resource hex + 50 pts per conquered capital
      let hexPoints = 0;
      Object.values(this.hexMap).forEach(h => {
        if (h.owner === c.id) {
          hexPoints += 10;
          if (h.isResourceZone && h.resourceCountry !== c.id) {
            hexPoints += 20;
          }
          if (h.isCapital && h.capitalCountry !== c.id) {
            hexPoints += 50;
          }
        }
      });
      const milScore = hexPoints + c.military.lossesInflicted;

      // 3. Tech Score: 15 pts per Tech Level
      const techScore = c.techLevel * 15;

      const totalPoints = c.isEliminated ? 0 : (econScore + milScore + techScore);

      scores.push({
        id: c.id,
        name: c.name,
        color: c.color,
        isEliminated: c.isEliminated,
        econScore,
        milScore,
        techScore,
        totalPoints
      });
    });

    scores.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.econScore - a.econScore;
    });

    return scores;
  }

  proposeTrade(fromCountryId, toCountryId, goodType, quantity, price, tradeType = 'sell') {
    const from = this.countries[fromCountryId];
    if (!from || from.isEliminated) {
      return { success: false, error: 'کشور فرستنده نامعتبر یا از بازی حذف شده است.' };
    }

    const isBroadcast = toCountryId === 'all';
    if (!isBroadcast) {
      const to = this.countries[toCountryId];
      if (!to || fromCountryId === toCountryId || to.isEliminated) {
        return { success: false, error: 'کشور مقصد نامعتبر یا از بازی حذف شده است.' };
      }
    }

    const validGoods = ['bread', 'building', 'clothes'];
    if (!validGoods.includes(goodType)) {
      return { success: false, error: 'نوع کالا نامعتبر است.' };
    }
    if (quantity <= 0 || price < 0) {
      return { success: false, error: 'مقدار یا قیمت نامعتبر است.' };
    }

    const type = tradeType === 'buy' ? 'buy' : 'sell';

    if (type === 'buy') {
      // Proposer wants to buy goods in exchange for coins
      if (from.treasury < price) {
        return { success: false, error: `سکه کافی در خزانه ندارید (موجودی: ${from.treasury.toLocaleString()}، نیاز: ${price.toLocaleString()}).` };
      }
    } else {
      // Proposer wants to sell goods from storage in exchange for coins
      if ((from.economy.storage[goodType] || 0) < quantity) {
        return { success: false, error: `موجودی ${goodType} در انبار شما کافی نیست.` };
      }
    }

    const trade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
      fromCountryId,
      toCountryId: isBroadcast ? 'all' : toCountryId,
      tradeType: type,
      goodType,
      quantity,
      price,
      status: 'pending',
      createdAt: Date.now()
    };
    this.pendingTrades.push(trade);
    return { success: true, trade };
  }

  acceptTrade(tradeId, acceptingCountryId) {
    const tradeIdx = this.pendingTrades.findIndex(t => t.id === tradeId);
    if (tradeIdx === -1) return { success: false, error: 'پیشنهاد معامله یافت نشد یا قبلاً تعیین تکلیف شده است.' };
    const trade = this.pendingTrades[tradeIdx];

    // Validate target country
    if (trade.toCountryId !== 'all' && trade.toCountryId !== acceptingCountryId) {
      return { success: false, error: 'این معامله برای کشور دیگری است.' };
    }
    if (trade.fromCountryId === acceptingCountryId) {
      return { success: false, error: 'شما نمی‌توانید معامله پیشنهادی خودتان را قبول کنید.' };
    }

    // Determine buyer and seller based on tradeType
    let buyerCountryId, sellerCountryId;
    if (trade.tradeType === 'buy') {
      // Proposer (fromCountryId) is the buyer; accepting country is the seller (supplier)
      buyerCountryId = trade.fromCountryId;
      sellerCountryId = acceptingCountryId;
    } else {
      // Proposer (fromCountryId) is the seller; accepting country is the buyer
      sellerCountryId = trade.fromCountryId;
      buyerCountryId = acceptingCountryId;
    }

    const buyer = this.countries[buyerCountryId];
    const seller = this.countries[sellerCountryId];
    if (!buyer || !seller || buyer.isEliminated || seller.isEliminated) {
      return { success: false, error: 'یکی از طرفین معامله از بازی حذف شده است.' };
    }
    if (buyer.treasury < trade.price) {
      return { success: false, error: `خریدار (${buyerCountryId}) سکه کافی در خزانه برای پرداخت این معامله ندارد.` };
    }
    if ((seller.economy.storage[trade.goodType] || 0) < trade.quantity) {
      return { success: false, error: `فروشنده (${sellerCountryId}) کالای کافی در انبار ندارد.` };
    }

    buyer.treasury -= trade.price;
    seller.treasury += trade.price;
    seller.economy.storage[trade.goodType] -= trade.quantity;
    buyer.economy.storage[trade.goodType] = (buyer.economy.storage[trade.goodType] || 0) + trade.quantity;
    trade.status = 'accepted';
    trade.acceptedByCountryId = acceptingCountryId;
    this.pendingTrades.splice(tradeIdx, 1);
    return { 
      success: true, 
      trade, 
      buyerCountryId, 
      sellerCountryId, 
      sellerTreasury: seller.treasury, 
      buyerTreasury: buyer.treasury 
    };
  }

  rejectTrade(tradeId, rejectingCountryId) {
    const tradeIdx = this.pendingTrades.findIndex(t => t.id === tradeId);
    if (tradeIdx === -1) return { success: false, error: 'پیشنهاد معامله یافت نشد.' };
    const trade = this.pendingTrades[tradeIdx];

    // Proposer can cancel their trade (whether broadcast or targeted)
    // Targeted country can reject targeted trade
    if (trade.fromCountryId === rejectingCountryId || trade.toCountryId === rejectingCountryId) {
      this.pendingTrades.splice(tradeIdx, 1);
      return { success: true, trade, cancelledByProposer: trade.fromCountryId === rejectingCountryId };
    }

    // If it is a broadcast trade and a recipient rejects, dismiss locally without canceling server-wide
    if (trade.toCountryId === 'all') {
      return { success: true, trade, dismissedLocally: true };
    }

    return { success: false, error: 'شما اجازه لغو این معامله را ندارید.' };
  }
}

module.exports = {
  MegagameRoom,
  calculateTier,
  TIER_THRESHOLDS,
  COUNTRY_DEFINITIONS,
  HEX_DIRECTIONS,
  MAP_BLUEPRINTS,
  getOddRNeighbors,
  hexDistance,
  generateTechPuzzle
};
