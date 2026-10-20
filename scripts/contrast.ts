// scripts/contrast.ts — run with: npx tsx scripts/contrast.ts
const lin = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126*lin(n>>16&255) + 0.7152*lin(n>>8&255) + 0.0722*lin(n&255); };
const ratio = (a: string, b: string) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const bg = { background: "#faf8f5", surface: "#ffffff" };            // fill from index.css
const fg = { primary: "#1c202e", muted: "#484f60", subtle: "#5a6275", secondary: "#b93c3c", control: "#717a8c" };    // fill from index.css
for (const [fn, f] of Object.entries(fg)) {
  for (const [bn, b] of Object.entries(bg)) {
    const r = ratio(f, b);
    console.log(`${fn} on ${bn}: ${r.toFixed(2)}:1 ${r >= 4.5 ? "PASS" : r >= 3.0 ? "PASS (UI/Large)" : "FAIL"}`);
  }
}
