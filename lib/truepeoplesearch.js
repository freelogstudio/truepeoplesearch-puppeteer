'use strict';

const puppeteer = require('puppeteer-extra');

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const fs = require('fs-extra');
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
puppeteer.use(StealthPlugin());

exports.TruePeopleSearch = class TruePeopleSearch {
  static async initialize() {
    return new this(await puppeteer.launch({ headless: true }));
  }
  constructor(browser) {
    this._browser = browser;
  }
  async screenshot(p) {
    const screen = await this._browser.screenshot();
    await fs.writeFile(p, screen);
  }
  async searchNumber(n) {
    const page = await this._browser.newPage();
    await page.goto('https://truepeoplesearch.com');
    await page.waitForNetworkIdle();
    await page.waitForTimeout(1000);
    await page.goto('https://www.truepeoplesearch.com/resultphone?phoneno=(' + n.substr(1, 3) + ')' + n.substr(3, 3) + '-' + n.substr(6));
    await page.waitForNetworkIdle();
    await page.waitForTimeout(1000);
    await page.goto('https://www.truepeoplesearch.com/details?phoneno=' + n + '&rid=0x0');
    await page.waitForNetworkIdle();
    return page;
  }
  search(name) {}
}
