'use strict';

const COLORS = ['blue', 'turquoise', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'toolbar'];
const ICONS = ['fingerprint', 'briefcase', 'dollar', 'cart', 'vacation', 'gift', 'food', 'fruit', 'pet', 'tree', 'chill', 'circle', 'fence'];
const SETTINGS = {
  dashboardUrl: 'https://{region}.console.aws.amazon.com/console/home?region={region}',
  timeToReauth: 5*60,
  defaultContainerName: '{instance} / {profile}',
};

let __ = console.log.bind(console, '📦');

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.action == 'openUrl') {
    return new Promise(async reply => {
      let { url, ssoContext } = message;
      __('Request to open url:', url, 'in context:', ssoContext);
      // check if login is needed
      let container = await createContainer(ssoContext);
      let { region, expirationDate } = await getContainerContext({ container });
      __('Container context:', { region, expirationDate });
      let shouldReAuth = (Date.now()/1000 + SETTINGS.timeToReauth >= expirationDate);
      if (!shouldReAuth) {
        let dashboardUrl = SETTINGS.dashboardUrl.replaceAll('{region}', region || ssoContext.region);
        __('Credential still valid. Open dashboard:', dashboardUrl);
        openUrl(dashboardUrl, { container, opener: sender.tab });
        reply({});
      } else {
        __('Credential expired. Reauthenticate.');
        // open blank new tab in container
        // if we cannot detect signin url within 500ms
        // redirect to the login page
        let tabId = await openUrl('about:blank', { container, opener: sender.tab });
        setTimeout(() => {
          let tab = browser.tabs.get(tabId);
          if (tab.url == 'about:blank') {
            openUrl(url, { tabId });
          }
        }, 500);
        reply({ action: 'federate', tabId });
      }
    });
  } else if (message.action == 'login') {
    return new Promise(async reply => {
      let { tabId, federationUrl, federationResult, ssoContext } = message;
      __('federation details:', federationResult);
      if (federationResult.signInToken) {
        let { region } = await getContainerContext({ tabId });
        let destination = SETTINGS.dashboardUrl.replaceAll('{region}', region || ssoContext.region);
        let signInUrl = federationResult.signInFederationLocation
          + '?Action=login'
          + '&SigninToken=' + federationResult.signInToken
          + '&Issuer=' + encodeURIComponent(federationUrl)
          + '&Destination=' + encodeURIComponent(destination);
        openUrl(signInUrl, { tabId });
      }
      reply();
    });
  }
});

async function openUrl(url, { tabId, container, opener }) {
  if (tabId) {
    browser.tabs.executeScript(+tabId, {
      code: `window.location.href='${url}'`,
      matchAboutBlank: true,
    });
  } else if (container) {
    let tab = await browser.tabs.create({
      url,
      cookieStoreId: container.cookieStoreId,
      ...opener && {
        index: opener.index + 1,
      }
    });
    tabId = tab.id;
  }
  return tabId;
}

async function createContainer(ssoContext) {
  let { name, icon, color } = getContainerConfig(ssoContext);
  let containers = await browser.contextualIdentities.query({ name });
  if (containers.length > 0) return containers[0];

  return await browser.contextualIdentities.create({
    name,
    color: color || COLORS[Math.floor(Math.random() * COLORS.length)],
    icon: icon || ICONS[Math.floor(Math.random() * ICONS.length)],
  });
}

async function getContainerContext({ tabId, container }) {
  __('get container context from:', { tabId, container });
  let cookieStoreId = container?.cookieStoreId;
  if (!cookieStoreId && tabId) {
    let tab = await browser.tabs.get(tabId);
    cookieStoreId = tab.cookieStoreId;
  }
  let region = (await browser.cookies.get({
    storeId: cookieStoreId,
    url: 'https://console.aws.amazon.com',
    name: 'noflush_Region',
  }))?.value;
  let expirationDate = (await browser.cookies.get({
    storeId: cookieStoreId,
    url: `https://${region}.console.aws.amazon.com/console`,
    name: 'aws-creds',
  }))?.expirationDate || 0;
  return { region, expirationDate };
}

function getContainerConfig(ssoContext) {
  let { instanceName, profileName, accountId, accountEmail } = ssoContext;
  let icon, color, name = SETTINGS.defaultContainerName;

  if (instanceName.startsWith('Travelstop')) {
    icon = 'vacation';
    let stage = {
      'Travelstop PRODUCTION': 'PROD',
      'Travelstop STAGE': 'STAGE',
      'Travelstop TEST': 'TEST',
      'Travelstop DEV': 'DEV',
      'Travelstop DEV INDIA': 'DEV-IN',
    }[instanceName];
    color = {
      'PROD': 'red',
      'STAGE': 'yellow',
      'TEST': 'blue',
      'DEV': 'turquoise',
      'DEV-IN': 'purple',
    }[stage];
    name = profileName.replace(/(Non)?Prod$/, '') + ' — ' + stage;
  }

  name = name
    .replaceAll('{profile}', profileName)
    .replaceAll('{instance}', instanceName)
    .replaceAll('{accountId}', accountId)
    .replaceAll('{accountEmail}', accountEmail);

  return { name, icon, color };
}
