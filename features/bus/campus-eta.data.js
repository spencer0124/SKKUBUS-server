const axios = require("axios");
const config = require("../../lib/config");
const logger = require("../../lib/logger");

// --- Campus coordinates (lng,lat — Naver Directions API order) ---
// 인사캠: 600주년기념관 앞 셔틀 승차장 부근
// 자과캠: N센터 / 제1공학관 부근
const SEOUL_CAMPUS = "126.993688,37.587308";
const SUWON_CAMPUS = "126.975532,37.292345";

const NAVER_DIRECTIONS_URL =
  "https://naveropenapi.apigw.ntruss.com/map-direction/v1/driving";

// --- In-memory cache (10-minute TTL, success-only) ---

const CACHE_TTL_MS = 10 * 60_000;
let cachedData = null;
let cachedTime = 0;

function getCached() {
  if (cachedData && Date.now() - cachedTime < CACHE_TTL_MS) {
    return cachedData;
  }
  return null;
}

function getStaleCached() {
  return cachedData;
}

function setCache(data) {
  cachedData = data;
  cachedTime = Date.now();
}

function clearCache() {
  cachedData = null;
  cachedTime = 0;
}

// --- Duration formatting ---

function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}시간 ${minutes}분`;
  if (hours > 0) return `${hours}시간`;
  return `${minutes}분`;
}

// --- Naver Directions API call ---

async function fetchDrivingEta(start, goal) {
  if (!config.naver.apiKeyId || !config.naver.apiKey) {
    throw new Error("Naver API keys not configured (NAVER_API_KEY_ID, NAVER_API_KEY)");
  }

  const { data } = await axios.get(NAVER_DIRECTIONS_URL, {
    params: { start, goal },
    headers: {
      "X-NCP-APIGW-API-KEY-ID": config.naver.apiKeyId,
      "X-NCP-APIGW-API-KEY": config.naver.apiKey,
    },
    timeout: 5000,
  });

  if (data.code !== 0) {
    throw new Error(`Naver API error: code=${data.code}, message=${data.message}`);
  }

  const summary = data.route.traoptimal[0].summary;
  return {
    duration: summary.duration,
    durationText: formatDuration(summary.duration),
    distance: summary.distance,
  };
}

// --- Main export ---

async function getEtaData() {
  const fresh = getCached();
  if (fresh) return fresh;

  const [injaResult, jainResult] = await Promise.allSettled([
    fetchDrivingEta(SEOUL_CAMPUS, SUWON_CAMPUS),
    fetchDrivingEta(SUWON_CAMPUS, SEOUL_CAMPUS),
  ]);

  const inja =
    injaResult.status === "fulfilled" ? injaResult.value : null;
  const jain =
    jainResult.status === "fulfilled" ? jainResult.value : null;

  if (injaResult.status === "rejected") {
    logger.warn({ err: injaResult.reason.message }, "[campus-eta] INJA fetch failed");
  }
  if (jainResult.status === "rejected") {
    logger.warn({ err: jainResult.reason.message }, "[campus-eta] JAIN fetch failed");
  }

  // Both failed — try stale cache, otherwise throw
  if (!inja && !jain) {
    const stale = getStaleCached();
    if (stale) {
      logger.warn("[campus-eta] Both directions failed, returning stale cache");
      return stale;
    }
    throw new Error("Naver Directions API unavailable for both directions");
  }

  const result = { inja, jain };

  // Only cache fully successful responses
  if (inja && jain) {
    setCache(result);
  }

  return result;
}

module.exports = {
  getEtaData,
  formatDuration,
  clearCache,
};
