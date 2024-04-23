'use strict'
const db = require('../db/connection');
const AWS = require('aws-sdk');
const fs = require('fs');
const request = require('request-promise');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();

// add new  files

exports.addUser = async (req, res) => {
  console.log(`Inside add files function`);
  const { CoordinateTable} = req.body;
  const{ObjectTable} =req.body;
  console.log(ObjectTable)

  // Parse the CoordinateTable string into a JavaScript object
  const coordinateTable = JSON.parse(req.body.CoordinateTable);
  const objectTable = JSON.parse(req.body.ObjectTable);

  // Store uploaded filenames as a comma-separated string
  const filesLoaded = req.files.map(file => file.filename).join(',');

  try {
      console.log("Add new user");
      // Insert data into the fileDetails table
      db.run("INSERT INTO fileDetails (CoordinateTable, filesLoaded) VALUES (?, ?)", [CoordinateTable, filesLoaded], function(err) {
          if (err) {
              console.error(err.message);
              return res.status(500).json({ error: 'Internal Server Error' });
          }
          
          // Insert data into the BoundingBoxTable
          coordinateTable.forEach(coordinate => {
              const { fileid, fileName,meshName, tagNo,offset } = coordinate;
              const { x, y, z } = offset; 
              const meshid = uuidv4();             
              db.run("INSERT INTO BoundingboxTable (fileid,meshid, fileName,meshName,tagNo, coOrdinateX, coOrdinateY, coOrdinateZ) VALUES (?, ?, ?, ?, ?,?,?,?)", [fileid,meshid, fileName, meshName,tagNo, x, y, z], function(err) {
                  if (err) {
                      console.error(err.message);
                      return res.status(500).json({ error: 'Internal Server Error' });
                  }
              });
          });
            // Insert data into the BoundingBoxTable
            objectTable.forEach(coordinate => {
              const { fileid, objectName,offset,maxbbobject,minbbobject } = coordinate;
              const { x, y, z } = offset;              
              
              const bbmaX = maxbbobject.x
              const bbmaY = maxbbobject.y
              const bbmaZ = maxbbobject.z
              const bbmiX = minbbobject.x
              const bbmiY = minbbobject.y
              const bbmiZ = minbbobject.z
              db.run("INSERT INTO FileBoundingTable (fileid, fileName, coOrdinateX, coOrdinateY, coOrdinateZ,maxbbX , maxbbY ,maxbbZ ,minbbX ,minbbY ,minbbZ ) VALUES (?, ?, ?, ?, ?,?,?,?,?,?,?)", [fileid, objectName, x, y, z,bbmaX,bbmaY,bbmaZ,bbmiX,bbmiY,bbmiZ], function(err) {
                  if (err) {
                      console.error(err.message);
                      return res.status(500).json({ error: 'Internal Server Error' });
                  }
              });
          });

          // Return a success response
          res.status(200).json("Files uploaded successfully");
      });
      

  } catch (error) {
      console.error("Error adding user:", error);
      res.status(400).json({ error: 'Bad Request' });
  }
}


