import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MailboxesController } from "./mailboxes.controller";
import { CpanelService } from "./services/cpanel.service";
import { EmailService } from "./services/email.service";
import { ResendEmailService } from "./services/resend-email.service";
import { OnboardingService } from "./services/onboarding.service";

@Module({
  imports: [ConfigModule],
  controllers: [MailboxesController],
  providers: [
    CpanelService,
    EmailService,
    ResendEmailService,
    OnboardingService,
  ],
  exports: [CpanelService, EmailService, ResendEmailService, OnboardingService],
})
export class MailboxesModule {}
