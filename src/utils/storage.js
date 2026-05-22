import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_PATH = path.resolve(process.cwd(), 'data/orders.json');

async function ensureFile() {
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, '[]', 'utf8');
  }
}

export async function readOrders() {
  await ensureFile();
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeOrders(orders) {
  await ensureFile();
  await fs.writeFile(DATA_PATH, JSON.stringify(orders, null, 2), 'utf8');
}

export async function createOrder(order) {
  const orders = await readOrders();
  orders.push(order);
  await writeOrders(orders);
  return order;
}

export async function findOrder(orderId) {
  const orders = await readOrders();
  return orders.find((order) => order.id === orderId) ?? null;
}

export async function updateOrder(orderId, patch) {
  const orders = await readOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index === -1) return null;
  orders[index] = { ...orders[index], ...patch, updatedAt: new Date().toISOString() };
  await writeOrders(orders);
  return orders[index];
}

export async function getUserOrders(userId, limit = 5) {
  const orders = await readOrders();
  return orders
    .filter((order) => order.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}
