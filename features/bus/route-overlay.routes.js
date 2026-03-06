const { Router } = require("express");
const { jongro07Coords, jongro02Coords } = require("./route-overlay.data");

const router = Router();

const ROUTES = {
  jongro07: { color: "4CAF50", coords: jongro07Coords },
  jongro02: { color: "4CAF50", coords: jongro02Coords },
};

/**
 * GET /bus/route/:routeId
 * Returns route overlay coordinates for map display.
 */
router.get("/:routeId", (req, res) => {
  const route = ROUTES[req.params.routeId];
  if (!route) {
    return res.error(404, "NOT_FOUND", `Route '${req.params.routeId}' not found`);
  }
  res.success(route);
});

module.exports = router;
