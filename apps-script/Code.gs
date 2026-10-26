function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("Book an appointment")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getCatalog() {
  const settings = readSettings(readTable_("Settings", SETTING_COLUMNS));
  return publicCatalog(settings, readTable_("Services", SERVICE_COLUMNS));
}

function getOpenSlots(serviceId) {
  const settings = readSettings(readTable_("Settings", SETTING_COLUMNS));
  const services = readTable_("Services", SERVICE_COLUMNS);
  const service = services.find((row) => row.service_id === serviceId);
  return openSlots({
    settings,
    service,
    bookings: readTable_("Bookings", BOOKING_COLUMNS),
    now: new Date(),
  });
}

function submitBooking(request) {
  const settings = readSettings(readTable_("Settings", SETTING_COLUMNS));
  return bookAppointment({
    settings,
    services: readTable_("Services", SERVICE_COLUMNS),
    now: new Date(),
    request: request || {},
    store: {
      withLock: withSheetLock_,
      readBookings: function () {
        return readTable_("Bookings", BOOKING_COLUMNS);
      },
      append: function (row) {
        appendRow_("Bookings", BOOKING_COLUMNS, row);
      },
      nextId: function () {
        return "b-" + Utilities.getUuid().replace(/-/g, "").slice(0, 8);
      },
    },
  });
}

function seedSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  spreadsheet.setSpreadsheetTimeZone("America/Chicago");
  const email = Session.getActiveUser().getEmail();
  const settings = seedSettings.map((row) => (
    row.key === "salon_email" && email ? { key: row.key, value: email } : row
  ));
  writeTable_("Services", SERVICE_COLUMNS, seedServices);
  writeTable_("Settings", SETTING_COLUMNS, settings);
  writeTable_("Bookings", BOOKING_COLUMNS, []);
  const leftover = spreadsheet.getSheetByName("Sheet1");
  if (leftover && spreadsheet.getSheets().length > 1) spreadsheet.deleteSheet(leftover);
}

function withSheetLock_(run) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (error) {
    return { ok: false, reason: "busy", message: "Please try again in a moment." };
  }
  try {
    return run();
  } finally {
    lock.releaseLock();
  }
}

function readTable_(name, columns) {
  const grid = requireSheet_(name).getDataRange().getDisplayValues();
  const headersMatch = columns.every((column, index) => grid[0] && grid[0][index] === column);
  if (!headersMatch) throw new Error(name + " headers do not match. Run seedSheet_ once from the editor.");
  const rows = [];
  for (let i = 1; i < grid.length; i += 1) {
    if (grid[i].every((cell) => String(cell).trim() === "")) continue;
    const row = {};
    columns.forEach((column, index) => {
      row[column] = grid[i][index] === undefined ? "" : String(grid[i][index]).trim();
    });
    rows.push(row);
  }
  return rows;
}

function appendRow_(name, columns, row) {
  const sheet = requireSheet_(name);
  const range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, columns.length);
  range.setNumberFormat("@");
  range.setValues([columns.map((column) => row[column])]);
}

function writeTable_(name, columns, rows) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  sheet.clear();
  const values = [columns].concat(rows.map((row) => columns.map((column) => row[column])));
  const range = sheet.getRange(1, 1, values.length, columns.length);
  range.setNumberFormat("@");
  range.setValues(values);
  sheet.setFrozenRows(1);
}

function requireSheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error("Missing tab " + name + ". Run seedSheet_ once from the editor.");
  return sheet;
}
