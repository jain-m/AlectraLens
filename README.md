<!--
Copyright (c) 2026 jain-m (Manisha Jain)
This software is released under the MIT License.
https://opensource.org/licenses/MIT
-->

# AlectraLens Chrome Extension

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AlectraLens is a Chrome extension that adds quick summarization and content analysis tools to the browser. It supports local model summarization and Gemini API summarization, plus transcript processing for YouTube videos.

Repository: https://github.com/jain-m/AlectraLens

## Clone from GitHub

```bash
git clone https://github.com/jain-m/AlectraLens.git
cd AlectraLens
```

## Features

- **Key Points (Local)**: Summarize page text using a local model endpoint.
- **Key Points (Gemini)**: Summarize page text using Google Gemini API.
- **Formal Transcript**: Rewrite YouTube video transcripts into a clean, formal narrative.
- **Wonderer**: Generate prompt-style insights from selected text.
- **Right-click context menu** for quick access.
- **Popup UI** for quick task execution.
- **Options page** to save API key.

## Files

- `manifest.json` - Chrome extension manifest and permissions.
- `background.js` - Service worker that handles context menu commands, popup messages, and summarization logic.
- `popup.html` / `popup.js` - Popup UI and interaction logic.
- `options.html` / `options.js` - API key configuration page.
- `server.py` - Optional local Flask server to fetch YouTube transcripts.

## Prerequisites

- Chrome or another Chromium-based browser.
- Python 3 installed for the optional transcript server.
- A Gemini API key from https://aistudio.google.com/app/api-keys when using `Key Points (Gemini)`
- Ollama installed and a local model server running at `http://localhost:11434` for `Key Points (Local)`.

## Local Ollama setup

`Key Points (Local)` uses a local Ollama endpoint at `http://localhost:11434/api/generate` with the model `gemma4:e4b`.

1. Install Ollama from https://ollama.com.
2. Start the Ollama API server on port `11434`:

```bash
ollama serve --listen 0.0.0.0:11434
```

3. Install a compatible model, such as `gemma4` / `gemma4:e4b`:

```bash
ollama install gemma4
```

4. Confirm the service is running:

```bash
curl http://localhost:11434/v1/models
```

If your local model uses a different name, update the `model` field in `background.js` accordingly.

## Install the extension locally

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable `Developer mode` in the top-right.
4. Click `Load unpacked`.
5. Select the `AlectraLens` project folder.
6. The extension should appear as `AlectraLens`.

## Configure the API key

1. Open the extension menu and choose `Options`.
2. Enter your Gemini API key into the `API Key` field.
3. Click `Save Key`.

## Run the optional transcript server

If you want YouTube transcript support, run the Python server:

```bash
pip install flask flask-cors youtube-transcript-api
python server.py
```

The extension will request transcripts from `http://localhost:3000/get-transcript`.

## Usage

- Click the extension icon and choose one of the buttons:
  - `Key Points (Local)`
  - `Key Points (Gemini)`
  - `Formal Transcript`
  - `Wonderer`
- Or right-click on the page and choose the same commands from the `AlectraLens` menu.
- For video transcripts, open a YouTube watch page first.

## Notes

- `Key Points (Local)` sends the request to a local generative model endpoint.
- `Key Points (Gemini)` uses the Gemini API and requires a valid API key saved in options.
- The extension stores the API key in Chrome local storage.

## Troubleshooting

- If the extension does not load, verify the folder contains `manifest.json`.
- If the local model fails, confirm a local server is available at `http://localhost:11434`.
- If Gemini returns an error, verify your API key is correct and the network is available.

## License

This project is released under the MIT License. See the full license in the [LICENSE](LICENSE) file.

Copyright (c) 2026 jain-m (Manisha Jain)
