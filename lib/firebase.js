const admin = require("firebase-admin");
const config = require("./config");

if (config.firebase.serviceAccount && !config.isTest) {
  try {
    const serviceAccount = JSON.parse(config.firebase.serviceAccount);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (err) {
    console.error("[firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT:", err.message);
    console.error("[firebase] Firebase auth will be unavailable.");
  }
}

module.exports = admin;
