const $ = (sel, root = document) => root.querySelector(sel);

const GRADIENTS = [
  ["#00b4d8", "#48cae4"],
  ["#0096c7", "#90e0ef"],
  ["#48cae4", "#ffd166"],
  ["#0077b6", "#00b4d8"],
  ["#ffb703", "#ffd166"],
  ["#fb8500", "#ffb703"],
  ["#06d6a0", "#48cae4"],
  ["#118ab2", "#073b4c"],
  ["#ef476f", "#ffd166"],
  ["#8338ec", "#48cae4"]
];

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hashId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function gradientFor(id) {
  const [a, b] = GRADIENTS[hashId(id) % GRADIENTS.length];
  return `linear-gradient(180deg, ${a} 0%, ${b} 100%)`;
}

function buildMailto({ emails, subject, body }) {
  const to = emails.filter(Boolean).join(",");
  const params = new URLSearchParams({ subject, body });
  return `mailto:${to}?${params.toString()}`;
}

async function loadJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return res.json();
}

function showToast(msg, isError = false) {
  const toast = $("#orderToast");
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast toast-show${isError ? " toast-err" : ""}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.className = "toast";
  }, 4500);
}

document.addEventListener("DOMContentLoaded", async () => {
  $("#year").textContent = String(new Date().getFullYear());

  let menu;
  let orderConfig;
  try {
    [menu, orderConfig] = await Promise.all([
      loadJson("./data/menu.json"),
      loadJson("./data/order-config.json")
    ]);
  } catch (e) {
    console.error(e);
    showToast("Could not load menu. Please refresh the page.", true);
    return;
  }

  const site = menu.site || {};
  const nutrition = menu.nutritionPerKit || {};
  const items = menu.items || [];
  const combos = menu.combos || [];
  const orderEmails =
    orderConfig.order?.orderEmails ||
    (orderConfig.order?.orderEmail ? [orderConfig.order.orderEmail] : []);

  if (site.heroLine1) $("#heroEyebrow").textContent = site.heroLine1;
  if (site.heroLine2) $("#heroTitle").textContent = site.heroLine2;
  if (site.heroSub) $("#heroSub").textContent = site.heroSub;

  const statsEl = $("#heroStats");
  if (statsEl) {
    const stats = [
      nutrition.caloriesRange,
      nutrition.carbsRange,
      nutrition.sugarNote,
      nutrition.caffeineMgRange
    ].filter(Boolean);
    statsEl.innerHTML = stats
      .map((s) => `<span class="stat-pill">${escapeHtml(s)}</span>`)
      .join("");
  }

  const benefitList = $("#benefitList");
  if (benefitList && nutrition.highlights) {
    benefitList.innerHTML = nutrition.highlights
      .map((h) => `<li>${escapeHtml(h)}</li>`)
      .join("");
  }

  const nutritionDl = $("#nutritionDl");
  if (nutritionDl) {
    const rows = [
      ["Calories", nutrition.caloriesRange],
      ["Carbs", nutrition.carbsRange],
      ["Sugar", nutrition.sugarNote],
      ["Caffeine", nutrition.caffeineMgRange]
    ].filter(([, v]) => v);
    nutritionDl.innerHTML = rows
      .map(
        ([label, val]) =>
          `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(val)}</dd></div>`
      )
      .join("");
  }

  const state = {
    qtyById: Object.fromEntries(items.map((i) => [i.id, 0])),
    activeCategory: "All",
    search: ""
  };

  const itemByName = Object.fromEntries(items.map((i) => [i.name.toLowerCase(), i]));

  function cartTotal() {
    return Object.values(state.qtyById).reduce((a, b) => a + b, 0);
  }

  function updateCartUI() {
    const total = cartTotal();
    for (const el of [
      $("#headerCartCount"),
      $("#cartTotal"),
      $("#stickyCartCount")
    ]) {
      if (el) el.textContent = String(total);
    }

    const sticky = $("#stickyCart");
    if (sticky) sticky.hidden = total === 0;
    document.body.classList.toggle("has-sticky-cart", total > 0);

    const hint = $("#cartEmptyHint");
    const lines = $("#cartLines");
    if (!lines) return;

    const selected = items.filter((i) => (state.qtyById[i.id] || 0) > 0);
    if (hint) hint.hidden = selected.length > 0;

    lines.innerHTML = selected
      .map(
        (item) => `
        <div class="cart-line" data-cart-row="${escapeHtml(item.id)}">
          <div class="cart-line-info">
            <strong>${escapeHtml(item.name)}</strong>
            <span>Tea kit</span>
          </div>
          <div class="cart-stepper">
            <button type="button" data-dec="${escapeHtml(item.id)}" aria-label="Decrease">-</button>
            <output>${state.qtyById[item.id]}</output>
            <button type="button" data-inc="${escapeHtml(item.id)}" aria-label="Increase">+</button>
          </div>
        </div>`
      )
      .join("");

    lines.querySelectorAll("[data-dec]").forEach((btn) => {
      btn.addEventListener("click", () => changeQty(btn.getAttribute("data-dec"), -1));
    });
    lines.querySelectorAll("[data-inc]").forEach((btn) => {
      btn.addEventListener("click", () => changeQty(btn.getAttribute("data-inc"), 1));
    });
  }

  function changeQty(id, delta) {
    const next = Math.max(0, Math.min(99, (state.qtyById[id] || 0) + delta));
    state.qtyById[id] = next;
    updateCartUI();
    syncProductButtons();
  }

  function addOne(id) {
    changeQty(id, 1);
    const btn = document.querySelector(`[data-add="${id}"]`);
    if (btn) {
      btn.classList.add("added");
      btn.textContent = "Added";
      setTimeout(() => {
        btn.classList.remove("added");
        btn.textContent = "Add to cart";
      }, 900);
    }
  }

  function syncProductButtons() {
    /* visual sync optional */
  }

  const comboGrid = $("#comboGrid");
  if (comboGrid) {
    comboGrid.innerHTML = combos
      .map((combo) => {
        const flavorTags = (combo.flavors || [])
          .map((name, idx) => {
            const item = itemByName[name.toLowerCase()];
            const grad = item ? gradientFor(item.id) : gradientFor(combo.id + idx);
            return `<span class="flavor-dot" style="background:${grad}">${escapeHtml(name)}</span>`;
          })
          .join("");
        const badge = combo.badge
          ? `<span class="combo-badge">${escapeHtml(combo.badge)}</span>`
          : "";
        return `
          <article class="combo-card">
            ${badge}
            <h3>${escapeHtml(combo.name)}</h3>
            <div class="combo-flavors">${flavorTags}</div>
          </article>`;
      })
      .join("");
  }

  const actualCats = ["All", ...Array.from(new Set(items.map((i) => i.category)))];
  const chipsEl = $("#menuChips");
  const menuGrid = $("#menuGrid");

  function renderChips() {
    if (!chipsEl) return;
    chipsEl.innerHTML = actualCats
      .map(
        (cat) =>
          `<button type="button" class="chip${state.activeCategory === cat ? " chip-active" : ""}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat === "All" ? "All flavors" : cat)}</button>`
      )
      .join("");
    chipsEl.querySelectorAll("[data-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeCategory = btn.getAttribute("data-cat");
        renderChips();
        renderProducts();
      });
    });
  }

  function renderProducts() {
    if (!menuGrid) return;
    const q = state.search.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const catOk =
        state.activeCategory === "All" || item.category === state.activeCategory;
      const searchOk = !q || item.name.toLowerCase().includes(q);
      return catOk && searchOk;
    });

    menuGrid.innerHTML = filtered
      .map((item) => {
        const grad = gradientFor(item.id);
        const popular = item.category === "Popular";
        return `
          <article class="product-card">
            <div class="product-visual" style="background: ${grad}">
              <div class="product-cup">
                <div class="product-liquid" style="background: linear-gradient(180deg, rgba(255,255,255,0.35), transparent), ${grad}"></div>
              </div>
            </div>
            <div class="product-body">
              <div class="product-meta">
                <h3>${escapeHtml(item.name)}</h3>
                ${popular ? '<span class="product-tag">Popular</span>' : ""}
              </div>
              <button type="button" class="product-add" data-add="${escapeHtml(item.id)}">Add to cart</button>
            </div>
          </article>`;
      })
      .join("");

    menuGrid.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => addOne(btn.getAttribute("data-add")));
    });
  }

  renderChips();
  renderProducts();
  updateCartUI();

  $("#menuSearch")?.addEventListener("input", (e) => {
    state.search = e.target.value || "";
    renderProducts();
  });

  const orderType = $("#orderType");
  const addressLabel = $("#addressLabel");
  const orderAddress = $("#orderAddress");

  function syncDeliveryFields() {
    const isDelivery = orderType?.value === "Delivery";
    if (addressLabel) addressLabel.style.opacity = isDelivery ? "1" : "0.65";
    if (orderAddress) {
      orderAddress.required = Boolean(isDelivery);
      orderAddress.setAttribute("aria-required", isDelivery ? "true" : "false");
    }
  }

  orderType?.addEventListener("change", syncDeliveryFields);
  syncDeliveryFields();

  const menuToggle = $("#menuToggle");
  const mobileNav = $("#mobileNav");
  const navBackdrop = $("#navBackdrop");

  function setNavOpen(open) {
    if (!menuToggle || !mobileNav) return;
    menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mobileNav.classList.toggle("is-open", open);
    mobileNav.hidden = !open;
    document.body.classList.toggle("nav-open", open);
    if (navBackdrop) {
      navBackdrop.hidden = !open;
      navBackdrop.setAttribute("aria-hidden", open ? "false" : "true");
    }
  }

  menuToggle?.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") !== "true";
    setNavOpen(open);
  });

  navBackdrop?.addEventListener("click", () => setNavOpen(false));

  mobileNav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setNavOpen(false));
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 768px)").matches) setNavOpen(false);
  });

  $("#orderForm")?.addEventListener("submit", (e) => {
    e.preventDefault();

    const selected = items
      .map((i) => ({ name: i.name, qty: state.qtyById[i.id] || 0 }))
      .filter((x) => x.qty > 0);

    if (!selected.length) {
      showToast("Add at least one tea kit to your cart.", true);
      document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    const customer = {
      name: ($("#orderName")?.value || "").trim(),
      email: ($("#orderEmail")?.value || "").trim(),
      phone: ($("#orderPhone")?.value || "").trim(),
      orderType: orderType?.value || "Pickup",
      address: ($("#orderAddress")?.value || "").trim(),
      preferredDay: ($("#orderPreferredDay")?.value || "").trim(),
      preferredTime: ($("#orderPreferredTime")?.value || "").trim(),
      notes: ($("#orderNotes")?.value || "").trim()
    };

    if (customer.orderType === "Delivery" && !customer.address) {
      showToast("Please enter a delivery address.", true);
      return;
    }

    const totalKits = selected.reduce((s, x) => s + x.qty, 0);
    const lines = selected.map((x) => `- ${x.name} x ${x.qty}`).join("\n");

    const body = [
      "GlowDaily Nutrition - Tea Kit Order",
      "",
      `Name: ${customer.name}`,
      `Email: ${customer.email}`,
      `Phone: ${customer.phone || "(not provided)"}`,
      `Fulfillment: ${customer.orderType}`,
      ...(customer.orderType === "Delivery" ? [`Address: ${customer.address}`] : []),
      ...(customer.preferredDay ? [`Preferred day: ${customer.preferredDay}`] : []),
      ...(customer.preferredTime ? [`Preferred time: ${customer.preferredTime}`] : []),
      "",
      `Total kits: ${totalKits}`,
      "",
      "Items:",
      lines,
      "",
      customer.notes ? `Notes: ${customer.notes}` : ""
    ]
      .filter((line) => line !== undefined)
      .join("\n");

    const subject = `${orderConfig.order?.mailtoSubjectPrefix || "GlowDaily Order"} - ${customer.name} (${totalKits} kit${totalKits === 1 ? "" : "s"})`;

    $("#orderModalText").textContent = body;

    const mailtoLink = $("#orderModalMailto");
    if (mailtoLink && orderEmails.length) {
      mailtoLink.href = buildMailto({ emails: orderEmails, subject, body });
    }

    const modal = $("#orderModal");
    if (modal?.showModal) modal.showModal();
  });

  $("#orderModalClose")?.addEventListener("click", () => $("#orderModal")?.close());

  $("#orderCopyBtn")?.addEventListener("click", async () => {
    const text = $("#orderModalText")?.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      showToast("Order copied to clipboard.");
    } catch {
      showToast("Could not copy. Select the text manually.", true);
    }
  });
});
