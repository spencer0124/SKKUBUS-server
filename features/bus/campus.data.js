const { getClient } = require("../../lib/db");
const config = require("../../lib/config");
const moment = require("moment-timezone");

async function getData(bustype) {
  const client = getClient();
  let result = await client.connect();
  let db = result.db(config.mongo.dbName);

  var collectionname = config.mongo.collections.INJA_weekday;

  if (
    bustype == "INJA_monday" ||
    bustype == "INJA_tuesday" ||
    bustype == "INJA_wednesday" ||
    bustype == "INJA_thursday"
  ) {
    collectionname = config.mongo.collections.INJA_weekday;
  } else if (bustype == "INJA_friday") {
    collectionname = config.mongo.collections.INJA_friday;
  } else if (bustype == "INJA_saturday" || bustype == "INJA_sunday") {
    collectionname = config.mongo.collections.INJA_weekend;
  } else if (
    bustype == "JAIN_monday" ||
    bustype == "JAIN_tuesday" ||
    bustype == "JAIN_wednesday" ||
    bustype == "JAIN_thursday"
  ) {
    collectionname = config.mongo.collections.JAIN_weekday;
  } else if (bustype == "JAIN_friday") {
    collectionname = config.mongo.collections.JAIN_friday;
  } else if (bustype == "JAIN_saturday" || bustype == "JAIN_sunday") {
    collectionname = config.mongo.collections.JAIN_weekend;
  }

  let collection = db.collection(collectionname);
  let documents = await collection.find().sort({ index: 1 }).toArray();
  const currentTime = moment().tz("Asia/Seoul");

  await collection.updateMany({}, { $set: { isFastestBus: false } });

  let availableBuses = documents.filter((doc) => doc.isAvailableBus);

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

  if (nextBus) {
    await collection.updateOne(
      { _id: nextBus._id },
      { $set: { isFastestBus: true } }
    );
  }

  return await collection.find().sort({ index: 1 }).toArray();
}

module.exports = { getData };
