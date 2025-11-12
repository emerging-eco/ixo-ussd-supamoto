import { config } from "../../config.js";

/**
 * SMS template for customer activation
 * Sent after LG activates customer (Line 29 in sequence diagram)
 * Character count: ~130 chars (with max values: ID=9, PIN=5, code=6)
 */
export function activationSMS(customerId: string, tempPin: string): string {
  const serviceCode = config.ZM.SERVICE_CODES[0] || "*2233#";

  return `Welcome to SupaMoto! ID: ${customerId}, Temp PIN: ${tempPin}. Dial ${serviceCode} > Account Menu > Login. Change PIN on first login.`;
}

/**
 * SMS template for account lockout after 3 failed PIN attempts
 * Character count: ~120 chars (with max values: ID=9, code=6)
 */
export function accountLockedSMS(customerId: string): string {
  const serviceCode = config.ZM.SERVICE_CODES[0] || "*2233#";

  return `Account ${customerId} locked after 3 failed PIN attempts. Contact your LG or call centre to reset. They dial ${serviceCode} > Agent > Activate Customer.`;
}
