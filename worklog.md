---
Task ID: 1
Agent: main
Task: Fix 5 critical bugs in Permis Maroc Electron app - media files not showing, response/video URLs null, loading icon, window icon

Work Log:
- Analyzed the full import flow: ZIP upload → extract files to disk → save question data (JSON + DB) → serve files via /api/serve/
- Identified Bug 1: Image URLs hardcoded to .png but actual ZIP files could be .jpg, .webp, .gif, etc.
- Identified Bug 2: Response image URLs always null in both JSON file and DB
- Identified Bug 3: Video URLs always null
- Identified Bug 4: Loading screen icon.ico not in electron/ directory (only in public/)
- Identified Bug 5: BrowserWindow missing icon property
- Fixed all 5 bugs by modifying:
  - `src/app/api/upload/rar/route.ts`: Added scanFileExtensions() to detect actual file extensions on disk after extraction
  - `src/lib/series-file.ts`: Updated saveSerieQuestions() to accept videoUrl and responseImageUrl
  - `src/app/api/questions/import/route.ts`: Updated to match new signature
  - `electron/loading.html`: Replaced <img src="icon.ico"> with inline SVG logo
  - `electron/main.js`: Added icon property to BrowserWindow with correct path resolution
- Committed as f52d7e7 and pushed to GitHub

Stage Summary:
- All 5 bugs fixed and committed
- ZIP download link: https://github.com/testpermis1989-afk/testpermis/archive/refs/heads/main.zip
- Lint passes with no errors
