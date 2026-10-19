/** 限制并发 adb，避免 Windows 上多路 shell 卡死 */
const MAX = 4;
let active = 0;
const waiters: (() => void)[] = [];

function release() {
  active = Math.max(0, active - 1);
  const next = waiters.shift();
  if (next) next();
}

function acquire(): Promise<void> {
  if (active < MAX) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waiters.push(() => {
      active += 1;
      resolve();
    });
  });
}

export async function withAdbSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}
