import pymysql
from fastmcp import FastMCP
from fastmcp.server.auth.providers.auth0 import Auth0Provider
from dotenv import load_dotenv
import os

load_dotenv()

auth_provider = Auth0Provider(
    config_url=f"https://{os.getenv('DOMAIN')}/.well-known/openid-configuration",
    client_id=os.getenv("CLIENT_ID"),
    client_secret=os.getenv("CLIENT_SECRET"),
    audience=os.getenv("IDENTIFIER"),
    base_url=os.getenv("BASE_URL")
)

conn = pymysql.connect(
    host=os.getenv("DB_HOST", "localhost"),
    user=os.getenv("DB_USERNAME"),
    password=os.getenv("DB_PASSWORD"),
    db=os.getenv("DB_NAME", "employee_db"),
    cursorclass=pymysql.cursors.DictCursor
)

mcp = FastMCP("Employee CRUD Server", auth=auth_provider)  # Pass auth_provider here to enable auth routes

# for route in mcp.app.routes:
#     print(route.path)


@mcp.tool()
def create_employee(first_name: str, last_name: str, email: str, phone: str, hire_date: str, salary: float) -> str:
    with conn.cursor() as cursor:
        sql = """INSERT INTO employee (first_name, last_name, email, phone, hire_date, salary)
                 VALUES (%s, %s, %s, %s, %s, %s)"""
        cursor.execute(sql, (first_name, last_name, email, phone, hire_date, salary))
        conn.commit()
        return f"Employee {first_name} {last_name} created"

@mcp.tool()
def read_employee(emp_id: int) -> dict:
    with conn.cursor() as cursor:
        sql = "SELECT * FROM employee WHERE id = %s"
        cursor.execute(sql, (emp_id,))
        return cursor.fetchone() or {}

@mcp.tool()
def update_employee(emp_id: int, first_name: str, last_name: str, email: str, phone: str, hire_date: str, salary: float) -> str:
    with conn.cursor() as cursor:
        sql = """UPDATE employee SET first_name=%s, last_name=%s, email=%s, phone=%s, hire_date=%s, salary=%s WHERE id=%s"""
        cursor.execute(sql, (first_name, last_name, email, phone, hire_date, salary, emp_id))
        conn.commit()
        return "Employee updated" if cursor.rowcount else "Not found"

@mcp.tool()
def delete_employee(emp_id: int) -> str:
    with conn.cursor() as cursor:
        sql = "DELETE FROM employee WHERE id=%s"
        cursor.execute(sql, (emp_id,))
        conn.commit()
        return "Employee deleted" if cursor.rowcount else "Not found"

if __name__ == "__main__":
    mcp.run(transport="http", host="127.0.0.1", port=8000)
