const pptxgen = require('pptxgenjs');
const html2pptx = require('/home/z/my-project/skills/pptx/scripts/html2pptx');
const path = require('path');

async function build() {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Permis Maroc';
  pptx.title = 'Permis Maroc - Presentation Auto-Ecoles';
  pptx.subject = 'Solution de preparation aux examens du permis de conduire';

  const slidesDir = path.join(__dirname, 'slides');
  const slides = [
    'slide01-cover.html',
    'slide02-probleme.html',
    'slide03-features.html',
    'slide04-comment.html',
    'slide05-examen.html',
    'slide06-admin.html',
    'slide07-security.html',
    'slide08-benefits.html',
    'slide09-pricing.html',
    'slide10-contact.html',
  ];

  for (let i = 0; i < slides.length; i++) {
    const htmlPath = path.join(slidesDir, slides[i]);
    console.log(`Processing slide ${i + 1}: ${slides[i]}`);
    try {
      await html2pptx(htmlPath, pptx);
      console.log(`  ✓ Slide ${i + 1} done`);
    } catch (err) {
      console.error(`  ✗ Error on slide ${i + 1}:`, err.message);
    }
  }

  const outputPath = '/home/z/my-project/Permis-Maroc-Presentation-Auto-Ecoles.pptx';
  await pptx.writeFile({ fileName: outputPath });
  console.log(`\nPresentation saved to: ${outputPath}`);
}

build().catch(console.error);
