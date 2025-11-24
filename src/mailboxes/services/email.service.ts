import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

export interface WelcomeEmailData {
  email: string;
  recipient_email: string;
  tempPassword: string;
  quotaMb: number;
  displayName?: string;
}

export interface PasswordResetEmailData {
  email: string;
  recipient_email: string;
  newPassword: string;
  displayName?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>("RESEND_API_KEY");

    if (!apiKey) {
      throw new Error("Missing required RESEND_API_KEY configuration");
    }

    this.resend = new Resend(apiKey);
    this.logger.log("Email service initialized with Resend");
  }

  /**
   * Send password reset notification email
   */
  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
    const {
      email,
      recipient_email,
      newPassword,
      displayName = "Mailbox",
    } = data;

    const fromName =
      this.configService.get<string>("RESEND_FROM_NAME") || "Team Klarnow";
    const fromEmail =
      this.configService.get<string>("RESEND_FROM_EMAIL") ||
      "no-reply@klarnow.co.uk";
    const imapHost = this.configService.get<string>("IMAP_HOST");
    const imapPort = this.configService.get<number>("IMAP_PORT");
    const smtpHost = this.configService.get<string>("SMTP_HOST_OUT");
    const smtpPort = this.configService.get<number>("SMTP_PORT_OUT");
    const webmailUrl = this.configService.get<string>("WEBMAIL_URL");

    const htmlContent = this.generatePasswordResetEmailHtml({
      email,
      newPassword,
      displayName,
      imapHost,
      imapPort,
      smtpHost,
      smtpPort,
      webmailUrl,
    });

    try {
      this.logger.log(`Sending password reset email to: ${recipient_email}`);

      const result = await this.resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [recipient_email],
        subject: `Password Reset - ${email}`,
        html: htmlContent,
      });

      this.logger.log(
        `Password reset email sent successfully to: ${recipient_email}`
      );
      this.logger.log(`Resend ID: ${result.data?.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${recipient_email}:`,
        error.message
      );
      throw new BadRequestException(
        `Failed to send password reset email: ${error.message}`
      );
    }
  }

  /**
   * Generate HTML content for password reset email
   */
  private generatePasswordResetEmailHtml(data: {
    email: string;
    newPassword: string;
    displayName: string;
    imapHost?: string;
    imapPort?: number;
    smtpHost?: string;
    smtpPort?: number;
    webmailUrl?: string;
  }): string {
    const {
      email,
      newPassword,
      displayName,
      imapHost,
      imapPort,
      smtpHost,
      smtpPort,
      webmailUrl,
    } = data;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - ${email}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .content {
            background-color: #ffffff;
            padding: 20px;
            border: 1px solid #e9ecef;
            border-radius: 8px;
        }
        .credentials {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
        }
        .settings-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        .settings-table th,
        .settings-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        .settings-table th {
            background-color: #f2f2f2;
        }
        .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
        }
        .security-notice {
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
        }
        .button {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 0;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            font-size: 0.9em;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Password Reset Notification</h1>
        <p>The password for your mailbox <strong>${email}</strong> has been successfully reset.</p>
    </div>

    <div class="content">
        <h2>Updated Mailbox Details</h2>
        <div class="credentials">
            <p><strong>Email Address:</strong> ${email}</p>
            <p><strong>Display Name:</strong> ${displayName}</p>
            <p><strong>New Password:</strong> <code>${newPassword}</code></p>
        </div>

        <div class="security-notice">
            <h3>🔒 Security Notice</h3>
            <p><strong>Important:</strong> Please change your password immediately after logging in for security reasons. You can do this through the webmail interface.</p>
        </div>

        ${
          imapHost && smtpHost
            ? `
        <h2>Updated Email Client Configuration</h2>
        <p>If you're using an email client, please update your settings with the new password:</p>
        
        <h3>Incoming Mail (IMAP) Settings</h3>
        <table class="settings-table">
            <tr>
                <th>Setting</th>
                <th>Value</th>
            </tr>
            <tr>
                <td>Server</td>
                <td>${imapHost}</td>
            </tr>
            <tr>
                <td>Port</td>
                <td>${imapPort || 993}</td>
            </tr>
            <tr>
                <td>Security</td>
                <td>SSL/TLS</td>
            </tr>
            <tr>
                <td>Username</td>
                <td>${email}</td>
            </tr>
            <tr>
                <td>Password</td>
                <td>${newPassword}</td>
            </tr>
        </table>

        <h3>Outgoing Mail (SMTP) Settings</h3>
        <table class="settings-table">
            <tr>
                <th>Setting</th>
                <th>Value</th>
            </tr>
            <tr>
                <td>Server</td>
                <td>${smtpHost}</td>
            </tr>
            <tr>
                <td>Port</td>
                <td>${smtpPort || 587}</td>
            </tr>
            <tr>
                <td>Security</td>
                <td>SSL/TLS</td>
            </tr>
            <tr>
                <td>Username</td>
                <td>${email}</td>
            </tr>
            <tr>
                <td>Password</td>
                <td>${newPassword}</td>
            </tr>
        </table>
        `
            : ""
        }

        <h2>Need Help?</h2>
        <p>If you have any questions or need assistance, please contact your system administrator.</p>
    </div>

    <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>
    `;
  }

  /**
   * Send welcome email with IMAP/SMTP setup details
   */
  async sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
    const {
      email,
      recipient_email,
      tempPassword,
      quotaMb,
      displayName = "Mailbox",
    } = data;

    const fromName =
      this.configService.get<string>("RESEND_FROM_NAME") || "Team Klarnow";
    const fromEmail =
      this.configService.get<string>("RESEND_FROM_EMAIL") ||
      "no-reply@klarnow.co.uk";
    const imapHost = this.configService.get<string>("IMAP_HOST");
    const imapPort = this.configService.get<number>("IMAP_PORT");
    const smtpHost = this.configService.get<string>("SMTP_HOST_OUT");
    const smtpPort = this.configService.get<number>("SMTP_PORT_OUT");
    const webmailUrl = this.configService.get<string>("WEBMAIL_URL");

    const htmlContent = this.generateWelcomeEmailHtml({
      email,
      tempPassword,
      quotaMb,
      displayName,
      imapHost,
      imapPort,
      smtpHost,
      smtpPort,
      webmailUrl,
    });

    try {
      this.logger.log(`Sending welcome email to: ${recipient_email}`);

      const result = await this.resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [recipient_email],
        subject: `Welcome! Your new mailbox ${email} is ready`,
        html: htmlContent,
      });

      this.logger.log(`Welcome email sent successfully to: ${recipient_email}`);
      this.logger.log(`Resend ID: ${result.data?.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${recipient_email}:`,
        error.message
      );
      throw new BadRequestException(
        `Failed to send welcome email: ${error.message}`
      );
    }
  }

  /**
   * Generate HTML content for welcome email
   */
  private generateWelcomeEmailHtml(data: {
    email: string;
    tempPassword: string;
    quotaMb: number;
    displayName: string;
    imapHost?: string;
    imapPort?: number;
    smtpHost?: string;
    smtpPort?: number;
    webmailUrl?: string;
  }): string {
    const {
      email,
      tempPassword,
      quotaMb,
      displayName,
      imapHost,
      imapPort,
      smtpHost,
      smtpPort,
      webmailUrl,
    } = data;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Your New Mailbox</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .content {
            background-color: #ffffff;
            padding: 20px;
            border: 1px solid #e9ecef;
            border-radius: 8px;
        }
        .credentials {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
        }
        .settings-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        .settings-table th,
        .settings-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        .settings-table th {
            background-color: #f2f2f2;
        }
        .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
        }
        .button {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 0;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            font-size: 0.9em;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to Your New Mailbox!</h1>
        <p>Hello! Your new email mailbox <strong>${email}</strong> has been successfully created.</p>
    </div>

    <div class="content">
        <h2>Mailbox Details</h2>
        <div class="credentials">
            <p><strong>Email Address:</strong> ${email}</p>
            <p><strong>Display Name:</strong> ${displayName}</p>
            <p><strong>Mailbox Quota:</strong> ${quotaMb} MB</p>
            <p><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
        </div>

        <div class="warning">
            <h3>⚠️ Security Notice</h3>
            <p><strong>Please change your password immediately</strong> after first login for security reasons. You can do this through the webmail interface.</p>
        </div>

        ${
          imapHost && smtpHost
            ? `
        <h2>Email Client Configuration</h2>
        <p>Use these settings to configure your email client (Outlook, Thunderbird, Apple Mail, etc.):</p>
        
        <h3>Incoming Mail (IMAP) Settings</h3>
        <table class="settings-table">
            <tr>
                <th>Setting</th>
                <th>Value</th>
            </tr>
            <tr>
                <td>Server</td>
                <td>${imapHost}</td>
            </tr>
            <tr>
                <td>Port</td>
                <td>${imapPort || 993}</td>
            </tr>
            <tr>
                <td>Security</td>
                <td>SSL/TLS</td>
            </tr>
            <tr>
                <td>Username</td>
                <td>${email}</td>
            </tr>
            <tr>
                <td>Password</td>
                <td>${tempPassword}</td>
            </tr>
        </table>

        <h3>Outgoing Mail (SMTP) Settings</h3>
        <table class="settings-table">
            <tr>
                <th>Setting</th>
                <th>Value</th>
            </tr>
            <tr>
                <td>Server</td>
                <td>${smtpHost}</td>
            </tr>
            <tr>
                <td>Port</td>
                <td>${smtpPort || 587}</td>
            </tr>
            <tr>
                <td>Security</td>
                <td>SSL/TLS</td>
            </tr>
            <tr>
                <td>Username</td>
                <td>${email}</td>
            </tr>
            <tr>
                <td>Password</td>
                <td>${tempPassword}</td>
            </tr>
        </table>
        `
            : ""
        }

        <h2>Need Help?</h2>
        <p>If you have any questions or need assistance setting up your email client, please contact your system administrator.</p>
    </div>

    <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>
    `;
  }

  /**
   * Test Resend connection
   */
  async testConnection(): Promise<boolean> {
    try {
      this.logger.log("Testing Resend connection...");

      // Try to send a test email to verify the connection
      const result = await this.resend.emails.send({
        from: "Team Klarnow <no-reply@klarnow.co.uk>",
        to: ["test@example.com"],
        subject: "Resend Test",
        html: "<p>This is a test email to verify Resend connection.</p>",
      });

      this.logger.log("Resend connection test successful");
      this.logger.log(`Test email ID: ${result.data?.id}`);
      return true;
    } catch (error) {
      this.logger.error("Resend connection test failed:", error.message);
      return false;
    }
  }

  /**
   * Send a test email to verify Resend configuration
   */
  async sendTestEmail(to: string): Promise<boolean> {
    try {
      const fromName =
        this.configService.get<string>("RESEND_FROM_NAME") || "Team Klarnow";
      const fromEmail =
        this.configService.get<string>("RESEND_FROM_EMAIL") ||
        "no-reply@klarnow.co.uk";

      this.logger.log(`Sending test email to: ${to}`);

      const result = await this.resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject: "Resend Test Email",
        html: `
          <h2>Resend Test Successful!</h2>
          <p>This is a test email to verify Resend configuration.</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        `,
      });

      this.logger.log(`Test email sent successfully to: ${to}`);
      this.logger.log(`Resend ID: ${result.data?.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send test email to ${to}:`, error.message);
      return false;
    }
  }
}
