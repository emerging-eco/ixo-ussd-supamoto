/**
 * SMS Templates for Know More Information Requests
 * Based on: specs/SMS Templates for the USSD (1)-Know More.docx.md
 */

const GREETING = "Chinja Malasha, Chinya Umoyo!";

/**
 * SMS template for option 1: Interested in a stove
 * Provides information about how to apply for a stove
 */
export function interestedInStoveSMS(): string {
  return `${GREETING}
Interested in getting a stove? Call us for free on 2233 or Apply for a stove on the link below

Apply Here: https://docs.google.com/forms/d/e/1FAIpQLSd3b8qFb1SPztgxc9_4FbJ13JRcUVvwnHUGog7VlYvFWSeUWw/viewform?usp=sharing&ouid=107101220280266558299`;
}

/**
 * SMS template for option 2: Pellet Bag Prices & Accessories
 * Provides pricing information for different pellet bag sizes
 */
export function pelletPricesSMS(): string {
  return `${GREETING}

Pellets are available in 5kg, 20kg, 30kg, and 50kg bags priced at K25, K90, K130, and K205 respectively.
Choose the size that suits your needs!`;
}

/**
 * SMS template for option 3: Can we deliver it to you?
 * Provides information about pellet collection points and delivery options
 */
export function deliveryInfoSMS(): string {
  return `${GREETING}

You can buy pellets from our Lead Generators, Shops, or Resellers. If you're in an area without a collection point, we offer deliveries too!

Call 2233 to confirm which collection point is near you!`;
}

/**
 * SMS template for option 4: Can a stove be fixed?
 * Provides information about stove repair and replaceable parts
 */
export function stoveRepairSMS(): string {
  return `${GREETING}

Yes, your stove can be fixed! SupaMoto stoves (Minimoto or SupaMoto) come with replaceable parts like the battery, chamber, or fan.

Contact us on 2233 for support.`;
}

/**
 * SMS template for option 5: What is Performance?
 * Explains the performance requirements for Utility customers
 */
export function performanceInfoSMS(): string {
  return `${GREETING}
Your performance is based on your contract. As a Utility customer, you must buy at least 1 bag of pellets per month. Failure to do so may lead to stove repossession.
Track your performance to stay on track!`;
}

/**
 * SMS template for option 6: What is a digital voucher?
 * Explains the digital voucher redemption system
 */
export function digitalVoucherInfoSMS(): string {
  return `${GREETING}
You're eligible to redeem a bag of pellets or a 5kg packet of beans at a discounted price, based on your performance.
Keep up the good work!`;
}

/**
 * SMS template for option 7: What is a contract?
 * Explains the contract requirements for stove ownership
 */
export function contractInfoSMS(): string {
  return `${GREETING}

To own a SupaMoto stove, all customers must understand and sign a contract. This agreement outlines the terms and conditions of use and rules for using the stove.

It's a key part of your stove usage.`;
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
