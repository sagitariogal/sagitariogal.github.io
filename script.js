// ---------------------------------------------------------------------
// Tab navigation
// ---------------------------------------------------------------------
(function setupTabs() {
    const tabs = document.querySelectorAll(".nav-btn[data-tab]");
    const panels = document.querySelectorAll(".panel");

    function activate(tabName) {
        tabs.forEach((btn) => {
            const isActive = btn.dataset.tab === tabName;
            btn.classList.toggle("is-active", isActive);
            btn.setAttribute("aria-selected", String(isActive));
        });
        panels.forEach((panel) => {
            const isActive = panel.id === `panel-${tabName}`;
            panel.classList.toggle("is-active", isActive);
            panel.hidden = !isActive;
        });
        if (history.replaceState) {
            history.replaceState(null, "", `#${tabName}`);
        }
    }

    tabs.forEach((btn) => {
        btn.addEventListener("click", () => activate(btn.dataset.tab));
    });

    // In-content links
    document.querySelectorAll("[data-tab-link]").forEach((el) => {
        el.addEventListener("click", (e) => {
            e.preventDefault();
            activate(el.dataset.tabLink);
        });
    });

    const initial = window.location.hash.replace("#", "");
    const validTabs = Array.from(tabs).map((b) => b.dataset.tab);
    activate(validTabs.includes(initial) ? initial : "about");
})();