// create asset
exports.createAsset = async(req,res)=>{
    console.log(`Inside create asset function`);

    const { name, accessToken } = req.body;
    console.log(name);
    console.log(accessToken);

    try {
        console.log('Add new asset'); 
          // cesium integration
          try {
            // Step 1 POST information about the data to /v1/assets
            console.log('Creating new asset: MyModel');
            const response = await request({
              url: 'https://api.cesium.com/v1/assets',
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json', // Explicitly set content type
              },
              body: {
                name,
                description: 'Your asset model description here.',
                type: '3DTILES',
                options: {
                  sourceType: '3D_MODEL', // Correct sourceType
                },
              },
              json: true, // Automatically stringify the body as JSON
            });
        
            console.log(response);
        
            // Step 2 Use response.uploadLocation to upload the source files to ion
            console.log('Asset created. ');
        
            const uploadLocation = response.uploadLocation;
            console.log(uploadLocation);
        
            const s3 = new AWS.S3({
              apiVersion: '2006-03-01',
              region: 'us-east-1',
              signatureVersion: 'v4',
              endpoint: uploadLocation.endpoint,
              credentials: new AWS.Credentials(
                uploadLocation.accessKey,
                uploadLocation.secretAccessKey,
                uploadLocation.sessionToken
              ),
            });
        // Get all files in the upload folder
        const uploadFolder = './uploads'; // Update with your actual path
        const files = fs.readdirSync(uploadFolder);
            // Upload each source file
            for (const fileName of files) {
                const filePath = path.join(uploadFolder, fileName);
              await s3.upload({
                Body: fs.createReadStream(filePath),
                Bucket: uploadLocation.bucket,
                Key: `${uploadLocation.prefix}${fileName}`,
              })
                .on('httpUploadProgress', function (progress) {
                  console.log(`Upload: ${((progress.loaded / progress.total) * 100).toFixed(2)}%`);
                })
                .promise();
            }
        
            // Step 3 Tell ion we are done uploading files.
            const onComplete = response.onComplete;
            console.log('entering oncomplete');
            await request({
              url: onComplete.url,
              method: onComplete.method,
              headers: { Authorization: `Bearer ${accessToken}` },
              json: true,
              body: onComplete.fields,
            });
            console.log('outside oncomplete');
        
            // Step 4 Monitor the tiling process and report when it is finished.
            async function waitUntilReady(response) {
              try {
                const assetId = response.assetMetadata.id;
                console.log(assetId);
        
                // Issue a GET request for the metadata
                const assetMetadata = await request({
                  url: `https://api.cesium.com/v1/assets/${assetId}`,
                  headers: { Authorization: `Bearer ${accessToken}` },
                  json: true,
                });
                console.log(assetMetadata);
                const status = assetMetadata.status;
                if (status === 'COMPLETE') {
                  console.log('Asset tiled successfully');
                  console.log(`View in ion: https://cesium.com/ion/assets/${assetMetadata.id}`);
                  res.status(200).json("Successfully created asset")
                
                } 
                else if (status === 'DATA_ERROR') {
                  console.log('ion detected a problem with the uploaded data.');
                } 
                else if (status === 'ERROR') {
                  console.log('An unknown tiling error occurred, please contact support@cesium.com.');
                } 
                else {
                  if (status === 'NOT_STARTED') {
                    console.log('Tiling pipeline initializing.');
                  } else {
                    console.log(`Asset is ${assetMetadata.percentComplete}% complete.`);
                  }
        
                  // Not done yet, check again in 10 seconds
                  setTimeout(() => waitUntilReady(response), 10000);
                }
              } catch (error) {
                console.error('Error in waitUntilReady:', error.message);
              }
            }
        
            waitUntilReady(response);
          } catch (error) {
            console.log(error.message);
          }
  
          
      } catch (error) {
        res.status(401).json('Error' + error);
      }

}


// get mesh table
exports.getuser = async (req,res)=>{
    console.log("inside get function");

    try {
        // Perform a SELECT query
db.all("SELECT * FROM BoundingboxTable", (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    // // Print the retrieved data
    // rows.forEach(row => {
    //     console.log(row);
    // });
    res.status(200).json(rows)
})
        
    } catch (error) {
       res.status(400).json(error) 
    }
    
}

// get object table
exports.getobjectTable = async (req,res)=>{
  console.log("inside get function");

  try {
      // Perform a SELECT query
db.all("SELECT * FROM FileBoundingTable", (err, rows) => {
  if (err) {
      console.error(err.message);
      return;
  }
  // Print the retrieved data
  // rows.forEach(row => {
  //     console.log(row);
  // });
  res.status(200).json(rows)
})
      
  } catch (error) {
     res.status(400).json(error) 
  }
  
}

