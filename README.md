# HANDOVERIQ
### AI-Powered Project Handover & Knowledge Management Platform

[![Project](https://img.shields.io/badge/Project-HANDOVERIQ-8B7BF7)]()
[![Frontend](https://img.shields.io/badge/Frontend-Next.js-black)]()
[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688)]()
[![Language](https://img.shields.io/badge/Language-Python-blue)]()
[![Hackathon](https://img.shields.io/badge/WCC%20Forge%2048-Round%202-orange)]()

HANDOVERIQ is an AI-powered project handover and knowledge management platform designed to simplify knowledge transfer, preserve institutional knowledge, and reduce information loss during team transitions.

The platform helps teams extract, organize, and manage important project information from documents through an intelligent and structured workspace.

---

## 1. Problem Statement

When employees, developers, or team members leave a project or organization, important knowledge and project information can be lost.

Traditional handover processes often depend on scattered documents, manual explanations, and incomplete documentation.

This creates challenges such as:

- Loss of critical project knowledge.
- Time-consuming manual documentation.
- Difficulty understanding existing projects.
- Incomplete knowledge transfer between team members.
- Lack of centralized project information.

## 2. Proposed Solution

HANDOVERIQ provides an intelligent platform that simplifies the project handover process through AI-powered document analysis and structured knowledge management.

It aims to transform unorganized project information into accessible and reusable knowledge, helping incoming team members understand projects more efficiently.

## 3. Key Features

- **AI-Powered Document Analysis:** Analyze uploaded project documents and extract relevant information.
- **Knowledge Extraction:** Organize important project information into a structured format.
- **Project Handover Workspace:** Maintain project-related knowledge in a centralized workspace.
- **Document Management:** Manage project documents and reports.
- **Structured Knowledge Transfer:** Make project information easier to understand and transfer.
- **Web-Based Interface:** Access the platform through a user-friendly web application.

## 4. Technology Stack

| Component | Technologies |
|---|---|
| Frontend | Next.js, React.js, JavaScript |
| Backend | Python, FastAPI |
| Database / ORM | SQLAlchemy |
| AI Integration | Anthropic API |
| Document Processing | PyMuPDF, python-docx |
| API Communication | REST API |
| Development Tools | VS Code, Git, GitHub |
| Frontend Deployment | Netlify |

## 5. Project Architecture

The application follows a frontend-backend architecture.

```text
              USER
                |
                v
       NEXT.JS FRONTEND
                |
                | REST API
                v
         FASTAPI BACKEND
                |
        +-------+-------+
        |       |       |
        v       v       v
     DOCUMENT  AI     DATABASE
    PROCESSING SERVICE / ORM
        |       |
        +-------+
                |
                v
       STRUCTURED PROJECT
           KNOWLEDGE
                |
                v
        HANDOVER WORKSPACE
```

## 6. Project Structure

```text
HANDOVERIQ/
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── public/
│   ├── package.json
│   ├── package-lock.json
│   └── ...
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── ...
│
├── README.md
└── .gitignore
```

*Note: The structure above illustrates the main project organization. Refer to the actual repository for all source files.*

---

# 7. Prerequisites

Install the following software before running HANDOVERIQ locally.

| Software | Recommended Version |
|---|---|
| Python | 3.14 |
| Node.js | 22.x |
| npm | 10.x or compatible |
| Git | Latest stable |
| VS Code | Latest stable |

Download links:

- Python: https://www.python.org/downloads/
- Node.js: https://nodejs.org/
- Git: https://git-scm.com/downloads
- VS Code: https://code.visualstudio.com/

---

# 8. Installation and Setup

### Step 1: Clone the Repository

Open your terminal and execute:

```bash
git clone https://github.com/YOUR_USERNAME/HANDOVERIQ.git
```

Navigate into the project directory:

```bash
cd HANDOVERIQ
```

Replace `YOUR_USERNAME` and the repository name if necessary.

### Step 2: Frontend Setup

Open a terminal in VS Code.

Navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create the required environment configuration file using the project's `.env.example` as a reference.

Configure the backend API URL according to the environment variable expected by the frontend code.

For local development, the backend URL will generally be:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Start the frontend development server:

```bash
npm run dev
```

Open the application:

http://localhost:3000

### Step 3: Backend Setup

Open a separate terminal.

Navigate to the backend directory:

```bash
cd backend
```

Create a Python virtual environment:

```bash
py -3.14 -m venv venv
```

Activate the virtual environment on Windows:

```bash
venv\Scripts\activate
```

Install the required Python dependencies:

```bash
python -m pip install -r requirements.txt
```

### Step 4: Configure Environment Variables

Create a `.env` file in the backend directory using the project's environment configuration requirements.

Example:

```env
ANTHROPIC_API_KEY=your_api_key_here
DATABASE_URL=your_database_connection_string
```

**Important:**
- Replace placeholder values with your actual credentials.
- Use the exact environment variable names expected by your backend implementation.
- Never upload API keys, passwords, or database credentials to GitHub.
- Keep `.env` files excluded through `.gitignore`.

### Step 5: Start the Backend Server

Run:

```bash
uvicorn main:app --reload
```

The backend API should be accessible at:

http://127.0.0.1:8000

FastAPI interactive API documentation:

http://127.0.0.1:8000/docs

---

# 9. Running the Complete Application

HANDOVERIQ requires both frontend and backend servers to run during local development.

**Terminal 1 – Frontend**

```bash
cd frontend
npm run dev
```

**Terminal 2 – Backend**

```bash
cd backend
venv\Scripts\activate
uvicorn main:app --reload
```

Once both servers are running, open:

http://localhost:3000

Ensure the frontend API configuration points to the running backend.

---

# 10. Deployment

### Frontend Deployment – Netlify

The Next.js frontend can be deployed using Netlify.

1. Push the frontend source code to GitHub.
2. Log in to Netlify.
3. Select **Add new project → Import an existing project**.
4. Connect your GitHub account.
5. Select the HANDOVERIQ repository.
6. Configure the frontend directory as the base directory.

Recommended configuration:

| Setting | Value |
|---|---|
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | Netlify-managed Next.js output |

Use Netlify's Next.js runtime integration rather than manually selecting a static output directory.

Configure the production backend API URL in Netlify environment variables, using the exact variable name expected by the frontend.

### Backend Deployment

The FastAPI backend must be deployed separately to a Python-compatible hosting platform.

General deployment requirements:

- Python runtime.
- Install dependencies from `requirements.txt`.
- Configure environment variables securely.
- Start the application using the appropriate ASGI server command.
- Configure CORS to allow requests from the deployed frontend domain.

After deployment, update the frontend API configuration with the production backend URL.

**Note:** A working local application does not automatically mean the production deployment is complete. Verify both frontend and backend after deployment.

---

# 11. Security Considerations

- API credentials must be stored in environment variables.
- Never commit `.env` files or secret keys.
- Validate uploaded documents.
- Configure appropriate CORS restrictions.
- Protect sensitive project information.
- Use secure database credentials.

---

# 12. Future Enhancements

Potential improvements include:

- Advanced AI-powered knowledge extraction.
- More document format support.
- Improved project summarization.
- Intelligent search across project knowledge.
- Role-based access control.
- Enhanced collaboration features.
- Improved reporting and analytics.

---

# 13. Project Status

**Status:** Under Active Development

**Hackathon:** WCC Forge 48 – Round 2

HANDOVERIQ is being developed as a practical solution to improve project continuity and knowledge transfer through intelligent document processing and structured knowledge management.

---

# 14. Contributors

**HANDOVERIQ Development Team**

Add the names and contributions of the actual team members here.

---

## 15. License

This project is developed as part of WCC Forge 48 Hackathon.

Add an appropriate open-source license if you intend to distribute the project under one.

---

### Built with dedication to smarter knowledge transfer and better project continuity.

**HANDOVERIQ – Never Lose Project Knowledge.**