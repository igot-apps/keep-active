const express = require("express");
const puppeteer = require('puppeteer');
const fs = require('fs');
const player = require('play-sound')();
const app = express();
const PORT = process.env.PORT || 4000;

const cookiesFilePath = './cookies.json';
const localStorageFilePath = './localStorage.json';
const soundPath = './internetDiscounted.mp3';

let soundProcess = null;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const loadCookiesAndLocalStorage = async (page) => {
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

const saveCookiesAndLocalStorage = async (page) => {
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

const refreshPage = async (page) => {
  while (true) {
    try {
      await page.goto('https://www.bybit.com/fiat/trade/otc/?actionType=1&token=USDT&fiat=GHS&paymentMethod=', {
        waitUntil: 'networkidle2',
        timeout: 1000 * 60 // 60 seconds
      });
      console.log('Page refreshed successfully');

      // Navigate to the dashboard page
      await page.goto('https://www.bybit.com/en/dashboard', {
        waitUntil: 'networkidle2',
        timeout: 1000 * 60 // 60 seconds
      });
      console.log('Navigated to dashboard page');

      // Wait for the profile name element to be visible
      await page.waitForSelector('.molybiz-mepage-ui-profile-name', { visible: true });
      console.log('Profile name element is visible');

      // Get the text content of the profile name element
      const profileName = await page.$eval('.molybiz-mepage-ui-profile-name', element => element.textContent);
      console.log('Profile name:', profileName);

      await page.setViewport({ width: 1920, height: 1080 }); // Set viewport to a standard desktop screen size (1920x1080)

      return; // Exit the loop once the page is successfully loaded
    } catch (error) {
      if (error.message.includes('net::ERR_INTERNET_DISCONNECTED')) {
        console.error(`Internet connection error: ${error.message}. Retrying in 10 seconds...`);
        if (!soundProcess) { // Play the sound only if it's not already playing
          soundProcess = player.play(soundPath, function(err) {
            if (err) console.error('Error playing sound:', err);
          });
        }
        await delay(1000 * 10); // Wait for 10 seconds before retrying
      } else if (error instanceof puppeteer.errors.TimeoutError) {
        console.error(`Timeout error: ${error.message}. Retrying in 10 seconds...`);
        await delay(1000 * 10); // Wait for 10 seconds before retrying
      } else {
        console.error('Error refreshing page:', error);
        return;
      }
    }
  }
};

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

    await loadCookiesAndLocalStorage(page);

    while (true) {
      try {
        await refreshPage(page);
        await saveCookiesAndLocalStorage(page);
        await delay(1000 * 60); // Wait for 1 minute before next refresh
      } catch (error) {
        console.error('Error occurred during refresh loop:', error);
      }
    }

  } catch (error) {
    console.error('Error launching browser:', error);
  }
})();

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
