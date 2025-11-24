import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { CpanelService } from '../mailboxes/services/cpanel.service';
import { EmailService } from '../mailboxes/services/email.service';

@Module({
  imports: [ConfigModule],
  controllers: [HealthController],
  providers: [CpanelService, EmailService],
})
export class HealthModule {}
