export function codeLoginTemplate(data) {
  const { email, code, expiresMinutes = 15 } = data || {};
  if (!email || !code) {
    throw new Error('Missing required template data: email or code');
  }
  return {
    subject: 'Your sign-in code · Imaginaries',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #e5e7eb; margin: 0; padding: 0; background-color: #0b0b0c; }
            .container { max-width: 600px; margin: 0 auto; padding: 24px; }
            .card { background: #111114; border: 1px solid #27272a; border-radius: 12px; overflow: hidden; }
            .header { background: linear-gradient(180deg,#18181b,#111114); padding: 28px 24px; text-align: center; }
            .title { color: #fff; margin: 0; font-size: 22px; font-weight: 600; }
            .content { padding: 24px; }
            .code { display: inline-block; letter-spacing: 8px; font-weight: 700; font-size: 28px; background: #18181b; color: #fff; border: 1px solid #27272a; padding: 14px 22px; border-radius: 10px; }
            .muted { color: #9ca3af; font-size: 14px; }
            .footer { text-align: center; padding: 16px 12px 24px; color: #71717a; font-size: 12px; }
            .divider { height: 1px; background: #27272a; margin: 16px 0; }
            a { color: #a78bfa; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header">
                <h2 class="title">Sign in to Imaginaries</h2>
              </div>
              <div class="content">
                <p class="muted">Use this 6-digit code to finish signing in:</p>
                <div style="text-align:center; margin: 18px 0 8px;">
                  <span class="code">${String(code).replace(/\s+/g,'')}</span>
                </div>
                <p class="muted" style="text-align:center;">This code expires in ${expiresMinutes} minutes and can be used once.</p>
                <div class="divider"></div>
                <p class="muted">Tip: If tapping the link in your email opens inside Gmail/Twitter/Facebook, the session may not carry over. Just copy this code and return to your browser where Imaginaries is open.</p>
                <p class="muted">Email: <strong style="color:#fff;">${email}</strong></p>
              </div>
            </div>
            <div class="footer">This is an automated message from Imaginaries</div>
          </div>
        </body>
      </html>
    `,
  };
}
