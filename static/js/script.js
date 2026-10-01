/* ==========================================================================
   CardioPulse AI — Frontend Application Logic
   Dynamic ECG monitor, input synchronization, API prediction, radial gauge
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // State
  let currentPredictionData = null;
  let modelMetadata = null;

  // DOM Elements
  const form = document.getElementById("predictionForm");
  const submitBtn = document.getElementById("submitBtn");
  const resultsPlaceholder = document.getElementById("resultsPlaceholder");
  const resultsContent = document.getElementById("resultsContent");
  const resultsCard = document.getElementById("resultsCard");

  // Gauge Elements
  const gaugeProgress = document.getElementById("gaugeProgress");
  const gaugePercent = document.getElementById("gaugePercent");
  const gaugeHeartIcon = document.getElementById("gaugeHeartIcon");
  const riskBadge = document.getElementById("riskBadge");
  const riskHeadline = document.getElementById("riskHeadline");
  const riskNarrative = document.getElementById("riskNarrative");
  const probBarFill = document.getElementById("probBarFill");
  const probHealthyDisplay = document.getElementById("probHealthyDisplay");
  const probDiseaseDisplay = document.getElementById("probDiseaseDisplay");
  const riskFactorsList = document.getElementById("riskFactorsList");
  const protectiveFactorsList = document.getElementById("protectiveFactorsList");
  const recommendationsList = document.getElementById("recommendationsList");
  const assessmentTimestamp = document.getElementById("assessmentTimestamp");

  // Modal Elements
  const infoModal = document.getElementById("infoModal");
  const openInfoModalBtn = document.getElementById("openInfoModalBtn");
  const closeInfoModalBtn = document.getElementById("closeInfoModalBtn");
  const closeInfoModalBtn2 = document.getElementById("closeInfoModalBtn2");

  // Preset Buttons
  const presetHealthy = document.getElementById("presetHealthy");
  const presetModerate = document.getElementById("presetModerate");
  const presetHigh = document.getElementById("presetHigh");
  const presetRandom = document.getElementById("presetRandom");
  const presetReset = document.getElementById("presetReset");

  // Actions
  const printReportBtn = document.getElementById("printReportBtn");
  const copyReportBtn = document.getElementById("copyReportBtn");

  /* ==========================================================================
     1. Live ECG Monitor Canvas in Header
     ========================================================================== */
  const ecgCanvas = document.getElementById("ecgCanvas");
  let ecgCtx = null;
  let ecgX = 0;
  let ecgY = 21;
  let ecgHistory = [];
  let ecgBeatInterval = 70;
  let ecgTick = 0;
  let currentBpm = 72;

  if (ecgCanvas) {
    ecgCtx = ecgCanvas.getContext("2d");
    const width = ecgCanvas.width;
    const height = ecgCanvas.height;

    // Fill initial dark background
    ecgCtx.fillStyle = "#0d121d";
    ecgCtx.fillRect(0, 0, width, height);

    function getEcgY(t) {
      const mid = height / 2;
      // Normal sinus rhythm simulation (P wave, PR segment, QRS complex, T wave)
      const phase = t % ecgBeatInterval;
      if (phase >= 10 && phase < 16) {
        // P wave
        return mid - Math.sin(((phase - 10) / 6) * Math.PI) * 4;
      } else if (phase === 20) {
        // Q wave
        return mid + 4;
      } else if (phase === 22) {
        // R wave peak
        return mid - 18;
      } else if (phase === 24) {
        // S wave dip
        return mid + 8;
      } else if (phase >= 32 && phase < 42) {
        // T wave
        return mid - Math.sin(((phase - 32) / 10) * Math.PI) * 6;
      }
      return mid + (Math.random() * 0.8 - 0.4);
    }

    function drawEcg() {
      ecgTick++;
      const targetY = getEcgY(ecgTick);

      // Trailing fade effect
      ecgCtx.fillStyle = "rgba(13, 18, 29, 0.08)";
      ecgCtx.fillRect(0, 0, width, height);

      // Draw faint grid line
      ecgCtx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ecgCtx.lineWidth = 1;
      ecgCtx.beginPath();
      ecgCtx.moveTo(0, height / 2);
      ecgCtx.lineTo(width, height / 2);
      ecgCtx.stroke();

      // Draw ECG trace
      const nextX = (ecgX + 2) % width;
      ecgCtx.strokeStyle = "#f43f5e";
      ecgCtx.lineWidth = 2;
      ecgCtx.lineCap = "round";
      ecgCtx.shadowBlur = 6;
      ecgCtx.shadowColor = "rgba(244, 63, 94, 0.8)";

      ecgCtx.beginPath();
      ecgCtx.moveTo(ecgX, ecgY);
      ecgCtx.lineTo(nextX, targetY);
      ecgCtx.stroke();

      ecgCtx.shadowBlur = 0;
      ecgX = nextX;
      ecgY = targetY;

      requestAnimationFrame(drawEcg);
    }

    requestAnimationFrame(drawEcg);
  }

  function setEcgBpm(bpm) {
    currentBpm = bpm;
    const bpmDisplay = document.getElementById("bpmDisplay");
    if (bpmDisplay) {
      bpmDisplay.textContent = Math.round(bpm);
    }
    // Adjust beat interval
    ecgBeatInterval = Math.max(35, Math.min(100, Math.round(4200 / bpm)));
  }

  /* ==========================================================================
     2. Slider & Number Input Synchronization
     ========================================================================== */
  const pairedInputs = [
    { range: "ageRange", num: "ageInput", onUpdate: updateAgeTarget },
    { range: "trestbpsRange", num: "trestbpsInput", onUpdate: updateBpIndicator },
    { range: "cholRange", num: "cholInput", onUpdate: updateCholIndicator },
    { range: "thalachRange", num: "thalachInput", onUpdate: (val) => setEcgBpm(val * 0.5) },
    { range: "oldpeakRange", num: "oldpeakInput", onUpdate: updateOldpeakIndicator }
  ];

  pairedInputs.forEach(({ range, num, onUpdate }) => {
    const rangeEl = document.getElementById(range);
    const numEl = document.getElementById(num);

    if (rangeEl && numEl) {
      rangeEl.addEventListener("input", (e) => {
        numEl.value = e.target.value;
        if (onUpdate) onUpdate(parseFloat(e.target.value));
      });

      numEl.addEventListener("input", (e) => {
        let val = parseFloat(e.target.value);
        if (!isNaN(val)) {
          rangeEl.value = val;
          if (onUpdate) onUpdate(val);
        }
      });
    }
  });

  function updateAgeTarget(age) {
    const hint = document.getElementById("targetHrHint");
    if (hint) {
      const estimatedMax = Math.round(220 - age);
      hint.textContent = `Age-predicted max: ~${estimatedMax} bpm (Target 85%: ~${Math.round(estimatedMax * 0.85)} bpm)`;
    }
  }

  function updateBpIndicator(val) {
    const ind = document.getElementById("trestbpsIndicator");
    if (!ind) return;
    if (val < 120) {
      ind.innerHTML = `<span class="indicator-tag tag-normal">Normal BP (&lt; 120 mm Hg)</span>`;
    } else if (val < 130) {
      ind.innerHTML = `<span class="indicator-tag tag-elevated">Elevated (120-129 mm Hg)</span>`;
    } else if (val < 140) {
      ind.innerHTML = `<span class="indicator-tag tag-borderline">Stage 1 Hypertension (130-139 mm Hg)</span>`;
    } else {
      ind.innerHTML = `<span class="indicator-tag tag-high">Stage 2 Hypertension (&ge; 140 mm Hg)</span>`;
    }
  }

  function updateCholIndicator(val) {
    const ind = document.getElementById("cholIndicator");
    if (!ind) return;
    if (val < 200) {
      ind.innerHTML = `<span class="indicator-tag tag-normal">Desirable (&lt; 200 mg/dl)</span>`;
    } else if (val < 240) {
      ind.innerHTML = `<span class="indicator-tag tag-borderline">Borderline High (200-239 mg/dl)</span>`;
    } else {
      ind.innerHTML = `<span class="indicator-tag tag-high">High Risk (&ge; 240 mg/dl)</span>`;
    }
  }

  function updateOldpeakIndicator(val) {
    const ind = document.getElementById("oldpeakIndicator");
    if (!ind) return;
    if (val < 1.0) {
      ind.innerHTML = `<span class="indicator-tag tag-normal">Normal / Minimal (&lt; 1.0 mm)</span>`;
    } else if (val < 2.0) {
      ind.innerHTML = `<span class="indicator-tag tag-borderline">Moderate Ischemia (1.0-1.9 mm)</span>`;
    } else {
      ind.innerHTML = `<span class="indicator-tag tag-high">Significant Ischemia (&ge; 2.0 mm)</span>`;
    }
  }

  // Run initial updates
  updateAgeTarget(54);
  updateBpIndicator(130);
  updateCholIndicator(240);
  updateOldpeakIndicator(1.0);

  /* ==========================================================================
     3. Presets & Quick Fill
     ========================================================================== */
  function populateForm(data) {
    if (!data) return;

    // Age
    if (data.age !== undefined) {
      document.getElementById("ageInput").value = data.age;
      document.getElementById("ageRange").value = data.age;
      updateAgeTarget(data.age);
    }

    // Sex
    if (data.sex !== undefined) {
      const radio = document.querySelector(`input[name="sex"][value="${data.sex}"]`);
      if (radio) radio.checked = true;
    }

    // Chest pain
    if (data.cp !== undefined) {
      const radio = document.querySelector(`input[name="cp"][value="${data.cp}"]`);
      if (radio) radio.checked = true;
    }

    // Trestbps
    if (data.trestbps !== undefined) {
      document.getElementById("trestbpsInput").value = data.trestbps;
      document.getElementById("trestbpsRange").value = data.trestbps;
      updateBpIndicator(data.trestbps);
    }

    // Chol
    if (data.chol !== undefined) {
      document.getElementById("cholInput").value = data.chol;
      document.getElementById("cholRange").value = data.chol;
      updateCholIndicator(data.chol);
    }

    // Fbs
    if (data.fbs !== undefined) {
      const radio = document.querySelector(`input[name="fbs"][value="${data.fbs}"]`);
      if (radio) radio.checked = true;
    }

    // Restecg
    if (data.restecg !== undefined) {
      document.getElementById("restecgSelect").value = data.restecg;
    }

    // Thalach
    if (data.thalach !== undefined) {
      document.getElementById("thalachInput").value = data.thalach;
      document.getElementById("thalachRange").value = data.thalach;
      setEcgBpm(data.thalach * 0.5);
    }

    // Exang
    if (data.exang !== undefined) {
      const radio = document.querySelector(`input[name="exang"][value="${data.exang}"]`);
      if (radio) radio.checked = true;
    }

    // Oldpeak
    if (data.oldpeak !== undefined) {
      document.getElementById("oldpeakInput").value = data.oldpeak;
      document.getElementById("oldpeakRange").value = data.oldpeak;
      updateOldpeakIndicator(data.oldpeak);
    }

    // Slope
    if (data.slope !== undefined) {
      document.getElementById("slopeSelect").value = data.slope;
    }

    // Ca
    if (data.ca !== undefined) {
      const radio = document.querySelector(`input[name="ca"][value="${data.ca}"]`);
      if (radio) radio.checked = true;
    }

    // Thal
    if (data.thal !== undefined) {
      document.getElementById("thalSelect").value = data.thal;
    }
  }

  // Preset Event Listeners
  if (presetHealthy) {
    presetHealthy.addEventListener("click", () => {
      populateForm({
        age: 38,
        sex: 0,
        cp: 2,
        trestbps: 112,
        chol: 178,
        fbs: 0,
        restecg: 0,
        thalach: 180,
        exang: 0,
        oldpeak: 0.1,
        slope: 2,
        ca: 0,
        thal: 2
      });
      showToast("Applied Preset: Healthy Adult", "success");
    });
  }

  if (presetModerate) {
    presetModerate.addEventListener("click", () => {
      populateForm({
        age: 54,
        sex: 1,
        cp: 1,
        trestbps: 135,
        chol: 242,
        fbs: 0,
        restecg: 0,
        thalach: 142,
        exang: 0,
        oldpeak: 1.2,
        slope: 1,
        ca: 1,
        thal: 2
      });
      showToast("Applied Preset: Borderline Risk", "info");
    });
  }

  if (presetHigh) {
    presetHigh.addEventListener("click", () => {
      populateForm({
        age: 63,
        sex: 1,
        cp: 0,
        trestbps: 160,
        chol: 295,
        fbs: 1,
        restecg: 1,
        thalach: 110,
        exang: 1,
        oldpeak: 3.2,
        slope: 0,
        ca: 2,
        thal: 3
      });
      showToast("Applied Preset: High Risk Cardiac Patient", "error");
    });
  }

  if (presetRandom) {
    presetRandom.addEventListener("click", async () => {
      try {
        const res = await fetch("/api/sample");
        if (!res.ok) throw new Error("Failed to load sample");
        const json = await res.json();
        if (json.data) {
          populateForm(json.data);
          showToast(json.description || "Loaded random dataset record", "info");
        }
      } catch (err) {
        console.error(err);
        showToast("Error loading random sample", "error");
      }
    });
  }

  if (presetReset) {
    presetReset.addEventListener("click", () => {
      form.reset();
      updateAgeTarget(54);
      updateBpIndicator(130);
      updateCholIndicator(240);
      updateOldpeakIndicator(1.0);
      showToast("Form parameters reset to defaults", "info");
    });
  }

  /* ==========================================================================
     4. Form Submission & Risk Prediction Pipeline
     ========================================================================== */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Collect 13 features
    const formData = new FormData(form);
    const payload = {
      age: parseInt(formData.get("age")),
      sex: parseInt(formData.get("sex")),
      cp: parseInt(formData.get("cp")),
      trestbps: parseInt(formData.get("trestbps")),
      chol: parseInt(formData.get("chol")),
      fbs: parseInt(formData.get("fbs")),
      restecg: parseInt(formData.get("restecg")),
      thalach: parseInt(formData.get("thalach")),
      exang: parseInt(formData.get("exang")),
      oldpeak: parseFloat(formData.get("oldpeak")),
      slope: parseInt(formData.get("slope")),
      ca: parseInt(formData.get("ca")),
      thal: parseInt(formData.get("thal"))
    };

    // UI Loading state
    submitBtn.classList.add("loading");
    submitBtn.disabled = true;

    try {
      // Send prediction request (tries /api/predict then /predict)
      let res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok && res.status === 404) {
        res = await fetch("/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `Prediction failed with status ${res.status}`);
      }

      const result = await res.json();
      currentPredictionData = result;

      // Render Results
      renderResults(result);

      // Smooth scroll into results view on mobile
      if (window.innerWidth < 1100) {
        resultsCard.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      showToast("Assessment calculated successfully", "success");

    } catch (err) {
      console.error("Prediction Error:", err);
      showToast(err.message || "An error occurred during assessment", "error");
    } finally {
      submitBtn.classList.remove("loading");
      submitBtn.disabled = false;
    }
  });

  /* ==========================================================================
     5. Render Results & Gauge Animation
     ========================================================================== */
  function renderResults(data) {
    if (resultsPlaceholder) resultsPlaceholder.classList.add("hidden");
    if (resultsContent) resultsContent.classList.remove("hidden");

    const prob = data.probability; // 0.0 to 100.0
    const themeColor = data.theme_color || (prob >= 65 ? "#f43f5e" : prob >= 35 ? "#f59e0b" : "#10b981");

    // 1. Animate Radial Gauge SVG
    // Circumference = 2 * PI * 82 ≈ 515.22
    const totalCircumference = 515.22;
    const progressOffset = totalCircumference - (prob / 100) * totalCircumference;
    if (gaugeProgress) {
      gaugeProgress.style.strokeDashoffset = progressOffset;
      gaugeProgress.style.stroke = themeColor;
    }

    // 2. Animate Numeric Counter
    animateCounter(gaugePercent, prob, 1000);

    // 3. Heart Pulse Animation Speed
    if (gaugeHeartIcon) {
      gaugeHeartIcon.style.color = themeColor;
      const animSpeed = prob >= 65 ? "0.6s" : prob >= 35 ? "1.0s" : "1.4s";
      const iconSvg = gaugeHeartIcon.querySelector("svg");
      if (iconSvg) iconSvg.style.animationDuration = animSpeed;
    }

    // 4. Badges & Headlines
    if (riskBadge) {
      riskBadge.textContent = data.risk_badge || (prob >= 65 ? "HIGH RISK / DISEASE INDICATED" : prob >= 35 ? "MODERATE / ELEVATED" : "LOW RISK / NORMAL");
      riskBadge.className = "risk-badge " + (prob >= 65 ? "badge-high" : prob >= 35 ? "badge-moderate" : "");
    }

    if (riskHeadline) {
      riskHeadline.textContent = data.headline || (prob >= 65 ? "Heart Disease Risk Detected" : "Low Cardiovascular Risk");
      riskHeadline.style.color = themeColor;
    }

    if (riskNarrative) {
      riskNarrative.textContent = data.summary;
    }

    // 5. Probability Split Bar
    if (probBarFill) {
      probBarFill.style.width = `${prob}%`;
      probBarFill.style.background = themeColor;
    }
    if (probHealthyDisplay) probHealthyDisplay.textContent = `${data.prob_healthy}%`;
    if (probDiseaseDisplay) probDiseaseDisplay.textContent = `${data.probability}%`;

    // 6. Risk Factors List
    if (riskFactorsList) {
      riskFactorsList.innerHTML = "";
      if (data.risk_factors && data.risk_factors.length > 0) {
        data.risk_factors.forEach(item => {
          const li = document.createElement("li");
          li.textContent = item;
          riskFactorsList.appendChild(li);
        });
      } else {
        const li = document.createElement("li");
        li.textContent = "No primary clinical alarm criteria flagged.";
        li.style.fontStyle = "italic";
        riskFactorsList.appendChild(li);
      }
    }

    // 7. Protective Factors List
    if (protectiveFactorsList) {
      protectiveFactorsList.innerHTML = "";
      if (data.protective_factors && data.protective_factors.length > 0) {
        data.protective_factors.forEach(item => {
          const li = document.createElement("li");
          li.textContent = item;
          protectiveFactorsList.appendChild(li);
        });
      } else {
        const li = document.createElement("li");
        li.textContent = "Multiple indicators warrant clinical review.";
        li.style.fontStyle = "italic";
        protectiveFactorsList.appendChild(li);
      }
    }

    // 8. Recommendations List
    if (recommendationsList) {
      recommendationsList.innerHTML = "";
      if (data.recommendations && data.recommendations.length > 0) {
        data.recommendations.forEach(item => {
          const li = document.createElement("li");
          li.textContent = item;
          recommendationsList.appendChild(li);
        });
      }
    }

    // 9. Timestamp
    if (assessmentTimestamp) {
      assessmentTimestamp.textContent = data.timestamp || new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
    }

    // Re-initialize Lucide icons in case new HTML was inserted
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function animateCounter(element, targetVal, duration) {
    if (!element) return;
    const startTime = performance.now();
    const startVal = 0;

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (targetVal - startVal) * easeProgress;
      element.innerHTML = `${current.toFixed(1)}<span class="percent-sign">%</span>`;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  /* ==========================================================================
     6. Print & Copy Actions
     ========================================================================== */
  if (printReportBtn) {
    printReportBtn.addEventListener("click", () => {
      window.print();
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener("click", () => {
      if (!currentPredictionData) {
        showToast("No assessment available to copy", "info");
        return;
      }
      navigator.clipboard.writeText(JSON.stringify(currentPredictionData, null, 2))
        .then(() => showToast("Assessment report copied to clipboard", "success"))
        .catch(() => showToast("Failed to copy report", "error"));
    });
  }

  /* ==========================================================================
     7. Modal Specifications Logic
     ========================================================================== */
  function openModal() {
    if (infoModal) infoModal.classList.remove("hidden");
  }

  function closeModal() {
    if (infoModal) infoModal.classList.add("hidden");
  }

  if (openInfoModalBtn) openInfoModalBtn.addEventListener("click", openModal);
  if (closeInfoModalBtn) closeInfoModalBtn.addEventListener("click", closeModal);
  if (closeInfoModalBtn2) closeInfoModalBtn2.addEventListener("click", closeModal);

  if (infoModal) {
    infoModal.addEventListener("click", (e) => {
      if (e.target === infoModal) closeModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && infoModal && !infoModal.classList.contains("hidden")) {
      closeModal();
    }
  });

  /* ==========================================================================
     8. Fetch Model Metadata & Feature Importance
     ========================================================================== */
  async function loadModelSpecs() {
    try {
      const res = await fetch("/api/info");
      if (!res.ok) return;
      const meta = await res.json();
      modelMetadata = meta;

      if (meta.metrics) {
        const accEl = document.getElementById("modalAccuracy");
        const rocEl = document.getElementById("modalRoc");
        const cvEl = document.getElementById("modalCv");
        if (accEl && meta.metrics.accuracy) accEl.textContent = `${(meta.metrics.accuracy * 100).toFixed(2)}%`;
        if (rocEl && meta.metrics.roc_auc) rocEl.textContent = `${(meta.metrics.roc_auc * 100).toFixed(2)}%`;
        if (cvEl && meta.metrics.cv_mean) cvEl.textContent = `${(meta.metrics.cv_mean * 100).toFixed(2)}%`;
      }

      // Feature Importance Bars
      const barsContainer = document.getElementById("featureImportanceBars");
      if (barsContainer && meta.feature_importances) {
        barsContainer.innerHTML = "";
        const entries = Object.entries(meta.feature_importances);
        const maxVal = entries[0] ? entries[0][1] : 1;

        const descriptions = {
          cp: "Chest Pain Classification",
          ca: "Fluoroscopy Vessel Calcification",
          thal: "Thallium Perfusion Scintigraphy",
          oldpeak: "Exercise ST Depression",
          thalach: "Peak Heart Rate Achieved",
          age: "Patient Age (years)",
          exang: "Exercise Induced Angina",
          trestbps: "Resting Blood Pressure",
          chol: "Serum Cholesterol",
          slope: "ST Segment Slope",
          sex: "Biological Sex",
          restecg: "Resting Electrocardiogram",
          fbs: "Fasting Blood Sugar > 120"
        };

        entries.forEach(([feat, imp]) => {
          const pctWidth = Math.round((imp / maxVal) * 100);
          const featLabel = `${feat} (${descriptions[feat] || feat})`;

          const row = document.createElement("div");
          row.className = "bar-row";
          row.innerHTML = `
            <span class="feat-name" title="${featLabel}">${featLabel}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pctWidth}%;"></div>
            </div>
            <span class="feat-val">${(imp * 100).toFixed(1)}%</span>
          `;
          barsContainer.appendChild(row);
        });
      }
    } catch (err) {
      console.warn("Could not load initial metadata:", err);
    }
  }

  loadModelSpecs();

  /* ==========================================================================
     9. Toast Notification Utility
     ========================================================================== */
  function showToast(msg, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const iconName = type === "success" ? "check-circle" : type === "error" ? "alert-circle" : "info";
    toast.innerHTML = `<i data-lucide="${iconName}"></i><span>${msg}</span>`;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
});
