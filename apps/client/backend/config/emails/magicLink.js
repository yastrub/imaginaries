export function magicLinkTemplate(data) {
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
}
