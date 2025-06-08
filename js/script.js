import AuthModel from "./models/authModel.js";
import AuthView from "./views/authView.js";
import AuthPresenter from "./presenters/authPresenter.js";
import StoryModel from "./models/storyModel.js";
import StoryView from "./views/storyView.js";
import StoryPresenter from "./presenters/storyPresenter.js";

const VAPID_PUBLIC_KEY =
  "BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk";
let swRegistration = null;
let isPushSubscribed = false;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service Worker not supported.");
    alert("Web Push Notifications are not supported in this browser.");
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register(
      "./service-worker.js"
    );
    console.log("Service Worker registered successfully:", registration);
    swRegistration = registration;
    initializePushNotificationsUI();
    return registration;
  } catch (error) {
    console.error("Service Worker registration failed:", error);
    alert(`Service Worker registration failed: ${error.message}`);
    return null;
  }
}

function initializePushNotificationsUI() {
  if (!swRegistration) {
    console.warn("Service Worker not registered, cannot initialize Push UI.");
    return;
  }

  swRegistration.pushManager
    .getSubscription()
    .then((subscription) => {
      isPushSubscribed = !(subscription === null);
      updateSubscribeButtonUI();
      if (isPushSubscribed) {
        console.log("User IS subscribed to push notifications.");
      } else {
        console.log("User is NOT subscribed to push notifications.");
      }
    })
    .catch((err) => {
      console.error("Error during getSubscription():", err);
    });
}

function updateSubscribeButtonUI() {
  const subscribeButton = document.getElementById("subscribePushBtn");
  if (!subscribeButton) return;

  if (Notification.permission === "denied") {
    subscribeButton.textContent = "Push Notifications Blocked";
    subscribeButton.disabled = true;
    isPushSubscribed = false;
    return;
  }

  if (isPushSubscribed) {
    subscribeButton.textContent = "Unsubscribe Notifications";
  } else {
    subscribeButton.textContent = "Subscribe to Notifications";
  }
  subscribeButton.disabled = !StoryModel.hasActiveSession();
  if (!StoryModel.hasActiveSession()) {
    subscribeButton.title = "Login to subscribe";
  } else {
    subscribeButton.title = "";
  }
}

async function handleSubscribeButtonClick() {
  if (!StoryModel.hasActiveSession()) {
    alert("Please log in to manage push notification subscriptions.");
    return;
  }
  if (!swRegistration) {
    alert("Service worker not ready. Please try again in a moment.");
    return;
  }

  const subscribeButton = document.getElementById("subscribePushBtn");
  subscribeButton.disabled = true;

  if (isPushSubscribed) {
    await unsubscribeUserFromPush();
  } else {
    await subscribeUserToPush();
  }
  subscribeButton.disabled = false;
  updateSubscribeButtonUI();
}

async function subscribeUserToPush() {
  if (Notification.permission === "denied") {
    alert(
      "Notification permission has been denied. Please enable it in your browser settings."
    );
    return;
  }
  if (Notification.permission === "default") {
    const permissionResult = await Notification.requestPermission();
    if (permissionResult !== "granted") {
      alert("Notification permission was not granted.");
      return;
    }
  }

  try {
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey,
    });
    console.log("User subscribed to Push Manager:", subscription.toJSON());

    const serverResponse = await StoryModel.subscribeToNotifications(
      subscription
    );
    if (serverResponse && !serverResponse.error) {
      console.log("Successfully subscribed on server:", serverResponse);
      isPushSubscribed = true;
      alert("Successfully subscribed to notifications!");
    } else {
      console.error(
        "Failed to subscribe on server:",
        serverResponse.message,
        serverResponse.details
      );
      alert(`Failed to subscribe on server: ${serverResponse.message}`);

      if (subscription) {
        await subscription.unsubscribe();
        console.log("Unsubscribed from Push Manager due to server error.");
      }
      isPushSubscribed = false;
    }
  } catch (error) {
    console.error("Failed to subscribe user to push:", error);
    alert(`Subscription failed: ${error.message}. Check console for details.`);
    if (error.name === "NotAllowedError") {
      alert("Notification permission was denied or dismissed.");
    }
    isPushSubscribed = false;
  }
}

async function unsubscribeUserFromPush() {
  try {
    const subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) {
      const serverResponse = await StoryModel.unsubscribeFromNotifications(
        subscription.endpoint
      );
      if (serverResponse && !serverResponse.error) {
        await subscription.unsubscribe();
        console.log("User unsubscribed from Push Manager and server.");
        isPushSubscribed = false;
        alert("Successfully unsubscribed from notifications.");
      } else {
        console.error(
          "Failed to unsubscribe on server:",
          serverResponse.message,
          serverResponse.details
        );
        alert(
          `Failed to unsubscribe on server: ${serverResponse.message}. You might still be subscribed locally.`
        );
      }
    } else {
      console.log("No active push subscription found to unsubscribe.");
      isPushSubscribed = false;
    }
  } catch (error) {
    console.error("Failed to unsubscribe user from push:", error);
    alert(`Unsubscription failed: ${error.message}`);
  }
}

