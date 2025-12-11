import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {Request, Response} from "express";

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Health check endpoint
 */
export const healthCheck = functions.https.onRequest(
  (req: Request, res: Response) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    });
  },
);

/**
 * Test callable function
 */
export const testFunction = functions.https.onCall(
  async (data: Record<string, unknown>) => {
    return {
      message: "Test function working",
      timestamp: new Date().toISOString(),
      receivedData: data,
    };
  },
);
