
import { isStorySaved, toggleSaveStory } from "../models/storyModel.js"; 

export default class StoryView {
  constructor() {
    this.container = document.getElementById("card-list");
    this.textCerita = document.querySelector(".text-cerita");
    this.form = document.querySelector(".add-form");
    this.textKonfirmasi = document.querySelector(".text-konfirmasi");
    this.videoElement = document.querySelector("#video");
    this.canvas = document.querySelector("#canvas");
    this.photoElement = document.querySelector("#photo");
    this.stopCameraButton = document.getElementById("stop-camera-btn");
  }

  async displayStories(stories, offlineStoryIds = new Set()) {
    if (!this.container) {
      console.error("Card list container (card-list) not found");
      return;
    }

    this.container.innerHTML = "";

    if (!stories || stories.length === 0) {
      return;
    }

    for (const story of stories) {
      const storyLat = parseFloat(story.lat);
      const storyLon = parseFloat(story.lon);
      const areCoordinatesValid =
        !isNaN(storyLat) &&
        !isNaN(storyLon) &&
        story.lat !== null &&
        story.lon !== null;

      const storyCard = document.createElement("div");
      storyCard.classList.add("card");
      const mapId = `map-${story.id}`;

      const isSaved = await isStorySaved(story.id); 

      storyCard.innerHTML = `
        <img src="${
          story.photoUrl || "./assets/placeholder-image.png"
        }" alt="Foto Cerita: ${
        story.name
      }" class="story-pict" onerror="this.onerror=null;this.src='./assets/placeholder-image.png';">
        <div><strong>${story.name || "Tanpa Nama"}</strong></div>
        <div>${story.description || "Tanpa Deskripsi"}</div>
        <div><label>Lat :</label>${
          areCoordinatesValid ? storyLat.toFixed(5) : "N/A"
        }</div>
        <div><label>Lon :</label>${
          areCoordinatesValid ? storyLon.toFixed(5) : "N/A"
        }</div>
        <div><strong>Created At:</strong> ${new Date(
          story.createdAt
        ).toLocaleString()}</div>
        <div class="map-container" id="${mapId}" style="height: 200px; width: 100%; background-color: #f0f0f0;">
          ${
            !areCoordinatesValid
              ? '<p style="text-align:center; color:grey; padding-top:20px;">Data lokasi tidak tersedia.</p>'
              : ""
          }
        </div>
        <button class="save-story-btn" data-story-id="${story.id}">
          ${isSaved ? "Hapus dari Offline 🗑️" : "Simpan Cerita "}
        </button>
      `;

      this.container.appendChild(storyCard);

     
      const saveButton = storyCard.querySelector(".save-story-btn");
      if (saveButton) {
        saveButton.addEventListener("click", async (event) => {
          const storyId = event.target.getAttribute("data-story-id");
          const storyToToggle = stories.find((s) => s.id === storyId);
          if (storyToToggle) {
            const currentlySaved = await isStorySaved(storyId);
            await toggleSaveStory(storyToToggle, !currentlySaved); 
            event.target.textContent = !currentlySaved
              ? "Hapus dari Offline 🗑️"
              : "Simpan Offline 💾";
            alert(
              `Cerita "${storyToToggle.name}" telah ${
                !currentlySaved ? "disimpan" : "dihapus dari"
              } mode offline.`
            );
          }
        });
      }

      if (areCoordinatesValid) {
        setTimeout(() => {
          try {
            const mapElement = document.getElementById(mapId);
            if (mapElement && mapElement.offsetHeight > 0) {
              const map = L.map(mapId).setView([storyLat, storyLon], 13);
              L.tileLayer(
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                  attribution:
                    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                  maxZoom: 18,
                  minZoom: 3,
                }
              ).addTo(map);
              L.marker([storyLat, storyLon])
                .addTo(map)
                .bindPopup(
                  `<b>${story.name || "Story Location"}</b><br>${
                    story.description || ""
                  }`
                )
                .openPopup();
            } else if (mapElement) {
              mapElement.innerHTML =
                '<p style="text-align:center; color:grey; padding-top:20px;">Gagal memuat peta (elemen tidak siap).</p>';
            }
          } catch (mapError) {
            console.error(
              `Error saat menginisialisasi peta untuk cerita ID ${story.id}:`,
              mapError
            );
            const mapElementOnError = document.getElementById(mapId);
            if (mapElementOnError) {
              mapElementOnError.innerHTML =
                '<p style="text-align:center; color:grey; padding-top:20px;">Terjadi kesalahan saat memuat peta.</p>';
            }
          }
        }, 0);
      }
    }
  }

  showLoginPrompt() {
    if (this.textCerita) {
      this.textCerita.style.display = "block";
    }
  }

  hideLoginPrompt() {
    if (this.textCerita) {
      this.textCerita.style.display = "none";
    }
  }

  showConfirmation() {
    if (this.textKonfirmasi) {
      this.textKonfirmasi.style.display = "block";
    }
  }

  hideConfirmation() {
    if (this.textKonfirmasi) {
      this.textKonfirmasi.style.display = "none";
    }
  }

  async getCameraStream() {
    if (!this.videoElement) {
      console.error("Elemen video (#video) tidak ditemukan di DOM.");
      this.showErrorMessage(
        "Tidak dapat memulai kamera: elemen video tidak ada."
      );
      return null;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showErrorMessage("Fitur kamera tidak didukung di browser ini.");
      console.error("getUserMedia not supported on this browser!");
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      return stream;
    } catch (error) {
      console.error(
        "Error accessing camera (View):",
        error.name,
        error.message
      );
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        this.showErrorMessage(
          "Akses ke kamera ditolak. Periksa izin browser Anda."
        );
      } else if (
        error.name === "NotFoundError" ||
        error.name === "DevicesNotFoundError"
      ) {
        this.showErrorMessage(
          "Tidak ada kamera yang ditemukan di perangkat Anda."
        );
      } else {
        this.showErrorMessage("Gagal mengakses webcam: " + error.message);
      }
      return null;
    }
  }

  displayVideoStream(stream) {
    const captureButton = document.getElementById("captureButton");

    if (this.videoElement && stream) {
      this.videoElement.srcObject = stream;
      this.videoElement.style.display = "block";
      this.videoElement
        .play()
        .catch((e) => console.error("Error playing video stream:", e));

      if (this.photoElement) {
        this.photoElement.style.display = "none";
        this.photoElement.src = "";
      }

      if (captureButton) captureButton.style.display = "inline-block";
      if (this.stopCameraButton)
        this.stopCameraButton.style.display = "inline-block";
    } else if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement.style.display = "none";

      if (this.stopCameraButton) this.stopCameraButton.style.display = "none";
    }
  }

  stopStream(stream) {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    const captureButton = document.getElementById("captureButton");

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement.style.display = "none";
    }

    if (this.stopCameraButton) this.stopCameraButton.style.display = "none";
  }

  displayCapturedPhoto(dataUrl) {
    if (this.photoElement) {
      if (dataUrl) {
        this.photoElement.src = dataUrl;
        this.photoElement.style.display = "block";
        if (this.videoElement) {
          this.videoElement.style.display = "none";
        }
      } else {
        this.photoElement.src = "";
        this.photoElement.style.display = "none";
      }
    }
  }

  getFormValues() {
    const descriptionEl = document.querySelector("#isi-pesan");
    const latitudeEl = document.querySelector("#latitude");
    const longitudeEl = document.querySelector("#longitude");

    return {
      description: descriptionEl ? descriptionEl.value : "",
      latitude: latitudeEl ? latitudeEl.value : "",
      longitude: longitudeEl ? longitudeEl.value : "",
      photo: this.photoElement ? this.photoElement.src : "",
    };
  }

  onSubmit(callback) {
    if (this.form) {
      this.form.addEventListener("submit", (event) => {
        event.preventDefault();
        callback();
      });
    } else {
      console.warn("Form element (.add-form) not found for onSubmit binding.");
    }
  }

  showErrorMessage(message) {
    console.error("Error Displayed to User:", message);
    alert(message);
  }

  clearForm() {
    if (this.form) {
      this.form.reset();
    }

    this.displayCapturedPhoto(null);
    const latitudeInput = document.querySelector("#latitude");
    const longitudeInput = document.querySelector("#longitude");
    if (latitudeInput) latitudeInput.value = "";
    if (longitudeInput) longitudeInput.value = "";
  }
}