function router() {
  const hash = location.hash || "#/";

  const subscribeBtn = document.getElementById("subscribePushBtnGlobal");
  if (subscribeBtn) subscribeBtn.style.display = "none";

  if (hash === "#/login") {
    renderLoginPage();
  } else if (hash === "#/register") {
    renderRegisterPage();
  } else if (hash === "#/") {
    renderHomePage();
  } else if (hash === "#/form") {
    renderAddStoryPage();
    setTimeout(initMap, 100);
  }
}

function renderHomePage() {
  document.startViewTransition(() => {
    const app = document.getElementById("app");
    const loginrender = document.getElementById("login-section");
    const userToken = localStorage.getItem("token");

    if (userToken) {
      loginrender.style.display = "none";
    } else {
      loginrender.style.display = "flex";
    }

    app.innerHTML = `
      <section class="article-text">
        <button type="submit" class="skip-button" onclick="window.location='#/form';">Add Story</button>
        <button type="button" class="skip-button" id="subscribePushBtn">Subscribe to Notifications</button>
      <button type="button" class="skip-button" id="show-offline-btn">Tampilkan Cerita Offline</button>
        </section>
      <section class="list-story">
        <label>Story List</label>
      </section>
      <div class="text-cerita" style="display: none;">
        Harap Login Untuk Melihat List Cerita . . .
      </div>
      <div class="card-wrap">
        <section class="card-story">
          <div class="card-list" id="card-list"></div>
        </section>
      </div>
    `;

    const storyView = new StoryView();
    const storyPresenter = new StoryPresenter(storyView, StoryModel);
    storyPresenter.loadStories();

    const subscribeButton = document.getElementById("subscribePushBtn");
    if (subscribeButton) {
      subscribeButton.addEventListener("click", handleSubscribeButtonClick);
      updateSubscribeButtonUI();
    }

    const showOfflineButton = document.getElementById("show-offline-btn");
    if (showOfflineButton) {
      showOfflineButton.addEventListener("click", async () => {
        console.log("Tombol tampilkan offline diklik!");
        alert("Memuat cerita dari penyimpanan offline...");

        const offlineStories = await StoryModel.getOfflineStories();

        if (offlineStories && offlineStories.length > 0) {
          storyView.displayStories(offlineStories);
          console.log(
            `Berhasil memuat ${offlineStories.length} cerita dari penyimpanan offline.`
          );
        } else {
          storyView.showErrorMessage(
            "Tidak ada cerita yang ditemukan di penyimpanan offline."
          );
          storyView.displayStories([]);
        }
      });
    }

    if (swRegistration) {
      initializePushNotificationsUI();
    }
  });
}

function renderLoginPage() {
  document.startViewTransition(() => {
    const app = document.getElementById("app");
    app.innerHTML = `
      <section class="container-form">
        <div class="login-form">
          <form class="login-input-form">
            <div class="input-form">
              <div><label for="email">Email</label></div>
              <div><input type="text" id="email" /></div>
              <div><label for="password">Password</label></div>
              <div><input type="password" id="password" /></div>
              <button aria-label="Login Button" type="submit" class="login-button">Login</button>
              <p class="text-konfirmasi" style="display: none;">
                Harap bersabar ini ujian . . .
              </p>
            </div>
          </form>
        </div>
      </section>
    `;
    const authView = new AuthView();
    new AuthPresenter(authView, AuthModel);
  });
}

function renderRegisterPage() {
  document.startViewTransition(() => {
    const app = document.getElementById("app");
    app.innerHTML = `
      <section class="container-form">
        <div class="login-form">
          <form class="register-input-form">
            <div class="input-form">
              <div><label for="name">Name</label></div>
              <div><input type="text" id="name" /></div>
              <div><label for="email">Email</label></div>
              <div><input type="text" id="email" /></div>
              <div><label for="password">Password</label></div>
              <div><input type="password" id="password" /></div>
              <button aria-label="Register Account" type="submit" class="register-button">Register</button>
              <p class="notif-regis" style="display: none;">
                Akun sedang dibuat, harap berharap . . .
              </p>
            </div>
          </form>
        </div>
      </section>
    `;
    const authView = new AuthView();
    new AuthPresenter(authView, AuthModel);
  });
}

