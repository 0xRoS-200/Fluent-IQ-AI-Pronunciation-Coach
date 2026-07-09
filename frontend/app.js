/* ============================================================
   FluentIQ — Frontend Application with GSAP Animations
   ============================================================
   Award-winning UX with:
     - GSAP-powered staggered reveal animations
     - Audio waveform visualizations (hero, upload, recording)
     - Neon-glow score gauge animation
     - Magnetic button hover effects
     - Smooth 120fps transitions via will-change & transforms
     - Interactive word chips with animated tooltips
   ============================================================ */

(function () {
    "use strict";

    // ------------------------------------------------------------------
    // DOM references
    // ------------------------------------------------------------------
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const consentModal     = $("#consentModal");
    const modalContent     = $("#modalContent");
    const consentCheckbox  = $("#consentCheckbox");
    const consentBtn       = $("#consentBtn");
    const appContainer     = $("#appContainer");

    const uploadZone       = $("#uploadZone");
    const fileInput        = $("#fileInput");
    const fileInfo         = $("#fileInfo");
    const fileName         = $("#fileName");
    const fileMeta         = $("#fileMeta");
    const fileRemove       = $("#fileRemove");

    const recordBtn        = $("#recordBtn");
    const recordTimer      = $("#recordTimer");
    const recordHint       = $("#recordHint");
    const recordWaveform   = $("#recordWaveform");

    const analyzeBtn       = $("#analyzeBtn");
    const analyzeSection   = $("#analyzeSection");
    const inputSection     = $("#inputSection");
    const loadingSection   = $("#loadingSection");
    const resultsSection   = $("#resultsSection");
    const tryAgainBtn      = $("#tryAgainBtn");

    const errorAlert       = $("#errorAlert");
    const errorText        = $("#errorText");
    const errorClose       = $("#errorClose");

    const themeToggleBtn   = $("#themeToggle");

    // ------------------------------------------------------------------
    // Theme Toggle Logic
    // ------------------------------------------------------------------
    const initTheme = () => {
        const savedTheme = localStorage.getItem("theme") || "dark";
        document.documentElement.setAttribute("data-theme", savedTheme);
        themeToggleBtn.textContent = savedTheme === "light" ? "🌙" : "☀️";
    };
    initTheme();

    themeToggleBtn.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
        themeToggleBtn.textContent = newTheme === "light" ? "🌙" : "☀️";
        
        // Redraw score gauge to pick up new theme colors if active
        const scoreNumEl = $("#scoreNumber");
        if (scoreNumEl && scoreNumEl.textContent !== "0" && resultsSection.classList.contains("visible")) {
            const overallScore = parseInt(scoreNumEl.textContent);
            animateScore(overallScore);
        }
    });

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------
    let selectedFile  = null;
    let mediaRecorder = null;
    let audioChunks   = [];
    let recordingInterval = null;
    let recordingSeconds  = 0;
    let isRecording       = false;
    let waveTimeline      = null;
    let recordWaveTl      = null;

    const MIN_DURATION = 30;
    const MAX_DURATION = 45;

    // ------------------------------------------------------------------
    // GSAP — Wait for library to load then init animations
    // ------------------------------------------------------------------
    function waitForGSAP(cb) {
        if (typeof gsap !== "undefined") return cb();
        const check = setInterval(() => {
            if (typeof gsap !== "undefined") { clearInterval(check); cb(); }
        }, 50);
    }

    waitForGSAP(() => {
        initConsentAnimation();
        generateWaveformBars();
    });

    // ------------------------------------------------------------------
    // CONSENT MODAL — GSAP entrance animation
    // ------------------------------------------------------------------
    function initConsentAnimation() {
        gsap.to(modalContent, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.7,
            ease: "back.out(1.5)",
            delay: 0.2,
        });

        // Stagger the list items
        gsap.from(".consent-list li", {
            opacity: 0,
            x: -15,
            duration: 0.4,
            stagger: 0.08,
            delay: 0.5,
            ease: "power2.out",
        });
    }

    consentCheckbox.addEventListener("change", () => {
        consentBtn.disabled = !consentCheckbox.checked;
        if (consentCheckbox.checked) {
            gsap.fromTo(consentBtn, { scale: 0.95 }, { scale: 1, duration: 0.3, ease: "back.out(2)" });
        }
    });

    consentBtn.addEventListener("click", () => {
        // Animate modal out
        gsap.to(modalContent, {
            opacity: 0, y: -20, scale: 0.95,
            duration: 0.35, ease: "power2.in",
            onComplete: () => {
                consentModal.classList.add("hidden");
                showApp();
            },
        });
    });

    function showApp() {
        appContainer.style.display = "block";

        // Master timeline for app entrance
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        tl.fromTo("#appHeader", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7 })
          .fromTo("#heroWaveform", { opacity: 0 }, { opacity: 1, duration: 0.5 }, "-=0.3")
          .add(() => startHeroWaveform(), "-=0.3")
          .fromTo("#uploadCard", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6 }, "-=0.3")
          .fromTo("#analyzeSection", { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.4 }, "-=0.2");
    }

    // ------------------------------------------------------------------
    // WAVEFORM GENERATORS
    // ------------------------------------------------------------------
    function generateWaveformBars() {
        // Hero waveform — 50 bars
        const heroWf = $("#heroWaveform");
        for (let i = 0; i < 50; i++) {
            const bar = document.createElement("div");
            bar.className = "wave-bar";
            heroWf.appendChild(bar);
        }

        // Upload zone waveform — 35 bars
        const uploadWf = $("#uploadWaveform");
        for (let i = 0; i < 35; i++) {
            const bar = document.createElement("div");
            bar.className = "wave-bar";
            uploadWf.appendChild(bar);
        }

        // Record waveform — 30 bars
        for (let i = 0; i < 30; i++) {
            const bar = document.createElement("div");
            bar.className = "wave-bar";
            recordWaveform.appendChild(bar);
        }
    }

    function startHeroWaveform() {
        const bars = $$("#heroWaveform .wave-bar");
        if (!bars.length) return;

        // Continuous wave animation with GSAP
        waveTimeline = gsap.timeline({ repeat: -1, yoyo: true });

        bars.forEach((bar, i) => {
            const delay = i * 0.03;
            const scaleY = 0.15 + Math.sin(i * 0.3) * 0.5 + Math.random() * 0.35;

            gsap.set(bar, { scaleY: 0.1 });

            waveTimeline.to(bar, {
                scaleY: scaleY,
                opacity: 0.4 + Math.random() * 0.5,
                duration: 0.6 + Math.random() * 0.4,
                ease: "sine.inOut",
            }, delay);
        });

        // Also animate colors subtly
        gsap.to("#heroWaveform .wave-bar", {
            background: "linear-gradient(to top, var(--neon-cyan), var(--neon-magenta))",
            duration: 3,
            stagger: { amount: 1, repeat: -1, yoyo: true },
            ease: "sine.inOut",
        });
    }

    function startRecordWaveform() {
        const bars = $$("#recordWaveform .wave-bar");
        recordWaveform.classList.add("active");

        recordWaveTl = gsap.timeline({ repeat: -1 });

        bars.forEach((bar, i) => {
            gsap.set(bar, { scaleY: 0.1 });

            recordWaveTl.to(bar, {
                scaleY: () => 0.1 + Math.random() * 0.8,
                duration: 0.15,
                ease: "power1.out",
                yoyo: true,
                repeat: 1,
            }, i * 0.04);
        });
    }

    function stopRecordWaveform() {
        recordWaveform.classList.remove("active");
        if (recordWaveTl) { recordWaveTl.kill(); recordWaveTl = null; }
        gsap.to($$("#recordWaveform .wave-bar"), { scaleY: 0.1, duration: 0.3 });
    }

    // ------------------------------------------------------------------
    // MAGNETIC BUTTON EFFECT
    // ------------------------------------------------------------------
    function addMagneticEffect(el) {
        el.addEventListener("mousemove", (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            gsap.to(el, { x: x * 0.15, y: y * 0.15, duration: 0.3, ease: "power2.out" });
        });
        el.addEventListener("mouseleave", () => {
            gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.5)" });
        });
    }

    // Apply magnetic effect to primary buttons
    waitForGSAP(() => {
        addMagneticEffect(consentBtn);
        addMagneticEffect(analyzeBtn);
        addMagneticEffect(recordBtn);
    });

    // ------------------------------------------------------------------
    // UPLOAD — Drag & Drop with GSAP animations
    // ------------------------------------------------------------------
    uploadZone.addEventListener("click", () => fileInput.click());

    uploadZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadZone.classList.add("drag-over");
        gsap.to(uploadZone, { scale: 1.02, duration: 0.3, ease: "power2.out" });
    });

    uploadZone.addEventListener("dragleave", () => {
        uploadZone.classList.remove("drag-over");
        gsap.to(uploadZone, { scale: 1, duration: 0.3, ease: "power2.out" });
    });

    uploadZone.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadZone.classList.remove("drag-over");
        gsap.to(uploadZone, { scale: 1, duration: 0.3, ease: "back.out(2)" });
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFileSelect(files[0]);
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
    });

    fileRemove.addEventListener("click", clearFile);

    function handleFileSelect(file) {
        if (!file.type.startsWith("audio/")) {
            showError("Please select an audio file (WAV, MP3, WebM, M4A, OGG).");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            showError("File is too large. Maximum size is 10 MB.");
            return;
        }

        validateAudioDuration(file).then((duration) => {
            if (duration < MIN_DURATION) {
                showError(`Audio too short (${duration.toFixed(1)}s). Minimum is ${MIN_DURATION}s.`);
                return;
            }
            if (duration > MAX_DURATION) {
                showError(`Audio too long (${duration.toFixed(1)}s). Maximum is ${MAX_DURATION}s.`);
                return;
            }
            setFile(file, duration);
        }).catch(() => {
            setFile(file, null);
        });
    }

    function setFile(file, duration) {
        selectedFile = file;
        fileName.textContent = file.name;
        fileMeta.textContent = duration
            ? `${(file.size / 1024).toFixed(0)} KB · ${duration.toFixed(1)}s`
            : `${(file.size / 1024).toFixed(0)} KB`;
        fileInfo.classList.add("visible");
        analyzeBtn.disabled = false;
        hideError();

        // Animate file info entrance
        waitForGSAP(() => {
            gsap.fromTo(fileInfo, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: "back.out(2)" });
            gsap.fromTo(analyzeBtn, { scale: 0.95 }, { scale: 1, duration: 0.3, ease: "back.out(3)" });
        });
    }

    function validateAudioDuration(file) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.addEventListener("loadedmetadata", () => {
                if (isFinite(audio.duration)) resolve(audio.duration);
                else reject();
                URL.revokeObjectURL(audio.src);
            });
            audio.addEventListener("error", () => reject());
            audio.src = URL.createObjectURL(file);
        });
    }

    function clearFile() {
        selectedFile = null;
        fileInput.value = "";
        fileInfo.classList.remove("visible");
        analyzeBtn.disabled = true;
    }

    // ------------------------------------------------------------------
    // RECORDING with animated waveform
    // ------------------------------------------------------------------
    recordBtn.addEventListener("click", toggleRecording);

    async function toggleRecording() {
        if (isRecording) stopRecording();
        else await startRecording();
    }

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus" : "audio/webm";

            mediaRecorder = new MediaRecorder(stream, { mimeType });
            audioChunks = [];
            recordingSeconds = 0;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                stream.getTracks().forEach((t) => t.stop());
                const blob = new Blob(audioChunks, { type: mimeType });
                const file = new File([blob], "recording.webm", { type: mimeType });
                handleFileSelect(file);
            };

            mediaRecorder.start(250);
            isRecording = true;
            recordBtn.classList.add("recording");
            recordBtn.innerHTML = "■ Stop Recording";
            recordTimer.classList.add("active");
            recordHint.textContent = `Min ${MIN_DURATION}s · auto-stops at ${MAX_DURATION}s`;

            clearFile();
            startRecordWaveform();

            recordingInterval = setInterval(() => {
                recordingSeconds++;
                const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, "0");
                const secs = String(recordingSeconds % 60).padStart(2, "0");
                recordTimer.textContent = `${mins}:${secs}`;

                if (recordingSeconds >= MAX_DURATION) stopRecording();
            }, 1000);

        } catch (err) {
            if (err.name === "NotAllowedError") {
                showError("Microphone access denied. Please allow mic access in your browser.");
            } else {
                showError("Could not access microphone. Check your device settings.");
            }
        }
    }

    function stopRecording() {
        if (!mediaRecorder || mediaRecorder.state === "inactive") return;

        if (recordingSeconds < MIN_DURATION) {
            showError(`Recording too short (${recordingSeconds}s). Minimum is ${MIN_DURATION}s.`);
            mediaRecorder.stop();
            resetRecordingUI();
            audioChunks = [];
            return;
        }

        mediaRecorder.stop();
        resetRecordingUI();
    }

    function resetRecordingUI() {
        isRecording = false;
        clearInterval(recordingInterval);
        recordBtn.classList.remove("recording");
        recordBtn.innerHTML = "● Start Recording";
        recordTimer.classList.remove("active");
        recordTimer.textContent = "00:00";
        recordHint.textContent = `Auto-stops at ${MAX_DURATION} seconds`;
        stopRecordWaveform();
    }

    // ------------------------------------------------------------------
    // ANALYZE — with animated loading steps
    // ------------------------------------------------------------------
    analyzeBtn.addEventListener("click", runAnalysis);

    async function runAnalysis() {
        if (!selectedFile) return;

        // Transition to loading with GSAP
        waitForGSAP(() => {
            gsap.to(inputSection, {
                opacity: 0, y: -20, duration: 0.4, ease: "power2.in",
                onComplete: () => {
                    inputSection.style.display = "none";
                    resultsSection.classList.remove("visible");
                    loadingSection.classList.add("visible");
                    gsap.fromTo(loadingSection, { opacity: 0 }, { opacity: 1, duration: 0.4 });
                },
            });
        });

        hideError();
        animateLoadingSteps();

        const formData = new FormData();
        formData.append("audio", selectedFile);

        try {
            const response = await fetch("/api/analyze", { method: "POST", body: formData });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ detail: "Analysis failed." }));
                throw new Error(err.detail || `Server error (${response.status})`);
            }

            const result = await response.json();
            renderResults(result);

        } catch (err) {
            loadingSection.classList.remove("visible");
            inputSection.style.display = "block";
            gsap.fromTo(inputSection, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 });
            showError(err.message || "An unexpected error occurred. Please try again.");
        }
    }

    function animateLoadingSteps() {
        const steps = [$("#step1"), $("#step2"), $("#step3"), $("#step4")];
        const delays = [0, 2000, 5000, 8000];
        steps.forEach((s) => (s.className = ""));
        steps[0].className = "active";

        delays.forEach((delay, i) => {
            if (i === 0) return;
            setTimeout(() => {
                steps[i - 1].className = "done";
                steps[i].className = "active";
            }, delay);
        });
    }

    // ------------------------------------------------------------------
    // RENDER RESULTS — with staggered GSAP animations
    // ------------------------------------------------------------------
    function renderResults(data) {
        loadingSection.classList.remove("visible");
        resultsSection.classList.add("visible");
        window.scrollTo({ top: 0, behavior: "smooth" });

        waitForGSAP(() => {
            // Staggered entrance for result cards
            const cards = ["#scoreCard", "#summaryCard", "#feedbackGrid", "#transcriptCard", "#wordDetails"];
            gsap.fromTo(cards, { opacity: 0, y: 30 }, {
                opacity: 1, y: 0, duration: 0.6,
                stagger: 0.12, ease: "power3.out", delay: 0.1,
            });
        });

        // --- Animate Score Gauge ---
        animateScore(data.overall_score);

        // --- Sub-scores ---
        const avgWord = data.words.length
            ? Math.round(data.words.reduce((s, w) => s + w.score, 0) / data.words.length)
            : 0;
        animateCounter($("#wordScore"), avgWord);
        animateCounter($("#fluencyScore"), data.fluency_score);
        animateCounter($("#completenessScore"), data.completeness_score);

        // --- Summary ---
        $("#summaryText").textContent = data.summary || "Analysis complete.";

        // --- Strengths ---
        const strengthsList = $("#strengthsList");
        strengthsList.innerHTML = "";
        (data.strengths || []).forEach((s) => {
            const li = document.createElement("li");
            li.textContent = s;
            strengthsList.appendChild(li);
        });

        // --- Tips ---
        const tipsList = $("#tipsList");
        tipsList.innerHTML = "";
        (data.tips || []).forEach((t) => {
            const li = document.createElement("li");
            li.textContent = t;
            tipsList.appendChild(li);
        });

        // --- Transcript Words with staggered animation ---
        const wordsContainer = $("#transcriptWords");
        wordsContainer.innerHTML = "";

        data.words.forEach((w) => {
            const chip = document.createElement("span");
            chip.className = `word-chip ${w.rating}`;
            chip.textContent = w.word;

            if (w.rating !== "good" && (w.feedback || w.issue_type)) {
                const tooltip = document.createElement("div");
                tooltip.className = "word-tooltip";
                tooltip.innerHTML = buildTooltipHTML(w);
                chip.appendChild(tooltip);

                chip.addEventListener("click", (e) => {
                    e.stopPropagation();
                    $$(".word-chip.tooltip-active").forEach((c) => {
                        if (c !== chip) c.classList.remove("tooltip-active");
                    });
                    chip.classList.toggle("tooltip-active");
                });
            }

            wordsContainer.appendChild(chip);
        });

        // Stagger word chips entrance
        waitForGSAP(() => {
            gsap.fromTo(".word-chip", { opacity: 0, y: 10, scale: 0.9 }, {
                opacity: 1, y: 0, scale: 1, duration: 0.3,
                stagger: 0.02, ease: "back.out(2)", delay: 0.6,
            });
        });

        // Close tooltips on outside click
        document.addEventListener("click", () => {
            $$(".word-chip.tooltip-active").forEach((c) => c.classList.remove("tooltip-active"));
        });

        // --- Word Detail Cards ---
        const flagged = data.words.filter((w) => w.rating !== "good" && (w.feedback || w.issue_type));
        const detailsList = $("#wordDetailsList");
        detailsList.innerHTML = "";

        if (flagged.length === 0) {
            $("#wordDetails").style.display = "none";
        } else {
            $("#wordDetails").style.display = "block";
            flagged.forEach((w) => {
                const item = document.createElement("div");
                item.className = "word-detail-item";
                item.innerHTML = `
                    <div class="word-detail-header">
                        <span class="word-detail-word">"${escapeHtml(w.word)}"</span>
                        <span class="word-detail-badge ${w.rating}">
                            ${escapeHtml(w.issue_type || w.rating)} · ${w.score}/100
                        </span>
                    </div>
                    <p class="word-detail-feedback">${escapeHtml(w.feedback || "Try pronouncing this word more clearly.")}</p>
                    ${w.phonemes && w.phonemes.arpabet
                        ? `<p class="word-detail-phoneme">Expected phonemes: /${escapeHtml(w.phonemes.arpabet)}/</p>`
                        : ""}
                `;
                detailsList.appendChild(item);
            });

            // Stagger detail cards
            waitForGSAP(() => {
                gsap.fromTo(".word-detail-item", { opacity: 0, x: -20 }, {
                    opacity: 1, x: 0, duration: 0.4,
                    stagger: 0.08, ease: "power2.out", delay: 0.8,
                });
            });
        }
    }

    function buildTooltipHTML(w) {
        let html = `
            <div class="tooltip-header">
                <span class="tooltip-word">${escapeHtml(w.word)}</span>
                <span class="tooltip-score ${w.rating}">${w.score}/100</span>
            </div>`;
        if (w.issue_type) html += `<div class="tooltip-type">${escapeHtml(w.issue_type)}</div>`;
        if (w.feedback) html += `<p class="tooltip-feedback">${escapeHtml(w.feedback)}</p>`;
        if (w.phonemes && w.phonemes.arpabet) {
            html += `<div class="tooltip-phonemes">Phonemes: /${escapeHtml(w.phonemes.arpabet)}/</div>`;
        }
        return html;
    }

    // ------------------------------------------------------------------
    // SCORE GAUGE — neon glow animation
    // ------------------------------------------------------------------
    function animateScore(targetScore) {
        const gaugeFill = $("#gaugeFill");
        const gaugeGlow = $("#gaugeGlow");
        const numberEl = $("#scoreNumber");
        const circumference = 2 * Math.PI * 85; // r=85

        // Color based on score
        let color;
        if (targetScore >= 80) color = "var(--glow-success)";
        else if (targetScore >= 50) color = "var(--glow-warning)";
        else color = "var(--glow-error)";

        gaugeFill.style.stroke = color;
        gaugeGlow.style.stroke = color;
        numberEl.style.color = color;
        numberEl.style.textShadow = `0 0 30px ${color === "var(--glow-success)" ? "rgba(0,255,163,0.3)" : color === "var(--glow-warning)" ? "rgba(255,187,0,0.3)" : "rgba(255,61,113,0.3)"}`;

        const offset = circumference - (targetScore / 100) * circumference;

        waitForGSAP(() => {
            gsap.to(gaugeFill, {
                attr: { "stroke-dashoffset": offset },
                duration: 2,
                ease: "power3.out",
                delay: 0.3,
            });
            gsap.to(gaugeGlow, {
                attr: { "stroke-dashoffset": offset },
                duration: 2,
                ease: "power3.out",
                delay: 0.35,
            });
        });

        animateCounter(numberEl, targetScore);
    }

    function animateCounter(el, target) {
        waitForGSAP(() => {
            gsap.fromTo(el, { innerText: 0 }, {
                innerText: target,
                duration: 1.5,
                ease: "power2.out",
                snap: { innerText: 1 },
                delay: 0.3,
            });
        });
    }

    // ------------------------------------------------------------------
    // TRY AGAIN
    // ------------------------------------------------------------------
    tryAgainBtn.addEventListener("click", () => {
        waitForGSAP(() => {
            gsap.to(resultsSection, {
                opacity: 0, y: -20, duration: 0.4,
                onComplete: () => {
                    resultsSection.classList.remove("visible");
                    resultsSection.style.opacity = "";
                    resultsSection.style.transform = "";
                    inputSection.style.display = "block";
                    gsap.fromTo(inputSection, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 });
                    clearFile();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                },
            });
        });
    });

    // ------------------------------------------------------------------
    // ERROR HANDLING with animation
    // ------------------------------------------------------------------
    function showError(msg) {
        errorText.textContent = msg;
        errorAlert.classList.add("visible");
        waitForGSAP(() => {
            gsap.fromTo(errorAlert, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.35, ease: "back.out(2)" });
        });
    }

    function hideError() {
        errorAlert.classList.remove("visible");
    }

    errorClose.addEventListener("click", hideError);

    // ------------------------------------------------------------------
    // HELPERS
    // ------------------------------------------------------------------
    function escapeHtml(str) {
        const div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

})();
