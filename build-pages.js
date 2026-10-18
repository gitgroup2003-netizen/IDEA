// Embeds the web page into pages.js so the server can serve it on any host (including Vercel).
// Run "npm run build" after editing anything in public/.
const fs = require("fs"), path = require("path");
const read = f => fs.readFileSync(path.join(__dirname, "public", f), "utf8");
fs.writeFileSync(path.join(__dirname, "pages.js"), "module.exports=" + JSON.stringify({ html: read("index.html"), shim: read("claude-shim.js") }) + ";\n");
console.log("pages.js written");
