'use strict';

const puppeteer = require('puppeteer-extra');
const url = require('url');
const qs = require('querystring');

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const fs = require('fs-extra');
if (process.env.PUPPETEER_ADBLOCKER) puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
puppeteer.use(StealthPlugin());
puppeteer.use(RecaptchaPlugin({
  provider: {
    id: '2captcha',
    token: process.env.TWOCAPTCHA_TOKEN
  },
  visualFeedback: true
}));


exports.TruePeopleSearch = class TruePeopleSearch {
  static formatAddress(v) {
    return v.replace(/\n/g, ', ');
  }
  static phoneToObject(s) {
    const [ phone, type ] = s.split(' - ');
    return {
      phone,
      type
    };
  }
  static async initialize() {
    const args = process.env.PUPPETEER_PROXY ? [ '--proxy-server=' + process.env.PUPPETEER_PROXY ] : [];
    return new this(await puppeteer.launch({ headless: true, args }));
  }
  constructor(browser) {
    this._browser = browser;
  }
  async beforeHook(page, meta) {
    if (process.env.NODE_ENV === 'test') {
      console.error(meta);
      await page.screenshot({ path: 'tps-' + meta + '.png' });
    }
  }
  async screenshot(p) {
    const screen = await this._browser.screenshot();
    await fs.writeFile(p, screen);
  }
  async waitForNavigation(page) {
    await page.waitForTimeout(1000);
  }
  async submitRecaptchasAndWait(page) {
    await this.waitForNavigation(page);
    try {
      await page.click('button[type="submit"]');
      await this.waitForNavigation(page);
    } catch (e) {
      console.error(e);
      console.error('pass');
    }
  }
  async solveCaptchas(page) {
    await page.solveRecaptchas();
    await this.beforeHook(page, 'after-solve');
  }
  next(proceed) {
    const fields = [ 1, 4, 6, 10, 13, 15, 18, 20 ];
    if (!this.row) this.row = 0;
    const result = fields[this.row];
    if (proceed) this.row++;
    return result;
  }
  async tryOrNull(fn) {
    try {
      return await fn();
    } catch (e) {
      return null;
    }
  }
  async extractData(page) {
    let row = 6;
    const content = await page.content();
    try {
      return {
        person: await page.$eval(`div#personDetails > div:nth-child(${this.next()}) span`, (el) => el.innerText),
        age: await page.$eval(`div#personDetails > div:nth-child(${this.next(true)}) span.content-value`, (el) => el.innerText),
        currentAddress: content.match('Current Address') ? TruePeopleSearch.formatAddress(await page.$eval(`div#personDetails > div:nth-child(${this.next(true)}) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1)`, (el) => el.innerText)) : null,
        phones: await this.tryOrNull(async () => content.match('Phone Numbers') ? (await page.$$eval(`div#personDetails > div:nth-child(${this.next(true)}) > div:nth-child(2) div.content-value`, (els) => els.map((v) => v.innerText.trim()))).map(TruePeopleSearch.phoneToObject) : []),
        emails: await this.tryOrNull(async () => content.match('mails') ? await page.$$eval(`div#personDetails > div:nth-child(${this.next(true)}) > div:nth-child(2) div.content-value`, (els) => els.map((v) => v.innerText.trim())) : []),
        names: await this.tryOrNull(async () => content.match('Names') ? await page.$eval(`div#personDetails > div:nth-child(${this.next(true)}) div.content-value`, (el) => el.innerText.trim().split(',').map((v) => v.trim())) : []),
        addresses: await this.tryOrNull(async () => content.match('Previous Addresses') ? (await page.$$eval(`div#personDetails > div:nth-child(${this.next(true)}) div.content-value`, (els) => els.map((v) => v.innerText.trim()))).map(TruePeopleSearch.formatAddress) : []),
        relatives: await this.tryOrNull(async () => content.match('Relatives') ? await page.$eval(`div#personDetails > div:nth-child(${this.next(true)}) div.content-value`, (el) => el.innerText.trim().split(',').map((v) => v.trim())) : []),
        associates: await this.tryOrNull(async () => content.match('Associates') ? await page.$eval(`div#personDetails > div:nth-child(${this.next(true)}) div.content-value`, (el) => el.innerText.trim().split(',').map((v) => v.trim())) : [])
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error(e);
      return null;
    }
  }
  async closeAds(page) {
    await page.$$eval('input#spr1', (els) => els.forEach((v) => v.click()));
  }
  async _resultWorkflow(page) {
    await page.waitForNetworkIdle();
    await this.beforeHook(page, 'load-page');
    await this.closeAds(page);
    await this.solveCaptchas(page);
    await this.closeAds(page);
    await this.beforeHook(page, 'submit-recaptchas');
    await this.submitRecaptchasAndWait(page);
    await this.closeAds(page);
    await this.waitForNavigation(page);
    await this.beforeHook(page, 'extract-data');
    await this.closeAds(page);
    return await this.extractData(page);
  }
  async openPage(url) {
    const page = await this._browser.newPage();
    await page.goto(url);
    return page;
  }
  async searchPhone(n) {
    const page = await this.openPage('https://www.truepeoplesearch.com/details?phoneno=' + n + '&rid=0x0');
    return await this._resultWorkflow(page);
  }
  async searchName(name, citystatezip) {
    const page = await this.openPage(url.format({
      protocol: 'https:',
      hostname: 'www.truepeoplesearch.com',
      pathname: '/details'
    }) + '?' + qs.stringify({ name, citystatezip, rid: '0x0' }));
    return await this._resultWorkflow(page);
  }
  async searchAddress(streetaddress, citystatezip) {
    const page = await this.openPage(url.format({
      protocol: 'https:',
      hostname: 'www.truepeoplesearch.com',
      pathname: '/details'
    }) + '?' + qs.stringify({ streetaddress, citystatezip, rid: '0x0' }));
    return await this._resultWorkflow(page);
  }
  async close() {
    try {
      await this._browser.close();
    } catch (e) { console.error(e); }
  }
}

exports.byName = async (name, citystatezip) => {
  const tps = await exports.TruePeopleSearch.initialize();
  const result =  await tps.searchName(name, citystatezip);
  tps.close()
  return result;
};

exports.byAddress = async (street, citystatezip) => {
  const tps = await exports.TruePeopleSearch.initialize();
  const result = await tps.searchAddress(streetaddress, citystatezip);
  tps.close();
  return result;
};

exports.byPhone = async (phone) => {
  const tps = await exports.TruePeopleSearch.initialize();
  const result = await tps.searchPhone(phone);
  tps.close();
  return result;
};
