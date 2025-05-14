require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const path = require("path");
const fs = require("fs");

const User = require("./models/LoginUser");
// Use our simple OneDrive service instead
const simpleOneDriveService = require("./services/simpleOneDriveService");

// Import the folder service
const oneDriveFolderService = require("./services/oneDriveFolderService");

const app = express();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json()); // Add JSON support for API requests
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

// — "Protect" middleware for dashboard —
function ensureAuth(req, res, next) {
  if (req.session.userId) return next();
  res.redirect("/login?error=auth");
}

// CORS middleware for development
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    return res.status(200).json({});
  }
  next();
});

// — ROUTES —

// 1) Serve login form
app.get("/login", (req, res) => {
  console.log("🔍 GET /login");
  res.sendFile(path.join(__dirname, "login.html"));
});

// 2) Handle login submissions
app.post("/login", async (req, res) => {
  console.log("▶️ POST /login", req.body);
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.redirect("/login?error=invalid");

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.redirect("/login?error=invalid");

    req.session.userId = user._id;
    return res.redirect("/dashboard.html");
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
});

// Admin routes - unchanged from your original code
function ensureAdmin(req, res, next) {
  return next();
}

app.get("/admin/add-user", ensureAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "add-user.html"));
});

app.post(
  "/admin/add-user",
  /* ensureAdmin, */ async (req, res) => {
    console.log("▶️  POST /admin/add-user — body:", req.body);

    const { username, password } = req.body;
    if (!username || !password) {
      console.error("❌ Missing username or password");
      return res.status(400).send("Both username and password are required");
    }

    try {
      const hash = await bcrypt.hash(password, 12);
      const newUser = await User.create({ username, password: hash });
      console.log("✔️  Created user:", newUser);
      return res.redirect("/admin/add-user?success=true");
    } catch (err) {
      console.error("❌ Full error stack:", err);
      return res.status(500).send(`Server error: ${err.message}`);
    }
  }
);

// Add this near your other admin routes

// Admin page for adding defect images
app.get("/admin/add-defect-image", ensureAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "admin", "add-defect-image.html"));
});

// ---- DIRECT ONEDRIVE FOLDER API ENDPOINTS ----

// Get list of defect images
app.get("/api/defect-images", async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    // Get images directly from OneDrive folder
    const images = await oneDriveFolderService.getImagesFromFolder();

    // Transform the data for the frontend
    const formattedImages = images.slice(0, limit).map((image) => ({
      id: image.id,
      name: image.name,
      date: image.date,
      time: image.time,
      confidenceRate: image.confidenceRate,
      thumbnailUrl: `/api/defect-images/${image.id}/content`,
      downloadUrl: `/api/defect-images/${image.id}/content`,
    }));

    res.json({ images: formattedImages });
  } catch (error) {
    console.error("Error fetching defect images:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch images from OneDrive folder" });
  }
});

// Get a specific image content
app.get("/api/defect-images/:id/content", async (req, res) => {
  try {
    const fileId = req.params.id;
    const fileContent = await oneDriveFolderService.getImageContent(fileId);

    res.setHeader("Content-Type", fileContent.contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${fileContent.name}"`
    );
    res.send(fileContent.buffer);
  } catch (error) {
    console.error("Error fetching image content:", error);
    res.status(500).json({ error: "Failed to fetch image content" });
  }
});

// Force refresh of the image cache
app.post(
  "/api/defect-images/refresh",
  /* ensureAdmin, */ (req, res) => {
    try {
      oneDriveFolderService.clearCache();
      res.json({ success: true, message: "Cache cleared successfully" });
    } catch (error) {
      console.error("Error clearing cache:", error);
      res.status(500).json({ error: "Failed to clear cache" });
    }
  }
);

// Serve static assets
app.use(express.static(path.join(__dirname)));

// Create data directory and JSON file if they don't exist
const dataDir = path.join(__dirname, "data");
const imagesJsonPath = path.join(dataDir, "defect-images.json");

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
  console.log("Created data directory");
}

// Ensure defect-images.json exists
if (!fs.existsSync(imagesJsonPath)) {
  // Create a sample JSON file with placeholder data
  const sampleData = {
    images: [
      {
        id: "sample1",
        name: "sample_defect.jpg",
        date: "15/5",
        time: "10:30",
        confidenceRate: 0.9876,
        //  OneDrive shared URL
        url: "https://liveplymouthac-my.sharepoint.com/:f:/g/personal/10953555_students_plymouth_ac_uk/EqKnr8Y2G5NOksyvy8ti5Q0B_KXL0-HAaFR2EDwxAMD1fA?e=rKMTfy",
      },
    ],
  };

  fs.writeFileSync(imagesJsonPath, JSON.stringify(sampleData, null, 2));
  console.log("Created sample defect-images.json file");
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Listening on port ${PORT}`));
