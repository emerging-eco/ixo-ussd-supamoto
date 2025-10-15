import { config } from "../../config.js";

/**
 * SMS template for OTP sent to customer
 * Sent after LG registers intent and customer has voucher (Line 49 in sequence diagram)
 */
export function customerOTPSMS(otp: string, lgName?: string): string {
  const validityMinutes = config.USSD.OTP_VALIDITY_MINUTES;

  return `Your bean collection OTP is: ${otp}

Show this code to ${lgName || "your Lead Generator"}.

This OTP is valid for ${validityMinutes} minutes only.`;
}

/**
 * SMS template for LG when customer has NO bean voucher
 * Sent after voucher check fails (Line 46 in sequence diagram)
 */
export function lgNoVoucherSMS(customerId: string): string {
  return `Do not deliver beans to Customer ${customerId}.

This customer does not have a bean voucher allocated.

They need to:
1. Log in to their USSD account
2. Select 'Customer Tools'
3. Select '1,000 Day Household'
4. Complete the self-proclamation

Once approved, they will receive an SMS to visit you for collection.`;
}

/**
 * SMS template for LG when customer HAS bean voucher
 * Sent after successful voucher check (Line 48 in sequence diagram)
 */
export function lgHasVoucherSMS(customerId: string): string {
  return `Customer ${customerId} has a bean voucher!

An OTP has been sent to the customer's phone.

Next steps:
1. Ask the customer to show you the OTP
2. Submit the OTP via USSD (Agent Tools → Submit Customer OTP)
3. Once verified, you can deliver the beans`;
}

/**
 * SMS template for LG when OTP is invalid or expired
 * Sent after OTP validation fails (Lines 52-54 in sequence diagram)
 */
export function lgInvalidOTPSMS(
  customerId: string,
  reason: "INVALID" | "EXPIRED"
): string {
  const serviceCode = config.ZM.SERVICE_CODES[0] || "*2233#";

  if (reason === "EXPIRED") {
    return `Do not deliver beans to Customer ${customerId}.

The OTP has expired (valid for ${config.USSD.OTP_VALIDITY_MINUTES} minutes only).

To generate a new OTP:
1. Dial ${serviceCode}
2. Select 'Agent Tools'
3. Select 'Register Intent to Deliver Beans'
4. Enter the Customer ID again`;
  } else {
    return `Do not deliver beans to Customer ${customerId}.

The OTP is incorrect. Please verify the OTP with the customer and try again.`;
  }
}

/**
 * SMS template for LG when OTP is valid
 * Sent after successful OTP validation (Line 55 in sequence diagram)
 */
export function lgValidOTPSMS(customerId: string): string {
  return `You can now deliver beans to Customer ${customerId}.

After delivering the beans:
1. Confirm delivery via USSD (Agent Tools → Confirm Bean Delivery)
2. Ask the customer to confirm receipt via their USSD account

Both confirmations are required for you to receive your bean voucher.`;
}
