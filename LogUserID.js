// --- CONFIGURATION ---
const CHECKBOX_COLUMN_INDEX = 11; // The column number for your status/checkbox column (e.g., Column K is 11)
const USER_ID_COLUMN_OFFSET = 1; // The user ID will be logged 1 column to the right (Column M)
const SHEET_NAME_TO_MONITOR = 'Contacts'; // The tab where your data lives

/**
 * Triggered automatically when a user edits a cell in the spreadsheet.
 * @param {object} e The event object containing information about the edit.
 */
function onEdit(e) {
  // Add this check to prevent errors if e is undefined
  if (!e || !e.range) {
    Logger.log('onEdit triggered without valid event object');
    return;
  }
  
  // Debug: Log the edit details
  Logger.log('onEdit triggered for row ' + e.range.getRow() + ', col ' + e.range.getColumn() + ', value ' + e.value);
  
  const range = e.range;
  const sheet = range.getSheet();
  const user = Session.getActiveUser().getEmail(); // Get the current user's email

  // 1. Check if the edit is on the correct sheet
  if (sheet.getName() !== SHEET_NAME_TO_MONITOR) {
    return;
  }
  
  // 2. Check if the edit is in the designated checkbox column
  if (range.getColumn() === CHECKBOX_COLUMN_INDEX) {
    const row = range.getRow();
    const isChecked = e.value === "TRUE";
    
    // Determine the target cell for the User ID
    const targetCell = sheet.getRange(row, range.getColumn() + USER_ID_COLUMN_OFFSET);

    if (isChecked) {
      // If the box is checked (FALSE -> TRUE), log the user ID and timestamp
      Logger.log('User email: ' + user); // Debug: Log the extracted email
      targetCell.setValue(user + " @ " + new Date());
      Logger.log('Logged user: ' + user + ' in row ' + row + ', column ' + (range.getColumn() + USER_ID_COLUMN_OFFSET));
      
    } else {
      // Optional: Clear the User ID if the box is unchecked (TRUE -> FALSE)
      targetCell.clearContent();
      Logger.log('Cleared user ID in row ' + row + ', column ' + (range.getColumn() + USER_ID_COLUMN_OFFSET));
    }
  }
}