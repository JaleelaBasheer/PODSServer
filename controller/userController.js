'use strict'
const db = require('../db/connection');
const AWS = require('aws-sdk');
const fs = require('fs');
const request = require('request-promise');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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
    // Print the retrieved data
    rows.forEach(row => {
        console.log(row);
    });
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
  rows.forEach(row => {
      console.log(row);
  });
  res.status(200).json(rows)
})
      
  } catch (error) {
     res.status(400).json(error) 
  }
  
}

// single user
exports.getsingleuser = async(req,res)=>{
    const {id} = req.body
    console.log("Get inside single user");
    try {
        db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
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