function renderAddStoryPage() {
  document.startViewTransition(() => {
    const app = document.getElementById("app");

    app.innerHTML = `
      <section class="container-form">
        <div class="login-form">
          <form class="add-form">
            <div class="input-form">
              <label for="isi-pesan">Deskripsi Cerita</label>
              <textarea id="isi-pesan" cols="50" rows="10"></textarea>
            </div>
            <div class="input-form">
                <video id="video" style="display: none; width: 100%; max-width: 400px; height: auto; border: 1px solid grey; margin-bottom: 10px;"></video>
                <canvas id="canvas" style="display: none;"></canvas>
            </div>
            <div class="input-form">
              <label for="captureButton">Take/Upload Photo</label> <br/>
              <button type="button" id="captureButton">Start Camera & Capture</button>
              <button type="button" id="stop-camera-btn" style="display: none;">Tutup Kamera</button>
              <br/>
              <img id="photo" style="display: none; max-width: 100%; height: auto; margin-top: 10px;" alt="Captured Photo" />
            </div>

            <div class="input-form">
              <label for="map">Pilih Lokasi (Click on map)</label>
            </div>
            <div id="map" style="height: 300px; width: 100%; margin-bottom: 10px;"></div>
            <input type="hidden" id="latitude" name="latitude" />
            <input type="hidden" id="longitude" name="longitude" />

            <button aria-label="Submit Cerita" type="submit" class="login-button">Submit Story</button>
            <p class="text-konfirmasi" style="display: none;">
              Gula gula apa yang hijau? gula gula ninja
            </p>
          </form>
        </div>
      </section>
    `;
    const storyView = new StoryView();
    const storyPresenter = new StoryPresenter(storyView, StoryModel);

    storyPresenter.startVideoStream();

    document.querySelector("#captureButton").addEventListener("click", () => {
      if (
        !storyPresenter.activeStream &&
        storyView.videoElement.style.display === "none"
      ) {
        storyPresenter.startVideoStream().then(() => {
          document.querySelector("#captureButton").textContent =
            "Capture Photo";
        });
      } else if (storyPresenter.activeStream) {
        storyPresenter.capturePhoto();
      } else {
        storyPresenter.startVideoStream();
        document.querySelector("#captureButton").textContent = "Capture Photo";
      }
    });

    document.querySelector("#stop-camera-btn").addEventListener("click", () => {
      storyPresenter.handleStopCameraButtonClick();
      document.querySelector("#captureButton").textContent =
        "Start Camera & Capture";
    });

    storyPresenter.submitStoryForm();
  });
}

let marker;
let isLocationPinned = false;

function initMap() {
  const mapElement = document.getElementById("map");
  if (!mapElement || typeof L === "undefined") {
    console.warn(
      "Map element not found or Leaflet (L) not loaded. Map cannot be initialized."
    );
    return;
  }

  if (window.storyAppMap) {
    window.storyAppMap.remove();
    window.storyAppMap = null;
  }
  isLocationPinned = false;
  marker = null;

  let initialLat = 0;
  let initialLon = 0;
  let initialZoom = 2;

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        initialLat = position.coords.latitude;
        initialLon = position.coords.longitude;
        initialZoom = 13;
        if (window.storyAppMap) {
          window.storyAppMap.setView([initialLat, initialLon], initialZoom);
        }

        if (!isLocationPinned && document.getElementById("latitude")) {
          document.getElementById("latitude").value = initialLat;
          document.getElementById("longitude").value = initialLon;
        }
      },
      () => {
        console.warn(
          "Geolocation failed or was denied. Using default map center."
        );
        if (window.storyAppMap) {
          window.storyAppMap.setView([initialLat, initialLon], initialZoom);
        }
      }
    );
  } else {
    console.warn(
      "Geolocation not supported by this browser. Using default map center."
    );
  }

  window.storyAppMap = L.map("map").setView(
    [initialLat, initialLon],
    initialZoom
  );

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(window.storyAppMap);

  window.storyAppMap.on("click", function (e) {
    const lat = e.latlng.lat.toFixed(6);
    const lon = e.latlng.lng.toFixed(6);

    if (marker) {
      marker.setLatLng([lat, lon]);
    } else {
      marker = L.marker([lat, lon]).addTo(window.storyAppMap);
    }
    marker
      .bindPopup("Selected Location:<br>Lat: " + lat + "<br>Lon: " + lon)
      .openPopup();
    isLocationPinned = true;

    document.getElementById("latitude").value = lat;
    document.getElementById("longitude").value = lon;
  });
}

window.addEventListener("load", () => {
  router();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((registration) => {
        console.log(
          "Service Worker registered successfully with scope:",
          registration.scope
        );
        swRegistration = registration;
        if ("PushManager" in window) {
          initializePushNotificationsUI();
        } else {
          console.warn("Push messaging is not supported.");
        }
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
  } else {
    console.warn("Service Worker not supported in this browser.");
  }
});
window.addEventListener("hashchange", router);
