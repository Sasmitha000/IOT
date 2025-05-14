const fs = require("fs").promises;
const path = require("path");
const fetch = require("node-fetch");

// File path to our images JSON
const IMAGES_JSON_PATH = path.join(__dirname, "../data/defect-images.json");

/**
 * Fetches the list of defect images from the JSON file
 * @param {number} limit - Maximum number of images to return
 * @returns {Promise<Array>} - Array of image objects
 */
async function getDefectImages(limit = 20) {
  try {
    // Read from our JSON file
    const data = await fs.readFile(IMAGES_JSON_PATH, "utf8");
    const { images } = JSON.parse(data);

    // Return images up to the limit
    return images.slice(0, limit);
  } catch (error) {
    console.error("Error fetching defect images data:", error);
    throw error;
  }
}

/**
 * Fetches the content of a specific image by ID
 * @param {string} imageId - ID of the image to fetch
 * @returns {Promise<Object>} - Object containing buffer, contentType, and name
 */
async function getDefectImageContent(imageId) {
  try {
    // Get the image metadata from our JSON
    const data = await fs.readFile(IMAGES_JSON_PATH, "utf8");
    const { images } = JSON.parse(data);

    const image = images.find((img) => img.id === imageId);
    if (!image) {
      throw new Error("Image not found");
    }

    // Fetch the actual image from OneDrive link
    const response = await fetch(image.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image. Status: ${response.status}`);
    }

    const buffer = await response.buffer();

    // Determine content type from image name extension
    let contentType = "image/jpeg"; // Default
    if (image.name.endsWith(".png")) {
      contentType = "image/png";
    } else if (image.name.endsWith(".gif")) {
      contentType = "image/gif";
    }

    return {
      buffer,
      contentType,
      name: image.name,
    };
  } catch (error) {
    console.error("Error fetching image content:", error);
    throw error;
  }
}

// For local development, you might want a method to update the JSON
async function addDefectImage(imageData) {
  try {
    const data = await fs.readFile(IMAGES_JSON_PATH, "utf8");
    const jsonData = JSON.parse(data);

    jsonData.images.push(imageData);

    await fs.writeFile(
      IMAGES_JSON_PATH,
      JSON.stringify(jsonData, null, 2),
      "utf8"
    );
    return imageData;
  } catch (error) {
    console.error("Error adding defect image:", error);
    throw error;
  }
}

module.exports = {
  getDefectImages,
  getDefectImageContent,
  addDefectImage,
};
