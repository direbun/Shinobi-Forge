# Upload this folder

This directory is the complete Shinobi Forge repository. Nothing outside it is required.

For an empty GitHub repository, open this folder and drag all of its contents into GitHub's **Add file -> Upload files** page. This places `Dockerfile`, `package.json`, `public/`, `server/`, and the other project directories at the repository root.

Do not upload `node_modules/` or a real `.env` file. Neither is included here. `.env.example` is safe to commit and documents the required production settings.

This is a client-server application, not a GitHub Pages site. GitHub stores the source; deploy it on the mini PC using the included Docker Compose configuration and the instructions in `README.md`.

