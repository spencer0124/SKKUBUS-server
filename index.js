const express = require("express");
const swaggerUi = require("swagger-ui-express");
const pollers = require("./lib/pollers");
const { closeClient } = require("./lib/db");

let swaggerFile;
try {
  swaggerFile = require("./swagger/swagger-output.json");
} catch (e) {
  console.warn("swagger-output.json not found. Run 'npm run swagger' to generate it.");
}

const app = express();
const PORT = require("./lib/config").port;

// Swagger API docs
if (swaggerFile) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerFile, { explorer: true }));
}

// Feature routes
const searchRoute = require("./features/search/search.routes");
const { hsscRoutes, jongroRoutes, campusRoutes } = require("./features/bus/bus.routes");
const stationRoute = require("./features/station/station.routes");
const mobileRoute = require("./features/mobile/mobile.routes");
const adRoute = require("./features/ad/ad.routes");

app.use("/search", searchRoute);
app.use("/bus/hssc", hsscRoutes);
app.use("/bus/hssc_new", hsscRoutes);
app.use("/bus/jongro", jongroRoutes);
app.use("/station", stationRoute);
app.use("/mobile/", mobileRoute);
app.use("/ad/", adRoute);
app.use("/campus/", campusRoutes);

// Shared error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
if (require.main === module) {
  pollers.startAll();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down...");
    pollers.stopAll();
    await closeClient();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

module.exports = app;
