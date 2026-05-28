import { useState, useRef, useEffect } from 'react'

const CITY_LOCATIONS = {
  'Hyderabad': ['HITEC City','Madhapur','Financial District','Gachibowli','Kokapet','Raidurgam','Kondapur','Manikonda','Narsingi','Nanakramguda','WaveRock SEZ','DLF Cyber City','Mindspace Madhapur','Salarpuria Knowledge City','Divyasree Orion','Khajaguda','Pocharam','Nacharam','Mindspace Pocharam','TCS Synergy Park','Cyberabad','Amazon Hyderabad','Microsoft Campus','Google Hyderabad','Infosys Pocharam','TCS Gachibowli','Wipro Gachibowli','Accenture Gachibowli','Capgemini Gachibowli','Cognizant Gachibowli','Tech Mahindra Gachibowli','IBM Gachibowli','JP Morgan Madhapur','Deloitte Hyderabad','HCL Uppal','Miyapur','KPHB','Kukatpally','Bachupally','Nizampet','Lingampally','Chandanagar','Hafeezpet','Tellapur','Nallagandla','Serilingampally','Jubilee Hills','Banjara Hills','Panjagutta','Film Nagar','Kavuri Hills','Ameerpet','SR Nagar','Somajiguda','Khairatabad','Mehdipatnam','Tolichowki','Secunderabad','Begumpet','Jeedimetla','Balanagar','Kompally','Medchal','Uppal','LB Nagar','Dilsukhnagar','Nagole','Boduppal','Ghatkesar','Miyapur Metro','KPHB Metro','Ameerpet Metro','Hitec City Metro','Raidurg Metro','Nagole Metro','Uppal Metro','LB Nagar Metro','Secunderabad Metro','Rajiv Gandhi International Airport','Shamshabad'],
  'Bangalore': ['Whitefield','Marathahalli','Bellandur','Sarjapur Road','Outer Ring Road','Electronic City','Electronic City Phase 1','Electronic City Phase 2','Koramangala','HSR Layout','BTM Layout','Silk Board','Bommanahalli','Hebbal','Manyata Tech Park','Kirloskar Business Park','Yeshwanthpur','Rajajinagar','Indiranagar','CV Raman Nagar','Domlur','Airport Road','Jayanagar','JP Nagar','Bannerghatta Road','Yelahanka','Devanahalli','Kempegowda International Airport','Bagmane Tech Park','RMZ Infinity','Prestige Tech Park','Embassy TechVillage','Cessna Business Park','Ecospace','IBM Manyata','Cisco Bangalore','SAP Bangalore','Amazon Bangalore','Flipkart HQ','Infosys Bangalore','Wipro Sarjapur','HCL Bangalore','TCS Bangalore','Accenture Bangalore','MG Road','Church Street','Majestic','Shivajinagar'],
  'Pune': ['Hinjewadi','Hinjewadi Phase 1','Hinjewadi Phase 2','Hinjewadi Phase 3','Kharadi','Magarpatta','EON IT Park','World Trade Center Pune','Wakad','Baner','Balewadi','Sus Road','Viman Nagar','Kalyani Nagar','Nagar Road','Hadapsar','Fursungi','Aundh','Pimple Saudagar','Pimple Nilakh','Punawale','Shivajinagar','FC Road','JM Road','Deccan','Kothrud','Warje','Karve Road','Yerwada','Koregaon Park','Talegaon','Chakan','Infosys Pune','Wipro Pune','Cognizant Pune','TCS Pune','Zensar Pune','Tech Mahindra Pune','Persistent Pune','Katraj','Kondhwa','NIBM Road','Mundhwa','Commerzone','RMZ Westend'],
  'Mumbai': ['BKC','Bandra Kurla Complex','Bandra East','Bandra West','Powai','Hiranandani','Chandivali','SEEPZ','Andheri East','Andheri West','MIDC Andheri','Marol','Lower Parel','Worli','Kamala Mills','One BKC','Navi Mumbai','Belapur','Vashi','Nerul','Ghansoli','Mahape','Thane','Wagle Estate','Kolshet','Majiwada','Malad','Mindspace Malad','Link Road','Goregaon','NESCO IT Park','Goregaon East','Vikhroli','Kanjurmarg','LBS Marg','Kurla','Kalina','Santacruz East','Nariman Point','Fort','CSMT','Churchgate','Airoli','Rabale','TTC Industrial Area','Chembur','Ghatkopar','Mulund','Borivali','Kandivali','Dahisar','Chhatrapati Shivaji Airport','CSIA'],
  'Delhi NCR': ['Noida Sector 62','Noida Sector 63','Noida Sector 125','Noida Sector 132','Noida Sector 135','Noida Sector 142','Noida Sector 143','Noida Expressway','Noida City Centre','Botanical Garden','Gurugram','Gurgaon','Cyber City','DLF Phase 1','DLF Phase 2','DLF Phase 3','DLF Phase 4','DLF Phase 5','Golf Course Road','Sohna Road','NH 8','Udyog Vihar','MG Road Gurgaon','IFFCO Chowk','Manesar','IMT Manesar','Greater Noida','Alpha 1','Alpha 2','Knowledge Park','Techzone 4','Connaught Place','Barakhamba','Janpath','Nehru Place','Okhla','Saket','Malviya Nagar','Vasant Kunj','Vasant Vihar','RK Puram','Dwarka','Dwarka Sector 10','Dwarka Sector 21','Rohini','Pitampura','Laxmi Nagar','Preet Vihar','IP Extension','IGI Airport','Aerocity','TCS Noida','Infosys Noida','HCL Noida','Accenture Gurgaon','Wipro Gurgaon','IBM Gurgaon','Microsoft Noida','Adobe Noida','Samsung Noida'],
  'Chennai': ['OMR','Old Mahabalipuram Road','Sholinganallur','Perungudi','Taramani','Thoraipakkam','Karapakkam','Siruseri','SIPCOT IT Park','Tidel Park','RMZ Millenia','Ascendas IT Park','Anna Nagar','Anna Nagar West','Anna Nagar East','Nungambakkam','Egmore','T Nagar','Velachery','Medavakkam','Pallikaranai','Tambaram','Chrompet','Pallavaram','Porur','Ramapuram','Vadapalani','Guindy','Ekkatuthangal','St Thomas Mount','Ambattur','Ambattur Industrial Estate','Adyar','Besant Nagar','Thiruvanmiyur','Mylapore','Alwarpet','Kotturpuram','Maraimalai Nagar','Mahindra World City','TCS Chennai','Infosys Chennai','Wipro Chennai','Cognizant Chennai','HCL Chennai','Tech Mahindra Chennai','Chennai International Airport'],
}
function getLocationsForCity(city) {
  return CITY_LOCATIONS[city] || CITY_LOCATIONS['Hyderabad']
}

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
