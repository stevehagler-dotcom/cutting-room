import React, { useState, useEffect, useMemo } from "react";

/* ---------------- Palette data ---------------- */
// hue: null = neutral (matches everything reasonably)
const SWATCHES = [
  { name: "Black", hex: "#1c1b19", hue: null, neutral: true },
  { name: "White", hex: "#f4f1ea", hue: null, neutral: true },
  { name: "Grey", hex: "#8d8a83", hue: null, neutral: true },
  { name: "Charcoal", hex: "#3a3835", hue: null, neutral: true },
  { name: "Navy", hex: "#22304a", hue: 220, neutral: true },
  { name: "Denim", hex: "#4c6b8a", hue: 210, neutral: true },
  { name: "Beige", hex: "#d8c7a8", hue: 40, neutral: true },
  { name: "Cream", hex: "#eee3c8", hue: 45, neutral: true },
  { name: "Brown", hex: "#6b4a34", hue: 25, neutral: true },
  { name: "Olive", hex: "#6f6a3d", hue: 65, neutral: false },
  { name: "Red", hex: "#a8342b", hue: 5, neutral: false },
  { name: "Rust", hex: "#b5602f", hue: 22, neutral: false },
  { name: "Mustard", hex: "#c99a2e", hue: 45, neutral: false },
  { name: "Green", hex: "#3f6b46", hue: 130, neutral: false },
  { name: "Teal", hex: "#2f6b64", hue: 175, neutral: false },
  { name: "Blue", hex: "#2c5f8a", hue: 205, neutral: false },
  { name: "Purple", hex: "#5b4373", hue: 270, neutral: false },
  { name: "Burgundy", hex: "#6e2438", hue: 345, neutral: false },
  { name: "Pink", hex: "#c17b96", hue: 335, neutral: false },
  { name: "Lavender", hex: "#8f8fc2", hue: 250, neutral: false },
];

const CATEGORIES = ["Top", "Bottom", "Outerwear", "Shoes", "Accessory"];
const PATTERNS = ["Solid", "Striped", "Patterned"];
const FORMALITY = ["Casual", "Smart", "Formal"];

const swatch = (name) => SWATCHES.find((s) => s.name === name);

/* ---------------- Sample closet (practice items) ---------------- */
const SAMPLE_ITEMS = [
  { label: "White Tee", category: "Top", color: swatch("White"), pattern: "Solid", formality: "Casual" },
  { label: "Striped Oxford Shirt", category: "Top", color: swatch("Blue"), pattern: "Striped", formality: "Smart" },
  { label: "Grey Wool Sweater", category: "Top", color: swatch("Grey"), pattern: "Solid", formality: "Smart" },
  { label: "Black Jeans", category: "Bottom", color: swatch("Black"), pattern: "Solid", formality: "Casual" },
  { label: "Beige Chinos", category: "Bottom", color: swatch("Beige"), pattern: "Solid", formality: "Smart" },
  { label: "Olive Cargo Pants", category: "Bottom", color: swatch("Olive"), pattern: "Solid", formality: "Casual" },
  { label: "Denim Jacket", category: "Outerwear", color: swatch("Denim"), pattern: "Solid", formality: "Casual" },
  { label: "Navy Blazer", category: "Outerwear", color: swatch("Navy"), pattern: "Solid", formality: "Formal" },
  { label: "White Sneakers", category: "Shoes", color: swatch("White"), pattern: "Solid", formality: "Casual" },
  { label: "Brown Leather Boots", category: "Shoes", color: swatch("Brown"), pattern: "Solid", formality: "Smart" },
  { label: "Burgundy Scarf", category: "Accessory", color: swatch("Burgundy"), pattern: "Solid", formality: "Formal" },
  { label: "Mustard Patterned Tie", category: "Accessory", color: swatch("Mustard"), pattern: "Patterned", formality: "Formal" },
];

