/* eslint-disable no-console */
/**
 * USSD Route
 *
 * A route for the modular state machines.
 */

import type { FastifyInstance } from "fastify";
import { sessionService } from "../services/session.js";

export async function ussdRoutes(fastify: FastifyInstance) {
  // Health check endpoint for USSD API
  fastify.get("/api/health", async (request, reply) => {
    reply.send({
      status: "ok",
      service: "ussd",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  fastify.post("/api/ussd", async (request, reply) => {
    try {
      const { sessionId, serviceCode, phoneNumber, text } = request.body as {
        sessionId: string;
        serviceCode: string;
        phoneNumber: string;
        text: string;
      };

      console.log(`\n🔄 USSD Request:`);
      console.log(`   Session: ${sessionId}`);
      console.log(`   Phone: ${phoneNumber}`);
      console.log(`   Service: ${serviceCode}`);
      console.log(`   Input: "${text}"`);

      const response = await sessionService.processSession({
        sessionId,
        serviceCode,
        phoneNumber,
        text,
      });

      console.log(`\n📤 USSD Response:`);
      // console.log(`   Message: ${response.message}`);
      // console.log(`   Is End: ${response.isEnd}`);
      console.log(`   Formatted: ${response.formattedResponse}`);

      // Return the formatted response (CON/END format)
      return reply.type("text/plain").send(response.formattedResponse);
    } catch (error) {
      console.error("❌ USSD Error:", error);
      return reply
        .type("text/plain")
        .send("END Service error. Please try again later.");
    }
  });

  // Debug route to inspect session state
  fastify.get("/api/ussd/debug/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    const debugInfo = sessionService.debugSession(sessionId);

    reply.send({
      sessionId,
      debugInfo,
      activeSessions: sessionService.getActiveSessions(),
    });
  });

  // Route to list all active sessions
  fastify.get("/api/ussd/sessions", async (request, reply) => {
    reply.send({
      activeSessions: sessionService.getActiveSessions(),
      count: sessionService.getActiveSessions().length,
    });
  });
}
