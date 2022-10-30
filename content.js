'use strict';

const __ = console.warn.bind(console, '📦');

observeAdd('a.profile-link', $elements => {
  for (let $element of $elements) {
    let match = /\/(?<accountId>\d+) \((?<instanceName>[^)]+)\)\//.exec(decodeURIComponent($element.href));
    let instanceName = match?.groups?.instanceName;
    let profileName = $element.title;
    let accountId = match?.groups?.accountId;
    let accountEmail = $element.closest('portal-instance')?.querySelector('.email')?.textContent;
    let region = document.querySelector('meta[name=region]').content;
    if (profileName) {
      $element.addEventListener('click', evt => {
        evt.preventDefault();
        evt.stopPropagation();

        let ssoContext = {
          instanceName,
          profileName,
          accountId,
          accountEmail,
          region,
        };

        openUrl($element.href, ssoContext);
      });
    }
  }
});

async function openUrl(url, ssoContext) {
  __('Open url:', url, 'in context:', ssoContext);
  let reply = await browser.runtime.sendMessage({
    action: 'openUrl',
    url,
    ssoContext,
  });
  __('Reply:', reply);

  if (reply.action == 'federate') {
    __('Federation needed');
    let ssoToken = /x-amz-sso_authn=(?<token>[^\s;]+)/.exec(document.cookie)?.groups?.token;
    __('Extracted SSO token from cookie:', ssoToken);
    let federationUrl = `https://portal.sso.${ssoContext.region}.amazonaws.com/federation/console?account_id=${ssoContext.accountId}&role_name=${ssoContext.profileName}`;
    __('Federate with url:', federationUrl);
    let federationResponse = await fetch(federationUrl, {
      method: 'GET',
      headers: {
        'x-amz-sso_bearer_token': ssoToken,
        'x-amz-sso-bearer-token': ssoToken,
      },
    });
    let federationResult = await federationResponse.json();
    browser.runtime.sendMessage({
      action: 'login',
      tabId: reply.tabId,
      federationUrl,
      federationResult,
      ssoContext,
    });
  }
}

function observeAdd(selector, handle) {
  let handled = new WeakSet();
  let observer = new MutationObserver(() => {
    let newlyAdded = [];
    document.querySelectorAll(selector).forEach(ele => {
      if (!handled.has(ele)) {
        newlyAdded.push(ele);
        handled.add(ele);
      }
    });
    if (newlyAdded.length > 0) handle(newlyAdded);
  });
  observer.observe(document, {
    childList: true,
    subtree: true,
  });
  // run once on start
  let existing = [];
  document.querySelectorAll(selector).forEach(ele => {
    if (handled.has(ele)) return;
    existing.push(ele);
    handled.add(ele);
  });
  if (existing.length > 0) handle(existing);
  return function stop() {
    observer.disconnect();
  };
}
