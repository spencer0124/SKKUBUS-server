const admin = require("./firebase");
const config = require("./config");

const tokenCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Verify Firebase idToken from Authorization header.
 * Sets req.uid on success. If no token is provided or Firebase
 * is not configured, continues without uid (rate limiter falls back to req.ip).
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  // Firebase not configured — skip verification, pass through
  if (!config.firebase.serviceAccount) {
    return next();
  }

  const idToken = authHeader.split("Bearer ")[1];

  // Check cache first
  const cached = tokenCache.get(idToken);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    req.uid = cached.uid;
    return next();
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.uid = decoded.uid;
    tokenCache.set(idToken, { uid: decoded.uid, time: Date.now() });
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid auth token" });
  }
}

module.exports = verifyToken;
