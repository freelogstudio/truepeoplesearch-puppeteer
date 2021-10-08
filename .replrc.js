var { byPhone } = require('./');
const path = require('path');

var scrape = async (n) => {
  const page = await byPhone(n)
  return page;
};
