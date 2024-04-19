const express = require('express')
const cors = require('cors');
require('./db/connection')
const router = require('./router/router')
// Create an express application
const Server = express()

// use json parser in server
Server.use(express.json())
Server.use(cors());

Server.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

Server.use('/uploads',express.static("./uploads"))
Server.use(router)

// Setup port number to listen server
const port = 4000

// run or listen server app
Server.listen(port,()=>{
    console.log(`Backend server started at port no:${port}`);
})

// get request
Server.get("/",(req,res)=>{
    res.status(200).send(`<h1>Application server started</h1>`)
})