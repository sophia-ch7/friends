document.addEventListener("DOMContentLoaded", () => {
  const addSafeListener = (id, event, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  };

  const state = {
    users: [],
    savedFriends: JSON.parse(localStorage.getItem("savedFriends") || "[]"),
    loadedPages: [],
    isLoading: false,
    isShowingSaved: false,
    filters: {
      search: "",
      sort: "",
      minAge: "",
      maxAge: "",
      year: "",
      location: "",
      email: "",
    },
  };

  const filterData = (data, filters) => {
    return data.filter((user) => {
      const fullName = `${user.name.first} ${user.name.last}`.toLowerCase();
      const location =
        `${user.location.city} ${user.location.country}`.toLowerCase();
      const birthYear = new Date(user.dob.date).getFullYear().toString();

      return (
        (!filters.search || fullName.includes(filters.search.toLowerCase())) &&
        (!filters.minAge || user.dob.age >= Number(filters.minAge)) &&
        (!filters.maxAge || user.dob.age <= Number(filters.maxAge)) &&
        (!filters.year || birthYear === filters.year) &&
        (!filters.location ||
          location.includes(filters.location.toLowerCase())) &&
        (!filters.email ||
          user.email.toLowerCase().includes(filters.email.toLowerCase()))
      );
    });
  };

  const sortData = (data, sortType) => {
    const copy = [...data];
    switch (sortType) {
      case "name-asc":
        return copy.sort((a, b) => a.name.first.localeCompare(b.name.first));
      case "name-desc":
        return copy.sort((a, b) => b.name.first.localeCompare(a.name.first));
      case "age-asc":
        return copy.sort((a, b) => a.dob.age - b.dob.age);
      case "age-desc":
        return copy.sort((a, b) => b.dob.age - a.dob.age);
      case "reg-asc":
        return copy.sort(
          (a, b) => new Date(a.registered.date) - new Date(b.registered.date),
        );
      default:
        return copy;
    }
  };

  const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  };

  const showToast = (msg, isError = false) => {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.style.background = isError ? "#D9534F" : "#1A1A1A";
    toast.textContent = msg;
    document.getElementById("toast-container").appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const syncURL = () => {
    const url = new URL(window.location);
    Object.entries(state.filters).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    });
    window.history.pushState({}, "", url);
  };

  const readURL = () => {
    const params = new URLSearchParams(window.location.search);
    Object.keys(state.filters).forEach((key) => {
      if (params.has(key)) {
        state.filters[key] = params.get(key);
        const inputId = key === "search" ? "filter-name" : `filter-${key}`;
        const inputEl =
          document.getElementById(inputId) ||
          document.getElementById("sort-select");
        if (inputEl) inputEl.value = state.filters[key];
      }
    });
  };

  const renderUsers = () => {
    const grid = document.getElementById("users-container");
    const sourceData = state.isShowingSaved ? state.savedFriends : state.users;

    const filtered = filterData(sourceData, state.filters);
    const sorted = sortData(filtered, state.filters.sort);

    grid.innerHTML = sorted.length
      ? ""
      : '<p style="grid-column: 1/-1; text-align: center;">No users found.</p>';

    sorted.forEach((user) => {
      const isSaved = state.savedFriends.some(
        (f) => f.login.uuid === user.login.uuid,
      );
      const card = document.createElement("article");
      card.className = "glass-panel user-card";
      card.innerHTML = `
                <div class="card-blob"></div>
                <img src="${user.picture.large}" class="user-avatar" alt="Avatar">
                <h3 class="user-name">${user.name.first} ${user.name.last}</h3>
                <p class="user-info">Age: ${user.dob.age} (Born: ${new Date(user.dob.date).getFullYear()})</p>
                <p class="user-info">📍 ${user.location.city}, ${user.location.country}</p>
                <p class="user-info">✉️ ${user.email}</p>
                <button class="btn-save ${isSaved ? "saved" : ""}" data-uuid="${user.login.uuid}">
                    ${isSaved ? "Saved ♥" : "Save Friend"}
                </button>
            `;
      grid.appendChild(card);
    });

    document.querySelectorAll(".btn-save").forEach((btn) => {
      btn.addEventListener("click", (e) => toggleSave(e.target.dataset.uuid));
    });

    const toggleBtn = document.getElementById("btn-toggle-saved");
    if (toggleBtn)
      toggleBtn.textContent = `Show Saved (${state.savedFriends.length})`;
  };

  const renderPagination = () => {
    const container = document.getElementById("pagination-pages");
    if (container) {
      container.innerHTML = state.loadedPages
        .map((p) => `<div class="page-badge">${p}</div>`)
        .join("");
    }
  };

  const fetchUsers = async (page) => {
    if (state.isLoading || state.isShowingSaved) return;
    state.isLoading = true;
    const loader = document.getElementById("loader");
    if (loader) loader.classList.remove("hidden");

    try {
      const response = await fetch(
        `https://randomuser.me/api/?results=30&page=${page}&seed=friendslab`,
      );
      if (!response.ok) throw new Error("API fetching failed");

      const data = await response.json();
      state.users = [...state.users, ...data.results];

      if (!state.loadedPages.includes(page)) state.loadedPages.push(page);

      renderUsers();
      renderPagination();
      if (page === 1) showToast("Data loaded successfully!");
    } catch (error) {
      showToast(error.message, true);
    } finally {
      state.isLoading = false;
      if (loader) loader.classList.add("hidden");
    }
  };

  const toggleSave = (uuid) => {
    const userToSave =
      state.users.find((u) => u.login.uuid === uuid) ||
      state.savedFriends.find((u) => u.login.uuid === uuid);
    if (!userToSave) return;

    const alreadySaved = state.savedFriends.some((f) => f.login.uuid === uuid);
    if (alreadySaved) {
      state.savedFriends = state.savedFriends.filter(
        (f) => f.login.uuid !== uuid,
      );
      showToast("Friend removed!");
    } else {
      state.savedFriends.push(userToSave);
      showToast("Friend saved successfully!");
    }
    localStorage.setItem("savedFriends", JSON.stringify(state.savedFriends));
    renderUsers();
  };

  const checkAuth = () => {
    const currentUser = localStorage.getItem("currentUser");
    const authScreen = document.getElementById("auth-screen");
    const appScreen = document.getElementById("app-screen");

    if (currentUser) {
      if (authScreen) authScreen.classList.add("hidden");
      if (appScreen) appScreen.classList.remove("hidden");
      if (state.users.length === 0) fetchUsers(1);
    } else {
      if (authScreen) authScreen.classList.remove("hidden");
      if (appScreen) appScreen.classList.add("hidden");
    }
  };

  addSafeListener("login-form", "submit", (e) => {
    e.preventDefault(); 
    const emailInput = document.getElementById("login-email");
    if (emailInput && emailInput.value.trim() !== "") {
      localStorage.setItem("currentUser", emailInput.value.trim());
      showToast("Logged in successfully!");
      checkAuth();
    }
  });

  addSafeListener("signup-form", "submit", (e) => {
    e.preventDefault();
    showToast("Account created! Please log in.");
    const loginTab = document.getElementById("tab-login");
    if (loginTab) loginTab.click();
  });

  addSafeListener("btn-logout", "click", () => {
    localStorage.removeItem("currentUser");
    state.users = [];
    state.loadedPages = [];
    showToast("Logged out.");
    checkAuth();
  });

  addSafeListener("tab-login", "click", (e) => {
    e.target.classList.add("active");
    document.getElementById("tab-signup").classList.remove("active");
    document.getElementById("login-form").classList.remove("hidden");
    document.getElementById("signup-form").classList.add("hidden");
  });
  addSafeListener("tab-signup", "click", (e) => {
    e.target.classList.add("active");
    document.getElementById("tab-login").classList.remove("active");
    document.getElementById("signup-form").classList.remove("hidden");
    document.getElementById("login-form").classList.add("hidden");
  });

  
  const applyFilter = (key, value) => {
    state.filters[key] = value;
    syncURL();
    renderUsers();
  };

  const setupDebounceInput = (id, key) => {
    const el = document.getElementById(id);
    if (el)
      el.addEventListener(
        "input",
        debounce((e) => applyFilter(key, e.target.value), 500),
      );
  };

  setupDebounceInput("filter-name", "search");
  setupDebounceInput("filter-age-min", "minAge");
  setupDebounceInput("filter-age-max", "maxAge");
  setupDebounceInput("filter-year", "year");
  setupDebounceInput("filter-location", "location");
  setupDebounceInput("filter-email", "email");

  addSafeListener("sort-select", "change", (e) =>
    applyFilter("sort", e.target.value),
  );

  addSafeListener("btn-reset", "click", () => {
    state.filters = {
      search: "",
      sort: "",
      minAge: "",
      maxAge: "",
      year: "",
      location: "",
      email: "",
    };
    document
      .querySelectorAll(".controls-panel input, .controls-panel select")
      .forEach((el) => (el.value = ""));
    syncURL();
    renderUsers();
  });

  addSafeListener("btn-toggle-saved", "click", (e) => {
    state.isShowingSaved = !state.isShowingSaved;
    e.target.style.textDecoration = state.isShowingSaved ? "none" : "underline";
    e.target.style.fontWeight = state.isShowingSaved ? "900" : "700";
    renderUsers();
  });

  const anchor = document.getElementById("scroll-anchor");
  if (anchor && window.IntersectionObserver) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !state.isLoading &&
          !state.isShowingSaved &&
          state.loadedPages.length > 0
        ) {
          const nextPage = Math.max(...state.loadedPages) + 1;
          fetchUsers(nextPage);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(anchor);
  }

  readURL();
  checkAuth();
});