// get all files loaded
exports.getFBXFiles = async (req, res) => {
  try {
      // Define the path to your upload folder
      const uploadFolder = './uploads'; // Update with your actual path

      // Read the files in the upload folder
      fs.readdir(uploadFolder, (err, files) => {
          if (err) {
              console.error('Error reading directory:', err);
              return res.status(500).json({ error: 'Internal Server Error' });
          }

          // Filter only FBX files
          const fbxFiles = files.filter(file => file.endsWith('.fbx'));
          // console.log(fbxFiles)

          // Serve the list of FBX files to the client
          res.status(200).json(fbxFiles);
      });
  } catch (error) {
      console.error('Error serving FBX files:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
};

// add comments
exports.addComment = async(req,res)=>{
  console.log(`Inside add comment function`);
  const { fileid,filename,comment,status,priority,coordinateX,coordinateY,coordinateZ} = req.body;
  const createdby="jpo@poulconsul"
  const createddate = new Date().toISOString();
  console.log(req.body);
  try {
    console.log("Add new comment");
    db.get("SELECT MAX(number) AS max_number FROM CommentTable", function(err, row) {
      if (err) {
          console.error(err.message);
          return res.status(500).json({ error: 'Internal Server Error' });
      }
      
      // Calculate the new number by incrementing the maximum number by 1
      const number = parseInt(row.max_number) + 1 || 1;
    // Insert data into the fileDetails table
    db.run("INSERT INTO CommentTable (fileid, fileName, number, comment, status, priority, createdby, createddate, coOrdinateX, coOrdinateY, coOrdinateZ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [fileid, filename, number, comment, status, priority, createdby, createddate, coordinateX, coordinateY, coordinateZ], function(err) {        
      if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }    
       // Return a success response
        res.status(200).json("New comment uploaded successfully");
    });
  });
    

} catch (error) {
    console.error("Error adding user:", error);
    res.status(400).json({ error: 'Bad Request' });
}
  
}

// get all comments
exports.getallcomments =async(req,res)=>{
  console.log("inside get all function function");

  try {
      // Perform a SELECT query
db.all("SELECT * FROM commentTable", (err, rows) => {
  if (err) {
      console.error(err.message);
      return;
  }
  // Print the retrieved data
  // rows.forEach(row => {
  //     console.log(row);
  // });
  res.status(200).json(rows)
})
      
  } catch (error) {
     res.status(400).json(error) 
  }
  
}

// all tables in database
exports.showtables = async (req,res)=>{
  console.log(`Inside show all table function`);
  try {

// Query to retrieve all table names
const query = `SELECT name FROM sqlite_master WHERE type='table'`;

// Execute the query
db.all(query, [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    
    // Extract and display table names
    rows.forEach((row) => {
        console.log(row.name);
       
    });
    res.status(200).json(rows);
});
    
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(400).json({ error: 'Bad Request' });
  }

}

// delete table from database
exports.deletetable = async(req,res)=>{
  console.log("inside delete function");
  try {
    // Table name to be deleted
const tableName = 'Tags';

// SQL command to drop the table
const query = `DROP TABLE IF EXISTS ${tableName}`;

// Execute the query
db.run(query, [], function(err) {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log(`Table ${tableName} has been deleted.`);
    res.status(200).json(`Table ${tableName} has been deleted.`)
});
    
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(400).json({ error: 'Bad Request' });
  }
}


// Function to create a new folder
const createFolder = (folderPath) => {
  return new Promise((resolve, reject) => {
    fs.mkdir(folderPath, { recursive: true }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/// Function to create the database file and table
const createDatabaseFile = (dbPath) => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`Database file created at ${dbPath}`);
        // Drop existing tables if they exist
        db.run("DROP TABLE IF EXISTS projects", (dropProjectsErr) => {
          if (dropProjectsErr) {
            reject(dropProjectsErr);
          } else {
            // Create table for the projects
            const projectSql = `CREATE TABLE IF NOT EXISTS projects (
                                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                                 projectId TEXT,
                                 projectNo TEXT,
                                 projectName TEXT,
                                 projectDescription TEXT
                               )`;

            // Create table for the Tree
            const treeSql = `CREATE TABLE IF NOT EXISTS Tree (
                               area TEXT,
                               disc TEXT,
                               sys TEXT,
                               tag TEXT,
                               name TEXT,
                               PRIMARY KEY(area, disc, sys, tag)
                             )`;

            // Create table for UnassignedModels
            const unassignedModelsSql = `CREATE TABLE IF NOT EXISTS UnassignedModels (
                                           number TEXT,
                                           filename TEXT,
                                           PRIMARY KEY(number)
                                         )`;

            // Create table for Tags
            const tagsSql = `CREATE TABLE IF NOT EXISTS Tags (
                               number TEXT,
                               name TEXT,
                               type TEXT,
                               filename TEXT,
                               PRIMARY KEY(number)
                             )`;

            // Run all SQL queries in sequence
            db.serialize(() => {
              db.run(projectSql, (createProjectErr) => {
                if (createProjectErr) {
                  reject(createProjectErr);
                } else {
                  console.log(`Table created for projects`);
                  db.run(treeSql, (createTreeErr) => {
                    if (createTreeErr) {
                      reject(createTreeErr);
                    } else {
                      console.log(`Table created for Tree`);
                      db.run(unassignedModelsSql, (createUnassignedModelsErr) => {
                        if (createUnassignedModelsErr) {
                          reject(createUnassignedModelsErr);
                        } else {
                          console.log(`Table created for UnassignedModels`);
                          db.run(tagsSql, (createTagsErr) => {
                            if (createTagsErr) {
                              reject(createTagsErr);
                            } else {
                              console.log(`Table created for Tags`);
                              resolve(db);
                            }
                          });
                        }
                      });
                    }
                  });
                }
              });
            });
          }
        });
      }
    });
  });
};