/* ---------------- Matching engine ---------------- */
function hueDiff(a, b) {
  if (a == null || b == null) return null;
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function pairScore(a, b) {
  let score = 100;
  const reasons = [];

  if (a.color.neutral || b.color.neutral) {
    reasons.push(`${a.color.neutral ? a.color.name : b.color.name} is a neutral — pairs with almost anything.`);
  } else {
    const diff = hueDiff(a.color.hue, b.color.hue);
    if (diff <= 40) {
      reasons.push(`${a.color.name} and ${b.color.name} sit close on the color wheel — a calm, tonal pairing.`);
    } else if (diff >= 150) {
      score -= 15;
      reasons.push(`${a.color.name} and ${b.color.name} are near-complementary — bold together, wear on purpose.`);
    } else {
      score -= 30;
      reasons.push(`${a.color.name} and ${b.color.name} are an awkward distance apart on the wheel — the classic "off" feeling.`);
    }
  }

  if (a.pattern !== "Solid" && b.pattern !== "Solid") {
    score -= 25;
    reasons.push(`Two patterns (${a.pattern.toLowerCase()} + ${b.pattern.toLowerCase()}) are competing for attention.`);
  }

  const fLevels = FORMALITY;
  const fGap = Math.abs(fLevels.indexOf(a.formality) - fLevels.indexOf(b.formality));
  if (fGap >= 2) {
    score -= 20;
    reasons.push(`${a.formality} meets ${b.formality} — a big formality jump.`);
  }

  return { score: Math.max(0, score), reasons };
}

function verdict(score) {
  if (score >= 85) return { label: "Great match", tone: "good" };
  if (score >= 65) return { label: "Good pairing", tone: "good" };
  if (score >= 45) return { label: "Bold — wear with intent", tone: "warn" };
  return { label: "Off", tone: "bad" };
}

/* ---------------- Storage helpers ---------------- */
const STORAGE_KEY = "closet-items";

/* ---------------- Component ---------------- */
export default function ClosetMatcher() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("closet"); // closet | add | build | check
  const [selectedBase, setSelectedBase] = useState(null);
  const [checkSelection, setCheckSelection] = useState([]);

  // form state
  const [form, setForm] = useState({
    label: "",
    category: "Top",
    color: SWATCHES[0],
    pattern: "Solid",
    formality: "Casual",
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY);
        if (res && res.value) setItems(JSON.parse(res.value));
      } catch (e) {
        /* no saved closet yet */
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        console.error("Could not save closet", e);
      }
    })();
  }, [items, loaded]);

  const addItem = () => {
    if (!form.label.trim()) return;
    const newItem = { ...form, id: Date.now().toString() };
    setItems((prev) => [...prev, newItem]);
    setForm({ label: "", category: "Top", color: SWATCHES[0], pattern: "Solid", formality: "Casual" });
    setTab("closet");
  };

  const loadSampleCloset = () => {
    const seeded = SAMPLE_ITEMS.map((it, idx) => ({ ...it, id: `sample-${idx}-${Date.now()}` }));
    setItems((prev) => [...prev, ...seeded]);
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedBase((b) => (b && b.id === id ? null : b));
    setCheckSelection((sel) => sel.filter((i) => i.id !== id));
  };

  const grouped = useMemo(() => {
    const g = {};
    CATEGORIES.forEach((c) => (g[c] = []));
    items.forEach((i) => g[i.category] && g[i.category].push(i));
    return g;
  }, [items]);

  const matches = useMemo(() => {
    if (!selectedBase) return [];
    return items
      .filter((i) => i.id !== selectedBase.id)
      .map((i) => ({ item: i, ...pairScore(selectedBase, i) }))
      .sort((a, b) => b.score - a.score);
  }, [selectedBase, items]);

  const checkResult = useMemo(() => {
    if (checkSelection.length < 2) return null;
    const pairs = [];
    for (let i = 0; i < checkSelection.length; i++) {
      for (let j = i + 1; j < checkSelection.length; j++) {
        pairs.push({ a: checkSelection[i], b: checkSelection[j], ...pairScore(checkSelection[i], checkSelection[j]) });
      }
    }
    const avg = Math.round(pairs.reduce((s, p) => s + p.score, 0) / pairs.length);

    // Find the weakest-performing piece — the one dragging the outfit down the most.
    const itemAvgs = checkSelection.map((item) => {
      const relevant = pairs.filter((p) => p.a.id === item.id || p.b.id === item.id);
      const m = relevant.reduce((s, p) => s + p.score, 0) / relevant.length;
      return { item, avg: m };
    });
    itemAvgs.sort((x, y) => x.avg - y.avg);
    const weakLink = itemAvgs[0];

    let suggestion = null;
    if (weakLink && weakLink.avg < 82) {
      const rest = checkSelection.filter((i) => i.id !== weakLink.item.id);
      const candidates = items.filter(
        (i) => i.category === weakLink.item.category && !checkSelection.find((s) => s.id === i.id)
      );
      const scored = candidates
        .map((c) => {
          const scores = rest.map((r) => pairScore(c, r).score);
          const m = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 100;
          return { candidate: c, avg: m };
        })
        .sort((x, y) => y.avg - x.avg);
      const best = scored[0];
      if (best && best.avg > weakLink.avg + 8) {
        suggestion = {
          weak: weakLink.item,
          weakScore: Math.round(weakLink.avg),
          replacement: best.candidate,
          newScore: Math.round(best.avg),
        };
      } else if (!best) {
        suggestion = { noAlternative: true, weak: weakLink.item };
      }
    }

    return { avg, pairs, suggestion };
  }, [checkSelection, items]);

  const toggleCheckItem = (item) => {
    setCheckSelection((prev) =>
      prev.find((i) => i.id === item.id) ? prev.filter((i) => i.id !== item.id) : [...prev, item]
    );
  };

  const swapCheckItem = (oldItem, newItem) => {
    setCheckSelection((prev) => prev.filter((i) => i.id !== oldItem.id).concat(newItem));
  };

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        button { font-family: inherit; cursor: pointer; }
        input, select { font-family: inherit; }
      `}</style>

      <header style={styles.header}>
        <div style={styles.pin} />
        <h1 style={styles.title}>The Cutting Room</h1>
        <p style={styles.subtitle}>a closet that tells you what matches</p>
      </header>

      <nav style={styles.nav}>
        {[
          ["closet", "Closet"],
          ["add", "Add item"],
          ["build", "Build outfit"],
          ["check", "Check outfit"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              ...styles.navBtn,
              ...(tab === key ? styles.navBtnActive : {}),
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {tab === "closet" && (
          <ClosetView
            grouped={grouped}
            onRemove={removeItem}
            onAdd={() => setTab("add")}
            onLoadSample={loadSampleCloset}
          />
        )}

        {tab === "add" && (
          <AddForm form={form} setForm={setForm} onSubmit={addItem} />
        )}

        {tab === "build" && (
          <BuildOutfit
            items={items}
            selectedBase={selectedBase}
            setSelectedBase={setSelectedBase}
            matches={matches}
          />
        )}

        {tab === "check" && (
          <CheckOutfit
            items={items}
            checkSelection={checkSelection}
            toggleCheckItem={toggleCheckItem}
            checkResult={checkResult}
            onSwap={swapCheckItem}
          />
        )}
      </main>
    </div>
  );
}

/* ---------------- Sub-views ---------------- */

const GARMENT_PATHS = {
  Top: "M20 8 L26 3 H38 L44 8 L58 17 L49 27 L42 21 V59 H22 V21 L15 27 L6 17 Z",
  Bottom: "M17 4 H47 L46 18 L42 60 H33 L31 28 L29 60 H20 L16 18 Z",
  Outerwear: "M17 9 L26 3 H29 V9 H35 V3 H38 L47 9 L60 19 L51 29 L44 23 V59 H20 V23 L13 29 L4 19 Z",
  Shoes: "M4 42 H24 L34 30 L48 36 L60 40 V52 Q60 56 56 56 H4 Z",
  Accessory: "M32 6 C19 6 12 17 12 27 C12 40 21 51 32 58 C43 51 52 40 52 27 C52 17 45 6 32 6 Z",
};

function GarmentIcon({ category, color, pattern, uid, size = 44 }) {
  const patternId = `pat-${uid}`;
  const d = GARMENT_PATHS[category] || GARMENT_PATHS.Top;
  const fill = pattern === "Solid" ? color : `url(#${patternId})`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
      <defs>
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width="9"
          height="9"
          patternTransform={pattern === "Striped" ? "rotate(45)" : "rotate(0)"}
        >
          <rect width="9" height="9" fill={color} />
          {pattern === "Striped" && <rect width="4.5" height="9" fill="rgba(255,255,255,0.4)" />}
          {pattern === "Patterned" && <circle cx="4.5" cy="4.5" r="1.7" fill="rgba(255,255,255,0.5)" />}
        </pattern>
      </defs>
      <path d={d} fill={fill} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function SwatchCard({ item, onClick, selected, actionIcon, onAction, showCheck }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.card,
        ...(selected ? styles.cardSelected : {}),
      }}
    >
      <div style={styles.cardPin} />
      {showCheck && (
        <span style={{ ...styles.checkBadge, ...(selected ? styles.checkBadgeOn : {}) }}>
          {selected ? "✓" : ""}
        </span>
      )}
      <GarmentIcon category={item.category} color={item.color.hex} pattern={item.pattern} uid={item.id} />
      <div style={styles.cardLabel}>{item.label}</div>
      <div style={styles.cardMeta}>
        {item.color.name.toUpperCase()} · {item.pattern.toUpperCase()}
      </div>
      <div style={styles.cardMeta}>{item.formality.toUpperCase()}</div>
      {onAction && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
          style={styles.cardRemove}
        >
          {actionIcon}
        </span>
      )}
    </button>
  );
}

