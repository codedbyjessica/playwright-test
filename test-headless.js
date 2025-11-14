const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch({
    headless: true,
  });
  const context = await browser.newContext({
    // ...playwright.devices['iPhone X'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
    },
  });
  const page = await context.newPage();
  await page.goto('https://www.talkaboutpd.com/');
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
})();