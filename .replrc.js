var { TruePeopleSearch } = require('./');
const path = require('path');

var scrape = async (n) => {
  const page = await (await TruePeopleSearch.initialize()).searchNumber(n)
  return page;
};
