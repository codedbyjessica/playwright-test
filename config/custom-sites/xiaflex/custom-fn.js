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
    action: "wait",
    time: 500
  },
  {
    // lol this doesnt work
    action: "custom",
    function: async (page) => {
      await page.evaluate(() => {
        const fakeSelectFields = document.querySelectorAll(".form-select")
        if (fakeSelectFields.length < 1) {
          return
        }
        // select the fake select 
        // speciality
        const specialityField = fakeSelectFields[0]
        if (specialityField) {
          const specialityHiddenDropdown = specialityField.querySelector(".select__menu")
          if (specialityHiddenDropdown) {
            specialityHiddenDropdown.style.display = 'block';
            specialityHiddenDropdown.style.opacity = '1';
            specialityHiddenDropdown.style.visibility = 'visible';

            const specialityOption = specialityHiddenDropdown.querySelector("li[data-value='Primary care physician']")
            if (specialityOption) {
              specialityOption.click();
            }
          }
        }

        const stateField = fakeSelectFields[1]
        if (stateField) {
          const stateHiddenDropdown = stateField.querySelector(".select__menu")
          if (stateHiddenDropdown) {
            stateHiddenDropdown.style.display = 'block';
            stateHiddenDropdown.style.opacity = '1';
            stateHiddenDropdown.style.visibility = 'visible';
          }

          const stateOption = stateHiddenDropdown.querySelector("li[data-value='NY']")
          if (stateOption) {
            stateOption.click();
          }
        }
      });
    }
  },
  {
    action: "wait",
    time: 500
  }
];

module.exports = {
  preFormActions
};

