/**
 * Consent Handler
 * 
 * Handles cookie consent banners (OneTrust, Pantheon, etc.)
 * 
 * @author AI Assistant
 * @version 1.0
 */

const CONFIG = require('../config/main');

class ConsentHandler {
  /**
   * Handle OneTrust cookie consent banner
   * @param {Page} page - Playwright page object
   * @returns {Promise<boolean>} - True if handled, false if not found
   */
  static async handleOneTrust(page) {
    try {
      console.log('🍪 Looking for OneTrust cookie consent...');
      
      const acceptBtn = await page.$(CONFIG.ONETRUST.acceptButtonSelector);
      if (acceptBtn) {
        await acceptBtn.click();
        console.log('✅ Clicked OneTrust I Agree button');
        await page.waitForTimeout(CONFIG.GLOBAL.networkWait);
        return true;
      }
      
      // Try alternative OneTrust flow: settings > save preferences
      console.log('ℹ️  No OneTrust accept button found, trying settings flow...');
      const settingsBtn = await page.$('.ot-sdk-show-settings');
      if (settingsBtn) {
        console.log('🔧 Found OneTrust settings button, clicking...');
        await settingsBtn.click();
        await page.waitForTimeout(1000); // Wait for settings panel to open
        
        const saveBtn = await page.$('.save-preference-btn-handler');
        if (saveBtn) {
          await saveBtn.click();
          console.log('✅ Clicked OneTrust save preferences button');
          await page.waitForTimeout(CONFIG.GLOBAL.networkWait);
          return true;
        } else {
          console.log('⚠️  Settings button found but no save button');
        }
      }
      
      console.log('ℹ️  No OneTrust cookie consent banner found');
      return false;
    } catch (error) {
      console.log('⚠️  Error handling cookie consent:', error.message);
      return false;
    }
  }

  /**
   * Dismiss Pantheon banner
   * @param {Page} page - Playwright page object
   * @returns {Promise<boolean>} - True if dismissed, false if not found
   */
  static async dismissPantheon(page) {
    try {
      const dismissBtn = await page.$(".pds-button");
      if (dismissBtn) {
        await dismissBtn.click();
        console.log('✅ Clicked Pantheon dismiss button');
        await page.waitForTimeout(CONFIG.GLOBAL.networkWait);
        return true;
      }
      return false;
    } catch (error) {
      console.log('⚠️  Error dismissing Pantheon:', error.message);
      return false;
    }
  }

  /**
   * Handle all consent banners
   * @param {Page} page - Playwright page object
   */
  static async handleAll(page) {
    await this.dismissPantheon(page);
    await this.handleOneTrust(page);
  }
}

module.exports = ConsentHandler;

