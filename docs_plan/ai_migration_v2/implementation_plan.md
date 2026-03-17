# Implementation Plan: AI Migration v2 (Tesseract + Local LLM)

## Overview
This plan outlines the transition from external AI providers (e.g., Google Gemini) to a local solution for document extraction and data structuring. This is specifically targeted at fast client registration and migration tasks.

## Objectives
- Replace external AI API calls with local processing.
- Use **Tesseract OCR** to extract raw text from uploaded images/documents.
- Use a **Local LLM** (Phi-3 Mini or Gemma 2B via Ollama) to parse and structure the raw text into valid JSON.
- Maintain compatibility with the existing `AIService` interface where possible.

## Technology Stack
- **OCR**: Tesseract OCR (via Go wrapper or CLI).
- **LLM**: Ollama running Phi-3 Mini (3.8B) or Gemma 2B.
- **Backend**: Go (existing service architecture).

## Step-by-Step Implementation

### Phase 1: Environment Setup
1. [ ] Install Tesseract OCR on the server.
2. [ ] Install Ollama and pull the `phi3` or `gemma:2b` model.
3. [ ] Verify connectivity from the Go backend to the Ollama API (`localhost:11434`).

### Phase 2: Documentation & Planning
1. [x] Create `docs_plan/ai_migration_v2` directory.
2. [x] Draft this implementation plan.

### Phase 3: Backend Development
1. [ ] Create a new `LocalAIProvider` in `be/internal/infra/ai_provider/local_provider.go`.
2. [ ] Implement `ExtractStructuredData` in `LocalAIProvider`:
    - Step A: Process input (image/PDF) using Tesseract to get raw text.
    - Step B: Construct a prompt containing the raw text and instructions for the LLM.
    - Step C: Call Ollama API to get structured JSON output.
3. [ ] Update `AIService` to include the `Local` provider.
4. [ ] Add configuration options for the local provider (Ollama URL, model name, etc.).

### Phase 4: UI Updates (Optional/If needed)
1. [ ] Check if the frontend needs adjustments for the new "Local" provider option.
2. [ ] Ensure the upload flow handles errors from the local processing pipeline gracefully.

### Phase 5: Verification & Testing
1. [ ] Test with sample KTP/ID images.
2. [ ] Test with sample ISP billing screenshots.
3. [ ] Validate JSON output against `client.Client` domain model.

## Documentation
- All implementation details, prompts, and configurations will be stored in `docs_plan/ai_migration_v2/`.
