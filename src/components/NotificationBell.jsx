import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const bellRef = React.useRef(null)

  React.useEffect(() => {
    function handleOutsideClick(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])
  const unread = notifications.filter(n => !n.is_read).length

  useEffect(() => {
    if (!user) return
    fetchNotifications()

    // Realtime — new notification comes in instantly
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev])
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user])

  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications(data || [])
  }

  async function markAllRead() {
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  function timeAgo(date) {
    const mins = Math.floor((Date.now() - new Date(date)) / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div ref={bellRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(!open); if (!open && unread > 0) markAllRead() }}
        style={{
          background: '#222', border: 'none', borderRadius: 10,
          padding: '8px 12px', cursor: 'pointer', position: 'relative',
          fontSize: 18,
        }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            background: '#ef4444', color: '#fff',
            borderRadius: '50%', width: 16, height: 16,
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '110%', right: 0,
          width: 300, maxHeight: 400, overflowY: 'auto',
          background: '#fff', borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          zIndex: 200, border: '1px solid #f0f0f0',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #f0f0f0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{
                background: 'none', border: 'none', color: '#2563eb',
                fontSize: 11, cursor: 'pointer', fontWeight: 600,
              }}>Mark all read</button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
              No notifications yet
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} style={{
                padding: '12px 16px',
                background: n.is_read ? '#fff' : '#f0f4ff',
                borderBottom: '1px solid #f5f5f5',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2, lineHeight: 1.5 }}>{n.message}</div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