// Function to save project details to the database
const saveProjectDetails = (dbproject, projectId,projectNo, projectName, projectDescription) => {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO projects (projectId,projectNo, projectName, projectDescription) VALUES (?, ?, ?,?)`;
    dbproject.run(sql, [projectId,projectNo, projectName, projectDescription], (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`Project details saved to database`);
        resolve();
      }
    });
  });
 
};
// Function to save area details to the database
const saveAreaDetails = (db, area, name) => {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO Tree (area, name) VALUES (?, ?)`;
    db.run(sql, [area, name], (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`Area details saved to database`);
        resolve();
      }
    });
  });
};

const saveProjectDetailstoServer=async(projectId,projectNo, projectName, projectDescription)=>{
  console.log(projectId,projectNo, projectName, projectDescription)
  try {
    console.log("Add new project");
   
    // Insert data into the fileDetails table
    db.run("INSERT INTO projects (projectId,projectNo, projectname, projectdescription) VALUES (?, ?, ?,?)", [projectId,projectNo, projectName, projectDescription], function(err) {        
      if (err) {
            console.error(err.message);
            // return res.status(500).json({ error: 'Internal Server Error' });
        }    
       // Return a success response
       console.log("New project uploaded successfully");
    });
    

} catch (error) {
    console.error("Error adding user:", error);
    res.status(400).json({ error: 'Bad Request' });
}

}

exports.opennewproject = async (req, res) => {
  console.log("create new project")
  try {
    const {projectId, projectNo, projectName, projectDescription } = req.body;
    // Check if project name is provided
    if (!projectName) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // Create folder path for the project on desktop
    const desktopPath = require('os').homedir() + '/Desktop';
    const projectFolderPath = path.join(desktopPath, projectName);

    // Create the project folder on desktop
    await createFolder(projectFolderPath);


    // Assuming your database file is named 'database.db'
    const dbPath = path.join(projectFolderPath, 'database.db');


    // Check if the database file exists
    if (!fs.existsSync(dbPath)) {
      console.log("dbPath",dbPath)
      // If database file doesn't exist, create it
      await createDatabaseFile(dbPath);
    }

    // Save project details to the database
    const dbproject = new sqlite3.Database(dbPath);
    await saveProjectDetails(dbproject,projectId,projectNo, projectName, projectDescription);
    await saveProjectDetailstoServer(projectId,projectNo, projectName, projectDescription);

      // Return a success response
      res.json({ dbPath, projectId, projectNo,projectName, projectDescription });

  

} catch (error) {
  console.error('Error creating new project:', error);
    res.status(500).json({ error: 'Bad request' });
}
};

// get all projects
exports.getallprojectsss = async (req, res) => {
  try {
    // Perform a SELECT query
db.all("SELECT * FROM Tree", (err, rows) => {
if (err) {
    console.error(err.message);
    return;
}
// Print the retrieved data
rows.forEach(row => {
    console.log(row);
});
res.status(200).json(rows)
})
    
} catch (error) {
   res.status(400).json(error) 
}
};

// add area
exports.addarea=async(req,res)=>{
  const {code,name} = req.body
    console.log("Add area");

    try {
      console.log("Add area");
      
      // Insert data into the fileDetails table
      db.run("INSERT INTO Tree (area,name) VALUES (?, ?)", [code,name], function(err) {        
        if (err) {
              console.error(err.message);
              return res.status(500).json({ error: 'Internal Server Error' });
          }    
         // Return a success response
          res.status(200).json("Area added");
      });
      
  
  } catch (error) {
      console.error("Error adding user:", error);
      res.status(400).json({ error: 'Bad Request' });
  }
}

