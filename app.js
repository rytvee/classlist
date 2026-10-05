// ==========================================
// DOM ELEMENTS
// ==========================================

const appLoading = document.getElementById("appLoading");

const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const tableFooter = document.getElementById("tableFooter");

const currentDateDisplay = document.getElementById("currentDateDisplay");

const datePicker = document.getElementById("datePicker");
const datesList = document.getElementById("datesList");

const previousDateBtn = document.getElementById("previousDate");
const nextDateBtn = document.getElementById("nextDate");
const todayBtn = document.getElementById("todayBtn");

const previousMonth = document.getElementById("previousMonth");
const nextMonth = document.getElementById("nextMonth");

const openDatesSidebar = document.getElementById("openDatesSidebar");

const closeDatesSidebar = document.getElementById("closeDatesSidebar");

const attendanceSidebar = document.getElementById("attendanceSidebar");

const sidebarOverlay = document.getElementById("sidebarOverlay");

const resetSheetBtn = document.getElementById("resetSheetBtn");

// ==========================================
// STATE
// ==========================================

let isLoggedIn = false;
let sessionGeneration = 0;

let currentDate = getTodayDate();

let displayedMonth = new Date(currentDate + "T00:00:00");

let sheets = {};

// Dates confirmed to exist in the database
let savedDates = [];

let saveTimeout = null;

// ==========================================
// MESSAGE DISPLAY
// ==========================================

function showAppLoading(message) {
  appLoading.textContent = message;
  appLoading.hidden = false;
}

function hideAppLoading() {
  appLoading.hidden = true;
}

// ==========================================
// LOGIN SESSION
// ==========================================

const loginForm = document.getElementById("loginForm");
const loginSection = document.getElementById("loginSection");
const attendanceSection = document.getElementById("attendanceSection");
const loginError = document.getElementById("loginError");

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  loginError.textContent = "";

  showAppLoading("loading attendance...");

  // Keep everything hidden while loading.
  loginSection.hidden = true;
  attendanceSection.hidden = true;

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      loginError.textContent = result.error || "Login failed";

      isLoggedIn = false;
      loginSection.hidden = false;

      return;
    }

    isLoggedIn = true;

    // Login successful.
    // Keep attendance hidden while everything loads.
    await initializeApp();

    // Only reveal the complete attendance interface
    // after initialization has finished.
    attendanceSection.hidden = false;
  } catch (error) {
    console.error("Login error:", error);

    loginError.textContent = "Unable to connect to the server.";

    loginSection.hidden = false;
  } finally {
    hideAppLoading();
  }
});

// ==========================================
// LOGOUT SESSION
// ==========================================

const logoutButton = document.getElementById("logoutButton");

logoutButton.addEventListener("click", async function () {
  try {
    const response = await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(result.error || "Logout failed");
      return;
    }

    // Mark the application as logged out.
    isLoggedIn = false;
    sessionGeneration++;

    // Cancel any pending automatic save.
    clearTimeout(saveTimeout);
    saveTimeout = null;

    // Close sidebar completely.
    closeSidebar();

    // Clear application state.
    sheets = {};
    savedDates = [];

    // Reset date state.
    currentDate = getTodayDate();
    displayedMonth = new Date(`${currentDate}T00:00:00`);

    // Clear old attendance interface.
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";
    tableFooter.innerHTML = "";
    datesList.innerHTML = "";

    // Reset date display.
    currentDateDisplay.textContent = "";
    datePicker.value = "";

    // Reset login form.
    loginForm.reset();
    loginError.textContent = "";

    // Show login.
    attendanceSection.hidden = true;
    loginSection.hidden = false;
  } catch (error) {
    console.error("Logout error:", error);
  }
});

// ==========================================
// CHECK LOGIN SESSION
// ==========================================

async function checkLoginSession() {
  showAppLoading("checking session...");

  // Keep both interfaces hidden while checking.
  loginSection.hidden = true;
  attendanceSection.hidden = true;

  try {
    const response = await fetch("/api/session", {
      method: "GET",
      credentials: "include",
    });

    console.log("Session status:", response.status);

    if (!response.ok) {
      isLoggedIn = false;
      loginSection.hidden = false;
      return;
    }

    const result = await response.json();

    console.log("Session result:", result);

    if (result.authenticated !== true) {
      isLoggedIn = false;
      loginSection.hidden = false;
      return;
    }

    // Valid session.
    isLoggedIn = true;
    sessionGeneration++;

    // DO NOT show attendance yet.
    await initializeApp();

    // Reveal everything only after initialization.
    attendanceSection.hidden = false;
  } catch (error) {
    console.error("Session check failed:", error);

    loginSection.hidden = false;
  } finally {
    console.log("Finished session check");

    hideAppLoading();
  }
}

