import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  debug: true,
  logger: true,
});

// Verify transporter configuration on startup
transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP Configuration Error:', error);
  } else {
    console.log('SMTP Server is ready to send emails');
  }
});

// Email templates
export const emailTemplates = {
  feedback: (data) => {
    if (!data.reportType || !data.description || !data.userInfo || !data.adminEmail) {
      throw new Error('Missing required template data for feedback email');
    }

    return {
      subject: `Imaginaries ${data.reportType}: ${data.description.substring(0, 50)}${data.description.length > 50 ? '...' : ''}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                color: #333;
                margin: 0;
                padding: 0;
                background-color: #f4f4f5;
              }
              .container { 
                max-width: 600px; 
                margin: 0 auto; 
                padding: 20px;
              }
              .header { 
                background: #18181b;
                padding: 30px 20px;
                text-align: center;
                border-radius: 8px 8px 0 0;
              }
              .header h2 {
                color: #fff;
                margin: 0;
                font-size: 24px;
                font-weight: 600;
              }
              .content { 
                background: #fff;
                padding: 30px 20px;
                border-radius: 0 0 8px 8px;
              }
              .feedback-box {
                margin: 20px 0;
                padding: 15px;
                border-radius: 5px;
                border-left: 4px solid ${data.reportType === 'Bug Report' ? '#ff6b6b' : '#6bff6b'};
                background-color: ${data.reportType === 'Bug Report' ? '#fff8f8' : '#f8fff8'};
              }
              .info-table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
              }
              .info-table th {
                text-align: left;
                padding: 10px;
                background-color: #f4f4f5;
                border: 1px solid #e4e4e7;
              }
              .info-table td {
                padding: 10px;
                border: 1px solid #e4e4e7;
                word-break: break-all;
              }
              .footer { 
                text-align: center; 
                padding: 20px;
                color: #71717a;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>Imaginaries ${data.reportType}</h2>
              </div>
              <div class="content">
                <div class="feedback-box">
                  <h3 style="margin-top: 0;">${data.reportType}</h3>
                  <p style="white-space: pre-wrap;">${data.description}</p>
                </div>
                
                <h3>User Information</h3>
                <table class="info-table">
                  <tr>
                    <th>User ID</th>
                    <td>${data.userInfo.userId}</td>
                  </tr>
                  <tr>
                    <th>Email</th>
                    <td>${data.userInfo.email}</td>
                  </tr>
                  <tr>
                    <th>IP Address</th>
                    <td>${data.userInfo.ip}</td>
                  </tr>
                  <tr>
                    <th>User Agent</th>
                    <td>${data.userInfo.userAgent}</td>
                  </tr>
                  <tr>
                    <th>Timestamp</th>
                    <td>${new Date(data.userInfo.timestamp).toLocaleString()}</td>
                  </tr>
                </table>
                
                ${data.attachment ? '<p><strong>Attachment:</strong> Screenshot included</p>' : ''}
              </div>
              <div class="footer">
                <p>This is an automated message from the Imaginaries feedback system.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
        Imaginaries ${data.reportType}
        ===============================
        
        ${data.description}
        
        User Information:
        - User ID: ${data.userInfo.userId}
        - Email: ${data.userInfo.email}
        - IP Address: ${data.userInfo.ip}
        - User Agent: ${data.userInfo.userAgent}
        - Timestamp: ${new Date(data.userInfo.timestamp).toLocaleString()}
        
        ${data.attachment ? 'Attachment: Screenshot included' : ''}
        
        This is an automated message from the Imaginaries feedback system.
      `,
      attachments: data.attachment ? [data.attachment] : []
    };
  },
  
  confirmEmail: (data) => {
    if (!data.email || !data.confirmationUrl) {
      throw new Error('Missing required template data: email or confirmationUrl');
    }

    return {
      subject: 'Confirm your email address',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                color: #333;
                margin: 0;
                padding: 0;
                background-color: #f4f4f5;
              }
              .container { 
                max-width: 600px; 
                margin: 0 auto; 
                padding: 20px;
              }
              .header { 
                background: #18181b;
                padding: 30px 20px;
                text-align: center;
                border-radius: 8px 8px 0 0;
              }
              .header h2 {
                color: #fff;
                margin: 0;
                font-size: 24px;
                font-weight: 600;
              }
              .content { 
                background: #fff;
                padding: 30px 20px;
                border-radius: 0 0 8px 8px;
              }
              .button-container {
                text-align: center;
                margin: 30px 0;
              }
              .button { 
                display: inline-block;
                padding: 14px 32px;
                background-color: #7c3aed;
                color: #ffffff !important;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 500;
                font-size: 16px;
                border: none;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              }
              .button:hover {
                background-color: #6d28d9;
              }
              .link {
                word-break: break-all;
                color: #7c3aed;
                text-decoration: none;
              }
              .footer { 
                text-align: center; 
                padding: 20px;
                color: #71717a;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>Welcome to Imaginaries</h2>
              </div>
              <div class="content">
                <p>Please confirm your email address by clicking the button below:</p>
                <div class="button-container">
                  <a href="${data.confirmationUrl}" class="button">Confirm Email</a>
                </div>
                <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
                <p><a href="${data.confirmationUrl}" class="link">${data.confirmationUrl}</a></p>
                <p>This link will expire in 24 hours.</p>
              </div>
              <div class="footer">
                <p>This is an automated message from Imaginaries</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };
  },
  quoteRequest: (data) => {
  if (!data.name || !data.email || !data.message || !data.imageUrl) {
    throw new Error('Missing required template data: name, email, message, or imageUrl');
  }

  return {
    subject: `New Quote Request from ${data.name}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f4f4f5;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px;
            }
            .header { 
              background: #18181b;
              padding: 30px 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .header h2 {
              color: #fff;
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content { 
              background: #fff;
              padding: 30px 20px;
              border-radius: 0 0 8px 8px;
            }
            .image-container {
              text-align: center;
              margin: 20px 0;
            }
            .image {
              max-width: 100%;
              height: auto;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .details {
              margin: 20px 0;
            }
            .details p {
              margin: 10px 0;
            }
            .label {
              font-weight: 600;
              color: #18181b;
            }
            .footer { 
              text-align: center; 
              padding: 20px;
              color: #71717a;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Quote Request</h2>
            </div>
            <div class="content">
              <p>A customer has submitted a quote request for an AI-generated jewelry piece. Details below:</p>
              <div class="details">
                <p><span class="label">Name:</span> ${data.name}</p>
                <p><span class="label">Email:</span> ${data.email}</p>
                <p><span class="label">Message:</span> ${data.message}</p>
                <p><span class="label">Image ID:</span> ${data.imageId || 'N/A'}</p>
                <p><span class="label">Prompt:</span> ${data.prompt || 'N/A'}</p>
                <p><span class="label">Created At:</span> ${data.createdAt || 'N/A'}</p>
                <p><span class="label">Estimated Cost:</span> <strong style="color: #d97706;">${data.estimatedCost || 'Not available'} USD</strong></p>
              </div>
              <div class="image-container">
                <img src="${data.imageUrl}" alt="AI-Generated Jewelry" class="image" />
              </div>
              <p>Please review the request and respond to the customer at <a href="mailto:${data.email}">${data.email}</a>.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from Imaginaries</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };
},
  resetPassword: (data) => {
    if (!data.email || !data.resetUrl) {
      throw new Error('Missing required template data: email or resetUrl');
    }

    return {
      subject: 'Reset Your Password - Imaginaries',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                color: #333;
                margin: 0;
                padding: 0;
                background-color: #f4f4f5;
              }
              .container { 
                max-width: 600px; 
                margin: 0 auto; 
                padding: 20px;
              }
              .header { 
                background: #18181b;
                padding: 30px 20px;
                text-align: center;
                border-radius: 8px 8px 0 0;
              }
              .header h2 {
                color: #fff;
                margin: 0;
                font-size: 24px;
                font-weight: 600;
              }
              .content { 
                background: #fff;
                padding: 30px 20px;
                border-radius: 0 0 8px 8px;
              }
              .button-container {
                text-align: center;
                margin: 30px 0;
              }
              .button { 
                display: inline-block;
                padding: 14px 32px;
                background-color: #7c3aed;
                color: #ffffff !important;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 500;
                font-size: 16px;
                border: none;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              }
              .button:hover {
                background-color: #6d28d9;
              }
              .link {
                word-break: break-all;
                color: #7c3aed;
                text-decoration: none;
              }
              .footer { 
                text-align: center; 
                padding: 20px;
                color: #71717a;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>Reset Your Password</h2>
              </div>
              <div class="content">
                <p>You requested a password reset for your Imaginaries account.</p>
                <p>Click the button below to reset your password:</p>
                <div class="button-container">
                  <a href="${data.resetUrl}" class="button">Reset Password</a>
                </div>
                <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
                <p><a href="${data.resetUrl}" class="link">${data.resetUrl}</a></p>
                <p>This link will expire in 1 hour.</p>
                <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
              </div>
              <div class="footer">
                <p>This is an automated message from Imaginaries</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };
  },
  magicLink: (data) => {
    if (!data.email || !data.magicUrl) {
      throw new Error('Missing required template data: email or magicUrl');
    }
    return {
      subject: 'Your sign-in link · Imaginaries',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                color: #333;
                margin: 0;
                padding: 0;
                background-color: #f4f4f5;
              }
              .container { 
                max-width: 600px; 
                margin: 0 auto; 
                padding: 20px;
              }
              .header { 
                background: #18181b;
                padding: 30px 20px;
                text-align: center;
                border-radius: 8px 8px 0 0;
              }
              .header h2 {
                color: #fff;
                margin: 0;
                font-size: 24px;
                font-weight: 600;
              }
              .content { 
                background: #fff;
                padding: 30px 20px;
                border-radius: 0 0 8px 8px;
              }
              .button-container {
                text-align: center;
                margin: 30px 0;
              }
              .button { 
                display: inline-block;
                padding: 14px 32px;
                background-color: #7c3aed;
                color: #ffffff !important;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 500;
                font-size: 16px;
                border: none;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              }
              .button:hover { background-color: #6d28d9; }
              .link { word-break: break-all; color: #7c3aed; text-decoration: none; }
              .footer { text-align: center; padding: 20px; color: #71717a; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header"><h2>Sign in to Imaginaries</h2></div>
              <div class="content">
                <p>Click the button below to sign in. This link expires in 15 minutes and can be used once.</p>
                <div class="button-container"><a href="${data.magicUrl}" class="button">Sign in</a></div>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p><a href="${data.magicUrl}" class="link">${data.magicUrl}</a></p>
              </div>
              <div class="footer"><p>This is an automated message from Imaginaries</p></div>
            </div>
          </body>
        </html>
      `,
    };
  },
  newUserNotification: (data) => {
    if (!data.email || !data.userEmail || !data.initialIp || !data.userAgent) {
      throw new Error('Missing required template data for admin notification');
    }

    return {
      subject: 'New User Registration - Imaginaries',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                color: #333;
                margin: 0;
                padding: 0;
                background-color: #f4f4f5;
              }
              .container { 
                max-width: 600px; 
                margin: 0 auto; 
                padding: 20px;
              }
              .header { 
                background: #18181b;
                padding: 20px;
                text-align: center;
                border-radius: 8px 8px 0 0;
              }
              .header h2 {
                color: #fff;
                margin: 0;
                font-size: 24px;
                font-weight: 600;
              }
              .content { 
                background: #fff;
                padding: 30px 20px;
                border-radius: 0 0 8px 8px;
              }
              .info-table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
              }
              .info-table th {
                text-align: left;
                padding: 10px;
                background-color: #f4f4f5;
                border: 1px solid #e4e4e7;
              }
              .info-table td {
                padding: 10px;
                border: 1px solid #e4e4e7;
                word-break: break-all;
              }
              .footer { 
                text-align: center; 
                padding: 20px;
                color: #71717a;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>New User Registration</h2>
              </div>
              <div class="content">
                <p>A new user has registered on Imaginaries:</p>
                
                <table class="info-table">
                  <tr>
                    <th>Email</th>
                    <td>${data.userEmail}</td>
                  </tr>
                  <tr>
                    <th>Registration Time</th>
                    <td>${new Date().toLocaleString()}</td>
                  </tr>
                  <tr>
                    <th>IP Address</th>
                    <td>${data.initialIp}</td>
                  </tr>
                  <tr>
                    <th>User Agent</th>
                    <td>${data.userAgent}</td>
                  </tr>
                </table>
              </div>
              <div class="footer">
                <p>This is an automated message from Imaginaries</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };
  },
};

