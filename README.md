<div align="center">

# 🌌 Galaxy.ai — Artistic Intelligence

### *Turn your creative vision into scalable workflows.*

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma)](https://prisma.io/)

---

**Galaxy.ai** is a node-based AI workflow platform that lets creators, designers, and developers visually compose powerful AI pipelines — connecting models like **Stable Diffusion**, **FLUX Pro**, **MiniMax Video**, and **Groq LLMs** — all within a stunning, drag-and-drop canvas.

[Get Started](#-getting-started) · [Features](#-features) · [Architecture](#-architecture) · [Tech Stack](#-tech-stack)

</div>

---

## ✨ Features

### 🎨 Visual Workflow Editor
- **Drag-and-drop canvas** powered by [React Flow](https://reactflow.dev/) — build AI pipelines visually
- **6 specialized node types** for different creative tasks
- **Smart edge connections** with type-aware connectors and color-coded data flows
- **Floating toolbar** with selection, pan, and zoom tools
- **Undo/Redo history** with a dedicated History Sidebar panel
- **Auto-save** workflows to the cloud

### 🧠 AI Node Types

| Node | Description |
|------|-------------|
| 📤 **Upload Image** | Drag & drop image uploads with preview and metadata |
| 🎬 **Upload Video** | Video file ingestion with frame extraction support |
| ✂️ **Crop Image** | Interactive image cropping with aspect ratio controls |
| 🖼️ **Extract Frame** | Pull specific frames from uploaded videos |
| 🤖 **LLM** | Multi-model text generation (Groq, Google Generative AI) |
| 📝 **Text** | Manual text input and prompt composition |

### 🚀 Workflow Execution Engine
- **Background task processing** via [Trigger.dev](https://trigger.dev/) — no timeouts, no limits
- **Pipeline orchestration** — nodes execute in dependency order
- **Real-time progress tracking** with live status updates
- **Persistent storage** — all workflows and results saved via Prisma + PostgreSQL

### 🏠 Premium Landing Page
- **Glassmorphism UI** with gradient containers and backdrop blur
- **Interactive flow diagram** — draggable nodes showcase the platform's capabilities
- **Custom DM Sans typography** loaded locally for pixel-perfect rendering
- **Smooth animations** powered by Framer Motion
- **Responsive design** optimized for all screen sizes

### 🔐 Authentication & Security
- **Clerk** integration for seamless sign-up/sign-in flows
- **Protected routes** with middleware-level auth guards
- **Per-user workflow isolation** — your data stays yours

---

## 🏗️ Architecture

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth pages (sign-in, sign-up)
│   ├── (protected)/              # Authenticated routes
│   │   ├── dashboard/            # User dashboard
│   │   └── workflows/            # Workflow editor page
│   ├── api/                      # REST API routes
│   │   ├── workflows/            # CRUD + execute endpoints
│   │   ├── upload/               # File upload handling
│   │   └── process/              # AI processing pipeline
│   ├── layout.tsx                # Root layout + font config
│   └── page.tsx                  # Landing page
│
├── components/
│   ├── landing/                  # Landing page components
│   │   ├── LandingHeader.tsx     # Fixed header + announcement bar
│   │   ├── LandingHero.tsx       # Hero section with typography
│   │   └── FlowVisual.tsx        # Interactive node diagram
│   ├── nodes/                    # Custom React Flow nodes
│   │   ├── UploadImageNode.tsx
│   │   ├── UploadVideoNode.tsx
│   │   ├── CropImageNode.tsx
│   │   ├── ExtractFrameNode.tsx
│   │   ├── LLMNode.tsx
│   │   └── TextNode.tsx
│   ├── workflow/                 # Workflow editor UI
│   │   ├── WorkflowCanvas.tsx    # Main canvas wrapper
│   │   ├── WorkflowHeader.tsx    # Top bar with actions
│   │   ├── FloatingToolbar.tsx   # Tool selection panel
│   │   ├── LeftSidebar.tsx       # Node palette
│   │   ├── HistorySidebar.tsx    # Undo/redo task manager
│   │   └── LogoMenu.tsx          # Brand menu
│   ├── edges/                    # Custom edge components
│   └── ui/                       # Shared UI primitives
│
├── stores/                       # Zustand state management
│   ├── workflow-store.ts         # Core workflow state (18KB)
│   ├── canvas-tool-store.ts      # Tool selection state
│   └── ui-store.ts               # UI panel visibility
│
├── lib/                          # Utilities & services
│   ├── workflow-engine/          # Execution pipeline
│   ├── validation/               # Zod schemas
│   ├── db.ts                     # Prisma client singleton
│   ├── sample-workflows.ts       # Starter templates
│   └── connector-colors.ts       # Edge color system
│
├── trigger/                      # Trigger.dev background tasks
│   └── index.ts                  # Task definitions
│
└── types/                        # TypeScript type definitions
```

---

## 🛠️ Tech Stack

<table>
<tr>
<td align="center"><strong>Category</strong></td>
<td align="center"><strong>Technology</strong></td>
</tr>
<tr>
<td>Framework</td>
<td>Next.js 16 (App Router)</td>
</tr>
<tr>
<td>Language</td>
<td>TypeScript 5</td>
</tr>
<tr>
<td>UI Library</td>
<td>React 19</td>
</tr>
<tr>
<td>Styling</td>
<td>Tailwind CSS 4</td>
</tr>
<tr>
<td>Node Editor</td>
<td>@xyflow/react (React Flow)</td>
</tr>
<tr>
<td>Animations</td>
<td>Framer Motion</td>
</tr>
<tr>
<td>State Management</td>
<td>Zustand</td>
</tr>
<tr>
<td>Authentication</td>
<td>Clerk</td>
</tr>
<tr>
<td>Database</td>
<td>PostgreSQL + Prisma ORM</td>
</tr>
<tr>
<td>Background Jobs</td>
<td>Trigger.dev v4</td>
</tr>
<tr>
<td>AI Models</td>
<td>Groq SDK, Google Generative AI</td>
</tr>
<tr>
<td>Validation</td>
<td>Zod</td>
</tr>
<tr>
<td>Icons</td>
<td>Lucide React</td>
</tr>
<tr>
<td>Drag & Drop</td>
<td>React DnD, React Dropzone</td>
</tr>
<tr>
<td>Toast Notifications</td>
<td>Sonner</td>
</tr>
</table>

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** or **yarn**
- **PostgreSQL** database
- API keys for: [Clerk](https://clerk.com), [Groq](https://console.groq.com), [Google AI](https://ai.google.dev), [Trigger.dev](https://trigger.dev)

### Installation

```bash
# Clone the repository
git clone https://github.com/ShreyasUrade1123/Weavy-Clone-Version1.git
cd Weavy-Clone-Version1

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://..."

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# AI APIs
GROQ_API_KEY=gsk_...
GOOGLE_GENERATIVE_AI_API_KEY=...

# Trigger.dev
TRIGGER_SECRET_KEY=tr_dev_...
```

### Run the Development Server

```bash
# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Start the dev server
npm run dev

# In a separate terminal, start Trigger.dev
npx trigger.dev@latest dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## 📸 Screenshots

> *Coming soon — screenshots of the landing page, workflow editor, and node connections in action.*

---

## 🗺️ Roadmap

- [ ] 🖼️ Image generation nodes (Stable Diffusion, FLUX Pro)
- [ ] 🎥 Video generation nodes (MiniMax Video)
- [ ] 🧊 3D model nodes (Rodin 2.0)
- [ ] 📊 Workflow analytics dashboard
- [ ] 🤝 Team collaboration & shared workflows
- [ ] 🔌 Plugin system for custom nodes
- [ ] 📱 Mobile-responsive workflow editor

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is for educational and portfolio purposes.

---

<div align="center">

**Built with ❤️ by [Shreyas Urade](https://github.com/ShreyasUrade1123)**

*Galaxy.ai — Where creativity meets artificial intelligence.*

</div>
