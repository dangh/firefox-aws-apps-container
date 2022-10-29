'use strict';

const COLORS = ['blue', 'turquoise', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'toolbar'];
const ICONS = ['fingerprint', 'briefcase', 'dollar', 'cart', 'vacation', 'gift', 'food', 'fruit', 'pet', 'tree', 'chill', 'circle', 'fence'];

let ssoToken;

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.action == 'openUrlInContainer') {
    return new Promise(async (reply) => {
      // open blank new tab in container
      // if we cannot detect signin url within 500ms
      // redirect to the login page
      let tab = await openUrlInContainer('about:blank', message.container, sender.tab.index + 1);
      setTimeout(async () => {
        tab = browser.tabs.get(tab.id);
        if (tab.url == 'about:blank') {
          redirect(tab.id, message.url);
        }
      }, 500);
      reply({ ssoToken, tabId: tab.id });
    });
  }
});

captureRequestHeaders({
  urls: ['https://*.amazonaws.com/user'],
  types: ['xmlhttprequest'],
  onHeaders(headers, { details }) {
    let newToken = headers['x-amz-sso-bearer-token'];
    if (newToken && (newToken != ssoToken)) {
      console.info('Got new SSO token:', newToken);
      ssoToken = newToken;
    }
  }
});

captureResponeData({
  urls: ['https://*.amazonaws.com/federation/console?*'],
  types: ['xmlhttprequest'],
  onJSON(json, { details }) {
    console.debug('Federation details:', json);
    let { signInToken, signInFederationLocation, destination } = json;
    if (signInToken) {
      if (!destination) {
        let region = /\.(?<region>\w+-\w+-\d)\./.exec(details.url).groups.region;
        destination = `https://${region}.console.aws.amazon.com/console/home?region=${region}`;
      }
      let signInUrl = signInFederationLocation + '?Action=login&SigninToken=' + signInToken + '&Issuer=' + encodeURIComponent(details.originUrl) + '&Destination=' + encodeURIComponent(destination);
      let tabId = details.url.split('#tab_id=').pop();
      redirect(tabId, signInUrl);
    }
  }
});

async function openUrlInContainer(url, container, index) {
  let context = await ensureContainer(container);
  let tab = await browser.tabs.create({
    url,
    cookieStoreId: context.cookieStoreId,
    index,
  });
  return tab;
}

async function ensureContainer({ name, icon, color }) {
  let contexts = await browser.contextualIdentities.query({ name });
  if (contexts.length > 0) return contexts[0];

  return await browser.contextualIdentities.create({
    name,
    color: color || COLORS[Math.floor(Math.random() * COLORS.length)],
    icon: icon || ICONS[Math.floor(Math.random() * ICONS.length)],
  });
}

function captureResponeData({ urls, types, onJSON }) {
  browser.webRequest.onBeforeRequest.addListener(
    details => {
      if (details.method == 'OPTIONS') return;

      let filter = browser.webRequest.filterResponseData(details.requestId);
      let decoder = new TextDecoder('utf-8');
      let str = '';

      filter.ondata = event => {
        str += decoder.decode(event.data, { stream: true });
        filter.write(event.data);
      };

      filter.onstop = event => {
        filter.disconnect();

        let json = JSON.parse(str);
        onJSON(json, { details });
      };
    },
    { urls, types },
    ['blocking']
  );
}

function captureRequestHeaders({ urls, types, onHeaders }) {
  browser.webRequest.onBeforeSendHeaders.addListener(
    details => {
      if (details.method == 'OPTIONS') return;

      let headers = details.requestHeaders.reduce((map, { name, value }) => { map[name] = value; return map; }, {});
      onHeaders(headers, { details });
    },
    { urls, types },
    ['requestHeaders']
  );
}

function redirect(tabId, url) {
  console.info('Redirect tab:', tabId, 'to', url)
  browser.tabs.executeScript(+tabId, {
    code: `window.location.href = '${url}'`,
    matchAboutBlank: true,
  });
}
