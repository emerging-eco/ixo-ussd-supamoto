/**
 * Type definitions for africastalking package
 */

declare module 'africastalking' {
  interface AfricasTalkingConfig {
    apiKey: string;
    username: string;
  }

  interface SMSRecipient {
    status: string;
    messageId?: string;
    number?: string;
    cost?: string;
  }

  interface SMSResponse {
    SMSMessageData: {
      Message: string;
      Recipients: SMSRecipient[];
    };
  }

  interface SMSOptions {
    to: string[];
    message: string;
    from?: string;
    enqueue?: boolean;
  }

  interface SMS {
    send(options: SMSOptions): Promise<SMSResponse>;
  }

  interface AfricasTalking {
    SMS: SMS;
  }

  function AfricasTalking(config: AfricasTalkingConfig): AfricasTalking;

  export = AfricasTalking;
}

