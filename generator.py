import base64
import os
import json
from openai import AzureOpenAI
from PIL import Image
from io import BytesIO
from dotenv import load_dotenv
import logging

# Configure logging to output to terminal
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)

# Load environment variables from .env file
# load_dotenv()

endpoint = os.getenv("AOAI_ENDPOINT")
key = os.getenv("AOAI_KEY")
api_version = os.getenv("AOAI_API_VERSION")
chat_deployment = os.getenv("AOAI_CHAT_DEPLOYMENT_NAME")
image_deploymnet = os.getenv("AOAI_IMAGE_DEPLOYMENT_NAME")

# create AzureOpenAI Client
client = AzureOpenAI(
    azure_endpoint = endpoint,
    api_key = key,
    api_version = api_version
)

def generate_inputs(objectives):
    prompt = f"あなたはPOPを生成するAIです。以下の目的に基づいて、適切なテキストと画像を生成するためのプロンプトを生成します。テキストは日本語で作成します。背景生成プロンプトは英語で作成し、日本語に翻訳してください。[{{'copy_text_main': '主となるテキスト', 'copy_text_sub': 'サブテキスト', 'captions_en': 'image generation prompt', 'captions_ja': '画像生成プロンプト'}}]"

    result = client.chat.completions.create(
        model=chat_deployment,
        messages=[
            {
                "role": "user",
                "content": f"{prompt} \n 目的: {objectives}"
            }
        ],
        max_tokens=1000,
        temperature=0.7,
        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "json",
                "strict": True,
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
                    "additionalProperties": False
                }
            }
        }
    )

    inputs = result.choices[0].message.content
    log.info(f"Generated inputs: {inputs}")

    try:
        inputs = json.loads(inputs)
    except json.JSONDecodeError:
        log.error("Failed to decode JSON response")

    return inputs

def generate_image(prompt, img_path):

    log.info(f"Image generation prompt: {prompt}")

    # Generate the image using Azure OpenAI
    result = client.images.generate(
        model=image_deploymnet,
        prompt=prompt,
        size="1024x1024"
    )

    # Save the image to a file and resize/compress for smaller files
    image_base64 = result.data[0].b64_json
    image_bytes = base64.b64decode(image_base64)

    # Scale image to fit within 300x300, preserving aspect ratio
    image = Image.open(BytesIO(image_bytes))
    max_size = (300, 300)
    image.thumbnail(max_size, Image.LANCZOS)
    image.save(img_path, format="JPEG", quality=80, optimize=True)

    return True
