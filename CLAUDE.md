# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a demonstration/portfolio repository containing static web projects:
- **cursor-demo.html**: A standalone demo page showcasing Cursor IDE features
- **mobile-tpm-wiki/**: An interactive mockup of a Mobile TPM team wiki page with modern UI

Both projects are pure frontend (HTML/CSS/JavaScript) with no build steps or dependencies.

## Architecture

### Project Structure
```
.
├── cursor-demo.html           # Standalone Cursor IDE demo page
└── mobile-tpm-wiki/           # Mobile TPM wiki mockup
    ├── index.html             # Main wiki structure
    ├── styles.css             # Complete styling (Grid/Flexbox)
    ├── script.js              # Interactive features
    ├── index-backup.html      # Backup version
    └── index-old.html         # Previous iteration
```

### Technology Stack
- Pure HTML5, CSS3, Vanilla JavaScript
- No build tools, package managers, or dependencies
- External CDN libraries used in mobile-tpm-wiki:
  - Font Awesome 6.4.0 (icons)
  - Chart.js 4.4.0 (analytics charts)
  - FullCalendar 6.1.9 (timeline/calendar)

### Design Patterns
- **mobile-tpm-wiki**: Modular component-based design with:
  - Sidebar navigation with scroll-to-section anchors
  - Dashboard metrics and analytics
  - Interactive team directory grid
  - Activity feed and notification system
  - Theme toggle (light/dark mode)
  - Search functionality
  - Responsive layout using CSS Grid and Flexbox

- **cursor-demo.html**: Self-contained single-page demo with:
  - Gradient backgrounds and animations
  - Hover effects and transitions
  - Interactive JavaScript tips

## Development Workflow

### Running Locally
Both projects can be opened directly in a browser. For better CORS handling or testing:
```bash
python3 -m http.server 8000
# Visit http://localhost:8000/cursor-demo.html
# or http://localhost:8000/mobile-tpm-wiki/
```

### Testing
No automated tests. Manual browser testing required for UI changes.

## Deployment

### GitHub Pages
Automatic deployment configured via `.github/workflows/deploy.yml`:
- Triggers on push to `main` branch
- Deploys entire repository root to GitHub Pages
- Both projects accessible via GitHub Pages URL

### Making Changes
1. Edit HTML/CSS/JS files directly
2. Test locally in browser
3. Commit and push to `main`
4. GitHub Actions automatically deploys to Pages

## Key Files to Modify

### For cursor-demo.html
- All code in single file: HTML structure, inline CSS `<style>`, inline JS `<script>`
- Tips array in JavaScript controls the random tip generator

### For mobile-tpm-wiki
- `index.html`: Structure, content, sections
- `styles.css`: All styling, themes, responsive breakpoints
- `script.js`: Interactivity, event handlers, notifications, search, theme toggle

## Notes for AI Assistants

- No package.json, no build process, no npm scripts
- All styling is custom CSS - no frameworks like Bootstrap or Tailwind
- Chart.js and FullCalendar are loaded via CDN - no local configuration files
- Dark mode toggle in mobile-tpm-wiki uses CSS variables and localStorage
- Both projects are self-contained - changes to one won't affect the other
