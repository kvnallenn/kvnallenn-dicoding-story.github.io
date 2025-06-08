const DB_NAME = "story-app-db";
const DB_VERSION = 1;
const STORY_STORE_NAME = "stories";

function openDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      console.warn("IndexedDB not supported!");
      return reject("IndexedDB not supported!");
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORY_STORE_NAME)) {
        const store = db.createObjectStore(STORY_STORE_NAME, { keyPath: "id" });

        console.log('Object store "stories" created.');
      }
    };

    request.onsuccess = (event) => {
      console.log("Database opened successfully.");
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.error);
      reject(event.target.error);
    };
  });
}

async function saveSingleStoryToDB(story) {
  if (!story || !story.id) {
    console.error("Invalid story object or missing story ID for saving.");
    return false;
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORY_STORE_NAME, "readwrite");
    const store = tx.objectStore(STORY_STORE_NAME);
    store.put(story); // 'put' akan update jika ada, atau insert jika baru
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log(`Story ID ${story.id} saved/updated in IndexedDB.`);
        resolve(true);
      };
      tx.onerror = (event) => {
        console.error(
          `Error saving story ID ${story.id} to IndexedDB:`,
          event.target.error
        );
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error("Failed to open DB for saving single story:", error);
    return false;
  }
}

async function deleteSingleStoryFromDB(storyId) {
  if (!storyId) {
    console.error("Invalid story ID for deletion.");
    return false;
  }
  try {
    const db = await openDB();
    const tx = db.transaction(STORY_STORE_NAME, "readwrite");
    const store = tx.objectStore(STORY_STORE_NAME);
    store.delete(storyId);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log(`Story ID ${storyId} deleted from IndexedDB.`);
        resolve(true);
      };
      tx.onerror = (event) => {
        console.error(
          `Error deleting story ID ${storyId} from IndexedDB:`,
          event.target.error
        );
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error("Failed to open DB for deleting single story:", error);
    return false;
  }
}

export async function isStorySaved(storyId) {
  if (!storyId) return false;
  try {
    const db = await openDB();
    const tx = db.transaction(STORY_STORE_NAME, "readonly");
    const store = tx.objectStore(STORY_STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.get(storyId);
      request.onsuccess = (event) => {
        resolve(!!event.target.result);
      };
      request.onerror = (event) => {
        console.error(
          `Error checking if story ID ${storyId} is saved:`,
          event.target.error
        );
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error("Failed to open DB for checking story:", error);
    return false;
  }
}

export async function toggleSaveStory(story, save) {
  if (save) {
    return await saveSingleStoryToDB(story);
  } else {
    return await deleteSingleStoryFromDB(story.id);
  }
}

async function getStoriesFromDB() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORY_STORE_NAME, "readonly");
    const store = tx.objectStore(STORY_STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = (event) => {
        resolve(event.target.result || []);
      };
      request.onerror = (event) => {
        console.error(
          "Error getting stories from IndexedDB:",
          event.target.error
        );
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error("Failed to open DB for reading stories:", error);
    return [];
  }
}

async function clearAllStoriesFromDB() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORY_STORE_NAME, "readwrite");
    const store = tx.objectStore(STORY_STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => {
        console.log("All stories cleared from IndexedDB.");
        resolve(true);
      };
      request.onerror = (event) => {
        console.error(
          "Error clearing stories from IndexedDB:",
          event.target.error
        );
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error("Failed to open DB for clearing stories:", error);
    return false;
  }
}

export default class StoryModel {
  static getToken() {
    return localStorage.getItem("token");
  }

  static hasActiveSession() {
    return !!this.getToken();
  }