function ClosetView({ grouped, onRemove, onAdd, onLoadSample }) {
  const total = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);
  if (total === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyText}>Your closet is empty. Pin your first item.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button style={styles.primaryBtn} onClick={onAdd}>
            + Add an item
          </button>
          <button style={styles.ghostBtn} onClick={onLoadSample}>
            Load practice closet
          </button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div style={styles.closetTopRow}>
        <span style={styles.itemCount}>{total} item{total === 1 ? "" : "s"} pinned</span>
        <button style={styles.ghostBtnSmall} onClick={onLoadSample}>
          + add practice items
        </button>
      </div>
      {CATEGORIES.map((cat) =>
        grouped[cat].length ? (
          <section key={cat} style={styles.section}>
            <h2 style={styles.sectionTitle}>{cat}</h2>
            <div style={styles.grid}>
              {grouped[cat].map((item) => (
                <SwatchCard
                  key={item.id}
                  item={item}
                  onClick={() => {}}
                  actionIcon="✕"
                  onAction={() => onRemove(item.id)}
                />
              ))}
            </div>
          </section>
        ) : null
      )}
    </div>
  );
}

function AddForm({ form, setForm, onSubmit }) {
  return (
    <div style={styles.formWrap}>
      <label style={styles.label}>Item name</label>
      <input
        style={styles.input}
        placeholder="e.g. Grey wool sweater"
        value={form.label}
        onChange={(e) => setForm({ ...form, label: e.target.value })}
      />

      <label style={styles.label}>Category</label>
      <div style={styles.chipRow}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setForm({ ...form, category: c })}
            style={{ ...styles.chip, ...(form.category === c ? styles.chipActive : {}) }}
          >
            {c}
          </button>
        ))}
      </div>

      <label style={styles.label}>Color</label>
      <div style={styles.swatchGrid}>
        {SWATCHES.map((s) => (
          <button
            key={s.name}
            onClick={() => setForm({ ...form, color: s })}
            title={s.name}
            style={{
              ...styles.swatchBtn,
              background: s.hex,
              ...(form.color.name === s.name ? styles.swatchBtnActive : {}),
            }}
          />
        ))}
      </div>
      <div style={styles.colorName}>{form.color.name}</div>

      <label style={styles.label}>Pattern</label>
      <div style={styles.chipRow}>
        {PATTERNS.map((p) => (
          <button
            key={p}
            onClick={() => setForm({ ...form, pattern: p })}
            style={{ ...styles.chip, ...(form.pattern === p ? styles.chipActive : {}) }}
          >
            {p}
          </button>
        ))}
      </div>

      <label style={styles.label}>Formality</label>
      <div style={styles.chipRow}>
        {FORMALITY.map((f) => (
          <button
            key={f}
            onClick={() => setForm({ ...form, formality: f })}
            style={{ ...styles.chip, ...(form.formality === f ? styles.chipActive : {}) }}
          >
            {f}
          </button>
        ))}
      </div>

      <button style={styles.primaryBtn} onClick={onSubmit}>
        Pin to closet
      </button>
    </div>
  );
}

