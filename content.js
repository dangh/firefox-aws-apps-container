'use strict';

observeAdd('a.profile-link', ($elements) => {
  for (let $element of $elements) {
    let match = /\/(?<accountId>\d+) \((?<instanceName>[^)]+)\)\//.exec(decodeURIComponent($element.href));
    let instanceName = match?.groups?.instanceName;
    let profileName = $element.title;
    let accountId = match?.groups?.accountId;
    let accountEmail = $element.closest('portal-instance')?.querySelector('.email')?.textContent;
    if (profileName) {
      $element.addEventListener('click', async (evt) => {
        evt.preventDefault();
        evt.stopPropagation();

        let { ssoToken, tabId } = await browser.runtime.sendMessage({
          action: 'openUrlInContainer',
          url: $element.href,
          container: getContainerConfig({ instanceName, profileName, accountId, accountEmail }),
        });

        // fire request to fetch federation details, background will intercept and redirect accordingly
        if (!ssoToken) ssoToken = /x-amz-sso_authn=(?<token>[^\s;]+)/.exec(document.cookie)?.groups?.token;
        let region = document.querySelector('meta[name=region]').content;
        let federationUrl = `https://portal.sso.${region}.amazonaws.com/federation/console?account_id=${accountId}&role_name=${profileName}#tab_id=${tabId}`;
        fetch(federationUrl, {
          method: 'GET',
          headers: {
            'x-amz-sso_bearer_token': ssoToken,
            'x-amz-sso-bearer-token': ssoToken,
          }
        });
      });
    }
  }
});

function observeAdd(selector, handle) {
  let added = new WeakSet();
  let timer;
  let observer = new MutationObserver(() => {
    if (!timer) {
      timer = setTimeout(function throttleHandle() {
        let newlyAdded = [];
        document.body.querySelectorAll(selector).forEach((ele) => {
          if (!added.has(ele)) {
            newlyAdded.push(ele);
            added.add(ele);
          }
        });
        if (newlyAdded.length > 0) handle(newlyAdded);
        clearTimeout(timer);
        timer = 0;
      }, 0);
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  return function stop() {
    observer.disconnect();
  };
}

function getContainerConfig({ instanceName, profileName, accountId, accountEmail }) {
  let icon, color, name;

  if (instanceName.startsWith('Travelstop')) {
    icon = 'vacation';
    let stage = ({
      'Travelstop PRODUCTION': 'PROD',
      'Travelstop STAGE': 'STAGE',
      'Travelstop TEST': 'TEST',
      'Travelstop DEV': 'DEV',
      'Travelstop DEV INDIA': 'DEV-IN',
    }[instanceName]);
    color = ({
      'PROD': 'red',
      'STAGE': 'yellow',
      'TEST': 'blue',
      'DEV': 'turquoise',
      'DEV-IN': 'purple',
    }[stage]);
    name = profileName.replace(/(Non)?Prod$/, '') + ' — ' + stage;
  } else {
    name = '{instance} / {profile}';
  }

  name = name
    .replace('{profile}', profileName)
    .replace('{instance}', instanceName)
    .replace('{accountId}', accountId)
    .replace('{accountEmail}', accountEmail);

  return { name, icon, color };
}
