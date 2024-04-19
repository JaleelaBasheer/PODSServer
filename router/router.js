const express = require('express')
const userController = require('../controller/userController')
const router = new express.Router()
const multerConfig = require('../middleware/multerMiddleware')


// add file
router.post('/add',multerConfig,userController.addUser);

// create asset
router.post('/createasset',userController.createAsset);

// get user
router.get('/getall',userController.getuser);

// get object table
router.get('/getallobject',userController.getobjectTable);

// get all fbx files
router.get('/getallfbxfiles',multerConfig,userController.getFBXFiles);

// add new comment
router.post('/addcomment',userController.addComment);

// get all comment
router.get('/getcomment',userController.getallcomments);

// show all table
router.get('/alltable',userController.showtables);

// delete table
router.delete('/deletetable',userController.deletetable);

// open new project
router.post('/opennewproject', userController.opennewproject);

// getallproject
router.get ('/getallprojects',userController.getallprojectsss);




// -------------------------------------------------//
// edit user
router.put('/edit',userController.editdata)
// get single user
router.get('/singleuser',userController.getsingleuser)
// deleterow
router.delete('/delete',userController.deleterow)

module.exports=router