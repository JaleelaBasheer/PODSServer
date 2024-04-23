// Create a database connection
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbFilePath = path.join(__dirname, 'mydatabase.db');
const db = new sqlite3.Database(dbFilePath);

// Create users table
db.serialize(function() {
    db.run("CREATE TABLE IF NOT EXISTS fileDetails (CoordinateTable TEXT,filesLoaded TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS BoundingboxTable (fileid TEXT, meshid TEXT, fileName TEXT, meshName TEXT , tagNo TEXT, coOrdinateX REAL, coOrdinateY REAL, coOrdinateZ REAL)");
    db.run("CREATE TABLE IF NOT EXISTS FileBoundingTable (fileid TEXT, fileName TEXT, coOrdinateX REAL, coOrdinateY REAL, coOrdinateZ REAL, maxbbX REAL, maxbbY REAL,maxbbZ REAL,minbbX REAL,minbbY REAL,minbbZ REAL)");
    db.run("CREATE TABLE IF NOT EXISTS CommentTable (fileid TEXT,fileName TEXT,number TEXT,comment TEXT,status TEXT,priority TEXT,createdby TEXT,createddate TEXT,coOrdinateX REAL,coOrdinateY REAL,coOrdinateZ REAL,closedBy TEXT,closedDate TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS projects ( projectId TEXT, projectNo TEXT, projectname TEXT, projectdescription TEXT)");
    db.run('CREATE TABLE IF NOT EXISTS Tree (area TEXT, disc TEXT, sys TEXT, tag TEXT, name TEXT, PRIMARY KEY(area, disc, sys, tag))')
    db.run('CREATE TABLE IF NOT EXISTS Tags (number TEXT, name TEXT, type TEXT, filename TEXT, PRIMARY KEY(number))')
    db.run('CREATE TABLE IF NOT EXISTS UnassignedModels (number TEXT, filename TEXT, PRIMARY KEY(number))')

    
});
console.log("sqlite3 connected successfully!!!!")

module.exports = db