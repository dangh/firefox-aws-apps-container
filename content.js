'use strict';

observeAdd('a.profile-link', ($elements) => {
  for (let $element of $elements) {
    let profileName = $element.closest('portal-instance')?.querySelector('.name')?.textContent;
    if (profileName) {
      $element.addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        browser.runtime.sendMessage({ action: 'openUrlInContainer', url: $element.href, container: profileName });
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
