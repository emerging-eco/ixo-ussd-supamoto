import { config } from "../../config.js";

/**
 * SMS template for bean voucher allocation
 * Sent after successful 1,000 Day Household claim (Line 40 in sequence diagram)
 * Character count: ~130 chars (with max values: ID=9, code=6)
 */
export function beanVoucherAllocatedSMS(customerId: string): string {
  const serviceCode = config.ZM.SERVICE_CODES[0] || "*2233#";

  return `Collect free beans! Ask your LG to dial ${serviceCode} > Agent > Register Intent to Deliver Beans. Your ID: ${customerId}`;
}
