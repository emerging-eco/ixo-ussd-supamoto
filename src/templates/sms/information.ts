/**
 * SMS Templates for Know More Information Requests
 * Based on: specs/SMS Templates for the USSD (1)-Know More.docx.md
 * All messages optimized to fit within 160 character SMS limit
 */

const GREETING = "Chinja Malasha, Chinya Umoyo!";

/**
 * SMS template for option 1: Interested in a stove
 * Provides information about how to apply for a stove
 * Character count: ~90 chars
 */
export function interestedInStoveSMS(): string {
  return `${GREETING} Interested in a stove? Call us free on 2233 to apply or visit our office.`;
}

/**
 * SMS template for option 2: Pellet Bag Prices & Accessories
 * Provides pricing information for different pellet bag sizes
 * Character count: ~110 chars
 */
export function pelletPricesSMS(): string {
  return `${GREETING} Pellet prices: 5kg K25, 20kg K90, 30kg K130, 50kg K205. Choose the size that suits your needs!`;
}

/**
 * SMS template for option 3: Can we deliver it to you?
 * Provides information about pellet collection points and delivery options
 * Character count: ~140 chars
 */
export function deliveryInfoSMS(): string {
  return `${GREETING} Buy pellets from LGs, Shops, or Resellers. No collection point nearby? We deliver! Call 2233 to find nearest point.`;
}

/**
 * SMS template for option 4: Can a stove be fixed?
 * Provides information about stove repair and replaceable parts
 * Character count: ~130 chars
 */
export function stoveRepairSMS(): string {
  return `${GREETING} Yes, stoves can be fixed! Replaceable parts: battery, chamber, fan. Contact us on 2233 for support.`;
}

/**
 * SMS template for option 5: What is Performance?
 * Explains the performance requirements for Utility customers
 * Character count: ~150 chars
 */
export function performanceInfoSMS(): string {
  return `${GREETING} Utility customers must buy 1+ bag pellets/month per contract. Failure may lead to stove repossession. Track your performance!`;
}

/**
 * SMS template for option 6: What is a digital voucher?
 * Explains the digital voucher redemption system
 * Character count: ~130 chars
 */
export function digitalVoucherInfoSMS(): string {
  return `${GREETING} Redeem pellets or 5kg beans at discounted price based on performance. Keep up the good work!`;
}

/**
 * SMS template for option 7: What is a contract?
 * Explains the contract requirements for stove ownership
 * Character count: ~140 chars
 */
export function contractInfoSMS(): string {
  return `${GREETING} All customers must sign a contract to own a SupaMoto stove. It outlines terms, conditions, and usage rules.`;
}

/**
 * Get SMS template by menu option number
 * @param option - Menu option number (1-7)
 * @returns SMS message content for the selected option
 * @throws Error if option is not between 1 and 7
 */
export function getKnowMoreSMS(option: number): string {
  switch (option) {
    case 1:
      return interestedInStoveSMS();
    case 2:
      return pelletPricesSMS();
    case 3:
      return deliveryInfoSMS();
    case 4:
      return stoveRepairSMS();
    case 5:
      return performanceInfoSMS();
    case 6:
      return digitalVoucherInfoSMS();
    case 7:
      return contractInfoSMS();
    default:
      throw new Error(`Invalid Know More option: ${option}`);
  }
}
