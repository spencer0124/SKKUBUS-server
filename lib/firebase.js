const admin = require("firebase-admin");
const config = require("./config");

if (config.firebase.serviceAccount && !config.isTest) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(config.firebase.serviceAccount)
    ),
  });
}

module.exports = admin;
