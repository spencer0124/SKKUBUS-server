require("dotenv").config();

const config = {
  port: process.env.PORT || 3000,
  mongo: {
    url: process.env.MONGO_URL,
    dbName: process.env.MONGO_DB_NAME_BUS_CAMPUS,
    collections: {
      INJA_weekday: process.env.MONGO_DB_NAME_INJA_WEEKDAY,
      INJA_friday: process.env.MONGO_DB_NAME_INJA_FRIDAY,
      INJA_weekend: process.env.MONGO_DB_NAME_INJA_WEEKEND,
      JAIN_weekday: process.env.MONGO_DB_NAME_JAIN_WEEKDAY,
      JAIN_friday: process.env.MONGO_DB_NAME_JAIN_FRIDAY,
      JAIN_weekend: process.env.MONGO_DB_NAME_JAIN_WEEKEND,
    },
  },
  api: {
    hsscNewProd: process.env.API_HSSC_NEW_PROD,
    jongro07List: process.env.API_JONGRO07_LIST_PROD,
    jongro02List: process.env.API_JONGRO02_LIST_PROD,
    jongro07Loc: process.env.API_JONGRO07_LOC_PROD,
    jongro02Loc: process.env.API_JONGRO02_LOC_PROD,
    stationHyehwa: process.env.API_STATION_HEWA,
  },
};

// Validate required env vars at startup
const required = [
  ["MONGO_URL", config.mongo.url],
  ["API_HSSC_NEW_PROD", config.api.hsscNewProd],
  ["API_JONGRO07_LIST_PROD", config.api.jongro07List],
  ["API_JONGRO02_LIST_PROD", config.api.jongro02List],
  ["API_JONGRO07_LOC_PROD", config.api.jongro07Loc],
  ["API_JONGRO02_LOC_PROD", config.api.jongro02Loc],
  ["API_STATION_HEWA", config.api.stationHyehwa],
];

const missing = required.filter(([, value]) => !value).map(([name]) => name);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  if (process.env.NODE_ENV !== "test") {
    process.exit(1);
  }
}

module.exports = config;
