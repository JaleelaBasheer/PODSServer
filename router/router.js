const express = require('express');
const userController = require('../controller/userController');
const router = new express.Router();
const multerConfig = require('../middleware/multerMiddleware');
const tagMulter = require('../middleware/tagMiddleware');


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

// add area
router.post ('/addarea',userController.addarea);

// add discipline 
router.post ('/adddisc',userController.adddiscipline);

// add system
router.post ('/addsys',userController.addsystem);

// tag registration
router.post ('/registernewtag',tagMulter.single('fileLoaded'),userController.registerNewTag);

// get all area
router.get ('/getallarea',userController.getallarea);

// get all disc
router.get ('/getalldisc',userController.getalldisc);

// get all sys
router.get ('/getallsys',userController.getallsys);

// delete comment
router.delete('/deletecomment/:number',userController.deleteCommentRow)


// -------------------------------------------------//
// edit user
router.put('/edit',userController.editdata)
// get single user
router.get('/singleuser',userController.getsingleuser)
// deleterow
router.delete('/delete',userController.deleterow)

module.exports=router