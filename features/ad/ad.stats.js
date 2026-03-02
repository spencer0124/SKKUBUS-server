const { ObjectId } = require("mongodb");
const { getEventsCollection } = require("./ad.data");

async function recordEvent(placement, event, adId) {
  const col = getEventsCollection();
  const doc = {
    adId: adId ? new ObjectId(adId) : null,
    placement,
    event,
    impressionId: null,
    timestamp: new Date(),
  };
  await col.insertOne(doc);
}

async function getStats() {
  const col = getEventsCollection();
  const pipeline = [
    {
      $group: {
        _id: { placement: "$placement", event: "$event" },
        count: { $sum: 1 },
      },
    },
  ];

  const results = await col.aggregate(pipeline).toArray();

  const stats = {};
  for (const r of results) {
    const key = `${r._id.placement}:${r._id.event}`;
    stats[key] = r.count;
  }
  return stats;
}

module.exports = { recordEvent, getStats };
