import { createActor } from "xstate";
import { knowMoreMachine } from "../../../../src/machines/supamoto/information/knowMoreMachine.js";
/**
 * Know More Machine Demo
 *
 * Demonstrates the know more machine functionality including:
 * - Information menu navigation (7 options)
 * - SMS sending for each information request
 * - Success and error handling
 * - Navigation and recovery
 */
console.log("🚀 Know More Machine Demo\n");
const mockInput = {
    sessionId: "demo-session-789",
    phoneNumber: "+260987654321",
    serviceCode: "*2233#",
};
// Demo 1: Option 1 - Interested in a stove
console.log("=".repeat(50));
console.log("DEMO 1: Option 1 - Interested in a stove (SMS)");
console.log("=".repeat(50));
const actor1 = createActor(knowMoreMachine, { input: mockInput });
actor1.subscribe(snapshot => {
    console.log(`📍 State: ${snapshot.value}`);
    if (snapshot.context.message) {
        console.log(`💬 Message:\n${snapshot.context.message}`);
    }
    if (snapshot.context.error) {
        console.log(`❌ Error: ${snapshot.context.error}`);
    }
    if (snapshot.output) {
        console.log(`🎯 Output:`, snapshot.output);
    }
    console.log("");
});
actor1.start();
console.log("📱 User started know more flow (automatic)");
actor1.send({ type: "INPUT", input: "1" }); // Option 1: Interested in a stove
console.log("📱 User selected option 1 - Interested in a stove");
console.log("📱 SMS will be sent (in stub mode if SMS_ENABLED=false)");
console.log("✅ Option 1 flow complete!\n");
// Demo 2: Option 4 - Can a stove be fixed?
console.log("=".repeat(50));
console.log("DEMO 2: Option 4 - Can a stove be fixed? (SMS)");
console.log("=".repeat(50));
const actor2 = createActor(knowMoreMachine, { input: mockInput });
actor2.subscribe(snapshot => {
    console.log(`📍 State: ${snapshot.value}`);
    if (snapshot.context.message) {
        console.log(`💬 Message:\n${snapshot.context.message}`);
    }
    console.log("");
});
actor2.start();
actor2.send({ type: "INPUT", input: "4" }); // Option 4: Can a stove be fixed?
console.log("📱 User selected option 4 - Can a stove be fixed?");
console.log("📱 SMS will be sent with repair information");
console.log("✅ Option 4 flow complete!\n");
// Demo 3: Option 7 - What is a contract?
console.log("=".repeat(50));
console.log("DEMO 3: Option 7 - What is a contract? (SMS)");
console.log("=".repeat(50));
const actor3 = createActor(knowMoreMachine, { input: mockInput });
actor3.subscribe(snapshot => {
    console.log(`📍 State: ${snapshot.value}`);
    if (snapshot.context.message) {
        console.log(`💬 Message:\n${snapshot.context.message}`);
    }
    console.log("");
});
actor3.start();
actor3.send({ type: "INPUT", input: "7" }); // Option 7: What is a contract?
console.log("📱 User selected option 7 - What is a contract?");
console.log("📱 SMS will be sent with contract information");
console.log("✅ Option 7 flow complete!\n");
// Demo 4: Navigation Flow
console.log("=".repeat(50));
console.log("DEMO 4: Navigation Flow");
console.log("=".repeat(50));
const actor4 = createActor(knowMoreMachine, { input: mockInput });
actor4.subscribe(snapshot => {
    console.log(`📍 State: ${snapshot.value}`);
    if (snapshot.context.message) {
        console.log(`💬 Message:\n${snapshot.context.message}`);
    }
    if (snapshot.output) {
        console.log(`🎯 Output:`, snapshot.output);
    }
    console.log("");
});
actor4.start();
console.log("📱 User started know more flow (automatic)");
actor4.send({ type: "INPUT", input: "1" });
console.log("📱 User selected product information");
actor4.send({ type: "INPUT", input: "0" }); // Back command
console.log("📱 User navigated back to info menu");
console.log("✅ Navigation flow complete!\n");
// Demo 5: Error Handling
console.log("=".repeat(50));
console.log("DEMO 5: Error Handling");
console.log("=".repeat(50));
const actor5 = createActor(knowMoreMachine, { input: mockInput });
actor5.subscribe(snapshot => {
    console.log(`📍 State: ${snapshot.value}`);
    if (snapshot.context.error) {
        console.log(`❌ Error: ${snapshot.context.error}`);
    }
    if (snapshot.context.message) {
        console.log(`💬 Message:\n${snapshot.context.message}`);
    }
    console.log("");
});
actor5.start();
console.log("📱 User started know more flow (automatic)");
actor5.send({ type: "ERROR", error: "Network connection failed" });
console.log("📱 Error occurred");
actor5.send({ type: "INPUT", input: "0" }); // Back command to recover
console.log("📱 User recovered from error");
console.log("✅ Error handling complete!\n");
console.log("\n🎉 Know More Machine Demo Complete!");
console.log("\n📊 Machine Summary:");
console.log("   • Handles 7 information request options");
console.log("   • Sends SMS with specific information for each option");
console.log("   • Uses Africa's Talking SMS service");
console.log("   • Provides proper navigation and back functionality");
console.log("   • Includes error handling for SMS failures");
console.log("   • Routes back to main menu when requested");
console.log("   • Type-safe with XState v5 setup() pattern");
console.log("   • Follows activation machine pattern for SMS sending");
//# sourceMappingURL=knowMoreMachine-demo.js.map