// ==========================================
// DATE FUNCTIONS
// ==========================================

function getTodayDate() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  const date = new Date(dateString + "T00:00:00");

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function changeDate(days) {
  const date = new Date(currentDate + "T00:00:00");

  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const newDate = `${year}-${month}-${day}`;

  if (newDate > getTodayDate()) {
    return;
  }

  loadDate(newDate);
}

function isFutureDate(date) {
  return date > getTodayDate();
}

function updateDateDisplay() {
  currentDateDisplay.textContent = formatDate(currentDate);

  datePicker.value = currentDate;

  // Prevent selecting future dates from the calendar.
  datePicker.max = getTodayDate();
}

// ==========================================
// DATABASE
// ==========================================

function createDefaultSheet() {
  return {
    columns: ["Header"],
    rows: [[""]],
  };
}

function getCurrentSheet() {
  if (!sheets[currentDate]) {
    sheets[currentDate] = createDefaultSheet();
  }

  return sheets[currentDate];
}

// ==========================================
// LOAD SHEET FROM DATABASE
// ==========================================

async function loadSheetFromDatabase(date) {
  try {
    const response = await fetch(`/api/sheets/${date}`, {
      method: "GET",
      credentials: "include",
    });

    // Sheet does not exist yet
    if (response.status === 404) {
      return null;
    }

    // Session expired
    if (response.status === 401) {
      isLoggedIn = false;
      loginSection.hidden = false;
      attendanceSection.hidden = true;

      return null;
    }

    const result = await response.json();

    if (!response.ok) {
      console.error(result.error || "Could not load sheet");

      return null;
    }

    return result.data;
  } catch (error) {
    console.error("Could not load sheet:", error);

    return null;
  }
}

// ==========================================
// SAVE SHEET TO DATABASE
// ==========================================

