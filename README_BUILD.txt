================================================================================
  Permis Maroc - Test du Permis de Conduire (Desktop Electron App)
  اختبار رخصة القيادة بالمغرب - تطبيق سطح المكتب
================================================================================

IMPORTANT: This is the SOURCE CODE of the Electron desktop application.
You need to BUILD it on your Windows machine to get the .exe file.

===========================
  PREREQUISITES
===========================

1. Node.js v24+ installed on Windows
   Download: https://nodejs.org/

2. Git installed (optional, for version control)

===========================
  BUILD INSTRUCTIONS
===========================

Step 1: Extract this ZIP to a folder (e.g., C:\Projects\testpermis)

Step 2: Open Command Prompt or PowerShell in the extracted folder

Step 3: Install dependencies:
        npm install

Step 4: Build the Electron portable .exe:
        npm run electron:build:portable

Step 5: The output will be in: dist-electron/PermisMaroc.exe

That's it! Double-click PermisMaroc.exe to run the app.

===========================
  DEVELOPMENT MODE
===========================

To run in development mode (with live reload):

        npm run dev:local

Then open http://localhost:3000 in your browser.

Or run with Electron:

        npm run electron

===========================
  FEATURES
===========================

- 100% Offline - No internet connection required
- SQLite database - Data stored locally
- User management (admin can add/manage users)
- Driving test questions (Categories A, B, C, D, E)
- Timed tests with PIN code protection
- License activation system
- French/Arabic interface

===========================
  DEFAULT ADMIN LOGIN
===========================

N°CIN: admin
Password: admin123

===========================
  PORTABLE MODE
===========================

The app stores all data (database, uploads) in a "data" folder 
next to the executable. This makes it fully portable.

===========================
  FILE STRUCTURE
===========================

  electron/       - Electron main process files
  public/         - Static assets (icons, images, sounds)
  prisma/         - Database schema
  src/            - Next.js source code
  scripts/        - Build helper scripts
  icon.ico        - Windows application icon

===========================
  TROUBLESHOOTING
===========================

Q: "npm install" fails?
A: Make sure you have Node.js v24+ installed. Run: node --version

Q: Build fails with "Electron not found"?
A: Run: npm install again to ensure all dependencies are installed.

Q: App doesn't start?
A: Check Windows Defender isn't blocking it. Add an exception.

Q: Database errors?
A: Delete the "data" folder next to the .exe to reset the database.

================================================================================
  Copyright © 2025 Permis Maroc - All Rights Reserved
================================================================================