// add discipline
exports.adddiscipline=async(req,res)=>{
  const {code,name} = req.body

    try {
      console.log("Add dis");
      
      // Insert data into the fileDetails table
      db.run("INSERT INTO Tree (disc,name) VALUES (?, ?)", [code,name], function(err) {        
        if (err) {
              console.error(err.message);
              return res.status(500).json({ error: 'Internal Server Error' });
          }    
         // Return a success response
          res.status(200).json("Discipline added");
      });
      
  
  } catch (error) {
      console.error("Error adding user:", error);
      res.status(400).json({ error: 'Bad Request' });
  }
}

// add system
exports.addsystem=async(req,res)=>{
  const {code,name} = req.body

    try {
      console.log("Add sys");
      
      // Insert data into the fileDetails table
      db.run("INSERT INTO Tree (sys,name) VALUES (?, ?)", [code,name], function(err) {        
        if (err) {
              console.error(err.message);
              return res.status(500).json({ error: 'Internal Server Error' });
          }    
         // Return a success response
          res.status(200).json("System added");
      });
      
  
  } catch (error) {
      console.error("Error adding user:", error);
      res.status(400).json({ error: 'Bad Request' });
  }
}

// new tag registration 
exports.registerNewTag=async(req,res)=>{
  const {tagNo,TagName,Type} = req.body
  const filesLoaded = req.files
    try {
      console.log("register new tag");
      
      // Insert data into the fileDetails table
      db.run("INSERT INTO Tags (number,name ,type ,filename ) VALUES (?, ?,?,?)", [tagNo,TagName,Type,req.file.filename], function(err) {        
        if (err) {
              console.error(err.message);
              return res.status(500).json({ error: 'Internal Server Error' });
          }    
        // Fetch the inserted data
      db.get("SELECT * FROM Tags WHERE number = ?", [tagNo], (selectErr, row) => {
        if (selectErr) {
          console.error(selectErr.message);
          return res.status(500).json({ error: 'Internal Server Error' });
        }

        // Return the inserted data in the response
        res.status(200).json(row);
      });
    });
      
  
  } catch (error) {
      console.error("Error adding user:", error);
      res.status(400).json({ error: 'Bad Request' });
  }
}


// get all area

exports.getallarea = async (req, res) => {
  try {
    db.all("SELECT area, name FROM Tree", (err, rows) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      if (rows && rows.length > 0) {
        console.log(rows);
        res.status(200).json(rows);
      } else {
        console.log("No areas found");
        res.status(404).json({ message: "No areas found" });
      }
    });
  } catch (error) {
    console.error("Error retrieving areas:", error);
    res.status(400).json({ error: 'Bad Request' });
  }
};

// -----------------------------------------------------------------------//
// single user
exports.getsingleuser = async(req,res)=>{
    const {id} = req.body
    console.log("Get inside single user");
    try {
        db.get("SELECT * FROM commentTable WHERE id = ?", [id], (err, row) => {
            if (err) {
                console.error(err.message);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
            if (row) {
                console.log(row)
                res.status(200).json(row)
            }
            else{
                console.log("no user found");
                res.status(500).json("No user found");
            }
        })
        
    } catch (error) {
       res.status(400).json(error) 
    }
}

// edit and update
 exports.editdata = async (req, res) => {
    console.log("inside edit data");
    const { username, mobile } = req.body;

    try {
        // Check if the user already exists
        db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
            if (err) {
                console.error(err.message);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
            if (row) {
                console.log(row)
                // User exists, perform update
                db.run("UPDATE users SET mobile = ? WHERE username = ?", [mobile, username], function (err) {
                    if (err) {
                        console.error(err.message);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }
                    console.log(`Updated ${this.changes} row(s)`);
                    return res.status(200).json({ message: 'User updated successfully' });
                });
            } else {
                // User does not exist, return error
                return res.status(404).json({ error: 'User not found' });
            }
        });
    } catch (error) {
        console.error(error.message);
        return res.status(400).json({ error: 'Bad Request' });
    }
};

// delete row

exports.deleterow =async (req,res)=>{
    console.log("inside delete function")
    const{id}=req.body
    try {
        db.get("DELETE  FROM users WHERE id = ?", [id], (err, row) => {
            if (err) {
                console.error(err.message);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
           
            else{
                console.log("row deleted");
                res.status(200).json("Row deleted successfully")
            }
        })

        
    } catch (error) {
        res.status(400).json(error)
    }
}