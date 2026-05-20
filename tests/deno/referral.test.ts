/**
 * referral.test.ts — 10 tests
 * Both referrer and new user are created fresh per test for full isolation
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { assertEquals, assertExists, assert } from 'https://deno.land/std@0.208.0/assert/mod.ts'

const URL = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db  = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

async function getWallet(uid: string) {
  const { data } = await db.from('wallets').select('balance').eq('user_id', uid).maybeSingle()
  return data?.balance ?? 0
}
async function getReferralCount(uid: string) {
  const { data } = await db.from('profiles').select('referral_count').eq('id', uid).maybeSingle()
  return data?.referral_count ?? 0
}

async function createUser(tag: string): Promise<{ id: string; code: string }> {
  const email = `ref_${tag}_${Date.now()}@test.com`
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true })
  if (error) throw new Error('createUser failed: ' + error.message)
  const uid = data.user!.id
  const code = `R${tag.toUpperCase().slice(0,5)}${Math.random().toString(36).slice(2,4).toUpperCase()}`
  const { error: pe } = await db.from('profiles').upsert({
    id: uid, full_name: `Test ${tag}`, email, role: 'both',
    onboarding_complete: true, referral_code: code, referral_count: 0,
  }, { onConflict: 'id' })
  if (pe) throw new Error(`Profile insert failed (${tag}): ${pe.message}`)
  const { error: we } = await db.from('wallets').upsert({ user_id: uid, balance: 5000 }, { onConflict: 'user_id' })
  if (we) throw new Error(`Wallet insert failed (${tag}): ${we.message}`)
  return { id: uid, code }
}

async function deleteUser(uid: string) {
  await db.from('notifications').delete().eq('user_id', uid)
  await db.from('wallet_transactions').delete().eq('user_id', uid)
  await db.from('wallets').delete().eq('user_id', uid)
  await db.from('profiles').delete().eq('id', uid)
  await db.auth.admin.deleteUser(uid)
}

Deno.test('R_T01 - complete_onboarding_referral gives new user ₹10', async () => {
  const referrer = await createUser('ref01')
  const newUser  = await createUser('new01')
  await db.from('wallets').update({ balance: 0 }).eq('user_id', newUser.id)
  try {
    const { data } = await db.rpc('complete_onboarding_referral', {
      p_new_user_id: newUser.id, p_referral_code: referrer.code, p_new_user_name: 'New01'
    })
    if (!data?.success) throw new Error('Function failed: ' + JSON.stringify(data))
    assertEquals(await getWallet(newUser.id), 1000)
  } finally { await deleteUser(referrer.id); await deleteUser(newUser.id) }
})

Deno.test('R_T02 - complete_onboarding_referral gives referrer ₹10', async () => {
  const referrer = await createUser('ref02')
  const newUser  = await createUser('new02')
  const before = await getWallet(referrer.id)
  try {
    await db.rpc('complete_onboarding_referral', {
      p_new_user_id: newUser.id, p_referral_code: referrer.code, p_new_user_name: 'New02'
    })
    assertEquals(await getWallet(referrer.id), before + 1000)
  } finally { await deleteUser(referrer.id); await deleteUser(newUser.id) }
})

Deno.test('R_T03 - referral_count incremented on referrer profile', async () => {
  const referrer = await createUser('ref03')
  const newUser  = await createUser('new03')
  try {
    await db.rpc('complete_onboarding_referral', {
      p_new_user_id: newUser.id, p_referral_code: referrer.code, p_new_user_name: 'New03'
    })
    assertEquals(await getReferralCount(referrer.id), 1)
  } finally { await deleteUser(referrer.id); await deleteUser(newUser.id) }
})

Deno.test('R_T04 - referral bonus transaction created for new user', async () => {
  const referrer = await createUser('ref04')
  const newUser  = await createUser('new04')
  try {
    await db.rpc('complete_onboarding_referral', {
      p_new_user_id: newUser.id, p_referral_code: referrer.code, p_new_user_name: 'New04'
    })
    const { data: txn } = await db.from('wallet_transactions')
      .select('amount').eq('user_id', newUser.id).eq('type', 'referral_bonus').single()
    assertEquals(txn?.amount, 1000)
  } finally { await deleteUser(referrer.id); await deleteUser(newUser.id) }
})

Deno.test('R_T05 - referral bonus transaction created for referrer', async () => {
  const referrer = await createUser('ref05')
  const newUser  = await createUser('new05')
  try {
    await db.rpc('complete_onboarding_referral', {
      p_new_user_id: newUser.id, p_referral_code: referrer.code, p_new_user_name: 'New05'
    })
    const { data: txn } = await db.from('wallet_transactions')
      .select('amount').eq('user_id', referrer.id).eq('type', 'referral_bonus').single()
    assertEquals(txn?.amount, 1000)
  } finally { await deleteUser(referrer.id); await deleteUser(newUser.id) }
})

Deno.test('R_T06 - notification sent to referrer', async () => {
  const referrer = await createUser('ref06')
  const newUser  = await createUser('new06')
  try {
    await db.rpc('complete_onboarding_referral', {
      p_new_user_id: newUser.id, p_referral_code: referrer.code, p_new_user_name: 'New06'
    })
    const { data: notif } = await db.from('notifications')
      .select('title').eq('user_id', referrer.id).eq('title', '🎁 Referral Bonus!').single()
    assertExists(notif)
  } finally { await deleteUser(referrer.id); await deleteUser(newUser.id) }
})

Deno.test('R_T07 - fails for invalid referral code', async () => {
  const newUser = await createUser('new07')
  try {
    const { data } = await db.rpc('complete_onboarding_referral', {
      p_new_user_id: newUser.id, p_referral_code: 'INVALID', p_new_user_name: 'New07'
    })
    assertEquals(data?.success, false)
  } finally { await deleteUser(newUser.id) }
})

Deno.test('R_T08 - duplicate phone blocked', async () => {
  const referrer = await createUser('ref08')
  const user1 = await createUser('new08a')
  const user2 = await createUser('new08b')
  await db.from('profiles').update({ phone: '9111111111' }).eq('id', user1.id)
  await db.from('profiles').update({ phone: '9111111111' }).eq('id', user2.id)
  const before = await getReferralCount(referrer.id)
  try {
    await db.rpc('complete_onboarding_referral', {
      p_new_user_id: user2.id, p_referral_code: referrer.code, p_new_user_name: 'Dup'
    })
    assertEquals(await getReferralCount(referrer.id), before)
  } finally { await deleteUser(referrer.id); await deleteUser(user1.id); await deleteUser(user2.id) }
})

Deno.test('R_T09 - cannot refer yourself', async () => {
  const referrer = await createUser('ref09')
  const before = await getWallet(referrer.id)
  try {
    const { data } = await db.rpc('complete_onboarding_referral', {
      p_new_user_id: referrer.id, p_referral_code: referrer.code, p_new_user_name: 'Self'
    })
    assertEquals(data?.success, false)
    assertEquals(await getWallet(referrer.id), before)
  } finally { await deleteUser(referrer.id) }
})

Deno.test('R_T10 - referral code is case insensitive', async () => {
  const referrer = await createUser('ref10')
  const newUser  = await createUser('new10')
  try {
    const { data } = await db.rpc('complete_onboarding_referral', {
      p_new_user_id: newUser.id,
      p_referral_code: referrer.code.toLowerCase(),
      p_new_user_name: 'New10'
    })
    assertEquals(data?.success, true)
    assertEquals(await getWallet(newUser.id), 1000)
  } finally { await deleteUser(referrer.id); await deleteUser(newUser.id) }
})
