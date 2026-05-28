import { useState, useRef, useEffect } from 'react'
import { getLocationsForCity } from '../lib/cityLocations'

const AREAS = [
  // ── IT HUBS & TECH PARKS ───────────────────────────
  'HITEC City', 'Hitech City', 'Madhapur', 'Raheja Mindspace', 'Mindspace Madhapur',
  'Financial District', 'Nanakramguda', 'WaveRock SEZ', 'DLF Cyber City',
  'Gachibowli', 'Divyasree Orion', 'Salarpuria Knowledge City',
  'Kokapet', 'GAR Kokapet', 'Raidurgam', 'Khajaguda',
  'Manikonda', 'Narsingi', 'Puppalaguda', 'Tellapur', 'Gopanpally',
  'Kondapur', 'Kothaguda', 'Mindspace Pocharam', 'Pocharam', 'Nacharam',
  'TCS Synergy Park', 'L&T Infocity', 'Cyberabad', 'Vanenburg IT Park',
  'ISB Campus', 'Incor 9', 'Lanco Hills', 'Phoenix Hyderabad',

  // ── MAJOR COMPANY CAMPUSES ─────────────────────────
  'Amazon Hyderabad', 'Amazon Campus Nanakramguda',
  'Microsoft Campus Hyderabad', 'Google Hyderabad',
  'Oracle Hyderabad', 'Facebook Hyderabad',
  'Infosys Pocharam', 'TCS Gachibowli', 'Wipro Gachibowli', 'Wipro SEZ',
  'Accenture Gachibowli', 'Capgemini Gachibowli',
  'Cognizant Gachibowli', 'HCL Uppal', 'IBM Gachibowli',
  'Tech Mahindra Gachibowli', 'Deloitte Hyderabad',
  'JP Morgan Madhapur', 'Apple India Hyderabad',

  // ── WEST HYDERABAD (residential near IT) ──────────
  'Miyapur', 'KPHB', 'Kukatpally', 'Bachupally', 'Nizampet',
  'Chanda Nagar', 'Chandanagar', 'Lingampally', 'Hafeezpet',
  'Pragathi Nagar', 'Serilingampally', 'Nallagandla',
  'Patancheru', 'Isnapur', 'Dundigal', 'Quthbullapur',

  // ── GACHIBOWLI / SOUTH-WEST ────────────────────────
  'Attapur', 'Rajendra Nagar', 'Gandipet', 'Kismatpur',
  'Bandlaguda', 'Shadnagar', 'Maheshwaram', 'Adibatla',

  // ── MADHAPUR / JUBILEE / BANJARA ──────────────────
  'Jubilee Hills', 'Banjara Hills', 'Film Nagar', 'Panjagutta',
  'Kavuri Hills', 'Durgam Cheruvu', 'Ayyappa Society',

  // ── CENTRAL HYDERABAD ─────────────────────────────
  'Ameerpet', 'SR Nagar', 'Punjagutta', 'Somajiguda',
  'Khairatabad', 'Lakdikapul', 'Mehdipatnam', 'Tolichowki',
  'Masab Tank', 'Himayatnagar', 'Narayanguda',
  'Erragadda', 'Sanath Nagar', 'Rethibowli',
  'Koti', 'Abids', 'Nampally', 'Sultan Bazar',

  // ── NORTH HYDERABAD ───────────────────────────────
  'Secunderabad', 'Begumpet', 'Old Bowenpally', 'Bowenpally',
  'Trimulgherry', 'Karkhana', 'Maredpally', 'Paradise',
  'Rasoolpura', 'Lalaguda', 'Tirumalagiri',
  'Jeedimetla', 'IDA Jeedimetla', 'Balanagar',
  'Alwal', 'Malkajgiri', 'Sainikpuri', 'AS Rao Nagar',
  'Yapral', 'Kapra', 'Ecil', 'Kushaiguda', 'Neredmet',
  'Kompally', 'Medchal', 'Shamirpet', 'Kandlakoya',

  // ── EAST HYDERABAD ─────────────────────────────────
  'Uppal', 'Uppal Ring Road', 'Uppal Metro',
  'Nagole', 'Nagole Metro', 'LB Nagar', 'Dilsukhnagar',
  'Kothapet', 'Mallapur', 'Habsiguda',
  'Tarnaka', 'Mettuguda', 'Boduppal',
  'Peerzadiguda', 'Ghatkesar', 'Medipally',
  'Hayathnagar', 'Vanasthalipuram', 'Saroornagar',
  'Ramanthapur', 'Amberpet', 'Moulali', 'Chilkalguda',

  // ── METRO STATIONS ────────────────────────────────
  'Miyapur Metro', 'JNTU Metro', 'KPHB Metro', 'Kukatpally Metro',
  'Balanagar Metro', 'Moosapet Metro', 'Bharat Nagar Metro',
  'Erragadda Metro', 'SR Nagar Metro', 'Ameerpet Metro',
  'Punjagutta Metro', 'Khairatabad Metro', 'Lakdikapul Metro',
  'Assembly Metro', 'Nampally Metro', 'Gandhi Bhavan Metro',
  'Dilsukhnagar Metro', 'Chaitanyapuri Metro', 'LB Nagar Metro',
  'Habsiguda Metro', 'Tarnaka Metro', 'Mettuguda Metro',
  'Secunderabad East Metro', 'Secunderabad Metro', 'Paradise Metro',
  'Begumpet Metro', 'Yusufguda Metro', 'Madhura Nagar Metro',
  'Vittal Rao Nagar Metro', 'Madhapur Metro', 'Durgam Cheruvu Metro',
  'Hitec City Metro', 'Raidurg Metro',

  // ── AIRPORT & ORR ─────────────────────────────────
  'Rajiv Gandhi International Airport', 'RGI Airport', 'Shamshabad',
  'ORR Gachibowli', 'ORR Patancheru', 'ORR Shamshabad', 'ORR Kompally',
]

export default function LocationInput({ label, value, onChange, placeholder, city }) {
  const AREAS = getLocationsForCity(city || 'Hyderabad')
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
      const filtered = AREAS.filter(a =>
        a.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 6)
      setSuggestions(filtered)
      setShowDropdown(true)
    } else {
      setSuggestions(AREAS.slice(0, 6))
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
      ? AREAS.filter(a => a.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
      : AREAS.slice(0, 6)
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
          {query && !AREAS.some(a => a.toLowerCase() === query.toLowerCase()) && (
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
