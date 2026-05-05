import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'

const RECHARGE_OPTIONS = [20, 50, 100]

function TransactionItem({ txn }) {
  const isCredit = txn.amount > 0
  const icons = {
    signup_bonus: '🎁',
    recharge: '💳',
    booking_fee: '🎫',
    posting_fee: '🚗',
    refund_cancel: '↩️',
    razorpay: '💳',
  }
  const labels = {
    signup_bonus: 'Welcome Bonus',
    recharge: 'Wallet Recharge',
    booking_fee: 'Booking Fee',
    posting_fee: 'Ride Posting Fee',
    refund_cancel: 'Cancellation Refund',
    razorpay: 'Recharge via Razorpay',
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', padding: '12px 0',
      borderBottom: '1px solid #f5f5f5',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: isCredit ? '#f0fdf4' : '#fef2f2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>{icons[txn.type] || '💰'}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{labels[txn.type] || txn.type}</div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
            {txn.description && txn.description.length > 40
              ? txn.description.slice(0, 40) + '...'
              : txn.description}
          </div>
          <div style={{ fontSize: 10, color: '#ccc', marginTop: 1 }}>
            {new Date(txn.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
      <div style={{
        fontWeight: 800, fontSize: 15,
        color: isCredit ? '#16a34a' : '#dc2626',
      }}>
        {isCredit ? '+' : ''}₹{Math.abs(txn.amount) / 100}
      </div>
    </div>
  )
}

export default function Wallet() {
  const { user } = useAuth()
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRecharge, setShowRecharge] = useState(false)
  const [selectedAmount, setSelectedAmount] = useState(50)
  const [customAmount, setCustomAmount] = useState('')
  const [recharging, setRecharging] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => { fetchWallet() }, [])

  async function fetchWallet() {
    setLoading(true)
    const [walletRes, txnRes] = await Promise.all([
      supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
    ])

    // Create wallet if doesn't exist
    if (!walletRes.data) {
      const { data: newWallet } = await supabase.from('wallets').insert({
        user_id: user.id, balance: 1000
      }).select().single()
      await supabase.from('wallet_transactions').insert({
        user_id: user.id, amount: 1000, type: 'signup_bonus', description: 'Welcome bonus - ₹10 free credits!'
      })
      setWallet(newWallet)
    } else {
      setWallet(walletRes.data)
    }

    setTransactions(txnRes.data || [])
    setLoading(false)
  }

  async function handleRecharge() {
    const amount = customAmount ? parseInt(customAmount) : selectedAmount
    if (!amount || amount < 20) { alert('Minimum recharge is ₹20'); return }
    if (amount > 10000) { alert('Maximum recharge is ₹10,000'); return }

    setRecharging(true)

    // TODO: Replace with real Razorpay when live
    // For now simulate recharge
    const amountPaise = amount * 100

    await supabase.from('wallets').update({
      balance: (wallet?.balance || 0) + amountPaise,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id)

    await supabase.from('wallet_transactions').insert({
      user_id: user.id,
      amount: amountPaise,
      type: 'recharge',
      description: `Wallet recharge of ₹${amount}`,
    })

    setRecharging(false)
    setShowRecharge(false)
    setCustomAmount('')
    setSelectedAmount(50)
    setSuccess(`₹${amount} added to your wallet! ✅`)
    setTimeout(() => setSuccess(''), 3000)
    fetchWallet()
  }

  const balanceRupees = (wallet?.balance || 0) / 100
  const isLowBalance = balanceRupees < 10

  return (
    <div style={{ background: '#f5f6fa', minHeight: '100vh', paddingBottom: 90 }}>

      {/* Header */}
      <div style={{ background: '#111', padding: '20px 16px 24px' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 20 }}>
          💰 My Wallet
        </div>

        {/* Balance card */}
        <div style={{
          background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
          borderRadius: 20, padding: '24px 20px',
          border: '1px solid #333',
        }}>
          <div style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>Available Balance</div>
          <div style={{ color: '#facc15', fontWeight: 800, fontSize: 42, letterSpacing: '-1px' }}>
            ₹{balanceRupees.toFixed(0)}
          </div>
          {isLowBalance && (
            <div style={{ marginTop: 10, background: 'rgba(239,68,68,0.15)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(239,68,68,0.3)' }}>
              <div style={{ color: '#ef4444', fontSize: 12, fontWeight: 600 }}>
                ⚠️ Low balance! Recharge to continue booking or posting rides.
              </div>
            </div>
          )}
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button onClick={() => setShowRecharge(true)} style={{
              flex: 1, padding: '12px', background: '#facc15', color: '#111',
              border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>
              + Add Money
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {success && (
          <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '12px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
            {success}
          </div>
        )}

        {/* How it works */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>How Wallet Works</div>
          {[
            ['🎁', 'Free ₹10', 'Given to every new user on signup'],
            ['🎫', '₹2 deducted', 'When you book a seat'],
            ['🚗', '₹2 deducted', 'When someone books your ride'],
            ['↩️', '₹2 refunded', 'If booking is cancelled by anyone'],
            ['💳', 'Recharge', 'Add ₹20, ₹50, ₹100 or custom amount'],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
              <div>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{title}</span>
                <span style={{ color: '#888', fontSize: 12 }}> — {desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Transaction history */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Transaction History</div>
          <div style={{ color: '#aaa', fontSize: 11, marginBottom: 14 }}>Last 30 transactions</div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#aaa' }}>Loading...</div>
          ) : transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#aaa', fontSize: 13 }}>
              No transactions yet
            </div>
          ) : (
            transactions.map(txn => <TransactionItem key={txn.id} txn={txn} />)
          )}
        </div>
      </div>

      {/* Recharge bottom sheet */}
      {showRecharge && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 100, display: 'flex', alignItems: 'flex-end',
        }}>
          <div style={{
            background: '#fff', borderRadius: '20px 20px 0 0',
            width: '100%', padding: '24px 20px 40px',
          }}>
            <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 4, margin: '0 auto 20px' }} />
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Add Money</div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
              Current balance: <strong>₹{balanceRupees.toFixed(0)}</strong>
            </div>

            {/* Quick amounts */}
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Quick Add</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {RECHARGE_OPTIONS.map(amt => (
                <button key={amt} onClick={() => { setSelectedAmount(amt); setCustomAmount('') }} style={{
                  flex: 1, padding: '12px 8px', borderRadius: 12, cursor: 'pointer',
                  border: `2px solid ${selectedAmount === amt && !customAmount ? '#111' : '#e5e7eb'}`,
                  background: selectedAmount === amt && !customAmount ? '#111' : '#fff',
                  color: selectedAmount === amt && !customAmount ? '#fff' : '#333',
                  fontWeight: 700, fontSize: 16,
                }}>₹{amt}</button>
              ))}
            </div>

            {/* Custom amount */}
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Or Enter Amount</div>
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, fontWeight: 700, color: '#333' }}>₹</span>
              <input
                type="number"
                placeholder="Minimum ₹20"
                value={customAmount}
                onChange={e => { setCustomAmount(e.target.value); setSelectedAmount(0) }}
                style={{ width: '100%', padding: '12px 14px 12px 30px', border: '1.5px solid #e5e7eb', borderRadius: 12, fontSize: 16, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            {/* Summary */}
            <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#888' }}>Adding to wallet</span>
                <span style={{ fontWeight: 700 }}>₹{customAmount || selectedAmount || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}>
                <span style={{ color: '#888' }}>New balance</span>
                <span style={{ fontWeight: 700, color: '#16a34a' }}>
                  ₹{(balanceRupees + Number(customAmount || selectedAmount || 0)).toFixed(0)}
                </span>
              </div>
            </div>

            <button onClick={handleRecharge} disabled={recharging} style={{
              width: '100%', padding: 15, background: '#111', color: '#fff',
              border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 10,
            }}>
              {recharging ? 'Processing...' : `💳 Pay ₹${customAmount || selectedAmount || 0} via UPI`}
            </button>
            <button onClick={() => { setShowRecharge(false); setCustomAmount('') }} style={{
              width: '100%', padding: 12, background: '#f3f4f6', color: '#666',
              border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
