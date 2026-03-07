const { getClient } = require("../../lib/db");
const config = require("../../lib/config");
const moment = require("moment-timezone");

// --- Collection name resolution ---

const DAY_TO_SCHEDULE = {
  monday: "weekday",
  tuesday: "weekday",
  wednesday: "weekday",
  thursday: "weekday",
  friday: "friday",
  saturday: "weekend",
  sunday: "weekend",
};

function resolveCollectionName(direction, day) {
  if (!direction || !day) return null;
  const schedule = DAY_TO_SCHEDULE[day];
  if (!schedule) return null;
  const key = `${direction.toUpperCase()}_${schedule}`;
  return config.mongo.collections[key] || null;
}

// --- DB helper ---

function getCollection(collectionName) {
  const client = getClient();
  return client.db(config.mongo.dbName).collection(collectionName);
}

// --- In-memory cache (keyed by collection name, 60s TTL) ---

const CACHE_TTL_MS = 60_000;
const cache = new Map();

function getCached(collectionName) {
  const entry = cache.get(collectionName);
  if (entry && Date.now() - entry.time < CACHE_TTL_MS) {
    return entry.data;
  }
  return null;
}

function setCache(collectionName, data) {
  cache.set(collectionName, { data, time: Date.now() });
}

function clearCache() {
  cache.clear();
}

// --- isFastestBus computation (pure, time-dependent) ---

function findNextBusTime(documents) {
  const currentTime = moment().tz("Asia/Seoul");
  const availableBuses = documents.filter((doc) => doc.isAvailableBus);
  let nextTime = null;
  for (const doc of availableBuses) {
    const busTime = moment.tz(
      `${currentTime.format("YYYY-MM-DD")} ${doc.operatingHours}`,
      "Asia/Seoul"
    );
    // HH:mm zero-padded format allows lexicographic comparison (e.g., "08:00" < "10:00")
    if (busTime.isAfter(currentTime) && (!nextTime || doc.operatingHours < nextTime)) {
      nextTime = doc.operatingHours;
    }
  }
  return nextTime;
}

function applyFastestBusFlag(documents) {
  const nextBusTime = findNextBusTime(documents);
  return documents.map((doc) => ({
    ...doc,
    isFastestBus:
      nextBusTime != null && doc.operatingHours === nextBusTime && doc.isAvailableBus,
  }));
}

// --- Main data access ---

async function getData(direction, dayType) {
  const collectionName = resolveCollectionName(direction, dayType);
  if (!collectionName) return [];

  let documents = getCached(collectionName);
  if (!documents) {
    const collection = getCollection(collectionName);
    documents = await collection.find().sort({ index: 1 }).toArray();
    setCache(collectionName, documents);
  }

  return applyFastestBusFlag(documents);
}

module.exports = {
  getData,
  resolveCollectionName,
  findNextBusTime,
  clearCache,
};
