/*
Copyright (c) 2026 jain-m (Manisha Jain)
This software is released under the MIT License.
https://opensource.org/licenses/MIT
*/

// Save key to chrome.storage
document.getElementById('save').addEventListener('click', () => {
  const key = document.getElementById('apiKey').value;
  chrome.storage.local.set({ MY_API_KEY: key }, () => {
    alert('Key saved locally!');
  });
});