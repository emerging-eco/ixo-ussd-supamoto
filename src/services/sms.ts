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
      enqueue: true, // Queue for delivery (recommended for reliability)
    });

    logger.info(
      { to: to.slice(-4), result },
      "SMS API response received from Africa's Talking"
    );

    // Africa's Talking returns an array of recipients
    const recipient = result.SMSMessageData?.Recipients?.[0];

    if (!recipient) {
      logger.error(
        { to: to.slice(-4), result },
        "No recipient data in SMS response"
      );
      return {
        success: false,
        error: "No recipient data in response",
      };
    }

    // Check status code (101 = Success, 102 = Queued)
    // Both are considered successful delivery
    const statusCode = recipient.statusCode;
    const isSuccess =
      statusCode === 101 || // Success
      statusCode === 102 || // Queued
      recipient.status === "Success" || // Fallback to string status
      recipient.status === "Queued";

    if (isSuccess) {
      logger.info(
        {
          to: to.slice(-4),
          messageId: recipient.messageId,
          statusCode,
          cost: recipient.cost,
        },
        "SMS sent successfully"
      );
      return {
        success: true,
        messageId: recipient.messageId,
      };
    } else {
      // Handle error status codes
      const errorMessage = getErrorMessage(statusCode, recipient.status);
      logger.warn(
        {
          to: to.slice(-4),
          statusCode,
          status: recipient.status,
          error: errorMessage,
        },
        "SMS send failed with error status"
      );
      return {
        success: false,
        error: errorMessage,
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
 * Get human-readable error message for Africa's Talking status codes
 */
function getErrorMessage(statusCode: number, status: string): string {
  const errorMessages: Record<number, string> = {
    401: "Risk hold - Message flagged as spam",
    402: "Invalid sender ID",
    403: "Invalid phone number",
    404: "Unsupported number type",
    405: "Insufficient balance",
    406: "User in blacklist",
    407: "Could not route message",
    500: "Internal server error",
  };

  return (
    errorMessages[statusCode] ||
    status ||
    `Unknown error (status code: ${statusCode})`
  );
}

/**
 * Generate a random 5-digit PIN or OTP
 * Range: 00000-99999 (with leading zeros preserved)
 */
export function generatePin(): string {
  const pin = Math.floor(Math.random() * 100000);
  return pin.toString().padStart(5, "0");
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

/**
 * Send SMS with retry logic
 * Attempts: Immediate, 10s delay, 30s delay (configurable)
 * Creates audit log entries for failed attempts
 */
export async function sendSMSWithRetry(
  params: SendSMSParams,
  auditContext?: {
    eventType: string;
    customerId?: string;
    lgCustomerId?: string;
  }
): Promise<SendSMSResult> {
  const maxAttempts = config.USSD.SMS_RETRY_ATTEMPTS;
  const delays = config.USSD.SMS_RETRY_DELAYS_SECONDS;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait before retry (except first attempt)
    if (attempt > 0 && delays[attempt]) {
      await new Promise(resolve => setTimeout(resolve, delays[attempt] * 1000));
    }

    const result = await sendSMS(params);

    if (result.success) {
      if (attempt > 0) {
        logger.info(
          { attempt: attempt + 1, to: params.to.slice(-4) },
          "SMS sent successfully after retry"
        );
      }
      return result;
    }

    // Log failed attempt
    logger.warn(
      {
        attempt: attempt + 1,
        maxAttempts,
        to: params.to.slice(-4),
        error: result.error,
      },
      "SMS send attempt failed"
    );

    // Create audit record for failed attempt
    if (auditContext) {
      await createAuditLog({
        eventType: "SMS_FAILED",
        customerId: auditContext.customerId,
        lgCustomerId: auditContext.lgCustomerId,
        details: {
          originalEventType: auditContext.eventType,
          attempt: attempt + 1,
          maxAttempts,
          error: result.error,
          phoneNumber: params.to.slice(-4),
          messageLength: params.message.length,
        },
      });
    }
  }

  // All attempts failed
  logger.error(
    { to: params.to.slice(-4), attempts: maxAttempts },
    "SMS send failed after all retry attempts"
  );

  return {
    success: false,
    error: `Failed after ${maxAttempts} attempts`,
  };
}

/**
 * Create audit log entry
 * Helper function to log events to audit_log table
 */
async function createAuditLog(params: {
  eventType: string;
  customerId?: string;
  lgCustomerId?: string;
  details: any;
}): Promise<void> {
  try {
    // Import dataService dynamically to avoid circular dependency
    const { dataService } = await import("./database-storage.js");
    await dataService.createAuditLog(params);
  } catch (error) {
    logger.error({ error, params }, "Failed to create audit log entry");
  }
}
