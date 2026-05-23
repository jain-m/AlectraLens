const getKey = async () => (await chrome.storage.local.get(['MY_API_KEY'])).MY_API_KEY || (console.warn("API Key missing"), null);

(async function listMyModels() {
  const key = await getKey();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const { models, error } = await res.json();
    if (error) throw error.message;
    models.filter(m => m.supportedGenerationMethods.includes("generateContent"))
          .forEach(m => console.log(`- ${m.name.split('/').pop()} (${m.displayName})`));
  } catch (e) { console.error("Error: ", e); }
})();

// --- Context Menu (Right-click) ---
chrome.runtime.onInstalled.addListener(() => {
  const menu = (id, title, contexts, parentId, documentUrlPatterns) => 
    chrome.contextMenus.create({ id, title, contexts, parentId, documentUrlPatterns });

  menu("AL", "AlectraLens", ["all"]);
  menu("KeyPointsLocal", "Key Points (Local)", ["all"], "AL");
  menu("KeyPointsGemini", "Key Points (Gemini)", ["all"], "AL");
  menu("FormalVideoTranscript", "Formal Video Transcript", ["video", "link"], "AL", ["*://*.youtube.com/*"]);
  menu("Wonderizer", "I was wondering...", ["selection"], "AL");
});

async function handleAction(tabId, type, url, selectionText) {
  const inject = (fn, args) => chrome.scripting.executeScript({ target: { tabId: tabId }, func: fn, args });
  const text = selectionText ? String(selectionText) : null;
  if (type === "Wonderizer") return inject(runWonderizer, [text]);
  inject(runDiscuss, [type, url, text]);
}

//--- Toolbar Buttons (Pinned Extension) ---
chrome.runtime.onMessage.addListener((req) => {
  if (req.action === "execute_task") (async () => {
    handleAction(req.tabId, req.type, req.url, req.selectionText);
  })();
  return true; 
});

// --- Context Menu (Right-click) ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  handleAction(tab.id, info.menuItemId, info.linkUrl || info.pageUrl || tab.url, info.selectionText);
});

