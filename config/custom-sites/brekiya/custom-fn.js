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
// Pre-form actions to execute before running form tests
const preFormActions = [
  {
    action: "click",
    selector: 'a[href="#sign-up-popup"]'
  },
  {
    action: "wait",
    time: 1500
  }
];

module.exports = {
  preFormActions
};