async function saveCurrentSheet() {
  const sheet = getCurrentSheet();

  const headers = Array.from(
    tableHead.querySelectorAll("th[data-column-index] input"),
  ).map((input) => input.value.trim());

  const rows = Array.from(tableBody.querySelectorAll("tr")).map((row) => {
    return Array.from(row.querySelectorAll("td[data-column-index] input")).map(
      (input) => input.value.trim(),
    );
  });

  sheet.columns = headers;
  sheet.rows = rows;

  // Keep the local JavaScript state updated.
  sheets[currentDate] = sheet;

  // Check whether the sheet contains any actual input.
  const hasData =
    headers.some((value) => value !== "") ||
    rows.some((row) => row.some((value) => value !== ""));

  // Do not save completely empty sheets.
  if (!hasData) {
    return;
  }

  const dateToSave = currentDate;

  clearTimeout(saveTimeout);

  saveTimeout = setTimeout(async () => {
    if (!isLoggedIn) {
      return;
    }

    try {
      const response = await fetch(`/api/sheets/${dateToSave}`, {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(sheet),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Could not save sheet:", result.error || "Unknown error");

        return;
      }

      console.log("Sheet saved:", dateToSave);

      if (!savedDates.includes(dateToSave)) {
        savedDates.push(dateToSave);
      }

      renderDates();
    } catch (error) {
      console.error("Could not save sheet:", error);
    }
  }, 500);
}

// ==========================================
// RESET SHEET
// ==========================================

async function resetCurrentSheet() {
  const confirmed = confirm(
    `Reset the attendance sheet for ${currentDate}?\n\nThis will remove the saved sheet for this date.`,
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`/api/sheets/${currentDate}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(result.error || "Could not reset sheet");
      return;
    }

    // Remove the date from the local saved-date list
    savedDates = savedDates.filter((date) => date !== currentDate);

    // Remove the old sheet from the local cache
    delete sheets[currentDate];

    // Create a fresh empty sheet
    sheets[currentDate] = createDefaultSheet();

    // Update the table
    renderTable();

    // Update the saved dates sidebar
    renderDates();

    console.log("Sheet reset:", currentDate);
  } catch (error) {
    console.error("Could not reset sheet:", error);
  }
}

resetSheetBtn.addEventListener("click", resetCurrentSheet);

// ==========================================
// CHECK WHETHER SHEET HAS REAL DATA
// ==========================================

function sheetHasData(sheet) {
  const hasHeaderData = sheet.columns.some((column) => {
    return column.trim() !== "" && column !== "Header";
  });

  const hasCellData = sheet.rows.some((row) => {
    return row.some((value) => {
      return value.trim() !== "";
    });
  });

  return hasHeaderData || hasCellData;
}

// ==========================================
// INPUT CREATION
// ==========================================

function createInput(value = "", placeholder = "Enter value") {
  const input = document.createElement("input");

  input.type = "text";
  input.placeholder = placeholder;
  input.value = value;

  input.addEventListener("input", () => {
    resizeColumns();

    saveCurrentSheet();
  });

  return input;
}

// ==========================================
// GET INPUT WIDTH
// ==========================================

function getInputWidth(input) {
  const span = document.createElement("span");

  span.style.position = "absolute";
  span.style.visibility = "hidden";
  span.style.whiteSpace = "pre";

  const styles = getComputedStyle(input);

  span.style.fontFamily = styles.fontFamily;
  span.style.fontSize = styles.fontSize;
  span.style.fontWeight = styles.fontWeight;
  span.style.letterSpacing = styles.letterSpacing;

  span.textContent = input.value || input.placeholder;

  document.body.appendChild(span);

  const textWidth = span.getBoundingClientRect().width;

  const padding =
    parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);

  const width = Math.max(50, textWidth + padding + 5);

  span.remove();

  return width;
}

function resizeColumns() {
  const columnCount = getCurrentSheet().columns.length;

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
    let largestWidth = 50;

    const headerInput = tableHead.querySelector(
      `th[data-column-index="${columnIndex}"] input`,
    );

    if (headerInput) {
      largestWidth = Math.max(largestWidth, getInputWidth(headerInput));
    }

    const bodyInputs = tableBody.querySelectorAll(
      `td[data-column-index="${columnIndex}"] input`,
    );

    bodyInputs.forEach((input) => {
      largestWidth = Math.max(largestWidth, getInputWidth(input));
    });

    if (headerInput) {
      headerInput.style.width = largestWidth + "px";
    }

    bodyInputs.forEach((input) => {
      input.style.width = largestWidth + "px";
    });
  }
}

// ==========================================
// RENDER TABLE
// ==========================================

function renderTable() {
  const sheet = getCurrentSheet();

  tableHead.innerHTML = "";
  tableBody.innerHTML = "";
  tableFooter.innerHTML = "";

  // =========================================
  // HEADER CONTROL ROW
  // =========================================

  const controlHeaderRow = document.createElement("tr");

  const emptyCorner = document.createElement("th");

  emptyCorner.className = "empty-control";

  controlHeaderRow.appendChild(emptyCorner);

  sheet.columns.forEach((column, columnIndex) => {
    const removeCell = document.createElement("th");

    removeCell.className = "row-control";

    const removeButton = document.createElement("button");

    removeButton.className = "circle-button";
    removeButton.textContent = "−";

    removeButton.addEventListener("click", () => {
      removeColumn(columnIndex);
    });

    removeCell.appendChild(removeButton);

    controlHeaderRow.appendChild(removeCell);
  });

  const addColumnCell = document.createElement("th");

  addColumnCell.className = "add-column-cell";

  const addColumnButton = document.createElement("button");

  addColumnButton.className = "add-column-button";
  addColumnButton.textContent = "+";

  addColumnButton.addEventListener("click", addColumn);

  addColumnCell.appendChild(addColumnButton);

  controlHeaderRow.appendChild(addColumnCell);

  // =========================================
  // TITLE ROW
  // =========================================

  const titleHeaderRow = document.createElement("tr");

  const emptyTitleCorner = document.createElement("th");

  emptyTitleCorner.className = "empty-control";

  titleHeaderRow.appendChild(emptyTitleCorner);

  sheet.columns.forEach((column, columnIndex) => {
    const titleCell = document.createElement("th");

    titleCell.dataset.columnIndex = columnIndex;

    const titleInput = createInput(column, "Header");

    titleCell.appendChild(titleInput);

    titleHeaderRow.appendChild(titleCell);
  });

  const emptyTitleEnd = document.createElement("th");

  emptyTitleEnd.className = "empty-control";

  titleHeaderRow.appendChild(emptyTitleEnd);

  tableHead.appendChild(controlHeaderRow);
  tableHead.appendChild(titleHeaderRow);

  // =========================================
  // BODY
  // =========================================

  sheet.rows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");

    const removeRowCell = document.createElement("td");

    removeRowCell.className = "row-control";

    const removeRowButton = document.createElement("button");

    removeRowButton.className = "circle-button";
    removeRowButton.textContent = "−";

    removeRowButton.addEventListener("click", () => {
      removeRow(rowIndex);
    });

    removeRowCell.appendChild(removeRowButton);

    tr.appendChild(removeRowCell);

    row.forEach((value, columnIndex) => {
      const td = document.createElement("td");

      td.dataset.columnIndex = columnIndex;

      const input = createInput(value);

      td.appendChild(input);

      tr.appendChild(td);
    });

    const emptyEndCell = document.createElement("td");

    emptyEndCell.className = "empty-control";

    tr.appendChild(emptyEndCell);

    tableBody.appendChild(tr);
  });

  // =========================================
  // FOOTER
  // =========================================

  const footerRow = document.createElement("tr");

  const addRowCell = document.createElement("td");

  addRowCell.className = "add-row-cell";

  const addRowButton = document.createElement("button");

  addRowButton.className = "add-row-button";
  addRowButton.textContent = "+";

  addRowButton.addEventListener("click", addRow);

  addRowCell.appendChild(addRowButton);

  footerRow.appendChild(addRowCell);

  sheet.columns.forEach(() => {
    const emptyCell = document.createElement("td");

    emptyCell.className = "empty-control";

    footerRow.appendChild(emptyCell);
  });

  const emptyEndCell = document.createElement("td");

  emptyEndCell.className = "empty-control";

  footerRow.appendChild(emptyEndCell);

  tableFooter.appendChild(footerRow);

  resizeColumns();
}

// ==========================================
// ADD ROW
// ==========================================

function addRow() {
  const sheet = getCurrentSheet();

  sheet.rows.push(Array(sheet.columns.length).fill(""));

  renderTable();

  saveCurrentSheet();

  renderDates();
}

// ==========================================
// REMOVE ROW
// ==========================================

function removeRow(index) {
  const sheet = getCurrentSheet();

  if (sheet.rows.length <= 1) {
    alert("The table must have at least one row.");
    return;
  }

  const row = sheet.rows[index];

  const isFilled = row.some((value) => value.trim() !== "");

  if (isFilled) {
    const confirmed = confirm(
      "This row contains data. Are you sure you want to remove it?",
    );

    if (!confirmed) {
      return;
    }
  }

  sheet.rows.splice(index, 1);

  renderTable();

  saveCurrentSheet();

  renderDates();
}

// ==========================================
// ADD COLUMN
// ==========================================

function addColumn() {
  const sheet = getCurrentSheet();

  sheet.columns.push("Header");

  sheet.rows.forEach((row) => {
    row.push("");
  });

  renderTable();

  saveCurrentSheet();

  renderDates();
}

// ==========================================
// REMOVE COLUMN
// ==========================================

function removeColumn(index) {
  const sheet = getCurrentSheet();

  if (sheet.columns.length <= 1) {
    alert("The table must have at least one column.");
    return;
  }

  const isFilled = sheet.rows.some((row) => {
    return row[index] && row[index].trim() !== "";
  });

  if (isFilled) {
    const confirmed = confirm(
      "This column contains data. Are you sure you want to remove it?",
    );

    if (!confirmed) {
      return;
    }
  }

  sheet.columns.splice(index, 1);

  sheet.rows.forEach((row) => {
    row.splice(index, 1);
  });

  renderTable();

  saveCurrentSheet();

  renderDates();
}

// ==========================================
// DATE LOADING
// ==========================================

// ==========================================
// DATE LOADING
// ==========================================

async function loadDate(date) {
  console.log("loadDate started:", date);

  // Never allow future dates
  if (date > getTodayDate()) {
    console.log("Future date blocked:", date);
    return;
  }

  // Remember which date is being loaded
  const requestedDate = date;

  currentDate = date;

  // Keep the saved-dates calendar synchronized
  displayedMonth = new Date(`${date}T00:00:00`);

  // Immediately update the date controls
  updateDateDisplay();

  console.log("Fetching sheet:", date);

  const databaseSheet = await loadSheetFromDatabase(date);

  console.log("Sheet request finished:", date);

  // If the user logged out while the request was running
  if (!isLoggedIn) {
    console.log("User logged out while loading date.");
    return;
  }

  // If another date was selected while this request
  // was still loading, don't overwrite the newer date.
  if (currentDate !== requestedDate) {
    console.log(
      "Ignoring outdated date request:",
      requestedDate,
      "Current date:",
      currentDate,
    );

    return;
  }

  if (databaseSheet) {
    sheets[date] = databaseSheet;
  } else {
    sheets[date] = createDefaultSheet();
  }

  // Update the attendance table
  renderTable();

  // Update saved-date sidebar/calendar
  renderDates();

  console.log("loadDate finished:", date);
}

// ==========================================
// LOAD SAVED DATES
// ==========================================

async function loadSavedDates() {
  try {
    const response = await fetch("/api/sheets/", {
      method: "GET",
      credentials: "include",
    });

    if (response.status === 401) {
      return;
    }

    const result = await response.json();

    if (!response.ok) {
      console.error(result.error || "Could not load dates");
      return;
    }

    savedDates = result.sheets.map((sheet) => sheet.date).filter(Boolean);
  } catch (error) {
    console.error("Could not load saved dates:", error);
  }
}

function renderDates() {
  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();

  const monthName = displayedMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  document.getElementById("monthName").textContent = monthName;

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  const monthDates = savedDates
    .filter((date) => date.startsWith(monthPrefix))
    .sort((a, b) => b.localeCompare(a));

  document.getElementById("monthCount").textContent = `${monthDates.length} ${
    monthDates.length === 1 ? "day" : "days"
  }`;

  const datesList = document.getElementById("datesList");

  datesList.innerHTML = "";

  datesList.classList.remove("empty");

  if (monthDates.length === 0) {
    datesList.classList.add("empty");

    const message = document.createElement("div");

    message.className = "no-dates-message";
    message.textContent = "No attendance sheets saved yet.";

    datesList.appendChild(message);

    return;
  }

  monthDates.forEach((date) => {
    const dateObject = new Date(`${date}T00:00:00`);

    const button = document.createElement("button");

    button.type = "button";
    button.className = "date-item";

    if (date === currentDate) {
      button.classList.add("active");
    }

    button.innerHTML = `
            <span class="day-name">
                ${dateObject.toLocaleDateString("en-US", {
                  weekday: "short",
                })}
            </span>

            <span class="day-number">
                ${dateObject.getDate()}
            </span>
        `;

    button.addEventListener("click", () => {
      loadDate(date);
      closeSidebarOnMobile();
    });

    datesList.appendChild(button);
  });
}

function changeDisplayedMonth(months) {
  displayedMonth = new Date(
    displayedMonth.getFullYear(),
    displayedMonth.getMonth() + months,
    1,
  );

  renderDates();
}

// ==========================================
// EVENT LISTENERS
// ==========================================

previousDateBtn.addEventListener("click", () => {
  changeDate(-1);
});

nextDateBtn.addEventListener("click", () => {
  changeDate(1);
});

todayBtn.addEventListener("click", () => {
  loadDate(getTodayDate());
});

datePicker.addEventListener("change", () => {
  if (!datePicker.value) {
    return;
  }

  const selectedDate = datePicker.value;
  const today = getTodayDate();

  if (selectedDate > today) {
    alert("Future dates cannot be accessed.");

    // Restore the currently selected valid date.
    datePicker.value = currentDate;

    return;
  }

  loadDate(selectedDate);
});

previousMonth.addEventListener("click", () => {
  changeDisplayedMonth(-1);
});

nextMonth.addEventListener("click", () => {
  changeDisplayedMonth(1);
});

// ==========================================
// SIDEBAR
// ==========================================

function openSidebar() {
  attendanceSidebar.classList.add("is-open");

  sidebarOverlay.hidden = false;

  openDatesSidebar.setAttribute("aria-expanded", "true");

  document.body.classList.add("sidebar-open");
}

function closeSidebar() {
  attendanceSidebar.classList.remove("is-open");

  sidebarOverlay.hidden = true;

  openDatesSidebar.setAttribute("aria-expanded", "false");

  document.body.classList.remove("sidebar-open");
}

function closeSidebarOnMobile() {
  if (window.innerWidth <= 640) {
    closeSidebar();
  }
}

openDatesSidebar.addEventListener("click", openSidebar);

closeDatesSidebar.addEventListener("click", closeSidebar);

sidebarOverlay.addEventListener("click", closeSidebar);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSidebar();
  }
});

// ==========================================
// INITIALIZE APP
// ==========================================

async function initializeApp() {
  console.log("initializeApp started");

  console.log("Loading saved dates...");
  const savedDatesPromise = loadSavedDates();

  console.log("Loading current date...");
  const currentDatePromise = loadDate(currentDate);

  await Promise.all([savedDatesPromise, currentDatePromise]);

  console.log("Both loading operations finished");

  updateDateDisplay();

  renderTable();

  renderDates();

  console.log("initializeApp finished");
}

// ==========================================
// START APPLICATION
// ==========================================

checkLoginSession();
