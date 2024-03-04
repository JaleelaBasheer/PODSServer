// Create a database connection
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbFilePath = path.join(__dirname, 'mydatabase.db');
const db = new sqlite3.Database(dbFilePath);

// Create users table
db.serialize(function() {
    db.run("CREATE TABLE IF NOT EXISTS fileDetails (CoordinateTable TEXT,filesLoaded TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS BoundingboxTable (fileid TEXT, meshid TEXT, fileName TEXT, meshName TEXT , tagNo TEXT, coOrdinateX REAL, coOrdinateY REAL, coOrdinateZ REAL)");
    
});
console.log("sqlite3 connected successfully!!!!")

module.exports = db