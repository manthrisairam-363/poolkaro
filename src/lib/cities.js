// ============================================================
// CarpoolKaro — SINGLE SOURCE OF TRUTH for locations.
//
//   name    = canonical area (what the commute dropdown shows and what we
//             store); keep spellings stable — rides and commutes reference them
//   zone    = matching bucket (same zone ≈ same side of the city)
//   aliases = other spellings, campuses, tech parks, metro stations…
//             They appear in autocomplete and resolve to the area's zone.
//
// Used by: LocationInput (ride From/To autocomplete), Home (ride ranking +
// filter), CommuteSetup (dropdown + typed-area snap), Profile, Admin.
// To add a place: add it here, nowhere else. Admin → Commutes → "Custom areas
// to review" shows what users typed that is not here yet.
// ============================================================

export const CITY_NAMES = ['Hyderabad', 'Bangalore', 'Pune', 'Mumbai', 'Delhi NCR', 'Chennai']

export const CITIES = {
  hyderabad: {
    name: 'Hyderabad',
    state: 'Telangana',
    icon: '🏙️',
    active: true,
    areas: [
      // IT Corridor
      { name: 'HITEC City', zone: 'IT Corridor', aliases: ['Hitech City', 'Cyber Towers', 'Cyber Gateway', 'HUDA Techno Enclave', 'Cyberabad', 'L&T Infocity', 'Vanenburg IT Park', 'Hitec City Metro', 'Vittal Rao Nagar Metro', 'Phoenix Hyderabad', 'Oracle Hyderabad', 'Apple India Hyderabad', 'RMZ Futura', 'iLabs Centre'] },
      { name: 'Madhapur', zone: 'IT Corridor', aliases: ['Mindspace Madhapur', 'Mindspace', 'Raheja Mindspace', 'JP Morgan Madhapur', 'Inorbit Mall Area', 'Durgam Cheruvu', 'Durgam Cheruvu Metro', 'Madhapur Metro', 'Kavuri Hills', 'Ayyappa Society'] },
      { name: 'Kondapur', zone: 'IT Corridor', aliases: ['Kothaguda'] },
      { name: 'Gachibowli', zone: 'IT Corridor', aliases: ['TCS Gachibowli', 'Wipro Gachibowli', 'Accenture Gachibowli', 'Capgemini Gachibowli', 'Cognizant Gachibowli', 'Tech Mahindra Gachibowli', 'IBM Gachibowli', 'Deloitte Hyderabad', 'Microsoft Campus Hyderabad', 'Microsoft Hyderabad', 'Google Hyderabad', 'Facebook Hyderabad', 'Incor 9', 'ORR Gachibowli'] },
      { name: 'Financial District', zone: 'IT Corridor', aliases: ['Divyasree Orion'] },
      { name: 'Nanakramguda', zone: 'IT Corridor', aliases: ['Amazon Hyderabad', 'Amazon Campus Nanakramguda'] },
      { name: 'Kokapet', zone: 'IT Corridor', aliases: ['Lakshmi Infobahn'] },
      { name: 'GAR Kokapet', zone: 'IT Corridor' },
      { name: 'Raidurgam', zone: 'IT Corridor', aliases: ['Raidurg', 'Raidurg Metro'] },
      { name: 'Khajaguda', zone: 'IT Corridor' },
      { name: 'DLF Cyber City', zone: 'IT Corridor', aliases: ['DLF Cyber City Hyderabad', 'DLF Cybercity', 'DLF Hyderabad'] },
      { name: 'WaveRock SEZ', zone: 'IT Corridor', aliases: ['WaveRock', 'Wave Rock'] },
      { name: 'Salarpuria Knowledge City', zone: 'IT Corridor', aliases: ['Salarpuria'] },
      { name: 'ISB Hyderabad', zone: 'IT Corridor', aliases: ['ISB Campus', 'ISB'] },
      { name: 'Manikonda', zone: 'IT Corridor', aliases: ['Lanco Hills'] },
      { name: 'Narsingi', zone: 'IT Corridor' },
      { name: 'Puppalaguda', zone: 'IT Corridor' },
      { name: 'Serilingampally', zone: 'IT Corridor' },
      { name: 'Nallagandla', zone: 'IT Corridor', aliases: ['Aparna Cyberzone'] },
      { name: 'Gopanpally', zone: 'IT Corridor', aliases: ['Wipro SEZ'] },
      { name: 'Tellapur', zone: 'IT Corridor' },
      { name: 'Gandipet', zone: 'IT Corridor' },
      { name: 'Jubilee Hills', zone: 'IT Corridor', aliases: ['Film Nagar', 'Yusufguda', 'Yusufguda Metro'] },
      { name: 'Banjara Hills', zone: 'IT Corridor' },
      // East
      { name: 'Uppal', zone: 'East', aliases: ['HCL Uppal', 'Uppal Metro'] },
      { name: 'Uppal Ring Road', zone: 'East' },
      { name: 'Nagole', zone: 'East', aliases: ['Nagole Metro'] },
      { name: 'LB Nagar', zone: 'East', aliases: ['LB Nagar Metro'] },
      { name: 'Dilsukhnagar', zone: 'East', aliases: ['Dilsukhnagar Metro', 'Chaitanyapuri Metro'] },
      { name: 'Kothapet', zone: 'East' },
      { name: 'Vanasthalipuram', zone: 'East' },
      { name: 'Hayathnagar', zone: 'East' },
      { name: 'Hasthinapuram', zone: 'East' },
      { name: 'Saroornagar', zone: 'East' },
      { name: 'Pocharam', zone: 'East', aliases: ['Mindspace Pocharam', 'Infosys Pocharam', 'TCS Synergy Park'] },
      { name: 'Nacharam', zone: 'East', aliases: ['Mallapur'] },
      { name: 'Ghatkesar', zone: 'East' },
      { name: 'Boduppal', zone: 'East' },
      { name: 'Peerzadiguda', zone: 'East' },
      { name: 'Medipally', zone: 'East' },
      { name: 'Tarnaka', zone: 'East', aliases: ['Tarnaka Metro'] },
      { name: 'Habsiguda', zone: 'East', aliases: ['Habsiguda Metro'] },
      { name: 'Ramanthapur', zone: 'East' },
      { name: 'Amberpet', zone: 'East' },
      { name: 'Malkajgiri', zone: 'East', aliases: ['Neredmet'] },
      { name: 'Sainikpuri', zone: 'East', aliases: ['Yapral'] },
      { name: 'ECIL', zone: 'East', aliases: ['Kushaiguda'] },
      { name: 'AS Rao Nagar', zone: 'East' },
      { name: 'Kapra', zone: 'East' },
      { name: 'Moulali', zone: 'East' },
      { name: 'Malakpet', zone: 'East' },
      { name: 'Chaderghat', zone: 'East' },
      { name: 'Nalgonda X Roads', zone: 'East' },
      // West
      { name: 'Kukatpally', zone: 'West', aliases: ['Kukatpally Metro', 'JNTU Metro'] },
      { name: 'KPHB', zone: 'West', aliases: ['KPHB Metro'] },
      { name: 'Miyapur', zone: 'West', aliases: ['Miyapur Metro'] },
      { name: 'Bachupally', zone: 'West' },
      { name: 'Nizampet', zone: 'West' },
      { name: 'Pragathi Nagar', zone: 'West' },
      { name: 'Kompally', zone: 'West', aliases: ['ORR Kompally'] },
      { name: 'Chandanagar', zone: 'West', aliases: ['Chanda Nagar'] },
      { name: 'Lingampally', zone: 'West' },
      { name: 'Patancheru', zone: 'West', aliases: ['ORR Patancheru', 'Isnapur'] },
      { name: 'BHEL', zone: 'West' },
      { name: 'Ramachandrapuram', zone: 'West' },
      { name: 'Hafeezpet', zone: 'West' },
      { name: 'Jeedimetla', zone: 'West', aliases: ['IDA Jeedimetla', 'Dundigal', 'Quthbullapur'] },
      { name: 'Balanagar', zone: 'West', aliases: ['Balanagar Metro', 'Moosapet', 'Moosapet Metro'] },
      { name: 'Sanath Nagar', zone: 'West', aliases: ['Bharat Nagar Metro'] },
      { name: 'Borabanda', zone: 'West' },
      // North
      { name: 'Secunderabad', zone: 'North', aliases: ['Secunderabad Metro', 'Secunderabad East Metro', 'Jubilee Bus Station', 'Mettuguda', 'Mettuguda Metro', 'Chilkalguda', 'Lalaguda'] },
      { name: 'Begumpet', zone: 'North', aliases: ['Begumpet Metro'] },
      { name: 'Bowenpally', zone: 'North', aliases: ['New Bowenpally', 'Old Bowenpally'] },
      { name: 'Trimulgherry', zone: 'North', aliases: ['Tirumalagiri'] },
      { name: 'Maredpally', zone: 'North' },
      { name: 'Paradise', zone: 'North', aliases: ['Paradise Metro'] },
      { name: 'SD Road', zone: 'North' },
      { name: 'Rasoolpura', zone: 'North' },
      { name: 'Karkhana', zone: 'North' },
      { name: 'Alwal', zone: 'North' },
      { name: 'Medchal', zone: 'North' },
      { name: 'Shamirpet', zone: 'North', aliases: ['Kandlakoya'] },
      // Central
      { name: 'Ameerpet', zone: 'Central', aliases: ['Ameerpet Metro', 'Madhura Nagar Metro'] },
      { name: 'SR Nagar', zone: 'Central', aliases: ['SR Nagar Metro'] },
      { name: 'Punjagutta', zone: 'Central', aliases: ['Panjagutta', 'Punjagutta Metro'] },
      { name: 'Somajiguda', zone: 'Central' },
      { name: 'Khairatabad', zone: 'Central', aliases: ['Khairatabad Metro'] },
      { name: 'Mehdipatnam', zone: 'Central' },
      { name: 'Tolichowki', zone: 'Central' },
      { name: 'Shaikpet', zone: 'Central' },
      { name: 'Masab Tank', zone: 'Central' },
      { name: 'Erragadda', zone: 'Central', aliases: ['Erragadda Metro'] },
      { name: 'Lakdikapool', zone: 'Central', aliases: ['Lakdikapul', 'Lakdikapul Metro', 'Assembly Metro'] },
      { name: 'Nampally', zone: 'Central', aliases: ['Nampally Metro', 'MGBS'] },
      { name: 'Abids', zone: 'Central', aliases: ['Gandhi Bhavan Metro'] },
      { name: 'Koti', zone: 'Central' },
      { name: 'Sultan Bazar', zone: 'Central' },
      { name: 'Himayatnagar', zone: 'Central' },
      { name: 'Narayanguda', zone: 'Central' },
      { name: 'Attapur', zone: 'Central' },
      { name: 'Rethibowli', zone: 'Central' },
      // South
      { name: 'Rajendra Nagar', zone: 'South' },
      { name: 'Shamshabad', zone: 'South', aliases: ['Shamshabad Airport', 'ORR Shamshabad'] },
      { name: 'RGI Airport', zone: 'South', aliases: ['Rajiv Gandhi International Airport', 'Hyderabad Airport'] },
      { name: 'Owaisi', zone: 'South' },
      { name: 'Charminar', zone: 'South' },
      { name: 'Begum Bazar', zone: 'South' },
      { name: 'Kismatpur', zone: 'South' },
      { name: 'Bandlaguda', zone: 'South' },
      { name: 'Moinabad', zone: 'South' },
      { name: 'Shadnagar', zone: 'South' },
      { name: 'Maheshwaram', zone: 'South' },
      { name: 'Adibatla', zone: 'South' },
    ],
  },
  bengaluru: {
    name: 'Bangalore',
    state: 'Karnataka',
    icon: '🌳',
    active: true,
    areas: [
      // Whitefield & East
      { name: 'Whitefield', zone: 'Whitefield & East', aliases: ['ITPL', 'Brookefield', 'Kadugodi', 'Hoodi', 'Kundalahalli', 'SAP Bangalore', 'TCS Bangalore'] },
      { name: 'Marathahalli', zone: 'Whitefield & East', aliases: ['Prestige Tech Park'] },
      { name: 'KR Puram', zone: 'Whitefield & East' },
      { name: 'Mahadevapura', zone: 'Whitefield & East' },
      { name: 'Varthur', zone: 'Whitefield & East' },
      { name: 'CV Raman Nagar', zone: 'Whitefield & East', aliases: ['Bagmane Tech Park', 'RMZ Infinity'] },
      // Outer Ring Road
      { name: 'Bellandur', zone: 'Outer Ring Road', aliases: ['Embassy TechVillage', 'Embassy Tech Village', 'Ecospace', 'Cessna Business Park', 'Flipkart HQ', 'Accenture Bangalore', 'Amazon Bangalore', 'Cisco Bangalore', 'Kadubeesanahalli', 'Iblur'] },
      { name: 'Sarjapur Road', zone: 'Outer Ring Road', aliases: ['Wipro Sarjapur'] },
      { name: 'Outer Ring Road', zone: 'Outer Ring Road', aliases: ['ORR'] },
      { name: 'HSR Layout', zone: 'Outer Ring Road' },
      { name: 'Koramangala', zone: 'Outer Ring Road' },
      { name: 'BTM Layout', zone: 'Outer Ring Road' },
      { name: 'Silk Board', zone: 'Outer Ring Road' },
      { name: 'Bommanahalli', zone: 'Outer Ring Road' },
      { name: 'Domlur', zone: 'Outer Ring Road' },
      { name: 'Airport Road', zone: 'Outer Ring Road', aliases: ['Old Airport Road'] },
      // Electronic City & South
      { name: 'Electronic City', zone: 'Electronic City & South', aliases: ['Infosys Bangalore', 'HCL Bangalore'] },
      { name: 'Electronic City Phase 1', zone: 'Electronic City & South' },
      { name: 'Electronic City Phase 2', zone: 'Electronic City & South' },
      { name: 'Bommasandra', zone: 'Electronic City & South' },
      { name: 'Hosur Road', zone: 'Electronic City & South' },
      { name: 'Bannerghatta Road', zone: 'Electronic City & South' },
      { name: 'JP Nagar', zone: 'Electronic City & South' },
      { name: 'Jayanagar', zone: 'Electronic City & South' },
      { name: 'Kanakapura Road', zone: 'Electronic City & South' },
      { name: 'Begur', zone: 'Electronic City & South', aliases: ['Hebbagodi'] },
      // North
      { name: 'Hebbal', zone: 'North', aliases: ['Kirloskar Business Park'] },
      { name: 'Manyata Tech Park', zone: 'North', aliases: ['IBM Manyata', 'Nagawara'] },
      { name: 'Thanisandra', zone: 'North' },
      { name: 'Yelahanka', zone: 'North', aliases: ['Jakkur', 'Sahakar Nagar'] },
      { name: 'Devanahalli', zone: 'North' },
      { name: 'Kempegowda International Airport', zone: 'North', aliases: ['Kempegowda Airport', 'Bangalore Airport', 'KIA'] },
      // West
      { name: 'Yeshwanthpur', zone: 'West' },
      { name: 'Rajajinagar', zone: 'West' },
      { name: 'Malleshwaram', zone: 'West' },
      { name: 'Peenya', zone: 'West' },
      { name: 'Vijayanagar', zone: 'West' },
      { name: 'Nagarbhavi', zone: 'West' },
      { name: 'Kengeri', zone: 'West' },
      // Central
      { name: 'MG Road', zone: 'Central' },
      { name: 'Church Street', zone: 'Central' },
      { name: 'Majestic', zone: 'Central' },
      { name: 'Shivajinagar', zone: 'Central' },
      { name: 'Indiranagar', zone: 'Central' },
      { name: 'Basavanagudi', zone: 'Central' },
      { name: 'Banashankari', zone: 'Central' },
      { name: 'Richmond Town', zone: 'Central' },
    ],
  },
  pune: {
    name: 'Pune',
    state: 'Maharashtra',
    icon: '🏔️',
    active: true,
    areas: [
      // Hinjewadi & West
      { name: 'Hinjewadi', zone: 'Hinjewadi & West', aliases: ['Infosys Pune', 'Wipro Pune', 'TCS Pune', 'Cognizant Pune', 'Tech Mahindra Pune', 'Persistent Pune'] },
      { name: 'Hinjewadi Phase 1', zone: 'Hinjewadi & West' },
      { name: 'Hinjewadi Phase 2', zone: 'Hinjewadi & West' },
      { name: 'Hinjewadi Phase 3', zone: 'Hinjewadi & West' },
      { name: 'Wakad', zone: 'Hinjewadi & West' },
      { name: 'Baner', zone: 'Hinjewadi & West' },
      { name: 'Balewadi', zone: 'Hinjewadi & West' },
      { name: 'Sus Road', zone: 'Hinjewadi & West' },
      { name: 'Aundh', zone: 'Hinjewadi & West' },
      { name: 'Pashan', zone: 'Hinjewadi & West' },
      { name: 'Bavdhan', zone: 'Hinjewadi & West' },
      { name: 'Pimple Saudagar', zone: 'Hinjewadi & West' },
      { name: 'Pimple Nilakh', zone: 'Hinjewadi & West' },
      { name: 'Punawale', zone: 'Hinjewadi & West' },
      { name: 'Tathawade', zone: 'Hinjewadi & West' },
      // Kharadi & East
      { name: 'Kharadi', zone: 'Kharadi & East', aliases: ['EON IT Park', 'World Trade Center Pune', 'Zensar Pune'] },
      { name: 'Magarpatta', zone: 'Kharadi & East', aliases: ['Cybercity Magarpatta'] },
      { name: 'Hadapsar', zone: 'Kharadi & East' },
      { name: 'Fursungi', zone: 'Kharadi & East' },
      { name: 'Viman Nagar', zone: 'Kharadi & East' },
      { name: 'Kalyani Nagar', zone: 'Kharadi & East' },
      { name: 'Nagar Road', zone: 'Kharadi & East' },
      { name: 'Yerwada', zone: 'Kharadi & East', aliases: ['Commerzone'] },
      { name: 'Koregaon Park', zone: 'Kharadi & East' },
      { name: 'Mundhwa', zone: 'Kharadi & East' },
      { name: 'Wagholi', zone: 'Kharadi & East' },
      { name: 'Keshav Nagar', zone: 'Kharadi & East' },
      // PCMC
      { name: 'Pimpri', zone: 'PCMC' },
      { name: 'Chinchwad', zone: 'PCMC' },
      { name: 'Nigdi', zone: 'PCMC' },
      { name: 'Akurdi', zone: 'PCMC' },
      { name: 'Ravet', zone: 'PCMC' },
      { name: 'Bhosari', zone: 'PCMC' },
      { name: 'Chakan', zone: 'PCMC' },
      { name: 'Talegaon', zone: 'PCMC' },
      { name: 'Moshi', zone: 'PCMC' },
      // Central
      { name: 'Shivajinagar', zone: 'Central' },
      { name: 'FC Road', zone: 'Central' },
      { name: 'JM Road', zone: 'Central' },
      { name: 'Deccan', zone: 'Central' },
      { name: 'Kothrud', zone: 'Central' },
      { name: 'Warje', zone: 'Central' },
      { name: 'Karve Road', zone: 'Central', aliases: ['Karve Nagar'] },
      { name: 'Senapati Bapat Road', zone: 'Central', aliases: ['RMZ Westend', 'SB Road'] },
      { name: 'Camp', zone: 'Central' },
      { name: 'Swargate', zone: 'Central' },
      { name: 'Pune Station', zone: 'Central' },
      // South
      { name: 'Katraj', zone: 'South' },
      { name: 'Kondhwa', zone: 'South' },
      { name: 'NIBM Road', zone: 'South' },
      { name: 'Bibwewadi', zone: 'South' },
      { name: 'Sinhagad Road', zone: 'South' },
      { name: 'Dhayari', zone: 'South' },
      { name: 'Undri', zone: 'South' },
    ],
  },
  mumbai: {
    name: 'Mumbai',
    state: 'Maharashtra',
    icon: '🌊',
    active: true,
    areas: [
      // BKC & Bandra
      { name: 'BKC', zone: 'BKC & Bandra', aliases: ['Bandra Kurla Complex', 'One BKC'] },
      { name: 'Bandra East', zone: 'BKC & Bandra' },
      { name: 'Bandra West', zone: 'BKC & Bandra' },
      { name: 'Kalina', zone: 'BKC & Bandra' },
      { name: 'Santacruz East', zone: 'BKC & Bandra' },
      { name: 'Kurla', zone: 'BKC & Bandra' },
      // Andheri & Powai
      { name: 'Powai', zone: 'Andheri & Powai', aliases: ['Hiranandani'] },
      { name: 'Chandivali', zone: 'Andheri & Powai' },
      { name: 'SEEPZ', zone: 'Andheri & Powai' },
      { name: 'Andheri East', zone: 'Andheri & Powai', aliases: ['MIDC Andheri', 'Marol'] },
      { name: 'Andheri West', zone: 'Andheri & Powai' },
      { name: 'Jogeshwari', zone: 'Andheri & Powai' },
      { name: 'Chhatrapati Shivaji Airport', zone: 'Andheri & Powai', aliases: ['CSIA', 'Mumbai Airport'] },
      // Western Suburbs
      { name: 'Malad', zone: 'Western Suburbs', aliases: ['Mindspace Malad', 'Link Road'] },
      { name: 'Goregaon', zone: 'Western Suburbs', aliases: ['NESCO IT Park', 'Goregaon East'] },
      { name: 'Kandivali', zone: 'Western Suburbs' },
      { name: 'Borivali', zone: 'Western Suburbs' },
      { name: 'Dahisar', zone: 'Western Suburbs' },
      // Central Suburbs
      { name: 'Vikhroli', zone: 'Central Suburbs' },
      { name: 'Kanjurmarg', zone: 'Central Suburbs' },
      { name: 'LBS Marg', zone: 'Central Suburbs' },
      { name: 'Ghatkopar', zone: 'Central Suburbs' },
      { name: 'Bhandup', zone: 'Central Suburbs' },
      { name: 'Mulund', zone: 'Central Suburbs' },
      { name: 'Chembur', zone: 'Central Suburbs' },
      // South Mumbai
      { name: 'Lower Parel', zone: 'South Mumbai', aliases: ['Kamala Mills'] },
      { name: 'Worli', zone: 'South Mumbai' },
      { name: 'Parel', zone: 'South Mumbai' },
      { name: 'Dadar', zone: 'South Mumbai' },
      { name: 'Nariman Point', zone: 'South Mumbai' },
      { name: 'Fort', zone: 'South Mumbai' },
      { name: 'CSMT', zone: 'South Mumbai' },
      { name: 'Churchgate', zone: 'South Mumbai' },
      // Navi Mumbai
      { name: 'Navi Mumbai', zone: 'Navi Mumbai' },
      { name: 'Belapur', zone: 'Navi Mumbai' },
      { name: 'Vashi', zone: 'Navi Mumbai' },
      { name: 'Nerul', zone: 'Navi Mumbai' },
      { name: 'Ghansoli', zone: 'Navi Mumbai' },
      { name: 'Mahape', zone: 'Navi Mumbai' },
      { name: 'Airoli', zone: 'Navi Mumbai' },
      { name: 'Rabale', zone: 'Navi Mumbai' },
      { name: 'TTC Industrial Area', zone: 'Navi Mumbai' },
      { name: 'Kharghar', zone: 'Navi Mumbai' },
      { name: 'Panvel', zone: 'Navi Mumbai' },
      // Thane
      { name: 'Thane', zone: 'Thane' },
      { name: 'Wagle Estate', zone: 'Thane' },
      { name: 'Kolshet', zone: 'Thane' },
      { name: 'Majiwada', zone: 'Thane' },
      { name: 'Ghodbunder Road', zone: 'Thane' },
    ],
  },
  delhi: {
    name: 'Delhi NCR',
    state: 'Delhi',
    icon: '🏰',
    active: true,
    areas: [
      // Noida
      { name: 'Noida', zone: 'Noida', aliases: ['TCS Noida', 'Infosys Noida', 'HCL Noida', 'Microsoft Noida', 'Adobe Noida', 'Samsung Noida'] },
      { name: 'Noida Sector 62', zone: 'Noida' },
      { name: 'Noida Sector 63', zone: 'Noida' },
      { name: 'Noida Sector 125', zone: 'Noida' },
      { name: 'Noida Sector 132', zone: 'Noida' },
      { name: 'Noida Sector 135', zone: 'Noida' },
      { name: 'Noida Sector 136', zone: 'Noida' },
      { name: 'Noida Sector 142', zone: 'Noida' },
      { name: 'Noida Sector 143', zone: 'Noida' },
      { name: 'Noida Sector 18', zone: 'Noida' },
      { name: 'Noida Sector 15', zone: 'Noida' },
      { name: 'Noida Sector 30', zone: 'Noida' },
      { name: 'Noida Sector 37', zone: 'Noida' },
      { name: 'Noida Sector 44', zone: 'Noida' },
      { name: 'Noida Sector 50', zone: 'Noida' },
      { name: 'Noida Sector 52', zone: 'Noida' },
      { name: 'Noida Sector 76', zone: 'Noida' },
      { name: 'Noida Sector 77', zone: 'Noida' },
      { name: 'Noida Sector 78', zone: 'Noida' },
      { name: 'Noida Sector 100', zone: 'Noida' },
      { name: 'Noida Sector 110', zone: 'Noida' },
      { name: 'Noida Sector 120', zone: 'Noida' },
      { name: 'Noida Sector 121', zone: 'Noida' },
      { name: 'Noida Sector 122', zone: 'Noida' },
      { name: 'Noida Expressway', zone: 'Noida' },
      { name: 'Noida City Centre', zone: 'Noida' },
      { name: 'Botanical Garden', zone: 'Noida' },
      // Greater Noida
      { name: 'Greater Noida', zone: 'Greater Noida' },
      { name: 'Greater Noida West', zone: 'Greater Noida', aliases: ['Noida Extension'] },
      { name: 'Crossings Republik', zone: 'Greater Noida' },
      { name: 'Knowledge Park', zone: 'Greater Noida' },
      { name: 'Techzone 4', zone: 'Greater Noida' },
      { name: 'Surajpur', zone: 'Greater Noida' },
      { name: 'Gaur City', zone: 'Greater Noida' },
      { name: 'Jagat Farm', zone: 'Greater Noida' },
      { name: 'Pari Chowk', zone: 'Greater Noida' },
      // Gurgaon
      { name: 'Gurugram', zone: 'Gurgaon', aliases: ['Gurgaon', 'Accenture Gurgaon', 'Wipro Gurgaon', 'IBM Gurgaon'] },
      { name: 'Cyber City', zone: 'Gurgaon', aliases: ['DLF Cyber City', 'Cyber City Gurgaon', 'Cyber Hub'] },
      { name: 'DLF Phase 1', zone: 'Gurgaon' },
      { name: 'DLF Phase 2', zone: 'Gurgaon' },
      { name: 'DLF Phase 3', zone: 'Gurgaon' },
      { name: 'DLF Phase 4', zone: 'Gurgaon' },
      { name: 'DLF Phase 5', zone: 'Gurgaon' },
      { name: 'Golf Course Road', zone: 'Gurgaon' },
      { name: 'Sohna Road', zone: 'Gurgaon' },
      { name: 'NH 48', zone: 'Gurgaon', aliases: ['NH 8'] },
      { name: 'Udyog Vihar', zone: 'Gurgaon' },
      { name: 'MG Road Gurgaon', zone: 'Gurgaon' },
      { name: 'IFFCO Chowk', zone: 'Gurgaon' },
      { name: 'Huda City Centre', zone: 'Gurgaon' },
      { name: 'Manesar', zone: 'Gurgaon', aliases: ['IMT Manesar'] },
      { name: 'Palam Vihar', zone: 'Gurgaon' },
      { name: 'South City', zone: 'Gurgaon' },
      { name: 'Sushant Lok', zone: 'Gurgaon' },
      { name: 'Sector 14 Gurgaon', zone: 'Gurgaon' },
      { name: 'Sector 22 Gurgaon', zone: 'Gurgaon' },
      { name: 'Sector 38 Gurgaon', zone: 'Gurgaon' },
      { name: 'Sector 42 Gurgaon', zone: 'Gurgaon' },
      { name: 'Sector 45 Gurgaon', zone: 'Gurgaon' },
      { name: 'Sector 46 Gurgaon', zone: 'Gurgaon' },
      { name: 'Sector 56 Gurgaon', zone: 'Gurgaon' },
      { name: 'Sector 65 Gurgaon', zone: 'Gurgaon' },
      { name: 'DLF Garden City', zone: 'Gurgaon' },
      { name: 'Ardee City', zone: 'Gurgaon' },
      { name: 'Emaar Palm Hills', zone: 'Gurgaon' },
      // Faridabad
      { name: 'Faridabad', zone: 'Faridabad' },
      { name: 'NIT Faridabad', zone: 'Faridabad' },
      { name: 'Sector 12 Faridabad', zone: 'Faridabad' },
      { name: 'Sector 14 Faridabad', zone: 'Faridabad' },
      { name: 'Sector 15 Faridabad', zone: 'Faridabad' },
      { name: 'Sector 16 Faridabad', zone: 'Faridabad' },
      { name: 'Ballabhgarh', zone: 'Faridabad' },
      { name: 'Old Faridabad', zone: 'Faridabad' },
      // Ghaziabad
      { name: 'Ghaziabad', zone: 'Ghaziabad' },
      { name: 'Indirapuram', zone: 'Ghaziabad' },
      { name: 'Vaishali', zone: 'Ghaziabad' },
      { name: 'Kaushambi', zone: 'Ghaziabad' },
      { name: 'Vasundhara', zone: 'Ghaziabad' },
      { name: 'Raj Nagar Extension', zone: 'Ghaziabad' },
      { name: 'Raj Nagar', zone: 'Ghaziabad' },
      { name: 'Govindpuram', zone: 'Ghaziabad' },
      { name: 'Pratap Vihar', zone: 'Ghaziabad' },
      { name: 'Sanjay Nagar', zone: 'Ghaziabad' },
      { name: 'Modinagar', zone: 'Ghaziabad' },
      { name: 'Loni', zone: 'Ghaziabad' },
      // Central Delhi
      { name: 'Connaught Place', zone: 'Central Delhi', aliases: ['CP'] },
      { name: 'Barakhamba', zone: 'Central Delhi' },
      { name: 'Janpath', zone: 'Central Delhi' },
      { name: 'Karol Bagh', zone: 'Central Delhi' },
      { name: 'New Delhi Railway Station', zone: 'Central Delhi' },
      { name: 'ITO', zone: 'Central Delhi' },
      // South Delhi
      { name: 'Nehru Place', zone: 'South Delhi' },
      { name: 'Okhla', zone: 'South Delhi' },
      { name: 'Saket', zone: 'South Delhi' },
      { name: 'Malviya Nagar', zone: 'South Delhi' },
      { name: 'Hauz Khas', zone: 'South Delhi' },
      { name: 'South Extension', zone: 'South Delhi' },
      { name: 'Lajpat Nagar', zone: 'South Delhi' },
      { name: 'Defence Colony', zone: 'South Delhi' },
      { name: 'Greater Kailash', zone: 'South Delhi' },
      { name: 'Vasant Kunj', zone: 'South Delhi' },
      { name: 'Vasant Vihar', zone: 'South Delhi' },
      { name: 'RK Puram', zone: 'South Delhi' },
      { name: 'Hazrat Nizamuddin', zone: 'South Delhi' },
      { name: 'IGI Airport', zone: 'South Delhi', aliases: ['Aerocity', 'Delhi Airport'] },
      // West Delhi
      { name: 'Dwarka', zone: 'West Delhi' },
      { name: 'Dwarka Sector 10', zone: 'West Delhi' },
      { name: 'Dwarka Sector 21', zone: 'West Delhi' },
      { name: 'Rajouri Garden', zone: 'West Delhi' },
      { name: 'Udyog Nagar', zone: 'West Delhi' },
      { name: 'Janakpuri', zone: 'West Delhi' },
      { name: 'Peeragarhi', zone: 'West Delhi' },
      { name: 'Punjabi Bagh', zone: 'West Delhi' },
      // North Delhi
      { name: 'Rohini', zone: 'North Delhi' },
      { name: 'Pitampura', zone: 'North Delhi' },
      // East Delhi
      { name: 'Laxmi Nagar', zone: 'East Delhi' },
      { name: 'Preet Vihar', zone: 'East Delhi' },
      { name: 'IP Extension', zone: 'East Delhi' },
      { name: 'Mayur Vihar', zone: 'East Delhi' },
    ],
  },
  chennai: {
    name: 'Chennai',
    state: 'Tamil Nadu',
    icon: '🌊',
    active: true,
    areas: [
      // OMR IT Corridor
      { name: 'OMR', zone: 'OMR IT Corridor', aliases: ['Old Mahabalipuram Road'] },
      { name: 'Sholinganallur', zone: 'OMR IT Corridor', aliases: ['Infosys Chennai', 'Wipro Chennai', 'Cognizant Chennai', 'Tech Mahindra Chennai'] },
      { name: 'Perungudi', zone: 'OMR IT Corridor', aliases: ['RMZ Millenia'] },
      { name: 'Taramani', zone: 'OMR IT Corridor', aliases: ['Tidel Park', 'Ascendas IT Park'] },
      { name: 'Thoraipakkam', zone: 'OMR IT Corridor' },
      { name: 'Karapakkam', zone: 'OMR IT Corridor' },
      { name: 'Siruseri', zone: 'OMR IT Corridor', aliases: ['SIPCOT IT Park', 'TCS Chennai'] },
      { name: 'Navalur', zone: 'OMR IT Corridor', aliases: ['HCL Chennai'] },
      { name: 'Kelambakkam', zone: 'OMR IT Corridor' },
      { name: 'Padur', zone: 'OMR IT Corridor' },
      { name: 'Thiruvanmiyur', zone: 'OMR IT Corridor' },
      // South
      { name: 'Velachery', zone: 'South' },
      { name: 'Medavakkam', zone: 'South' },
      { name: 'Pallikaranai', zone: 'South' },
      { name: 'Tambaram', zone: 'South' },
      { name: 'Chrompet', zone: 'South', aliases: ['Chromepet'] },
      { name: 'Pallavaram', zone: 'South' },
      { name: 'Perungalathur', zone: 'South' },
      { name: 'Vandalur', zone: 'South' },
      { name: 'Maraimalai Nagar', zone: 'South' },
      { name: 'Mahindra World City', zone: 'South' },
      { name: 'Chennai International Airport', zone: 'South', aliases: ['Chennai Airport'] },
      // West
      { name: 'Porur', zone: 'West', aliases: ['DLF Porur'] },
      { name: 'Ramapuram', zone: 'West' },
      { name: 'Vadapalani', zone: 'West' },
      { name: 'Guindy', zone: 'West' },
      { name: 'Ekkatuthangal', zone: 'West' },
      { name: 'St Thomas Mount', zone: 'West' },
      { name: 'Ambattur', zone: 'West', aliases: ['Ambattur Industrial Estate'] },
      { name: 'Poonamallee', zone: 'West' },
      { name: 'Sriperumbudur', zone: 'West' },
      { name: 'Koyambedu', zone: 'West' },
      { name: 'Ashok Nagar', zone: 'West' },
      // Central
      { name: 'Nungambakkam', zone: 'Central' },
      { name: 'Egmore', zone: 'Central' },
      { name: 'T Nagar', zone: 'Central' },
      { name: 'Adyar', zone: 'Central' },
      { name: 'Besant Nagar', zone: 'Central' },
      { name: 'Mylapore', zone: 'Central' },
      { name: 'Alwarpet', zone: 'Central' },
      { name: 'Kotturpuram', zone: 'Central' },
      { name: 'Saidapet', zone: 'Central' },
      // North
      { name: 'Anna Nagar', zone: 'North', aliases: ['Anna Nagar West', 'Anna Nagar East'] },
      { name: 'Mogappair', zone: 'North' },
      { name: 'Perambur', zone: 'North' },
      { name: 'Madhavaram', zone: 'North' },
      { name: 'Villivakkam', zone: 'North' },
      { name: 'Kolathur', zone: 'North' },
    ],
  },
}

