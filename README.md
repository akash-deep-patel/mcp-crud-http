# MCP Employee CRUD HTTP Server

This project provides two implementations of an Employee CRUD server:
- Node.js (TypeScript) version: `node-version/`
- Python version: `py-version/`

## Database Setup

Both versions use a MySQL database named `employee_db` with the following credentials (default):
- **Host:** localhost
- **User:** username
- **Password:** password
- **Database:** employee_db

You can update these credentials in:
- **Node.js:**
  - `node-version/server.ts` (see `mysql.createPool` config)
- **Python:**
  - `py-version/main.py` (see `pymysql.connect` config)

## Node.js Version Usage

1. Install dependencies:
   ```sh
   npm install
   ```
2. Build TypeScript files:
   ```sh
   npm run build
   ```
3. Start the server:
   ```sh
   npm start
   ```
   The server runs on `http://localhost:8000/mcp`.

### Endpoints
- `POST /mcp` — MCP protocol tool calls (create, read, update, delete employee)
- `GET /mcp` — Capability discovery

## Python Version Usage

1. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
2. Start the server:
   ```sh
   python py-version/main.py
   ```
   The server runs on `http://127.0.0.1:8000/mcp`.

### Endpoints
- MCP protocol tool calls (create, read, update, delete employee)

## Updating Database Credentials

- **Node.js:** Edit the `mysql.createPool` config in `node-version/server.ts`.
- **Python:** Edit the `pymysql.connect` config in `py-version/main.py`.

## Notes
- Ensure MySQL is running and the `employee_db` database exists.
- Table schema should match the fields used in the code (see `employee` table columns).
- Both servers expose MCP tools for employee CRUD operations.

---
For any issues, check the logs and ensure your database credentials and connection details are correct.
