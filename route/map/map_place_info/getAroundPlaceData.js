const express = require("express");
const router = express.Router();
const { MongoClient } = require("mongodb");
const { CronJob } = require("cron");
const moment = require("moment-timezone");

require("dotenv").config();

const url = process.env.MONGO_URL;
const database = process.env.MONGO_DB_NAME_MAP_INFO;
const collectionName = process.env.MONGO_DB_NAME_MAP_PLACES_INFO;
const client = new MongoClient(url);

// 현재 위치를 기준으로 주변 장소를 검색하는 함수
async function getAroundPlaceData(currentLat, currentLon, searchRadius) {
  let result = await client.connect();
  let db = result.db(database);
  const collection = db.collection(collectionName);
  const docs = await collection.find({}).toArray();
  console.log("params:", currentLat, currentLon, searchRadius);
  console.log("Fetched documents:", docs);
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const filtered = docs.filter((doc) => {
    const dLat = toRad(doc.latitude - currentLat);
    const dLon = toRad(doc.longitude - currentLon);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(currentLat)) *
        Math.cos(toRad(doc.latitude)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;
    return dist <= searchRadius;
  });
  console.log("Filtered documents:", filtered);
  return filtered;
}

router.get("/v1/:getaroundplacedata", async (req, res) => {
  const currentLat = parseFloat(req.query.lat);
  const currentLon = parseFloat(req.query.lon);
  const searchRadius = parseFloat(req.query.radius);
  const documents = await getAroundPlaceData(
    currentLat,
    currentLon,
    searchRadius
  );
  res.json({ result: documents });
});

module.exports = router;
