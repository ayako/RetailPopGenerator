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

// Load environment variables. Use .env when running locally
if (!process.env.WEBSITE_SITE_NAME) {
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
  console.log('Local environment detected: loaded .env file');
} else {
  dotenv.config();
  console.log('Azure environment detected: using App Settings variables');
}

const endpoint = process.env['AOAI_ENDPOINT']?.replace(/\/$/, '') || '';
const apiKey = process.env['AOAI_KEY'] || '';
const apiVersion = process.env['AOAI_API_VERSION'] || '';
const imageDeploymentName = process.env['AOAI_IMAGE_DEPLOYMENT_NAME'] || '';
const videoDeploymentName = process.env['AOAI_VIDEO_DEPLOYMENT_NAME'] || '';
const chatDeploymentName = process.env['AOAI_CHAT_DEPLOYMENT_NAME'] || '';

/**
 * Generate copy text prompts based on objectives
 * @param {string} objectives
 * @returns {Promise<object>} Parsed JSON with copy_text_main, copy_text_sub, captions_en, captions_ja
 */
async function generateInputs(objectives) {

  const url = `${endpoint}/openai/deployments/${chatDeploymentName}/chat/completions?api-version=${apiVersion}`;
  const resp = await axios.post(url, {
    messages: [{ role: 'user', content: `あなたは小売店舗の広告を生成するAIアシスタントです。以下の目的に基づいて、適切なテキストと画像や動画を生成するためのプロンプトを生成します。テキストは日本語で作成します。背景となる画像や動画を生成するプロンプトは英語で作成し、日本語に翻訳してください.[{'copy_text_main':'主となるテキスト','copy_text_sub':'サブテキスト','image_prompt_en':'image generation prompt','image_prompt_ja':'画像生成プロンプト','video_prompt_en':'video generation prompt','video_prompt_ja':'動画生成プロンプト'}] 目的: ${objectives}` }],
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
                "image_prompt_en": {
                    "type": "string"
                },
                "image_prompt_ja": {
                    "type": "string"
                },
                "video_prompt_en": {
                    "type": "string"
                },
                "video_prompt_ja": {
                    "type": "string"
                }
            },
            "required": ["copy_text_main", "copy_text_sub", "image_prompt_en", "image_prompt_ja", "video_prompt_en", "video_prompt_ja"],
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
  const url = `${endpoint}/openai/deployments/${imageDeploymentName}/images/generations?api-version=${apiVersion}`;
  const body = { "prompt": prompt, "n": 1, "size": "1024x1024" };
  console.log('Generating image: request body = ', body);
  const bodyJson = JSON.stringify(body);
  const resp = await axios.post(url, bodyJson, {
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

  const headers = form.getHeaders();
  headers['api-key'] = apiKey;

  const resp = await axios.post(url, form, { headers });
  
  fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
  
    try {
      const imageData = resp.data.data[0].b64_json;
      const buffer = Buffer.from(imageData, 'base64');
      fs.writeFileSync(filePath, buffer);
      return filePath;
    } catch (err) {
      console.error('Error editing image:', err);
      throw new Error('Failed to edit image using OpenAI API');
    }
  
}

/**
 * Generate a video based on prompt, save as mp4, and return file path
 * @param {string} prompt
 * @param {string} filePath  Absolute path to save the JPG
 * @returns {Promise<string>} Path to saved JPG file
 */
async function generateVideo(prompt,filePath) {
  const url = `${endpoint}/openai/v1/video/generations/jobs?api-version=preview`;
  const body = { "prompt": prompt, "n_variants": 1, "n_seconds":5, "height": "480","width":854, "model": videoDeploymentName };
  console.log('Generating video: request body = ', body);
  const bodyJson = JSON.stringify(body);
  let response = await axios.post(url, bodyJson, {
     headers: { 'api-key': apiKey, 'Content-Type': 'application/json' }
   });

  const jobId = response.data.id;
  console.log(`Video generation job started with ID: ${jobId}`);
  let status = response.data.status;
  while (status !== "succeeded" && status !== "failed") {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    response = await axios.get(statusUrl, { headers });
    status = response.data.status;
    console.log("Status:", status);
  }

  if (status === "succeeded") {
    const generations = response.data.generations ?? [];
    if (generations.length > 0) {
      console.log("Video generation succeeded.");
      const generationId = generations[0].id;
      const video_url = `${endpoint}openai/v1/video/generations/${generationId}/content/video${params}`;
      const videoResponse = await axios.get(video_url, { headers, responseType: "arraybuffer" });

      if (videoResponse.status === 200) {
        fs.writeFileSync(filePath, videoResponse.data);
        console.log(`Generated video saved as "${outputFilename}"`);
        return filePath;
      } else {
        console.error("Failed to retrieve video content.");
        throw new Error(`Failed to retrieve video content: ${videoResponse.statusText}`);
      }

    } else {
      console.error("Status is succeeded, but no generations were returned.");
      throw new Error("No video generations found in the response.");
    }

  } else {
    console.error("Video generation failed.");
    throw new error('Video generation failed: \n' + JSON.stringify(response.data, null, 4));
  }

}

export { generateInputs, generateImage, editImage, generateVideo };
