document.addEventListener('DOMContentLoaded', async () => {
  try {
    let code = await browser.storage.sync.get('code');
    if(!code) code = DEFAULT_CODE;
    document.querySelector('#code').value = code;
  } catch(err) {
    console.log(`Error: ${err}`);
  }
});

document.querySelector('form').addEventListener('submit', (evt) => {
  evt.preventDefault();
  browser.storage.sync.set({
    code: document.querySelector('#code').value,
  });
});
