import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import { execSync } from 'child_process';

async function main() {
  // 1. Initialize the SDK
  const zai = await ZAI.create();

  // 2. Read the image and convert to base64
  const imgPath = "/home/z/my-project/upload/Capture d'écran 2026-04-10 134826.png";
  const imageBuffer = fs.readFileSync(imgPath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = 'image/png';
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  // 3. Call createVision to analyze the image
  console.log("Analyzing image via z-ai-web-dev-sdk createVision...");

  try {
    const result = await zai.chat.completions.createVision({
      model: "glm-4.6v",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Look at this screenshot carefully. Identify the EXACT error message text shown in the image. Return only the verbatim error message, nothing else. Include any error codes, file paths, or technical details shown."
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl
              }
            }
          ]
        }
      ],
      thinking: { type: 'disabled' }
    });

    // 4. Print the result
    console.log("=== VLM ANALYSIS RESULT ===");
    if (result?.choices?.[0]?.message?.content) {
      console.log(result.choices[0].message.content);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (visionErr: any) {
    console.warn(`[FALLBACK] Vision API unavailable (${visionErr.message}). Using OCR fallback...`);
    console.log("");

    // Fallback: Use pytesseract OCR via Python
    const ocrResult = execSync(
      `python3 -c "
import pytesseract
from PIL import Image, ImageOps
img = Image.open('${imgPath.replace(/'/g, "\\'")}')
gray = img.convert('L')
inverted = ImageOps.invert(gray)
text = pytesseract.image_to_string(inverted, lang='fra+eng', config='--psm 11')
print(text)
"`,
      { encoding: 'utf-8' }
    );

    console.log("=== OCR ANALYSIS RESULT ===");
    console.log(ocrResult);
  }
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
