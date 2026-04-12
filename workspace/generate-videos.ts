import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const videosDir = '/home/z/my-project/workspace/videos';

async function generateTextVideo(prompt: string, outputName: string) {
  console.log(`\nGenerating ${outputName}...`);
  const zai = await ZAI.create();
  
  const task = await zai.video.generations.create({
    prompt: prompt,
    quality: 'quality',
    size: '1344x768',
    fps: 30,
    duration: 5
  });
  
  console.log(`  Task: ${task.id}`);
  
  let result = await zai.async.result.query(task.id);
  let polls = 0;
  
  while (result.task_status === 'PROCESSING' && polls < 90) {
    polls++;
    console.log(`  [${polls}] ${result.task_status}`);
    await new Promise(r => setTimeout(r, 10000));
    result = await zai.async.result.query(task.id);
  }
  
  if (result.task_status === 'SUCCESS') {
    const url = result.video_result?.[0]?.url || result.video_url || result.url;
    console.log(`  ✅ Done: ${url}`);
    if (url) {
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(path.join(videosDir, outputName), buf);
      console.log(`  💾 Saved: ${outputName} (${(buf.length/1024/1024).toFixed(1)} MB)`);
    }
    return url;
  }
  console.log(`  ❌ ${result.task_status}`);
  return null;
}

async function main() {
  // Video 1: Intro / Cover
  const v1 = await generateTextVideo(
    'Professional cinematic dark blue promotional video for a driving school test preparation app called Permis Maroc, showing a modern laptop with a sleek exam interface, driving test questions on screen, Moroccan road signs, steering wheel icon, clean corporate tech aesthetic, smooth camera pan',
    'video-intro.mp4'
  );
  
  await new Promise(r => setTimeout(r, 15000)); // cooldown
  
  // Video 2: Exam screen
  const v2 = await generateTextVideo(
    'Close-up of a tablet screen showing a multiple choice driving test question with answer options and a countdown timer, professional dark themed UI, educational technology, smooth slow zoom, cinematic lighting',
    'video-exam.mp4'
  );
  
  await new Promise(r => setTimeout(r, 15000));
  
  // Video 3: Security / Trust
  const v3 = await generateTextVideo(
    'Dark blue cybersecurity themed video showing a glowing shield lock icon with digital circuit patterns and encrypted data flowing, modern tech protection visualization, AES encryption concept, smooth animation, corporate style',
    'video-security.mp4'
  );
  
  console.log('\n=== DONE ===');
  console.log(`Intro: ${v1}`);
  console.log(`Exam: ${v2}`);
  console.log(`Security: ${v3}`);
}

main().catch(console.error);
