import type {EventEmitter} from 'node:events';

export async function streamEvents(
  emitter: EventEmitter,
  subscribe: () => Promise<string>,
  unsubscribe: (topic: string) => void,
  take: number,
  write: (line: string) => void
) {
  const topic = await subscribe();
  let count = 0;
  let listener: (event: unknown) => void = () => {};
  let onError: (error: Error) => void = () => {};
  try {
    await new Promise<void>((resolve, reject) => {
      onError = reject;
      listener = event => {
        try {
          write(JSON.stringify(event));
          if (++count >= take) {
            emitter.off(topic, listener);
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      };
      emitter.on(topic, listener);
      emitter.on('error', onError);
    });
    return {events: count};
  } finally {
    emitter.off(topic, listener);
    emitter.off('error', onError);
    unsubscribe(topic);
  }
}
