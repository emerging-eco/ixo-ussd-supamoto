import { config } from "../../config.js";

/**
 * SMS template for customer activation
 * Sent after LG activates customer (Line 29 in sequence diagram)
 */
export function activationSMS(customerId: string, tempPin: string): string {
  const serviceCode = config.ZM.SERVICE_CODES[0] || "*2233#";

  return `Welcome to SupaMoto!

Here's your new PIN: ${tempPin}.

To log in:
1. Dial ${serviceCode}
2. Select 'Account Menu'
3. Select 'Yes, log me in'
4. Enter your National ID or Customer ID and this PIN`;
}

/**
 * SMS template for account lockout after 3 failed PIN attempts
 */
export function accountLockedSMS(customerId: string): string {
  const serviceCode = config.ZM.SERVICE_CODES[0] || "*2233#";

  return `Your USSD account (${customerId}) has been locked due to 3 failed PIN attempts.
  
Contact your Lead Generator or the SupaMoto call centre to reset your PIN.

They can reset your PIN by:
1. Dialing ${serviceCode}
2. Logging in to their account
3. Selecting 'Agent Tools'
4. Selecting 'Activate a Customer'
5. Entering your Customer ID and Phone Number`;
}