// ---------------------------------------------------------------------
// Portfolio: 3 continuously auto-scrolling marquees
// ---------------------------------------------------------------------
(function setupPortfolio() {
    const PORTFOLIO_JSON = "assets/art/portfolio/portfolio.json";
    const ROW_COUNT = 3;
    const ROW_DIRECTIONS = [-1, 1, -1]; // -1 = right-to-left, 1 = left-to-right, at pos speed
    const SPEED_STEP = 0.5;
    const MAX_SPEED = 3;
    const MIN_SPEED = -3;
    const DEFAULT_SPEED = 1;
    const PX_PER_SPEED_UNIT = 1; // px moved per frame, per unit of speed

    const container = document.getElementById("portfolio-rows");
    if (!container) return;

    const flowStatus = document.getElementById("portfolio-flow-status");
    const flowLeft = document.querySelector(".portfolio-flow-arrow.flow-left");
    const flowRight = document.querySelector(".portfolio-flow-arrow.flow-right");

    const modal = document.getElementById("portfolio-modal");
    const imgEl = document.getElementById("portfolio-img");
    const descEl = document.getElementById("portfolio-desc");
    const subEl = document.getElementById("portfolio-sub");
    const statusEl = document.getElementById("portfolio-status");
    const closeBtn = document.getElementById("portfolio-close");
    const prevBtn = modal ? modal.querySelector(".portfolio-prev") : null;
    const nextBtn = modal ? modal.querySelector(".portfolio-next") : null;
    const panel = modal ? modal.querySelector(".samples-modal") : null;

    let items = []; // master list, in JSON order
    let current = [];
    let index = 0;
    let speed = DEFAULT_SPEED;
    let modalOpen = false;
    const rows = []; // { track, offset, singleWidth, dir }

    function imgPath(item) {
        return `assets/art/portfolio/${encodeURIComponent(item.filename)}`;
    }

    function formatDate(dateStr) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }

    // ---- Row construction (index-shifted magazine layout) -------------------

    function rotated(offset) {
        return items.slice(offset).concat(items.slice(0, offset));
    }

    function renderRows() {
        container.innerHTML = "";
        rows.length = 0;

        for (let r = 0; r < ROW_COUNT; r++) {
            const offset = Math.floor((r * items.length) / ROW_COUNT);
            const order = rotated(offset);
            // Duplicated so the track can scroll seamlessly in either
            // direction and wrap without a visible jump
            const doubled = order.concat(order);

            const rowEl = document.createElement("div");
            rowEl.className = "portfolio-marquee-row";

            const track = document.createElement("div");
            track.className = "portfolio-marquee-track";

            doubled.forEach((item) => {
                const masterIndex = items.indexOf(item);
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "portfolio-thumb-btn";
                btn.innerHTML = `<img src="${imgPath(item)}" alt="${item.description || item.id}" loading="lazy" />`;
                btn.addEventListener("click", () => openModal(masterIndex));
                track.appendChild(btn);
            });

            const rowState = { track, offset: 0, singleWidth: 0, dir: ROW_DIRECTIONS[r], hovering: false };
            rowEl.addEventListener("mouseenter", () => {
                rowState.hovering = true;
            });
            rowEl.addEventListener("mouseleave", () => {
                rowState.hovering = false;
            });

            rowEl.appendChild(track);
            container.appendChild(rowEl);
            rows.push(rowState);
        }

        // Measure once every image has a real size, then start the loop
        const allImgs = container.querySelectorAll("img");
        Promise.all(
            Array.from(allImgs).map(
                (img) =>
                    new Promise((resolve) => {
                        if (img.complete) resolve();
                        else {
                            img.addEventListener("load", resolve, { once: true });
                            img.addEventListener("error", resolve, { once: true });
                        }
                    })
            )
        ).then(() => {
            rows.forEach((row) => {
                row.singleWidth = row.track.scrollWidth / 2;
            });
            requestAnimationFrame(tick);
        });
    }

    // ---- Continuous animation -------------------------------------------------

    function tick() {
        if (!modalOpen && speed !== 0) {
            rows.forEach((row) => {
                if (!row.singleWidth || row.hovering) return;
                row.offset += row.dir * speed * PX_PER_SPEED_UNIT;
                if (row.offset <= -row.singleWidth) row.offset += row.singleWidth;
                else if (row.offset > 0) row.offset -= row.singleWidth;
                row.track.style.transform = `translateX(${row.offset}px)`;
            });
        }
        requestAnimationFrame(tick);
    }

    function updateFlowStatus() {
        if (flowLeft) flowLeft.classList.toggle("is-flow-active", speed < 0);
        if (flowRight) flowRight.classList.toggle("is-flow-active", speed > 0);
        if (!flowStatus) return;
        if (speed === 0) {
            flowStatus.textContent = "Paused";
            return;
        }
        const intensity = Math.abs(speed);
        let word;
        if (intensity <= 1) word = "Drifting";
        else if (intensity <= 2) word = "Cruising";
        else word = "Zooming";
        flowStatus.textContent = word;
    }

    if (flowLeft) {
        flowLeft.addEventListener("click", () => {
            speed = Math.max(MIN_SPEED, speed - SPEED_STEP);
            updateFlowStatus();
        });
    }
    if (flowRight) {
        flowRight.addEventListener("click", () => {
            speed = Math.min(MAX_SPEED, speed + SPEED_STEP);
            updateFlowStatus();
        });
    }
    updateFlowStatus();

    // ---- Detail modal ---------------------------------------------------------

    function render() {
        if (!current.length) return;
        const item = current[index];
        imgEl.src = imgPath(item);
        imgEl.alt = item.description || item.id;
        statusEl.textContent = `${index + 1} / ${current.length}`;

        if (item.description) {
            descEl.textContent = item.description;
            descEl.hidden = false;
        } else {
            descEl.hidden = true;
        }

        const subParts = [item.category, formatDate(item.date)].filter(Boolean);
        if (subParts.length) {
            subEl.textContent = subParts.join(" \u00b7 ");
            subEl.hidden = false;
        } else {
            subEl.hidden = true;
        }

        const multi = current.length > 1;
        prevBtn.hidden = !multi;
        nextBtn.hidden = !multi;
    }

    function setExpanded(expanded) {
        if (panel) panel.classList.toggle("is-expanded", expanded);
    }

    function openModal(masterIndex) {
        current = items;
        index = masterIndex;
        setExpanded(false);
        render();
        modal.hidden = false;
        modalOpen = true;
    }

    function closeModal() {
        modal.hidden = true;
        imgEl.src = "";
        setExpanded(false);
        modalOpen = false;
    }

    if (modal) {
        imgEl.addEventListener("click", () => {
            if (!current.length) return;
            setExpanded(!panel.classList.contains("is-expanded"));
        });
        closeBtn.addEventListener("click", closeModal);
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });
        document.addEventListener("keydown", (e) => {
            if (modal.hidden) return;
            if (e.key === "Escape") closeModal();
            if (e.key === "ArrowLeft") prevBtn.click();
            if (e.key === "ArrowRight") nextBtn.click();
        });
        prevBtn.addEventListener("click", () => {
            if (!current.length) return;
            index = (index - 1 + current.length) % current.length;
            render();
        });
        nextBtn.addEventListener("click", () => {
            if (!current.length) return;
            index = (index + 1) % current.length;
            render();
        });
    }

    // ---- Load data -------------------------------------------------------------

    fetch(PORTFOLIO_JSON)
        .then((res) => {
            if (!res.ok) throw new Error("Failed to load portfolio.json");
            return res.json();
        })
        .then((data) => {
            items = (Array.isArray(data) ? data : []).filter((item) => item && item.id && item.filename);
            if (!items.length) {
                container.innerHTML = `<p class="art-loading">Check back soon!</p>`;
                return;
            }
            renderRows();
        })
        .catch((err) => {
            console.warn(err);
            container.innerHTML = `<p class="art-loading">Check back soon!</p>`;
        });
})();