// Send email function
export async function sendEmail(template, data) {
  if (!emailTemplates[template]) {
    throw new Error(`Email template "${template}" not found`);
  }

  // Different email templates have different required fields
  // For feedback template, we need adminEmail
  // For other templates, we need email
  if (template === 'feedback') {
    if (!data.adminEmail) {
      throw new Error('Admin email is required for feedback template');
    }
  } else if (!data.email) {
    throw new Error('Recipient email is required');
  }

  let toEmail;
  const fromEmail = `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM}>`; // Always use app's email

  // Conditional logic for different email types
  if (template === 'quoteRequest' || template === 'orderCreated' || template === 'feedback') {
    // For admin-targeted emails
    if (template === 'quoteRequest' || template === 'orderCreated') {
      const quoteRequestEmail = process.env.QUOTE_REQUEST_EMAIL;
      if (!quoteRequestEmail) {
        throw new Error('QUOTE_REQUEST_EMAIL environment variable is not set');
      }
      toEmail = quoteRequestEmail; // Corporate email as TO
    } else if (template === 'feedback') {
      toEmail = data.adminEmail; // Admin email for feedback
    }
  } else {
    toEmail = data.email; // Default TO (user's email)
  }

  console.log('Sending email:', {
    template,
    from: fromEmail,
    to: toEmail,
  });

  try {
    const emailContent = emailTemplates[template](data);

    const mailOptions = {
      from: fromEmail, // Fixed app email (e.g., noreply@imaginaries.app)
      to: toEmail,
      ...(template === 'quoteRequest' || template === 'orderCreated' ? { 
        replyTo: data.email,
        // Add CC and BCC for quote requests if they exist in environment variables
        ...(process.env.QUOTE_REQUEST_CC ? { cc: process.env.QUOTE_REQUEST_CC } : {}),
        ...(process.env.QUOTE_REQUEST_BCC ? { bcc: process.env.QUOTE_REQUEST_BCC } : {})
      } : {}),
      ...emailContent,
    };

    console.log('Mail options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      cc: mailOptions.cc,
      bcc: mailOptions.bcc,
      subject: mailOptions.subject,
      replyTo: mailOptions.replyTo,
    });

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', {
      messageId: info.messageId,
      response: info.response,
    });
    return info;
  } catch (error) {
    console.error('Error sending email:', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      command: error.command,
    });
    throw error;
  }
}