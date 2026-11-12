# HANDOVERIQ
### AI-Powered Project Handover & Knowledge Management Platform

<p align="center">
  <img src="https://img.shields.io/badge/Project-HANDOVERIQ-8B7BF7" alt="HANDOVERIQ">
  <img src="https://img.shields.io/badge/Frontend-Next.js-black" alt="Next.js">
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688" alt="FastAPI">
  <img src="https://img.shields.io/badge/Language-Python-blue" alt="Python">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License">
</p>

HANDOVERIQ is an AI-powered project handover and knowledge management platform designed to simplify knowledge transfer, preserve institutional knowledge, and reduce information loss during team transitions.

The platform helps teams extract, organize, and manage important project information from documents through an intelligent and structured workspace.

**Live Application:** https://handoveriq.netlify.app/

**Source Code:** https://github.com/ashwiniu17/HANDOVERIQ

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Proposed Solution](#2-proposed-solution)
3. [Key Features](#3-key-features)
4. [Technology Stack](#4-technology-stack)
5. [System Architecture](#5-system-architecture)
6. [Project Structure](#6-project-structure)
7. [Prerequisites](#7-prerequisites)
8. [Installation and Setup](#8-installation-and-setup)
9. [Running the Application](#9-running-the-application)
10. [API Documentation](#10-api-documentation)
11. [Deployment](#11-deployment)
12. [Security Considerations](#12-security-considerations)
13. [Future Enhancements](#13-future-enhancements)
14. [Project Status](#14-project-status)
15. [License](#15-license)

---

## 1. Problem Statement

When employees, developers, or team members leave a project or organization, important knowledge and project information can be lost.

Traditional handover processes often depend on scattered documents, manual explanations, and incomplete documentation.

This creates several challenges:

- Loss of critical project knowledge.
- Time-consuming manual documentation.
- Difficulty understanding existing projects.
- Incomplete knowledge transfer between team members.
- Lack of centralized project information.
- Difficulty accessing previously documented project decisions and information.

## 2. Proposed Solution

HANDOVERIQ provides an intelligent platform that simplifies the project handover process through AI-powered document analysis and structured knowledge management.

It aims to transform unorganized project information into accessible and reusable knowledge, helping incoming team members understand projects more efficiently.

The platform provides a centralized workspace where project-related information and documents can be organized to support smoother team transitions.

## 3. Key Features

### AI-Powered Document Analysis
Analyze uploaded project documents and extract relevant information using AI integration.

### Knowledge Extraction
Transform project-related information into a structured and understandable format.

### Project Handover Workspace
Maintain project-related knowledge in a centralized workspace to support team transitions.

### Document Management
Manage project documents and reports within the handover environment.

### Structured Knowledge Transfer
Make project information easier to understand, access, and transfer between outgoing and incoming team members.

### Web-Based Interface
Access project handover information through a web-based application.

---

## 4. Technology Stack

| Component | Technologies |
|---|---|
| Frontend | Next.js, React.js, JavaScript |
| Backend | Python, FastAPI |
| Database / ORM | SQLAlchemy |
| AI Integration | Anthropic API |
| Document Processing | PyMuPDF, python-docx |
| API Communication | REST API |
| Frontend Deployment | Netlify |
| Development Environment | Visual Studio Code |
| Version Control | Git and GitHub |

---

## 5. System Architecture

HANDOVERIQ follows a frontend-backend architecture. The frontend communicates with the backend through REST APIs.

```text
                    USER
                      |
                      v
              NEXT.JS FRONTEND
                      |
                      | REST API
                      |
                      v
               FASTAPI BACKEND
                      |
          +-----------+-----------+
          |           |           |
          v           v           v
      DOCUMENT       AI       DATABASE
     PROCESSING   INTEGRATION  / ORM
          |           |
          +-----------+
                      |
                      v
             STRUCTURED PROJECT
                 KNOWLEDGE
                      |
                      v
             HANDOVER WORKSPACE
```

---

## 6. Project Structure

The project is organized into separate frontend and backend directories.

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
│   └── ...
│
├── README.md
└── .gitignore
```

*Note: This is a simplified representation of the project structure. Refer to the repository for the complete implementation.*

---

## 7. Prerequisites

Install the following software before running HANDOVERIQ locally.

| Software | Recommended Version |
|---|---|
| Python | 3.14 |
| Node.js | 22.x |
| npm | 10.x or compatible |
| Git | Latest stable |
| Visual Studio Code | Latest stable |

### Download Links

- Python: https://www.python.org/downloads/
- Node.js: https://nodejs.org/
- Git: https://git-scm.com/downloads
- Visual Studio Code: https://code.visualstudio.com/

---

## 8. Installation and Setup

### Step 1: Clone the Repository

Open a terminal and execute:

```bash
git clone https://github.com/ashwiniu17/HANDOVERIQ.git
```

Navigate into the project directory:

```bash
cd HANDOVERIQ
```

### Step 2: Frontend Setup

Navigate to the frontend directory:

```bash
cd frontend
```

Install the dependencies:

```bash
npm install
```

Configure the frontend environment variables according to the project's configuration.

For local development, the backend API URL can be configured as:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Use the exact environment variable name expected by the frontend source code.

Start the frontend development server:

```bash
npm run dev
```

Open the application:

http://localhost:3000

### Step 3: Backend Setup

Open a separate terminal and navigate to the backend directory:

```bash
cd HANDOVERIQ/backend
```

If you are already inside the project directory, simply execute:

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

Install the required dependencies:

```bash
python -m pip install -r requirements.txt
```

### Step 4: Configure Environment Variables

Create a `.env` file inside the backend directory.

Example configuration:

```env
ANTHROPIC_API_KEY=your_api_key_here
DATABASE_URL=your_database_connection_string
```

**Important:**

- Replace placeholder values with your actual credentials.
- Use the environment variable names expected by your backend implementation.
- Never expose API keys or database credentials.
- Ensure `.env` files are excluded from Git tracking through `.gitignore`.

### Step 5: Start the Backend Server

Run:

```bash
uvicorn main:app --reload
```

The backend API should be accessible at:

http://127.0.0.1:8000

---

## 9. Running the Application

HANDOVERIQ requires both frontend and backend servers to run during local development.

**Terminal 1 – Frontend**

```bash
cd HANDOVERIQ/frontend
npm run dev
```

**Terminal 2 – Backend**

```bash
cd HANDOVERIQ/backend
venv\Scripts\activate
uvicorn main:app --reload
```

Once both servers are running, access the application:

http://localhost:3000

Ensure that the frontend API configuration points to the running backend.

---

## 10. API Documentation

HANDOVERIQ uses FastAPI for backend API development.

FastAPI provides interactive API documentation through Swagger UI.

Once the backend server is running, access:

**Swagger UI:**

http://127.0.0.1:8000/docs

**ReDoc:**

http://127.0.0.1:8000/redoc

These interfaces can be used to explore and test the available backend API endpoints.

---

## 11. Deployment

### Frontend Deployment – Netlify

The frontend is deployed using Netlify.

Live application:

https://handoveriq.netlify.app/

To deploy or update the frontend:

1. Push the latest source code to GitHub.
2. Log in to Netlify.
3. Import the HANDOVERIQ GitHub repository.
4. Configure the frontend directory as the base directory.
5. Configure the appropriate build settings.
6. Add the required production environment variables.
7. Deploy the application.

Recommended configuration:

| Setting | Value |
|---|---|
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | Netlify-managed Next.js output |

Use Netlify's Next.js runtime integration rather than manually selecting a static output directory.

### Backend Deployment

The FastAPI backend requires a Python-compatible hosting environment.

General deployment requirements:

- Configure the appropriate Python runtime.
- Install dependencies from `requirements.txt`.
- Configure environment variables securely.
- Start the application using an ASGI server.
- Configure CORS to allow requests from the frontend domain.

After backend deployment, configure the frontend to communicate with the production backend URL.

*Note: Frontend and backend deployment must both be verified for the complete production application to function correctly.*

---

## 12. Security Considerations

- Store API credentials securely using environment variables.
- Never commit `.env` files or secret keys.
- Validate uploaded documents.
- Configure appropriate CORS restrictions.
- Protect sensitive project information.
- Use secure database credentials.
- Avoid exposing sensitive information through API responses.

---

## 13. Future Enhancements

Potential improvements include:

- Advanced AI-powered knowledge extraction.
- Support for additional document formats.
- Improved project summarization.
- Intelligent search across project knowledge.
- Role-based access control.
- Enhanced collaboration features.
- Improved reporting and analytics.
- More advanced project knowledge organization.

---

## 14. Project Status

**Status:** Under Active Development

HANDOVERIQ is being developed as a practical solution to improve project continuity and knowledge transfer through intelligent document processing and structured knowledge management.

---

## 15. License

This project is licensed under the MIT License.

Copyright (c) 2026 Ashwini U

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

<p align="center">
  <strong>HANDOVERIQ – Never Lose Project Knowledge.</strong>
  <br>
  Built with dedication to smarter knowledge transfer and better project continuity.
</p>