//----- Discuss (chatbot window)
async function runDiscuss(type, url, selectionText) {
  document.getElementById("gemini-discuss-widget")?.remove(); // Remove existing widget if any
  const el = Object.assign(document.createElement('div'), { id: "gemini-discuss-widget" });
  el.style.cssText = "position:fixed;top:5vh;left:calc(50vw - 260px);width:520px;height:560px;background:#fff;z-index:2147483647;border:1px solid #a2a9b1;display:flex;flex-direction:column;resize:both;min-width:320px;min-height:280px;overflow:hidden;";

  el.innerHTML = `
    <div id="discuss-header" style="background:#f1f3f5;padding:10px;border-bottom:1px solid #a2a9b1;display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none;">
      <strong>AlectraLens</strong>
      <button id="discuss-close" style="font-size:20px;cursor:pointer;">&times;</button>
    </div>
    <div id="discuss-messages" style="flex:1;overflow:auto;padding:12px;background:#fafbfc;"></div>
    <div id="discuss-status" style="padding:6px 10px;font-size:12px;color:#555;border-top:1px solid #e2e6ea;">Ready</div>
    <div style="padding:10px;border-top:1px solid #e2e6ea;display:flex;gap:6px;flex-shrink:0;">
      <input id="discuss-input" style="flex:1;padding:8px;border:1px solid #a2a9b1;border-radius:4px;" placeholder="Ask a question about page content" />
      <button id="discuss-send" style="padding:8px 10px;border:1px solid #a2a9b1;border-radius:4px;background:#e9eff5;">Send</button>
    </div>
  `;

  document.body.appendChild(el);
  const messagesEl = el.querySelector('#discuss-messages');
  const statusEl = el.querySelector('#discuss-status');
  const inputEl = el.querySelector('#discuss-input');

  document.getElementById('discuss-close').onclick = () => el.remove();

  // Dragging
  const header = el.querySelector('#discuss-header');
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    isDragging = true;
    dragOffsetX = e.clientX - el.offsetLeft;
    dragOffsetY = e.clientY - el.offsetTop;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    el.style.left = (e.clientX - dragOffsetX) + 'px';
    el.style.top = (e.clientY - dragOffsetY) + 'px';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  function formatMarkdownNew(rawText) {
    const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // 1. Escape and collapse 3+ newlines, but DON'T trim the whole block yet
    let out = escape(rawText).replace(/\n{3,}/g, '\n\n');

    // 2. Standard formatting
    out = out
      .replace(/^#+ (.*$)/gim, '<strong>$1</strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

    // 3. Process lines carefully
    // .trimEnd() preserves the leading spaces needed for nesting
    const lines = out.split('\n').map(l => l.trimEnd()).filter(l => l !== "");
    let listDepth = 0;

    const processed = lines.map(line => {
      // This regex looks for 1 or more spaces (\s+) followed by a bullet
      const match = line.match(/^(\s+)([*|-]\s+)(.*)/); 
      const isTopLevel = line.match(/^([*|-]\s+)(.*)/);
      
      let currentDepth = 0;
      let content = "";

      if (match) {
        currentDepth = 2; // It has leading space
        content = match[3];
      } else if (isTopLevel) {
        currentDepth = 1; // No leading space, but is a bullet
        content = isTopLevel[2];
      }

      if (currentDepth > 0) {
        let tags = '';
        if (currentDepth > listDepth) {
          tags = '<ul>'.repeat(currentDepth - listDepth);
        } else if (currentDepth < listDepth) {
          tags = '</ul>'.repeat(listDepth - currentDepth);
        }
        listDepth = currentDepth;
        return `${tags}<li>${content}</li>`;
      }

      // Close lists if we hit a normal paragraph
      const closingTags = '</ul>'.repeat(listDepth);
      listDepth = 0;
      return `${closingTags}${line}<br>`;
    });

    if (listDepth > 0) processed.push('</ul>'.repeat(listDepth));
    return processed.join('');
  }

  function formatMarkdown(rawText) {
    const escape = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let out = escape(rawText)
      .replace(/^###### (.*$)/gim, '<h6>$1</h6>')
      .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
      .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

    const lines = out.split('\n');
    let inList = false;
    let result = '';
    
    for (const line of lines) {
      const bullet = line.match(/^\s*([*-])\s+(.*)/);
      
      if (bullet) {
        if (!inList) {
          result += '<ul>';
          inList = true;
        }
        result += '<li>' + bullet[2] + '</li>';
      } else {
        if (inList) {
          result += '</ul>';
          inList = false;
        }
        if (line.trim()) {
          result += (result && !result.endsWith('<ul>') ? '<br>' : '') + line;
        }
      }
    }
    
    if (inList) result += '</ul>';
    return result;
  }

  function addMessage(role, w, text) {
    const css = `margin-bottom:8px;padding:8px;font-size:14px;${role === 'user' ? 'background:#dbeafe;color:#0f172a;' : 'background:#f1f5f9;color:#0f172a;'}`;
    const el = w || messagesEl.appendChild(Object.assign(document.createElement('div'), { style: css }));

    el[role === 'assistant' ? 'innerHTML' : 'textContent'] = role === 'assistant' ? formatMarkdown(text) : 'You: ' + text;
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  // Fetch and summarize
  async function fetchText(url, selectionText) {
    let text = selectionText;
    if (!text && !(url && url.includes("youtube.com"))) {
      text = document.body.innerText || 'ERROR: No text found on page.';
    }

    if (url && url.includes("youtube.com/watch")) {
      try {
        const res = await fetch("http://localhost:3000/get-transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoUrl: url })
        });
        const data = await res.json();
        text = data.text || 'ERROR: Transcript unavailable.';
      } catch (e) {
        console.warn("Video transcript fetch failed:", e);
        text = 'ERROR: Transcript fetch failed.';
      }
    }
    return text;
  }

  const getKey = async () => (await chrome.storage.local.get(['MY_API_KEY'])).MY_API_KEY || (console.warn("API Key missing"), null);

  async function summarizeText(prompt, text = '', useLocal = true) {
    let modelUrl, body;

    if (useLocal) {
      modelUrl = 'http://localhost:11434/api/generate';
      body = { model: 'gemma4:e4b', prompt: `${prompt}\n${text}`, stream: false };
    } else {
      const key = await getKey();
      const model = "gemini-2.5-flash";
      modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      body = { contents: [{ parts: [{ text: `${prompt}:\n${text}` }] }] };
    }

    const res = await fetch(modelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    return data?.candidates?.[0]?.content?.[0]?.parts?.[0]?.text || 
          data?.candidates?.[0]?.content?.parts?.[0]?.text || 
          data.response || 
          data?.error?.message || 
          'No answer from API';
  }

  async function ask(question) {
    if (!question.trim()) return;
    addMessage('user', question);
    inputEl.value = '';

    statusEl.textContent = 'Thinking...';
    const prompt = `Use the following context and answer user questions.`;
    const text = `Page content:\n${summary}\n\nQuestion: ${question}\nAnswer:`;

    const assistantMessage = await summarizeText(prompt, text);
    statusEl.textContent = '';
    addMessage('assistant', assistantMessage.trim());
  }

  statusEl.textContent = 'Fetching transcript...';
  const text = await fetchText(url, selectionText);
  const b = addMessage('assistant', null, `${text}`);

  let prompt = type === "FormalVideoTranscript" 
    ? "Rewrite the following podcast transcript into a formal, polished document. Strictly remove all filler words (e.g., 'um', 'uh', 'like', 'you know', 'right?'), verbal stubs, and recursive repetitions. Correct grammatical errors inherent in spoken speech while preserving the original meaning and core insights. Format the output as a clean, professional narrative or dialogue.\n" 
    : "List key points from the following text:\n";

  const useLocal = type === "KeyPointsLocal";
  statusEl.textContent = `Summarizing... ${text.length} characters, ${useLocal ? 'using local model' : 'using Gemini API'}`;
  try {
    const summary = await summarizeText(prompt, text, useLocal);
    addMessage('assistant', b, `${summary}`);
    statusEl.textContent = 'Ready';
  } catch (e) {
    console.error('Summarization failed:', e);
    addMessage('assistant', b, `Error: ${e.message}`);
    statusEl.textContent = 'Error';
  }

  document.getElementById('discuss-send').onclick = () => ask(inputEl.value);
  inputEl.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); ask(inputEl.value); }});
}

