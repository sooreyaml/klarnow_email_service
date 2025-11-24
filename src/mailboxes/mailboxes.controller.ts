import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiBody,
} from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { CpanelService } from "./services/cpanel.service";
import { EmailService } from "./services/email.service";
import { ResendEmailService } from "./services/resend-email.service";
import { OnboardingService } from "./services/onboarding.service";
import { ApiKeyGuard } from "../common/guards/api-key.guard";
import { CreateMailboxDto } from "./dto/create-mailbox.dto";
import { BatchCreateMailboxDto } from "./dto/batch-create-mailbox.dto";
import {
  MailboxResponseDto,
  BatchMailboxResponseDto,
} from "./dto/mailbox-response.dto";
import {
  OnboardingEmailDto,
  OnboardingEmailResponseDto,
} from "./dto/onboarding-email.dto";
import {
  ResetPasswordDto,
  ResetPasswordResponseDto,
} from "./dto/reset-password.dto";

@ApiTags("mailboxes")
@Controller("mailboxes")
@UseGuards(ThrottlerGuard)
@ApiSecurity("api-key")
export class MailboxesController {
  private readonly logger = new Logger(MailboxesController.name);

  constructor(
    private readonly cpanelService: CpanelService,
    private readonly emailService: EmailService,
    private readonly resendEmailService: ResendEmailService,
    private readonly onboardingService: OnboardingService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: "Create a new mailbox" })
  @ApiBody({ type: CreateMailboxDto })
  @ApiResponse({
    status: 201,
    description: "Mailbox created successfully",
    type: MailboxResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - validation failed or cPanel error",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - invalid API key",
  })
  @ApiResponse({
    status: 429,
    description: "Too many requests - rate limit exceeded",
  })
  async createMailbox(
    @Body() createMailboxDto: CreateMailboxDto
  ): Promise<MailboxResponseDto> {
    const {
      mailbox,
      domain,
      recipient_email,
      display_name,
      quota_mb = 1024,
    } = createMailboxDto;
    const email = `${mailbox}@${domain}`;

    this.logger.log(`Creating mailbox: ${email}`);

    try {
      // Create mailbox via cPanel UAPI
      const { tempPassword } = await this.cpanelService.createMailbox(
        mailbox,
        domain,
        quota_mb
      );

      // Send welcome email using Resend (optional - don't fail if email sending fails)
      let emailSent = false;
      try {
        await this.resendEmailService.sendWelcomeEmail({
          email: `${mailbox}@${domain}`,
          recipient_email: recipient_email,
          tempPassword,
          quotaMb: quota_mb,
          displayName: display_name,
        });
        emailSent = true;
        this.logger.log(
          `Successfully sent welcome email via Resend to: ${recipient_email}`
        );
      } catch (emailError) {
        this.logger.warn(
          `Failed to send welcome email via Resend to ${recipient_email}:`,
          emailError.message
        );
        // Continue with mailbox creation even if email fails
      }

      this.logger.log(
        `Successfully created mailbox: ${email}${emailSent ? " (welcome email sent)" : " (welcome email failed)"}`
      );

      return {
        status: "created",
        email,
        quota_mb,
      };
    } catch (error) {
      this.logger.error(`Failed to create mailbox ${email}:`, error.message);
      throw error;
    }
  }

  @Post("batch")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: "Create multiple mailboxes in batch" })
  @ApiBody({ type: BatchCreateMailboxDto })
  @ApiResponse({
    status: 201,
    description: "Batch mailbox creation completed",
    type: BatchMailboxResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - validation failed",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - invalid API key",
  })
  @ApiResponse({
    status: 429,
    description: "Too many requests - rate limit exceeded",
  })
  async createMailboxesBatch(
    @Body() batchCreateDto: BatchCreateMailboxDto
  ): Promise<BatchMailboxResponseDto> {
    const { mailboxes } = batchCreateDto;
    const results: MailboxResponseDto[] = [];
    let successful = 0;
    let failed = 0;

    this.logger.log(
      `Processing batch creation of ${mailboxes.length} mailboxes`
    );

    for (const mailboxDto of mailboxes) {
      try {
        const result = await this.createMailbox(mailboxDto);
        results.push(result);
        successful++;
      } catch (error) {
        this.logger.error(
          `Failed to create mailbox ${mailboxDto.mailbox}@${mailboxDto.domain}:`,
          error.message
        );

        // Add error result
        results.push({
          status: "failed",
          email: `${mailboxDto.mailbox}@${mailboxDto.domain}`,
          quota_mb: mailboxDto.quota_mb || 1024,
        });
        failed++;
      }
    }

    this.logger.log(
      `Batch creation completed: ${successful} successful, ${failed} failed`
    );

    return {
      results,
      total: mailboxes.length,
      successful,
      failed,
    };
  }

  @Post("test-smtp")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: "Test email configuration (Resend)" })
  @ApiResponse({
    status: 200,
    description: "Email test completed",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - invalid API key",
  })
  async testSmtp(@Body() body: { testEmail: string }): Promise<{
    emailConnection: boolean;
    emailSent: boolean;
    message: string;
  }> {
    const { testEmail } = body;

    this.logger.log(`Testing email configuration with Resend: ${testEmail}`);

    // Test Resend connection
    const emailConnection = await this.resendEmailService.testConnection();

    let emailSent = false;
    let message = "";

    if (emailConnection) {
      // Test sending an email
      emailSent = await this.resendEmailService.sendTestEmail(testEmail);
      message = emailSent
        ? "Email configuration is working correctly"
        : "Email connection successful but email sending failed";
    } else {
      message =
        "Email connection failed - check your RESEND_API_KEY configuration";
    }

    return {
      emailConnection,
      emailSent,
      message,
    };
  }

  @Post("test-cpanel")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: "Test cPanel connection and credentials" })
  @ApiResponse({
    status: 200,
    description: "cPanel test completed",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - invalid API key",
  })
  async testCpanel(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    this.logger.log("Testing cPanel configuration...");

    const result = await this.cpanelService.testConnection();

    this.logger.log(`cPanel test result:`, result);

    return result;
  }

  @Post("check-mailbox")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: "Check if a mailbox exists" })
  @ApiResponse({
    status: 200,
    description: "Mailbox check completed",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - invalid API key",
  })
  async checkMailbox(@Body() body: { email: string }): Promise<{
    exists: boolean;
    email: string;
    message: string;
  }> {
    const { email } = body;

    this.logger.log(`Checking if mailbox exists: ${email}`);

    const exists = await this.cpanelService.checkMailboxExists(email);

    return {
      exists,
      email,
      message: exists ? "Mailbox exists" : "Mailbox does not exist",
    };
  }

  @Get("list")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: "List all existing mailboxes in cPanel" })
  @ApiResponse({
    status: 200,
    description: "Mailboxes listed successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - invalid API key",
  })
  async listMailboxes(): Promise<{
    mailboxes: string[];
    count: number;
    message: string;
  }> {
    this.logger.log("Listing all mailboxes...");

    const { mailboxes } = await this.cpanelService.listMailboxes();

    this.logger.log(`Found ${mailboxes.length} mailboxes`);

    return {
      mailboxes,
      count: mailboxes.length,
      message: `Found ${mailboxes.length} mailboxes`,
    };
  }

  @Post("onboarding-email")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: "Send Glaq onboarding welcome email to recipient" })
  @ApiBody({ type: OnboardingEmailDto })
  @ApiResponse({
    status: 200,
    description: "Onboarding email sent successfully",
    type: OnboardingEmailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - validation failed or email sending failed",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - invalid API key",
  })
  @ApiResponse({
    status: 429,
    description: "Too many requests - rate limit exceeded",
  })
  async sendOnboardingEmail(
    @Body() onboardingEmailDto: OnboardingEmailDto
  ): Promise<OnboardingEmailResponseDto> {
    const { recipient_email, recipient_name, company_name } =
      onboardingEmailDto;

    this.logger.log(`Sending onboarding email to: ${recipient_email}`);

    try {
      await this.onboardingService.sendOnboardingEmail({
        recipient_email,
        recipient_name,
        company_name,
      });

      this.logger.log(
        `Successfully sent onboarding email to: ${recipient_email}`
      );

      return {
        status: "sent",
        recipient_email,
        message: "Onboarding email sent successfully",
      };
    } catch (error) {
      this.logger.error(
        `Failed to send onboarding email to ${recipient_email}:`,
        error.message
      );
      throw error;
    }
  }

  @Post("test-onboarding-smtp")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: "Test onboarding email configuration (Resend)" })
  @ApiResponse({
    status: 200,
    description: "Onboarding email test completed",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - invalid API key",
  })
  async testOnboardingSmtp(@Body() body: { testEmail: string }): Promise<{
    emailConnection: boolean;
    emailSent: boolean;
    message: string;
  }> {
    const { testEmail } = body;

    this.logger.log(
      `Testing onboarding email configuration with Resend: ${testEmail}`
    );

    // Test Resend connection
    const emailConnection = await this.onboardingService.testConnection();

    let emailSent = false;
    let message = "";

    if (emailConnection) {
      // Test sending an onboarding email
      emailSent =
        await this.onboardingService.sendTestOnboardingEmail(testEmail);
      message = emailSent
        ? "Onboarding email configuration is working correctly"
        : "Onboarding email connection successful but email sending failed";
    } else {
      message =
        "Onboarding email connection failed - check your RESEND_API_KEY configuration";
    }

    return {
      emailConnection,
      emailSent,
      message,
    };
  }

  @Post("test-resend")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: "Test Resend email configuration" })
  @ApiResponse({
    status: 200,
    description: "Resend test completed",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - invalid API key",
  })
  async testResend(@Body() body: { testEmail: string }): Promise<{
    resendConnection: boolean;
    emailSent: boolean;
    message: string;
  }> {
    const { testEmail } = body;

    this.logger.log(`Testing Resend configuration with email: ${testEmail}`);

    // Test Resend connection
    const resendConnection = await this.resendEmailService.testConnection();

    let emailSent = false;
    let message = "";

    if (resendConnection) {
      // Test sending an email
      emailSent = await this.resendEmailService.sendTestEmail(testEmail);
      message = emailSent
        ? "Resend configuration is working correctly"
        : "Resend connection successful but email sending failed";
    } else {
      message =
        "Resend connection failed - check your RESEND_API_KEY configuration";
    }

    return {
      resendConnection,
      emailSent,
      message,
    };
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: "Reset password for an existing mailbox" })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: "Password reset successfully",
    type: ResetPasswordResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - validation failed or cPanel error",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - invalid API key",
  })
  @ApiResponse({
    status: 429,
    description: "Too many requests - rate limit exceeded",
  })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto
  ): Promise<ResetPasswordResponseDto> {
    const { email, new_password, recipient_email } = resetPasswordDto;

    this.logger.log(`Resetting password for mailbox: ${email}`);

    try {
      // Reset password via cPanel UAPI
      const { newPassword } = await this.cpanelService.resetPassword(
        email,
        new_password
      );

      // Send password reset notification email using Resend (optional - don't fail if email sending fails)
      let emailSent = false;
      const finalRecipientEmail = recipient_email || email;

      try {
        await this.resendEmailService.sendPasswordResetEmail({
          email,
          recipient_email: finalRecipientEmail,
          newPassword,
        });
        emailSent = true;
        this.logger.log(
          `Successfully sent password reset email via Resend to: ${finalRecipientEmail}`
        );
      } catch (emailError) {
        this.logger.warn(
          `Failed to send password reset email via Resend to ${finalRecipientEmail}:`,
          emailError.message
        );
        // Continue with password reset even if email fails
      }

      this.logger.log(
        `Successfully reset password for mailbox: ${email}${emailSent ? " (notification email sent)" : " (notification email failed)"}`
      );

      const response: ResetPasswordResponseDto = {
        status: "success",
        email,
        message: "Password reset successfully",
      };

      // Only include the new password in response if no recipient email was provided
      // (meaning the user expects to receive it in the API response)
      if (!recipient_email) {
        response.new_password = newPassword;
      }

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to reset password for mailbox ${email}:`,
        error.message
      );
      throw error;
    }
  }
}
