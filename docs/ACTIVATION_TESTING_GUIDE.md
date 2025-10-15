# Customer Activation - Testing Guide

## Prerequisites

Before testing, ensure:

1. ✅ **Build completed successfully**

   ```bash
   pnpm build
   ```

2. ✅ **Database migration run**

   ```bash
   node dist/src/migrations/run-migrations.js
   ```

3. ✅ **Environment configured**

   ```bash
   # In .env file
   SMS_ENABLED=false  # Use stub mode for testing
   AFRICASTALKING_API_KEY=sandbox
   AFRICASTALKING_USERNAME=sandbox
   AFRICASTALKING_SENDER_ID=SUPAMOTO
   ```

4. ✅ **Test user account exists**
   - You need a Lead Generator account to access Agent Tools
   - Create one via Account Menu → Create Account if needed

---

## Test Scenarios

### Scenario 1: Happy Path - Complete Activation Flow

**Objective:** Test the full customer activation flow from start to finish.

**Steps:**

1. **Start USSD Server**

   ```bash
   pnpm start
   ```

2. **Dial USSD Code**
   - Dial: `*2233#`
   - Expected: Welcome message with menu

3. **Navigate to Login**
   - Input: `2` (Account Menu)
   - Input: `1` (Login)
   - Input: Your phone number (e.g., `+260971234567`)
   - Input: Your PIN (e.g., `1234`)
   - Expected: Login successful, return to main menu

4. **Navigate to User Services**
   - Input: `3` (User Services)
   - Expected: User Services menu displayed

5. **Navigate to Agent Tools**
   - Input: `5` (Agent Tools)
   - Expected: Agent Tools menu with 3 options:
     ```
     Agent Tools
     1. Check funds in escrow
     2. Check BEAN vouchers
     3. Activate Customer
     0. Back
     ```

6. **Select Activate Customer**
   - Input: `3` (Activate Customer)
   - Expected: "Verify Customer\nEnter Customer ID:"

7. **Enter Customer ID**
   - Input: `C12345678` (valid format: C + 8+ alphanumeric)
   - Expected: "Enter customer's phone number (with country code):"

8. **Enter Customer Phone**
   - Input: `+260971234567` (valid format: + followed by 10-15 digits)
   - Expected: "Activation SMS sent to customer C12345678..."

9. **Continue**
   - Input: `1` (Continue)
   - Expected: Return to Agent Tools menu

**Expected Result:** ✅ Flow completes successfully and returns to Agent Tools menu

---

### Scenario 2: Invalid Customer ID

**Objective:** Test validation of customer ID format.

**Steps:**

1. Navigate to Activate Customer (follow steps 1-6 from Scenario 1)

2. **Enter Invalid Customer ID**
   - Input: `12345678` (missing 'C' prefix)
   - Expected: "Invalid Customer ID format. Please enter a valid Customer ID (e.g., C12345678):"

3. **Enter Another Invalid ID**
   - Input: `C123` (too short)
   - Expected: Same error message

4. **Enter Valid ID**
   - Input: `C12345678`
   - Expected: Proceed to phone number entry

**Expected Result:** ✅ Validation catches invalid formats and allows retry

---

### Scenario 3: Invalid Phone Number

**Objective:** Test validation of phone number format.

**Steps:**

1. Navigate to Activate Customer and enter valid Customer ID

2. **Enter Invalid Phone Number**
   - Input: `0971234567` (missing country code)
   - Expected: "Invalid phone number. Please enter with country code (e.g., +260971234567):"

3. **Enter Another Invalid Number**
   - Input: `+26097` (too short)
   - Expected: Same error message

4. **Enter Valid Number**
   - Input: `+260971234567`
   - Expected: Proceed to SMS sending

**Expected Result:** ✅ Validation catches invalid formats and allows retry

---

### Scenario 4: Back Navigation

**Objective:** Test back navigation at each step.

**Steps:**

1. Navigate to Activate Customer

2. **Back from Customer ID Entry**
   - Input: `0` (Back)
   - Expected: Return to Agent Tools menu

3. Navigate to Activate Customer again, enter valid Customer ID

4. **Back from Phone Entry**
   - Input: `0` (Back)
   - Expected: Return to Customer ID entry

**Expected Result:** ✅ Back navigation works at each step

---

### Scenario 5: Exit Navigation

**Objective:** Test exit navigation.

**Steps:**

1. Navigate to Activate Customer

2. **Exit from Customer ID Entry**
   - Input: `*` (Exit)
   - Expected: Session closes with goodbye message

**Expected Result:** ✅ Exit closes the session properly

---

### Scenario 6: SMS Stub Mode

**Objective:** Verify SMS sending works in stub mode.

**Steps:**

1. **Check Environment**

   ```bash
   # Ensure SMS_ENABLED=false in .env
   ```

2. **Monitor Logs**

   ```bash
   # In terminal running pnpm start, watch for:
   [sms] STUB: SMS sending disabled, would send SMS
   ```

3. **Complete Activation Flow**
   - Follow Scenario 1 steps
   - Watch console logs for SMS stub messages

**Expected Result:** ✅ SMS messages are logged but not actually sent

---

