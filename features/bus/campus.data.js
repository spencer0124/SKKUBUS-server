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

function resolveCollectionName(bustype) {
  if (!bustype || typeof bustype !== "string") return null;
  const parts = bustype.split("_");
  if (parts.length !== 2) return null;
  const [direction, day] = parts;
  const schedule = DAY_TO_SCHEDULE[day];
  if (!schedule) return null;
  return config.mongo.collections[`${direction}_${schedule}`] || null;
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

function findNextBusId(documents) {
  const currentTime = moment().tz("Asia/Seoul");
  const availableBuses = documents.filter((doc) => doc.isAvailableBus);

  const nextBus = availableBuses.reduce((acc, doc) => {
    const busTime = moment.tz(
      `${currentTime.format("YYYY-MM-DD")} ${doc.operatingHours}`,
      "Asia/Seoul"
    );
    if (
      busTime.isAfter(currentTime) &&
      (!acc ||
        busTime.isBefore(
          moment.tz(
            `${currentTime.format("YYYY-MM-DD")} ${acc.operatingHours}`,
            "Asia/Seoul"
          )
        ))
    ) {
      return doc;
    }
    return acc;
  }, null);

  return nextBus ? nextBus._id : null;
}

function applyFastestBusFlag(documents) {
  const nextBusId = findNextBusId(documents);
  return documents.map((doc) => ({
    ...doc,
    isFastestBus:
      nextBusId != null && String(doc._id) === String(nextBusId),
  }));
}

// --- Main data access ---

async function getData(bustype) {
  const collectionName = resolveCollectionName(bustype);
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
  findNextBusId,
  clearCache,
};
