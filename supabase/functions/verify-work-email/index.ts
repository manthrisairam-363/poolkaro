import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PERSONAL_DOMAINS = ['gmail.com','yahoo.com','hotmail.com','outlook.com','rediffmail.com','icloud.com','ymail.com','live.com']

function isPersonalEmail(email: string) {
  return PERSONAL_DOMAINS.includes(email.split('@')[1]?.toLowerCase())
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendEmailViaGmail(to: string, otpCode: string, company: string) {
  const GMAIL_USER = Deno.env.get('GMAIL_USER')!
  const GMAIL_PASSWORD = Deno.env.get('GMAIL_PASSWORD')!

  // Use Gmail API via SMTP through fetch
  const emailContent = [
    `From: CarpoolKaro <${GMAIL_USER}>`,
    `To: ${to}`,
    `Subject: ${otpCode} — CarpoolKaro Work Email Verification`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    `<!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f9f9f9;">
      <div style="background: #111; border-radius: 16px; padding: 32px; text-align: center;">
        <h2 style="font-size: 28px; font-weight: 900; margin: 0 0 4px;">
          <span style="color: #facc15;">Carpool</span><span style="color: #fff;">Karo</span>
        </h2>
        <p style="color: #888; font-size: 13px; margin: 0 0 28px;">Hyderabad IT Carpool</p>
        <p style="color: #aaa; font-size: 14px; margin: 0 0 16px;">
          Your verification code for <strong style="color:#fff;">${to}</strong>
        </p>
        <div style="font-size: 40px; font-weight: 900; letter-spacing: 10px; color: #111; background: #facc15; border-radius: 12px; padding: 16px 24px; display: inline-block; margin-bottom: 20px;">
          ${otpCode}
        </div>
        <p style="color: #666; font-size: 12px; margin: 0;">
          Expires in 10 minutes. Do not share this code.
        </p>
      </div>
      <p style="color: #bbb; font-size: 11px; text-align: center; margin-top: 16px;">
        Once verified, your profile will show ✓ ${company} badge on your rides.
      </p>
    </body>
    </html>`,
  ].join('\r\n')

  const encoded = btoa(unescape(encodeURIComponent(emailContent)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  // Get OAuth token using App Password via Gmail API
  const authString = btoa(`${GMAIL_USER}:${GMAIL_PASSWORD}`)

  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  })

  if (!res.ok) {
    // Fallback: use SMTP relay via Mailjet if available
    const MAILJET_KEY = Deno.env.get('MAILJET_API_KEY')
    const MAILJET_SECRET = Deno.env.get('MAILJET_SECRET_KEY')
    
    if (MAILJET_KEY && MAILJET_SECRET) {
      const mjRes = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${MAILJET_KEY}:${MAILJET_SECRET}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Messages: [{
            From: { Email: 'noreply@carpoolkaro.com', Name: 'CarpoolKaro' },
            To: [{ Email: to }],
            Subject: `${otpCode} — CarpoolKaro Work Email Verification`,
            HTMLPart: `<h2>Your OTP: <strong>${otpCode}</strong></h2><p>Expires in 10 minutes.</p>`,
          }]
        })
      })
      return mjRes.ok
    }
    
    // Last resort: SMTP via nodemailer
    const { createTransport } = await import('npm:nodemailer@6')
    const transporter = createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_PASSWORD },
    })
    await transporter.sendMail({
      from: `CarpoolKaro <${GMAIL_USER}>`,
      to,
      subject: `${otpCode} — CarpoolKaro Work Email Verification`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="font-size:24px;font-weight:900;">
            <span style="color:#facc15">Carpool</span>Karo
          </h2>
          <p>Your verification code for <strong>${to}</strong>:</p>
          <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#111;background:#facc15;border-radius:10px;padding:16px;text-align:center;margin:16px 0;">
            ${otpCode}
          </div>
          <p style="color:#888;font-size:12px;">Expires in 10 minutes. Do not share.</p>
          <p style="color:#aaa;font-size:11px;">Once verified, your profile shows ✓ ${company} badge on CarpoolKaro.</p>
        </div>
      `,
    })
    return true
  }
  return true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization') || ''
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { action, work_email, otp } = await req.json()

    if (action === 'send_otp') {
      const email = work_email?.toLowerCase().trim()
      if (!email || !email.includes('@')) {
        return new Response(JSON.stringify({ error: 'Invalid email address' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (isPersonalEmail(email)) {
        return new Response(JSON.stringify({
          error: 'Please enter your company work email, not Gmail/Yahoo.'
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const otpCode = generateOTP()
      const company = email.split('@')[1].split('.')[0]

      await supabase.from('work_email_verifications').delete().eq('user_id', user.id)
      await supabase.from('work_email_verifications').insert({
        user_id: user.id, work_email: email, otp: otpCode,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })

      try {
        await sendEmailViaGmail(email, otpCode, company)
      } catch (emailErr) {
        console.error('Email send error:', emailErr.message)
        return new Response(JSON.stringify({ error: 'Failed to send email. Try again.' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true, message: `OTP sent to ${email}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'verify_otp') {
      const { data: record } = await supabase
        .from('work_email_verifications').select('*')
        .eq('user_id', user.id).eq('verified', false)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()

      if (!record) return new Response(JSON.stringify({ error: 'No pending verification. Request a new OTP.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
      if (new Date(record.expires_at) < new Date()) return new Response(JSON.stringify({ error: 'OTP expired. Request a new one.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
      if (record.otp !== otp.trim()) return new Response(JSON.stringify({ error: 'Incorrect OTP. Try again.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

      await supabase.from('work_email_verifications').update({ verified: true }).eq('id', record.id)
      await supabase.from('profiles').update({
        work_email: record.work_email, work_email_verified: true, is_verified: true,
      }).eq('id', user.id)

      const company = record.work_email.split('@')[1]
      return new Response(JSON.stringify({
        success: true,
        work_email: record.work_email,
        message: `✅ ${company} email verified! Your profile now shows a verified badge.`
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response('Invalid action', { status: 400, headers: corsHeaders })
  } catch (err) {
    console.error('Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
