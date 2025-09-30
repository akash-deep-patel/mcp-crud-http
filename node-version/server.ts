import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import { z } from "zod";
// No @types/mysql2 package is needed; mysql2 provides its own TypeScript types.

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "root",
  database: "employee_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const server = new McpServer({
  name: "employee-crud-server",
  version: "1.0.0",
});

// Register tool to create an employee
server.registerTool("create_employee", {
  description: "Create a new employee record",
  inputSchema: {
    first_name: z.string().describe("Employee's first name"),
    last_name: z.string().describe("Employee's last name"),
    email: z.string().email().describe("Employee's email address"),
    phone: z.string().describe("Employee's phone number"),
    hire_date: z.string().describe("Employee's hire date (YYYY-MM-DD)"),
    salary: z.number().describe("Employee's salary"),
  },
}, async ({ first_name, last_name, email, phone, hire_date, salary }) => {
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      "INSERT INTO employee (first_name, last_name, email, phone, hire_date, salary) VALUES (?, ?, ?, ?, ?, ?)", 
      [first_name, last_name, email, phone, hire_date, salary]
    );
    return {
      content: [
        {
          type: "text",
          text: `Created employee ${first_name} ${last_name}`,
        },
      ],
    };
  } finally {
    conn.release();
  }
});

// Register tool to read an employee
server.registerTool("read_employee", {
  description: "Read an employee record by ID",
  inputSchema: {
    emp_id: z.number().describe("Employee ID to retrieve"),
  },
}, async ({ emp_id }) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute("SELECT * FROM employee WHERE id = ?", [emp_id]);
    const employees = rows as any[];
    const employee = employees.length ? employees[0] : null;
    return {
      content: [
        {
          type: "text",
          text: employee ? JSON.stringify(employee, null, 2) : "Employee not found",
        },
      ],
    };
  } finally {
    conn.release();
  }
});

// Register tool to update an employee
server.registerTool("update_employee", {
  description: "Update an existing employee record",
  inputSchema: {
    emp_id: z.number().describe("Employee ID to update"),
    first_name: z.string().describe("Employee's first name"),
    last_name: z.string().describe("Employee's last name"),
    email: z.string().email().describe("Employee's email address"),
    phone: z.string().describe("Employee's phone number"),
    hire_date: z.string().describe("Employee's hire date (YYYY-MM-DD)"),
    salary: z.number().describe("Employee's salary"),
  },
}, async ({ emp_id, first_name, last_name, email, phone, hire_date, salary }) => {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      "UPDATE employee SET first_name = ?, last_name = ?, email = ?, phone = ?, hire_date = ?, salary = ? WHERE id = ?", 
      [first_name, last_name, email, phone, hire_date, salary, emp_id]
    );
    const updateResult = result as any;
    return {
      content: [
        {
          type: "text",
          text: updateResult.affectedRows ? "Employee updated successfully" : "Employee not found",
        },
      ],
    };
  } finally {
    conn.release();
  }
});

// Register tool to delete an employee
server.registerTool("delete_employee", {
  description: "Delete an employee record by ID",
  inputSchema: {
    emp_id: z.number().describe("Employee ID to delete"),
  },
}, async ({ emp_id }) => {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute("DELETE FROM employee WHERE id = ?", [emp_id]);
    const deleteResult = result as any;
    return {
      content: [
        {
          type: "text",
          text: deleteResult.affectedRows ? "Employee deleted successfully" : "Employee not found",
        },
      ],
    };
  } finally {
    conn.release();
  }
});

