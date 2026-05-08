// City data — expandable to other cities
export const CITIES = {
  hyderabad: {
    name: 'Hyderabad',
    state: 'Telangana',
    icon: '🏙️',
    active: true,
    areas: [
      // IT Corridors
      { name: 'HITEC City', zone: 'IT Corridor' },
      { name: 'Madhapur', zone: 'IT Corridor' },
      { name: 'Gachibowli', zone: 'IT Corridor' },
      { name: 'Kondapur', zone: 'IT Corridor' },
      { name: 'Kokapet', zone: 'IT Corridor' },
      { name: 'Nanakramguda', zone: 'IT Corridor' },
      { name: 'Financial District', zone: 'IT Corridor' },
      { name: 'Mindspace', zone: 'IT Corridor' },
      { name: 'DLF Cybercity', zone: 'IT Corridor' },
      { name: 'WaveRock', zone: 'IT Corridor' },
      { name: 'Raheja Mindspace', zone: 'IT Corridor' },
      { name: 'Salarpuria', zone: 'IT Corridor' },
      { name: 'GAR Kokapet', zone: 'IT Corridor' },
      { name: 'Lakshmi Infobahn', zone: 'IT Corridor' },
      { name: 'ISB Hyderabad', zone: 'IT Corridor' },
      { name: 'Jubilee Hills', zone: 'IT Corridor' },
      { name: 'Banjara Hills', zone: 'IT Corridor' },
      { name: 'Khajaguda', zone: 'IT Corridor' },
      { name: 'Narsingi', zone: 'IT Corridor' },
      { name: 'Puppalaguda', zone: 'IT Corridor' },
      { name: 'Manikonda', zone: 'IT Corridor' },
      { name: 'Tellapur', zone: 'IT Corridor' },
      { name: 'Gopanpally', zone: 'IT Corridor' },
      // East
      { name: 'Uppal Ring Road', zone: 'East' },
      { name: 'Uppal', zone: 'East' },
      { name: 'Nagole', zone: 'East' },
      { name: 'LB Nagar', zone: 'East' },
      { name: 'Dilsukhnagar', zone: 'East' },
      { name: 'Vanasthalipuram', zone: 'East' },
      { name: 'Hayathnagar', zone: 'East' },
      { name: 'Pocharam', zone: 'East' },
      { name: 'Ghatkesar', zone: 'East' },
      { name: 'Boduppal', zone: 'East' },
      { name: 'Peerzadiguda', zone: 'East' },
      { name: 'Medipally', zone: 'East' },
      { name: 'Tarnaka', zone: 'East' },
      { name: 'Malkajgiri', zone: 'East' },
      { name: 'Sainikpuri', zone: 'East' },
      { name: 'ECIL', zone: 'East' },
      { name: 'Kapra', zone: 'East' },
      { name: 'AS Rao Nagar', zone: 'East' },
      // West
      { name: 'Kukatpally', zone: 'West' },
      { name: 'KPHB', zone: 'West' },
      { name: 'Miyapur', zone: 'West' },
      { name: 'Bachupally', zone: 'West' },
      { name: 'Kompally', zone: 'West' },
      { name: 'Nizampet', zone: 'West' },
      { name: 'Chandanagar', zone: 'West' },
      { name: 'Lingampally', zone: 'West' },
      { name: 'Patancheru', zone: 'West' },
      { name: 'Jeedimetla', zone: 'West' },
      { name: 'Balanagar', zone: 'West' },
      // North
      { name: 'Secunderabad', zone: 'North' },
      { name: 'Begumpet', zone: 'North' },
      { name: 'Bowenpally', zone: 'North' },
      { name: 'Trimulgherry', zone: 'North' },
      { name: 'Maredpally', zone: 'North' },
      { name: 'Paradise', zone: 'North' },
      { name: 'SD Road', zone: 'North' },
      { name: 'Rasoolpura', zone: 'North' },
      // Central
      { name: 'Ameerpet', zone: 'Central' },
      { name: 'SR Nagar', zone: 'Central' },
      { name: 'Punjagutta', zone: 'Central' },
      { name: 'Somajiguda', zone: 'Central' },
      { name: 'Mehdipatnam', zone: 'Central' },
      { name: 'Tolichowki', zone: 'Central' },
      { name: 'Attapur', zone: 'Central' },
      { name: 'Masab Tank', zone: 'Central' },
      { name: 'Erragadda', zone: 'Central' },
      // South
      { name: 'Rajendra Nagar', zone: 'South' },
      { name: 'Owaisi', zone: 'South' },
      { name: 'Shamshabad', zone: 'South' },
      { name: 'RGI Airport', zone: 'South' },
    ]
  },
  bengaluru: {
    name: 'Bengaluru',
    state: 'Karnataka',
    icon: '🌆',
    active: false, // Coming soon
    areas: []
  },
  pune: {
    name: 'Pune',
    state: 'Maharashtra',
    icon: '🏛️',
    active: false,
    areas: []
  },
  chennai: {
    name: 'Chennai',
    state: 'Tamil Nadu',
    icon: '🌊',
    active: false,
    areas: []
  },
  delhi: {
    name: 'Delhi NCR',
    state: 'Delhi',
    icon: '🏰',
    active: false,
    areas: []
  },
}

export function getAreasForCity(cityKey) {
  return CITIES[cityKey]?.areas?.map(a => a.name) || []
}

export function getZones(cityKey) {
  const areas = CITIES[cityKey]?.areas || []
  const zones = {}
  areas.forEach(a => {
    if (!zones[a.zone]) zones[a.zone] = []
    zones[a.zone].push(a.name)
  })
  return zones
}
