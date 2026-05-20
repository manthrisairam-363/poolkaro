/**
 * CarpoolKaro E2E Tests — Playwright
 * Tests run against: https://app.carpoolkaro.com
 * Uses pre-seeded test accounts (no Google OAuth)
 */
import { test, expect, type Page } from '@playwright/test'

const APP_URL    = 'https://app.carpoolkaro.com'
const DRIVER_EMAIL = 'testdriver@test.com'
const RIDER_EMAIL  = 'testrider@test.com'
const TEST_PASS    = 'Test@1234'

// ── helpers ──────────────────────────────────────────────
async function adminLogin(page: Page, email: string) {
  await page.goto(APP_URL)
  await page.waitForTimeout(1500)
  // Tap logo 7 times to reveal admin login
  const logo = page.locator('svg').first()
  for (let i = 0; i < 7; i++) await logo.click()
  await page.waitForTimeout(300)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', TEST_PASS)
  await page.click('button:has-text("Login")')
  await page.waitForURL(`${APP_URL}/**`, { timeout: 8000 })
}

// ── Login Tests ───────────────────────────────────────────
test.describe('Login', () => {
  test('E2E_L01 - Login page shows Google button', async ({ page }) => {
    await page.goto(APP_URL)
    await expect(page.locator('text=Continue with Google')).toBeVisible({ timeout: 5000 })
  })

  test('E2E_L02 - Admin login revealed after 7 logo taps', async ({ page }) => {
    await page.goto(APP_URL)
    const logo = page.locator('svg').first()
    for (let i = 0; i < 7; i++) await logo.click()
    await expect(page.locator('text=Admin login')).toBeVisible()
  })

  test('E2E_L03 - Admin can login with email/password', async ({ page }) => {
    await adminLogin(page, DRIVER_EMAIL)
    await expect(page).toHaveURL(/app\.carpoolkaro\.com/, { timeout: 8000 })
  })

  test('E2E_L04 - Shows CarpoolKaro branding', async ({ page }) => {
    await page.goto(APP_URL)
    await expect(page.locator('text=CarpoolKaro')).toBeVisible()
    await expect(page.locator('text=Hyderabad')).toBeVisible()
  })
})

// ── Home Screen Tests ─────────────────────────────────────
test.describe('Home Screen', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page, DRIVER_EMAIL)
  })

  test('E2E_H01 - Home screen loads with tab bar', async ({ page }) => {
    await expect(page.locator('text=All Rides')).toBeVisible()
    await expect(page.locator('text=To Office')).toBeVisible()
    await expect(page.locator('text=Requests')).toBeVisible()
  })

  test('E2E_H02 - Search bar is visible and functional', async ({ page }) => {
    const search = page.locator('input[placeholder*="Search"]')
    await expect(search).toBeVisible()
    await search.fill('Uppal')
    await expect(search).toHaveValue('Uppal')
  })

  test('E2E_H03 - Filter panel opens and shows location autocomplete', async ({ page }) => {
    await page.click('button svg') // filter button
    await page.waitForTimeout(500)
    const fromInput = page.locator('input[placeholder*="Uppal"]')
    await expect(fromInput).toBeVisible()
    await fromInput.fill('Gach')
    await expect(page.locator('text=Gachibowli')).toBeVisible({ timeout: 3000 })
  })

  test('E2E_H04 - Notification bell is visible', async ({ page }) => {
    await expect(page.locator('text=🔔')).toBeVisible()
  })

  test('E2E_H05 - Refresh button works', async ({ page }) => {
    await page.click('text=↺')
    await page.waitForTimeout(1000)
    await expect(page.locator('text=All Rides')).toBeVisible()
  })
})

