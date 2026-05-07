import { initializeApp } from 'firebase/app'
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyBgjc0_5TTuR4-kF5PjlMrB0uX2dmrUbrw",
  authDomain: "poolkaro-495509.firebaseapp.com",
  projectId: "poolkaro-495509",
  storageBucket: "poolkaro-495509.firebasestorage.app",
  messagingSenderId: "54994626502",
  appId: "1:54994626502:web:7ad449921089bb723d74c7",
  measurementId: "G-84DLR8WZ7Y"
}

const firebaseApp = initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)

// Send OTP to phone number
export async function sendFirebaseOTP(phoneNumber) {
  // phoneNumber format: +919533126221
  try {
    // Create invisible recaptcha
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        firebaseAuth,
        'recaptcha-container',
        { size: 'invisible' }
      )
    }
    const confirmationResult = await signInWithPhoneNumber(
      firebaseAuth,
      phoneNumber,
      window.recaptchaVerifier
    )
    // Store for verification
    window.confirmationResult = confirmationResult
    return { success: true }
  } catch (error) {
    console.error('OTP send error:', error)
    // Reset recaptcha on error
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear()
      window.recaptchaVerifier = null
    }
    return { success: false, error: error.message }
  }
}

// Verify OTP entered by user
export async function verifyFirebaseOTP(otp) {
  try {
    if (!window.confirmationResult) {
      return { success: false, error: 'Session expired. Please resend OTP.' }
    }
    const result = await window.confirmationResult.confirm(otp)
    const firebaseUser = result.user
    // Get Firebase ID token to sign into Supabase
    const idToken = await firebaseUser.getIdToken()
    return { success: true, idToken, firebaseUser }
  } catch (error) {
    console.error('OTP verify error:', error)
    return { success: false, error: 'Invalid OTP. Please try again.' }
  }
}
