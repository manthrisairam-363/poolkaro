// Edge Function: verify-work-email
// Sends OTP to work email and verifies it

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Personal email domains we reject
const PERSONAL_DOMAINS = [
  'gmail.com','yahoo.com','hotmail.com','outlook.com',
  'rediffmail.com','icloud.com','ymail.com','live.com',
]

function isPersonalEmail(email: string) {
  const domain = email.split('@')[1]?.toLowerCase()
  return PERSONAL_DOMAINS.includes(domain)
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get authenticated user from JWT
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

    // ── SEND OTP ──────────────────────────────────────────
    if (action === 'send_otp') {
      const email = work_email?.toLowerCase().trim()

      if (!email || !email.includes('@')) {
        return new Response(JSON.stringify({ error: 'Invalid email address' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (isPersonalEmail(email)) {
        return new Response(JSON.stringify({
          error: 'Please enter your company/work email, not a personal email like Gmail.'
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const otpCode = generateOTP()

      // Store OTP in DB (delete old ones first)
      await supabase.from('work_email_verifications')
        .delete().eq('user_id', user.id)

      await supabase.from('work_email_verifications').insert({
        user_id: user.id,
        work_email: email,
        otp: otpCode,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })

      // Send email via Resend
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
      if (!RESEND_API_KEY) {
        return new Response(JSON.stringify({ error: 'Email service not configured' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const company = email.split('@')[1].split('.')[0]
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'PoolKaro <onboarding@resend.dev>',
          to: email,
          subject: `${otpCode} — Your PoolKaro Work Email Verification`,
          html: `
            <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h2 style="font-size: 24px; font-weight: 800; margin: 0;">
                  <span style="color: #facc15;">Pool</span>Karo
                </h2>
                <p style="color: #888; font-size: 13px; margin: 4px 0 0;">Hyderabad IT Carpool</p>
              </div>
              <div style="background: #f9fafb; border-radius: 12px; padding: 24px; text-align: center; border: 1px solid #e5e7eb;">
                <p style="font-size: 14px; color: #555; margin: 0 0 16px;">
                  Your verification code for <strong>${email}</strong>
                </p>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #111; background: #facc15; border-radius: 10px; padding: 16px; display: inline-block;">
                  ${otpCode}
                </div>
                <p style="font-size: 12px; color: #888; margin: 16px 0 0;">
                  This code expires in 10 minutes.<br/>
                  Do not share this code with anyone.
                </p>
              </div>
              <p style="font-size: 12px; color: #aaa; text-align: center; margin-top: 20px;">
                Once verified, your profile will show a 
                <strong style="color: #16a34a;">✓ Verified</strong> badge with your company name.
              </p>
            </div>
          `
        })
      })

      if (!emailRes.ok) {
        const err = await emailRes.text()
        console.error('Resend error:', err)
        return new Response(JSON.stringify({ error: 'Failed to send email. Try again.' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true, message: `OTP sent to ${email}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── VERIFY OTP ────────────────────────────────────────
    if (action === 'verify_otp') {
      const { data: record } = await supabase
        .from('work_email_verifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('verified', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!record) {
        return new Response(JSON.stringify({ error: 'No pending verification found. Request a new OTP.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (new Date(record.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'OTP has expired. Please request a new one.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (record.otp !== otp.trim()) {
        return new Response(JSON.stringify({ error: 'Incorrect OTP. Please try again.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Mark as verified
      await supabase.from('work_email_verifications')
        .update({ verified: true }).eq('id', record.id)

      // Update profile
      await supabase.from('profiles').update({
        work_email: record.work_email,
        work_email_verified: true,
        is_verified: true,
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