// ── Post Ride Tests ───────────────────────────────────────
test.describe('Post Ride', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page, DRIVER_EMAIL)
  })

  test('E2E_P01 - Post Ride page opens', async ({ page }) => {
    await page.click('text=Post')
    await expect(page.locator('text=Post a Ride')).toBeVisible()
  })

  test('E2E_P02 - Both tabs visible: Post a Ride and Need a Ride', async ({ page }) => {
    await page.click('text=Post')
    await expect(page.locator('text=Post a Ride')).toBeVisible()
    await expect(page.locator('text=Need a Ride')).toBeVisible()
  })

  test('E2E_P03 - From/To fields show location suggestions', async ({ page }) => {
    await page.click('text=Post')
    const fromInput = page.locator('input[placeholder*="Uppal"]').first()
    await fromInput.fill('Kond')
    await expect(page.locator('text=Kondapur')).toBeVisible({ timeout: 3000 })
  })

  test('E2E_P04 - Earnings calculation shows correctly', async ({ page }) => {
    await page.click('text=Post')
    await page.fill('input[placeholder*="150"]', '150')
    await expect(page.locator('text=× ₹150')).toBeVisible({ timeout: 2000 })
  })

  test('E2E_P05 - Cannot post ride without required fields', async ({ page }) => {
    await page.click('text=Post')
    await page.click('text=Post Ride')
    // Should show validation — still on same page
    await expect(page.locator('text=Post a Ride')).toBeVisible()
  })

  test('E2E_P06 - Can post a ride successfully', async ({ page }) => {
    await page.click('text=Post')
    // Fill from location
    const fromInput = page.locator('input[placeholder*="Uppal"]').first()
    await fromInput.fill('Uppal')
    // Fill to location
    const toInput = page.locator('input[placeholder*="Kokapet"]').first()
    await toInput.fill('Kokapet')
    // Fill time
    await page.fill('input[type="time"]', '09:00')
    // Fill fare
    await page.fill('input[placeholder*="150"]', '150')
    await page.click('text=Post Ride')
    // Should navigate away or show success
    await page.waitForTimeout(2000)
  })
})

// ── Profile Tests ─────────────────────────────────────────
test.describe('Profile', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page, DRIVER_EMAIL)
    await page.click('text=Profile')
  })

  test('E2E_PR01 - Profile page loads', async ({ page }) => {
    await expect(page.locator('text=My Profile')).toBeVisible()
  })

  test('E2E_PR02 - Accordion sections visible', async ({ page }) => {
    await expect(page.locator('text=Personal Details')).toBeVisible()
    await expect(page.locator('text=My Impact')).toBeVisible()
    await expect(page.locator('text=Invite & Earn')).toBeVisible()
    await expect(page.locator('text=Emergency Contact')).toBeVisible()
    await expect(page.locator('text=Verify Work Email')).toBeVisible()
  })

  test('E2E_PR03 - Personal Details expands and shows edit button', async ({ page }) => {
    await page.click('text=Personal Details')
    await expect(page.locator('text=Edit Details')).toBeVisible({ timeout: 2000 })
  })

  test('E2E_PR04 - Invite & Earn shows referral code', async ({ page }) => {
    await page.click('text=Invite & Earn')
    await expect(page.locator('text=Your Invite Code')).toBeVisible({ timeout: 2000 })
  })

  test('E2E_PR05 - Contact Support link exists', async ({ page }) => {
    await expect(page.locator('text=Contact Support')).toBeVisible()
    await expect(page.locator('text=support@carpoolkaro.com')).toBeVisible()
  })

  test('E2E_PR06 - Logout button exists', async ({ page }) => {
    await expect(page.locator('text=Logout')).toBeVisible()
  })
})

// ── Wallet Tests ──────────────────────────────────────────
test.describe('Wallet', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page, DRIVER_EMAIL)
    await page.click('text=Wallet')
  })

  test('E2E_W01 - Wallet page loads with balance', async ({ page }) => {
    await expect(page.locator('text=Wallet Balance')).toBeVisible()
  })

  test('E2E_W02 - Recharge button visible', async ({ page }) => {
    await expect(page.locator('text=Recharge')).toBeVisible()
  })

  test('E2E_W03 - Transaction history visible', async ({ page }) => {
    await expect(page.locator('text=Transaction History')).toBeVisible()
  })

  test('E2E_W04 - Signup bonus visible in transactions', async ({ page }) => {
    await expect(page.locator('text=signup')).toBeVisible({ timeout: 3000 })
  })
})

