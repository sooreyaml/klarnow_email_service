import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CpanelService } from '../mailboxes/services/cpanel.service';
import { EmailService } from '../mailboxes/services/email.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly cpanelService: CpanelService,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2023-12-01T10:00:00.000Z' },
        services: {
          type: 'object',
          properties: {
            cpanel: { type: 'boolean', example: true },
            smtp: { type: 'boolean', example: true },
          },
        },
      },
    },
  })
  async getHealth() {
    const timestamp = new Date().toISOString();
    
    // Test service connections
    const [cpanelStatus, smtpStatus] = await Promise.allSettled([
      this.cpanelService.testConnection(),
      this.emailService.testConnection(),
    ]);

    return {
      status: 'ok',
      timestamp,
      services: {
        cpanel: cpanelStatus.status === 'fulfilled' ? cpanelStatus.value : false,
        smtp: smtpStatus.status === 'fulfilled' ? smtpStatus.value : false,
      },
    };
  }
}
