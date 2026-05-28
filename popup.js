/*
Copyright (c) 2026 jain-m (Manisha Jain)
This software is released under the MIT License.
https://opensource.org/licenses/MIT
*/

document.getElementById('btnKeyPointsLocal').onclick = () => sendMessage("KeyPointsLocal");
document.getElementById('btnKeyPointsGemini').onclick = () => sendMessage("KeyPointsGemini");
document.getElementById('btnWonder').onclick = () => sendMessage("Wonderizer");
document.getElementById('btnFormalVideo').onclick = () => sendMessage("FormalVideoTranscript");

async function sendMessage(type) {
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    const statusEl = document.getElementById('status');
    
    if (!tab) {
      console.error("No active tab found");
      statusEl.textContent = "No active tab found.";
      return;
    }

    if (type === "FormalVideoTranscript" && !tab.url.includes("youtube.com/watch")) {
      alert("Formal transcript only works on YouTube video pages!");
      return;
    }

    chrome.runtime.sendMessage({ 
      action: "execute_task", 
      type: type, 
      tabId: tab.id,
      url: tab.url,
      selectionText: null
    });

    if (type === 'KeyPointsLocal') {
      statusEl.textContent = 'Key points requested (local), generating summary...';
    } else if (type === 'KeyPointsGemini') {
      statusEl.textContent = 'Key points requested (Gemini), generating summary...';
    } else if (type === 'FormalVideoTranscript') {
      statusEl.textContent = 'Formal transcript requested, generating summary...';
    } else if (type === 'Wonderizer') {
      statusEl.textContent = 'Wonderizer requested, generating suggestions...';
    }

    // Small delay before closing to ensure the message clears the popup
    setTimeout(() => window.close(), 10000);
    
  } catch (error) {
    console.error("Popup Error:", error);
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'status') {
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = msg.message;
  }
});