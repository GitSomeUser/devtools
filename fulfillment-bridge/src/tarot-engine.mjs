/**
 * Crypto Tarot Engine — Blockchain-themed 3-card reading
 * Seeded deterministic generation using Web Crypto API
 */

const MAJOR_ARCANA = [
  { name: "The Genesis Block",       upright: "Beginnings, creation, potential. Something new is being mined into existence.",            reversed: "A false start, an idea that never finds its chain. Delays before launch." },
  { name: "The Oracle",              upright: "Hidden knowledge revealed. A signal emerges from noise.",                                   reversed: "Misdirection, noise masquerading as truth. Question what seems obvious." },
  { name: "The Empress",             upright: "Abundance, fertility, growth. The mempool is full and fees are low.",                        reversed: "Block bloat, information overload. Not every signal deserves propagation." },
  { name: "The Emperor",             upright: "Structure, authority, control. The protocol rules are set.",                                  reversed: "Centralization risk, overreach. Someone is trying to change the consensus." },
  { name: "The Hierophant",          upright: "Tradition, guidance, orthodoxy. The old way still holds.",                                   reversed: "A hard fork is coming. The establishment will resist." },
  { name: "The Lovers",              upright: "Union, choice, alignment. Two paths converge — take both or choose.",                        reversed: "A chain split, incompatible visions. The choice is painful either way." },
  { name: "The Chariot",             upright: "Willpower, determination, victory. The hash rate surges forward.",                          reversed: "Reorg. What seemed won can be undone in an instant." },
  { name: "Strength",                upright: "Courage, patience, inner power. The hashrate doesn't rush — it persists.",                  reversed: "Weak hands. Capitulation is near. Hold or fold — but know why." },
  { name: "The Hermit",              upright: "Solitude, reflection, withdrawal. Sometimes the best block is no block.",                   reversed: "Isolation without wisdom. Being offline when you needed to be online." },
  { name: "The Wheel of Fortune",    upright: "Cycles, luck, change. The difficulty adjustment is always coming.",                        reversed: "Bad luck, a downtrend confirmed. The cycle has turned — respect it." },
  { name: "Justice",                 upright: "Truth, cause and effect, karma. Every tx leaves a trace on-chain.",                        reversed: "Unfair outcome, lack of accountability. Not all justice is visible." },
  { name: "The Hanged Man",          upright: "Pause, surrender, new perspective. Being stuck in a mempool has its uses.",                 reversed: "Forced delay, the orphan that wasn't your fault." },
  { name: "Death",                   upright: "Endings, transformation, purge. The old UTXO set is being pruned.",                         reversed: "Resistance to change, fear of the inevitable. Not all endings are bad." },
  { name: "The Thrawn Token",        upright: "Choice between paths, signals, crossroads. Mempool congestion ahead.",                      reversed: "Split decision, neither path is cheap. Wait for the next block." },
  { name: "The Block Clock",         upright: "The ledger has always moved in cycles. What felt like delay was sequence.",                  reversed: "Bad timing, a window that closed. The clock wasn't on your side." },
  { name: "The Whale",               upright: "Accumulation, market-moving force. Someone big just moved.",                                reversed: "Distribution, a top signal. The whale is selling into your optimism." },
  { name: "The Lightning",           upright: "Fast transactions, sudden insight, speed. The invoice is open.",                           reversed: "A failed HTLC, a channel that won't open. Friction in the network." },
  { name: "The Moon",                upright: "Illusion, subconscious, fear. What looks like a win may be a mirror.",                      reversed: "Deep waters, clarity from the chart. The shadows have been hiding something real." },
  { name: "The Sun",                 upright: "Joy, success, vitality. ATH energy. Everything is aligning.",                              reversed: "A local top. Too much euphoria too fast. Stay grounded." },
  { name: "The Star",                upright: "Hope, renewal, faith. The chart looks green again.",                                        reversed: "A dead cat bounce. Hope is real — but so is the resistance ahead." },
  { name: "Judgement",               upright: "Reflection, reckoning, awakening. The halving has arrived.",                                reversed: "Self-doubt, missed call. The market is grading your thesis." },
  { name: "The HODLer",              upright: "Restlessness stirs within you. The waiting has grown heavy. Something wants to move.",      reversed: "The waiting IS the lesson. Sometimes the strongest signal is to do nothing." },
];

