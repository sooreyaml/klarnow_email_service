import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosResponse } from "axios";

export interface CpanelMailboxResponse {
  status: number;
  messages?: string[];
  data?: any;
  errors?: string[];
  warnings?: string[];
  metadata?: any;
}

@Injectable()
export class CpanelService {
  private readonly logger = new Logger(CpanelService.name);
  private readonly cpanelHost: string;
  private readonly cpanelUser: string;
  private readonly cpanelApiToken: string;

  constructor(private configService: ConfigService) {
    this.cpanelHost = this.configService.get<string>("CPANEL_HOST");
    this.cpanelUser = this.configService.get<string>("CPANEL_USER");
    this.cpanelApiToken = this.configService.get<string>("CPANEL_API_TOKEN");

    if (!this.cpanelHost || !this.cpanelUser || !this.cpanelApiToken) {
      throw new Error("Missing required cPanel configuration");
    }

    // Sanitize and validate the cPanel host
    this.cpanelHost = this.sanitizeHost(this.cpanelHost);
  }

  /**
   * Sanitize and validate cPanel host URL
   */
  private sanitizeHost(host: string): string {
    // Remove protocol if present
    let cleanHost = host.replace(/^https?:\/\//, "");

    // Remove trailing slash
    cleanHost = cleanHost.replace(/\/$/, "");

    // Validate that it looks like a hostname (with optional port)
    // Allow hostnames like: example.com, subdomain.example.com, example.com:2083
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?$/.test(cleanHost)) {
      throw new Error(
        `Invalid cPanel host format: ${host}. Expected format: example.com or subdomain.example.com or example.com:2083`
      );
    }

    return cleanHost;
  }

  /**
   * Extract error message from cPanel API response
   */
  private extractErrorMessage(response: CpanelMailboxResponse): string {
    // Priority: errors array > messages array > default message
    if (response.errors && response.errors.length > 0) {
      return response.errors.join(", ");
    }

    if (response.messages && response.messages.length > 0) {
      return response.messages.join(", ");
    }

    return "Unknown cPanel error";
  }

  /**
   * Enhance domain-related error messages with helpful suggestions
   */
  private enhanceDomainError(
    errorMessage: string,
    email: string,
    domain: string
  ): string {
    // Check if the error mentions a different domain than what was requested
    const domainMismatchPattern = /"([^"]+@[^"]+)"/;
    const match = errorMessage.match(domainMismatchPattern);

    if (match && match[1]) {
      const mentionedEmail = match[1];
      const [mentionedMailbox, mentionedDomain] = mentionedEmail.split("@");

      // If the mentioned domain is different from the requested domain
      if (mentionedDomain && mentionedDomain !== domain) {
        return `${errorMessage} 

Possible solutions:
1. The mailbox may have been created with a different domain (${mentionedDomain} instead of ${domain})
2. Try using the correct domain: ${mentionedEmail}
3. Check if there's a domain mapping or alias configured in cPanel
4. Verify the mailbox exists by checking the cPanel email accounts list

Requested: ${email}
Found in error: ${mentionedEmail}`;
      }
    }

    // Check for common domain-related issues
    if (
      errorMessage.includes("email account named") &&
      errorMessage.includes("not found")
    ) {
      return `${errorMessage}

Troubleshooting steps:
1. Verify the mailbox exists in cPanel
2. Check the exact spelling of the email address
3. Ensure the domain is correctly configured in cPanel
4. Try listing all email accounts to see available mailboxes`;
    }

    return errorMessage;
  }

  /**
   * Generate a strong temporary password that meets cPanel requirements
   * cPanel requires: 8-20 characters, at least one uppercase, one lowercase, one number
   */
  private generateTempPassword(): string {
    // cPanel password requirements: 8-20 chars, at least 1 uppercase, 1 lowercase, 1 number
    const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lowercase = "abcdefghijkmnpqrstuvwxyz";
    const numbers = "23456789";
    const symbols = "!@#$%^&*";

    let password = "";

    // Ensure at least one of each required character type
    password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    password += symbols.charAt(Math.floor(Math.random() * symbols.length));

    // Fill remaining length (6 more chars) to make it exactly 10 characters
    const allChars = uppercase + lowercase + numbers + symbols;
    const remainingLength = 6; // 6 more chars to make total 10

    for (let i = 0; i < remainingLength; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }

    // Shuffle the password to avoid predictable patterns
    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  }

