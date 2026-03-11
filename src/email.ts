import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = 'xtrct <hello@xtrct.io>';

export async function sendApiKey(email: string, key: string, existing = false) {
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: existing ? 'Your xtrct API key' : 'Welcome to xtrct — here\'s your API key',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#07060f;font-family:Inter,system-ui,sans-serif;color:#ede9fe;">
  <div style="max-width:520px;margin:40px auto;padding:40px;background:#0f0d1a;border:1px solid #1e1a2e;border-radius:16px;">
    <div style="font-size:22px;font-weight:800;margin-bottom:24px;letter-spacing:-0.5px;">
      xtrct<span style="color:#7c3aed;">.</span>
    </div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 8px;color:#ede9fe;">
      ${existing ? 'Here\'s your API key' : 'Welcome — you\'re all set'}
    </h1>
    <p style="color:#6d6880;font-size:14px;line-height:1.6;margin:0 0 24px;">
      ${existing ? 'You requested your existing API key.' : 'Your free account is ready. You have <strong style="color:#a78bfa;">500 credits</strong> to get started.'}
    </p>

    <div style="background:#07060f;border:1px solid #1e1a2e;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <p style="font-size:11px;color:#6d6880;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.05em;">Your API Key</p>
      <code style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#a78bfa;word-break:break-all;">${key}</code>
    </div>

    <p style="color:#6d6880;font-size:13px;margin:0 0 20px;">Quick start:</p>
    <div style="background:#07060f;border:1px solid #1e1a2e;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <pre style="margin:0;font-family:'JetBrains Mono',monospace;font-size:12px;color:#c4b5fd;white-space:pre-wrap;word-break:break-all;">curl -X POST https://api.xtrct.io/v1/scrape \\
  -H "X-API-Key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com","output":"markdown","wait":true}'</pre>
    </div>

    <p style="color:#6d6880;font-size:13px;margin:0 0 24px;">
      You have <strong style="color:#ede9fe;">500 free credits/month</strong>.
      Need more? <a href="https://xtrct.io/#pricing" style="color:#a78bfa;">Upgrade your plan →</a>
    </p>

    <hr style="border:none;border-top:1px solid #1e1a2e;margin:24px 0;"/>
    <p style="color:#3b3554;font-size:12px;margin:0;">
      xtrct.io · <a href="https://xtrct.io" style="color:#3b3554;">xtrct.io</a> ·
      <a href="mailto:hello@xtrct.io" style="color:#3b3554;">hello@xtrct.io</a>
    </p>
  </div>
</body>
</html>`,
  });
}

export async function sendWelcomePaid(email: string, key: string, tier: string, credits: number) {
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `You're on xtrct ${tier} — here's your API key`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#07060f;font-family:Inter,system-ui,sans-serif;color:#ede9fe;">
  <div style="max-width:520px;margin:40px auto;padding:40px;background:#0f0d1a;border:1px solid #1e1a2e;border-radius:16px;">
    <div style="font-size:22px;font-weight:800;margin-bottom:24px;letter-spacing:-0.5px;">
      xtrct<span style="color:#7c3aed;">.</span>
    </div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 8px;color:#ede9fe;">
      You're on the ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan 🎉
    </h1>
    <p style="color:#6d6880;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Your account has been upgraded with <strong style="color:#a78bfa;">${credits.toLocaleString()} credits</strong>.
    </p>

    <div style="background:#07060f;border:1px solid #1e1a2e;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <p style="font-size:11px;color:#6d6880;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.05em;">Your API Key</p>
      <code style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#a78bfa;word-break:break-all;">${key}</code>
    </div>

    <p style="color:#6d6880;font-size:13px;margin:0 0 24px;">
      Check your usage anytime at <a href="https://xtrct.io/dashboard" style="color:#a78bfa;">xtrct.io/dashboard</a>
    </p>

    <hr style="border:none;border-top:1px solid #1e1a2e;margin:24px 0;"/>
    <p style="color:#3b3554;font-size:12px;margin:0;">
      Questions? Reply to this email or contact <a href="mailto:hello@xtrct.io" style="color:#3b3554;">hello@xtrct.io</a>
    </p>
  </div>
</body>
</html>`,
  });
}
