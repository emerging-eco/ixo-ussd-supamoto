import { config } from "../../config.js";

/**
 * SMS template for OTP sent to customer
 * Sent after LG registers intent and customer has voucher (Line 49 in sequence diagram)
 * Character count: ~80 chars (with max values: OTP=5, LG name=20, validity=2)
 */
export function customerOTPSMS(otp: string, lgName?: string): string {
  const validityMinutes = config.USSD.OTP_VALIDITY_MINUTES;

  return `Bean collection OTP: ${otp}. Show to ${lgName || "your LG"}. Valid ${validityMinutes} min.`;
}

/**
 * SMS template for LG when customer has NO bean voucher
 * Sent after voucher check fails (Line 46 in sequence diagram)
 * Character count: ~140 chars (with max values: ID=9)
 */
export function lgNoVoucherSMS(customerId: string): string {
  return `Do NOT deliver beans to ${customerId}. No voucher allocated. Customer must login > Customer Tools > 1,000 Day Household > complete survey.`;
}

/**
 * SMS template for LG when customer HAS bean voucher
 * Sent after successful voucher check (Line 48 in sequence diagram)
 * Character count: ~130 chars (with max values: ID=9)
 */
export function lgHasVoucherSMS(customerId: string): string {
  return `${customerId} has voucher! OTP sent to customer. Get OTP from customer, submit via USSD Agent > Submit Customer OTP, then deliver beans.`;
}

/**
 * SMS template for LG when OTP is invalid or expired
 * Sent after OTP validation fails (Lines 52-54 in sequence diagram)
 * Character count: ~140 chars (with max values: ID=9, code=6, validity=2)
 */
export function lgInvalidOTPSMS(
  customerId: string,
  reason: "INVALID" | "EXPIRED"
): string {
  const serviceCode = config.ZM.SERVICE_CODES[0] || "*2233#";

  if (reason === "EXPIRED") {
    return `Do NOT deliver to ${customerId}. OTP expired (${config.USSD.OTP_VALIDITY_MINUTES} min). Generate new: dial ${serviceCode} > Agent > Register Intent to Deliver Beans.`;
  } else {
    return `Do NOT deliver to ${customerId}. OTP incorrect. Verify OTP with customer and try again.`;
  }
}

/**
 * SMS template for LG when OTP is valid
 * Sent after successful OTP validation (Line 55 in sequence diagram)
 * Character count: ~150 chars (with max values: ID=9)
 */
export function lgValidOTPSMS(customerId: string): string {
  return `Deliver beans to ${customerId}. After delivery: confirm via USSD Agent > Confirm Bean Delivery. Customer must also confirm. Both needed for your voucher.`;
}
