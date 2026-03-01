const { MongoClient } = require("mongodb");
const config = require("./config");

let client;

function getClient() {
  if (!client) {
    client = new MongoClient(config.mongo.url);
  }
  return client;
}

async function closeClient() {
  if (client) {
    await client.close();
    client = null;
  }
}

module.exports = { getClient, closeClient };
