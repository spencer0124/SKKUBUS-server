const { Router } = require("express");
const { getBusConfigs, CONFIG_VERSION } = require("./bus-config.data");

const router = Router();

/**
 * GET /bus/config
 * Returns all bus route configurations.
 * Text is localised based on Accept-Language (req.lang).
 */
router.get("/", (req, res) => {
  const configs = getBusConfigs(req.lang);
  res.success(configs, { configVersion: CONFIG_VERSION });
});

/**
 * GET /bus/config/version
 * Lightweight version check — clients compare against cached version
 * and only re-fetch /bus/config when it differs.
 */
router.get("/version", (req, res) => {
  res.success({ configVersion: CONFIG_VERSION });
});

module.exports = router;
