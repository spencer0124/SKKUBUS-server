const { Router } = require("express");
const { getBusGroups, computeEtag } = require("./bus-config.data");

const router = Router();

/**
 * GET /bus/config
 * Returns ordered groups array with ETag caching.
 */
router.get("/", (req, res) => {
  const lang = req.lang;
  const etag = computeEtag(lang);

  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }

  const groups = getBusGroups(lang);
  res.set("ETag", etag);
  res.set("Cache-Control", "public, max-age=300");
  res.success({ groups });
});

module.exports = router;