// ---------------------------------------------------------------------
// Commission samples carousel
// ---------------------------------------------------------------------
(function setupCommissionSamples() {
    const SAMPLES_JSON = "assets/art/commission_samples/commissions.json";
    const overlay = document.getElementById("samples-modal");
    const buttons = document.querySelectorAll(".samples-btn");

    if (!overlay || !buttons.length) return;

    const imgEl = document.getElementById("samples-img");
    const titleEl = document.getElementById("samples-title");
    const statusEl = document.getElementById("samples-status");
    const closeBtn = document.getElementById("samples-close");
    const prevBtn = overlay.querySelector(".samples-prev");
    const nextBtn = overlay.querySelector(".samples-next");
    const panel = overlay.querySelector(".samples-modal");

    let byCategory = null; // filled once the JSON loads
    let current = [];
    let index = 0;

    function samplePath(item) {
        return `assets/art/commission_samples/${encodeURIComponent(item.category)}/${encodeURIComponent(item.filename)}`;
    }

    function setExpanded(expanded) {
        panel.classList.toggle("is-expanded", expanded);
    }

    function render() {
        if (!current.length) return;
        const item = current[index];
        imgEl.src = samplePath(item);
        imgEl.alt = `${item.category} sample ${index + 1}`;
        statusEl.textContent = `${index + 1} / ${current.length}`;
        const multi = current.length > 1;
        prevBtn.hidden = !multi;
        nextBtn.hidden = !multi;
    }

    function open(category) {
        current = (byCategory && byCategory[category]) || [];
        index = 0;
        titleEl.textContent = category;
        setExpanded(false);
        if (!current.length) {
            imgEl.src = "";
            imgEl.alt = "";
            statusEl.textContent = "Coming soon!";
            prevBtn.hidden = true;
            nextBtn.hidden = true;
        } else {
            render();
        }
        overlay.hidden = false;
    }

    function close() {
        overlay.hidden = true;
        imgEl.src = "";
        setExpanded(false);
    }

    imgEl.addEventListener("click", () => {
        if (!current.length) return;
        setExpanded(!panel.classList.contains("is-expanded"));
    });

    buttons.forEach((btn) => {
        btn.addEventListener("click", () => open(btn.dataset.category));
    });

    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
    });
    document.addEventListener("keydown", (e) => {
        if (overlay.hidden) return;
        if (e.key === "Escape") close();
        if (e.key === "ArrowLeft") prevBtn.click();
        if (e.key === "ArrowRight") nextBtn.click();
    });

    prevBtn.addEventListener("click", () => {
        if (!current.length) return;
        index = (index - 1 + current.length) % current.length;
        render();
    });
    nextBtn.addEventListener("click", () => {
        if (!current.length) return;
        index = (index + 1) % current.length;
        render();
    });

    fetch(SAMPLES_JSON)
        .then((res) => {
            if (!res.ok) throw new Error("Failed to load commissions.json");
            return res.json();
        })
        .then((data) => {
            byCategory = {};
            data.forEach((item) => {
                if (!byCategory[item.category]) byCategory[item.category] = [];
                byCategory[item.category].push(item);
            });
        })
        .catch((err) => console.warn(err));
})();
