const nodemailer = require('nodemailer');
const User = require('../models/User');

/**
 * Email service for TaktMate authentication system
 * Handles email verification, password reset, and notification emails
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.fromEmail = process.env.EMAIL_USER || 'noreply@taktmate.com';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter based on environment configuration
   */
  initializeTransporter() {
    try {
      const emailService = process.env.EMAIL_SERVICE || 'gmail';
      
      if (emailService === 'gmail') {
        // Gmail configuration
        this.transporter = nodemailer.createTransporter({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD // App-specific password
          }
        });
      } else if (emailService === 'smtp') {
        // Custom SMTP configuration
        this.transporter = nodemailer.createTransporter({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
          }
        });
      } else if (emailService === 'sendgrid') {
        // SendGrid configuration
        this.transporter = nodemailer.createTransporter({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
          }
        });
      } else {
        // Development mode - log emails to console
        console.warn('⚠️  No email service configured. Emails will be logged to console.');
        this.transporter = nodemailer.createTransporter({
          streamTransport: true,
          newline: 'unix',
          buffer: true
        });
      }
      
      console.log(`📧 Email service initialized: ${emailService}`);
      
    } catch (error) {
      console.error('❌ Email service initialization failed:', error);
      // Fallback to console logging
      this.transporter = nodemailer.createTransporter({
        streamTransport: true,
        newline: 'unix',
        buffer: true
      });
    }
  }

  /**
   * Test email service connectivity
   */
  async testConnection() {
    try {
      if (this.transporter.options.streamTransport) {
        console.log('✅ Email service test: Console logging mode (development)');
        return { success: true, mode: 'console' };
      }
      
      await this.transporter.verify();
      console.log('✅ Email service connection verified');
      return { success: true, mode: 'smtp' };
      
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email verification email
   */
  async sendEmailVerification(user) {
    try {
      if (!user.email_verification_token) {
        throw new Error('User does not have an email verification token');
      }

      const verificationUrl = `${this.frontendUrl}/auth/verify-email?token=${user.email_verification_token}`;
      
      const mailOptions = {
        from: {
          name: 'TaktMate',
          address: this.fromEmail
        },
        to: user.email,
        subject: 'Verify your TaktMate account',
        html: this.generateEmailVerificationHTML(user, verificationUrl),
        text: this.generateEmailVerificationText(user, verificationUrl)
      };

      const result = await this.sendEmail(mailOptions);
      
      // Log email sent
      await User.logAuditEvent(user.id, 'verification_email_sent', 'Users', null, {
        email: user.email,
        verification_token: user.email_verification_token
      });

      return result;

    } catch (error) {
      console.error('Email verification send error:', error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(user, resetToken) {
    try {
      const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${resetToken}`;
      
      const mailOptions = {
        from: {
          name: 'TaktMate',
          address: this.fromEmail
        },
        to: user.email,
        subject: 'Reset your TaktMate password',
        html: this.generatePasswordResetHTML(user, resetUrl),
        text: this.generatePasswordResetText(user, resetUrl)
      };

      const result = await this.sendEmail(mailOptions);
      
      // Log email sent
      await User.logAuditEvent(user.id, 'password_reset_email_sent', 'Users', null, {
        email: user.email
      });

      return result;

    } catch (error) {
      console.error('Password reset email send error:', error);
      throw error;
    }
  }

  /**
   * Send welcome email after email verification
   */
  async sendWelcomeEmail(user) {
    try {
      const dashboardUrl = `${this.frontendUrl}/dashboard`;
      
      const mailOptions = {
        from: {
          name: 'TaktMate',
          address: this.fromEmail
        },
        to: user.email,
        subject: 'Welcome to TaktMate!',
        html: this.generateWelcomeHTML(user, dashboardUrl),
        text: this.generateWelcomeText(user, dashboardUrl)
      };

      const result = await this.sendEmail(mailOptions);
      
      // Log email sent
      await User.logAuditEvent(user.id, 'welcome_email_sent', 'Users', null, {
        email: user.email
      });

      return result;

    } catch (error) {
      console.error('Welcome email send error:', error);
      throw error;
    }
  }

  /**
   * Send email using configured transporter
   */
  async sendEmail(mailOptions) {
    try {
      if (this.transporter.options.streamTransport) {
        // Development mode - log to console
        console.log('📧 Email (Development Mode):');
        console.log('   To:', mailOptions.to);
        console.log('   Subject:', mailOptions.subject);
        console.log('   Content:', mailOptions.text);
        console.log('');
        
        return { 
          success: true, 
          mode: 'console',
          messageId: `dev-${Date.now()}` 
        };
      }

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`📧 Email sent successfully to ${mailOptions.to}`);
      console.log(`   Message ID: ${info.messageId}`);
      
      return { 
        success: true, 
        mode: 'smtp',
        messageId: info.messageId,
        response: info.response 
      };

    } catch (error) {
      console.error('❌ Email send failed:', error);
      throw error;
    }
  }

  /**
   * Generate HTML email verification template
   */
  generateEmailVerificationHTML(user, verificationUrl) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify your TaktMate account</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to TaktMate!</h1>
    </div>
    <div class="content">
        <h2>Hello ${user.name},</h2>
        <p>Thank you for signing up for TaktMate! To complete your registration and start analyzing your CSV data with AI, please verify your email address.</p>
        
        <p>Click the button below to verify your email:</p>
        <a href="${verificationUrl}" class="button">Verify Email Address</a>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px;">${verificationUrl}</p>
        
        <p><strong>This verification link will expire in 24 hours.</strong></p>
        
        <p>If you didn't create a TaktMate account, you can safely ignore this email.</p>
        
        <div class="footer">
            <p>Best regards,<br>The TaktMate Team</p>
            <p><a href="${this.frontendUrl}">Visit TaktMate</a></p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate plain text email verification template
   */
  generateEmailVerificationText(user, verificationUrl) {
    return `
Welcome to TaktMate!

Hello ${user.name},

Thank you for signing up for TaktMate! To complete your registration and start analyzing your CSV data with AI, please verify your email address.

Click the link below to verify your email:
${verificationUrl}

This verification link will expire in 24 hours.

If you didn't create a TaktMate account, you can safely ignore this email.

Best regards,
The TaktMate Team

Visit TaktMate: ${this.frontendUrl}
`;
  }

  /**
   * Generate HTML password reset template
   */
  generatePasswordResetHTML(user, resetUrl) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset your TaktMate password</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Password Reset Request</h1>
    </div>
    <div class="content">
        <h2>Hello ${user.name},</h2>
        <p>We received a request to reset your TaktMate account password.</p>
        
        <p>Click the button below to reset your password:</p>
        <a href="${resetUrl}" class="button">Reset Password</a>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px;">${resetUrl}</p>
        
        <div class="warning">
            <p><strong>Important Security Information:</strong></p>
            <ul>
                <li>This password reset link will expire in 1 hour</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Never share this link with anyone</li>
            </ul>
        </div>
        
        <p>If you continue to have problems, please contact our support team.</p>
        
        <div class="footer">
            <p>Best regards,<br>The TaktMate Team</p>
            <p><a href="${this.frontendUrl}">Visit TaktMate</a></p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate plain text password reset template
   */
  generatePasswordResetText(user, resetUrl) {
    return `
Password Reset Request

Hello ${user.name},

We received a request to reset your TaktMate account password.

Click the link below to reset your password:
${resetUrl}

IMPORTANT SECURITY INFORMATION:
- This password reset link will expire in 1 hour
- If you didn't request this reset, please ignore this email
- Never share this link with anyone

If you continue to have problems, please contact our support team.

Best regards,
The TaktMate Team

Visit TaktMate: ${this.frontendUrl}
`;
  }

  /**
   * Generate HTML welcome email template
   */
  generateWelcomeHTML(user, dashboardUrl) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to TaktMate!</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .features { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .feature { margin: 15px 0; padding-left: 25px; position: relative; }
        .feature:before { content: "✓"; position: absolute; left: 0; color: #059669; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to TaktMate!</h1>
    </div>
    <div class="content">
        <h2>Hello ${user.name},</h2>
        <p>Your email has been verified successfully! Welcome to TaktMate, the AI-powered CSV analysis platform.</p>
        
        <div class="features">
            <h3>What you can do with TaktMate:</h3>
            <div class="feature">Upload CSV files up to 5MB</div>
            <div class="feature">Ask questions about your data in natural language</div>
            <div class="feature">Get instant AI-powered insights and analysis</div>
            <div class="feature">Secure, private data processing</div>
        </div>
        
        <p>Ready to start analyzing your data?</p>
        <a href="${dashboardUrl}" class="button">Start Using TaktMate</a>
        
        <p><strong>Getting Started Tips:</strong></p>
        <ul>
            <li>Upload a CSV file with your data</li>
            <li>Ask questions like "What's the average value in column X?"</li>
            <li>Try "Show me the top 10 records by Y"</li>
            <li>Use natural language - TaktMate understands context!</li>
        </ul>
        
        <p>If you have any questions or need help, don't hesitate to reach out.</p>
        
        <div class="footer">
            <p>Happy analyzing!<br>The TaktMate Team</p>
            <p><a href="${this.frontendUrl}">Visit TaktMate</a></p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate plain text welcome email template
   */
  generateWelcomeText(user, dashboardUrl) {
    return `
Welcome to TaktMate!

Hello ${user.name},

Your email has been verified successfully! Welcome to TaktMate, the AI-powered CSV analysis platform.

What you can do with TaktMate:
✓ Upload CSV files up to 5MB
✓ Ask questions about your data in natural language
✓ Get instant AI-powered insights and analysis
✓ Secure, private data processing

Ready to start analyzing your data?
Visit: ${dashboardUrl}

Getting Started Tips:
- Upload a CSV file with your data
- Ask questions like "What's the average value in column X?"
- Try "Show me the top 10 records by Y"
- Use natural language - TaktMate understands context!

If you have any questions or need help, don't hesitate to reach out.

Happy analyzing!
The TaktMate Team

Visit TaktMate: ${this.frontendUrl}
`;
  }

  /**
   * Resend email verification
   */
  async resendEmailVerification(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.email_verified) {
        throw new Error('Email is already verified');
      }

      // Generate new verification token if the old one expired
      if (!user.email_verification_token || new Date() > new Date(user.email_verification_expires)) {
        const newVerification = User.generateEmailVerificationToken();
        
        const { executeQuery } = require('../config/database');
        await executeQuery(
          `UPDATE Users 
           SET email_verification_token = @token, email_verification_expires = @expires 
           WHERE id = @userId`,
          {
            userId: user.id,
            token: newVerification.token,
            expires: newVerification.expires
          }
        );
        
        user.email_verification_token = newVerification.token;
        user.email_verification_expires = newVerification.expires;
      }

      // Send verification email
      const result = await this.sendEmailVerification(user);
      
      return {
        success: true,
        message: 'Verification email sent successfully',
        result
      };

    } catch (error) {
      console.error('Resend verification error:', error);
      throw error;
    }
  }

  /**
   * Get email service status and configuration
   */
  getServiceStatus() {
    const config = {
      service: process.env.EMAIL_SERVICE || 'none',
      fromEmail: this.fromEmail,
      configured: !!this.transporter,
      mode: this.transporter?.options?.streamTransport ? 'console' : 'smtp'
    };

    return config;
  }

  /**
   * Send test email
   */
  async sendTestEmail(toEmail, subject = 'TaktMate Test Email') {
    try {
      const mailOptions = {
        from: {
          name: 'TaktMate',
          address: this.fromEmail
        },
        to: toEmail,
        subject: subject,
        html: `
          <h2>TaktMate Email Service Test</h2>
          <p>This is a test email from TaktMate email service.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Service Status:</strong> Working correctly ✅</p>
        `,
        text: `
TaktMate Email Service Test

This is a test email from TaktMate email service.

Timestamp: ${new Date().toISOString()}
Service Status: Working correctly ✅
        `
      };

      const result = await this.sendEmail(mailOptions);
      return result;

    } catch (error) {
      console.error('Test email send error:', error);
      throw error;
    }
  }
}

module.exports = EmailService;
