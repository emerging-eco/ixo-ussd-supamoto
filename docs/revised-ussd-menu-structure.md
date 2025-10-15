1. Know More
   1. Interested in Product
      1. Main Menu
      2. Back
   2. Pricing & accessories
      1. Main Menu
      2. Back
   3. Can we deliver to you?
      1. Main Menu
      2. Back
   4. Back

2. Account Menu
   1. Yes, log me in
      - CON Enter your Customer ID to log in: 0. Back
      - CON Verifying Customer ID...
        1. Continue
        2. Back //remove Back - not allowed here
      - CON Enter your PIN: 0. Back //replace with 1. Account Menu
      - CON Verifying PIN...
        1. Continue
        2. Back //remove Back - not allowed here
      - CON Welcome, lll! Login successful for Customer ID: C080FCD90.
        1. Continue
        2. Back //remove Back - not allowed here
   2. No, create my account
      - CON Welcome to USSD Supamoto App. Enter your full name: 0. Back
      - CON Enter your email address (optional): 00. Skip 0. Back
      - CON Create a 5-digit PIN for your account: 0. Back
      - CON Confirm your 5-digit PIN: 0. Back
      - CON Creating your account...
        1. View your Customer ID
      - CON Account created successfully! Your Customer ID: C1A1F1FE8. Save your Customer ID to access services.
        1. Back to Account Menu //change to "Account Menu", i.e. remove the "Back to" part.
   3. Activate my account //remove because customers must rather us the "1. Yes, log me in" menu with their temporary PIN.
   4. Back

3. User Services //change from "3. User Services" to "3. Services" - only visible to users who have logged in - see the many changes to the menu below
   1. Account //hide "Account" feature and rather implement the "1,000 Day Household" feature
   2. Balances //hide "Balances" feature and rather implement the "Confirm Receiving Beans" feature
   3. Orders //hide
   4. Vouchers //hide
   5. Customer Tools //feature only visible to users with 'customer' role
      1. 1,000 Day Household
         - CON A 1,000 Day Household is a family with a pregnant or breastfeeding mother, or a child younger than two years old. Do you have an eligible 1,000 Day Household?
           1. Yes
           2. No
           3. Back
         - CON Your self-proclamation of being a 1,000 Day Household has been recorded. You should receive an SMS shortly confirming that your account has been allocated a Bean voucher. You can show this SMS to your Lead Generator to receive a bag of beans.
           1. Continue
      2. Confirm Receival of Beans //feature only visible to users with 'customer' role
         - CON Did you receive a bag of beans?
           1. Yes
           2. No
           3. Back
         - CON Thank you for your confirmation.
           1. Continue
   6. Agent Tools //feature is not visible to users with the 'customer' role
      1. Check funds in escrow //hide
      2. Check BEAN vouchers //hide
      3. Activate Customer //display as "Activate a Customer"
         - CON Verify Customer. Enter Customer ID: // change to "CON Customer ID to activate:" 0. Back
         - CON Enter customer's phone number (with country code, e.g., +260971234567): 0. Back
         - CON Thank you. The customer will receive an SMS with their temporary PIN. They should then log in using *2233*2\*1# and reset their PIN.
           1. Continue
      4. Register my intent to provide beans
         - CON Enter Customer ID to receive beans: 0. Back
         - CON Thank you. The customer will receive an SMS with an OTP. The OTP is valid for 10 minutes.
           1. Continue
      5. Submit OTP
         - CON Enter Customer ID providing the OTP: 0. Back
         - CON Enter OTP: 0. Back
         - CON Thank you. You will soon receive an SMS confirming that you can go ahead.
           1. Continue
      6. Confirm Delivery of Beans
         - CON Enter Customer ID who received the bag of beans: 0. Back
         - CON Thank you. You will soon receive an SMS confirming that a Bean voucher has been transferred to your subscription.
           1. Continue
      7. Back
   7. Back

\*. Exit
