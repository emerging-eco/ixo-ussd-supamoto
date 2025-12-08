import { createActor } from "xstate";
import { userServicesMachine } from "./userServicesMachine.js";
console.log("🚀 User Services Machine Demo");
console.log("================================");
const mockInput = {
    sessionId: "demo-session-" + Date.now(),
    phoneNumber: "+260971230000",
    serviceCode: "*2233#",
};
const actor = createActor(userServicesMachine, { input: mockInput });
actor.subscribe(snapshot => {
    console.log(`\n📍 State: ${snapshot.value}`);
    console.log(`💬 Message: ${snapshot.context.message}`);
    if (snapshot.status === "done") {
        console.log("✅ Final Output: (route to main)");
        process.exit(0);
    }
});
actor.start();
console.log("\n🎬 Starting demo flow...");
setTimeout(() => {
    console.log("\n➡️ Open Account submenu");
    actor.send({ type: "INPUT", input: "1" });
}, 1000);
setTimeout(() => {
    console.log("\n👀 Show Account Details");
    actor.send({ type: "INPUT", input: "1" });
}, 2000);
setTimeout(() => {
    console.log("\n⬅️ Back to Account");
    actor.send({ type: "INPUT", input: "1" });
}, 3500);
setTimeout(() => {
    console.log("\n⬅️ Back to Menu");
    actor.send({ type: "INPUT", input: "0" });
}, 4500);
setTimeout(() => {
    console.log("\n🚪 Exit to Main");
    actor.send({ type: "INPUT", input: "*" });
}, 5500);
setTimeout(() => {
    console.log("\n⏰ Demo timeout - exiting");
    process.exit(0);
}, 15000);
//# sourceMappingURL=userServicesMachine-demo.js.map
