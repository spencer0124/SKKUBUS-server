const axios = require("axios");
const pollers = require("../../lib/pollers");
const config = require("../../lib/config");
const logger = require("../../lib/logger");
const { getBuildingsCollection, getSpacesCollection, clearCache } = require("./building.data");

const SKKU_API = "https://www.skku.edu/skku/about/campusInfo/campusMap.do";
const CAMPUS_CODES = [
  { cd: "1", name: "hssc" },
  { cd: "2", name: "nsc" },
];

const MIN_BUILDINGS = 50;
const MIN_SPACES = 5000;
const CONCURRENCY = 5;

// --- Helpers ---

function buildImageUrl(filePath, encodeNm) {
  if (!filePath || !encodeNm) return null;
  return `https://www.skku.edu${filePath}${encodeNm}`;
}

function toBuildingDoc(item, campus, syncTime) {
  const skkuId = parseInt(item.id, 10);
  const buildNo = item.buildNo || null;
  const lat = parseFloat(item.latitude);
  const lng = parseFloat(item.longtitude); // SKKU typo

  return {
    filter: { _id: skkuId },
    update: {
      $set: {
        buildNo,
        type: buildNo ? "building" : "facility",
        campus,
        name: { ko: item.buildNm || "", en: item.buildNmEng || "" },
        description: { ko: item.krText || "", en: item.enText || "" },
        location: {
          type: "Point",
          coordinates: [lng, lat], // GeoJSON: [lng, lat]
        },
        image: {
          url: buildImageUrl(item.filePath, item.encodeNm),
          filename: item.encodeNm || null,
        },
        accessibility: {
          elevator: item.handicappedElevatorYn === "Y",
          toilet: item.handicappedToiletYn === "Y",
        },
        "sync.listAt": syncTime,
        skkuCreatedAt: item.createDt || null,
        skkuUpdatedAt: item.updateDt || null,
        updatedAt: syncTime,
      },
      $setOnInsert: {
        extensions: {},
      },
    },
  };
}

// --- Phase 1: buildList ---

async function fetchBuildList(campusCd) {
  const { data } = await axios.get(SKKU_API, {
    params: {
      mode: "buildList",
      srSearchValue: "",
      campusCd,
    },
    timeout: 30000,
  });
  return data.buildItems || [];
}

async function phase1(syncTime) {
  const buildingsCol = getBuildingsCollection();
  let allItems = [];

  for (const { cd, name } of CAMPUS_CODES) {
    const items = await fetchBuildList(cd);
    logger.info({ campus: name, count: items.length }, "[building-sync] Phase 1: fetched buildList");
    for (const item of items) {
      allItems.push({ item, campus: name });
    }
  }

  // Sanity check
  if (allItems.length < MIN_BUILDINGS) {
    logger.warn(
      { count: allItems.length },
      "[building-sync] Suspiciously few buildings, aborting",
    );
    return null;
  }

  // Upsert buildings
  const ops = allItems.map(({ item, campus }) => {
    const doc = toBuildingDoc(item, campus, syncTime);
    return {
      updateOne: {
        filter: doc.filter,
        update: doc.update,
        upsert: true,
      },
    };
  });

  const result = await buildingsCol.bulkWrite(ops, { ordered: false });
  logger.info(
    {
      matched: result.matchedCount,
      upserted: result.upsertedCount,
      modified: result.modifiedCount,
    },
    "[building-sync] Phase 1: buildings upserted",
  );

  return allItems;
}

// --- Phase 2: buildInfo (attachments + floorItem → spaces) ---

async function fetchBuildInfo(buildNo, skkuId) {
  const { data } = await axios.get(SKKU_API, {
    params: {
      mode: "buildInfo",
      buildNo,
      id: skkuId,
    },
    timeout: 30000,
  });
  return data;
}

async function phase2(allItems, syncTime) {
  const buildingsCol = getBuildingsCollection();
  const spacesCol = getSpacesCollection();

  // Only buildings with buildNo (59 of 78)
  const withBuildNo = allItems.filter(({ item }) => item.buildNo);

  let spacesOps = [];
  let processed = 0;
  let errors = 0;

  // Process in batches of CONCURRENCY
  for (let i = 0; i < withBuildNo.length; i += CONCURRENCY) {
    const batch = withBuildNo.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async ({ item, campus }) => {
        const info = await fetchBuildInfo(item.buildNo, item.id);
        const skkuId = parseInt(item.id, 10);

        // Save attachments to building
        const attachments = (info.attachItem || []).map((a) => ({
          id: a.id,
          url: buildImageUrl(a.file_path, a.encode_nm),
          filename: a.file_nm || null,
          alt: a.image_alt || "",
        }));

        await buildingsCol.updateOne(
          { _id: skkuId },
          {
            $set: {
              attachments,
              "sync.detailAt": syncTime,
              "sync.detailError": null,
            },
          },
        );

        // floorItem → spaces upsert ops
        const buildingName = { ko: item.buildNm || "", en: item.buildNmEng || "" };
        for (const fi of info.floorItem || []) {
          spacesOps.push({
            updateOne: {
              filter: {
                spaceCd: fi.space_cd,
                buildNo: item.buildNo,
                campus,
              },
              update: {
                $set: {
                  floor: { ko: fi.floor_nm || "", en: fi.floor_nm_eng || "" },
                  name: {
                    ko: fi.spcae_nm || "", // SKKU typo
                    en: fi.spcae_nm_eng === "undefined" ? "" : (fi.spcae_nm_eng || ""),
                  },
                  buildingName,
                  syncedAt: syncTime,
                },
                $addToSet: { sources: "buildInfo" },
                $setOnInsert: { conspaceCd: null },
              },
              upsert: true,
            },
          });
        }

        processed++;
      }),
    );

    // Record errors
    for (const r of results) {
      if (r.status === "rejected") {
        errors++;
        const failedItem = batch[results.indexOf(r)];
        const skkuId = parseInt(failedItem.item.id, 10);
        logger.warn(
          { skkuId, buildNo: failedItem.item.buildNo, err: r.reason?.message },
          "[building-sync] Phase 2: buildInfo failed",
        );
        // Mark error on building doc
        await buildingsCol.updateOne(
          { _id: skkuId },
          { $set: { "sync.detailError": r.reason?.message || "unknown" } },
        ).catch(() => {});
      }
    }
  }

  // Bulk write spaces from buildInfo
  if (spacesOps.length > 0) {
    const result = await spacesCol.bulkWrite(spacesOps, { ordered: false });
    logger.info(
      {
        matched: result.matchedCount,
        upserted: result.upsertedCount,
        processed,
        errors,
      },
      "[building-sync] Phase 2: buildInfo spaces upserted",
    );
  }

  return { processed, errors, spacesCount: spacesOps.length };
}

