import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const TYPES = [
  { id: 'suggestion', label: '💡 Feature Suggestion', desc: 'Suggest something new' },
  { id: 'bug', label: '🐛 Report a Bug', desc: 'Something not working right' },
  { id: 'feature', label: '🚀 Improvement Idea', desc: 'Make existing features better' },
  { id: 'other', label: '💬 General Feedback', desc: 'Anything else on your mind' },
]

export default function Feedback() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [type, setType] = useState('suggestion')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [myFeedback, setMyFeedback] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchMyFeedback() }, [])

  async function fetchMyFeedback() {
    const { data } = await supabase
      .from('feedback')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setMyFeedback(data || [])
    setLoading(false)
  }

  async function submit() {
    if (!message.trim()) return
    if (message.trim().length < 10) { alert('Please write at least 10 characters'); return }
    setSubmitting(true)
    await supabase.from('feedback').insert({
      user_id: user.id,
      type,
      message: message.trim(),
      status: 'open',
    })
    setSubmitted(true)
    setMessage('')
    setSubmitting(false)
    fetchMyFeedback()
    setTimeout(() => setSubmitted(false), 3000)
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const statusColor = { open: '#666', replied: '#16a34a', closed: '#2563eb' }
  const statusLabel = { open: '⏳ Pending', replied: '✅ Replied', closed: '✓ Closed' }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: '#111', padding: '20px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>←</button>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>💡 Suggest a Feature</div>
        </div>
        <div style={{ color: '#666', fontSize: 12, marginLeft: 36 }}>
          Your feedback shapes CarpoolKaro. We read every message.
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Submit form */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Share your thoughts</div>

          {/* Type selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {TYPES.map(t => (
              <button key={t.id} onClick={() => setType(t.id)} style={{
                padding: '10px', background: type === t.id ? '#fefce8' : '#f8f9fa',
                border: `2px solid ${type === t.id ? '#facc15' : '#f0f0f0'}`,
                borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{t.label}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{t.desc}</div>
              </button>
            ))}
          </div>

          {/* Message */}
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Describe your idea or feedback in detail... The more specific, the better!"
            rows={5}
            style={{
              width: '100%', padding: '12px', border: '1px solid #e5e7eb', borderRadius: 10,
              fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none',
              boxSizing: 'border-box', lineHeight: 1.5, color: '#111',
            }}
          />
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12 }}>
            {message.length}/500 characters
          </div>

          {submitted ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 14, textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>
              ✅ Thank you! We'll review your feedback.
            </div>
          ) : (
            <button onClick={submit} disabled={!message.trim() || submitting} style={{
              width: '100%', padding: 14, background: message.trim() ? '#111' : '#f0f0f0',
              color: message.trim() ? '#facc15' : '#aaa', border: 'none', borderRadius: 10,
              fontWeight: 700, fontSize: 15, cursor: message.trim() ? 'pointer' : 'default',
            }}>
              {submitting ? '⏳ Submitting...' : '📤 Submit Feedback'}
            </button>
          )}
        </div>

        {/* Past feedback */}
        {myFeedback.length > 0 && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#555', marginBottom: 10 }}>
              Your previous submissions
            </div>
            {myFeedback.map(fb => (
              <div key={fb.id} style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#888' }}>
                    {TYPES.find(t => t.id === fb.type)?.label || fb.type}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: statusColor[fb.status] }}>
                    {statusLabel[fb.status]}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: '#111', lineHeight: 1.5, marginBottom: 8 }}>
                  {fb.message}
                </div>
                <div style={{ fontSize: 11, color: '#bbb' }}>{fmtDate(fb.created_at)}</div>

                {/* Admin reply */}
                {fb.admin_reply && (
                  <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 12px', marginTop: 10, border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, marginBottom: 4 }}>
                      ✅ Team CarpoolKaro replied:
                    </div>
                    <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.5 }}>{fb.admin_reply}</div>
                    <div style={{ fontSize: 10, color: '#86efac', marginTop: 4 }}>
                      {fmtDate(fb.replied_at)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