### Scenario 7: Database Records

**Objective:** Verify database records are created correctly.

**Steps:**

1. **Complete Activation Flow** (Scenario 1)

2. **Check Database**

   ```bash
   psql -U your_user -d your_database
   ```

3. **Query temp_pins Table**

   ```sql
   SELECT * FROM temp_pins
   WHERE customer_id = 'C12345678'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

   - Expected: Record exists with temp_pin, expires_at, used=false

4. **Verify Expiry Time**
   - Expected: expires_at is ~30 minutes after created_at

**Expected Result:** ✅ Database records are created with correct data

---

## Automated Testing

### Unit Tests

Run the user services machine tests:

```bash
pnpm test src/machines/supamoto/user-services/userServicesMachine.test.ts
```

### Demo Script

Run the interactive demo:

```bash
pnpm tsx src/machines/supamoto/user-services/userServicesMachine-demo.ts
```

---

## Troubleshooting

### Issue: "Agent Tools" menu doesn't show option 3

**Possible Causes:**

- Build not run after changes
- Old cached version running

**Solution:**

```bash
pnpm build
pnpm start
```

---

### Issue: "Cannot find module '../activation/customerActivationMachine.js'"

**Possible Causes:**

- Activation machine files not created
- Build failed

**Solution:**

```bash
# Verify files exist
ls -la src/machines/supamoto/activation/

# Rebuild
pnpm build
```

---

### Issue: Child machine doesn't receive input

**Possible Causes:**

- `sendTo` not imported
- Incorrect child ID

**Solution:**

- Verify `sendTo` is imported from xstate
- Verify child ID matches: `"activationChild"`

---

### Issue: Message doesn't update during flow

**Possible Causes:**

- `onSnapshot` not configured
- Message assignment incorrect

**Solution:**

- Verify `onSnapshot` handler exists in invoke config
- Check that it assigns `event.snapshot.context.message`

---

### Issue: Doesn't return to Agent Tools after completion

**Possible Causes:**

- `onDone` handlers not configured correctly
- Target state incorrect

**Solution:**

- Verify all `onDone` handlers target `"agent"` state
- Check that default handler exists

---

## Performance Testing

### Load Test

Test with multiple concurrent sessions:

```bash
# Use Africa's Talking simulator or custom script
# Send multiple USSD requests simultaneously
```

**Expected:** System handles concurrent activations without errors

---

### Memory Test

Monitor memory usage during activation flow:

```bash
# Start server with memory monitoring
node --expose-gc dist/src/index.js

# Monitor in another terminal
watch -n 1 'ps aux | grep node'
```

**Expected:** No memory leaks during repeated activations

---

## Integration Testing

### With Real SMS (Production)

1. **Configure Real Credentials**

   ```bash
   # In .env
   SMS_ENABLED=true
   AFRICASTALKING_API_KEY=your_real_api_key
   AFRICASTALKING_USERNAME=your_username
   ```

2. **Test with Real Phone**
   - Use actual customer phone number
   - Verify SMS is received
   - Check SMS content and format

3. **Verify Costs**
   - Check Africa's Talking dashboard
   - Verify SMS credits deducted

---

### With IXO Blockchain (Future)

When claim submission is implemented:

1. Test claim submission to IXO
2. Verify claim appears on blockchain
3. Check claim status updates

---

### With Subscriptions Service (Future)

When token transfer is implemented:

1. Test BEAN token transfer
2. Verify customer receives tokens
3. Check subscription status

---

## Test Checklist

Before marking as complete, verify:

- [ ] Build succeeds without errors
- [ ] Agent Tools menu shows option 3
- [ ] Selecting option 3 launches activation flow
- [ ] Customer ID validation works
- [ ] Phone number validation works
- [ ] SMS sending is logged (stub mode)
- [ ] Database records are created
- [ ] Back navigation works
- [ ] Exit navigation works
- [ ] Returns to Agent Tools after completion
- [ ] Error handling works
- [ ] No console errors during flow
- [ ] No memory leaks
- [ ] Concurrent sessions work

---

## Reporting Issues

If you encounter issues:

1. **Check Logs**
   - Console output from `pnpm start`
   - Look for error messages

2. **Check Database**
   - Verify tables exist
   - Check for constraint violations

3. **Check Environment**
   - Verify .env variables are set
   - Check SMS_ENABLED flag

4. **Provide Details**
   - Steps to reproduce
   - Expected vs actual behavior
   - Console logs
   - Database state

---

## Next Steps After Testing

Once testing is complete:

1. ✅ **Document any issues found**
2. ✅ **Fix critical bugs**
3. ✅ **Update documentation if needed**
4. ⚠️ **Plan for production deployment**
5. ⚠️ **Configure real SMS credentials**
6. ⚠️ **Implement claim submission**
7. ⚠️ **Implement token transfer**

---

## Success Criteria

Testing is successful when:

- ✅ All test scenarios pass
- ✅ No TypeScript errors
- ✅ No runtime errors
- ✅ Database records created correctly
- ✅ Navigation works as expected
- ✅ SMS stub mode works
- ✅ Returns to menu after completion
- ✅ User experience is smooth

---

**Happy Testing! 🎉**
