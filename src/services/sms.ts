/**
 * SMS Service - Africa's Talking Integration
 *
 * Handles SMS sending for customer activation, OTP verification, and notifications.
 * Supports stub mode for development without Africa's Talking credentials.
 */

import AfricasTalking from "africastalking";
import { createModuleLogger } from "./logger.js";
import { config } from "../config.js";

const logger = createModuleLogger("sms");

// Initialize Africa's Talking client
let smsClient: any = null;

function initializeSMSClient() {
  if (smsClient) return smsClient;

  const apiKey = config.SMS.API_KEY;
  const username = config.SMS.USERNAME;

  if (!apiKey || !username) {
    logger.warn(
      "Africa's Talking credentials not configured, SMS will be stubbed"
    );
    return null;
  }

  try {
    const africastalking = AfricasTalking({
      apiKey,
      username,
    });
    smsClient = africastalking.SMS;
    logger.info("Africa's Talking SMS client initialized");
    return smsClient;
  } catch (error) {
    logger.error({ error }, "Failed to initialize Africa's Talking client");
    return null;
  }
}

export interface SendSMSParams {
  to: string; // Phone number in international format (e.g., +260971234567)
  message: string;
}

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send SMS message via Africa's Talking
 * Falls back to stub mode if SMS_ENABLED is false or credentials are missing
 */
export async function sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
  const { to, message } = params;

  logger.info(
    { to: to.slice(-4), messageLength: message.length },
    "Sending SMS"
  );

  // Check if SMS is enabled
  if (!config.SMS.ENABLED) {
    logger.info(
      { to: to.slice(-4), message },
      "STUB: SMS sending disabled, would send SMS"
    );
    return {
      success: true,
      messageId: `stub-${Date.now()}`,
    };
  }

  // Initialize client if needed
  const client = initializeSMSClient();

  if (!client) {
    logger.warn(
      { to: to.slice(-4), message },
      "STUB: SMS client not initialized, would send SMS"
    );
    return {
      success: true,
      messageId: `stub-no-client-${Date.now()}`,
    };
  }

  // Send actual SMS
  try {
    const result = await client.send({
      to: [to],
      message,
      from: config.SMS.SENDER_ID,
    });

    logger.info(
      { to: to.slice(-4), result },
      "SMS sent successfully via Africa's Talking"
    );

    // Africa's Talking returns an array of recipients
    const recipient = result.SMSMessageData?.Recipients?.[0];

    if (recipient?.status === "Success") {
      return {
        success: true,
        messageId: recipient.messageId,
      };
    } else {
      return {
        success: false,
        error: recipient?.status || "Unknown error",
      };
    }
  } catch (error) {
    logger.error(
      { error, to: to.slice(-4) },
      "Failed to send SMS via Africa's Talking"
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate a random 6-digit PIN or OTP
 */
export function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send activation SMS with temporary PIN
 */
export async function sendActivationSMS(
  phoneNumber: string,
  customerId: string,
  tempPin: string
): Promise<SendSMSResult> {
  const message = `Welcome to SupaMoto! Your activation PIN is: ${tempPin}. This PIN expires in 30 minutes. Customer ID: ${customerId}`;

  return sendSMS({
    to: phoneNumber,
    message,
  });
}

/**
 * Send eligibility confirmation SMS
 */
export async function sendEligibilityConfirmationSMS(
  phoneNumber: string
): Promise<SendSMSResult> {
  const message =
    "Congratulations! You are eligible for the 1,000-Day Household program. You can now collect your first free bag of beans! :)";

  return sendSMS({
    to: phoneNumber,
    message,
  });
}

/**
 * Send distribution OTP SMS
 */
export async function sendDistributionOTP(
  phoneNumber: string,
  otp: string
): Promise<SendSMSResult> {
  const message = `Your bean collection OTP is: ${otp}. Show this code to the Lead Generator. Valid for 10 minutes.`;

  return sendSMS({
    to: phoneNumber,
    message,
  });
}

/**
 * Send generic notification SMS
 */
export async function sendNotificationSMS(
  phoneNumber: string,
  message: string
): Promise<SendSMSResult> {
  return sendSMS({
    to: phoneNumber,
    message,
  });
}
