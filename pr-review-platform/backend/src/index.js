const express = require("express");
const cors = require("cors");
const reviewsRouter = require("./routes/reviews");
const branchConfigRouter = require("./routes/config");

const app = express();

app.use(cors()); // dashboard runs on a different origin (Vercel) than the backend (Render)
app.use(express.json({ limit: "2mb" })); // findings payloads can include a fair bit of text

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/reviews", reviewsRouter);
app.use("/api/config/branches", branchConfigRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`PR review backend listening on port ${PORT}`);
});
