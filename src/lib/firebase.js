// Firebase is used for analytics only — not required for app to function
let firebaseAuth = null

try {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
  if (apiKey) {
    const { initializeApp } = await import('firebase/app')
    const { getAuth } = await import('firebase/auth')
    const firebaseConfig = {
      apiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    }
    const app = initializeApp(firebaseConfig)
    firebaseAuth = getAuth(app)
  }
} catch (e) {
  console.warn('Firebase not initialized:', e.message)
}

export { firebaseAuth }