async function main() {
  const app = express();
  
  // Enable CORS for web access
  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Mcp-Session-Id"],
    exposedHeaders: ["Mcp-Session-Id"],
    credentials: false
  }));
  
  // Parse JSON requests
  app.use(express.json());

  // Track initialized sessions
  const initializedSessions = new Set<string>();

  // Create StreamableHTTPServerTransport for MCP
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => Math.random().toString(36).substring(2, 15),
    onsessioninitialized: (sessionId: string) => {
      console.log('MCP session initialized:', sessionId);
      initializedSessions.add(sessionId);
    }
  });
  
  // Connect the MCP server to the transport
  await server.connect(transport);

  // Handle MCP requests with session initialization workaround
  app.post('/mcp', async (req: express.Request, res: express.Response) => {
    try {
      console.log('MCP POST request received:', req.method, req.url, req.headers);
      console.log('Request body:', JSON.stringify(req.body, null, 2));

      const sessionId = req.headers['mcp-session-id'] as string;

      // Handle MCP protocol directly to bypass transport initialization issues
      if (req.body?.method === 'initialize') {
        console.log('Initializing session:', sessionId);
        initializedSessions.add(sessionId);
        return res.json({
          jsonrpc: "2.0",
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "employee-crud-server", version: "1.0.0" }
          },
          id: req.body.id
        });
      }

      if (req.body?.method === 'notifications/initialized') {
        // Silently acknowledge notification
        return res.json({
          jsonrpc: "2.0",
          result: null,
          id: req.body.id || null
        });
      }

      if (req.body?.method === 'tools/list') {
        console.log('Tools/list request received - returning tool definitions');
        return res.json({
          jsonrpc: "2.0",
          result: {
            tools: [
              {
                name: "create_employee",
                description: "Create a new employee record",
                inputSchema: {
                  type: "object",
                  properties: {
                    first_name: { type: "string", description: "Employee's first name" },
                    last_name: { type: "string", description: "Employee's last name" },
                    email: { type: "string", description: "Employee's email address" },
                    phone: { type: "string", description: "Employee's phone number" },
                    hire_date: { type: "string", description: "Employee's hire date (YYYY-MM-DD)" },
                    salary: { type: "number", description: "Employee's salary" }
                  },
                  required: ["first_name", "last_name", "email", "phone", "hire_date", "salary"]
                }
              },
              {
                name: "read_employee",
                description: "Read an employee record by ID",
                inputSchema: {
                  type: "object",
                  properties: {
                    emp_id: { type: "number", description: "Employee ID to retrieve" }
                  },
                  required: ["emp_id"]
                }
              },
              {
                name: "update_employee",
                description: "Update an existing employee record",
                inputSchema: {
                  type: "object",
                  properties: {
                    emp_id: { type: "number", description: "Employee ID to update" },
                    first_name: { type: "string", description: "Employee's first name" },
                    last_name: { type: "string", description: "Employee's last name" },
                    email: { type: "string", description: "Employee's email address" },
                    phone: { type: "string", description: "Employee's phone number" },
                    hire_date: { type: "string", description: "Employee's hire date (YYYY-MM-DD)" },
                    salary: { type: "number", description: "Employee's salary" }
                  },
                  required: ["emp_id", "first_name", "last_name", "email", "phone", "hire_date", "salary"]
                }
              },
              {
                name: "delete_employee",
                description: "Delete an employee record by ID",
                inputSchema: {
                  type: "object",
                  properties: {
                    emp_id: { type: "number", description: "Employee ID to delete" }
                  },
                  required: ["emp_id"]
                }
              }
            ]
          },
          id: req.body.id
        });
      }

      if (req.body?.method === 'tools/call') {
        try {
          const { name, arguments: args } = req.body.params;
          let result;
          switch (name) {
            case 'create_employee': {
              const { first_name, last_name, email, phone, hire_date, salary } = args;
              const conn = await pool.getConnection();
              try {
                await conn.execute(
                  "INSERT INTO employee (first_name, last_name, email, phone, hire_date, salary) VALUES (?, ?, ?, ?, ?, ?)",
                  [first_name, last_name, email, phone, hire_date, salary]
                );
                result = { content: [{ type: "text", text: `Created employee ${first_name} ${last_name}` }] };
                console.log('Employee created successfully:', first_name, last_name);
              } finally {
                conn.release();
              }
              break;
            }
            case 'read_employee': {
              const { emp_id } = args;
              const conn = await pool.getConnection();
              try {
                const [rows] = await conn.execute("SELECT * FROM employee WHERE id = ?", [emp_id]);
                const employees = rows as any[];
                const employee = employees.length ? employees[0] : null;
                result = { content: [{ type: "text", text: employee ? JSON.stringify(employee, null, 2) : "Employee not found" }] };
              } finally {
                conn.release();
              }
              break;
            }
            case 'update_employee': {
              const { emp_id, first_name, last_name, email, phone, hire_date, salary } = args;
              const conn = await pool.getConnection();
              try {
                const [updateResult] = await conn.execute(
                  "UPDATE employee SET first_name = ?, last_name = ?, email = ?, phone = ?, hire_date = ?, salary = ? WHERE id = ?",
                  [first_name, last_name, email, phone, hire_date, salary, emp_id]
                );
                const updateRes = updateResult as any;
                result = { content: [{ type: "text", text: updateRes.affectedRows ? "Employee updated successfully" : "Employee not found" }] };
              } finally {
                conn.release();
              }
              break;
            }
            case 'delete_employee': {
              const { emp_id } = args;
              const conn = await pool.getConnection();
              try {
                const [deleteResult] = await conn.execute("DELETE FROM employee WHERE id = ?", [emp_id]);
                const deleteRes = deleteResult as any;
                result = { content: [{ type: "text", text: deleteRes.affectedRows ? "Employee deleted successfully" : "Employee not found" }] };
              } finally {
                conn.release();
              }
              break;
            }
            default:
              return res.status(400).json({
                jsonrpc: "2.0",
                error: { code: -32601, message: "Method not found" },
                id: req.body.id
              });
          }
          return res.json({
            jsonrpc: "2.0",
            result,
            id: req.body.id
          });
        } catch (error) {
          console.error('Tool execution error:', error);
          return res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal error",
              data: error instanceof Error ? error.message : String(error)
            },
            id: req.body.id
          });
        }
      }

      // Log unhandled requests and force a response instead of falling back to transport
      console.log('Unhandled MCP request method:', req.body?.method);
      console.log('Full request body:', JSON.stringify(req.body, null, 2));

      // Instead of falling back to transport, return an error for unknown methods
      return res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32601,
          message: `Method not found: ${req.body?.method}`
        },
        id: req.body?.id || null
      });
    } catch (error) {
      console.error('Error handling MCP POST request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });


  // Handle GET requests for capability discovery
  app.get('/mcp', async (req, res) => {
    try {
      console.log('MCP GET request received:', req.method, req.url, req.headers);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error('Error handling MCP GET request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });

  // Handle preflight OPTIONS requests
  app.options('/mcp', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    res.status(200).end();
  });

  // Basic status route
  app.get('/', (req, res) => {
    res.json({
      message: "MCP Employee CRUD HTTP Server",
      status: "running",
      version: "1.0.0",
      transport: "StreamableHTTP",
      endpoints: {
        mcp: "/mcp",
        methods: ["GET", "POST"]
      },
      tools: ["create_employee", "read_employee", "update_employee", "delete_employee"]
    });
  });
  
  const PORT = 8000;
  app.listen(PORT, () => {
    console.log(`MCP Employee CRUD HTTP server running on http://localhost:${PORT}`);
    console.log(`MCP endpoint available at: http://localhost:${PORT}/mcp`);
    console.log(`Tools: create_employee, read_employee, update_employee, delete_employee`);
    console.log(`Use POST requests to /mcp for tool calls`);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});