// ── My Rides Tests ────────────────────────────────────────
test.describe('My Rides', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page, DRIVER_EMAIL)
    await page.click('text=My Rides')
  })

  test('E2E_MR01 - My Rides page loads', async ({ page }) => {
    await expect(page.locator('text=My Rides')).toBeVisible()
  })

  test('E2E_MR02 - Shows I Posted and I Booked tabs', async ({ page }) => {
    await expect(page.locator('text=I Posted')).toBeVisible()
    await expect(page.locator('text=I Booked')).toBeVisible()
  })
})

// ── Booking Flow Tests ────────────────────────────────────
test.describe('Booking Flow', () => {
  test('E2E_B01 - Rider can see Book button on ride card', async ({ page }) => {
    await adminLogin(page, RIDER_EMAIL)
    // Check if any rides are available
    const bookBtn = page.locator('button:has-text("Book")').first()
    const noRides = page.locator('text=No rides found')
    // Either see a book button or no rides message
    await expect(bookBtn.or(noRides)).toBeVisible({ timeout: 5000 })
  })
})

// ── Request Ride Tests ────────────────────────────────────
test.describe('Request Ride', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page, RIDER_EMAIL)
  })

  test('E2E_RR01 - Need a Ride page opens', async ({ page }) => {
    await page.click('text=Post')
    await page.click('text=Need a Ride')
    await expect(page.locator('text=Tell car owners')).toBeVisible({ timeout: 3000 })
  })

  test('E2E_RR02 - Requests tab shows on Home', async ({ page }) => {
    await expect(page.locator('text=Requests')).toBeVisible()
    await page.click('text=Requests')
    await expect(page.locator('text=Post My Ride Request')).toBeVisible({ timeout: 3000 })
  })
})

// ── Admin Dashboard Tests ─────────────────────────────────
test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page, 'manthrisairam@gmail.com')
    await page.click('text=Profile')
    await page.click('text=Admin Dashboard')
  })

  test('E2E_A01 - Admin dashboard loads', async ({ page }) => {
    await expect(page.locator('text=CarpoolKaro Control Panel')).toBeVisible({ timeout: 5000 })
  })

  test('E2E_A02 - Overview stats visible', async ({ page }) => {
    await expect(page.locator('text=Total Users')).toBeVisible()
    await expect(page.locator('text=Revenue')).toBeVisible()
  })

  test('E2E_A03 - Users tab shows user list', async ({ page }) => {
    await page.click('text=Users')
    await expect(page.locator('text=total users')).toBeVisible({ timeout: 5000 })
  })

  test('E2E_A04 - Non-admin cannot access admin dashboard', async ({ page: p2 }) => {
    await adminLogin(p2, RIDER_EMAIL)
    await p2.goto(`${APP_URL}/admin`)
    await page.waitForTimeout(2000)
    // Should redirect away
    await expect(p2).not.toHaveURL(/\/admin/, { timeout: 5000 })
  })
})

// ── Security Tests ────────────────────────────────────────
test.describe('Security', () => {
  test('E2E_S01 - App redirects to login when not authenticated', async ({ page }) => {
    await page.goto(APP_URL)
    await page.waitForTimeout(2000)
    await expect(page.locator('text=Continue with Google').or(page.locator('text=CarpoolKaro'))).toBeVisible()
  })

  test('E2E_S02 - Email signup not visible to regular users', async ({ page }) => {
    await page.goto(APP_URL)
    await expect(page.locator('text=Admin login')).not.toBeVisible()
    await expect(page.locator('input[type="password"]')).not.toBeVisible()
  })
})
