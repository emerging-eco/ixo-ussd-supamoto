import { config } from "../../config.js";

/**
 * SMS template for bean voucher allocation
 * Sent after successful 1,000 Day Household claim (Line 40 in sequence diagram)
 */
export function beanVoucherAllocatedSMS(customerId: string): string {
  const serviceCode = config.ZM.SERVICE_CODES[0] || "*2233#";

  return `Congratulations! You can now collect your first free bag of beans! :)

Visit your Lead Generator and ask them to:
1. Dial ${serviceCode}
2. Log in to their account
3. Select 'Agent Tools'
4. Select 'Register Intent to Deliver Beans'
5. Enter your Customer ID: ${customerId}

They will receive a confirmation to proceed with delivery.`;
}
