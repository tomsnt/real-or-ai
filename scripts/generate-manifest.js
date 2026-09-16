// Genera images/manifest.json leggendo per davvero cosa c'è dentro
// images/real/ e images/fake/, con qualsiasi nome di file.
// Eseguito automaticamente da .github/workflows/deploy.yml ad ogni push;
// puoi lanciarlo anche a mano (`node scripts/generate-manifest.js`) per
// testare in locale prima di pubblicare.

const fs = require("fs");
const path = require("path");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov"]);

function scan(folder) {
  const dir = path.join(__dirname, "..", "images", folder);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()) || VIDEO_EXT.has(path.extname(name).toLowerCase()))
    .sort()
    .map((name) => ({
      file: `${folder}/${name}`,
      type: VIDEO_EXT.has(path.extname(name).toLowerCase()) ? "video" : "image",
    }));
}

const real = scan("real").map((item) => ({ ...item, isAI: false }));
const fake = scan("fake").map((item) => ({ ...item, isAI: true }));
const manifest = [...real, ...fake];

const outPath = path.join(__dirname, "..", "images", "manifest.json");
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  `Manifest generato: ${real.length} reali + ${fake.length} AI = ${manifest.length} totali (${outPath})`
);
