import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface OnboardingEmailData {
  recipient_email: string;
  recipient_name?: string;
  company_name?: string;
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);
  private resend: Resend;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    
    if (!apiKey) {
      throw new Error('Missing required RESEND_API_KEY configuration');
    }

    this.resend = new Resend(apiKey);
    this.logger.log('Onboarding service initialized with Resend');
  }

  /**
   * Send Glaq onboarding welcome email
   */
  async sendOnboardingEmail(data: OnboardingEmailData): Promise<void> {
    const {
      recipient_email,
      recipient_name = 'Valued Customer',
      company_name = 'Your Company',
    } = data;

    const fromName = this.configService.get<string>('RESEND_FROM_NAME') || 'Team Klarnow';
    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'no-reply@klarnow.co.uk';
    const glaqWebsite = this.configService.get<string>('GLAQ_WEBSITE') || 'https://glacq.com';
    const supportEmail = this.configService.get<string>('GLAQ_SUPPORT_EMAIL') || 'support@glacq.com';

    const htmlContent = this.generateOnboardingEmailHtml({
      recipient_name,
      company_name,
      glaqWebsite,
      supportEmail,
    });

    try {
      this.logger.log(`Sending onboarding email to: ${recipient_email}`);
      
      const result = await this.resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [recipient_email],
        subject: `Welcome to Glacq! Let's get you started 🚀`,
        html: htmlContent,
      });

      this.logger.log(`Onboarding email sent successfully to: ${recipient_email}`);
      this.logger.log(`Resend ID: ${result.data?.id}`);
    } catch (error) {
      this.logger.error(`Failed to send onboarding email to ${recipient_email}:`, error.message);
      throw new BadRequestException(`Failed to send onboarding email: ${error.message}`);
    }
  }

  /**
   * Generate HTML content for Glaq onboarding email
   */
  private generateOnboardingEmailHtml(data: {
    recipient_name: string;
    company_name: string;
    glaqWebsite: string;
    supportEmail: string;
  }): string {
    const {
      recipient_name,
      company_name,
      glaqWebsite,
      supportEmail,
    } = data;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Glacq!</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .container {
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 700;
        }
        .header p {
            margin: 10px 0 0 0;
            font-size: 1.2em;
            opacity: 0.9;
        }
        .content {
            padding: 40px 30px;
        }
        .welcome-section {
            text-align: center;
            margin-bottom: 30px;
        }
        .welcome-section h2 {
            color: #2d3748;
            font-size: 1.8em;
            margin-bottom: 15px;
        }
        .welcome-section p {
            color: #4a5568;
            font-size: 1.1em;
            margin-bottom: 20px;
        }
        .features {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 30px 0;
        }
        .feature {
            text-align: center;
            padding: 20px;
            background-color: #f7fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }
        .feature-icon {
            font-size: 2em;
            margin-bottom: 10px;
        }
        .feature h3 {
            color: #2d3748;
            margin: 10px 0 5px 0;
            font-size: 1.1em;
        }
        .feature p {
            color: #4a5568;
            font-size: 0.9em;
            margin: 0;
        }
        .cta-section {
            text-align: center;
            margin: 40px 0;
            padding: 30px;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            border-radius: 12px;
            color: white;
        }
        .cta-section h3 {
            margin: 0 0 15px 0;
            font-size: 1.5em;
        }
        .cta-section p {
            margin: 0 0 20px 0;
            opacity: 0.9;
        }
        .button {
            display: inline-block;
            background-color: #ffffff;
            color: #667eea;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 1.1em;
            transition: transform 0.2s ease;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .button:hover {
            transform: translateY(-2px);
        }
        .steps {
            margin: 30px 0;
        }
        .step {
            display: flex;
            align-items: flex-start;
            margin: 20px 0;
            padding: 20px;
            background-color: #f7fafc;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .step-number {
            background-color: #667eea;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-right: 15px;
            flex-shrink: 0;
        }
        .step-content h4 {
            margin: 0 0 5px 0;
            color: #2d3748;
        }
        .step-content p {
            margin: 0;
            color: #4a5568;
        }
        .footer {
            background-color: #2d3748;
            color: white;
            padding: 30px;
            text-align: center;
        }
        .footer p {
            margin: 5px 0;
            opacity: 0.8;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        .social-links {
            margin: 20px 0;
        }
        .social-links a {
            display: inline-block;
            margin: 0 10px;
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }
        @media (max-width: 600px) {
            .features {
                grid-template-columns: 1fr;
            }
            .header h1 {
                font-size: 2em;
            }
            .content {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header" style="background: #f8fafc; color: #2d3748;">
            <h1 style="color: #2d3748;">🚀 Welcome to Glacq!</h1>
            <p style="color: #4a5568;">You own your business. Now own your platform.</p>
        </div>

        <div class="content">
            <div class="welcome-section">
                <h2>Hello ${recipient_name}!</h2>
                <p>Welcome to Glacq! We're excited to have <strong>${company_name}</strong> join our community of independent businesses.</p>
            </div>

            <div class="features">
                <div class="feature">
                    <div class="feature-icon">🛠️</div>
                    <h3>Own the code</h3>
                    <p>You own everything. No platform lock-in.</p>
                </div>
                <div class="feature">
                    <div class="feature-icon">💸</div>
                    <h3>£0/mo platform fee</h3>
                    <p>One payment. No monthly subscriptions.</p>
                </div>
                <div class="feature">
                    <div class="feature-icon">📊</div>
                    <h3>Simple dashboard</h3>
                    <p>Update products in minutes, not hours.</p>
                </div>
                <div class="feature">
                    <div class="feature-icon">💳</div>
                    <h3>Stripe with Apple/Google Pay</h3>
                    <p>Modern payment methods built-in.</p>
                </div>
                <div class="feature">
                    <div class="feature-icon">⚡</div>
                    <h3>SEO &amp; speed baked in</h3>
                    <p>Fast loading, search engine ready.</p>
                </div>
            </div>

            <div style="text-align: center; margin: 40px 0; padding: 20px; background-color: #f7fafc; border-radius: 8px;">
                <h3 style="color: #2d3748; margin-bottom: 15px;">Need Help?</h3>
                <p style="color: #4a5568; margin-bottom: 15px;">Our support team is here to help you every step of the way</p>
                <p style="margin: 0;">
                    <strong>Email:</strong> <a href="mailto:${supportEmail}" style="color: #667eea;">${supportEmail}</a> | 
                    <strong>Website:</strong> <a href="${glaqWebsite}" style="color: #667eea;">${glaqWebsite}</a>
                </p>
            </div>
        </div>

        <div class="footer">
            <p><strong>Welcome to Glacq!</strong></p>
            <p>Thank you for choosing Glacq to power your business</p>
            <div class="social-links">
                <a href="${glaqWebsite}">Website</a>
                <a href="mailto:${supportEmail}">Support</a>
            </div>
            <p style="font-size: 0.9em; margin-top: 20px;">
                This is an automated message. Please do not reply to this email.
            </p>
            <p style="font-size: 0.8em;">
                Generated on ${new Date().toLocaleString()}
            </p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Test Resend connection for onboarding service
   */
  async testConnection(): Promise<boolean> {
    try {
      this.logger.log('Testing Resend connection for onboarding service...');
      
      // Try to send a test email to verify the connection
      const result = await this.resend.emails.send({
        from: 'Team Klarnow <no-reply@klarnow.co.uk>',
        to: ['test@example.com'],
        subject: 'Resend Test',
        html: '<p>This is a test email to verify Resend connection.</p>',
      });

      this.logger.log('Resend connection test successful');
      this.logger.log(`Test email ID: ${result.data?.id}`);
      return true;
    } catch (error) {
      this.logger.error('Resend connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Send a test onboarding email to verify configuration
   */
  async sendTestOnboardingEmail(to: string): Promise<boolean> {
    try {
      const fromName = this.configService.get<string>('RESEND_FROM_NAME') || 'Team Klarnow';
      const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'no-reply@klarnow.co.uk';

      this.logger.log(`Sending test onboarding email to: ${to}`);
      
      const result = await this.resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject: 'Glacq Onboarding Test Email',
        html: `
          <h2>Glacq Onboarding Test Successful!</h2>
          <p>This is a test email to verify the onboarding email configuration.</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        `,
      });

      this.logger.log(`Test onboarding email sent successfully to: ${to}`);
      this.logger.log(`Resend ID: ${result.data?.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send test onboarding email to ${to}:`, error.message);
      return false;
    }
  }
}