function BuildOutfit({ items, selectedBase, setSelectedBase, matches }) {
  if (items.length === 0) {
    return <p style={styles.emptyText}>Add a few items first, then pick one to build around.</p>;
  }
  return (
    <div>
      <h2 style={styles.sectionTitle}>Pick a piece to build around</h2>
      <div style={styles.grid}>
        {items.map((item) => (
          <SwatchCard
            key={item.id}
            item={item}
            selected={selectedBase?.id === item.id}
            onClick={() => setSelectedBase(item)}
          />
        ))}
      </div>

      {selectedBase && (
        <>
          <h2 style={styles.sectionTitle}>Matches for {selectedBase.label}</h2>
          <div style={styles.matchList}>
            {matches.map(({ item, score, reasons }) => {
              const v = verdict(score);
              return (
                <div key={item.id} style={styles.matchRow}>
                  <GarmentIcon category={item.category} color={item.color.hex} pattern={item.pattern} uid={item.id} size={30} />
                  <div style={styles.matchInfo}>
                    <div style={styles.matchTop}>
                      <span style={styles.matchName}>{item.label}</span>
                      <span style={{ ...styles.badge, ...styles[`badge_${v.tone}`] }}>{v.label}</span>
                    </div>
                    <div style={styles.matchReason}>{reasons[0]}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CheckOutfit({ items, checkSelection, toggleCheckItem, checkResult, onSwap }) {
  if (items.length === 0) {
    return <p style={styles.emptyText}>Add a few items first, then select today's outfit to check it.</p>;
  }
  return (
    <div>
      <div style={styles.checkHeaderRow}>
        <h2 style={{ ...styles.sectionTitle, marginBottom: 0 }}>Select today's outfit</h2>
        <span style={styles.selectedCount}>
          {checkSelection.length} selected
        </span>
      </div>
      <p style={styles.checkHint}>Tap each piece you're wearing — they'll stack up with a ✓.</p>
      <div style={styles.grid}>
        {items.map((item) => (
          <SwatchCard
            key={item.id}
            item={item}
            showCheck
            selected={!!checkSelection.find((i) => i.id === item.id)}
            onClick={() => toggleCheckItem(item)}
          />
        ))}
      </div>

      {checkResult && (
        <div style={styles.resultCard}>
          <div style={styles.resultHeader}>
            <span style={styles.resultScore}>{checkResult.avg}</span>
            <span style={{ ...styles.badge, ...styles[`badge_${verdict(checkResult.avg).tone}`] }}>
              {verdict(checkResult.avg).label}
            </span>
          </div>
          <div style={styles.resultList}>
            {checkResult.pairs
              .slice()
              .sort((a, b) => a.score - b.score)
              .map((p, idx) => (
                <div key={idx} style={styles.resultLine}>
                  <span style={styles.resultLineNames}>
                    {p.a.label} + {p.b.label}
                  </span>
                  <span style={styles.resultLineReason}>{p.reasons[0]}</span>
                </div>
              ))}
          </div>

          {checkResult.suggestion && checkResult.suggestion.replacement && (
            <div style={styles.suggestionBox}>
              <div style={styles.suggestionLabel}>Try this instead</div>
              <div style={styles.suggestionRow}>
                <GarmentIcon
                  category={checkResult.suggestion.weak.category}
                  color={checkResult.suggestion.weak.color.hex}
                  pattern={checkResult.suggestion.weak.pattern}
                  uid={checkResult.suggestion.weak.id}
                  size={30}
                />
                <span style={styles.suggestionArrow}>→</span>
                <GarmentIcon
                  category={checkResult.suggestion.replacement.category}
                  color={checkResult.suggestion.replacement.color.hex}
                  pattern={checkResult.suggestion.replacement.pattern}
                  uid={checkResult.suggestion.replacement.id}
                  size={30}
                />
                <div style={{ flex: 1 }}>
                  <div style={styles.suggestionText}>
                    Swap <strong>{checkResult.suggestion.weak.label}</strong> for{" "}
                    <strong>{checkResult.suggestion.replacement.label}</strong>
                  </div>
                  <div style={styles.suggestionScoreLine}>
                    {checkResult.suggestion.weakScore} → {checkResult.suggestion.newScore}
                  </div>
                </div>
              </div>
              <button
                style={styles.swapBtn}
                onClick={() => onSwap(checkResult.suggestion.weak, checkResult.suggestion.replacement)}
              >
                Swap it in
              </button>
            </div>
          )}

          {checkResult.suggestion && checkResult.suggestion.noAlternative && (
            <div style={styles.suggestionBox}>
              <div style={styles.suggestionText}>
                <strong>{checkResult.suggestion.weak.label}</strong> is the weak link, but nothing else in your{" "}
                {checkResult.suggestion.weak.category.toLowerCase()} category would do better — consider pinning a
                neutral (black, navy, grey, or beige) {checkResult.suggestion.weak.category.toLowerCase()} to your
                closet.
              </div>
            </div>
          )}

          {!checkResult.suggestion && (
            <div style={styles.suggestionBoxGood}>This combination is already working well — no swap needed.</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Styles ---------------- */
const styles = {
  page: {
    fontFamily: "'Inter', sans-serif",
    background: "#2f3b36",
    minHeight: "100vh",
    color: "#f1ede4",
    paddingBottom: 40,
  },
  header: {
    textAlign: "center",
    padding: "28px 20px 16px",
    position: "relative",
  },
  pin: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#b8944f",
    margin: "0 auto 10px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
  },
  title: {
    fontFamily: "'Fraunces', serif",
    fontWeight: 600,
    fontSize: 28,
    margin: 0,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 12,
    color: "#b8944f",
    marginTop: 6,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  nav: {
    display: "flex",
    gap: 8,
    padding: "0 16px 16px",
    overflowX: "auto",
  },
  navBtn: {
    flex: "1 0 auto",
    background: "transparent",
    border: "1px solid #4c5a53",
    color: "#cfc9bc",
    borderRadius: 20,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  navBtnActive: {
    background: "#b8944f",
    borderColor: "#b8944f",
    color: "#2f3b36",
    fontWeight: 600,
  },
  main: {
    padding: "0 16px",
    maxWidth: 640,
    margin: "0 auto",
  },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontFamily: "'Fraunces', serif",
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 12,
    color: "#f1ede4",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: 12,
  },
  card: {
    position: "relative",
    background: "#3a4640",
    border: "1px dashed #5c6a62",
    borderRadius: 10,
    padding: "16px 10px 10px",
    textAlign: "left",
    color: "#f1ede4",
  },
  cardSelected: {
    border: "2px solid #b8944f",
    background: "#4a5b51",
    boxShadow: "0 0 0 1px #b8944f",
  },
  checkBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: "50%",
    border: "1.5px solid #6b7871",
    fontSize: 11,
    lineHeight: "16px",
    textAlign: "center",
    color: "transparent",
  },
  checkBadgeOn: {
    background: "#b8944f",
    borderColor: "#b8944f",
    color: "#2f3b36",
    fontWeight: 700,
  },
  cardPin: {
    position: "absolute",
    top: 6,
    left: "50%",
    transform: "translateX(-50%)",
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#b8944f",
  },
  swatchDot: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    marginBottom: 8,
    border: "1px solid rgba(255,255,255,0.2)",
  },
  cardLabel: { fontSize: 13, fontWeight: 600, marginBottom: 4 },
  cardMeta: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 9,
    color: "#a9a397",
    letterSpacing: 0.5,
  },
  cardRemove: {
    position: "absolute",
    top: 6,
    right: 8,
    fontSize: 12,
    color: "#a9a397",
  },
  empty: { textAlign: "center", padding: "48px 20px" },
  emptyText: { color: "#cfc9bc", marginBottom: 16 },
  primaryBtn: {
    background: "#b8944f",
    color: "#2f3b36",
    border: "none",
    borderRadius: 24,
    padding: "12px 24px",
    fontWeight: 600,
    fontSize: 14,
  },
  ghostBtn: {
    background: "transparent",
    color: "#f1ede4",
    border: "1px solid #5c6a62",
    borderRadius: 24,
    padding: "12px 24px",
    fontWeight: 500,
    fontSize: 14,
  },
  ghostBtnSmall: {
    background: "transparent",
    color: "#b8944f",
    border: "1px dashed #b8944f",
    borderRadius: 16,
    padding: "5px 12px",
    fontSize: 11.5,
    fontFamily: "'Space Mono', monospace",
  },
  closetTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  itemCount: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
    color: "#a9a397",
    letterSpacing: 0.5,
  },
  checkHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  selectedCount: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
    color: "#b8944f",
    letterSpacing: 0.5,
  },
  checkHint: {
    fontSize: 12.5,
    color: "#a9a397",
    marginBottom: 14,
  },
  formWrap: { display: "flex", flexDirection: "column", paddingBottom: 20 },
  label: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#b8944f",
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    background: "#3a4640",
    border: "1px solid #5c6a62",
    borderRadius: 8,
    padding: "10px 12px",
    color: "#f1ede4",
    fontSize: 14,
  },
  chipRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  chip: {
    background: "transparent",
    border: "1px solid #5c6a62",
    color: "#cfc9bc",
    borderRadius: 16,
    padding: "6px 14px",
    fontSize: 13,
  },
  chipActive: { background: "#b8944f", borderColor: "#b8944f", color: "#2f3b36", fontWeight: 600 },
  swatchGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))",
    gap: 8,
  },
  swatchBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "2px solid transparent",
  },
  swatchBtnActive: { border: "2px solid #f1ede4", transform: "scale(1.1)" },
  colorName: { marginTop: 8, fontSize: 13, color: "#cfc9bc" },
  matchList: { display: "flex", flexDirection: "column", gap: 10 },
  matchRow: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    background: "#3a4640",
    borderRadius: 10,
    padding: 12,
    border: "1px dashed #5c6a62",
  },
  swatchDotSmall: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    flexShrink: 0,
    marginTop: 2,
    border: "1px solid rgba(255,255,255,0.2)",
  },
  matchInfo: { flex: 1 },
  matchTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
  matchName: { fontSize: 14, fontWeight: 600 },
  matchReason: { fontSize: 12.5, color: "#b3ac9e", marginTop: 4, lineHeight: 1.4 },
  badge: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 10,
    padding: "3px 8px",
    borderRadius: 12,
    letterSpacing: 0.3,
    whiteSpace: "nowrap",
  },
  badge_good: { background: "#3f6b46", color: "#e8f0e4" },
  badge_warn: { background: "#c99a2e", color: "#2f3b36" },
  badge_bad: { background: "#a8342b", color: "#f4e9e7" },
  resultCard: {
    marginTop: 24,
    background: "#3a4640",
    borderRadius: 12,
    padding: 16,
    border: "1px solid #b8944f",
  },
  resultHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 },
  resultScore: { fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 600 },
  resultList: { display: "flex", flexDirection: "column", gap: 10 },
  resultLine: { borderTop: "1px dashed #5c6a62", paddingTop: 10 },
  resultLineNames: { fontSize: 13, fontWeight: 600, display: "block", marginBottom: 3 },
  resultLineReason: { fontSize: 12.5, color: "#b3ac9e", lineHeight: 1.4 },
  suggestionBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTop: "1px solid #b8944f",
  },
  suggestionBoxGood: {
    marginTop: 16,
    paddingTop: 16,
    borderTop: "1px solid #b8944f",
    fontSize: 13,
    color: "#cfe0d0",
  },
  suggestionLabel: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#b8944f",
    marginBottom: 10,
  },
  suggestionRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  suggestionArrow: { color: "#b8944f", fontSize: 16 },
  suggestionText: { fontSize: 13, lineHeight: 1.5 },
  suggestionScoreLine: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 12,
    color: "#8fb894",
    marginTop: 3,
  },
  swapBtn: {
    background: "#b8944f",
    color: "#2f3b36",
    border: "none",
    borderRadius: 20,
    padding: "9px 18px",
    fontSize: 13,
    fontWeight: 600,
  },
};
