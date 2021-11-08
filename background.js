'use strict';

const COLORS = ['blue', 'turquoise', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'toolbar'];
const ICONS = ['fingerprint', 'briefcase', 'dollar', 'cart', 'circle', 'gift', 'vacation', 'food', 'fruit', 'pet', 'tree', 'chill', 'fence'];

browser.runtime.onMessage.addListener((message, sender, reply) => {
  console.log('ping:', message);
  if (message.action == 'openUrlInContainer') {
    openUrlInContainer(message.url, message.container, sender.tab);
  }
});

async function openUrlInContainer(url, container, tab) {
  let context = await ensureContainer(container);
  browser.tabs.create({
    url,
    cookieStoreId: context.cookieStoreId,
    index: tab.index + 1,
  });
}

async function ensureContainer(name) {
  let contexts = await browser.contextualIdentities.query({ name });
  if (contexts.length > 0) return contexts[0];

  return await browser.contextualIdentities.create({
    name,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    icon: ICONS[Math.floor(Math.random() * ICONS.length)],
  });
}