  static async getOfflineStories() {
    console.log("Mengambil cerita langsung dari IndexedDB...");
    const offlineStories = await getStoriesFromDB();
    return offlineStories;
  }
  static async addStory(formData) {
    const token = this.getToken();
    if (!token) {
      console.error("Error adding story: Token not found.");
      return { error: true, message: "Unauthorized. Please login first." };
    }

    if (!navigator.onLine) {
      return {
        error: true,
        message: "Anda sedang offline. Tidak dapat menambahkan cerita baru.",
      };
    }

    try {
      const response = await fetch(
        "https://story-api.dicoding.dev/v1/stories",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error adding story:", error);
      return { error: true, message: error.message };
    }
  }

  static async getStories() {
    const token = this.getToken();
    if (!token) {
      console.error("Failed to fetch stories: Token not found.");
      return {
        error: true,
        message: "Token not found. Please login.",
        listStory: [],
      };
    }

    if (navigator.onLine) {
      try {
        console.log("Attempting to fetch stories from API...");
        const response = await fetch(
          "https://story-api.dicoding.dev/v1/stories",
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const result = await response.json();

        if (!result.error && result.listStory) {
          console.log("Stories fetched from API successfully.");
          return result;
        } else {
          console.warn(
            "API returned error or no stories, trying IndexedDB.",
            result.message
          );

          const dbStories = await getStoriesFromDB();
          return {
            error: false,
            message: "Fetched from local DB (API error).",
            listStory: dbStories,
          };
        }
      } catch (error) {
        console.error(
          "Failed to fetch stories from API, trying IndexedDB:",
          error
        );

        const dbStories = await getStoriesFromDB();
        return {
          error: false,
          message: "Fetched from local DB (network error).",
          listStory: dbStories,
        };
      }
    } else {
      console.log("Offline, fetching stories from IndexedDB...");
      const dbStories = await getStoriesFromDB();
      if (dbStories.length > 0) {
        return {
          error: false,
          message: "Fetched from local DB (offline).",
          listStory: dbStories,
        };
      } else {
        return {
          error: true,
          message: "Offline and no local data available.",
          listStory: [],
        };
      }
    }
  }

  static async clearLocalStories() {
    return await clearAllStoriesFromDB();
  }

  static async subscribeToNotifications(subscriptionObject) {
    const token = this.getToken();
    if (!token) {
      return {
        error: true,
        message: "Unauthorized. Please login first to subscribe.",
      };
    }
    if (!navigator.onLine) {
      return {
        error: true,
        message: "Anda sedang offline. Tidak dapat subscribe notifikasi.",
      };
    }

    const subJson = subscriptionObject.toJSON();
    const requestBody = {
      endpoint: subJson.endpoint,
      keys: {
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      },
    };

    try {
      const response = await fetch(
        "https://story-api.dicoding.dev/v1/notifications/subscribe",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        const errorMessage =
          result.message || `HTTP error! Status: ${response.status}`;
        console.error("Subscription to server failed:", errorMessage, result);
        return { error: true, message: errorMessage, details: result };
      }
      console.log("Subscription successful on server:", result);
      return result;
    } catch (error) {
      console.error("Error subscribing to notifications on server:", error);
      return {
        error: true,
        message:
          error.message ||
          "Network error or invalid JSON response during subscription.",
      };
    }
  }

  static async unsubscribeFromNotifications(endpoint) {
    const token = this.getToken();
    if (!token) {
      return {
        error: true,
        message: "Unauthorized. Please login first to unsubscribe.",
      };
    }
    if (!navigator.onLine) {
      return {
        error: true,
        message: "Anda sedang offline. Tidak dapat unsubscribe notifikasi.",
      };
    }

    try {
      const response = await fetch(
        "https://story-api.dicoding.dev/v1/notifications/subscribe",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ endpoint: endpoint }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        const errorMessage =
          result.message || `HTTP error! Status: ${response.status}`;
        console.error(
          "Unsubscription from server failed:",
          errorMessage,
          result
        );
        return { error: true, message: errorMessage, details: result };
      }
      console.log("Unsubscription successful on server:", result);
      return result;
    } catch (error) {
      console.error("Error unsubscribing from notifications on server:", error);
      return {
        error: true,
        message:
          error.message ||
          "Network error or invalid JSON response during unsubscription.",
      };
    }
  }
}
