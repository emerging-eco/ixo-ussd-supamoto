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
  if (smsClient) {
    logger.info("Using cached Africa's Talking SMS client");
    return smsClient;
  }

  const apiKey = config.SMS.API_KEY;
  const username = config.SMS.USERNAME;

  logger.info(
    {
      hasApiKey: !!apiKey,
      hasUsername: !!username,
      username: username || "NOT_SET",
    },
    "Initializing Africa's Talking SMS client"
  );

  if (!apiKey || !username) {
    logger.warn(
      {
        missingApiKey: !apiKey,
        missingUsername: !username,
      },
      "Africa's Talking credentials not configured, SMS will be stubbed"
    );
    return null;
  }

  try {
    logger.info("Creating Africa's Talking client instance");
    const africastalking = AfricasTalking({
      apiKey,
      username,
    });
    smsClient = africastalking.SMS;
    logger.info(
      {
        username,
        clientInitialized: !!smsClient,
      },
      "✅ Africa's Talking SMS client initialized successfully"
    );
    return smsClient;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        username,
      },
      "❌ Failed to initialize Africa's Talking client"
    );
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
  const startTime = Date.now();

  logger.info(
    {
      to: to.slice(-4),
      messageLength: message.length,
      smsEnabled: config.SMS.ENABLED,
      timestamp: new Date().toISOString(),
    },
    "📱 SMS sending initiated"
  );

  // Check if SMS is enabled
  if (!config.SMS.ENABLED) {
    logger.info(
      {
        to: to.slice(-4),
        messageLength: message.length,
        reason: "SMS_ENABLED is false",
      },
      "⚠️ STUB MODE: SMS sending disabled, would send SMS"
    );
    return {
      success: true,
      messageId: `stub-${Date.now()}`,
    };
  }

  // Initialize client if needed
  logger.info(
    { to: to.slice(-4) },
    "🔌 Initializing Africa's Talking SMS client"
  );
  const client = initializeSMSClient();

  if (!client) {
    logger.warn(
      {
        to: to.slice(-4),
        reason: "SMS client initialization failed",
      },
      "⚠️ STUB MODE: SMS client not initialized, would send SMS"
    );
    return {
      success: true,
      messageId: `stub-no-client-${Date.now()}`,
    };
  }

  // Send actual SMS
  try {
    logger.info(
      {
        to: to.slice(-4),
        senderId: config.SMS.SENDER_ID || "NOT_SET",
        messageLength: message.length,
        enqueue: true,
      },
      "📤 Sending SMS via Africa's Talking API"
    );

    const result = await client.send({
      to: [to],
      message,
      from: config.SMS.SENDER_ID,
      enqueue: true, // Queue for delivery (recommended for reliability)
    });

    logger.info(
      {
        to: to.slice(-4),
        responseStructure: {
          hasMessageData: !!result.SMSMessageData,
          hasRecipients: !!result.SMSMessageData?.Recipients,
          recipientCount: result.SMSMessageData?.Recipients?.length || 0,
        },
        fullResponse: JSON.stringify(result),
      },
      "📨 SMS API response received from Africa's Talking"
    );

    // Africa's Talking returns an array of recipients
    const recipient = result.SMSMessageData?.Recipients?.[0];

    if (!recipient) {
      logger.error(
        {
          to: to.slice(-4),
          result: JSON.stringify(result),
          reason: "No recipient data in response",
        },
        "❌ SMS API response missing recipient data"
      );
      return {
        success: false,
        error: "No recipient data in response",
      };
    }

    // Check status code (101 = Success, 102 = Queued)
    // Both are considered successful delivery
    const statusCode = recipient.statusCode;
    const statusString = recipient.status;
    const isSuccess =
      statusCode === 101 || // Success
      statusCode === 102 || // Queued
      statusString === "Success" || // Fallback to string status
      statusString === "Queued";

    logger.info(
      {
        to: to.slice(-4),
        statusCode,
        statusString,
        isSuccess,
        messageId: recipient.messageId,
        cost: recipient.cost,
        number: recipient.number,
      },
      "📊 SMS status evaluation"
    );

    if (isSuccess) {
      const duration = Date.now() - startTime;
      logger.info(
        {
          to: to.slice(-4),
          messageId: recipient.messageId,
          statusCode,
          statusString,
          cost: recipient.cost,
          durationMs: duration,
          timestamp: new Date().toISOString(),
        },
        "✅ SMS sent successfully"
      );
      return {
        success: true,
        messageId: recipient.messageId,
      };
    } else {
      // Handle error status codes
      const errorMessage = getErrorMessage(statusCode, statusString);
      const duration = Date.now() - startTime;
      logger.warn(
        {
          to: to.slice(-4),
          statusCode,
          statusString,
          errorMessage,
          messageId: recipient.messageId,
          durationMs: duration,
          timestamp: new Date().toISOString(),
        },
        "❌ SMS send failed with error status"
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      {
        to: to.slice(-4),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      },
      "❌ Exception occurred while sending SMS via Africa's Talking"
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
  logger.info(
    {
      phoneNumber: phoneNumber.slice(-4),
      customerId: customerId.slice(-4),
      tempPin: "***",
    },
    "🔐 Sending activation SMS with temporary PIN"
  );

  const message = `Welcome to SupaMoto! Your activation PIN is: ${tempPin}. This PIN expires in 30 minutes. Customer ID: ${customerId}`;

  const result = await sendSMS({
    to: phoneNumber,
    message,
  });

  logger.info(
    {
      phoneNumber: phoneNumber.slice(-4),
      customerId: customerId.slice(-4),
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    },
    result.success
      ? "✅ Activation SMS sent successfully"
      : "❌ Activation SMS failed"
  );

  return result;
}

/**
 * Send eligibility confirmation SMS
 */
export async function sendEligibilityConfirmationSMS(
  phoneNumber: string
): Promise<SendSMSResult> {
  logger.info(
    { phoneNumber: phoneNumber.slice(-4) },
    "🎉 Sending eligibility confirmation SMS"
  );

  const message =
    "Congratulations! You are eligible for the 1,000-Day Household program. You can now collect your first free bag of beans! :)";

  const result = await sendSMS({
    to: phoneNumber,
    message,
  });

  logger.info(
    {
      phoneNumber: phoneNumber.slice(-4),
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    },
    result.success
      ? "✅ Eligibility confirmation SMS sent successfully"
      : "❌ Eligibility confirmation SMS failed"
  );

  return result;
}

/**
 * Send distribution OTP SMS
 */
export async function sendDistributionOTP(
  phoneNumber: string,
  otp: string
): Promise<SendSMSResult> {
  logger.info(
    {
      phoneNumber: phoneNumber.slice(-4),
      otp: "***",
    },
    "🔑 Sending distribution OTP SMS"
  );

  const message = `Your bean collection OTP is: ${otp}. Show this code to the Lead Generator. Valid for 10 minutes.`;

  const result = await sendSMS({
    to: phoneNumber,
    message,
  });

  logger.info(
    {
      phoneNumber: phoneNumber.slice(-4),
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    },
    result.success
      ? "✅ Distribution OTP SMS sent successfully"
      : "❌ Distribution OTP SMS failed"
  );

  return result;
}

/**
 * Send generic notification SMS
 */
export async function sendNotificationSMS(
  phoneNumber: string,
  message: string
): Promise<SendSMSResult> {
  logger.info(
    {
      phoneNumber: phoneNumber.slice(-4),
      messageLength: message.length,
    },
    "📢 Sending notification SMS"
  );

  const result = await sendSMS({
    to: phoneNumber,
    message,
  });

  logger.info(
    {
      phoneNumber: phoneNumber.slice(-4),
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    },
    result.success
      ? "✅ Notification SMS sent successfully"
      : "❌ Notification SMS failed"
  );

  return result;
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
  const startTime = Date.now();

  logger.info(
    {
      to: params.to.slice(-4),
      maxAttempts,
      delays,
      eventType: auditContext?.eventType,
      customerId: auditContext?.customerId?.slice(-4),
    },
    "🔄 SMS retry logic initiated"
  );

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait before retry (except first attempt)
    if (attempt > 0 && delays[attempt]) {
      const delaySeconds = delays[attempt];
      logger.info(
        {
          to: params.to.slice(-4),
          attempt: attempt + 1,
          maxAttempts,
          delaySeconds,
        },
        `⏳ Waiting ${delaySeconds}s before retry attempt ${attempt + 1}`
      );
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    }

    logger.info(
      {
        to: params.to.slice(-4),
        attempt: attempt + 1,
        maxAttempts,
      },
      `📤 SMS send attempt ${attempt + 1}/${maxAttempts}`
    );

    const result = await sendSMS(params);

    if (result.success) {
      const totalDuration = Date.now() - startTime;
      logger.info(
        {
          to: params.to.slice(-4),
          attempt: attempt + 1,
          maxAttempts,
          messageId: result.messageId,
          totalDurationMs: totalDuration,
          timestamp: new Date().toISOString(),
        },
        attempt > 0
          ? `✅ SMS sent successfully after ${attempt + 1} attempt(s)`
          : "✅ SMS sent successfully on first attempt"
      );
      return result;
    }

    // Log failed attempt
    logger.warn(
      {
        to: params.to.slice(-4),
        attempt: attempt + 1,
        maxAttempts,
        error: result.error,
        timestamp: new Date().toISOString(),
      },
      `❌ SMS send attempt ${attempt + 1}/${maxAttempts} failed`
    );

    // Create audit record for failed attempt
    if (auditContext) {
      try {
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
      } catch (auditError) {
        logger.error(
          {
            error:
              auditError instanceof Error
                ? auditError.message
                : String(auditError),
            attempt: attempt + 1,
          },
          "Failed to create audit log for SMS failure"
        );
      }
    }
  }

  // All attempts failed
  const totalDuration = Date.now() - startTime;
  logger.error(
    {
      to: params.to.slice(-4),
      attempts: maxAttempts,
      totalDurationMs: totalDuration,
      timestamp: new Date().toISOString(),
    },
    `❌ SMS send failed after all ${maxAttempts} retry attempts`
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
