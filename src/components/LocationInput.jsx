import { useState, useRef, useEffect } from 'react'

const SUGGESTED_AREAS = [
  // IT Corridors & Tech Parks
  'HITEC City', 'Madhapur', 'Gachibowli', 'Kondapur', 'Kokapet',
  'Nanakramguda', 'Financial District', 'Mindspace', 'DLF Cybercity',
  'Raheja Mindspace', 'WaveRock', 'Salarpuria', 'Incor 9',
  'Divyasree Techno Park', 'Lanco Hills', 'Aparna Cyber Life',
  'ISB Hyderabad', 'BITS Hyderabad', 'Inorbit Mall', 'Jubilee Hills',
  'Banjara Hills', 'Khajaguda', 'Narsingi', 'Puppalaguda',
  'Manikonda', 'Tellapur', 'Gopanpally', 'Serilingampally',

  // East Hyderabad
  'Uppal Ring Road', 'Uppal', 'Nagole', 'LB Nagar', 'Dilsukhnagar',
  'Vanasthalipuram', 'Hayathnagar', 'Pocharam', 'Ghatkesar',
  'Boduppal', 'Peerzadiguda', 'Medipally', 'Ramanthapur',
  'Tarnaka', 'Malkajgiri', 'Sainikpuri', 'Neredmet',
  'AS Rao Nagar', 'ECIL', 'Kapra', 'Kushaiguda',

  // West Hyderabad
  'Kukatpally', 'KPHB', 'Miyapur', 'Bachupally', 'Kompally',
  'Nizampet', 'Pragati Nagar', 'Chandanagar', 'Lingampally',
  'Patancheru', 'Isnapur', 'Dundigal', 'Quthbullapur',
  'Alwal', 'Suraram', 'Jeedimetla', 'Balanagar',

  // North Hyderabad
  'Secunderabad', 'Begumpet', 'Bowenpally', 'Trimulgherry',
  'Karkhana', 'Maredpally', 'Marredpally', 'Paradise',
  'SD Road', 'Clock Tower', 'West Maredpally', 'East Marredpally',
  'Lalaguda', 'Tirumalagiri', 'Rasoolpura',

  // Central Hyderabad
  'Ameerpet', 'SR Nagar', 'Erragadda', 'Sanath Nagar',
  'Punjagutta', 'Somajiguda', 'Raj Bhavan', 'Lakdi Ka Pul',
  'Nampally', 'Abids', 'Koti', 'Sultan Bazar', 'Mozamjahi Market',
  'Charminar', 'Falaknuma', 'Mehdipatnam', 'Masab Tank',
  'Tolichowki', 'Attapur', 'Rethibowli',

  // South Hyderabad
  'Rajendra Nagar', 'Owaisi', 'Shamshabad', 'RGI Airport',
  'Shamirpet', 'Medchal', 'Kandlakoya', 'Keesara',

  // Outer Ring Road & New Areas
  'Kokapet ORR', 'Nanakramguda ORR', 'Gachibowli ORR',
  'Shamshabad ORR', 'Patancheru ORR', 'Kompally ORR',

  // IT Company Areas
  'GAR Kokapet', 'Lakshmi Infobahn', 'Phoenix Hyderabad',
  'L&T Infocity', 'Tata Consultancy Deccan Park', 'Infosys SDB',
  'Wipro SEZ', 'Capgemini Gachibowli', 'Accenture Hi-Tech City',
  'Microsoft Hyderabad', 'Amazon Hyderabad', 'Google Hyderabad',
  'Facebook Hyderabad', 'Apple India', 'Deloitte Hyderabad',
]

export default function LocationInput({ label, value, onChange, placeholder }) {
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const ref = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Sync if value changes from outside
  useEffect(() => { setQuery(value || '') }, [value])

  function handleInput(e) {
    const val = e.target.value
    setQuery(val)
    onChange(val) // allow free text — user can type anything

    if (val.length > 0) {
      const filtered = SUGGESTED_AREAS.filter(a =>
        a.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 6)
      setSuggestions(filtered)
      setShowDropdown(true)
    } else {
      setSuggestions(SUGGESTED_AREAS.slice(0, 6))
      setShowDropdown(true)
    }
  }

  function handleSelect(area) {
    setQuery(area)
    onChange(area)
    setShowDropdown(false)
  }

  function handleFocus() {
    const filtered = query
      ? SUGGESTED_AREAS.filter(a => a.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
      : SUGGESTED_AREAS.slice(0, 6)
    setSuggestions(filtered)
    setShowDropdown(true)
  }

  return (
    <div ref={ref} style={{ marginBottom: 14, position: 'relative' }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5, display: 'block' }}>
          {label}
        </label>
      )}
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={handleFocus}
        placeholder={placeholder || 'Type or search area...'}
        style={{
          width: '100%', padding: '11px 14px',
          border: '1.5px solid #e5e7eb', borderRadius: 10,
          fontSize: 14, background: '#fafafa',
          fontFamily: 'inherit', boxSizing: 'border-box',
          borderColor: showDropdown ? '#111' : '#e5e7eb',
        }}
      />

      {/* Dropdown suggestions */}
      {showDropdown && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: '#fff', borderRadius: 10, zIndex: 999,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          border: '1px solid #e5e7eb', overflow: 'hidden',
          maxHeight: 200, overflowY: 'auto',
        }}>
          {/* Show "use typed text" option if not in list */}
          {query && !SUGGESTED_AREAS.some(a => a.toLowerCase() === query.toLowerCase()) && (
            <div
              onClick={() => handleSelect(query)}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                background: '#f8f9fa', color: '#2563eb', fontWeight: 600,
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              ✏️ Use "{query}"
            </div>
          )}
          {suggestions.map(area => (
            <div
              key={area}
              onClick={() => handleSelect(area)}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                color: '#333', borderBottom: '1px solid #f5f5f5',
                background: area === value ? '#f0f4ff' : '#fff',
                fontWeight: area === value ? 600 : 400,
              }}
              onMouseEnter={e => e.target.style.background = '#f5f6fa'}
              onMouseLeave={e => e.target.style.background = area === value ? '#f0f4ff' : '#fff'}
            >
              📍 {area}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
