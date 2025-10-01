<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/0xfunboy/AIRTrack/blob/main/AIRTrack_Frontend_demo.png" />
</div>

# AIRTrack – Trade Tracker DApp

AIRTrack is a full-stack decentralized-inspired application for tracking and managing trading positions.  
It provides a **React/Vite frontend**, a **Node.js/Express backend**, and a **PostgreSQL database**, designed for scalability and thousands of concurrent users.

---

## 🚀 Features

- **Frontend** built with React + Vite
  - Fast development with hot reload
  - Production build optimized for performance
  - Charts powered by Chart.js and react-chartjs-2

- **Backend** powered by Node.js + Express
  - RESTful API for trades and user management
  - Secure JWT-based authentication
  - Business logic for validation and user isolation

- **Database** with PostgreSQL
  - Persistent and reliable storage
  - Prisma ORM for migrations and schema management

---

## 📌 Architecture

The following diagram illustrates the architecture and data flow of AIRTrack:

### Architecture Diagram
<div align="center">
<img alt="Diagram" src="https://github.com/0xfunboy/AIRTrack/blob/main/TechArch.png" />
</div>

- **Frontend (React/Vite)** → User interface, charts, forms  
- **Backend (Node.js/Express)** → Authentication, validation, CRUD API  
- **Database (PostgreSQL)** → Persistent storage for users and trades  

---

## 🛠️ Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/your-repo/airtrack.git
cd airtrack
````

### 2. Install dependencies

```bash
pnpm install
```

### 3. Setup PostgreSQL

```bash
sudo apt install postgresql postgresql-contrib -y
sudo -u postgres psql
CREATE DATABASE airtrack;
CREATE USER airtrack_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE airtrack TO airtrack_user;
\q
```

### 4. Configure environment variables

Edit `.env`:

```env
DATABASE_URL="postgresql://airtrack_user:secure_password@localhost:5432/airtrack"
JWT_SECRET="your_secret_key"
```

### 5. Run migrations

```bash
pnpm prisma migrate dev --name init
```

### 6. Build frontend & start server

```bash
pnpm build
pnpm start
```

Visit: [http://localhost:3000](http://localhost:3000)

---

## 📦 Deployment

* Use **pm2** to keep the server alive:

```bash
pnpm add -g pm2
pm2 start server.js --name airtrack
pm2 save
```

* Use **Nginx** as a reverse proxy with HTTPS (Let’s Encrypt recommended).

---

## 📜 License

MIT License – free to use and modify.

Vuoi che ti crei anche il file `README.md` già pronto da salvare dentro la root del progetto (`/home/funboy/airtrack/README.md`)?
```
