const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports.sendOTPEmail = async function (to, otp) {
  const msg = {
    to,
    from: "paarthoceaniq25040@gmail.com",
    subject: "Talkora Verification Code",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Talkora Verification</title>
        <style>
          body { margin: 0; padding: 0; font-family: 'gg sans', 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #2b2d31; color: #dbdee1; }
          .container { max-width: 480px; margin: 40px auto; background: #313338; border-radius: 5px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
          .header { background: #5865F2; padding: 40px 20px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; }
          .content { padding: 40px; text-align: center; }
          .welcome-text { font-size: 18px; color: #f2f3f5; margin-bottom: 20px; }
          .instruction { font-size: 14px; color: #b5bac1; line-height: 1.6; margin-bottom: 24px; }
          .otp-box { 
            background: #1e1f22; 
            border-radius: 3px; 
            padding: 15px; 
            margin: 0 auto 24px; 
            font-size: 24px; 
            font-weight: 500; 
            color: #f2f3f5; 
            letter-spacing: 4px; 
            display: inline-block; 
            min-width: 160px;
          }
          .security-note { font-size: 12px; color: #949ba4; margin-top: 20px; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #949ba4; border-top: 1px solid #1e1f22; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Talkora</h1>
          </div>
          <div class="content">
            <h2 class="welcome-text">Hello!</h2>
            <p class="instruction">
              You are receiving this email because we detected a login attempt or registration for your account. Please enter the following code to verify your identity:
            </p>
            
            <div class="otp-box">${otp}</div>
            
            <p class="instruction">
              This code will expire in <strong>5 minutes</strong>. If you did not request this, please ignore this email.
            </p>

            <div class="security-note">
              Two-factor authentication adds an extra layer of security to your account.
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Talkora. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await sgMail.send(msg);
  console.log("OTP email sent to:", to);
}
