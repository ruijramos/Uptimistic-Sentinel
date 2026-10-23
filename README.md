# 🛰️ Uptimistic-Sentinel

[![Architecture: Monolithic Micro-Worker](https://img.shields.io/badge/Architecture-Monolithic_Micro--Worker-6366f1.svg)](#system-architecture)
[![Python: 3.11+](https://img.shields.io/badge/Python-3.11+-3776ab.svg)](https://python.org)
[![Flask: 3.x](https://img.shields.io/badge/Flask-3.x-000000.svg)](https://palletsprojects.com/p/flask/)
[![SQLAlchemy: 2.0+](https://img.shields.io/badge/SQLAlchemy-2.0+-red.svg)](https://www.sqlalchemy.org/)
[![Angular: 18+](https://img.shields.io/badge/Angular-18+-dd0031.svg)](https://angular.dev)
[![Docker: Ready](https://img.shields.io/badge/Docker-Compose_Ready-2496ed.svg)](#deployment-via-docker-compose)
[![AI Assisted: Gemini 3.8 Flash](https://img.shields.io/badge/AI_Assisted-Gemini_3.8_Flash_High-8e44ad.svg)](#acknowledgments--ai-assisted-development)

A smart, self-hosted uptime monitor and alerting service engineered to run reliably on private internal networks. Designed specifically to eliminate **alert fatigue** through a deterministic debounce state machine and zero third-party commercial API lock-in.

---

## ✨ Key Features

- **Multi-Protocol Network Probing:**
  - **HTTP / HTTPS:** Status code matching, SSL validation toggles (for internal/self-signed certs), custom request headers, and microsecond response time timing.
  - **TCP Sockets:** Raw IP/port handshake checks for databases (PostgreSQL, MySQL, Redis, MQTT) and internal socket services.
  - **ICMP Ping:** Host reachability and round-trip latency measurement.
- **Fatigue-Free Alerting Engine:**
  - Debounce threshold: Outage alerts only trigger after $N$ consecutive failures.
  - Alert suppression: No duplicate emails while a target remains `DOWN`.
  - Instant recovery: Dispatches a `RECOVERED` alert with total downtime context when the service comes back online.
  - Zero commercial dependencies: Built with Python's native `smtplib` and MIME multipart templating.
- **Strict Concurrency Architecture:**
  - API and Scheduler run as isolated processes to avoid duplicate execution hazards when the WSGI API scales to multiple workers.
- **Database Pruning & Retention:**
  - Automated maintenance job removes time-series check logs older than the configurable retention window (e.g., 30 days) to prevent database bloat.
- **Modern Angular Frontend:**
  - Built with Angular 18 Standalone Components, Signal-based state management, Reactive Forms, and dark-theme glassmorphism aesthetics.
  - Live SVG latency sparklines for immediate visual health trend analysis.

---

## 🏛️ System Architecture

```text
Browser Client (Angular 18 Signals)
       │ (REST / JSON)
       ▼
Nginx Reverse Proxy / Gateway (Port 80/8080)
       ├─── /api/* ───► Flask WSGI API (Gunicorn - N Workers)
       └─── /*     ───► Angular Static Assets
                             │
                             ├───► PostgreSQL 16 (Targets, Logs, Settings)
                             │
Sentinel Background Worker ──┘
(Dedicated Process: python worker.py)
       ├─── ThreadPoolExecutor Prober (HTTP / TCP / ICMP)
       ├─── State Machine & Debounce Evaluator
       ├─── Native smtplib Mail Dispatcher
       └─── Daily Log Retention Pruner
```

---

## ⚙️ Configuration Split

To maintain operational agility while securing infrastructure secrets, configuration is strictly partitioned:

### 1. Infrastructure Secrets (`.env`)
Strictly for infrastructure connection parameters and sensitive keys. Requires container restart to change:
- `DATABASE_URL`: PostgreSQL connection string.
- `FLASK_SECRET_KEY`: Flask session security key.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`: Mail relay configuration (e.g., Gmail with App Password or internal corporate relay).
- `SMTP_USE_TLS`, `SMTP_USE_SSL`, `SMTP_DEFAULT_FROM`: SMTP transport encryption.

### 2. Operational Rules (Database / UI Settings)
Manageable dynamically at runtime via the dashboard without restarting services:
- `alert_recipients`: Destination email list for incident and recovery notifications.
- `default_check_interval_seconds`: Baseline probe frequency for newly created targets.
- `default_timeout_seconds` & `max_timeout_seconds`: Network I/O safety limits.
- `default_failure_threshold`: Consecutive failures required before declaring a target `DOWN`.
- `log_retention_days`: Historical check logs pruning threshold.

---

## 🚀 Deployment via Docker Compose

### Prerequisites
- Docker Engine 24.0+ & Docker Compose v2.20+

### Steps
1. Clone the repository and navigate into the root directory:
   ```bash
   git clone https://github.com/ruijramos/Uptimistic-Sentinel.git
   cd Uptimistic-Sentinel
   ```

2. Create your environment configuration:
   ```bash
   cp .env.example .env
   # Edit .env with your SMTP relay credentials and secure passwords
   ```

3. Launch the container stack:
   ```bash
   docker compose up -d --build
   ```

4. Open your browser:
   - Dashboard: `http://localhost:8080` (or host IP:8080)
   - REST API Healthcheck: `http://localhost:8080/api/health`

---

## 💻 Local Development Setup

### Backend (Python 3.11+)
```bash
cd backend
python -m venv .venv

# On Linux/macOS:
source .venv/bin/activate
# On Windows:
.venv\Scripts\activate

pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Run automated tests
pytest -v

# Start Flask development API server
python wsgi.py

# In a separate terminal, run the Sentinel background worker:
python worker.py
```

### Frontend (Angular 18+)
```bash
cd frontend
npm install

# Start local dev server with proxy to backend (http://localhost:5000)
npm start
# Open http://localhost:4200
```

---

## 🛠️ Custom CLI Commands

The backend exposes administrative CLI tools via Flask's CLI runner:

```bash
# Start background monitoring worker with custom concurrency
python -m app.cli run-worker --concurrency 30

# Manually execute check logs retention pruning
python -m app.cli prune-logs

# Re-seed default operational settings in PostgreSQL
python -m app.cli seed-settings
```

---

## 🧪 Testing & Verification

The test suite covers API endpoints, Pydantic validation schemas, prober abstractions, state-machine transitions, and log pruning:

```bash
cd backend
pytest -v --cov=app
```

---

## 🤖 Acknowledgments & AI-Assisted Development

This platform was designed, architected, and implemented using assisted pair programming with the **Gemini 3.8 Flash (High)** model.
