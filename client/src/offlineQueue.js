import { get, set } from "idb-keyval";

const KEY = "ohk_pending_checkins";

export async function getQueue() {
  return (await get(KEY)) || [];
}

export async function getQueueCount() {
  const queue = await getQueue();
  return queue.length;
}

export async function enqueueCheckin(payload) {
  const queue = await getQueue();
  queue.push({
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
    payload
  });
  await set(KEY, queue);
}

export async function flushQueue(submitFn) {
  const queue = await getQueue();
  if (!queue.length) return { flushed: 0, remaining: 0 };

  const remaining = [];
  let flushed = 0;

  for (const item of queue) {
    try {
      await submitFn(item.payload);
      flushed++;
    } catch (e) {
      remaining.push(item);
    }
  }

  await set(KEY, remaining);
  return { flushed, remaining: remaining.length };
}