// ── helpers ──────────────────────────────────────────────────

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// profiles.city is a display name ('Bangalore', 'Delhi NCR'…); map it to a key.
export function cityKeyFor(city) {
  const c = String(city || '').toLowerCase()
  if (c.includes('delhi') || c.includes('noida') || c.includes('gurg') || c.includes('ncr')) return 'delhi'
  if (c.includes('bang') || c.includes('bengal')) return 'bengaluru'
  if (c.includes('chenn')) return 'chennai'
  if (c.includes('mumb') || c.includes('navi') || c.includes('thane')) return 'mumbai'
  if (c.includes('pune')) return 'pune'
  return 'hyderabad'
}

export function getAreasForCity(cityKey) {
  return CITIES[cityKey]?.areas?.map(a => a.name) || []
}

// { zone: [area names] } — for the commute dropdown (optgroups)
export function getZones(cityKey) {
  const zones = {}
  ;(CITIES[cityKey]?.areas || []).forEach(a => { (zones[a.zone] = zones[a.zone] || []).push(a.name) })
  return zones
}

// Autocomplete list for a city: area names first, then aliases (deduped).
const _sugCache = {}
export function getSuggestions(city) {
  const key = cityKeyFor(city)
  if (_sugCache[key]) return _sugCache[key]
  const seen = new Set(), out = []
  const push = (t) => { const k = norm(t); if (k && !seen.has(k)) { seen.add(k); out.push(t) } }
  const areas = CITIES[key]?.areas || []
  areas.forEach(a => push(a.name))
  areas.forEach(a => (a.aliases || []).forEach(push))
  return (_sugCache[key] = out)
}

