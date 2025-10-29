// --- CONFIGURATION ---
const CONTACTS_SHEET_NAME = 'Contacts';
const NEW_ROW_POSITION = 5; // The row number where the new blank row should be inserted

/**
 * Inserts a new, blank row at the top of the contacts list (Row 5), 
 * pushing all existing data down.
 */
function insertManualContactRow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONTACTS_SHEET_NAME);

  if (sheet) {
    // Insert one row at the designated position (Row 5)
    sheet.insertRowBefore(NEW_ROW_POSITION);
    
    // Optional: Log the action for debugging (can be removed later)
    Logger.log('Inserted new blank row at Row ' + NEW_ROW_POSITION + ' in ' + CONTACTS_SHEET_NAME);
  } else {
    Logger.log('Error: Sheet named "' + CONTACTS_SHEET_NAME + '" not found.');
  }
}