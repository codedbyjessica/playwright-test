const { chromium } = require('playwright');

async function debugPage() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('🌐 Navigating to talkaboutpd.com...');
    await page.goto('https://talkaboutpd.com/', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(5000);
    
    // Check for OneTrust elements
    console.log('\n🔍 Checking for OneTrust elements...');
    const oneTrustElements = await page.evaluate(() => {
      const elements = [];
      
      // Check for OneTrust banner
      const banner = document.querySelector('#onetrust-banner-sdk');
      if (banner) {
        elements.push({
          type: 'banner',
          id: banner.id,
          className: banner.className,
          visible: banner.offsetParent !== null,
          text: banner.textContent?.substring(0, 100) + '...'
        });
      }
      
      // Check for OneTrust accept button
      const acceptBtn = document.querySelector('#onetrust-accept-btn-handler');
      if (acceptBtn) {
        elements.push({
          type: 'accept_button',
          id: acceptBtn.id,
          className: acceptBtn.className,
          visible: acceptBtn.offsetParent !== null,
          text: acceptBtn.textContent,
          disabled: acceptBtn.disabled
        });
      }
      
      // Check for any elements with "onetrust" in id or class
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const id = el.id || '';
        const className = (el.className && typeof el.className === 'string') ? el.className : '';
        if (id.toLowerCase().includes('onetrust') || className.toLowerCase().includes('onetrust')) {
          elements.push({
            type: 'onetrust_element',
            tagName: el.tagName,
            id: el.id,
            className: className,
            visible: el.offsetParent !== null,
            text: el.textContent?.substring(0, 50) + '...'
          });
        }
      });
      
      return elements;
    });
    
    console.log('OneTrust elements found:', oneTrustElements);
    
    // Check for any cookie-related elements
    console.log('\n🍪 Checking for cookie-related elements...');
    const cookieElements = await page.evaluate(() => {
      const elements = [];
      
      // Check for any elements with "cookie" in text, id, or class
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const text = el.textContent || '';
        const id = el.id || '';
        const className = (el.className && typeof el.className === 'string') ? el.className : '';
        
        if (text.toLowerCase().includes('cookie') || 
            text.toLowerCase().includes('accept') ||
            text.toLowerCase().includes('consent') ||
            id.toLowerCase().includes('cookie') ||
            className.toLowerCase().includes('cookie')) {
          elements.push({
            type: 'cookie_element',
            tagName: el.tagName,
            id: el.id,
            className: className,
            visible: el.offsetParent !== null,
            text: el.textContent?.substring(0, 100) + '...'
          });
        }
      });
      
      return elements;
    });
    
    console.log('Cookie elements found:', cookieElements);
    
    // Check for all buttons
    console.log('\n🔘 Checking for all buttons...');
    const allButtons = await page.evaluate(() => {
      const buttons = [];
      const buttonElements = document.querySelectorAll('button');
      
      buttonElements.forEach((btn, index) => {
        buttons.push({
          index,
          tagName: btn.tagName,
          id: btn.id,
          className: (btn.className && typeof btn.className === 'string') ? btn.className : '',
          visible: btn.offsetParent !== null,
          text: btn.textContent?.trim(),
          disabled: btn.disabled
        });
      });
      
      return buttons;
    });
    
    console.log('All buttons found:', allButtons);
    
    // Check page title and URL
    const title = await page.title();
    const url = page.url();
    console.log('\n📄 Page info:');
    console.log('Title:', title);
    console.log('URL:', url);
    
    // Wait for user to see the page
    console.log('\n⏳ Waiting 10 seconds for you to inspect the page...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugPage(); 