  /**
   * Create a mailbox using cPanel UAPI
   */
  async createMailbox(
    mailbox: string,
    domain: string,
    quotaMb: number
  ): Promise<{ tempPassword: string; response: CpanelMailboxResponse }> {
    const tempPassword = this.generateTempPassword();
    const email = `${mailbox}@${domain}`;

    const url = `https://${this.cpanelHost}/execute/Email/add_pop`;
    const params = {
      email,
      domain,
      password: tempPassword,
      quota: quotaMb,
    };

    const headers = {
      Authorization: `cpanel ${this.cpanelUser}:${this.cpanelApiToken}`,
      Accept: "application/json",
    };

    try {
      this.logger.log(`Creating mailbox: ${email} with quota: ${quotaMb}MB`);
      this.logger.log(`cPanel configuration:`);
      this.logger.log(`  Host: ${this.cpanelHost}`);
      this.logger.log(`  User: ${this.cpanelUser}`);
      this.logger.log(`  API Token: ${this.cpanelApiToken.substring(0, 8)}...`);
      this.logger.log(`  Generated password length: ${tempPassword.length}`);
      this.logger.log(
        `  Generated password (first 4 chars): ${tempPassword.substring(0, 4)}...`
      );
      this.logger.log(`  URL: ${url}`);

      const response: AxiosResponse<CpanelMailboxResponse> = await axios.get(
        url,
        {
          params,
          headers,
          timeout: 30000, // 30 seconds timeout
          // Ensure proper URL encoding of parameters
          paramsSerializer: (params) => {
            const searchParams = new URLSearchParams();
            Object.keys(params).forEach((key) => {
              searchParams.append(key, params[key]);
            });
            return searchParams.toString();
          },
        }
      );

      this.logger.log(
        `cPanel API response for ${email}:`,
        JSON.stringify(response.data, null, 2)
      );

      // cPanel API returns status 1 for success, 0 for error
      if (response.data.status !== 1) {
        // Extract error message from errors array first, then messages array
        const errorMessage = this.extractErrorMessage(response.data);
        this.logger.error(`Failed to create mailbox ${email}: ${errorMessage}`);
        this.logger.error(
          `Full cPanel response:`,
          JSON.stringify(response.data, null, 2)
        );
        throw new BadRequestException(`cPanel error: ${errorMessage}`);
      }

      this.logger.log(`Successfully created mailbox: ${email}`);

      return {
        tempPassword,
        response: response.data,
      };
    } catch (error) {
      this.logger.error(`Error creating mailbox ${email}:`, error.message);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        // Log detailed error information
        this.logger.error(`Axios error details:`);
        this.logger.error(`  Code: ${error.code}`);
        this.logger.error(`  Status: ${error.response?.status}`);
        this.logger.error(`  Status Text: ${error.response?.statusText}`);
        this.logger.error(`  Response Data:`, error.response?.data);

        // Handle DNS resolution errors
        if (
          error.code === "ENOTFOUND" ||
          error.message.includes("getaddrinfo ENOTFOUND")
        ) {
          throw new BadRequestException(
            `cPanel API error: Unable to resolve hostname '${this.cpanelHost}'. Please check your CPANEL_HOST configuration.`
          );
        }

        // Handle connection timeout
        if (
          error.code === "ECONNABORTED" ||
          error.message.includes("timeout")
        ) {
          throw new BadRequestException(
            `cPanel API error: Connection timeout. Please check if the cPanel server is accessible.`
          );
        }

        // Handle connection refused
        if (error.code === "ECONNREFUSED") {
          throw new BadRequestException(
            `cPanel API error: Connection refused. Please check if the cPanel server is running and accessible on port 2083.`
          );
        }

        // Handle authentication errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new BadRequestException(
            `cPanel API error: Authentication failed. Please check your CPANEL_USER and CPANEL_API_TOKEN configuration.`
          );
        }

