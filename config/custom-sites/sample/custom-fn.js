/**
 * Custom Functions
 * Domain-specific custom actions for brekiya.com
 * 
 * Supported action types:
 * - "wait" (string) - Wait 1 second
 * - { action: "wait", time: 2000 } - Wait specific time
 * - { action: "click", selector: "..." } - Click element
 * - { action: "type", selector: "...", value: "..." } - Type into element
 * - { action: "custom", function: (page) => {...} } - Custom function
 * - { action: "removeCookieBanner" } - Remove cookie banners
 * 
 * @author AI Assistant
 * @version 2.0
 */

const preTestActions = [
  {
    action: "custom",
    function: async (page) => {
      await page.evaluate(() => {
        console.log("this functions runs before all tests, after consent banner is closed")
      });
    }
  },
];

const afterRefreshAction = [
  {
    action: "custom",
    function: async (page) => {
      await page.evaluate(() => {
        // Method 1: Click the close button directly
        console.log("this functions runs after every refresh, ie good for closing constant popups")
      });
    }
  },
];


const preFormActions = [
  {
    action: "click",
    selector: '.sample-form-trigger'
  },
  {
    action: "custom",
    function: async (page) => {
      await page.evaluate(() => {
        // Method 1: Click the close button directly
        console.log("this functions runs before form testing")
      });
    }
  },
];


module.exports = {
  preTestActions,
  afterRefreshAction,
  preFormActions
};

