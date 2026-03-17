# Setup Guide: AI Migration v2 (Local)

To use the local AI extraction feature, you need to install two main components on your server/environment.

## 1. Tesseract OCR (The Eye)
Tesseract is used to read text from images.

### Windows (Development)
1. Download the installer from [UB Mannheim Tesseract](https://github.com/UB-Mannheim/tesseract/wiki).
2. Install it and **CRITICAL**: Add the installation path (e.g., `C:\Program Files\Tesseract-OCR`) to your System **PATH** environment variable.
3. Restart your terminal/IDE to apply the PATH changes.
4. Verify by running: `tesseract --version`.

### Linux (Production)
```bash
sudo apt update
sudo apt install tesseract-ocr
# Optional: Install Indonesian language pack
sudo apt install tesseract-ocr-ind
```

---

## 2. Ollama & Phi-3 (The Brain)
Ollama is used to run the LLM that structures the text.

### Installation
1. Download and install from [ollama.com](https://ollama.com).
2. Once installed, run the following command to download the Phi-3 model:
   ```bash
   ollama run phi3
   ```
3. Keep Ollama running in the background. It listens on `http://localhost:11434` by default.

---

## 3. Configuration in RRNet
1. Log in as **Owner**.
2. Go to **Settings > AI & Automation**.
3. Toggle "Enable AI Capabilities" to **ON**.
4. Select **Local (Ollama)** as the Primary Provider.
5. Set the model to **Phi-3 Mini**.
6. Set the Ollama API URL to `http://localhost:11434` (or your custom URL).
7. Click **Save AI Configuration**.

## 4. Troubleshooting
- **Error: "tesseract not found"**: Ensure Tesseract is in your system PATH and the backend has been restarted.
- **Error: "connection refused to localhost:11434"**: Ensure Ollama is running and the URL is correct.
- **Low Accuracy**: Ensure the uploaded image is clear. Phi-3 is a small model; for better results, make sure the prompt follows the expected JSON structure.
