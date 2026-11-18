/**
 * What a gateway launcher reports about its progress.
 *
 * Deliberately free of Node.js imports and separate from {@link IbkrGatewayLauncher}, which pulls
 * in `node:child_process` and Playwright. A consumer — or a browser bundle that only ever touches
 * the broker — can describe this state without dragging a process launcher into its module graph.
 */
export const IbkrGatewayStage = {
  /** The gateway reports a session; every call will work from here. */
  AUTHENTICATED: 'authenticated',
  /** Credentials are in and IBKR has pushed to the phone. Nothing proceeds until it is approved. */
  AWAITING_TWO_FACTOR: 'awaiting-two-factor',
  /** Downloading IBKR's distribution, which happens once and is ~100 MB. */
  DOWNLOADING: 'downloading',
  /** Gave up. {@link IbkrGatewayState.error} says why. */
  FAILED: 'failed',
  /** Nothing started yet. */
  IDLE: 'idle',
  /** The Java process is up; the login form is next. */
  STARTING: 'starting',
} as const;
export type IbkrGatewayStage = (typeof IbkrGatewayStage)[keyof typeof IbkrGatewayStage];

export interface IbkrGatewayState {
  error?: Error;
  stage: IbkrGatewayStage;
}
