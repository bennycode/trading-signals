import type {Browser, Page} from 'playwright';
import {IbkrAPI} from '../api/IbkrAPI.js';

/**
 * Playwright, loaded only when a login actually happens.
 *
 * An optional peer dependency rather than a real one: it pulls a browser of its own, and someone
 * trading on Alpaca should not download Chromium to install this package. Imported dynamically so
 * its absence is a clear instruction at the point of use instead of a resolution failure at
 * import time.
 */
async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    throw new Error(
      'Logging into the IBKR gateway needs a browser, because its login form is built by client-side JavaScript and has no form to post to. Install the optional peer dependency with `npm i playwright`, or start and log into the gateway yourself and construct the client without `account`/`password`.'
    );
  }
}

/**
 * Selectors on the gateway's own login page, read off the served markup rather than guessed.
 *
 * They are IBKR's to change, and when they do this is where it breaks. The page is built from
 * `xyz*` class names: one form for the credentials and one per second-factor method, of which only
 * the matching one is shown.
 */
const SELECTOR = {
  /** Shown only when the account has more than one second factor enrolled. */
  deviceChooser: 'select#xyz-field-multipleselect',
  password: '#xyz-field-password',
  submit: 'button.xyz-button-login',
  username: '#xyz-field-username',
} as const;

export interface IbkrLoginOptions {
  account: string;
  gatewayUrl: string;
  /** Written here when the login fails, which is the only way to tell a prompt from a changed form. */
  screenshotPath?: string;
  /** How long to wait for the second factor, which needs a human to tap the push. */
  twoFactorTimeoutMs?: number;
  /** The entry to pick in the device chooser, matched case-insensitively. */
  twoFactorMethod?: string;
  password: string;
}

/** Whether the gateway reports a usable session, which is the only authority on whether we are in. */
export async function isAuthenticated(gatewayUrl: string): Promise<boolean> {
  // Through `IbkrAPI` so the gateway's self-signed certificate is handled exactly as it is at runtime.
  const status = await new IbkrAPI({gatewayUrl}).getAuthStatus().catch(() => undefined);
  return Boolean(status?.authenticated);
}

/**
 * Drives the gateway's login page to completion.
 *
 * Success is taken from the gateway's own status endpoint rather than from text on the page: the
 * wording is IBKR's to change, while `authenticated` is the thing that actually decides whether a
 * request will work. IB Key sends a push, so the wait after submitting is a wait for a human.
 */
export async function loginToIbkrGateway(options: IbkrLoginOptions): Promise<void> {
  const {account, gatewayUrl, password, screenshotPath} = options;
  const twoFactorMethod = options.twoFactorMethod ?? 'IB Key';
  const twoFactorTimeoutMs = options.twoFactorTimeoutMs ?? 240_000;

  let browser: Browser | undefined;

  try {
    const chromium = await loadChromium();
    browser = await chromium.launch();
    /*
     * The gateway's certificate is self-signed, so a loopback connection has no chain to verify
     * and verification has to be off. Anywhere else it stays on, and for a stronger reason than
     * in `IbkrAPI`: this page is where the IBKR password is typed, so accepting any certificate
     * on a remote gateway would hand the credentials to whoever answered.
     */
    const context = await browser.newContext({ignoreHTTPSErrors: IbkrAPI.isLoopback(gatewayUrl)});
    const page = await context.newPage();

    await page.goto(`${gatewayUrl}/sso/Login?forwardTo=22&RL=1&ip2loc=on`, {waitUntil: 'domcontentloaded'});

    await page.locator(SELECTOR.username).fill(account);
    await page.locator(SELECTOR.password).fill(password);
    await page.locator(SELECTOR.submit).click();

    await selectTwoFactorMethod(page, twoFactorMethod);

    const deadline = Date.now() + twoFactorTimeoutMs;
    while (Date.now() < deadline) {
      if (await isAuthenticated(gatewayUrl)) {
        return;
      }
      await page.waitForTimeout(2_000);
    }

    if (screenshotPath) {
      await page.screenshot({path: screenshotPath});
    }

    throw new Error(
      `IBKR did not confirm the session within ${Math.round(twoFactorTimeoutMs / 1_000)}s. If a push was sent, it needs approving on the phone.${screenshotPath ? ` The page it gave up on is at ${screenshotPath}.` : ''}`
    );
  } finally {
    await browser?.close();
  }
}

/**
 * Picks the second factor when the account has more than one enrolled.
 *
 * Absent for a single-factor account, so its absence is not an error. IBeam's own breakage here was
 * looking for a chooser by a stale id and timing out on a page that was waiting for a choice.
 */
async function selectTwoFactorMethod(page: Page, method: string): Promise<void> {
  const chooser = page.locator(SELECTOR.deviceChooser);

  try {
    await chooser.waitFor({state: 'visible', timeout: 5_000});
  } catch {
    return;
  }

  const options = await chooser.locator('option').allTextContents();
  const match = options.find(option => option.toLowerCase().includes(method.toLowerCase()));

  if (!match) {
    throw new Error(`IBKR offers no second factor matching "${method}". Available: ${options.join(', ')}.`);
  }

  await chooser.selectOption({label: match});

  /*
   * Choosing an entry submits the chooser by itself and the page moves on, so a submit button is
   * usually gone by the time this runs. It is clicked only when one is actually there, and a
   * timeout here is not a failure: whether the login worked is decided by the status endpoint.
   */
  await page
    .locator('button[type=submit]:visible')
    .first()
    .click({timeout: 3_000})
    .catch(() => undefined);
}
