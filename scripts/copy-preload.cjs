const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "electron", "preload.cjs");
const dest = path.join(root, "dist-electron", "preload.cjs");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("copied preload.cjs -> dist-electron/");
