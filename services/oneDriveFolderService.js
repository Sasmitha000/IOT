const fetch = require("node-fetch");
const cheerio = require("cheerio");

/**
 * Service to fetch images directly from a OneDrive/SharePoint shared folder
 */
class OneDriveFolderService {
  constructor(folderUrl) {
    this.folderUrl = folderUrl;
    this.imageCache = null;
    this.lastFetchTime = null;
    // Cache expiration time (5 minutes)
    this.cacheExpiryMs = 5 * 60 * 1000;
  }

  /**
   * Extract image URLs from the OneDrive folder
   * @returns {Promise<Array>} Array of image objects
   */
  async getImagesFromFolder() {
    // Check if we have a valid cache
    if (
      this.imageCache &&
      this.lastFetchTime &&
      Date.now() - this.lastFetchTime < this.cacheExpiryMs
    ) {
      return this.imageCache;
    }

    try {
      console.log(`Attempting to fetch images from: ${this.folderUrl}`);
      const response = await fetch(this.folderUrl);
      console.log(`Response status: ${response.status}`);
      // Fetch the folder page HTML
      const html = await response.text();

      // Use cheerio to parse the HTML and extract image links
      const $ = cheerio.load(html);
      const images = [];

      // Look for image elements or links with image extensions
      $(
        'a[href$=".jpg"], a[href$=".jpeg"], a[href$=".png"], a[href$=".gif"]'
      ).each((i, el) => {
        const href = $(el).attr("href");
        const name = $(el).text().trim() || `Defect_${i + 1}.jpg`;

        // Extract download URL
        const directUrl = this.extractDirectUrl(href);

        if (directUrl) {
          const now = new Date();
          const date = `${now.getDate()}/${now.getMonth() + 1}`;
          const time = `${now.getHours()}:${String(now.getMinutes()).padStart(
            2,
            "0"
          )}`;

          images.push({
            id: `image${i + 1}`,
            name: name,
            date: date,
            time: time,
            confidenceRate: parseFloat((0.8 + Math.random() * 0.19).toFixed(4)),
            url: directUrl,
          });
        }
      });

      // If we couldn't extract images using links, try image elements
      if (images.length === 0) {
        $("img").each((i, el) => {
          const src = $(el).attr("src");
          const alt = $(el).attr("alt") || "";
          const name = alt || `Defect_${i + 1}.jpg`;

          if (
            src &&
            (src.includes(".jpg") ||
              src.includes(".jpeg") ||
              src.includes(".png") ||
              src.includes(".gif"))
          ) {
            const now = new Date();
            const date = `${now.getDate()}/${now.getMonth() + 1}`;
            const time = `${now.getHours()}:${String(now.getMinutes()).padStart(
              2,
              "0"
            )}`;

            images.push({
              id: `image${i + 1}`,
              name: name,
              date: date,
              time: time,
              confidenceRate: parseFloat(
                (0.8 + Math.random() * 0.19).toFixed(4)
              ),
              url: src,
            });
          }
        });
      }

      // If we still can't find images via HTML parsing,
      // fallback to using local images instead of Picsum
      if (images.length === 0) {
        console.log(
          "No images found in OneDrive, falling back to local images"
        );
        const localImages = await this.fallbackToLocalImages();
        images.push(...localImages);
      }

      // Update cache
      this.imageCache = images;
      this.lastFetchTime = Date.now();

      return images;
    } catch (error) {
      console.error("Error fetching images from OneDrive folder:", error);
      // Fallback to local images on error
      console.log("Error occurred, falling back to local images");
      return this.fallbackToLocalImages();
    }
  }

  /**
   * Extract direct URL from OneDrive/SharePoint link
   */
  extractDirectUrl(href) {
    // Try to convert sharing URL to direct download URL
    // This is a simplified approach and may need adjustments based on actual URL format
    if (href.includes("sharepoint.com") && href.includes("personal")) {
      // Convert to direct link if possible
      return href.replace("?", "/download?");
    }
    return href;
  }

  /**
   * Get a specific image by ID
   */
  async getImageById(imageId) {
    const images = await this.getImagesFromFolder();
    return images.find((img) => img.id === imageId);
  }

  /**
   * Get image content by ID
   */
  async getImageContent(imageId) {
    try {
      const image = await this.getImageById(imageId);

      if (!image) {
        throw new Error("Image not found");
      }

      // Check if it's a local file path
      if (image.url.startsWith("/") || image.url.startsWith("C:")) {
        // Handle local file paths differently
        try {
          const fs = require("fs");
          const path = require("path");

          // Normalize the path
          let filePath = image.url;
          if (image.url.startsWith("/")) {
            // Convert relative path to absolute
            filePath = path.join(__dirname, "..", image.url);
          }

          // Read the file
          const buffer = fs.readFileSync(filePath);

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
        } catch (fsError) {
          console.error("Error reading local file:", fsError);
          throw fsError;
        }
      } else {
        // Regular URL fetch for non-local files
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
      }
    } catch (error) {
      console.error("Error fetching image content:", error);
      throw error;
    }
  }

  /**
   * Clear cache to force refresh on next request
   */
  clearCache() {
    this.imageCache = null;
    this.lastFetchTime = null;
  }

  /**
   * Fallback to local images if web scraping fails
   */
  async fallbackToLocalImages() {
    // Return local images from your project folder
    return [
      {
        id: "local1",
        name: "sample_defect_1.jpg",
        date: "15/5",
        time: "10:15",
        confidenceRate: 0.9452,
        url: "/images/defects/sample1.jpg", // Path to local image
      },
      {
        id: "local2",
        name: "sample_defect_2.jpg",
        date: "15/5",
        time: "10:20",
        confidenceRate: 0.8734,
        url: "/images/defects/sample2.jpg",
      },
      {
        id: "local3",
        name: "sample_defect_3.jpg",
        date: "15/5",
        time: "10:25",
        confidenceRate: 0.9876,
        url: "/images/defects/sample3.jpg",
      },
      {
        id: "local4",
        name: "sample_defect_4.jpg",
        date: "15/5",
        time: "10:30",
        confidenceRate: 0.9245,
        url: "/images/defects/sample4.jpg",
      },
      {
        id: "local5",
        name: "sample_defect_5.jpg",
        date: "15/5",
        time: "10:35",
        confidenceRate: 0.8932,
        url: "/images/defects/sample5.jpg",
      },
    ];
  }
}

// Create and export a singleton instance with your folder URL
const oneDriveFolderUrl =
  "https://liveplymouthac-my.sharepoint.com/:f:/g/personal/10953555_students_plymouth_ac_uk/EqKnr8Y2G5NOksyvy8ti5Q0B_KXL0-HAaFR2EDwxAMD1fA?e=rKMTfy";
const folderService = new OneDriveFolderService(oneDriveFolderUrl);

module.exports = folderService;
