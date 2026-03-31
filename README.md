# 🧠 Brainmap AI

An interactive, AI-powered mind-mapping tool designed to help you brainstorm, study, and explore complex topics. Build free-form knowledge graphs where every node can branch out into contextual AI-generated answers.

## 🚀 Features

* **Infinite Spatial Canvas:** Drag, drop, and connect nodes using React Flow.
* **Context-Aware AI:** Ask questions based on previous nodes. The backend uses a recursive PostgreSQL query to traverse the graph and feed the AI your entire conversation history.
* **Floating Thoughts:** Ask questions without a parent node and drop the AI's response exactly where your mouse clicks.
* **Multiple Workspaces:** Create, switch between, and manage multiple independent brainmaps.
* **Fully Containerized:** The entire stack (Database, Backend, Frontend) runs in Docker with a single command.

## 🛠 Tech Stack

* **Frontend:** React, React Flow, Vite, served via Nginx.
* **Backend:** Go (Golang), `pgx` driver, Google GenAI SDK.
* **Database:** PostgreSQL 17 (Relational mapping of nodes and edges).
* **AI Model:** Gemini 3.1 Flash Lite (Configurable).

## 🚦 Getting Started

### Prerequisites
* [Docker](https://docs.docker.com/get-docker/) and Docker Compose installed.
* A free Gemini API key from [Google AI Studio](https://aistudio.google.com/).

### Installation

1. **Clone the repository:**
   \`\`\`bash
   git clone https://github.com/Goober-nation/brainmaper
   cd brainmaper
   \`\`\`

2. **Set up environment variables:**
   Copy the example environment file and add your Gemini API key.
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your preferred text editor and add your GEMINI_API_KEY
   \`\`\`

3. **Start the containers:**
   Build and launch the application in detached mode.
   \`\`\`bash
   docker compose up --build
   \`\`\`

4. **Open the app:**
   Navigate to [http://localhost:5173](http://localhost:5173) in your web browser.

## 🛑 Troubleshooting

* **CORS Errors / Blank Screen:** Ensure the Go backend has successfully connected to the database. Check the logs using `docker compose logs backend`.
* **Port Conflicts:** If ports `5433`, `8080`, or `5173` are in use on your host machine, change the `_EXTERNAL_PORT` variables in your `.env` file.
* **Database Reset:** If you need to completely wipe your maps and start fresh, remove the Docker volume:
  \`\`\`bash
  docker compose down -v
  docker compose up -d
  \`\`\`