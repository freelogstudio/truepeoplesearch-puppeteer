'use strict';

const puppeteer = require('puppeteer-extra');
const url = require('url');

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const fs = require('fs-extra');
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
puppeteer.use(StealthPlugin());
puppeteer.use(RecaptchaPlugin({
  provider: {
    id: '2captcha',
    token: process.env.TWOCAPTCHA_TOKEN
  },
  visualFeedback: true
}));


exports.TruePeopleSearch = class TruePeopleSearch {
  static async initialize() {
    return new this(await puppeteer.launch({ headless: true }));
  }
  constructor(browser) {
    this._browser = browser;
  }
  async beforeHook(page, meta) {
    if (process.env.NODE_ENV === 'development') {
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
  async extractData(page) {
    try {
      return await page.evaluate(() => ({
        person: document.evaluate('//div[@id="personDetails"]/div[1]', document).iterateNext().innerText,
        currentAddress: document.evaluate('//div[@id="personDetails"]/div[4]/div[2]/div[2]/div[1]', document).iterateNext().innerText,
        phones: ((it) => { let value = null; const result = []; while ((value = it.iterateNext())) { result.push(value); } return result; })(document.evaluate('//div[@id="personDetails"]/div[6]/div[2]//div[@class="content-value"]', document)).map((v) => v.innerText.trim()),
        emails: ((it) => { let value = null; const result = []; while ((value = it.iterateNext())) { result.push(value); } return result; })(document.evaluate('//div[@id="personDetails"]/div[10]/div[2]//div[@class="content-value"]', document)).map((v) => v.innerText.trim()),
        names: document.evaluate('//div[@id="personDetails"]/div[12]//div[@class="content-value"]', document).iterateNext().innerText.trim().split(','),
        addresses: ((it) => { let value = null; const result = []; while ((value = it.iterateNext())) { result.push(value); } return result; })(document.evaluate('//div[@id="personDetails"]/div[14]//div[@class="content-value"]', document)).map((v) => v.innerText.trim()),
        relatives: document.evaluate('//div[@id="personDetails"]/div[17]//div[@class="content-value"]', document).iterateNext().innerText.trim().split(','),
        associates: document.evaluate('//div[@id="personDetails"]/div[19]//div[@class="content-value"]', document).iterateNext().innerText.trim().split(','),
      }));
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error(e);
      return null;
    }
  }
  async _resultWorkflow(page) {
    await page.waitForNetworkIdle();
    await this.beforeHook(page, 'load-page');
    await this.solveCaptchas(page);
    await this.beforeHook(page, 'submit-recaptchas');
    await this.submitRecaptchasAndWait(page);
    await this.waitForNavigation(page);
    await this.beforeHook(page, 'extract-data');
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
    }) + '?' + qs.stringify({ name, citystatezip, rid: '0xl' }));
    return await this._resultWorkflow(page);
  }
  async searchAddress(streetaddress, citystatezip) {
    const page = await this.openPage(url.format({
      protocol: 'https:',
      hostname: 'www.truepeoplesearch.com',
      pathname: '/details'
    }) + '?' + qs.stringify({ streetaddress, citystatezip, rid: '0xl' }));
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
