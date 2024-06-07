const express = require("express");
const puppeteer = require('puppeteer');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 4000;

const { getusername } = require("./getusername");

const cookiesFilePath = './cookies.json';
const localStorageFilePath = './localStorage.json';

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--single-process",
        "--no-zygote",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"
      ],
      executablePath: process.env.NODE_ENV === "production"
        ? process.env.PUPPETEER_EXECUTABLE_PATH
        : puppeteer.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    const loadCookiesAndLocalStorage = async () => {
      if (fs.existsSync(cookiesFilePath)) {
        const cookies = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf-8'));
        await page.setCookie(...cookies);
      }

      if (fs.existsSync(localStorageFilePath)) {
        const localStorageData = JSON.parse(fs.readFileSync(localStorageFilePath, 'utf-8'));
        await page.evaluateOnNewDocument(localStorageData => {
          for (const [key, value] of Object.entries(localStorageData)) {
            localStorage.setItem(key, value);
          }
        }, localStorageData);
      }
    };

    await loadCookiesAndLocalStorage();

    const refreshPage = async () => {
      try {
        await page.goto('https://www.bybit.com/fiat/trade/otc/?actionType=1&token=USDT&fiat=GHS&paymentMethod=', {
          waitUntil: 'networkidle2',
          timeout: 1000 * 60 // 60 seconds
        });
        console.log('Page refreshed successfully');
      } catch (error) {
        if (error instanceof puppeteer.errors.TimeoutError) {
          console.error('Page load timeout, retrying...');
          await new Promise(resolve => setTimeout(resolve, 1000 * 10)); // Wait for 10 seconds before retrying
          return await refreshPage();
        } else {
          console.error('Error refreshing page:', error);
        }
      }
    };

    const saveCookiesAndLocalStorage = async () => {
      try {
        const cookies = await page.cookies();
        fs.writeFileSync(cookiesFilePath, JSON.stringify(cookies, null, 2));

        const localStorageData = await page.evaluate(() => {
          let localStorage = {};
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            localStorage[key] = window.localStorage.getItem(key);
          }
          return localStorage;
        });
        fs.writeFileSync(localStorageFilePath, JSON.stringify(localStorageData, null, 2));

        console.log('Session saved successfully');
      } catch (error) {
        console.error('Error saving session:', error);
      }
    };

    while (true) {
      try {
        await refreshPage();
        await saveCookiesAndLocalStorage();
        await new Promise(resolve => setTimeout(resolve, 1000 * 60)); // Wait for 1 minute before next refresh
      } catch (error) {
        console.error('Error occurred during refresh loop:', error);
      }
    }

  } catch (error) {
    console.error('Error launching browser:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
