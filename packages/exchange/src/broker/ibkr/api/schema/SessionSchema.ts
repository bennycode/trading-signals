import {z} from 'zod';

/**
 * Every `/iserver`-prefixed endpoint answers 401 until a brokerage session is opened, so the
 * broker checks this before concluding that a failed call means something else.
 *
 * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/trading-session/initialize-session
 */
export const IbkrAuthStatusSchema = z.looseObject({
  authenticated: z.boolean().optional(),
  competing: z.boolean().optional(),
  connected: z.boolean().optional(),
  /**
   * Set when IBKR rejects or ends the session; carries the human-readable reason that the
   * boolean flags above leave out.
   */
  message: z.string().optional(),
});

export const IbkrTickleSchema = z.looseObject({
  session: z.string().optional(),
  ssoExpires: z.number().optional(),
});

export type IbkrAuthStatus = z.infer<typeof IbkrAuthStatusSchema>;
export type IbkrTickle = z.infer<typeof IbkrTickleSchema>;