// Index of every term (name + aliases) per city, longest first.
const _idxCache = {}
function indexFor(key) {
  if (_idxCache[key]) return _idxCache[key]
  const idx = []
  ;(CITIES[key]?.areas || []).forEach(a => {
    idx.push({ n: norm(a.name), name: a.name, zone: a.zone })
    ;(a.aliases || []).forEach(al => idx.push({ n: norm(al), name: a.name, zone: a.zone }))
  })
  idx.sort((x, y) => y.n.length - x.n.length)
  return (_idxCache[key] = idx)
}

// Free text (a ride's from/to, a typed commute area) → { name, zone, exact }.
// 1) exact match on a name/alias (ignoring case, spaces, punctuation)
// 2) otherwise the longest name/alias CONTAINED in the text ("TCS Gachibowli
//    main gate" → Gachibowli). Falls back to other cities if nothing matches.
export function resolveArea(city, text, { exactOnly = false } = {}) {
  const t = norm(text)
  if (!t) return null
  const keys = [cityKeyFor(city), ...Object.keys(CITIES).filter(k => k !== cityKeyFor(city))]
  for (const key of keys) {
    const idx = indexFor(key)
    const exact = idx.find(e => e.n === t)
    if (exact) return { name: exact.name, zone: exact.zone, exact: true, city: key }
  }
  if (exactOnly) return null
  for (const key of keys) {
    const idx = indexFor(key)
    const hit = idx.find(e => e.n.length >= 4 && t.includes(e.n))
    if (hit) return { name: hit.name, zone: hit.zone, exact: false, city: key }
  }
  return null
}
