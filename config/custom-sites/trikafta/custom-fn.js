/**
 * Custom Functions for Brekiya
 * 
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

// Common reusable actions
// Close the welcome popup modal
const afterRefreshAction = [
  {
    action: "wait",
    time: 500  // Wait for popup to appear
  },
  {
    action: "custom",
    function: async (page) => {
      // Use JavaScript to close the modal - try multiple approaches
      await page.evaluate(() => {
        // Method 1: Click the close button directly
        const closeBtn = document.querySelector('a.coh-link.close-popup[data-modal-close-btn]');
        if (closeBtn) {
          closeBtn.click();
        }
      });
    }
  },

  {
    action: "wait",
    time: 500  // Wait for popup to appear
  },
];

module.exports = {
  afterRefreshAction
};