const SLANTS = [
  { name: "Cyberpunk",   prefix: "🔴⚡️", style: "Neon-lit and sharp-edged. The chain never sleeps." },
  { name: "Classical",   prefix: "🕯️",   style: "In the tradition of the old mystics, written in code as much as ink." },
  { name: "Meme Culture",prefix: "💀",    style: "Probably nothing. But also — maybe everything." },
  { name: "Doomer",      prefix: "🌑",    style: "The chart is a mirror. The question is whether you're ready to look." },
];

function hexToNum(hex) {
  let n = 0;
  for (let i = 0; i < hex.length; i++) {
    n = (n * 16 + parseInt(hex[i], 16)) >>> 0;
  }
  return n;
}

function sliceHex(hex, start, len) {
  return hex.slice(start, start + len);
}

export function generateReading(seed) {
  // Normalize seed
  const cleanSeed = (seed || '').replace(/[^a-fA-F0-9]/g, '').slice(0, 64) || '0';
  const hash = cleanSeed.padEnd(64, '0');

  const n0 = hexToNum(sliceHex(hash, 0, 6));
  const n1 = hexToNum(sliceHex(hash, 6, 6));
  const n2 = hexToNum(sliceHex(hash, 12, 6));

  const c0 = n0 % 22;
  const c1 = n1 % 22;
  const c2 = n2 % 22;

  const rev0 = (n0 >> 16) % 2 === 1;
  const rev1 = (n1 >> 16) % 2 === 1;
  const rev2 = (n2 >> 16) % 2 === 1;

  const slantIdx = (hexToNum(sliceHex(hash, 18, 4))) % SLANTS.length;
  const slant = SLANTS[slantIdx];

  const spread = [
    { position: "PAST",   card: MAJOR_ARCANA[c0], reversed: rev0 },
    { position: "PRESENT",card: MAJOR_ARCANA[c1], reversed: rev1 },
    { position: "FUTURE", card: MAJOR_ARCANA[c2], reversed: rev2 },
  ];

  return { spread, slant, hash, cleanSeed };
}

export function renderReadingEmail(reading) {
  const { spread, slant, cleanSeed } = reading;
  const lines = [];

  lines.push(`${slant.prefix} **CRYPTO TAROT OF THE CHAIN** ${slant.prefix}`);
  lines.push("");
  lines.push("_For entertainment purposes only. Not financial advice._");
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");
  lines.push("**YOUR 3-CARD BITCOIN READING**");
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  for (const { position, card, reversed } of spread) {
    const dir = reversed ? "_Reversed_" : "_Upright_";
    const interp = reversed ? card.reversed : card.upright;
    lines.push(`**${position}** — ${card.name}`);
    lines.push(`${dir}`);
    lines.push(interp);
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");
  lines.push("Want a deeper, more personalized reading?");
  lines.push("Reply with what's on your mind — a question, a situation, a hope.");
  lines.push("I'll weave it into your next 3 cards.");
  lines.push("");
  lines.push("Already had a reading? Subscribe for monthly spreads.");
  lines.push("👉 https://gitsomeuser.github.io/devtools/pipeline/evolve-earn/tarot/?thanks=1");
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");
  lines.push("_For entertainment purposes only. Not financial advice._");
  lines.push("_Not a substitute for professional guidance._");
  lines.push("");
  lines.push("🕯️ Crypto Tarot of the Chain — powered by devtools");

  return lines.join("\n");
}

export function generateSeed() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
}
