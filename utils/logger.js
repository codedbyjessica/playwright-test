/**
 * Logger Utility
 * 
 * Provides consistent logging functionality with timestamps and emoji prefixes.
 * 
 * @author AI Assistant
 * @version 1.0
 */

/**
 * Log a message with timestamp and emoji prefix
 * @param {string} message - The message to log
 * @param {string} type - The type of message ('info', 'error', 'success')
 */
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

module.exports = { log };

