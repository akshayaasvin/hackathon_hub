/**
 * Wraps a promise in a timeout that rejects if the promise does not resolve within the specified milliseconds.
 */
export async function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, ms: number = 5000): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Request Timeout: The database query took too long to resolve. Please retry.'));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}
