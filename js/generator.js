import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// __dirname replacement in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const endpoint = process.env.AOAI_ENDPOINT.replace(/\/$/,'')
const apiKey = process.env.AOAI_KEY
const apiVersion = process.env.AOAI_API_VERSION
const imageDeploymentName = process.env.AOAI_IMAGE_DEPLOYMENT_NAME
const chatDeploymentName = process.env.AOAI_CHAT_DEPLOYMENT_NAME

/**
 * Generate copy text prompts based on objectives
 * @param {string} objectives
 * @returns {Promise<object>} Parsed JSON with copy_text_main, copy_text_sub, captions_en, captions_ja
 */
async function generateInputs(objectives) {

  const url = `${endpoint}/openai/deployments/${chatDeploymentName}/chat/completions?api-version=${apiVersion}`;
  const resp = await axios.post(url, {
    messages: [{ role: 'user', content: `あなたはPOPを生成するAIです。以下の目的に基づいて、適切なテキストと画像を生成するためのプロンプトを生成します。テキストは日本語で作成します。背景生成プロンプトは英語で作成し、日本語に翻訳してください.[{'copy_text_main':'主となるテキスト','copy_text_sub':'サブテキスト','captions_en':'image generation prompt','captions_ja':'画像生成プロンプト'}] 目的: ${objectives}` }],
    max_tokens: 1000,
    temperature: 0.7,
    response_format: {
      "type": "json_schema",
      "json_schema": {
        "name": "generated_copy_text",
        "strict": true,
        "schema": {
            "type": "object",
            "properties": {
                "copy_text_main": {
                    "type": "string"
                },
                "copy_text_sub": {
                    "type": "string"
                },
                "captions_en": {
                    "type": "string"
                },
                "captions_ja": {
                    "type": "string"
                }
            },
            "required": ["copy_text_main", "copy_text_sub", "captions_en", "captions_ja"],
            "additionalProperties": false
        }
      }
    }
  }, {
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' }
  });
  // pick the JSON content and parse
  const content = resp.data.choices[0].message.content;
  return JSON.parse(content);
}

/**
 * Generate an image based on prompt, save as JPG, and return file path
 * @param {string} prompt
 * @param {string} filePath  Absolute path to save the JPG
 * @returns {Promise<string>} Path to saved JPG file
 */
async function generateImage(prompt, filePath) {
  console.log('Generating image prompt: ' + prompt);
  const url = `${endpoint}/openai/deployments/${imageDeploymentName}/images/generations?api-version=${apiVersion}`;
  const resp = await axios.post(url, {
    prompt,
    size: '1024x1024',
    n: 1
  }, {
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' }
  });
  const b64 = resp.data.data[0].b64_json;
  fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
  return filePath;
}

/**
 * Edit an existing image based on prompt
 * @param {string} prompt   Instructions for editing
 * @param {string} filePath Absolute path to the image to edit
 * @returns {Promise<string>} The same filePath after editing
 */
async function editImage(prompt, filePath) {
  console.log(`Editing image ${filePath} with prompt: ${prompt}`);
  const url = `${endpoint}/openai/deployments/${imageDeploymentName}/images/edits?api-version=${apiVersion}`;

  const form = new FormData();
  form.append('image', fs.createReadStream(filePath));
  form.append('prompt', prompt);
  form.append('size', '1024x1024');
  form.append('n', 1);

  const resp = await axios.post(url, form, {
    headers: { 'api-key': apiKey, 'Content-Type': 'multipart/form-data' }
  });
  const b64 = resp.data.data[0].b64_json;
  fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
  return filePath;
}

export { generateInputs, generateImage, editImage };
