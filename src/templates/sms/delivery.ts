/**
 * SMS template for LG after successful token transfer
 * Sent after both confirmations received and token transferred (Line 61 in sequence diagram)
 */
export function lgTokenTransferredSMS(customerId: string): string {
  return `Thank you for delivering beans to Customer ${customerId}!

Your bean voucher has been transferred to your account.

You can check your vouchers via USSD:
1. Log in to your account
2. Select 'Agent Tools'
3. Select 'Check BEAN vouchers'`;
}
