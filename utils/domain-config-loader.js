/**
 * Domain Config Loader
 * 
 * Loads domain-specific configurations and custom functions
 * 
 * @author AI Assistant
 * @version 1.0
 */

const path = require('path');
const fs = require('fs');

class DomainConfigLoader {
  /**
   * Extract domain name from URL
   * @param {string} url - Full URL
   * @returns {string|null} - Domain name (e.g., 'neffy', 'alyftrek')
   */
  static extractDomainName(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const parts = hostname.split('.');
      
      if (parts.length >= 2) {
        // Get second-to-last part (actual domain name)
        // e.g., ['www', 'neffy', 'com'] → 'neffy'
        // e.g., ['admin', 'fibrygausa', 'com'] → 'fibrygausa'
        return parts[parts.length - 2];
      }
      return parts[0];
    } catch (error) {
      return null;
    }
  }

  /**
   * Load form configs dynamically based on site domain
   * @param {string} url - Site URL
   * @returns {Object|null} - Form configs object or null
   */
  static loadFormConfigsForDomain(url) {
    try {
      const domainName = this.extractDomainName(url);
      if (!domainName) {
        return null;
      }
      
      // Check if domain-specific config folder exists
      const domainConfigDir = path.join(__dirname, '..', 'config', 'custom-sites', domainName);
      
      if (!fs.existsSync(domainConfigDir)) {
        console.log(`⚠️  No config folder found for domain: ${domainName} (${domainConfigDir})`);
        console.log(`ℹ️  Form testing will be skipped for this domain`);
        return null;
      }
      
      // Try to load domain-specific config
      const domainConfigPath = path.join(domainConfigDir, 'custom-forms.js');
      
      if (fs.existsSync(domainConfigPath)) {
        console.log(`📋 Loading form config for domain: ${domainName} (${domainConfigPath})`);
        return require(domainConfigPath);
      }
      
      console.log(`⚠️  Config folder exists but no custom-forms.js found: ${domainConfigPath}`);
      console.log(`ℹ️  Form testing will be skipped for this domain`);
      return null;
    } catch (error) {
      console.log(`⚠️  Error loading form config: ${error.message}`);
      return null;
    }
  }

  /**
   * Load custom functions for the domain
   * @param {string} url - Site URL
   * @returns {Object} - Custom functions object (may be empty)
   */
  static loadCustomFunctionsForDomain(url) {
    try {
      const domainName = this.extractDomainName(url);
      if (!domainName) {
        return {};
      }
      
      const customFnPath = path.join(__dirname, '..', 'config', 'custom-sites', domainName, 'custom-fn.js');
      
      if (fs.existsSync(customFnPath)) {
        console.log(`🔧 Loading custom functions for domain: ${domainName} (${customFnPath})`);
        return require(customFnPath);
      }
      
      return {};
    } catch (error) {
      console.log(`⚠️  Error loading custom functions: ${error.message}`);
      return {};
    }
  }

  /**
   * Detect form configuration by matching page URL
   * @param {Object} formConfigs - Form configurations object
   * @param {string} pageUrl - Current page URL
   * @returns {Object|null} - Object with {config, name} or null
   */
  static detectFormConfigByPage(formConfigs, pageUrl) {
    if (!formConfigs) {
      return null;
    }
    
    for (const [configName, config] of Object.entries(formConfigs)) {
      if (config.page && pageUrl.includes(config.page)) {
        console.log(`📋 Matched form config "${configName}" for page: ${config.page}`);
        return { config, name: configName };
      }
    }
    return null;
  }

  /**
   * Detect default form configuration (use first available)
   * @param {Object} formConfigs - Form configurations object
   * @returns {Object|null} - Object with {config, name} or null
   */
  static detectDefaultFormConfig(formConfigs) {
    if (!formConfigs) {
      return null;
    }
    
    const availableConfigs = Object.keys(formConfigs);
    if (availableConfigs.length > 0) {
      const defaultConfigName = availableConfigs[0];
      console.log(`📋 Using fallback form config: ${defaultConfigName}`);
      return { config: formConfigs[defaultConfigName], name: defaultConfigName };
    }
    return null;
  }
}

module.exports = DomainConfigLoader;

