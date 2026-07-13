import {z} from 'zod';

/**
 * A strategy expressed as data instead of code: the same JSON drives the visual editor,
 * validation, sharing, and the {@link GraphStrategy} interpreter, so what users see on
 * the canvas is exactly what runs in a backtest or live session.
 */
export const StrategyGraphSchema = z.object({
  connections: z.array(
    z.object({
      from: z.object({node: z.string().min(1), port: z.string().min(1).default('out')}),
      to: z.object({node: z.string().min(1), port: z.string().min(1).default('in')}),
    })
  ),
  name: z.string().optional(),
  nodes: z.record(
    z.string().min(1),
    z.object({
      config: z.record(z.string(), z.unknown()).optional(),
      /** Canvas coordinates for the visual editor. Ignored by the interpreter. */
      position: z.object({x: z.number(), y: z.number()}).optional(),
      type: z.string().min(1),
    })
  ),
  version: z.literal(1),
});

export type StrategyGraph = z.infer<typeof StrategyGraphSchema>;
export type StrategyGraphInput = z.input<typeof StrategyGraphSchema>;
export type GraphNode = StrategyGraph['nodes'][string];
export type GraphConnection = StrategyGraph['connections'][number];
