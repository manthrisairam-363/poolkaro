// Known IT company email domains
export const COMPANY_DOMAINS = {
  // Big IT Companies
  'tcs.com': { name: 'TCS', color: '#1a237e', bg: '#e8eaf6' },
  'wipro.com': { name: 'Wipro', color: '#1565c0', bg: '#e3f2fd' },
  'infosys.com': { name: 'Infosys', color: '#0d47a1', bg: '#e3f2fd' },
  'hcl.com': { name: 'HCL', color: '#01579b', bg: '#e1f5fe' },
  'hcltech.com': { name: 'HCL', color: '#01579b', bg: '#e1f5fe' },
  'capgemini.com': { name: 'Capgemini', color: '#00897b', bg: '#e0f2f1' },
  'accenture.com': { name: 'Accenture', color: '#7b1fa2', bg: '#f3e5f5' },
  'cognizant.com': { name: 'Cognizant', color: '#1976d2', bg: '#e3f2fd' },
  'tech-mahindra.com': { name: 'Tech Mahindra', color: '#c62828', bg: '#ffebee' },
  'techmahindra.com': { name: 'Tech Mahindra', color: '#c62828', bg: '#ffebee' },
  'mphasis.com': { name: 'Mphasis', color: '#283593', bg: '#e8eaf6' },
  'hexaware.com': { name: 'Hexaware', color: '#00695c', bg: '#e0f2f1' },
  'ltimindtree.com': { name: 'LTIMindtree', color: '#1a237e', bg: '#e8eaf6' },
  'mindtree.com': { name: 'LTIMindtree', color: '#1a237e', bg: '#e8eaf6' },
  'larsentoubro.com': { name: 'L&T', color: '#bf360c', bg: '#fbe9e7' },

  // Product Companies
  'microsoft.com': { name: 'Microsoft', color: '#0078d4', bg: '#e3f2fd' },
  'amazon.com': { name: 'Amazon', color: '#ff6f00', bg: '#fff8e1' },
  'google.com': { name: 'Google', color: '#1565c0', bg: '#e3f2fd' },
  'meta.com': { name: 'Meta', color: '#1565c0', bg: '#e3f2fd' },
  'apple.com': { name: 'Apple', color: '#212121', bg: '#f5f5f5' },
  'oracle.com': { name: 'Oracle', color: '#c62828', bg: '#ffebee' },
  'sap.com': { name: 'SAP', color: '#0070f2', bg: '#e3f2fd' },
  'ibm.com': { name: 'IBM', color: '#1565c0', bg: '#e3f2fd' },
  'deloitte.com': { name: 'Deloitte', color: '#006400', bg: '#e8f5e9' },
  'pwc.com': { name: 'PwC', color: '#d32f2f', bg: '#ffebee' },

  // Hyderabad IT Companies
  'cyient.com': { name: 'Cyient', color: '#283593', bg: '#e8eaf6' },
  'infotech.com': { name: 'Infotech', color: '#00695c', bg: '#e0f2f1' },
  'zensar.com': { name: 'Zensar', color: '#1565c0', bg: '#e3f2fd' },
  'cybage.com': { name: 'Cybage', color: '#6a1b9a', bg: '#f3e5f5' },
  'persistent.com': { name: 'Persistent', color: '#0d47a1', bg: '#e3f2fd' },
  'niit.com': { name: 'NIIT', color: '#e65100', bg: '#fff3e0' },
  'genpact.com': { name: 'Genpact', color: '#1565c0', bg: '#e3f2fd' },
  'kpit.com': { name: 'KPIT', color: '#283593', bg: '#e8eaf6' },
  'majesco.com': { name: 'Majesco', color: '#00695c', bg: '#e0f2f1' },
  'infoedge.com': { name: 'Info Edge', color: '#bf360c', bg: '#fbe9e7' },
  'birlasoft.com': { name: 'Birlasoft', color: '#c62828', bg: '#ffebee' },
  'coforge.com': { name: 'Coforge', color: '#1a237e', bg: '#e8eaf6' },
  'nisum.com': { name: 'Nisum', color: '#00695c', bg: '#e0f2f1' },

  // Banks & Finance IT
  'jpmorgan.com': { name: 'JPMorgan', color: '#1565c0', bg: '#e3f2fd' },
  'bankofamerica.com': { name: 'BofA', color: '#c62828', bg: '#ffebee' },
  'hsbc.com': { name: 'HSBC', color: '#c62828', bg: '#ffebee' },
  'wellsfargo.com': { name: 'Wells Fargo', color: '#c62828', bg: '#ffebee' },
  'barclays.com': { name: 'Barclays', color: '#1565c0', bg: '#e3f2fd' },
  'gartner.com': { name: 'Gartner', color: '#00695c', bg: '#e0f2f1' },
}

// Get company info from email
export function getCompanyFromEmail(email) {
  if (!email) return null
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null
  return COMPANY_DOMAINS[domain] || null
}

// Get company badge component data
export function getCompanyBadge(email) {
  const company = getCompanyFromEmail(email)
  if (!company) return null
  return company
}

// Check if email is a company email (not Gmail/Yahoo/etc)
export function isCompanyEmail(email) {
  if (!email) return false
  const domain = email.split('@')[1]?.toLowerCase()
  const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'rediffmail.com', 'icloud.com']
  return !personalDomains.includes(domain)
}
