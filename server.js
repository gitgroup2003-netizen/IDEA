// Local / Render / Railway entry point. (Vercel uses api/index.js instead.)
const app = require("./app"), port = process.env.PORT || 3000;
app.use(require("express").static(require("path").join(__dirname, "public")));
app.listen(port, () => console.log("IDEA running on port " + port + (process.env.ANTHROPIC_API_KEY ? "" : "  (no ANTHROPIC_API_KEY set: AI is off)")));
