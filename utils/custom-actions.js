/**
 * Custom Actions Executor
 * 
 * Executes declarative action arrays for custom site behaviors
 * 
 * Supported action types:
 * - "wait" (string) - Wait 1 second
 * - { action: "wait", time: ms } - Wait specific time
 * - { action: "click", selector: "..." } - Click element
 * - { action: "type", selector: "...", value: "..." } - Type into element
 * - { action: "custom", function: (page) => {...} } - Custom function
 * - { action: "removeCookieBanner" } - Remove cookie banners
 * 
 * @author AI Assistant
 * @version 1.0
 */

class CustomActionsExecutor {
  /**
   * Execute custom actions array
   * @param {Page} page - Playwright page object
   * @param {Array} actions - Array of actions to execute
   */
  static async execute(page, actions) {
    if (!Array.isArray(actions)) {
      console.log('⚠️  Actions is not an array, skipping');
      return;
    }

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      
      try {
        // Handle string shortcuts (e.g., "wait")
        if (typeof action === 'string') {
          if (action === 'wait') {
            console.log(`  ⏳ Action ${i + 1}: Wait 1s`);
            await page.waitForTimeout(1000);
          }
          continue;
        }

        // Handle action objects
        if (typeof action === 'object' && action.action) {
          switch (action.action) {
            case 'wait':
              const waitTime = action.time || 1000;
              console.log(`  ⏳ Action ${i + 1}: Wait ${waitTime}ms`);
              await page.waitForTimeout(waitTime);
              break;

            case 'click':
              console.log(`  🖱️  Action ${i + 1}: Click "${action.selector}"`);
              const clickElement = await page.$(action.selector);
              if (clickElement) {
                await clickElement.click();
              } else {
                console.log(`    ⚠️  Element not found: ${action.selector}`);
              }
              break;

            case 'type':
              console.log(`  ⌨️  Action ${i + 1}: Type into "${action.selector}"`);
              await page.fill(action.selector, action.value);
              break;

            case 'custom':
              console.log(`  🔧 Action ${i + 1}: Custom function`);
              if (typeof action.function === 'function') {
                await action.function(page);
              }
              break;

            case 'removeCookieBanner':
              console.log(`  🍪 Action ${i + 1}: Remove cookie banner`);
              await page.evaluate(() => {
                const selectors = [
                  '#onetrust-banner-sdk',
                  '.cookie-banner',
                  '[class*="cookie"]',
                  '[id*="cookie"]'
                ];
                selectors.forEach(sel => {
                  const el = document.querySelector(sel);
                  if (el) el.remove();
                });
              });
              break;

            default:
              console.log(`  ⚠️  Unknown action type: ${action.action}`);
          }
        }
      } catch (error) {
        console.log(`  ❌ Error executing action ${i + 1}: ${error.message}`);
      }
    }
  }
}

module.exports = CustomActionsExecutor;

