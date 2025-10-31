const fs = require('fs');
const path = require('path');

// Test if uploads directory exists and is writable
const uploadsDir = path.join(__dirname, 'shosho9-main', 'backend', 'uploads');

console.log('Checking uploads directory:', uploadsDir);
console.log('Directory exists:', fs.existsSync(uploadsDir));

if (fs.existsSync(uploadsDir)) {
  console.log('Directory is writable:', fs.accessSync(uploadsDir, fs.constants.W_OK) === undefined);
  
  // List files in uploads directory
  try {
    const files = fs.readdirSync(uploadsDir);
    console.log('Files in uploads directory:', files);
  } catch (error) {
    console.error('Error reading uploads directory:', error);
  }
} else {
  console.log('Creating uploads directory...');
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Uploads directory created successfully');
  } catch (error) {
    console.error('Error creating uploads directory:', error);
  }
}

