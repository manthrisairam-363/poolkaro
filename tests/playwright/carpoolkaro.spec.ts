import { test, expect } from '@playwright/test'

const APP = 'https://app.carpoolkaro.com'

test('app loads and shows login', async ({ page }) => {
  await page.goto(APP)
  await expect(page.locator('text=CarpoolKaro').first()).toBeVisible({ timeout: 10000 })
  await expect(page.locator('text=Continue with Google')).toBeVisible({ timeout: 5000 })
})

test('login page shows Google button', async ({ page }) => {
  await page.goto(APP)
  const googleBtn = page.locator('button:has-text("Google")')
  await expect(googleBtn).toBeVisible({ timeout: 10000 })
})

test('app branding is correct', async ({ page }) => {
  await page.goto(APP)
  await expect(page.locator('text=Hyderabad')).toBeVisible({ timeout: 10000 })
})
