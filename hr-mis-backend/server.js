import app from "./src/app.js";
import pool from "./src/config/database.js";


const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    const result = await pool.query(
      "SELECT current_database(), current_user, NOW()"
    );

    console.log("Database connected:", result.rows[0]);

    app.listen(PORT, () => {
      console.log(`HR MIS API running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
}

startServer();