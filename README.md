# Melon_Back_Jack

Melon_Back_Jack — a simple Blackjack web experience built for a contest with friends.

This repo contains a minimal, stylish single-page site you can host on GitHub Pages. It includes: room ID creation (for sharing/joining matches), a futuristic cyber-blue & black design, and a visible watermark so your credit appears in the site code and background.

Files added:
- `index.html` — main site and UI
- `styles.css` — cyber-blue theme and watermark background
- `script.js` — room ID generation + join handling

Quick demo and purpose
- Generate a room ID and share the link with your friend to join the same room.
- The site is intentionally client-only so you can host on GitHub Pages without a backend.

How to use
1. Open `index.html` locally to preview.
2. Click **Create Room** to generate a shareable room link.
3. Send the link to your friend; when opened it shows the same room ID.

Host on GitHub Pages
1. Create a new repository on GitHub and push this project.
2. In the repo settings go to Pages and set the source to the `main` branch (root) or `gh-pages` branch.
3. Save — your site will be available at `https://<your-username>.github.io/<repo-name>/`.

Next steps (ideas)
- Add multiplayer syncing using WebRTC/signaling or a lightweight server.
- Add full Blackjack game logic and betting UI.

Credits
- Watermark/credit: "Made By bubbabaker2009" is present throughout the site as requested.

