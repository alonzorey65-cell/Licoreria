export function createQueuedRefresh(refresh) {
  let running = null;
  let queued = null;

  const start = () => {
    const request = Promise.resolve().then(refresh);
    running = request;
    request.then(
      () => { if (running === request) running = null; },
      () => { if (running === request) running = null; }
    );
    return request;
  };

  return () => {
    if (!running) return start();
    if (!queued) {
      const startNext = () => {
        queued = null;
        return start();
      };
      queued = running.then(startNext, startNext);
    }
    return queued;
  };
}