// --- Phase 3: spaceList ---

async function fetchSpaceList(campusCd) {
  const { data } = await axios.get(SKKU_API, {
    params: {
      mode: "spaceList",
      srSearchValue: "",
      campusCd,
    },
    timeout: 30000,
  });
  return data.items || [];
}

async function phase3(syncTime) {
  const spacesCol = getSpacesCollection();
  let allSpaces = [];

  for (const { cd, name } of CAMPUS_CODES) {
    const items = await fetchSpaceList(cd);
    logger.info({ campus: name, count: items.length }, "[building-sync] Phase 3: fetched spaceList");
    for (const item of items) {
      allSpaces.push({ item, campus: name });
    }
  }

  // Upsert spaces
  const ops = allSpaces.map(({ item, campus }) => ({
    updateOne: {
      filter: {
        spaceCd: item.spaceCd,
        buildNo: item.buildNo,
        campus,
      },
      update: {
        $set: {
          floor: { ko: item.floorNm || "", en: item.floorNmEng || "" },
          name: {
            ko: item.spcaeNm || "", // SKKU typo
            en: item.spcaeNmEng === "undefined" ? "" : (item.spcaeNmEng || ""),
          },
          buildingName: { ko: item.buildNm || "", en: item.buildNmEng || "" },
          conspaceCd: item.conspaceCd || null,
          syncedAt: syncTime,
        },
        $addToSet: { sources: "spaceList" },
      },
      upsert: true,
    },
  }));

  if (ops.length > 0) {
    const result = await spacesCol.bulkWrite(ops, { ordered: false });
    logger.info(
      { matched: result.matchedCount, upserted: result.upsertedCount },
      "[building-sync] Phase 3: spaceList upserted",
    );
  }

  // Sanity check before stale delete
  if (allSpaces.length < MIN_SPACES) {
    logger.warn(
      { count: allSpaces.length },
      "[building-sync] Suspiciously few spaces, skipping stale delete",
    );
    return allSpaces.length;
  }

  // Delete stale spaces (synced before this run)
  const deleteResult = await spacesCol.deleteMany({
    syncedAt: { $lt: syncTime },
  });
  if (deleteResult.deletedCount > 0) {
    logger.info(
      { deleted: deleteResult.deletedCount },
      "[building-sync] Phase 3: stale spaces deleted",
    );
  }

  return allSpaces.length;
}

// --- Main sync ---

async function syncBuildings() {
  const syncTime = new Date();
  const start = Date.now();

  try {
    // Phase 1: buildList → buildings upsert
    const allItems = await phase1(syncTime);
    if (!allItems) return; // Sanity check failed

    // Phase 2: buildInfo → attachments + floorItem spaces
    try {
      await phase2(allItems, syncTime);
    } catch (err) {
      logger.error({ err: err.message }, "[building-sync] Phase 2 failed");
      // Continue to Phase 3 — buildings data is still valid
    }

    // Phase 3: spaceList → spaces upsert + stale delete
    let spacesCount = 0;
    try {
      spacesCount = await phase3(syncTime);
    } catch (err) {
      logger.error({ err: err.message }, "[building-sync] Phase 3 failed, skipping stale delete");
    }

    // Invalidate cache so next read picks up fresh data
    clearCache();

    const elapsed = Date.now() - start;
    logger.info(
      { buildings: allItems.length, spaces: spacesCount, elapsed },
      "[building-sync] Complete",
    );
  } catch (err) {
    logger.error({ err: err.message }, "[building-sync] Sync failed");
  }
}

// Register with poller system (side-effect on require)
pollers.registerPoller(
  () => syncBuildings().catch((err) =>
    logger.error({ err: err.message }, "[building-sync] Poller error"),
  ),
  config.building.syncIntervalMs,
  "building-sync",
);

module.exports = { syncBuildings };
