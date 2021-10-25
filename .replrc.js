var { byPhone, byName } = require('./');
const path = require('path');

var scrape = async ({ name, citystatezip }) => {
  const page = await byName(name, citystatezip)
  return page;
};
