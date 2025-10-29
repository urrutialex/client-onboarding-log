// --- CONFIGURATION ---
const SHEET_NAME = 'Contacts'; 
const HEADER_ROW = 4;        
const CALENDAR_ID = 'alex.urrutia@socialskills4life.org'; // <--- ⚠️ REPLACE THIS
const APPOINTMENT_SCHEDULE_TITLE = 'ABA Intake Call (Social Skills 4 Life)'; // <--- ⚠️ MUST MATCH YOUR SCHEDULE TITLE

// MAPPING: Ensure these labels match EXACTLY what's on your booking form
const CUSTOM_LABELS = {
  insurance: 'Insurance', 
  location: 'Location',   
  phone: 'Phone number',  // Updated to match new form label
  clientName: 'Client Name',  // New field
  age: 'Age'  // New field
};

/**
 * Main function triggered by the Time-driven trigger (e.g., every 5 minutes).
 * Checks for new appointments and logs them to the Google Sheet.
 */
function logAppointment() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  
  // Define a time range to check: Last hour to capture any recent bookings
  const now = new Date();
  const lastHour = new Date(now.getTime() - (60 * 60 * 1000));
  
  // We check for events that start from one hour ago into the future (up to 30 days)
  const events = calendar.getEvents(lastHour, new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)));

  Logger.log('Total events found in range: ' + events.length); // Debug: Total events

  // Prep for skipping already-logged events (using Column A for Event ID)
  const eventIdColumn = 1; 
  const lastRow = sheet.getLastRow();
  let existingIds = [];
  
  if (lastRow > HEADER_ROW) {
    existingIds = sheet.getRange(HEADER_ROW + 1, eventIdColumn, lastRow - HEADER_ROW, 1)
                       .getValues()
                       .map(row => row[0]).filter(String);
  }

  for (const event of events) {
    const eventId = event.getId();
    const eventTitle = event.getTitle();

    Logger.log('Checking event: ' + eventTitle + ' (ID: ' + eventId + ')'); // Debug: Each event

    // 1. FILTER: Skip if already logged
    if (existingIds.includes(eventId)) {
      Logger.log('Skipped: Already logged'); // Debug
      continue;
    }
    
    // 2. FILTER: Only process appointments from the specific schedule
    if (!eventTitle.includes(APPOINTMENT_SCHEDULE_TITLE)) {
      Logger.log('Skipped: Title does not match "' + APPOINTMENT_SCHEDULE_TITLE + '"'); // Debug
      continue;
    }
    
    const eventDate = event.getStartTime();
    const description = event.getDescription();
    const guests = event.getGuests();
    
    Logger.log('Event has ' + guests.length + ' guests'); // Debug
    Logger.log('Guests emails: ' + JSON.stringify(guests.map(g => g.getEmail()))); // Debug: Show guest emails
    Logger.log('Raw event description: ' + description); // Debug: Show raw description
    
    // 3. FILTER: Ensure it has guests (i.e., a client booked it)
    if (guests.length === 0) {
      Logger.log('Skipped: No guests'); // Debug
      continue;
    }

    // --- SIMPLIFIED EMAIL EXTRACTION (SINCE GUESTS[0] IS A STRING) ---
    // const clientEmail = guests[0]; // Directly use the string as email  -- REMOVED, now parsed from description

    // --- DECLARE NAME VARIABLES ---
    let firstName = 'N/A';
    let lastName = 'N/A';
    let clientEmail = 'N/A';
    let phone = 'N/A';

    // Parse the name, email, and phone from the description
    if (description) {
      // Handle HTML line breaks
      const descLines = description.replace(/<br\s*\/?>/gi, '\n').split('\n');
      
      // Find the "Booked by" line and get the name from the next line
      let bookedByIndex = -1;
      for (let i = 0; i < descLines.length; i++) {
        if (descLines[i].trim().includes('<b>Booked by</b>')) {
          bookedByIndex = i;
          break;
        }
      }
      if (bookedByIndex !== -1 && bookedByIndex + 1 < descLines.length) {
        const nameLine = descLines[bookedByIndex + 1].trim();
        const nameParts = nameLine.split(' ');
        if (nameParts.length >= 2) {
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' '); // Handle multi-word last names
        } else if (nameParts.length === 1) {
          firstName = nameLine;
        }
        // Extract email and phone: Find the first email-like line after the name, then the next line as phone
        const emailRegex = /^\S+@\S+\.\S+$/;
        let emailFound = false;
        for (let j = bookedByIndex + 2; j < descLines.length; j++) {
          const line = descLines[j].trim();
          if (emailRegex.test(line)) {
            clientEmail = line;
            // The next line after email is phone
            if (j + 1 < descLines.length) {
              phone = descLines[j + 1].trim();
            }
            emailFound = true;
            break;
          }
        }
        if (!emailFound) {
          // Fallback: if no email found, use the assumed positions
          if (bookedByIndex + 2 < descLines.length) {
            clientEmail = descLines[bookedByIndex + 2].trim();
          }
          if (bookedByIndex + 3 < descLines.length) {
            phone = descLines[bookedByIndex + 3].trim();
          }
        }
      }
      
      Logger.log('Parsed clientEmail: ' + clientEmail); // Debug: Show parsed email
      Logger.log('Parsed phone: ' + phone); // Debug: Show parsed phone
      
      // Fallback to "First name" / "Last name" parsing
      for (const line of descLines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('First name')) {
          firstName = trimmedLine.split('First name')[1].trim();
        } else if (trimmedLine.startsWith('Last name')) {
          lastName = trimmedLine.split('Last name')[1].trim();
        }
      }
    }
    
    // Combine to form the full Guardian Name for Column G
    const guardianName = (firstName !== 'N/A' || lastName !== 'N/A') ? 
                         `${firstName} ${lastName}`.trim() : 
                         'Unknown Guardian';

    // Extract Custom Fields (Phone, Insurance, Location)
    const data = extractCustomData(description, CUSTOM_LABELS, clientEmail);
    
    // Override phone with the directly parsed value from description
    data.phone = phone;
    
    Logger.log('Extracted data: ' + JSON.stringify(data)); // Debug: Show parsed fields
    
    // --- CREATE THE NEW ROW (A, B, C, D, E, F, G, H, I) ---
    // The data is pushed into the array based on your required column order
    const newRow = [
      eventId,                // A: Calendar Event ID (for tracking)
      eventDate,              // B: Contact Date
      data.clientName,        // C: Client Name (from form)
      data.insurance,         // D: Insurance
      data.location,          // E: Location
      data.age,               // F: Age (from form)
      guardianName,           // G: Guardian Name (from "Booked by" or "First name"/"Last name")
      data.phone,             // H: Contact Phone
      clientEmail             // I: Email (from guest or "Email address")
    ];

    Logger.log('New row array: ' + JSON.stringify(newRow)); // Debug: Show the full row being inserted

    // Insert a new row at the top (after header row 4) and add the data there
    sheet.insertRowBefore(5); // Inserts a new row 5, shifting existing data down
    sheet.getRange(5, 1, 1, newRow.length).setValues([newRow]); // Set values in the new row 5 (columns A to J)

    Logger.log(`Logged new appointment for: ${guardianName}`);
  }
}

/**
 * Helper function to parse key-value data for custom fields from the calendar event description.
 */
function extractCustomData(description, labels, clientEmail) {
  const result = {
    insurance: '',
    location: '',
    phone: '',
    clientName: '',  // New field
    age: ''  // New field
  };
  
  if (!description) return result;
  
  // Handle HTML line breaks and split into lines
  const lines = description.replace(/<br\s*\/?>/gi, '\n').split('\n');
  
  for (const key in labels) {
    const label = labels[key];
    for (let i = 0; i < lines.length; i++) {
      // Check for <b>Label</b> and take the next line as value
      if (lines[i].includes('<b>' + label + '</b>')) {
        if (i + 1 < lines.length) {
          result[key] = lines[i + 1].trim();
        }
        break;
      }
    }
  }
  
  // Special handling for phone: Find the line with the email, next line is phone
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === clientEmail) {
      if (i + 1 < lines.length) {
        result.phone = lines[i + 1].trim();
      }
      break;
    }
  }
  
  return result;
}