//----- Wonderizer
async function runWonderizer(passedText) {
  const model = "gemini-2.5-flash";
  const modelKey = await getKey();
  const selected = passedText || document.body.innerText, uiId = "wf-wonder";
  const prompt = "Summarize core idea & generate 5 prompts (Clarify, Challenge, etc) that are 10 words max.";
  const format = "a markdown bulleted list starting each line with a dash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
  // Inject Styles
  const style = document.createElement('style');
  style.textContent = `.ww-c{position:relative;width:450px;height:450px;margin:20px auto;display:grid;place-items:center}.ww-n{position:absolute;width:150px;display:grid;place-items:center}.ww-i{background:#fff;border:1px solid #ccc;padding:10px;border-radius:8px;font-size:13px}.ww-mid{width:140px;height:140px;background:#36c;color:#fff;border-radius:50%;display:grid;place-items:center;font-size:12px;padding:15px}`;

  const el = document.createElement('div');
  el.id = uiId;
  el.style.cssText = "position:fixed;top:20px;right:20px;width:600px;height:700px;background:#f8f9fa;z-index:2147483647;border:1px solid #a2a9b1;";
  el.innerHTML = `<div style="background:#eaecf0;padding:10px;display:flex;border-bottom:1px solid #a2a9b1;"><b>Wonderizer</b><button onclick="this.closest('#${uiId}').remove()" style="font-size:22px;">&times;</button></div><div id="w-body" style="overflow:auto;padding:15px;">Loading Visualization...</div>`;
  document.body.appendChild(el);

  try {
    const res = await fetch(`${url}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${prompt} Format: ${format}. Content: ${selected.slice(0, 5000)}` }] }] })
    });
    const data = await res.json();
    if (data.error) throw data.error;
    
    const raw = data.candidates[0].content.parts[0].text;
    console.log("Raw Wonderizer Response:", raw);
    const points = raw.split('\n').filter(l => l.match(/^[*|-]|\d+\./)).map(l => l.replace(/^[*|-]\s?|^\d+\.\s?/, '').trim()).slice(0, 8);
    
    const nodes = points.map((p, i) => {
      const ang = (i * 360) / points.length;
      return `<div class="ww-n" style="transform:rotate(${ang}deg) translate(150px) rotate(-${ang}deg)"><div class="ww-i">${p}</div></div>`;
    }).join('');

    document.getElementById('w-body').innerHTML = `<div class="ww-c"><div class="ww-mid">${selected.slice(0, 30)}...</div>${nodes}</div>`;
  } catch (e) { document.getElementById('w-body').innerHTML = `<div style="color:red">${e.message}</div>`; }
}