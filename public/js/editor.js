// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", function () {
  // Initialize Quill editor
  const quill = new Quill("#editor", {
    modules: {
      toolbar: "#toolbar",
      history: {
        delay: 2000,
        maxStack: 100,
        userOnly: true,
      },
    },
    theme: "snow",
  });

  // Set initial content if provided
  if (
    window.APP.initialContent &&
    window.APP.initialContent !== "<p><br></p>"
  ) {
    quill.root.innerHTML = window.APP.initialContent;
  }

  // Get DOM elements
  const saveBtn = document.getElementById("saveBtn");
  const versionsBtn = document.getElementById("versionsBtn");
  const sidebar = document.getElementById("sidebar");
  const closeSidebar = document.getElementById("closeSidebar");
  const versionsList = document.getElementById("versionsList");
  const downloadZip = document.getElementById("downloadZip");

  // Show success/error message
  function showMessage(message, type = "success") {
    const messageEl = document.createElement("div");
    messageEl.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
      type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
    }`;
    messageEl.textContent = message;
    document.body.appendChild(messageEl);

    setTimeout(() => {
      if (document.body.contains(messageEl)) {
        document.body.removeChild(messageEl);
      }
    }, 3000);
  }

  // Show loading state on button
  function setButtonLoading(button, isLoading) {
    if (isLoading) {
      button.classList.add("btn-loading");
      button.disabled = true;
      const originalHTML = button.innerHTML;
      button.setAttribute("data-original-html", originalHTML);
      button.innerHTML = `
        <svg class="spinner h-5 w-5 inline mr-2" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Saving...
      `;
    } else {
      button.classList.remove("btn-loading");
      button.disabled = false;
      const originalHTML = button.getAttribute("data-original-html");
      if (originalHTML) {
        button.innerHTML = originalHTML;
      }
    }
  }

  // Save current document
  async function saveCurrent() {
    const html = quill.root.innerHTML;

    try {
      const res = await fetch("/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId: window.APP.docId,
          html,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Save failed");
      }

      const data = await res.json();
      return data;
    } catch (error) {
      console.error("Error saving document:", error);
      throw error;
    }
  }

  // Fetch versions from server
  async function fetchVersions() {
    try {
      const res = await fetch(
        `/versions?docId=${encodeURIComponent(window.APP.docId)}`
      );
      if (!res.ok) {
        throw new Error("Failed to fetch versions");
      }
      return await res.json();
    } catch (error) {
      console.error("Error fetching versions:", error);
      throw error;
    }
  }

  // Fetch specific version content
  async function fetchVersionContent(versionId) {
    try {
      const res = await fetch(`/version/${encodeURIComponent(versionId)}`);
      if (!res.ok) {
        throw new Error("Failed to fetch version content");
      }
      return await res.json();
    } catch (error) {
      console.error("Error fetching version content:", error);
      throw error;
    }
  }

  // Load and display versions
  async function loadVersions() {
    versionsList.innerHTML =
      '<div class="text-center text-gray-500 py-4">Loading versions...</div>';

    try {
      const versions = await fetchVersions();

      if (!versions || versions.length === 0) {
        versionsList.innerHTML =
          '<div class="text-center text-gray-500 py-8">No versions yet. Start editing and save your document!</div>';
        return;
      }

      displayVersions(versions);
    } catch (error) {
      console.error("Error loading versions:", error);
      versionsList.innerHTML =
        '<div class="text-center text-red-500 py-4">Error loading versions</div>';
    }
  }

  // Display versions in sidebar
  function displayVersions(versions) {
    versionsList.innerHTML = "";

    // Sort versions by version number (descending)
    const sortedVersions = versions.sort(
      (a, b) => b.versionNumber - a.versionNumber
    );

    sortedVersions.forEach((version) => {
      const versionEl = document.createElement("div");
      versionEl.className =
        "version-item bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors";

      const date = new Date(version.createdAt);
      const formattedDate =
        date.toLocaleDateString() + " " + date.toLocaleTimeString();

      versionEl.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="font-semibold text-gray-800">Version ${
              version.versionNumber
            }</div>
            <div class="text-xs text-gray-500 mt-1">${formattedDate}</div>
            <div class="text-sm text-gray-600 mt-2">${
              version.description || "Auto-saved version"
            }</div>
          </div>
          <div class="flex flex-col space-y-2 ml-3">
            <button class="view-version text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1 rounded border border-blue-200 hover:bg-blue-50 transition-colors">
              View
            </button>
            <button class="restore-version text-green-600 hover:text-green-800 text-sm font-medium px-3 py-1 rounded border border-green-200 hover:bg-green-50 transition-colors">
              Restore
            </button>
          </div>
        </div>
      `;

      // Add event listeners
      const viewBtn = versionEl.querySelector(".view-version");
      const restoreBtn = versionEl.querySelector(".restore-version");

      viewBtn.addEventListener("click", async () => {
        try {
          setButtonLoading(viewBtn, true);
          const versionData = await fetchVersionContent(version.id);
          quill.root.innerHTML = versionData.html;
          showMessage(`Version ${version.versionNumber} loaded successfully!`);
        } catch (error) {
          console.error("Error loading version:", error);
          showMessage("Error loading version", "error");
        } finally {
          setButtonLoading(viewBtn, false);
        }
      });

      restoreBtn.addEventListener("click", async () => {
        try {
          setButtonLoading(restoreBtn, true);
          const versionData = await fetchVersionContent(version.id);
          quill.root.innerHTML = versionData.html;

          // Save as new version
          await saveCurrent();
          await loadVersions();
          showMessage(
            `Version ${version.versionNumber} restored and saved as new version!`
          );
        } catch (error) {
          console.error("Error restoring version:", error);
          showMessage("Error restoring version", "error");
        } finally {
          setButtonLoading(restoreBtn, false);
        }
      });

      versionsList.appendChild(versionEl);
    });
  }

  // Event listeners
  saveBtn.addEventListener("click", async () => {
    setButtonLoading(saveBtn, true);

    try {
      await saveCurrent();
      showMessage("Document saved successfully!");
      await loadVersions(); // Refresh versions list
    } catch (error) {
      console.error("Save error:", error);
      showMessage("Error saving document: " + error.message, "error");
    } finally {
      setButtonLoading(saveBtn, false);
    }
  });

  // Toggle sidebar
  versionsBtn.addEventListener("click", async () => {
    const isOpen = sidebar.classList.contains("sidebar-open");

    if (!isOpen) {
      sidebar.classList.add("sidebar-open");
      await loadVersions();
    } else {
      sidebar.classList.remove("sidebar-open");
    }
  });

  closeSidebar.addEventListener("click", () => {
    sidebar.classList.remove("sidebar-open");
  });

  // Close sidebar when clicking outside on mobile
  document.addEventListener("click", (e) => {
    if (
      window.innerWidth < 1024 &&
      !sidebar.contains(e.target) &&
      !versionsBtn.contains(e.target) &&
      sidebar.classList.contains("sidebar-open")
    ) {
      sidebar.classList.remove("sidebar-open");
    }
  });

  // Keyboard shortcut for save
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveBtn.click();
    }
  });

  // Download ZIP functionality - Updated to use DOCX endpoint
  if (downloadZip) {
    downloadZip.addEventListener("click", async (e) => {
      e.preventDefault();

      try {
        // Show downloading state
        const originalText = downloadZip.innerHTML;
        downloadZip.innerHTML = `
          <svg class="spinner h-5 w-5 inline mr-2" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Preparing DOCX download...
        `;
        downloadZip.disabled = true;

        // Use the new DOCX download endpoint
        const response = await fetch(`/download-docx/${window.APP.docId}`);

        if (!response.ok) {
          throw new Error("Failed to download DOCX files");
        }

        // Create blob and download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${window.APP.docId}-versions.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showMessage("DOCX files downloaded successfully!");

        // Reset button after a delay
        setTimeout(() => {
          downloadZip.innerHTML = originalText;
          downloadZip.disabled = false;
        }, 2000);
      } catch (error) {
        console.error("Download error:", error);
        showMessage("Error downloading DOCX files: " + error.message, "error");

        // Reset button on error
        const originalText = downloadZip.getAttribute("data-original-html");
        if (originalText) {
          downloadZip.innerHTML = originalText;
        }
        downloadZip.disabled = false;
      }
    });
  }

  console.log("Editor initialized successfully with docId:", window.APP.docId);
});
