var { TruePeopleSearch } = require('./');

var scrape = async () => {
  const page = (await TruePeopleSearch.initialize()).searchNumber('8602665407')
  // this number belongs to a known sex offender, so it should work
  await page.screenshot({ path: path.join(process.env.HOME, 'result.png') });
  return page;
};