        const errorMessage = error.response?.data
          ? this.extractErrorMessage(error.response.data)
          : error.message;
        throw new BadRequestException(`cPanel API error: ${errorMessage}`);
      }

      throw new BadRequestException(
        `Failed to create mailbox: ${error.message}`
      );
    }
  }

  /**
   * Check if a mailbox exists by listing all mailboxes
   */
  async checkMailboxExists(email: string): Promise<boolean> {
    try {
      const url = `https://${this.cpanelHost}/execute/Email/list_pops`;
      const headers = {
        Authorization: `cpanel ${this.cpanelUser}:${this.cpanelApiToken}`,
        Accept: "application/json",
      };

      const response: AxiosResponse<CpanelMailboxResponse> = await axios.get(
        url,
        {
          headers,
          timeout: 30000,
        }
      );

      if (response.data.status === 1 && response.data.data) {
        const mailboxes = response.data.data;
        const exists = mailboxes.some((mb: any) => mb.email === email);
        this.logger.log(`Mailbox ${email} exists: ${exists}`);
        return exists;
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Error checking if mailbox ${email} exists:`,
        error.message
      );
      return false;
    }
  }

  /**
   * Reset password for an existing mailbox using cPanel UAPI
   */
  async resetPassword(
    email: string,
    newPassword?: string
  ): Promise<{ newPassword: string; response: CpanelMailboxResponse }> {
    const finalPassword = newPassword || this.generateTempPassword();

    // Extract mailbox and domain from email
    const [mailbox, domain] = email.split("@");
    if (!mailbox || !domain) {
      throw new BadRequestException(
        "Invalid email format. Expected format: mailbox@domain.com"
      );
    }

    // First check if the mailbox exists
    const mailboxExists = await this.checkMailboxExists(email);
    if (!mailboxExists) {
      throw new BadRequestException(
        `Mailbox ${email} does not exist. Please verify the email address and try again.`
      );
    }

    // Try different cPanel UAPI endpoints for password reset
    // First try the standard passwd_pop endpoint
    let url = `https://${this.cpanelHost}/execute/Email/passwd_pop`;
    let params = {
      email,
      password: finalPassword,
      // Try including domain parameter like in createMailbox
      domain: domain,
    };

    // Alternative: try the change_password endpoint if passwd_pop fails
    // const url = `https://${this.cpanelHost}/execute/Email/change_password`;
    // const params = {
    //   email,
    //   password: finalPassword,
    // };

    const headers = {
      Authorization: `cpanel ${this.cpanelUser}:${this.cpanelApiToken}`,
      Accept: "application/json",
    };

    try {
      this.logger.log(`Resetting password for mailbox: ${email}`);
      this.logger.log(`cPanel configuration:`);
      this.logger.log(`  Host: ${this.cpanelHost}`);
      this.logger.log(`  User: ${this.cpanelUser}`);
      this.logger.log(`  API Token: ${this.cpanelApiToken.substring(0, 8)}...`);
      this.logger.log(`  New password length: ${finalPassword.length}`);
      this.logger.log(
        `  New password (first 4 chars): ${finalPassword.substring(0, 4)}...`
      );
      this.logger.log(`  URL: ${url}`);

      const response: AxiosResponse<CpanelMailboxResponse> = await axios.get(
        url,
        {
          params,
          headers,
          timeout: 30000, // 30 seconds timeout
          // Ensure proper URL encoding of parameters
          paramsSerializer: (params) => {
            const searchParams = new URLSearchParams();
            Object.keys(params).forEach((key) => {
              searchParams.append(key, params[key]);
            });
            return searchParams.toString();
          },
        }
      );

      this.logger.log(
        `cPanel API response for password reset ${email}:`,
        JSON.stringify(response.data, null, 2)
      );

      // cPanel API returns status 1 for success, 0 for error
      if (response.data.status !== 1) {
        // Extract error message from errors array first, then messages array
        const errorMessage = this.extractErrorMessage(response.data);
        this.logger.error(
          `Failed to reset password for mailbox ${email}: ${errorMessage}`
        );
        this.logger.error(
          `Full cPanel response:`,
          JSON.stringify(response.data, null, 2)
        );

        // Enhanced error handling for domain-related issues
        const enhancedErrorMessage = this.enhanceDomainError(
          errorMessage,
          email,
          domain
        );
        throw new BadRequestException(`cPanel error: ${enhancedErrorMessage}`);
      }

      this.logger.log(`Successfully reset password for mailbox: ${email}`);

      return {
        newPassword: finalPassword,
        response: response.data,
      };
    } catch (error) {
      this.logger.error(
        `Error resetting password for mailbox ${email}:`,
        error.message
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        // Log detailed error information
        this.logger.error(`Axios error details:`);
        this.logger.error(`  Code: ${error.code}`);
        this.logger.error(`  Status: ${error.response?.status}`);
        this.logger.error(`  Status Text: ${error.response?.statusText}`);
        this.logger.error(`  Response Data:`, error.response?.data);

        // Handle DNS resolution errors
        if (
          error.code === "ENOTFOUND" ||
          error.message.includes("getaddrinfo ENOTFOUND")
        ) {
          throw new BadRequestException(
            `cPanel API error: Unable to resolve hostname '${this.cpanelHost}'. Please check your CPANEL_HOST configuration.`
          );
        }

        // Handle connection timeout
        if (
          error.code === "ECONNABORTED" ||
          error.message.includes("timeout")
        ) {
          throw new BadRequestException(
            `cPanel API error: Connection timeout. Please check if the cPanel server is accessible.`
          );
        }

        // Handle connection refused
        if (error.code === "ECONNREFUSED") {
          throw new BadRequestException(
            `cPanel API error: Connection refused. Please check if the cPanel server is running and accessible on port 2083.`
          );
        }

        // Handle authentication errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new BadRequestException(
            `cPanel API error: Authentication failed. Please check your CPANEL_USER and CPANEL_API_TOKEN configuration.`
          );
        }

        const errorMessage = error.response?.data
          ? this.extractErrorMessage(error.response.data)
          : error.message;
        throw new BadRequestException(`cPanel API error: ${errorMessage}`);
      }

      throw new BadRequestException(
        `Failed to reset password: ${error.message}`
      );
    }
  }

  /**
   * List all existing mailboxes in cPanel
   */
  async listMailboxes(): Promise<{
    mailboxes: string[];
    response: CpanelMailboxResponse;
  }> {
    const url = `https://${this.cpanelHost}/execute/Email/list_pops`;
    const headers = {
      Authorization: `cpanel ${this.cpanelUser}:${this.cpanelApiToken}`,
      Accept: "application/json",
    };

    try {
      this.logger.log(`Listing all mailboxes`);
      this.logger.log(`cPanel configuration:`);
      this.logger.log(`  Host: ${this.cpanelHost}`);
      this.logger.log(`  User: ${this.cpanelUser}`);
      this.logger.log(`  API Token: ${this.cpanelApiToken.substring(0, 8)}...`);
      this.logger.log(`  URL: ${url}`);

      const response: AxiosResponse<CpanelMailboxResponse> = await axios.get(
        url,
        {
          headers,
          timeout: 30000, // 30 seconds timeout
        }
      );

      this.logger.log(
        `cPanel API response for list mailboxes:`,
        JSON.stringify(response.data, null, 2)
      );

      // cPanel API returns status 1 for success, 0 for error
      if (response.data.status !== 1) {
        const errorMessage = this.extractErrorMessage(response.data);
        this.logger.error(`Failed to list mailboxes: ${errorMessage}`);
        this.logger.error(
          `Full cPanel response:`,
          JSON.stringify(response.data, null, 2)
        );
        throw new BadRequestException(`cPanel error: ${errorMessage}`);
      }

      // Extract mailbox emails from the response data
      const mailboxes: string[] = [];
      if (response.data.data && Array.isArray(response.data.data)) {
        response.data.data.forEach((mailbox: any) => {
          if (mailbox.email) {
            mailboxes.push(mailbox.email);
          }
        });
      }

      this.logger.log(`Successfully listed ${mailboxes.length} mailboxes`);

      return {
        mailboxes,
        response: response.data,
      };
    } catch (error) {
      this.logger.error(`Error listing mailboxes:`, error.message);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        // Log detailed error information
        this.logger.error(`Axios error details:`);
        this.logger.error(`  Code: ${error.code}`);
        this.logger.error(`  Status: ${error.response?.status}`);
        this.logger.error(`  Status Text: ${error.response?.statusText}`);
        this.logger.error(`  Response Data:`, error.response?.data);

        // Handle DNS resolution errors
        if (
          error.code === "ENOTFOUND" ||
          error.message.includes("getaddrinfo ENOTFOUND")
        ) {
          throw new BadRequestException(
            `cPanel API error: Unable to resolve hostname '${this.cpanelHost}'. Please check your CPANEL_HOST configuration.`
          );
        }

        // Handle connection timeout
        if (
          error.code === "ECONNABORTED" ||
          error.message.includes("timeout")
        ) {
          throw new BadRequestException(
            `cPanel API error: Connection timeout. Please check if the cPanel server is accessible.`
          );
        }

        // Handle connection refused
        if (error.code === "ECONNREFUSED") {
          throw new BadRequestException(
            `cPanel API error: Connection refused. Please check if the cPanel server is running and accessible on port 2083.`
          );
        }

        // Handle authentication errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new BadRequestException(
            `cPanel API error: Authentication failed. Please check your CPANEL_USER and CPANEL_API_TOKEN configuration.`
          );
        }

        const errorMessage = error.response?.data
          ? this.extractErrorMessage(error.response.data)
          : error.message;
        throw new BadRequestException(`cPanel API error: ${errorMessage}`);
      }

      throw new BadRequestException(
        `Failed to list mailboxes: ${error.message}`
      );
    }
  }

  /**
   * Test cPanel connection and validate credentials
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      this.logger.log("Testing cPanel connection...");
      this.logger.log(`cPanel configuration:`);
      this.logger.log(`  Host: ${this.cpanelHost}`);
      this.logger.log(`  User: ${this.cpanelUser}`);
      this.logger.log(`  API Token: ${this.cpanelApiToken.substring(0, 8)}...`);

      const url = `https://${this.cpanelHost}/execute/Email/list_pops`;
      const headers = {
        Authorization: `cpanel ${this.cpanelUser}:${this.cpanelApiToken}`,
        Accept: "application/json",
      };

      this.logger.log(`Testing URL: ${url}`);

      const response = await axios.get(url, {
        headers,
        timeout: 10000,
        // Ensure proper URL encoding of parameters
        paramsSerializer: (params) => {
          const searchParams = new URLSearchParams();
          Object.keys(params || {}).forEach((key) => {
            searchParams.append(key, params[key]);
          });
          return searchParams.toString();
        },
      });

      this.logger.log(
        `cPanel test response:`,
        JSON.stringify(response.data, null, 2)
      );

      if (response.data.status === 1) {
        this.logger.log("cPanel connection test successful");
        return {
          success: true,
          message: "cPanel connection successful",
          details: response.data,
        };
      } else {
        const errorMessage = this.extractErrorMessage(response.data);
        this.logger.error(`cPanel connection test failed: ${errorMessage}`);
        return {
          success: false,
          message: `cPanel API error: ${errorMessage}`,
          details: response.data,
        };
      }
    } catch (error) {
      let errorMessage = "Unknown error";
      let details = null;

      if (axios.isAxiosError(error)) {
        details = {
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data,
        };

        if (
          error.code === "ENOTFOUND" ||
          error.message.includes("getaddrinfo ENOTFOUND")
        ) {
          errorMessage = `Unable to resolve hostname '${this.cpanelHost}'. Please check your CPANEL_HOST configuration.`;
        } else if (
          error.code === "ECONNABORTED" ||
          error.message.includes("timeout")
        ) {
          errorMessage =
            "Connection timeout. Please check if the cPanel server is accessible.";
        } else if (error.code === "ECONNREFUSED") {
          errorMessage =
            "Connection refused. Please check if the cPanel server is running and accessible on port 2083.";
        } else if (
          error.response?.status === 401 ||
          error.response?.status === 403
        ) {
          errorMessage =
            "Authentication failed. Please check your CPANEL_USER and CPANEL_API_TOKEN configuration.";
        } else {
          errorMessage = error.response?.data
            ? this.extractErrorMessage(error.response.data)
            : error.message;
        }

        this.logger.error(`cPanel connection test failed: ${errorMessage}`);
        this.logger.error(`Error details:`, details);
      } else {
        errorMessage = error.message;
        this.logger.error("cPanel connection test failed:", error.message);
      }

      return {
        success: false,
        message: `cPanel connection test failed: ${errorMessage}`,
        details,
      };
    }
  }
}
