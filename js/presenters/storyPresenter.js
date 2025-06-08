export default class StoryPresenter {
  constructor(view, model) {
    this.view = view;
    this.model = model;
    this.activeStream = null;
    this.capturedPhotoDataUrl = null;
  }

  async loadStories() {
    if (this.model.hasActiveSession()) {
      this.view.hideLoginPrompt();
      try {
        const response = await this.model.getStories();

        if (response && response.listStory && !response.error) {
          if (
            response.listStory.length === 0 &&
            response.message &&
            response.message.includes("Offline and no local data")
          ) {
            this.view.showErrorMessage(
              "Anda offline dan tidak ada data cerita lokal yang tersimpan."
            );
            this.view.displayStories([]);
          } else {
            this.view.displayStories(response.listStory);
            if (response.message && response.message.includes("local DB")) {
              console.log("Menampilkan cerita dari penyimpanan lokal.");
            }
          }
        } else {
          console.error(
            "Error loading stories (Presenter):",
            response.message || "Unknown error from StoryModel.getStories"
          );
          if (
            response.message &&
            response.message.toLowerCase().includes("token not found")
          ) {
            this.view.showLoginPrompt();
          } else if (
            response.message &&
            response.message.includes("Offline and no local data")
          ) {
            this.view.showErrorMessage(
              "Anda offline dan tidak ada data cerita lokal yang tersimpan."
            );
            this.view.displayStories([]);
          } else {
            this.view.showErrorMessage(
              response.message || "Gagal memuat cerita."
            );
            this.view.displayStories([]);
          }
        }
      } catch (error) {
        console.error(
          "Failed to orchestrate fetching stories (Presenter):",
          error
        );
        this.view.showErrorMessage("Gagal memuat cerita: " + error.message);
        this.view.displayStories([]);
      }
    } else {
      this.view.showLoginPrompt();
      this.view.displayStories([]);
      if (!navigator.onLine) {
        console.log(
          "Offline, mencoba memuat cerita untuk pengguna tamu dari model..."
        );
      }
    }
  }

  async submitStoryForm() {
    this.view.onSubmit(async () => {
      const { description, latitude, longitude } = this.view.getFormValues();
      const photoDataForUpload = this.capturedPhotoDataUrl;

      if (!this.model.hasActiveSession()) {
        this.view.showErrorMessage("Unauthorized, please login first.");
        return;
      }

      if (!navigator.onLine) {
        this.view.showErrorMessage(
          "Anda sedang offline. Cerita tidak dapat dikirim sekarang."
        );
        return;
      }

      if (!photoDataForUpload || !description) {
        this.view.showErrorMessage(
          "Please capture a photo and provide a description for the story."
        );
        return;
      }

      this.view.showConfirmation();

      try {
        const photoBlob = this.dataURLtoBlob(photoDataForUpload);

        if (photoBlob.size > 1 * 1024 * 1024) {
          this.view.showErrorMessage(
            "Photo file size exceeds 1MB. Please choose a smaller image or capture a new one."
          );
          this.view.hideConfirmation();
          return;
        }

        const formData = new FormData();
        formData.append("description", description);
        formData.append("photo", photoBlob, "story-photo.png");
        if (latitude && longitude) {
          formData.append("lat", parseFloat(latitude));
          formData.append("lon", parseFloat(longitude));
        }

        const response = await this.model.addStory(formData);

        if (response && !response.error) {
          alert(`Story created successfully! ${response.message || ""}`);
          console.log("Story submitted, server response:", response);

          if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              action: "clearApiCache",

              urlToDelete: "https://story-api.dicoding.dev/v1/stories",
            });
            console.log(
              "Pesan untuk clear API cache (stories) dikirim ke Service Worker."
            );
          }

          if (this.activeStream) {
            this.view.stopStream(this.activeStream);
            this.activeStream = null;
          }
          this.capturedPhotoDataUrl = null;
          this.view.clearForm();

          setTimeout(() => {
            window.location.hash = "#/";
          }, 1000);
        } else {
          this.view.showErrorMessage(
            `Error submitting story: ${
              response.message || "Unknown server error."
            }`
          );
          console.error("Error submitting story to server:", response);
        }
      } catch (error) {
        console.error("Critical error during story submission:", error);
        this.view.showErrorMessage(`Submission failed: ${error.message}`);
      } finally {
        this.view.hideConfirmation();
      }
    });
  }

  async startVideoStream() {
    if (this.activeStream) {
      this.view.stopStream(this.activeStream);
      this.activeStream = null;
    }

    if (!this.view.videoElement || !this.view.canvas) {
      console.error(
        "Video or Canvas element not found in the view. Camera cannot start."
      );
      this.view.showErrorMessage(
        "Camera elements not found. Cannot start video stream."
      );
      return null;
    }

    this.view.videoElement.addEventListener(
      "loadedmetadata",
      () => {
        if (this.view.canvas) {
          this.view.canvas.width = this.view.videoElement.videoWidth;
          this.view.canvas.height = this.view.videoElement.videoHeight;
        }
      },
      { once: true }
    );

    try {
      const stream = await this.view.getCameraStream();
      if (stream) {
        this.activeStream = stream;
        this.view.displayVideoStream(this.activeStream);
        const captureBtn = document.getElementById("captureButton");
        if (captureBtn) captureBtn.textContent = "Capture Photo";
      } else {
        console.warn("Camera stream was not obtained (Presenter).");
      }
      return stream;
    } catch (error) {
      console.error("Error starting video stream (Presenter):", error);
      this.view.showErrorMessage(
        `Error starting camera: ${error.message}. Please check permissions.`
      );
      return null;
    }
  }

  capturePhoto() {
    if (!this.activeStream || !this.view.videoElement || !this.view.canvas) {
      console.error(
        "Camera stream or required elements not active/available for capture."
      );
      this.view.showErrorMessage("Camera not ready. Start the camera first.");
      return;
    }
    if (
      this.view.videoElement.paused ||
      this.view.videoElement.ended ||
      this.view.videoElement.videoWidth === 0
    ) {
      console.error(
        "Video stream not actively playing or dimensions unavailable."
      );
      this.view.showErrorMessage(
        "Camera stream is not ready. Please wait or restart camera."
      );
      return;
    }

    const maxWidth = 800;
    const quality = 0.7;
    const videoWidth = this.view.videoElement.videoWidth;
    const videoHeight = this.view.videoElement.videoHeight;
    const aspectRatio = videoWidth / videoHeight;

    let newWidth = videoWidth;
    let newHeight = videoHeight;

    if (newWidth > maxWidth) {
      newWidth = maxWidth;
      newHeight = newWidth / aspectRatio;
    }

    this.view.canvas.width = newWidth;
    this.view.canvas.height = newHeight;

    const context = this.view.canvas.getContext("2d");

    context.drawImage(this.view.videoElement, 0, 0, newWidth, newHeight);

    const dataUrl = this.view.canvas.toDataURL("image/jpeg", quality);

    this.capturedPhotoDataUrl = dataUrl;
    this.view.displayCapturedPhoto(dataUrl);
    this.view.displayVideoStream(null);
    if (this.view.stopCameraButton)
      this.view.stopCameraButton.style.display = "none";

    const captureBtn = document.getElementById("captureButton");
    if (captureBtn) captureBtn.textContent = "Retake Photo (Start Camera)";
  }

  dataURLtoBlob(dataUrl) {
    const parts = dataUrl.split(",");
    if (parts.length !== 2) {
      throw new Error("Invalid dataURL format for blob conversion.");
    }
    const [header, base64Data] = parts;
    const mimeMatch = header.match(/:(.*?);/);
    if (!mimeMatch || mimeMatch.length < 2) {
      throw new Error("Invalid dataURL format: MIME type not found.");
    }
    const mimeType = mimeMatch[1];

    let binaryData;
    try {
      binaryData = atob(base64Data);
    } catch (e) {
      console.error("Error decoding base64 string (atob failed):", e);
      throw new Error("Invalid base64 data in dataURL.");
    }

    const dataLength = binaryData.length;
    const uint8Array = new Uint8Array(dataLength);
    for (let i = 0; i < dataLength; i++) {
      uint8Array[i] = binaryData.charCodeAt(i);
    }
    return new Blob([uint8Array], { type: mimeType });
  }

  handleStopCameraButtonClick() {
    console.log("Presenter: 'Tutup Kamera' (Stop Camera) button clicked.");
    if (this.activeStream) {
      this.view.stopStream(this.activeStream);
      this.activeStream = null;
      console.log("Camera stream stopped by user button.");
    }
    const captureBtn = document.getElementById("captureButton");
    if (captureBtn) captureBtn.textContent = "Start Camera & Capture";
  }
}
