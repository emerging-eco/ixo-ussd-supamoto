/**
 * SMS template for LG after successful token transfer
 * Sent after both confirmations received and token transferred (Line 61 in sequence diagram)
 * Character count: ~110 chars (with max values: ID=9)
 */
export function lgTokenTransferredSMS(customerId: string): string {
  return `Bean voucher transferred for delivering to ${customerId}! Check vouchers: login > Agent > Check BEAN vouchers.`;
}
