# Magic Sort Puzzle - User Manual

## How to Start
1. Ensure you have Node.js installed.
2. Run `npm install` to install dependencies.
3. Run `npm run dev` to start the development server.
4. To access on mobile via local network, use the printed local IP (e.g., `http://192.168.x.x:5173`).

## Gameplay Rules
- Tap a bottle to select it.
- Tap another bottle to pour liquid into it.
- **Rules**:
  - You can only pour liquid if the destination bottle is empty OR its top liquid matches the color you are pouring.
  - The destination bottle must have enough empty space.
- The goal is to sort all colors so that each bottle contains only one color.
- **Level Progression**: Start from Level 1 with 4 colors. As you advance, the game dynamically scales difficulty by increasing color counts and varying bottle capacities (e.g., short 3-slot bottles, tall 6-slot bottles) while ensuring all puzzles remain solvable.

## Controls
- **Undo**: Reverts your last move.
- **Reset**: Restarts the current level from the beginning.
- **Add Bottle**: Adds an extra empty bottle to make the puzzle easier.
- **Colorblind Mode**: Toggles patterns/icons to help distinguish colors.

## Building and Deploying
- Run `npm run build` to compile TypeScript and bundle the application for production deployment into the `dist/` directory.
- The project is pre-configured with `base: './'` in `vite.config.ts`, making the `dist` folder fully compatible with **GitHub Pages** out-of-the-box. Simply upload the `dist` folder contents to a static hosting provider or configure GitHub Actions to deploy it to Pages.
