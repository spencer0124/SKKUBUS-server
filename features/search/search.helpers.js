function encodeQuery(query) {
  return /^[A-Za-z0-9]+$/.test(query) ? query : encodeURIComponent(query);
}

module.exports = { encodeQuery };
