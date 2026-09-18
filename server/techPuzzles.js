// server/techPuzzles.js
// 10-Tier Technology Minigame Engine with Room-Seeded Deterministic Generation

/**
 * Deterministic Pseudo-Random Number Generator based on roomCode string (Murmur/Mulberry32)
 */
function createSeededPRNG(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h = (h ^ (h >>> 16)) >>> 0;
    return (h >>> 0) / 4294967296;
  };
}

function randInt(prng, min, max) {
  return Math.floor(prng() * (max - min + 1)) + min;
}

function shuffle(array, prng) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate all 10 Tech Puzzles for a specific roomCode
 */
function generateRoomPuzzles(roomCode = 'ROOM1') {
  const prng = createSeededPRNG(roomCode.toString().toUpperCase());
  const puzzles = {};

  // ==========================================
  // LEVEL 1: موازنه راکتور انرژی (Energy Grid Matrix 3x3)
  // ==========================================
  // 3x3 grid of numbers 1-9 without duplicates, 3 cells replaced by X, Y, Z
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], prng);
  const grid = [
    [digits[0], digits[1], digits[2]],
    [digits[3], digits[4], digits[5]],
    [digits[6], digits[7], digits[8]]
  ];
  const rowSums = grid.map(r => r[0] + r[1] + r[2]);
  const colSums = [
    grid[0][0] + grid[1][0] + grid[2][0],
    grid[0][1] + grid[1][1] + grid[2][1],
    grid[0][2] + grid[1][2] + grid[2][2]
  ];

  const hiddenPositions = [
    { r: 0, c: 1, label: 'X' },
    { r: 1, c: 2, label: 'Y' },
    { r: 2, c: 0, label: 'Z' }
  ];
  const valX = grid[0][1];
  const valY = grid[1][2];
  const valZ = grid[2][0];
  const l1Answer = `${valX}-${valY}-${valZ}`;

  const displayedGrid = grid.map((row, r) =>
    row.map((val, c) => {
      const h = hiddenPositions.find(p => p.r === r && p.c === c);
      return h ? h.label : val;
    })
  );

  puzzles[1] = {
    level: 1,
    phase: 1,
    phaseName: 'فاز اول: فناوری‌های پایه صنعتی',
    title: 'موازنه راکتور انرژی (ماتریس ۳×۳)',
    icon: '⚡',
    prompt: 'در ماتریس ۳×۳ زیر، مجموع هر سطر و ستون مشخص است. با استفاده از ارقام ۱ تا ۹ بدون تکرار، مقادیر مجهول [X, Y, Z] را بیابید.',
    placeholder: 'مثال: 4-7-2',
    inputPattern: '^\\d-\\d-\\d$',
    visualType: 'grid3x3',
    visualData: {
      grid: displayedGrid,
      rowSums,
      colSums,
      unknowns: ['X', 'Y', 'Z']
    },
    answer: l1Answer
  };

  // ==========================================
  // LEVEL 2: رمزگشایی فرکانس رادار (Cyber Mastermind)
  // ==========================================
  const codePool = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], prng);
  const secretCode = codePool.slice(0, 4);
  const l2Answer = secretCode.join('');

  function evaluateGuess(guess, secret) {
    let green = 0;
    let yellow = 0;
    for (let i = 0; i < 4; i++) {
      if (guess[i] === secret[i]) {
        green++;
      } else if (secret.includes(guess[i])) {
        yellow++;
      }
    }
    return { green, yellow };
  }

  const clue1Digits = [secretCode[0], secretCode[2], codePool[4], codePool[5]];
  const clue1Shuffled = [clue1Digits[0], clue1Digits[2], clue1Digits[1], clue1Digits[3]];
  const ev1 = evaluateGuess(clue1Shuffled, secretCode);

  const clue2Digits = [codePool[6], secretCode[1], secretCode[3], codePool[7]];
  const clue2Shuffled = [clue2Digits[1], clue2Digits[0], clue2Digits[3], clue2Digits[2]];
  const ev2 = evaluateGuess(clue2Shuffled, secretCode);

  const clue3Digits = [secretCode[0], secretCode[1], codePool[4], secretCode[2]];
  const clue3Shuffled = [codePool[4], secretCode[0], secretCode[1], secretCode[2]];
  const ev3 = evaluateGuess(clue3Shuffled, secretCode);

  puzzles[2] = {
    level: 2,
    phase: 1,
    phaseName: 'فاز اول: فناوری‌های پایه صنعتی',
    title: 'رمزگشایی فرکانس رادار (مسترماند سایبری)',
    icon: '📡',
    prompt: 'رادار دشمن با یک کد فرکانسی ۴ رقمی منحصربه‌فرد (بدون تکرار) محافظت می‌شود. بر اساس ۳ سیگنال رهگیری‌شده زیر، رمز رادار را کشف کنید.',
    placeholder: 'کد ۴ رقمی (مثال: 8319)',
    inputPattern: '^\\d{4}$',
    visualType: 'mastermind',
    visualData: {
      clues: [
        { guess: clue1Shuffled.join(''), green: ev1.green, yellow: ev1.yellow },
        { guess: clue2Shuffled.join(''), green: ev2.green, yellow: ev2.yellow },
        { guess: clue3Shuffled.join(''), green: ev3.green, yellow: ev3.yellow }
      ],
      legend: {
        green: 'سبز: رقم صحیح در جایگاه دقیق',
        yellow: 'زرد: رقم صحیح ولی در جایگاه نادرست'
      }
    },
    answer: l2Answer
  };

  // ==========================================
  // LEVEL 3: سنتز سوخت و ایزوتوپ‌ها (Chemical Balance)
  // ==========================================
  const solX = randInt(prng, 2, 7);
  const solY = randInt(prng, 2, 8);
  const a = randInt(prng, 2, 4);
  const b = randInt(prng, 1, 3);
  const c = randInt(prng, 1, 3);
  const d = randInt(prng, 2, 5);
  const e1 = a * solX + b * solY;
  const e2 = c * solX + d * solY;
  const l3Answer = `${solX}-${solY}`;

  puzzles[3] = {
    level: 3,
    phase: 1,
    phaseName: 'فاز اول: فناوری‌های پایه صنعتی',
    title: 'سنتز سوخت و ایزوتوپ‌ها (توازن واکنش دومجهولی)',
    icon: '🧪',
    prompt: 'برای سنتز ایزوتوپ پایدار سوخت ارتش، کاتالیزورهای واکنش‌های شیمیایی زیر را با محاسبه مقادیر مجهول کاتالیزور [X و Y] تنظیم کنید.',
    placeholder: 'مثال: 3-5',
    inputPattern: '^\\d+-\\d+$',
    visualType: 'equation',
    visualData: {
      equations: [
        `${a}X + ${b}Y = ${e1}`,
        `${c}X + ${d}Y = ${e2}`
      ],
      target: 'X-Y'
    },
    answer: l3Answer
  };

  // ==========================================
  // LEVEL 4: مسیریابی رله‌های ماهواره‌ای (Satellite Data Graph)
  // ==========================================
  const bandwidths = {
    AB: randInt(prng, 12, 20),
    AC: randInt(prng, 14, 25),
    BD: randInt(prng, 10, 18),
    BC: randInt(prng, 8, 15),
    CD: randInt(prng, 11, 22),
    CE: randInt(prng, 25, 40),
    DE: randInt(prng, 16, 28)
  };

  const possiblePaths = [
    { path: 'ABDE', cost: bandwidths.AB + bandwidths.BD + bandwidths.DE },
    { path: 'ABCDE', cost: bandwidths.AB + bandwidths.BC + bandwidths.CD + bandwidths.DE },
    { path: 'ABCE', cost: bandwidths.AB + bandwidths.BC + bandwidths.CE },
    { path: 'ACDE', cost: bandwidths.AC + bandwidths.CD + bandwidths.DE },
    { path: 'ACE', cost: bandwidths.AC + bandwidths.CE }
  ];

  const chosenPathObj = possiblePaths[randInt(prng, 0, possiblePaths.length - 1)];
  const targetBandwidth = chosenPathObj.cost;
  const l4Answer = chosenPathObj.path;

  puzzles[4] = {
    level: 4,
    phase: 2,
    phaseName: 'فاز دوم: مخابرات و شبکه ماهواره‌ای',
    title: 'مسیریابی رله‌های ماهواره‌ای (گراف ماهواره‌ای A→E)',
    icon: '🛰️',
    prompt: `ایستگاه مبدا A و مقصد E است. مسیری با توالی ایستگاه‌ها بیابید که مجموع پهنای باند فرکانسی آن دقیقاً برابر با ${targetBandwidth} GHz باشد.`,
    placeholder: 'مثال: ABDE یا ACE',
    inputPattern: '^[A-E]+$',
    visualType: 'networkGraph',
    visualData: {
      targetBandwidth,
      edges: [
        { from: 'A', to: 'B', bw: bandwidths.AB },
        { from: 'A', to: 'C', bw: bandwidths.AC },
        { from: 'B', to: 'D', bw: bandwidths.BD },
        { from: 'B', to: 'C', bw: bandwidths.BC },
        { from: 'C', to: 'D', bw: bandwidths.CD },
        { from: 'C', to: 'E', bw: bandwidths.CE },
        { from: 'D', to: 'E', bw: bandwidths.DE }
      ]
    },
    answer: l4Answer
  };

  // ==========================================
  // LEVEL 5: رمزنگاری معکوس انیگما (Enigma Reverse Cipher)
  // ==========================================
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const shifts = [randInt(prng, 2, 5), randInt(prng, 3, 7), randInt(prng, 1, 4), randInt(prng, 2, 6)];
  
  let plain5 = '';
  for (let i = 0; i < 4; i++) {
    plain5 += alphabet[randInt(prng, 0, 25)];
  }
  let cipher5 = '';
  for (let i = 0; i < 4; i++) {
    const origIdx = alphabet.indexOf(plain5[i]);
    const shiftedIdx = (origIdx + shifts[i]) % 26;
    cipher5 += alphabet[shiftedIdx];
  }
  const l5Answer = plain5;

  puzzles[5] = {
    level: 5,
    phase: 2,
    phaseName: 'فاز دوم: مخابرات و شبکه ماهواره‌ای',
    title: 'رمزنگاری معکوس انیگما (کلید ۴ حرفی)',
    icon: '🔐',
    prompt: `پیام رمزشده مخابراتی نظامی «${cipher5}» با روتورهای شیفت جلو [${shifts.join(', ')}] کدگذاری شده است. متن اصلی پیام را بیابید.`,
    placeholder: 'کد ۴ حرفی انگلیسی (مثال: T9X2)',
    inputPattern: '^[A-Za-z0-9]{4}$',
    visualType: 'enigma',
    visualData: {
      cipher: cipher5,
      rotors: shifts.map((s, idx) => ({ rotor: idx + 1, shift: s })),
      hint: 'هر حرف را به تعداد مشخص‌شده در روتور به سمت عقب در الفبای انگلیسی برگردانید.'
    },
    answer: l5Answer
  };

  // ==========================================
  // LEVEL 6: پایدارسازی میدان مغناطیسی سپر دفاعی (Vector Flux Balance)
  // ==========================================
  const valN = randInt(prng, 20, 60);
  const valW = randInt(prng, 15, 45);
  const valS = valN;
  const valE = valW;
  const l6Answer = `${valS}-${valE}`;

  puzzles[6] = {
    level: 6,
    phase: 2,
    phaseName: 'فاز دوم: مخابرات و شبکه ماهواره‌ای',
    title: 'پایدارسازی میدان مغناطیسی سپر دفاعی (بردار فوران)',
    icon: '🛡️',
    prompt: `برای دستیابی به تعادل گشتاور صفر در سپر دفاعی، نیروی شمال (${valN}T) با جنوب (S) و نیروی غرب (${valW}T) با شرق (E) باید کاملاً موازنه شوند. مقادیر مجهول [S-E] را وارد کنید.`,
    placeholder: 'مثال: 30-15',
    inputPattern: '^\\d+-\\d+$',
    visualType: 'fluxVector',
    visualData: {
      north: valN,
      west: valW,
      required: 'S-E'
    },
    answer: l6Answer
  };

  // ==========================================
  // LEVEL 7: نفوذ به فایروال مرکز فرماندهی (Cyberpunk Hex Buffer Breach)
  // ==========================================
  const hexPool = ['1C', '55', 'BD', 'E9', '7A', 'F3', '2B', 'D4'];
  const hexMatrix = [];
  for (let r = 0; r < 4; r++) {
    const row = [];
    for (let c = 0; c < 4; c++) {
      row.push(hexPool[randInt(prng, 0, hexPool.length - 1)]);
    }
    hexMatrix.push(row);
  }

  const c1 = randInt(prng, 0, 3);
  const byte1 = hexMatrix[0][c1];
  const r2 = randInt(prng, 1, 3);
  const byte2 = hexMatrix[r2][c1];
  let c3 = randInt(prng, 0, 3);
  if (c3 === c1) c3 = (c1 + 1) % 4;
  const byte3 = hexMatrix[r2][c3];

  const l7Answer = `${byte1}-${byte2}-${byte3}`;

  puzzles[7] = {
    level: 7,
    phase: 3,
    phaseName: 'فاز سوم: پروژه‌های مگا-تسلیحاتی و هوش مصنوعی',
    title: 'نفوذ به فایروال مرکز فرماندهی (هک هگز ۴×۴)',
    icon: '💻',
    prompt: `با رعایت الگوریتم پرش (شروع از سطر اول در ستون ${c1 + 1}، پرش عمودی به سطر ${r2 + 1}، و سپس پرش افقی به ستون ${c3 + 1})، توالی ۳ بایتی بافر نفوذ را استخراج کنید.`,
    placeholder: 'مثال: 1C-55-BD',
    inputPattern: '^[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{2}$',
    visualType: 'hexMatrix',
    visualData: {
      matrix: hexMatrix,
      steps: [
        `گام ۱: سطر ۱، ستون ${c1 + 1}`,
        `گام ۲: ستون ${c1 + 1}، سطر ${r2 + 1}`,
        `گام ۳: سطر ${r2 + 1}، ستون ${c3 + 1}`
      ]
    },
    answer: l7Answer
  };

  // ==========================================
  // LEVEL 8: همگام‌سازی فاز سانتریفیوژها (Resonance Frequency Lock)
  // ==========================================
  function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
  }
  function lcm(a, b) {
    return (a * b) / gcd(a, b);
  }

  const periodOptions = [
    [10, 15, 20],
    [12, 15, 20],
    [15, 20, 30],
    [8, 12, 16],
    [12, 18, 24],
    [14, 21, 28]
  ];
  const chosenPeriods = periodOptions[randInt(prng, 0, periodOptions.length - 1)];
  const l8Answer = chosenPeriods.reduce((acc, curr) => lcm(acc, curr), 1).toString();

  puzzles[8] = {
    level: 8,
    phase: 3,
    phaseName: 'فاز سوم: پروژه‌های مگا-تسلیحاتی و هوش مصنوعی',
    title: 'همگام‌سازی فاز سانتریفیوژها (ک.م.م رزونانس)',
    icon: '⚛️',
    prompt: `سه روتور غنی‌سازی با دوره‌های تناوب [${chosenPeriods.join('، ')}] ثانیه در حال چرخش هستند. پس از چند ثانیه، هر سه روتور برای اولین بار به طور همزمان به فاز تشدید (رزونانس کامل) می‌رسند؟`,
    placeholder: 'عدد ثانیه (مثال: 60)',
    inputPattern: '^\\d+$',
    visualType: 'centrifuge',
    visualData: {
      periods: chosenPeriods,
      unit: 'ثانیه'
    },
    answer: l8Answer
  };

  // ==========================================
  // LEVEL 9: مثلث‌بندی مختصات پرتاب موشک قاره‌پیما (Triangulation Strike)
  // ==========================================
  const targetX = randInt(prng, 20, 80);
  const targetY = randInt(prng, 20, 80);
  const l9Answer = `${targetX}-${targetY}`;

  puzzles[9] = {
    level: 9,
    phase: 3,
    phaseName: 'فاز سوم: پروژه‌های مگا-تسلیحاتی و هوش مصنوعی',
    title: 'مثلث‌بندی مختصات پرتاب موشک قاره‌پیما (X, Y)',
    icon: '🎯',
    prompt: `سیگنال پرتاب موشک در نقطه تلاقی سنسورهای راداری ردیابی شده است: مختصات محور افقی با فاصله تراز ${targetX} کیلومتر از پایگاه غربی و مختصات محور عمودی با فاصله تراز ${targetY} کیلومتر از پایگاه جنوبی است. مختصات پرتاب [X-Y] را وارد کنید.`,
    placeholder: 'مثال: 42-88',
    inputPattern: '^\\d+-\\d+$',
    visualType: 'triangulation',
    visualData: {
      radarWest: `فاصله افقی X: ${targetX} km`,
      radarSouth: `فاصله عمودی Y: ${targetY} km`
    },
    answer: l9Answer
  };

  // ==========================================
  // LEVEL 10: پروتکل هوش مصنوعی نظامی امگا (Omega AI Core Protocol)
  // ==========================================
  const omegaCodeNum = randInt(prng, 11, 99);
  const l10Answer = `OMEGA-${omegaCodeNum}-ALPHA`;

  puzzles[10] = {
    level: 10,
    phase: 3,
    phaseName: 'فاز سوم: پروژه‌های مگا-تسلیحاتی و هوش مصنوعی',
    title: 'پروتکل هوش مصنوعی نظامی امگا (هسته نهایی)',
    icon: '🤖',
    prompt: `پروژه نهایی فعال‌سازی ابرهوش مصنوعی نظامی با کد امنیتی اختصاصی اتاق فعال می‌شود. کلید تایید هویت ریشه، ترکیب پیشوند «OMEGA-»، شناسه امنیتی محاسباتی «${omegaCodeNum}» و پسوند دسترسی نهایی «-ALPHA» است.`,
    placeholder: `مثال: OMEGA-${omegaCodeNum}-ALPHA`,
    inputPattern: '^OMEGA-\\d{2}-ALPHA$',
    visualType: 'omegaCore',
    visualData: {
      codeNum: omegaCodeNum,
      format: `OMEGA-${omegaCodeNum}-ALPHA`
    },
    answer: l10Answer
  };

  return puzzles;
}

/**
 * Sanitize puzzle object for sending to client (strip the plain answer)
 */
function sanitizePuzzle(puzzle) {
  if (!puzzle) return null;
  const sanitized = { ...puzzle };
  delete sanitized.answer;
  return sanitized;
}

/**
 * Check if the user's submitted answer matches the puzzle answer
 */
function checkPuzzleAnswer(puzzle, submittedAnswer) {
  if (!puzzle || !puzzle.answer) return false;
  const cleanExpected = puzzle.answer.toString().trim().toUpperCase().replace(/\s+/g, '');
  const cleanSubmitted = (submittedAnswer || '').toString().trim().toUpperCase().replace(/\s+/g, '');
  return cleanExpected === cleanSubmitted;
}

module.exports = {
  createSeededPRNG,
  generateRoomPuzzles,
  sanitizePuzzle,
  checkPuzzleAnswer
};
