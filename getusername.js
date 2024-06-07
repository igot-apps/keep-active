const puppeteer = require("puppeteer");
const fs = require('fs');
require("dotenv").config();

const cookiesFilePath = './cookies.json';
const localStorageFilePath = './localStorage.json';

const getusername = async (res) => {
    try {
      const browser = await puppeteer.launch({
          args: [
            "--disable-setuid-sandbox",
            "--no-sandbox",
            "--single-process",
            "--no-zygote",
            "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"
          ],
          executablePath:
            process.env.NODE_ENV === "production"
              ? process.env.PUPPETEER_EXECUTABLE_PATH
              : puppeteer.executablePath(),
              headless: false
        });
        

        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(60000);
    
        // Load cookies and local storage from the file
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



   

    await page.goto("https://www.bybit.com/en/dashboard");

    // Set screen size
    await page.setViewport({ width: 1080, height: 1024 });

    const selector = ".molybiz-mepage-ui-profile-name";

    const element = await page.$(selector);
  
    
    
    const value = await page.evaluate((el) => {
       return el.textContent;
    }, element);
    
    console.log("account" , value); // Print the extracted value
    res.send(value);
  } catch (e) {
    console.error(e);
    res.send(`Something went wrong while running Puppeteer: ${e}`);
  } finally {
     await browser.close();
  }
};

module.exports = { getusername };