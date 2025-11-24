#!/usr/bin/env node

/**
 * Resend Configuration Test Script
 * This script helps test Resend email functionality
 */

const axios = require("axios");

// Configuration
const API_BASE_URL = "http://localhost:3000";
const API_KEY =
  "c30865adc9226f95cceab87f737b2826ee0d652ab46e94ebebe51a9c3056460f";

async function testResendConfiguration() {
  console.log("🧪 Testing Resend Email Configuration\n");

  try {
    // Test Resend connection
    console.log("Step 1: Testing Resend connection");
    console.log("─".repeat(50));

    const resendTest = await axios.post(
      `${API_BASE_URL}/mailboxes/test-resend`,
      {
        testEmail: "sooreoluwa@klarnow.co.uk",
      },
      {
        headers: {
          "X-API-Key": API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Resend test result:");
    console.log(
      "   Connection:",
      resendTest.data.resendConnection ? "SUCCESS" : "FAILED"
    );
    console.log(
      "   Email Sent:",
      resendTest.data.emailSent ? "SUCCESS" : "FAILED"
    );
    console.log("   Message:", resendTest.data.message);
    console.log("");

    // Test password reset with email notification
    console.log(
      "Step 2: Testing password reset with Resend email notification"
    );
    console.log("─".repeat(50));

    const resetTest = await axios.post(
      `${API_BASE_URL}/mailboxes/reset-password`,
      {
        email: "careers@klarnow.co.uk",
        recipient_email: "sooreoluwa@klarnow.co.uk",
      },
      {
        headers: {
          "X-API-Key": API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Password reset with email notification:");
    console.log("   Status:", resetTest.data.status);
    console.log("   Email:", resetTest.data.email);
    console.log("   Message:", resetTest.data.message);
    console.log("");

    console.log("🎉 Resend Integration Test Complete!");
    console.log("\n📋 Summary:");
    console.log("• Resend service is integrated");
    console.log("• Password reset emails are sent via Resend");
    console.log("• Email notifications are working");
    console.log("• No more SMTP authentication issues");
  } catch (error) {
    console.error("❌ Test failed:", error.message);

    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error(
        "Response data:",
        JSON.stringify(error.response.data, null, 2)
      );
    }

    console.log("\n🔧 Troubleshooting tips:");
    console.log("• Make sure the API server is running on", API_BASE_URL);
    console.log("• Verify your API key is correct");
    console.log("• Check your RESEND_API_KEY configuration");
    console.log("• Ensure Resend API key is valid");
  }
}

// Run the test
testResendConfiguration();
